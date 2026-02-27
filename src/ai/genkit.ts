import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';

/**
 * تهيئة محرك Genkit 1.x باستخدام بلجن Google AI المحدث وتحديد الموديل الافتراضي.
 */
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  model: gemini15Flash, // إعداد gemini15Flash كموديل افتراضي
});
