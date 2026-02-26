/**
 * @fileOverview تهيئة محرك Genkit الأساسي باستخدام Google AI Plugin.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});
