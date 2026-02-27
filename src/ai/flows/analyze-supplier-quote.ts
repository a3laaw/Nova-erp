'use server';

/**
 * @fileOverview ميزة التحليل الذكي متوقفة حالياً لضمان استقرار النظام وتوفير الـ Quota.
 */

export async function analyzeSupplierQuote(input: {
  quoteFileDataUri: string;
  rfqItems: { id: string; name: string }[];
}) {
  console.log('AI Analysis is intentionally disabled.');
  return null;
}
