import { randomUUID } from 'crypto';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import {
  GENESIS_HASH,
  buildQrTlv,
  generateKeyPair,
  hashInvoiceXml,
  money,
  signHash,
} from './zatca.crypto';
import { buildInvoiceXml, InvoiceLine } from './zatca.ubl';

/**
 * M9 — issuing an invoice the way ZATCA's phase two requires.
 *
 * What the workshop must bring is its VAT number and portal access; everything
 * else — numbering, the hash chain, the XML, the QR and the stamp — happens
 * here. Accounting review and tax returns are explicitly out of scope.
 */

const SETTINGS_ID = 'default';

const API_HOSTS: Record<string, string> = {
  SANDBOX: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
  SIMULATION: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
  PRODUCTION: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
};

export async function getSettings() {
  const existing = await prisma.zatcaSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;

  return prisma.zatcaSettings.create({ data: { id: SETTINGS_ID } });
}

/** Everything that must be filled in before an invoice can be issued. */
export function missingSellerFields(settings: any): string[] {
  const missing: string[] = [];
  if (!settings.sellerNameAr) missing.push('اسم المنشأة');
  if (!settings.vatNumber) missing.push('الرقم الضريبي');
  if (!settings.crnNumber) missing.push('السجل التجاري');
  if (!settings.city) missing.push('المدينة');
  return missing;
}

/** A Saudi VAT number is 15 digits, starting and ending with 3. */
export function isValidVatNumber(value: string): boolean {
  return /^3\d{13}3$/.test(value.trim());
}

/** Creates the stamp key and the CSR subject ZATCA's onboarding needs. */
export async function prepareOnboarding() {
  const settings = await getSettings();

  const missing = missingSellerFields(settings);
  if (missing.length) {
    throw new AppError(`أكمل بيانات المنشأة أولًا: ${missing.join('، ')}`, 400);
  }

  const { privateKeyPem } = generateKeyPair();

  // The CSR subject ZATCA expects. The signed CSR itself is produced by the
  // Fatoora onboarding tool from these values together with the OTP the
  // workshop gets from the portal.
  const csrSubject = [
    `C=${settings.countryCode || 'SA'}`,
    `OU=${settings.crnNumber}`,
    `O=${settings.sellerNameAr}`,
    `CN=${settings.sellerNameAr}`,
  ].join('/');

  await prisma.zatcaSettings.update({
    where: { id: SETTINGS_ID },
    data: { privateKeyPem, csr: csrSubject },
  });

  return { csrSubject, keyGenerated: true };
}

/** The hash of the last issued invoice, or the genesis value for the first. */
export async function previousInvoiceHash(): Promise<string> {
  const last = await prisma.invoice.findFirst({
    where: { deletedAt: null, invoiceHash: { not: null } },
    orderBy: { sequence: 'desc' },
    select: { invoiceHash: true },
  });

  return last?.invoiceHash || GENESIS_HASH;
}

/** The next sequence number — ZATCA requires an unbroken counter. */
export async function nextSequence(): Promise<number> {
  const last = await prisma.invoice.findFirst({
    orderBy: { sequence: 'desc' },
    select: { sequence: true },
  });

  return (last?.sequence || 0) + 1;
}

export interface BuildInput {
  jobCardId?: string | null;
  customerId?: string | null;
  type: 'SIMPLIFIED' | 'STANDARD';
  buyerName?: string | null;
  buyerVatNumber?: string | null;
  lines: InvoiceLine[];
  createdById?: string | null;
}

/**
 * Builds, hashes, stamps and stores one invoice.
 *
 * The whole document is produced in one go so the number, the chain and the
 * XML can never disagree with one another.
 */
export async function issueInvoice(input: BuildInput) {
  const settings = await getSettings();

  const missing = missingSellerFields(settings);
  if (missing.length) {
    throw new AppError(`أكمل بيانات المنشأة أولًا: ${missing.join('، ')}`, 400);
  }
  if (!input.lines.length) {
    throw new AppError('الفاتورة بلا بنود', 400);
  }
  if (input.type === 'STANDARD' && !input.buyerVatNumber) {
    throw new AppError('الفاتورة الضريبية تتطلب الرقم الضريبي للمشتري', 400);
  }

  const vatRate = Number(settings.vatRate);
  const netAmount = input.lines.reduce((sum, l) => sum + l.net, 0);
  const vatAmount = Math.round(((netAmount * vatRate) / 100) * 100) / 100;
  const totalAmount = Math.round((netAmount + vatAmount) * 100) / 100;

  const sequence = await nextSequence();
  const issuedAt = new Date();
  const invoiceNumber = `INV-${issuedAt.getFullYear()}-${String(sequence).padStart(6, '0')}`;
  const uuid = randomUUID();
  const previousHash = await previousInvoiceHash();

  const xml = buildInvoiceXml({
    invoiceNumber,
    uuid,
    issuedAt,
    type: input.type,
    previousHash,
    sequence,
    vatRate,
    netAmount,
    vatAmount,
    totalAmount,
    lines: input.lines,
    seller: {
      nameAr: settings.sellerNameAr!,
      vatNumber: settings.vatNumber!,
      crnNumber: settings.crnNumber,
      street: settings.street,
      buildingNumber: settings.buildingNumber,
      district: settings.district,
      city: settings.city,
      postalCode: settings.postalCode,
      countryCode: settings.countryCode,
    },
    buyer: { name: input.buyerName, vatNumber: input.buyerVatNumber },
  });

  const invoiceHash = hashInvoiceXml(xml);

  // The stamp needs the key created during onboarding. Without it the invoice
  // is still valid phase-one output: numbered, hashed, chained and with a QR.
  let signature: string | null = null;
  if (settings.privateKeyPem) {
    try {
      signature = signHash(invoiceHash, settings.privateKeyPem);
    } catch {
      signature = null;
    }
  }

  const qrCode = buildQrTlv(
    {
      sellerName: settings.sellerNameAr!,
      vatNumber: settings.vatNumber!,
      timestamp: issuedAt.toISOString(),
      totalWithVat: money(totalAmount),
      vatAmount: money(vatAmount),
    },
    signature ? { invoiceHash, signature } : { invoiceHash },
  );

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      sequence,
      uuid,
      type: input.type,
      status: signature ? 'SIGNED' : 'DRAFT',
      jobCardId: input.jobCardId || null,
      customerId: input.customerId || null,
      issuedAt,
      buyerName: input.buyerName || null,
      buyerVatNumber: input.buyerVatNumber || null,
      netAmount,
      vatAmount,
      totalAmount,
      vatRate,
      lines: JSON.stringify(input.lines),
      previousHash,
      invoiceHash,
      qrCode,
      signedXml: xml,
      signature,
      createdById: input.createdById || null,
    },
  });

  return invoice;
}

