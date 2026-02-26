import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * تهيئة محرك Genkit باستخدام الموديل المستقر gemini-1.5-flash.
 * الموديل يدعم الـ OCR واستخراج البيانات المنظمة بفعالية عالية.
 */
export const ai = genkit({
  plugins: [
    googleAI()
  ],
  model: 'googleai/gemini-1.5-flash',
});