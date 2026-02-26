'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bot, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { runAccountingAssistant, type AccountingAssistantOutput } from '@/ai/flows/accounting-assistant';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function AccountingAssistantPage() {
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AccountingAssistantOutput | null>(null);
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

  return (
    <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="bg-primary/5">
          <CardTitle className="flex items-center gap-2">
            <Bot className="text-primary h-6 w-6" />
            المساعد المحاسبي الذكي
          </CardTitle>
          <CardDescription>أدخل طلبك باللغة العربية (مثلاً: "سجل مصروف إيجار بـ 500 دينار كاش")</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input 
              placeholder="اكتب أمرك المحاسبي هنا..." 
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isProcessing}
              className="text-lg"
            />
            <Button onClick={handleSend} disabled={isProcessing || !command.trim()} className="h-11 px-6">
              {isProcessing ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="animate-in fade-in slide-in-from-top-4">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="text-green-500" />
              تحليل المساعد
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium text-primary mb-2">الإجراء المقترح:</p>
              <p>{result.explanation}</p>
            </div>
            {result.warnings.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <AlertCircle className="h-4 w-4" /> تنبيهات:
                </div>
                <ul className="list-disc pr-5">
                  {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResult(null)}>إلغاء</Button>
              <Button className="bg-green-600 hover:bg-green-700">تأكيد وتنفيذ القيد</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
