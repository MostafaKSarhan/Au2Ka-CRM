/**
 * الأرقام اليومية في النظام: WRK و APT و SUB، كلها على الشكل
 * PREFIX-YYYYMMDD-XXXX.
 *
 * كانت تُبنى من عدّ صفوف اليوم، وتاريخها يؤخذ أحيانًا بتوقيت UTC بينما
 * العدّ يبدأ من منتصف الليل المحلي. في السعودية (UTC+3) يعني ذلك أن كل
 * رقم يُصدر بين منتصف الليل والثالثة فجرًا يحمل تاريخ الأمس بينما العدّاد
 * قد صفّر عند منتصف الليل المحلي — فيخرج رقم أُصدر بالفعل في ذلك اليوم،
 * وترفضه قاعدة البيانات ويفشل فتح الكرت أو الاشتراك بخطأ غير مفهوم.
 * وقد حدث هذا فعلًا أثناء الاختبار بعد منتصف الليل.
 *
 * هنا: التاريخ محلي دائمًا، والتسلسل يُقرأ من أعلى رقم صادر في ذلك اليوم
 * لا من عدد الصفوف — فحذف صف لا يعيد استعمال رقمه، وصف أُنشئ بتاريخ
 * مُعدّل لا يربك العدّاد.
 */

const pad2 = (n: number) => String(n).padStart(2, '0');

/** YYYYMMDD بتوقيت الورشة، لا بتوقيت UTC. */
export function localDayStamp(date: Date = new Date()): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

/**
 * الرقم التالي لليوم.
 *
 * `findLatest` تُرجع أكبر رقم صادر يبدأ بالبادئة المعطاة، أو null إن لم
 * يصدر شيء اليوم. كل وحدة تمرّر استعلامها الخاص بجدولها.
 */
export async function nextDailyNumber(
  prefix: string,
  findLatest: (startsWith: string) => Promise<string | null | undefined>,
): Promise<string> {
  const base = `${prefix}-${localDayStamp()}-`;
  const latest = await findLatest(base);

  const lastSequence = latest ? parseInt(latest.slice(base.length), 10) : 0;
  const next = Number.isFinite(lastSequence) && lastSequence > 0 ? lastSequence + 1 : 1;

  return `${base}${String(next).padStart(4, '0')}`;
}
