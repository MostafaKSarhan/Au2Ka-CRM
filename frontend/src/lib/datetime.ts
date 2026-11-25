/**
 * عرض التاريخ والوقت بتوقيت الورشة.
 *
 * `toISOString()` يحوّل إلى UTC أولًا، وفي السعودية (UTC+3) ذلك يعني أن
 * رسالة أُرسلت العاشرة صباحًا تظهر السابعة، وأن كل ما يحدث بعد التاسعة
 * مساءً يُنسب إلى اليوم السابق. الموظف يقرأ هذه الأوقات ليعرف متى وصلت
 * الرسالة للعميل، فلا يصح أن تكون بتوقيت آخر.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD بتوقيت الجهاز. */
export function dateKey(value: Date | string | number): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DD HH:MM بتوقيت الجهاز. */
export function dateTimeLocal(value: Date | string | number | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${dateKey(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** HH:MM بتوقيت الجهاز. */
export function timeLocal(value: Date | string | number | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
