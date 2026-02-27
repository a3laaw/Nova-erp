import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

/**
 * تهيئة محرك Genkit 1.x باستخدام بلجن Google AI المستقر.
 */
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});
