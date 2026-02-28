
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bot, Send, Loader2, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { runAccountingAssistant } from '@/ai/flows/accounting-assistant';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useFirebase } from '@/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';
import { cleanFirestoreData } from '@/lib/utils';

export default function AccountingAssistantPage() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!command.trim()) return;
    setIsProcessing(true);
    setResult(null);
    try {
      const response = await runAccountingAssistant({
        command,
        currentDate: format(new Date(), 'yyyy-MM-dd')
      });
      setResult(response);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!firestore || !currentUser || !result?.payload) return;
    setIsSaving(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'journalEntries');
            const counterDoc = await transaction.get(counterRef);
            
            let nextNumber = 1;
            if (counterDoc.exists()) {
                nextNumber = (counterDoc.data()?.counts?.[currentYear] || 0) + 1;
            }

            const newEntryNumber = `JV-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
            const newJeRef = doc(collection(firestore, 'journalEntries'));

            const jeData = {
                ...result.payload,
                entryNumber: newEntryNumber,
                status: 'posted', // AI suggested entries are usually confirmed by the user
                createdAt: serverTimestamp(),
                createdBy: currentUser.id,
                narration: result.explanation || result.payload.narration,
            };

            transaction.set(newJeRef, cleanFirestoreData(jeData));
            transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
        });

        toast({ title: 'تم التنفيذ', description: 'تم إنشاء القيد المحاسبي المولد ذكياً بنجاح.' });
        setResult(null);
        setCommand('');
    } catch (e) {
        toast({ variant: 'destructive', title: 'فشل التنفيذ', description: 'حدث خطأ أثناء حفظ القيد.' });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
      <Card className="border-primary/20 shadow-lg rounded-[2.5rem] overflow-hidden">
        <CardHeader className="bg-primary/5 pb-8">
          <CardTitle className="flex items-center gap-3 text-2xl font-black">
            <Bot className="text-primary h-8 w-8" />
            المساعد المحاسبي الذكي
          </CardTitle>
          <CardDescription className="text-base">أدخل طلبك باللغة العربية (مثلاً: "سجل مصروف إيجار بـ 500 دينار كاش")</CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <div className="flex gap-2 bg-muted p-1 rounded-2xl border shadow-inner">
            <Input 
              placeholder="اكتب أمرك المحاسبي هنا..." 
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isProcessing || isSaving}
              className="text-lg h-14 bg-transparent border-none shadow-none focus-visible:ring-0 font-bold"
            />
            <Button onClick={handleSend} disabled={isProcessing || isSaving || !command.trim()} className="h-12 w-14 rounded-xl">
              {isProcessing ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="animate-in fade-in slide-in-from-top-4 rounded-3xl shadow-xl border-2">
          <CardHeader className="border-b">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <CheckCircle2 className="text-green-500" />
              تحليل المساعد المحاسبي
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="p-6 bg-muted/30 rounded-2xl border-2 border-dashed">
              <p className="font-black text-primary mb-2 text-base">الإجراء المقترح:</p>
              <p className="text-lg leading-relaxed">{result.explanation}</p>
            </div>
            
            {result.warnings?.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <AlertCircle className="h-4 w-4" /> تنبيهات هامة:
                </div>
                <ul className="list-disc pr-5">
                  {result.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="ghost" onClick={() => setResult(null)} disabled={isSaving}>إلغاء</Button>
              <Button onClick={handleConfirmAndSave} disabled={isSaving} className="h-12 px-10 rounded-xl font-black text-lg gap-2 bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100">
                {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                تأكيد وتنفيذ القيد الآن
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