/**
 * Sends the invoice to ZATCA: a simplified invoice is reported after the fact,
 * a standard one must be cleared before it is handed to the buyer.
 */
export async function submitToZatca(invoiceId: string) {
  const settings = await getSettings();
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, deletedAt: null } });
  if (!invoice) throw new AppError('الفاتورة غير موجودة', 404);

  if (!settings.isEnabled) {
    throw new AppError('الربط مع ZATCA غير مفعّل', 400);
  }
  if (!settings.productionCsid || !settings.productionSecret) {
    throw new AppError('شهادة CSID غير مكتملة — أكمل إجراءات التسجيل على بوابة ZATCA', 400);
  }
  if (!invoice.signedXml || !invoice.invoiceHash) {
    throw new AppError('الفاتورة غير مختومة', 400);
  }

  const host = API_HOSTS[settings.environment] || API_HOSTS.SANDBOX;
  const path = invoice.type === 'SIMPLIFIED' ? '/invoices/reporting/single' : '/invoices/clearance/single';
  const auth = Buffer.from(`${settings.productionCsid}:${settings.productionSecret}`).toString('base64');

  try {
    const response = await fetch(`${host}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept-Version': 'V2',
        'Accept-Language': 'ar',
        // Clearance must be requested explicitly for a standard invoice.
        ...(invoice.type === 'STANDARD' ? { 'Clearance-Status': '1' } : {}),
      },
      body: JSON.stringify({
        invoiceHash: invoice.invoiceHash,
        uuid: invoice.uuid,
        invoice: Buffer.from(invoice.signedXml, 'utf8').toString('base64'),
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const text = await response.text();

    if (!response.ok) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'FAILED', zatcaStatus: String(response.status), zatcaResponse: text.slice(0, 4000) },
      });
      throw new AppError(`رفضت ZATCA الفاتورة (${response.status})`, 400);
    }

    return prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: invoice.type === 'SIMPLIFIED' ? 'REPORTED' : 'CLEARED',
        zatcaStatus: String(response.status),
        zatcaResponse: text.slice(0, 4000),
        reportedAt: new Date(),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;

    const detail = String(error?.message || error).slice(0, 300);
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { zatcaStatus: 'ERROR', zatcaResponse: detail },
    });
    throw new AppError(`تعذّر الاتصال بـ ZATCA: ${detail}`, 502);
  }
}

/** Turns a job card into the invoice lines it is worth. */
export async function linesFromJobCard(jobCardId: string): Promise<InvoiceLine[]> {
  const jobCard = await prisma.jobCard.findFirst({
    where: { id: jobCardId, deletedAt: null },
    include: {
      replacements: { where: { deletedAt: null } },
    },
  });
  if (!jobCard) throw new AppError('كرت العمل غير موجود', 404);

  const lines: InvoiceLine[] = [];

  if (jobCard.estimatedCost && Number(jobCard.estimatedCost) > 0) {
    const net = Number(jobCard.estimatedCost);
    lines.push({ nameAr: 'أجور الإصلاح والصيانة', quantity: 1, unitPrice: net, net });
  }

  for (const part of jobCard.replacements) {
    const unitPrice = Number(part.unitPrice);
    lines.push({
      nameAr: part.partName,
      quantity: part.quantity,
      unitPrice,
      net: Math.round(unitPrice * part.quantity * 100) / 100,
    });
  }

  if (jobCard.additionalServices) {
    try {
      const extras = JSON.parse(jobCard.additionalServices);
      if (Array.isArray(extras)) {
        for (const extra of extras) {
          const price = Number(extra?.price) || 0;
          if (price <= 0) continue;
          lines.push({
            nameAr: String(extra?.name || 'خدمة إضافية'),
            quantity: 1,
            unitPrice: price,
            net: price,
          });
        }
      }
    } catch {
      // Free-text services carry no price and add no line.
    }
  }

  return lines;
}
