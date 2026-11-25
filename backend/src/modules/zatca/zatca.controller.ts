import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';
import { parseQrTlv } from './zatca.crypto';
import {
  getSettings,
  isValidVatNumber,
  issueInvoice,
  linesFromJobCard,
  missingSellerFields,
  prepareOnboarding,
  submitToZatca,
} from './zatca.service';

const settingsSchema = z.object({
  sellerNameAr: z.string().trim().optional().nullable(),
  sellerNameEn: z.string().trim().optional().nullable(),
  vatNumber: z.string().trim().optional().nullable(),
  crnNumber: z.string().trim().optional().nullable(),
  street: z.string().trim().optional().nullable(),
  buildingNumber: z.string().trim().optional().nullable(),
  district: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  postalCode: z.string().trim().optional().nullable(),
  countryCode: z.string().trim().length(2).optional(),
  environment: z.enum(['SANDBOX', 'SIMULATION', 'PRODUCTION']).optional(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  complianceCsid: z.string().trim().optional().nullable(),
  complianceSecret: z.string().trim().optional().nullable(),
  productionCsid: z.string().trim().optional().nullable(),
  productionSecret: z.string().trim().optional().nullable(),
  isEnabled: z.boolean().optional(),
});

const issueSchema = z.object({
  jobCardId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  type: z.enum(['SIMPLIFIED', 'STANDARD']).default('SIMPLIFIED'),
  buyerName: z.string().trim().optional().nullable(),
  buyerVatNumber: z.string().trim().optional().nullable(),
  lines: z
    .array(
      z.object({
        nameAr: z.string().trim().min(1, 'اسم البند مطلوب'),
        quantity: z.coerce.number().min(0.001).default(1),
        unitPrice: z.coerce.number().min(0),
        net: z.coerce.number().min(0),
      }),
    )
    .optional(),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors.map(e => e.message).join(', '), 400);
  }
  return result.data;
}

/** The settings as the UI may see them — never the key or the secrets. */
function publicSettings(settings: any) {
  return {
    sellerNameAr: settings.sellerNameAr,
    sellerNameEn: settings.sellerNameEn,
    vatNumber: settings.vatNumber,
    crnNumber: settings.crnNumber,
    street: settings.street,
    buildingNumber: settings.buildingNumber,
    district: settings.district,
    city: settings.city,
    postalCode: settings.postalCode,
    countryCode: settings.countryCode,
    environment: settings.environment,
    vatRate: settings.vatRate,
    isEnabled: settings.isEnabled,
    onboardedAt: settings.onboardedAt,
    lastError: settings.lastError,
    // Only whether each secret exists, never its value.
    hasPrivateKey: !!settings.privateKeyPem,
    hasComplianceCsid: !!settings.complianceCsid,
    hasProductionCsid: !!settings.productionCsid,
    csrSubject: settings.csr,
    missingFields: missingSellerFields(settings),
  };
}

export class ZatcaController {
  // ---------- Settings & onboarding ----------
  static async getSettings(request: FastifyRequest, reply: FastifyReply) {
    const settings = await getSettings();
    return reply.send({ settings: publicSettings(settings) });
  }

  static async updateSettings(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(settingsSchema, request.body);
    const current = await getSettings();

    if (data.vatNumber && !isValidVatNumber(data.vatNumber)) {
      throw new AppError('الرقم الضريبي يجب أن يكون 15 رقمًا يبدأ وينتهي بالرقم 3', 400);
    }

    if (data.isEnabled) {
      const merged = { ...current, ...data };
      const missing = missingSellerFields(merged);
      if (missing.length) {
        throw new AppError(`أكمل بيانات المنشأة أولًا: ${missing.join('، ')}`, 400);
      }
    }

    // An empty secret means "keep what is stored", not "erase it".
    const payload: any = { ...data };
    for (const key of ['complianceCsid', 'complianceSecret', 'productionCsid', 'productionSecret']) {
      if (payload[key] === '' || payload[key] === null) delete payload[key];
    }
    if (payload.productionCsid && payload.productionSecret) {
      payload.onboardedAt = new Date();
    }

    const settings = await prisma.zatcaSettings.update({ where: { id: current.id }, data: payload });
    return reply.send({ message: 'تم حفظ إعدادات الفوترة', settings: publicSettings(settings) });
  }

  static async onboard(request: FastifyRequest, reply: FastifyReply) {
    const result = await prepareOnboarding();
    return reply.send({
      message: 'تم توليد مفتاح الختم وبيانات طلب الشهادة',
      ...result,
    });
  }

  // ---------- Invoices ----------
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { status, type, search, page = '1', limit = '20' } = request.query as Record<
      string,
      string | undefined
    >;

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    const skip = (pageNum - 1) * take;

