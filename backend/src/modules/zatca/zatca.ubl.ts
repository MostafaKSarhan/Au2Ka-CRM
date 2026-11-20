import { money } from './zatca.crypto';

/**
 * M9 — the invoice as UBL 2.1 XML, in the shape ZATCA's phase two expects.
 *
 * The document is assembled as text rather than through a DOM library on
 * purpose: ZATCA hashes the canonical bytes, so the order and spacing of the
 * elements have to be ours to control exactly.
 */

export interface InvoiceLine {
  nameAr: string;
  quantity: number;
  unitPrice: number;
  /** Line total before VAT. */
  net: number;
}

export interface Seller {
  nameAr: string;
  vatNumber: string;
  crnNumber?: string | null;
  street?: string | null;
  buildingNumber?: string | null;
  district?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode: string;
}

export interface Buyer {
  name?: string | null;
  vatNumber?: string | null;
}

export interface InvoiceDocument {
  invoiceNumber: string;
  uuid: string;
  issuedAt: Date;
  type: 'SIMPLIFIED' | 'STANDARD';
  previousHash: string;
  sequence: number;
  vatRate: number;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
  lines: InvoiceLine[];
  seller: Seller;
  buyer: Buyer;
}

/** XML-escapes a value; Arabic names routinely contain & and quotes. */
function esc(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * ZATCA's invoice type code: the first pair is the document type (388 = tax
 * invoice) and the four digits say whether it is simplified or standard.
 */
function typeCode(type: 'SIMPLIFIED' | 'STANDARD'): { code: string; name: string } {
  return type === 'SIMPLIFIED'
    ? { code: '388', name: '0200000' }
    : { code: '388', name: '0100000' };
}

function line(item: InvoiceLine, index: number, vatRate: number): string {
  const vat = (item.net * vatRate) / 100;

  return `    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${item.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${money(item.net)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${money(vat)}</cbc:TaxAmount>
        <cbc:RoundingAmount currencyID="SAR">${money(item.net + vat)}</cbc:RoundingAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${esc(item.nameAr)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID schemeID="UN/ECE 5305" schemeAgencyID="6">S</cbc:ID>
          <cbc:Percent>${money(vatRate)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="SAR">${money(item.unitPrice)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
}

export function buildInvoiceXml(doc: InvoiceDocument): string {
  const { code, name } = typeCode(doc.type);
  const issued = doc.issuedAt.toISOString();
  const issueDate = issued.slice(0, 10);
  const issueTime = issued.slice(11, 19);

  const buyerBlock =
    doc.type === 'STANDARD' && (doc.buyer.name || doc.buyer.vatNumber)
      ? `  <cac:AccountingCustomerParty>
    <cac:Party>
      ${
        doc.buyer.vatNumber
          ? `<cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(doc.buyer.vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`
          : ''
      }
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(doc.buyer.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
`
      : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${esc(doc.invoiceNumber)}</cbc:ID>
  <cbc:UUID>${esc(doc.uuid)}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${name}">${code}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${doc.sequence}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${esc(doc.previousHash)}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">${esc(doc.seller.crnNumber)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(doc.seller.street)}</cbc:StreetName>
        <cbc:BuildingNumber>${esc(doc.seller.buildingNumber)}</cbc:BuildingNumber>
        <cbc:CitySubdivisionName>${esc(doc.seller.district)}</cbc:CitySubdivisionName>
        <cbc:CityName>${esc(doc.seller.city)}</cbc:CityName>
        <cbc:PostalZone>${esc(doc.seller.postalCode)}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>${esc(doc.seller.countryCode)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(doc.seller.vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(doc.seller.nameAr)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
${buyerBlock}  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${money(doc.vatAmount)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${money(doc.netAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${money(doc.vatAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID schemeID="UN/ECE 5305" schemeAgencyID="6">S</cbc:ID>
        <cbc:Percent>${money(doc.vatRate)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${money(doc.netAmount)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${money(doc.netAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${money(doc.totalAmount)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">${money(doc.totalAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${doc.lines.map((item, index) => line(item, index, doc.vatRate)).join('\n')}
</Invoice>`;
}
