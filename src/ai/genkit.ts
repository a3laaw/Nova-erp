import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash', // Updated to 1.5 Flash for multimodal (PDF/Image) support
});
