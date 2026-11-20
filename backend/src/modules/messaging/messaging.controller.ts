import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';
import {
  processQueue,
  queueMessage,
  raiseScheduledAlerts,
  renderTemplate,
  whatsappLink,
} from './messaging.service';

const templateSchema = z.object({
  code: z.string().trim().min(2, 'كود القالب مطلوب').max(60).toUpperCase(),
  nameAr: z.string().trim().min(2, 'اسم القالب بالعربية مطلوب'),
  nameEn: z.string().trim().min(2, 'اسم القالب بالإنجليزية مطلوب'),
  channel: z.enum(['WHATSAPP', 'INTERNAL']).default('WHATSAPP'),
  bodyAr: z.string().trim().min(2, 'نص الرسالة بالعربية مطلوب'),
  bodyEn: z.string().trim().min(2, 'نص الرسالة بالإنجليزية مطلوب'),
  variables: z.string().trim().optional().nullable(),
});

const templateUpdateSchema = templateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const queueSchema = z.object({
  templateCode: z.string().trim().optional(),
  channel: z.enum(['WHATSAPP', 'INTERNAL']).optional(),
  customerId: z.string().uuid().optional().nullable(),
  jobCardId: z.string().uuid().optional().nullable(),
  lang: z.enum(['ar', 'en']).optional(),
  body: z.string().trim().optional(),
  values: z.record(z.union([z.string(), z.number()])).optional(),
  scheduledAt: z.coerce.date().optional(),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors.map(e => e.message).join(', '), 400);
  }
  return result.data;
}

const SKIP_REASONS: Record<string, string> = {
  OPTED_OUT: 'العميل أوقف استقبال الرسائل',
  NO_TEMPLATE: 'القالب غير موجود',
  TEMPLATE_INACTIVE: 'القالب متوقف',
  NO_RECIPIENT: 'لا يوجد رقم جوال صالح للعميل',
};

