import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { toWhatsAppNumber } from '../messaging/messaging.service';

/**
 * M7 — the customer portal's own sign-in.
 *
 * Customers get in with a one-time code sent to their mobile, never a
 * password. These sessions are entirely separate from staff JWTs so a portal
 * token can never reach a staff endpoint.
 */

declare module 'fastify' {
  interface FastifyRequest {
    portalCustomerId?: string;
  }
}

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_TTL_DAYS = 30;
/** How many codes one number may ask for in an hour. */
const OTP_RATE_LIMIT = 5;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Compares two hex digests without leaking where they differ. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Matches the number as typed against how customers are stored. */
export async function findCustomerByMobile(raw: string) {
  const normalised = toWhatsAppNumber(raw);
  const digits = raw.replace(/\D/g, '');

  // Customers are stored however reception typed them, so try the shapes
  // that mean the same number.
  const candidates = [raw.trim(), digits, normalised, normalised ? `0${normalised.slice(3)}` : null]
    .filter((v): v is string => !!v);

  return prisma.customer.findFirst({
    where: { deletedAt: null, mobileNumber: { in: [...new Set(candidates)] } },
  });
}

export interface IssuedOtp {
  customerId: string;
  code: string;
  expiresAt: Date;
}

/** Creates a fresh code for a customer, rate-limited per number. */
export async function issueOtp(mobileNumber: string): Promise<IssuedOtp> {
  const customer = await findCustomerByMobile(mobileNumber);
  if (!customer) {
    // Deliberately vague: the portal must not confirm who is a customer.
    throw new AppError('تعذّر إرسال رمز التحقق لهذا الرقم — تواصل مع الورشة', 404);
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.customerOtp.count({
    where: { customerId: customer.id, createdAt: { gte: hourAgo } },
  });
  if (recent >= OTP_RATE_LIMIT) {
    throw new AppError('تم طلب رموز كثيرة — حاول بعد ساعة', 429);
  }

  // Any code still outstanding is retired, so only the newest one works.
  await prisma.customerOtp.updateMany({
    where: { customerId: customer.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.customerOtp.create({
    data: {
      customerId: customer.id,
      mobileNumber: customer.mobileNumber,
      codeHash: sha256(code),
      expiresAt,
    },
  });

  return { customerId: customer.id, code, expiresAt };
}

/** Checks a code and, on success, opens a portal session. */
export async function verifyOtp(mobileNumber: string, code: string, userAgent?: string) {
  const customer = await findCustomerByMobile(mobileNumber);
  if (!customer) throw new AppError('رمز التحقق غير صحيح', 401);

  const otp = await prisma.customerOtp.findFirst({
    where: { customerId: customer.id, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) throw new AppError('اطلب رمز تحقق جديد', 401);

  if (otp.expiresAt < new Date()) {
    await prisma.customerOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    throw new AppError('انتهت صلاحية الرمز — اطلب رمزًا جديدًا', 401);
  }

  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.customerOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    throw new AppError('تم تجاوز عدد المحاولات — اطلب رمزًا جديدًا', 429);
  }

  if (!safeEqual(sha256(code.trim()), otp.codeHash)) {
    await prisma.customerOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError('رمز التحقق غير صحيح', 401);
  }

  await prisma.customerOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

  // The raw token goes to the browser; only its hash is stored here.
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.customerSession.create({
    data: {
      customerId: customer.id,
      tokenHash: sha256(token),
      expiresAt,
      userAgent: userAgent?.slice(0, 250) || null,
    },
  });

  return { token, expiresAt, customer };
}

/** Guards every portal route that needs a signed-in customer. */
export async function authenticatePortal(request: FastifyRequest, _reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('يلزم تسجيل الدخول', 401);
  }

  const token = header.slice(7).trim();
  const session = await prisma.customerSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { customer: { select: { id: true, deletedAt: true } } },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new AppError('انتهت الجلسة — سجّل الدخول من جديد', 401);
  }
  if (!session.customer || session.customer.deletedAt) {
    throw new AppError('الحساب غير متاح', 401);
  }

  // Touched at most once a minute so a busy session does not write on every call.
  if (Date.now() - session.lastSeenAt.getTime() > 60_000) {
    await prisma.customerSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
  }

  request.portalCustomerId = session.customerId;
}

export async function revokeSession(token: string) {
  await prisma.customerSession.updateMany({
    where: { tokenHash: sha256(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
