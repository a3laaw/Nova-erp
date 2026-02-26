import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * تهيئة محرك Genkit مع إضافة دعم Google AI.
 * نستخدم الإعدادات الافتراضية لضمان أفضل توافق مع الموديلات المستقرة.
 */
export const ai = genkit({
  plugins: [
    googleAI()
  ],
  model: 'googleai/gemini-1.5-flash', // الموديل الأكثر استقراراً ودعماً للغة العربية و OCR
});
