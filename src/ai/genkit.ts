import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * تهيئة محرك Genkit بشكل مبسط ومستقر.
 * نستخدم الموديل gemini-1.5-flash الافتراضي.
 */
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
    })
  ],
});