export class MessagingController {
  // ---------- Templates ----------
  static async listTemplates(request: FastifyRequest, reply: FastifyReply) {
    const templates = await prisma.messageTemplate.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { messages: true } } },
      orderBy: { code: 'asc' },
    });
    return reply.send({ templates });
  }

  static async createTemplate(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(templateSchema, request.body);

    const clash = await prisma.messageTemplate.findFirst({
      where: { code: data.code, deletedAt: null },
    });
    if (clash) throw new AppError('كود القالب مستخدم بالفعل', 409);

    const template = await prisma.messageTemplate.create({ data });
    return reply.status(201).send({ message: 'تم إضافة القالب بنجاح', template });
  }

  static async updateTemplate(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = parse(templateUpdateSchema, request.body);

    const existing = await prisma.messageTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('القالب غير موجود', 404);

    // A system template's code is what the automatic triggers look for.
    if (existing.isSystem && data.code && data.code !== existing.code) {
      throw new AppError('لا يمكن تغيير كود قالب يعتمد عليه النظام — عدّل النص فقط', 400);
    }

    const template = await prisma.messageTemplate.update({ where: { id }, data });
    return reply.send({ message: 'تم تحديث القالب بنجاح', template });
  }

  static async removeTemplate(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.messageTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('القالب غير موجود', 404);
    if (existing.isSystem) {
      throw new AppError('قالب أساسي يعتمد عليه النظام — يمكنك إيقافه بدل حذفه', 400);
    }

    await prisma.messageTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.send({ message: 'تم حذف القالب' });
  }

  /** Previews a template with sample values, before it is saved or sent. */
  static async previewTemplate(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { lang = 'ar', values = {} } = request.body as {
      lang?: string;
      values?: Record<string, string>;
    };

    const template = await prisma.messageTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!template) throw new AppError('القالب غير موجود', 404);

    const body = lang === 'en' ? template.bodyEn : template.bodyAr;
    return reply.send({ preview: renderTemplate(body, values) });
  }

  // ---------- Queue & log ----------
  static async listMessages(request: FastifyRequest, reply: FastifyReply) {
    const { status, channel, customerId, search, page = '1', limit = '20' } =
      request.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    const skip = (pageNum - 1) * take;

    const where: any = {};
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { body: { contains: search } },
        { recipientName: { contains: search } },
        { recipientNumber: { contains: search } },
      ];
    }

    const [messages, total] = await Promise.all([
      prisma.outboundMessage.findMany({
        where,
        include: {
          template: { select: { code: true, nameAr: true, nameEn: true } },
          jobCard: { select: { id: true, jobNumber: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.outboundMessage.count({ where }),
    ]);

    return reply.send({
      messages: messages.map(m => ({
        ...m,
        // The link the employee opens to actually send it, until M8 lands.
        sendLink: m.status === 'PENDING' ? whatsappLink(m.recipientNumber, m.body) : null,
      })),
      pagination: { page: pageNum, limit: take, total, pages: Math.ceil(total / take) },
    });
  }

  static async stats(request: FastifyRequest, reply: FastifyReply) {
    const [pending, sent, failed, cancelled] = await Promise.all([
      prisma.outboundMessage.count({ where: { status: 'PENDING' } }),
      prisma.outboundMessage.count({ where: { status: 'SENT' } }),
      prisma.outboundMessage.count({ where: { status: 'FAILED' } }),
      prisma.outboundMessage.count({ where: { status: 'CANCELLED' } }),
    ]);

    const optedOut = await prisma.customer.count({
      where: { deletedAt: null, messagingOptOut: true },
    });

    return reply.send({ counts: { pending, sent, failed, cancelled }, optedOut });
  }

  static async queue(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(queueSchema, request.body);

    const result = await queueMessage({
      ...data,
      createdById: request.user?.id || null,
    });

    if (!result.queued) {
      throw new AppError(SKIP_REASONS[result.reason || ''] || 'تعذّر إضافة الرسالة للطابور', 400);
    }

    const message = await prisma.outboundMessage.findUnique({ where: { id: result.messageId! } });
    return reply.status(201).send({
      message: 'تمت إضافة الرسالة إلى الطابور',
      outboundMessage: {
        ...message,
        sendLink: whatsappLink(message!.recipientNumber, message!.body),
      },
    });
  }

  /** Marks a WhatsApp message as dispatched once the employee has sent it. */
  static async markSent(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.outboundMessage.findUnique({ where: { id } });
    if (!existing) throw new AppError('الرسالة غير موجودة', 404);
    if (existing.status === 'SENT') throw new AppError('الرسالة مُرسلة بالفعل', 400);

    const message = await prisma.outboundMessage.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
    });

    return reply.send({ message: 'تم تسجيل إرسال الرسالة', outboundMessage: message });
  }

  /** Puts a failed message back on the queue. */
  static async retry(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.outboundMessage.findUnique({ where: { id } });
    if (!existing) throw new AppError('الرسالة غير موجودة', 404);
    if (existing.status === 'SENT') throw new AppError('الرسالة مُرسلة بالفعل', 400);

    const message = await prisma.outboundMessage.update({
      where: { id },
      data: { status: 'PENDING', scheduledAt: new Date(), lastError: null },
    });

    return reply.send({ message: 'تمت إعادة الرسالة إلى الطابور', outboundMessage: message });
  }

  static async cancel(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.outboundMessage.findUnique({ where: { id } });
    if (!existing) throw new AppError('الرسالة غير موجودة', 404);
    if (existing.status === 'SENT') throw new AppError('لا يمكن إلغاء رسالة مُرسلة', 400);

    const message = await prisma.outboundMessage.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return reply.send({ message: 'تم إلغاء الرسالة', outboundMessage: message });
  }

  /** Runs the queue and the scheduled alerts on demand. */
  static async runQueue(request: FastifyRequest, reply: FastifyReply) {
    const queue = await processQueue();
    const alerts = await raiseScheduledAlerts();
    return reply.send({ message: 'تم تشغيل الطابور', queue, alerts });
  }

  // ---------- Opt-out ----------
  static async setOptOut(request: FastifyRequest, reply: FastifyReply) {
    const { customerId } = request.params as { customerId: string };
    const { optOut } = request.body as { optOut?: boolean };

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) throw new AppError('العميل غير موجود', 404);

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        messagingOptOut: optOut !== false,
        optedOutAt: optOut !== false ? new Date() : null,
      },
      select: { id: true, fullName: true, messagingOptOut: true, optedOutAt: true },
    });

    // Anything already waiting for them is dropped, not left to go out later.
    if (updated.messagingOptOut) {
      await prisma.outboundMessage.updateMany({
        where: { customerId, status: 'PENDING', channel: { not: 'INTERNAL' } },
        data: { status: 'CANCELLED', lastError: 'العميل أوقف استقبال الرسائل' },
      });
    }

    return reply.send({
      message: updated.messagingOptOut ? 'تم إيقاف الرسائل عن العميل' : 'تم تفعيل الرسائل للعميل',
      customer: updated,
    });
  }

  // ---------- Notifications ----------
  /**
   * What this user should see: anything addressed to them personally, or to
   * their role. The admin oversees the workshop, so every role-wide alert
   * reaches them too.
   */
  static inboxFilter(request: FastifyRequest) {
    const { id, role } = request.user!;
    return role === 'ADMIN'
      ? { OR: [{ userId: id }, { role: { not: null } }] }
      : { OR: [{ userId: id }, { role }] };
  }

  static async listNotifications(request: FastifyRequest, reply: FastifyReply) {
    const { unreadOnly, limit = '30' } = request.query as { unreadOnly?: string; limit?: string };
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));

    const inbox = MessagingController.inboxFilter(request);

    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { ...inbox, ...(unreadOnly === 'true' ? { readAt: null } : {}) },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      prisma.notification.count({ where: { ...inbox, readAt: null } }),
    ]);

    return reply.send({ notifications, unread });
  }

  static async markNotificationRead(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing) throw new AppError('التنبيه غير موجود', 404);

    await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    return reply.send({ message: 'تم وضع علامة مقروء' });
  }

  static async markAllRead(request: FastifyRequest, reply: FastifyReply) {
    const result = await prisma.notification.updateMany({
      where: { ...MessagingController.inboxFilter(request), readAt: null },
      data: { readAt: new Date() },
    });

    return reply.send({ message: 'تم وضع علامة مقروء على الكل', count: result.count });
  }
}
