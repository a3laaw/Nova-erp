import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiVersion: 'v1', // الحل المعتمد لضمان استقرار الاتصال من الكويت
    })
  ],
  model: 'googleai/gemini-1.5-flash',
});
