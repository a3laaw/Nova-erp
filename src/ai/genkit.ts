'use client';
/**
 * @fileOverview تهيئة محرك Genkit الأساسي للذكاء الاصطناعي.
 * يستخدم هذا الملف لتصدير كائن ai الذي يدير كافة نداءات الموديلات اللغوية.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI(), // سيبحث تلقائياً عن GOOGLE_GENAI_API_KEY في البيئة
  ],
});
