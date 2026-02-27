'use server';

/**
 * تم إيقاف ميزة التحليل الذكي بناءً على طلب المستخدم.
 * هذا الملف يعمل الآن كواجهة برمجية فارغة لمنع تعطل الاستدعاءات البرمجية الأخرى.
 */
export async function analyzeSupplierQuote(input: {
  quoteFileDataUri: string;
  rfqItems: { id: string; name: string }[];
}) {
  console.log('AI Analysis is currently disabled.');
  return null;
}
