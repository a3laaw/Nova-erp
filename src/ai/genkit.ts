/**
 * @fileOverview تهيئة محرك Genkit الأساسي للذكاء الاصطناعي.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      // محاولة جلب المفتاح من عدة مسميات شائعة لضمان العمل
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    }),
  ],
});
