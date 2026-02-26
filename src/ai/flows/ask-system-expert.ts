'use server';
/**
 * @fileOverview خبير النظام الذكي - يقوم بالإجابة على استفسارات المستخدم بناءً على بيانات النظام الحية.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { findNavigationTool } from '@/ai/tools/find-navigation';
import { firestore } from '@/firebase/server-init';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

const SystemExpertInputSchema = z.object({
  question: z.string().describe("سؤال المستخدم حول النظام أو البيانات."),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).optional().describe('سجل المحادثة السابقة.'),
});
export type SystemExpertInput = z.infer<typeof SystemExpertInputSchema>;

const SystemExpertOutputSchema = z.object({
  answer: z.string().describe("إجابة الذكاء الاصطناعي."),
});
export type SystemExpertOutput = z.infer<typeof SystemExpertOutputSchema>;

// أداة لجلب مديونية عميل محدد
const getClientDebt = ai.defineTool(
  {
    name: 'getClientDebt',
    description: 'يستخرج إجمالي المبالغ المستحقة (المديونية) لعميل محدد من خلال اسمه أو رقم ملفه.',
    inputSchema: z.object({
      clientNameOrNumber: z.string().describe('اسم العميل أو رقم الملف المراد البحث عنه.'),
    }),
    outputSchema: z.object({
      debt: z.number().optional(),
      clientName: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  async ({ clientNameOrNumber }) => {
    if (!firestore) return { error: 'قاعدة البيانات غير متصلة.' };

    try {
      const clientsRef = collection(firestore, 'clients');
      const nameQuery = query(clientsRef, where('nameAr', '==', clientNameOrNumber), limit(1));
      const fileIdQuery = query(clientsRef, where('fileId', '==', clientNameOrNumber), limit(1));

      const [nameSnap, fileIdSnap] = await Promise.all([getDocs(nameQuery), getDocs(fileIdQuery)]);
      const clientDoc = nameSnap.docs[0] || fileIdSnap.docs[0];

      if (clientDoc) {
        const transactionsSnap = await getDocs(collection(firestore, `clients/${clientDoc.id}/transactions`));
        let totalDue = 0;
        transactionsSnap.forEach(txDoc => {
            const txData = txDoc.data();
            if (txData.contract?.clauses) {
                txData.contract.clauses.forEach((clause: any) => {
                    if (clause.status === 'مستحقة') totalDue += clause.amount || 0;
                });
            }
        });
        return { debt: totalDue, clientName: clientDoc.data().nameAr };
      }
      return { error: `لم يتم العثور على العميل: ${clientNameOrNumber}` };
    } catch (e) {
      return { error: 'حدث خطأ أثناء الوصول للبيانات.' };
    }
  }
);

// أداة لجلب معلومات حساب من شجرة الحسابات
const getAccountInfo = ai.defineTool(
  {
    name: 'getAccountInfo',
    description: 'يستخرج معلومات حساب محاسبي محدد من شجرة الحسابات باستخدام الاسم أو الكود.',
    inputSchema: z.object({
      accountNameOrCode: z.string().describe('اسم الحساب أو كود الحساب.'),
    }),
    outputSchema: z.any(),
  },
  async ({ accountNameOrCode }) => {
    if (!firestore) return { error: 'قاعدة البيانات غير متصلة.' };
    try {
        const coaRef = collection(firestore, 'chartOfAccounts');
        const qName = query(coaRef, where('name', '==', accountNameOrCode), limit(1));
        const qCode = query(coaRef, where('code', '==', accountNameOrCode), limit(1));
        const [snapN, snapC] = await Promise.all([getDocs(qName), getDocs(qCode)]);
        const acc = snapN.docs[0] || snapC.docs[0];
        return acc ? acc.data() : { error: 'الحساب غير موجود' };
    } catch (e) { return { error: 'Error fetching account' }; }
  }
);

export async function askSystemExpert(input: SystemExpertInput): Promise<SystemExpertOutput> {
    const { question, history } = input;
    const llmHistory = history?.map(msg => ({
      role: msg.role,
      content: [{ text: msg.content }],
    })) || [];
    
    const response = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      history: llmHistory,
      system: `أنت المساعد الذكي لنظام Nova ERP. مهمتك هي مساعدة المستخدم في استخدام النظام والإجابة على استفساراته حول البيانات.
      - إذا سأل المستخدم عن مديونية عميل، استخدم أداة getClientDebt.
      - إذا سأل عن حساب محاسبي، استخدم getAccountInfo.
      - إذا سأل عن كيفية القيام بمهمة، استخدم findNavigation لتوجيهه للصفحة الصحيحة.
      - كن مهذباً ومختصراً في إجاباتك باللغة العربية.`,
      prompt: question,
      tools: [findNavigationTool, getClientDebt, getAccountInfo]
    });
    
    return { answer: response.text };
}