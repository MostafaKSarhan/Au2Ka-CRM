import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';

/**
 * M8 — the official WhatsApp Business Cloud API.
 *
 * This is the transport the M6 queue was built to accept. Until the workshop
 * finishes its Meta onboarding the connection stays disabled and the queue
 * keeps handing each message to an employee as a wa.me link, exactly as before.
 *
 * Template approval is done by Meta and can take up to two weeks; that wait is
 * outside the implementer's control and does not count toward delivery time.
 */

const SETTINGS_ID = 'default';
const GRAPH_HOST = 'https://graph.facebook.com';

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  businessAccountId: string | null;
}

export async function getSettings() {
  const existing = await prisma.whatsAppSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;

  return prisma.whatsAppSettings.create({ data: { id: SETTINGS_ID } });
}

/**
 * The live credentials, or null when the connection is not ready.
 *
 * The access token is a long-lived secret: an environment variable always wins
 * over the stored column, so a deployment can keep it out of the database.
 */
export async function getConfig(): Promise<WhatsAppConfig | null> {
  const settings = await getSettings();
  if (!settings.isEnabled) return null;

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || settings.accessToken;
  if (!accessToken || !settings.phoneNumberId) return null;

  return {
    phoneNumberId: settings.phoneNumberId,
    accessToken,
    apiVersion: settings.apiVersion || 'v21.0',
    businessAccountId: settings.businessAccountId,
  };
}

export async function isEnabled(): Promise<boolean> {
  return (await getConfig()) !== null;
}

interface GraphError {
  message: string;
  code?: number;
  type?: string;
}

function describeError(payload: any, status: number): string {
  const error: GraphError | undefined = payload?.error;
  if (!error) return `HTTP ${status}`;

  const parts = [error.message];
  if (error.code) parts.push(`code ${error.code}`);
  return parts.join(' — ').slice(0, 400);
}

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
  /** True when retrying could work (network, rate limit, transient Meta error). */
  retryable?: boolean;
}

async function callGraph(
  config: WhatsAppConfig,
  body: Record<string, unknown>,
): Promise<SendResult> {
  const url = `${GRAPH_HOST}/${config.apiVersion}/${config.phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
      // A hung call must not stall the whole queue tick.
      signal: AbortSignal.timeout(20_000),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        error: describeError(payload, response.status),
        // 4xx other than 429 means the request itself is wrong; retrying it
        // would just fail again and burn the attempt counter.
        retryable: response.status === 429 || response.status >= 500,
      };
    }

    return { ok: true, providerMessageId: payload?.messages?.[0]?.id };
  } catch (error: any) {
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return {
      ok: false,
      error: isTimeout ? 'انتهت مهلة الاتصال بـ Meta' : String(error?.message || error).slice(0, 300),
      retryable: true,
    };
  }
}

/** Free text — only valid inside WhatsApp's 24-hour service window. */
export async function sendText(to: string, body: string): Promise<SendResult> {
  const config = await getConfig();
  if (!config) return { ok: false, error: 'الربط بواتساب الرسمي غير مفعّل', retryable: false };

  return callGraph(config, {
    to,
    type: 'text',
    text: { preview_url: false, body },
  });
}

/**
 * An approved template — the only way to reach someone outside the window.
 * Values fill {{1}}, {{2}} … in the order Meta registered them.
 */
export async function sendTemplate(
  to: string,
  templateName: string,
  language: string,
  values: string[],
): Promise<SendResult> {
  const config = await getConfig();
  if (!config) return { ok: false, error: 'الربط بواتساب الرسمي غير مفعّل', retryable: false };

  const components = values.length
    ? [
        {
          type: 'body',
          parameters: values.map(v => ({ type: 'text', text: v })),
        },
      ]
    : undefined;

  return callGraph(config, {
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language || 'ar' },
      ...(components ? { components } : {}),
    },
  });
}

/**
 * Whether this customer wrote to us in the last 24 hours. Inside that window
 * free text is allowed; outside it only an approved template will go through.
 */
export async function isWithinServiceWindow(customerId: string | null): Promise<boolean> {
  if (!customerId) return false;

  // The workshop has no inbound message store yet, so the window is treated
  // as closed and templates are always used. Inbound capture arrives with the
  // webhook below; until a customer writes in, this stays false.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const inbound = await prisma.outboundMessage.findFirst({
    where: { customerId, readAt: { gte: dayAgo } },
    select: { id: true },
  });

  return !!inbound;
}

/** Confirms the credentials work by asking Meta about the phone number. */
export async function verifyConnection(): Promise<{ ok: boolean; detail: string }> {
  const settings = await getSettings();
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || settings.accessToken;

  if (!settings.phoneNumberId || !accessToken) {
    return { ok: false, detail: 'رقم الجوال أو رمز الوصول غير مضبوط' };
  }

  const url = `${GRAPH_HOST}/${settings.apiVersion || 'v21.0'}/${settings.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = describeError(payload, response.status);
      await prisma.whatsAppSettings.update({
        where: { id: SETTINGS_ID },
        data: { lastError: detail },
      });
      return { ok: false, detail };
    }

    await prisma.whatsAppSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        lastVerifiedAt: new Date(),
        lastError: null,
        displayNumber: payload?.display_phone_number || settings.displayNumber,
      },
    });

    return {
      ok: true,
      detail: `${payload?.verified_name || ''} ${payload?.display_phone_number || ''}`.trim(),
    };
  } catch (error: any) {
    const detail = String(error?.message || error).slice(0, 300);
    await prisma.whatsAppSettings.update({
      where: { id: SETTINGS_ID },
      data: { lastError: detail },
    });
    return { ok: false, detail };
  }
}

