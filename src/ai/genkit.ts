import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI() // إزالة apiVersion: 'v1' لحل مشكلة 400 Bad Request
  ],
  model: 'googleai/gemini-1.5-flash',
});