    const where: any = { deletedAt: null };
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { buyerName: { contains: search } },
        { customer: { fullName: { contains: search } } },
      ];
    }

    const [invoices, total, totals] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          sequence: true,
          type: true,
          status: true,
          issuedAt: true,
          buyerName: true,
          netAmount: true,
          vatAmount: true,
          totalAmount: true,
          reportedAt: true,
          customer: { select: { id: true, fullName: true } },
          jobCard: { select: { id: true, jobNumber: true } },
        },
        orderBy: { sequence: 'desc' },
        skip,
        take,
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({
        where: { deletedAt: null },
        _sum: { netAmount: true, vatAmount: true, totalAmount: true },
        _count: { _all: true },
      }),
    ]);

    return reply.send({
      invoices,
      summary: {
        count: totals._count._all,
        net: totals._sum.netAmount || 0,
        vat: totals._sum.vatAmount || 0,
        total: totals._sum.totalAmount || 0,
      },
      pagination: { page: pageNum, limit: take, total, pages: Math.ceil(total / take) },
    });
  }

  static async getOne(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const invoice = await prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: { select: { id: true, fullName: true, mobileNumber: true } },
        jobCard: { select: { id: true, jobNumber: true } },
      },
    });
    if (!invoice) throw new AppError('الفاتورة غير موجودة', 404);

    let lines: any[] = [];
    try {
      lines = invoice.lines ? JSON.parse(invoice.lines) : [];
    } catch {
      lines = [];
    }

    return reply.send({
      invoice: {
        ...invoice,
        lines,
        // Decoded so the screen can show what the QR actually carries.
        qrFields: invoice.qrCode ? parseQrTlv(invoice.qrCode) : null,
      },
    });
  }

  static async issue(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(issueSchema, request.body);

    let lines = data.lines || [];
    let customerId = data.customerId || null;
    let buyerName = data.buyerName || null;

    // Issuing from a job card is the normal path; lines are read from it.
    if (data.jobCardId) {
      const existing = await prisma.invoice.findFirst({
        where: { jobCardId: data.jobCardId, deletedAt: null },
      });
      if (existing) {
        throw new AppError(`لهذا الكرت فاتورة بالفعل برقم ${existing.invoiceNumber}`, 409);
      }

      const jobCard = await prisma.jobCard.findFirst({
        where: { id: data.jobCardId, deletedAt: null },
        include: { customer: { select: { id: true, fullName: true } } },
      });
      if (!jobCard) throw new AppError('كرت العمل غير موجود', 404);

      if (lines.length === 0) lines = await linesFromJobCard(data.jobCardId);
      customerId = customerId || jobCard.customerId;
      buyerName = buyerName || jobCard.customer?.fullName || null;
    }

    const invoice = await issueInvoice({
      jobCardId: data.jobCardId || null,
      customerId,
      type: data.type,
      buyerName,
      buyerVatNumber: data.buyerVatNumber || null,
      lines,
      createdById: request.user?.id || null,
    });

    return reply.status(201).send({
      message: `تم إصدار الفاتورة ${invoice.invoiceNumber}`,
      invoice: { ...invoice, qrFields: invoice.qrCode ? parseQrTlv(invoice.qrCode) : null },
    });
  }

  static async submit(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const invoice = await submitToZatca(id);

    return reply.send({
      message:
        invoice.status === 'CLEARED'
          ? 'تم اعتماد الفاتورة من ZATCA'
          : 'تم إبلاغ ZATCA بالفاتورة',
      invoice,
    });
  }

  /** The XML as issued, for the workshop's own archive. */
  static async downloadXml(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const invoice = await prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      select: { invoiceNumber: true, signedXml: true },
    });
    if (!invoice?.signedXml) throw new AppError('الفاتورة غير موجودة أو بلا ملف XML', 404);

    return reply
      .header('Content-Type', 'application/xml; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.xml"`)
      .send(invoice.signedXml);
  }

  /**
   * Proves the chain is unbroken: every invoice must carry the hash of the
   * one before it, and the sequence must have no gaps.
   */
  static async verifyChain(request: FastifyRequest, reply: FastifyReply) {
    const invoices = await prisma.invoice.findMany({
      where: { deletedAt: null },
      select: { invoiceNumber: true, sequence: true, previousHash: true, invoiceHash: true },
      orderBy: { sequence: 'asc' },
    });

    const problems: string[] = [];
    let expectedPrevious: string | null = null;

    invoices.forEach((invoice, index) => {
      if (invoice.sequence !== index + 1) {
        problems.push(`انقطاع في التسلسل عند ${invoice.invoiceNumber} (الرقم ${invoice.sequence})`);
      }
      if (expectedPrevious && invoice.previousHash !== expectedPrevious) {
        problems.push(`سلسلة التجزئة مكسورة عند ${invoice.invoiceNumber}`);
      }
      expectedPrevious = invoice.invoiceHash;
    });

    return reply.send({
      count: invoices.length,
      intact: problems.length === 0,
      problems,
    });
  }
}
