import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * تهيئة محرك Genkit بشكل مستقر.
 * نقوم بإجبار المحرك على استخدام الإصدار v1 المستقر لتجنب أخطاء v1beta.
 */
export const ai = genkit({
  plugins: [
    googleAI({ 
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
      apiVersion: 'v1' // إجبار استخدام المسار المستقر
    })
  ],
});
