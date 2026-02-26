/**
 * @fileOverview تهيئة محرك Genkit الأساسي للذكاء الاصطناعي على مستوى السيرفر.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    }),
  ],
});