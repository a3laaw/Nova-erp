/**
 * @fileOverview تهيئة محرك Genkit الأساسي باستخدام Vertex AI في منطقة us-central1.
 */

import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';

export const ai = genkit({
  plugins: [
    vertexAI({
      location: 'us-central1',
    }),
  ],
});
