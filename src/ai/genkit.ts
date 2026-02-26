/**
 * @fileOverview كائن وهمي (Mock) لمحرك Genkit.
 * يسمح هذا الكائن للنظام بالبناء والعمل بنجاح عند تعطيل ميزات الذكاء الاصطناعي،
 * حيث يوفر دوال فارغة تمنع حدوث خطأ "Null Pointer Exception" أثناء التشغيل.
 */

export const ai = {
  definePrompt: () => () => Promise.resolve({ output: null, text: '' }),
  defineFlow: () => () => Promise.resolve(null),
  defineTool: () => ({}),
  generate: () => Promise.resolve({ output: null, text: '', media: null }),
  checkOperation: () => Promise.resolve({ done: true }),
};
