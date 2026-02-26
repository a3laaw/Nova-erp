/**
 * @fileOverview كائن وهمي (Mock) لمحرك Genkit.
 * يسمح هذا الكائن للنظام بالبناء والعمل بنجاح عند تعطيل ميزات الذكاء الاصطناعي،
 * حيث يوفر دوال تُرجع وظائف فارغة تمنع حدوث خطأ "is not a function" أثناء التشغيل.
 */

export const ai = {
  definePrompt: () => {
    return () => Promise.resolve({ output: null, text: '' });
  },
  defineFlow: () => {
    return () => Promise.resolve(null);
  },
  defineTool: () => ({}),
  generate: () => Promise.resolve({ output: null, text: '', media: null }),
  checkOperation: () => Promise.resolve({ done: true }),
};
