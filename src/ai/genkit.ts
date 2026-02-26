/**
 * @fileOverview تهيئة محرك Genkit الأساسي مع الموديل الافتراضي.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  model: 'googleai/gemini-1.5-flash', // الموديل الافتراضي للنظام
});
