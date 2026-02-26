import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * تهيئة محرك Genkit.
 * تم تبسيط الإعدادات لضمان التوافق التام مع السيرفر وتجنب أخطاء 404/400.
 */
export const ai = genkit({
  plugins: [
    googleAI()
  ],
  model: 'googleai/gemini-1.5-flash',
});