'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wand2, Sparkles, ArrowRight, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { runAccountingAssistant, type AccountingAssistantOutput } from '@/ai/flows/accounting-assistant';
import { useRouter } from 'next/navigation';

export default function AccountingAssistantPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<AccountingAssistantOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProcessCommand = async () => {
    if (!prompt.trim()) {
      setError('الرجاء إدخال أمر للمساعد.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await runAccountingAssistant(prompt);
      setResult(response);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'حدث خطأ غير متوقع أثناء معالجة طلبك.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                <Sparkles className="text-primary" />
                المساعد المحاسبي الذكي
                </CardTitle>
                <CardDescription>
                أدخل أوامرك المحاسبية باللغة العربية، وسيقوم المساعد بتحويلها إلى عمليات منظمة.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4">
                <Textarea
                    id="prompt-input"
                    placeholder='مثال: "اعمل قيد يومية لشراء أثاث مكتبي بمبلغ 1500 دينار بشيك رقم 101 بتاريخ اليوم"'
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    disabled={isLoading}
                />
                <Button onClick={handleProcessCommand} disabled={isLoading || !prompt.trim()}>
                    {isLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Wand2 className="ml-2 h-4 w-4" />}
                    {isLoading ? 'جاري المعالجة...' : 'معالجة الأمر'}
                </Button>
                </div>
            </CardContent>
        </Card>
        
        {error && (
            <Alert variant="destructive">
                <AlertTitle>خطأ في المعالجة</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        {result && (
            <Card>
                <CardHeader>
                    <CardTitle>نتائج المعالجة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Alert>
                        <AlertTitle>شرح العملية</AlertTitle>
                        <AlertDescription>{result.explanation}</AlertDescription>
                    </Alert>

                    {result.warnings && result.warnings.length > 0 && (
                        <Alert variant="default" className="bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800/50 dark:text-yellow-200">
                             <AlertTriangle className="h-4 w-4 !text-yellow-600 dark:!text-yellow-300" />
                            <AlertTitle>تحذيرات</AlertTitle>
                            <AlertDescription>
                                <ul className="list-disc pr-5">
                                    {result.warnings.map((warning, index) => (
                                        <li key={index}>{warning}</li>
                                    ))}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    <div>
                        <h4 className="font-semibold mb-2">الأمر المنظم (JSON)</h4>
                        <pre className="p-4 bg-muted rounded-md text-sm overflow-x-auto" dir="ltr">
                        <code>{JSON.stringify(result, null, 2)}</code>
                        </pre>
                    </div>
                </CardContent>
            </Card>
        )}
    </div>
  );
}
