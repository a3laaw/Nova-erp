'use server';

/**
 * @fileOverview ميزة التحليل الذكي متوقفة حالياً لضمان استقرار النظام.
 */

export async function analyzeSupplierQuote(input: {
  quoteFileDataUri: string;
  rfqItems: { id: string; name: string }[];
}) {
  console.log('AI Analysis is disabled.');
  return null;
}