/**
 * Applies a delivery receipt from Meta's webhook to the message it belongs to.
 * Receipts can arrive out of order, so an earlier state never overwrites a
 * later one.
 */
export async function applyStatusUpdate(
  providerMessageId: string,
  status: string,
  timestampSeconds?: string,
  errorText?: string,
) {
  const message = await prisma.outboundMessage.findFirst({
    where: { providerMessageId },
  });
  if (!message) return null;

  const at = timestampSeconds ? new Date(Number(timestampSeconds) * 1000) : new Date();
  const data: Record<string, unknown> = {};

  switch (status) {
    case 'sent':
      if (!message.sentAt) data.sentAt = at;
      break;
    case 'delivered':
      if (!message.deliveredAt) data.deliveredAt = at;
      break;
    case 'read':
      if (!message.readAt) data.readAt = at;
      // A read receipt implies delivery, even if we never saw that event.
      if (!message.deliveredAt) data.deliveredAt = at;
      break;
    case 'failed':
      data.status = 'FAILED';
      data.failedAt = at;
      data.lastError = (errorText || 'فشل الإرسال من Meta').slice(0, 250);
      break;
    default:
      return null;
  }

  if (Object.keys(data).length === 0) return message;

  return prisma.outboundMessage.update({ where: { id: message.id }, data });
}

/** Marks a customer as having written in, which opens the 24-hour window. */
export async function recordInbound(fromNumber: string) {
  const digits = fromNumber.replace(/\D/g, '');
  const localForm = digits.startsWith('966') ? `0${digits.slice(3)}` : digits;

  const customer = await prisma.customer.findFirst({
    where: {
      deletedAt: null,
      mobileNumber: { in: [...new Set([fromNumber, digits, localForm])] },
    },
    select: { id: true },
  });
  if (!customer) return null;

  // Recorded as an inbound log line so the service window has evidence.
  return prisma.outboundMessage.create({
    data: {
      channel: 'INTERNAL',
      customerId: customer.id,
      body: 'رسالة واردة من العميل عبر واتساب',
      status: 'SENT',
      sentAt: new Date(),
      readAt: new Date(),
      recipientNumber: digits,
    },
  });
}

export function assertConfigured(settings: { phoneNumberId: string | null }) {
  if (!settings.phoneNumberId) {
    throw new AppError('اضبط معرّف رقم الجوال أولًا', 400);
  }
}
