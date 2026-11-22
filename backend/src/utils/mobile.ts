/**
 * توحيد أرقام الجوال.
 *
 * الورشة في السعودية لكن أرقامها لا تُكتب بصيغة واحدة: 0551234567 و
 * +966551234567 و 00966551234567 ثلاث صور لرقم واحد، ويكتبها الناس
 * بمسافات وشرطات وبأرقام عربية هندية (٠٥٥…). ولو خُزّنت كما كُتبت لصار
 * العميل الواحد ثلاثة سجلات، ولفشل فحص «هذا الرقم مسجّل بالفعل».
 *
 * وليست كل الأرقام سعودية: الورشة تخدم مقيمين، ومن يعرض النظام قد يجرّبه
 * برقمه هو. فالقاعدة هنا: وحّد الصور السعودية إلى 05…، واقبل ما عداها
 * كما هو بعد تنظيفه.
 */

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXTENDED_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹';

/** يحوّل الأرقام العربية الهندية إلى لاتينية ويزيل الفواصل. */
function clean(raw: string): string {
  let out = '';
  for (const ch of raw.trim()) {
    const ai = ARABIC_INDIC.indexOf(ch);
    const ei = EXTENDED_ARABIC_INDIC.indexOf(ch);
    if (ai >= 0) out += String(ai);
    else if (ei >= 0) out += String(ei);
    else if (/[0-9+]/.test(ch)) out += ch;
    // المسافات والشرطات والأقواس تُسقط
  }
  return out;
}

/**
 * يرجع الرقم بصيغته المعتمدة، أو null إن لم يكن رقمًا معقولًا.
 *
 * السعودي يصير 05XXXXXXXX، وغيره يبقى بصيغته الدولية +… أو كما كُتب.
 */
export function normalizeMobile(raw: string): string | null {
  let value = clean(raw);
  if (!value) return null;

  // 00 بادئة دولية مثل +
  if (value.startsWith('00')) value = '+' + value.slice(2);

  const digits = value.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;

  // الصور السعودية الثلاث إلى صورة واحدة محلية
  const saudi = digits.match(/^966(5\d{8})$/);
  if (saudi) return '0' + saudi[1];
  if (/^5\d{8}$/.test(digits)) return '0' + digits;
  if (/^05\d{8}$/.test(digits)) return digits;

  // رقم غير سعودي: يبقى دوليًا ليُعرف أنه كذلك
  return value.startsWith('+') ? value : '+' + digits;
}

/** للرسائل: هل يبدو الرقم صالحًا أصلًا؟ */
export function isUsableMobile(raw: string): boolean {
  return normalizeMobile(raw) !== null;
}
