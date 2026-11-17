import { createHash, createSign, generateKeyPairSync, createPrivateKey } from 'crypto';

/**
 * M9 — the cryptography ZATCA's phase two requires.
 *
 * Everything in this file is defined by the specification and is fully
 * testable without any credentials: the TLV encoding of the QR code, the
 * invoice hash and the chain that links each invoice to the one before it.
 * Only the certificate itself has to come from ZATCA.
 */

/** The first invoice in a chain carries the SHA-256 of a single zero byte. */
export const GENESIS_HASH = createHash('sha256').update(Buffer.from([0])).digest('base64');

/**
 * One TLV field: a one-byte tag, a one-byte length, then the value.
 *
 * The length is the byte length of the UTF-8 value, not its character count —
 * an Arabic seller name is two bytes per letter and would be truncated by any
 * reader if the character count were used.
 */
function tlv(tag: number, value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length > 255) {
    throw new Error(`قيمة الحقل ${tag} أطول من 255 بايت`);
  }
  return Buffer.concat([Buffer.from([tag, bytes.length]), bytes]);
}

export interface QrFields {
  sellerName: string;
  vatNumber: string;
  /** ISO 8601 timestamp of the invoice. */
  timestamp: string;
  totalWithVat: string;
  vatAmount: string;
}

/**
 * The base64 TLV string the printed QR encodes.
 *
 * Tags 1–5 are the phase-one set and are what a simplified invoice must carry;
 * tags 6–9 (hash, signature, public key, stamp) are added once a certificate
 * is in place.
 */
export function buildQrTlv(
  fields: QrFields,
  extras?: { invoiceHash?: string; signature?: string; publicKey?: Buffer; stamp?: Buffer },
): string {
  const parts = [
    tlv(1, fields.sellerName),
    tlv(2, fields.vatNumber),
    tlv(3, fields.timestamp),
    tlv(4, fields.totalWithVat),
    tlv(5, fields.vatAmount),
  ];

  if (extras?.invoiceHash) parts.push(tlv(6, extras.invoiceHash));
  if (extras?.signature) parts.push(tlv(7, extras.signature));
  if (extras?.publicKey) {
    parts.push(Buffer.concat([Buffer.from([8, extras.publicKey.length]), extras.publicKey]));
  }
  if (extras?.stamp) {
    parts.push(Buffer.concat([Buffer.from([9, extras.stamp.length]), extras.stamp]));
  }

  return Buffer.concat(parts).toString('base64');
}

/** Reads a TLV string back, so a generated QR can be checked rather than trusted. */
export function parseQrTlv(base64: string): Record<number, string> {
  const buffer = Buffer.from(base64, 'base64');
  const out: Record<number, string> = {};

  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const tag = buffer[offset];
    const length = buffer[offset + 1];
    const start = offset + 2;
    const end = start + length;
    if (end > buffer.length) break;

    out[tag] = buffer.subarray(start, end).toString('utf8');
    offset = end;
  }

  return out;
}

/**
 * The invoice hash: SHA-256 over the canonical XML, base64 encoded.
 *
 * ZATCA excludes the signature block itself from the hash, since the hash is
 * what gets signed.
 */
export function hashInvoiceXml(xml: string): string {
  const canonical = stripSignatureBlock(xml);
  return createHash('sha256').update(canonical, 'utf8').digest('base64');
}

/** Removes the UBLExtensions block before hashing, as the spec requires. */
export function stripSignatureBlock(xml: string): string {
  return xml.replace(/<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>\s*/g, '');
}

/**
 * A secp256k1 key pair and a CSR subject, which is what ZATCA's onboarding
 * expects before it will issue a CSID.
 */
export function generateKeyPair(): { privateKeyPem: string; publicKeyDer: Buffer } {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    // ZATCA mandates secp256k1 for the cryptographic stamp.
    namedCurve: 'secp256k1',
  });

  return {
    privateKeyPem: privateKey.export({ type: 'sec1', format: 'pem' }).toString(),
    publicKeyDer: publicKey.export({ type: 'spki', format: 'der' }) as Buffer,
  };
}

/** Signs the invoice hash with the stamp key (ECDSA over SHA-256). */
export function signHash(invoiceHashBase64: string, privateKeyPem: string): string {
  const key = createPrivateKey(privateKeyPem);
  const signer = createSign('SHA256');
  signer.update(Buffer.from(invoiceHashBase64, 'base64'));
  signer.end();
  return signer.sign(key).toString('base64');
}

/** Money as ZATCA wants it in the QR and the XML: two decimals, no grouping. */
export function money(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}
