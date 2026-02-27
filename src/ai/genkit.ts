import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// الحل الأضمن: تعريف الموديل والبلجن بشكل منفصل
export const ai = genkit({
  plugins: [googleAI()], 
});
