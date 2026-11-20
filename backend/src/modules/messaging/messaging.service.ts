import { MessageChannel, NotificationType, Role } from '@prisma/client';
import { prisma } from '../../config/db';
import * as whatsapp from '../whatsapp/whatsapp.service';

/**
 * M6 — messaging and alerts.
 *
 * Two channels are in scope: WhatsApp and in-system notifications. SMS is not.
 * Automatic delivery over the official WhatsApp API arrives with M8; until
 * then a WhatsApp message is queued, rendered and handed to the employee as a
 * wa.me link, and every message is logged either way.
 */

/** Replaces {{name}} placeholders with the values given; unknown ones are left blank. */
export function renderTemplate(body: string, values: Record<string, string | number | null | undefined>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

/** Normalises a Saudi mobile number into the international form wa.me expects. */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) digits = digits.slice(2);
  // A local 05xxxxxxxx number becomes 9665xxxxxxxx.
  if (digits.startsWith('0')) digits = '966' + digits.slice(1);
  // A bare 5xxxxxxxx is the same number without its leading zero.
  else if (digits.length === 9 && digits.startsWith('5')) digits = '966' + digits;

  return digits;
}

/** The link the employee opens to dispatch a queued WhatsApp message. */
export function whatsappLink(number: string | null, body: string): string | null {
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(body)}`;
}

export interface QueueOptions {
  templateCode?: string;
  channel?: MessageChannel;
  customerId?: string | null;
  jobCardId?: string | null;
  lang?: string;
  values?: Record<string, string | number | null | undefined>;
  /** Used when no template applies — the body is passed in directly. */
  body?: string;
  scheduledAt?: Date;
  createdById?: string | null;
}

export interface QueueResult {
  queued: boolean;
  messageId?: string;
  reason?: 'OPTED_OUT' | 'NO_TEMPLATE' | 'NO_RECIPIENT' | 'TEMPLATE_INACTIVE';
}

/**
 * Puts one message on the queue. Returns why it was skipped rather than
 * throwing, so a side effect like "card completed" never fails the main action
 * just because the customer opted out.
 */
export async function queueMessage(options: QueueOptions): Promise<QueueResult> {
  const lang = options.lang === 'en' ? 'en' : 'ar';

  let template = null;
  if (options.templateCode) {
    template = await prisma.messageTemplate.findFirst({
      where: { code: options.templateCode, deletedAt: null },
    });
    if (!template) return { queued: false, reason: 'NO_TEMPLATE' };
    if (!template.isActive) return { queued: false, reason: 'TEMPLATE_INACTIVE' };
  }

  const channel = options.channel || template?.channel || 'WHATSAPP';

  let customer = null;
  if (options.customerId) {
    customer = await prisma.customer.findFirst({
      where: { id: options.customerId, deletedAt: null },
    });
    // Opting out silences outward channels only; internal alerts still run.
    if (customer?.messagingOptOut && channel !== 'INTERNAL') {
      return { queued: false, reason: 'OPTED_OUT' };
    }
  }

  const rawBody = template ? (lang === 'ar' ? template.bodyAr : template.bodyEn) : options.body;
  if (!rawBody) return { queued: false, reason: 'NO_TEMPLATE' };

  const body = renderTemplate(rawBody, options.values || {});
  const recipientNumber = toWhatsAppNumber(customer?.mobileNumber);

  if (channel === 'WHATSAPP' && !recipientNumber) {
    return { queued: false, reason: 'NO_RECIPIENT' };
  }

  // M8 — the same values, in the order the template declares them, so an
  // approved Meta template can be sent for this message later.
  let templateValues: string | null = null;
  if (template?.variables && options.values) {
    try {
      const names: string[] = JSON.parse(template.variables);
      templateValues = JSON.stringify(
        names.map(name => {
          const value = options.values?.[name];
          return value === undefined || value === null ? '' : String(value);
        }),
      );
    } catch {
      templateValues = null;
    }
  }

  const message = await prisma.outboundMessage.create({
    data: {
      templateId: template?.id || null,
      channel,
      customerId: options.customerId || null,
      jobCardId: options.jobCardId || null,
      recipientName: customer?.fullName || null,
      recipientNumber,
      lang,
      body,
      templateValues,
      scheduledAt: options.scheduledAt || new Date(),
      createdById: options.createdById || null,
    },
  });

  return { queued: true, messageId: message.id };
}

export interface NotifyOptions {
  userId?: string | null;
  role?: Role | null;
  type?: NotificationType;
  titleAr: string;
  titleEn: string;
  bodyAr?: string | null;
  bodyEn?: string | null;
  linkType?: string | null;
  linkId?: string | null;
  /** Stops the same alert being raised twice for the same thing. */
  dedupeKey?: string | null;
}

/** Raises an in-system notification for one user or for a whole role. */
export async function notify(options: NotifyOptions) {
  if (options.dedupeKey) {
    const existing = await prisma.notification.findUnique({
      where: { dedupeKey: options.dedupeKey },
    });
    if (existing) return existing;
  }

  return prisma.notification.create({
    data: {
      userId: options.userId || null,
      role: options.role || null,
      type: options.type || 'SYSTEM',
      titleAr: options.titleAr,
      titleEn: options.titleEn,
      bodyAr: options.bodyAr || null,
      bodyEn: options.bodyEn || null,
      linkType: options.linkType || null,
      linkId: options.linkId || null,
      dedupeKey: options.dedupeKey || null,
    },
  });
}

/**
 * Works the queue once.
 *
 * INTERNAL messages are delivered here and marked sent. WHATSAPP messages wait
 * for an employee to dispatch them, so they are only counted as due; M8
 * replaces this branch with a real API call.
 */
export async function processQueue(): Promise<{ delivered: number; pendingWhatsApp: number; sentViaApi: number }> {
  const now = new Date();

  const due = await prisma.outboundMessage.findMany({
    where: { status: 'PENDING', scheduledAt: { lte: now } },
    take: 100,
    orderBy: { scheduledAt: 'asc' },
  });

  let delivered = 0;
  let pendingWhatsApp = 0;
  let sentViaApi = 0;

  // M8 — when the official connection is live the queue delivers by itself;
  // otherwise WhatsApp messages wait for an employee to dispatch them.
  const whatsappLive = await whatsapp.isEnabled();

  for (const message of due) {
    if (message.channel === 'WHATSAPP') {
      if (!whatsappLive) {
        pendingWhatsApp++;
        continue;
      }

      const result = await deliverViaWhatsApp(message);
      if (result) sentViaApi++;
      continue;
    }

    if (message.channel !== 'INTERNAL') {
      pendingWhatsApp++;
      continue;
    }

    try {
      await prisma.$transaction([
        prisma.notification.create({
          data: {
            role: 'RECEPTION',
            type: 'SYSTEM',
            titleAr: 'رسالة داخلية',
            titleEn: 'Internal message',
            bodyAr: message.body,
            bodyEn: message.body,
            linkType: message.jobCardId ? 'JOB_CARD' : null,
            linkId: message.jobCardId,
          },
        }),
        prisma.outboundMessage.update({
          where: { id: message.id },
          data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
        }),
      ]);
      delivered++;
    } catch (error: any) {
      await prisma.outboundMessage.update({
        where: { id: message.id },
        data: {
          attempts: { increment: 1 },
          lastError: String(error?.message || error).slice(0, 250),
          // Three tries, then it stops and waits for someone to look at it.
          status: message.attempts + 1 >= 3 ? 'FAILED' : 'PENDING',
          scheduledAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
    }
  }

  return { delivered, pendingWhatsApp, sentViaApi };
}

/**
 * M8 — hands one queued message to the official WhatsApp API.
 *
 * Outside the 24-hour service window Meta only accepts an approved template,
 * so a message whose template was never approved is failed with a clear
 * reason rather than retried forever.
 */
async function deliverViaWhatsApp(message: {
  id: string;
  recipientNumber: string | null;
  body: string;
  lang: string;
  attempts: number;
  customerId: string | null;
  templateId: string | null;
  templateValues: string | null;
}): Promise<boolean> {
  if (!message.recipientNumber) {
    await prisma.outboundMessage.update({
      where: { id: message.id },
      data: { status: 'FAILED', lastError: 'لا يوجد رقم جوال صالح', failedAt: new Date() },
    });
    return false;
  }

  const insideWindow = await whatsapp.isWithinServiceWindow(message.customerId);

  let result: whatsapp.SendResult;

  if (insideWindow) {
    result = await whatsapp.sendText(message.recipientNumber, message.body);
  } else {
    const template = message.templateId
      ? await prisma.messageTemplate.findUnique({ where: { id: message.templateId } })
      : null;

    if (!template?.metaTemplateName || template.metaStatus !== 'APPROVED') {
      await prisma.outboundMessage.update({
        where: { id: message.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          attempts: { increment: 1 },
          lastError:
            'خارج نافذة الـ 24 ساعة ولا يوجد قالب معتمد من Meta لهذه الرسالة — اربط القالب واعتمده',
        },
      });
      return false;
    }

    let values: string[] = [];
    try {
      values = message.templateValues ? JSON.parse(message.templateValues) : [];
    } catch {
      values = [];
    }

    result = await whatsapp.sendTemplate(
      message.recipientNumber,
      template.metaTemplateName,
      template.metaLanguage || message.lang,
      values,
    );
  }

  if (result.ok) {
    await prisma.outboundMessage.update({
      where: { id: message.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        attempts: { increment: 1 },
        lastError: null,
        providerMessageId: result.providerMessageId || null,
      },
    });
    return true;
  }

  const attempts = message.attempts + 1;
  // Three tries for anything transient; a rejected request is not retried.
  const giveUp = !result.retryable || attempts >= 3;

  await prisma.outboundMessage.update({
    where: { id: message.id },
    data: {
      attempts,
      lastError: (result.error || 'فشل الإرسال').slice(0, 250),
      status: giveUp ? 'FAILED' : 'PENDING',
      failedAt: giveUp ? new Date() : null,
      scheduledAt: giveUp ? undefined : new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return false;
}

const DAY_KEY = () => new Date().toISOString().slice(0, 10);

/**
 * Raises the recurring alerts: subscriptions about to lapse and vehicle
 * documents about to expire. Deduped per item per day.
 */
export async function raiseScheduledAlerts(): Promise<{ subscriptions: number; documents: number }> {
  const today = DAY_KEY();
  const now = new Date();
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  const expiringSubscriptions = await prisma.subscription.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      startDate: { lte: now },
      endDate: { gte: now, lte: in30Days },
    },
    include: { customer: { select: { fullName: true } } },
    take: 100,
  });

  for (const sub of expiringSubscriptions) {
    const days = Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    await notify({
      role: 'RECEPTION',
      type: 'SUBSCRIPTION',
      titleAr: `اشتراك ${sub.customer.fullName} ينتهي خلال ${days} يومًا`,
      titleEn: `${sub.customer.fullName}'s subscription expires in ${days} days`,
      bodyAr: `رقم الاشتراك ${sub.subscriptionNumber} — ينتهي في ${sub.endDate.toISOString().slice(0, 10)}`,
      bodyEn: `Subscription ${sub.subscriptionNumber} ends on ${sub.endDate.toISOString().slice(0, 10)}`,
      linkType: 'SUBSCRIPTION',
      linkId: sub.id,
      dedupeKey: `sub-expiry:${sub.id}:${today}`,
    });
  }

  const expiringDocuments = await prisma.vehicleDocument.findMany({
    where: {
      deletedAt: null,
      expiryDate: { not: null, gte: now, lte: in30Days },
      vehicle: { deletedAt: null },
    },
    include: { vehicle: { select: { id: true, plateNumber: true } } },
    take: 100,
  });

  for (const doc of expiringDocuments) {
    const days = Math.ceil(
      (new Date(doc.expiryDate!).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );
    await notify({
      role: 'RECEPTION',
      type: 'DOCUMENT',
      titleAr: `مستند السيارة ${doc.vehicle.plateNumber} ينتهي خلال ${days} يومًا`,
      titleEn: `Document for ${doc.vehicle.plateNumber} expires in ${days} days`,
      bodyAr: doc.title || doc.type,
      bodyEn: doc.title || doc.type,
      linkType: 'VEHICLE',
      linkId: doc.vehicle.id,
      dedupeKey: `doc-expiry:${doc.id}:${today}`,
    });
  }

  return { subscriptions: expiringSubscriptions.length, documents: expiringDocuments.length };
}
