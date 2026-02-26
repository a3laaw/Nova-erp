import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// استخدام الإعدادات الافتراضية المستقرة لتجنب أخطاء 404 و 400
export const ai = genkit({
  plugins: [
    googleAI()
  ],
  model: 'googleai/gemini-1.5-flash',
});
