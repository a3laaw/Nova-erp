import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * تهيئة محرك Genkit بشكل مبسط ومستقر.
 * نستخدم الموديل المستقر المعتمد من جوجل.
 */
export const ai = genkit({
  plugins: [
    googleAI()
  ],
});
