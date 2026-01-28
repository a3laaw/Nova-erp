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
import { Loader2, Wand2, Sparkles, ArrowRight, AlertTriangle, Calendar as CalendarIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { runAccountingAssistant, type AccountingAssistantOutput } from '@/ai/flows/accounting-assistant';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

export default function AccountingAssistantPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
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
      const response = await runAccountingAssistant({
        command: prompt,
        currentDate: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
      });
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
                أدخل أوامرك المحاسبية باللغة العربية (الفصحى أو العامية)، وسيقوم المساعد بتحويلها إلى عمليات منظمة.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center">
                        <Input
                            id="prompt-input"
                            placeholder='مثال: "اعمل قيد مرتب خالد بـ 500 دينار من البنك النهارده"'
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            disabled={isLoading}
                        />
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full md:w-[280px] justify-start text-left font-normal",
                                        !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="ml-2 h-4 w-4" />
                                    {date ? format(date, "PPP") : <span>اختر تاريخًا</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <Button onClick={handleProcessCommand} disabled={isLoading || !prompt.trim()} className="w-full md:w-auto">
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
