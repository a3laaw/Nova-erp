import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * تهيئة محرك Genkit باستخدام الموديل المستقر gemini-1.5-flash.
 * تم تعديل التهيئة لضمان قراءة مفتاح الـ API بشكل صحيح من المتغيرات البيئية.
 */
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
    })
  ],
  model: 'googleai/gemini-1.5-flash',
});
