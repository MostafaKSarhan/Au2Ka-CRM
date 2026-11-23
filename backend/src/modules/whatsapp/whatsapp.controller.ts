import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';
import {
  applyStatusUpdate,
  getSettings,
  recordInbound,
  verifyConnection,
} from './whatsapp.service';

// strict: حقل باسم خاطئ يُرفض بدل أن يُسقَط بصمت. هذه الشاشة تُملأ يدويًا
// مرة واحدة عند الربط، وكان إرسال verifyToken بدل webhookVerifyToken يرد
// «تم حفظ الإعدادات» دون أن يحفظ شيئًا، فيبحث من يربط عن عطل غير موجود.
const settingsSchema = z
  .object({
    phoneNumberId: z.string().trim().optional().nullable(),
    businessAccountId: z.string().trim().optional().nullable(),
    accessToken: z.string().trim().optional().nullable(),
    apiVersion: z.string().trim().regex(/^v\d+\.\d+$/, 'صيغة الإصدار مثل v21.0').optional(),
    webhookVerifyToken: z.string().trim().optional().nullable(),
    isEnabled: z.boolean().optional(),
  })
  .strict();

const metaLinkSchema = z.object({
  metaTemplateName: z.string().trim().max(120).optional().nullable(),
  metaLanguage: z.string().trim().max(10).optional().nullable(),
  metaStatus: z.enum(['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED']).optional(),
  metaStatusNote: z.string().trim().optional().nullable(),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors.map(e => e.message).join(', '), 400);
  }
  return result.data;
}

/** The settings as the UI may see them — never the token itself. */
function publicSettings(settings: any) {
  const fromEnv = !!process.env.WHATSAPP_ACCESS_TOKEN;

  return {
    phoneNumberId: settings.phoneNumberId,
    businessAccountId: settings.businessAccountId,
    apiVersion: settings.apiVersion,
    displayNumber: settings.displayNumber,
    isEnabled: settings.isEnabled,
    lastVerifiedAt: settings.lastVerifiedAt,
    lastError: settings.lastError,
    // The secret itself never leaves the server.
    hasAccessToken: fromEnv || !!settings.accessToken,
    accessTokenFromEnv: fromEnv,
    hasWebhookVerifyToken: !!settings.webhookVerifyToken,
  };
}

export class WhatsAppController {
  static async getSettings(request: FastifyRequest, reply: FastifyReply) {
    const settings = await getSettings();
    return reply.send({ settings: publicSettings(settings) });
  }

  static async updateSettings(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(settingsSchema, request.body);
    const current = await getSettings();

    // Turning the connection on without credentials would silently fail every
    // message, so it is refused here instead.
    if (data.isEnabled) {
      const phoneNumberId = data.phoneNumberId ?? current.phoneNumberId;
      const token = process.env.WHATSAPP_ACCESS_TOKEN || data.accessToken || current.accessToken;

      if (!phoneNumberId) throw new AppError('معرّف رقم الجوال مطلوب قبل التفعيل', 400);
      if (!token) throw new AppError('رمز الوصول مطلوب قبل التفعيل', 400);
    }

    // An empty string means "leave the stored token alone", not "clear it".
    const payload: any = { ...data };
    if (payload.accessToken === '' || payload.accessToken === null) delete payload.accessToken;

    const settings = await prisma.whatsAppSettings.update({
      where: { id: current.id },
      data: payload,
    });

    return reply.send({ message: 'تم حفظ إعدادات واتساب', settings: publicSettings(settings) });
  }

  static async verify(request: FastifyRequest, reply: FastifyReply) {
    const result = await verifyConnection();
    if (!result.ok) throw new AppError(`تعذّر التحقق: ${result.detail}`, 400);

    return reply.send({ message: `تم التحقق من الاتصال — ${result.detail}` });
  }

  /** Links one of our templates to its approved counterpart at Meta. */
  static async linkTemplate(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = parse(metaLinkSchema, request.body);

    const existing = await prisma.messageTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('القالب غير موجود', 404);

    const template = await prisma.messageTemplate.update({ where: { id }, data });
    return reply.send({ message: 'تم حفظ ربط القالب بـ Meta', template });
  }

  // ---------- Webhook ----------
  /**
   * Meta's verification handshake. It calls this once with a challenge and
   * expects the raw value echoed back when the token matches.
   */
  static async verifyWebhook(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as Record<string, string | undefined>;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const settings = await getSettings();
    const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || settings.webhookVerifyToken;

    if (mode === 'subscribe' && expected && token === expected) {
      return reply.type('text/plain').send(challenge || '');
    }

    // Anything else is not Meta, or not our endpoint.
    return reply.status(403).send({ status: 'error', message: 'forbidden' });
  }

  /**
   * Delivery and read receipts, plus inbound messages.
   *
   * Meta retries anything that is not answered quickly with 200, so this
   * always acknowledges and never lets one bad entry fail the batch.
   */
  static async receiveWebhook(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;

    try {
      for (const entry of body?.entry || []) {
        for (const change of entry?.changes || []) {
          const value = change?.value;
          if (!value) continue;

          for (const status of value.statuses || []) {
            await applyStatusUpdate(
              status.id,
              status.status,
              status.timestamp,
              status.errors?.[0]?.title || status.errors?.[0]?.message,
            ).catch(err => request.log.error({ err }, 'failed to apply whatsapp status'));
          }

          for (const message of value.messages || []) {
            await recordInbound(message.from).catch(err =>
              request.log.error({ err }, 'failed to record inbound whatsapp message'),
            );
          }
        }
      }
    } catch (err) {
      request.log.error({ err }, 'whatsapp webhook processing failed');
    }

    // Always 200: a non-200 makes Meta resend the same batch.
    return reply.send({ received: true });
  }
}
