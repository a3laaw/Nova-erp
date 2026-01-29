'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wand2, TrendingUp, AlertTriangle } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { Account, JournalEntry } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { runFinancialForecast, type FinancialForecastOutput } from '@/ai/flows/financial-forecast-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function FinancialForecastPage() {
    const { firestore } = useFirebase();
    const [loadingData, setLoadingData] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [forecastPeriod, setForecastPeriod] = useState("3");
    const [historicalData, setHistoricalData] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [forecast, setForecast] = useState<FinancialForecastOutput | null>(null);

    useEffect(() => {
        if (!firestore) return;
        
        const fetchHistoricalData = async () => {
            setLoadingData(true);
            try {
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                
                const [accountsSnap, entriesSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'chartOfAccounts'))),
                    getDocs(query(collection(firestore, 'journalEntries'), where('status', '==', 'posted'), where('date', '>=', Timestamp.fromDate(oneYearAgo)))),
                ]);
                
                const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as Account }));
                const entries = entriesSnap.docs.map(doc => doc.data() as JournalEntry);
                
                const incomeAccountIds = new Set(accounts.filter(a => a.type === 'income').map(a => a.id));
                const expenseAccountIds = new Set(accounts.filter(a => a.type === 'expense').map(a => a.id));

                const monthlyTotals: { [key: string]: { revenue: number, expenses: number } } = {};
                
                entries.forEach(entry => {
                    const entryDate = entry.date.toDate();
                    const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
                    
                    if (!monthlyTotals[monthKey]) {
                        monthlyTotals[monthKey] = { revenue: 0, expenses: 0 };
                    }
                    
                    entry.lines.forEach(line => {
                        if (incomeAccountIds.has(line.accountId)) {
                            monthlyTotals[monthKey].revenue += (line.credit || 0) - (line.debit || 0);
                        } else if (expenseAccountIds.has(line.accountId)) {
                            monthlyTotals[monthKey].expenses += (line.debit || 0) - (line.credit || 0);
                        }
                    });
                });
                
                const sortedData = Object.entries(monthlyTotals)
                    .map(([key, value]) => ({ month: key, ...value }))
                    .sort((a, b) => a.month.localeCompare(b.month));

                setHistoricalData(sortedData);

            } catch (e) {
                console.error(e);
                setError("فشل في تحميل البيانات المالية التاريخية.");
            } finally {
                setLoadingData(false);
            }
        };

        fetchHistoricalData();
    }, [firestore]);
    
    const handleGenerateForecast = async () => {
        if (historicalData.length < 3) {
            setError("لا توجد بيانات تاريخية كافية (3 أشهر على الأقل) لإنشاء تنبؤ دقيق.");
            return;
        }

        setGenerating(true);
        setError(null);
        setForecast(null);

        try {
            const response = await runFinancialForecast({
                historicalData: JSON.stringify(historicalData),
                forecastPeriod: parseInt(forecastPeriod, 10),
            });
            setForecast(response);
        } catch (e: any) {
            console.error(e);
            setError(e.message || "حدث خطأ غير متوقع أثناء إنشاء التنبؤ.");
        } finally {
            setGenerating(false);
        }
    };


    return (
        <div className="space-y-6" dir="rtl">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <TrendingUp className="text-primary" />
                        <CardTitle>التنبؤات المالية بالذكاء الاصطناعي</CardTitle>
                    </div>
                    <CardDescription>
                        استخدم البيانات التاريخية لتوقع أداء شركتك المالي في الأشهر القادمة.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingData ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                            <span>جاري تحميل البيانات التاريخية...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
                            <div className="grid gap-2">
                                <Label htmlFor="forecast-period">فترة التنبؤ</Label>
                                <Select value={forecastPeriod} onValueChange={setForecastPeriod}>
                                    <SelectTrigger id="forecast-period">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="3">3 أشهر قادمة</SelectItem>
                                        <SelectItem value="6">6 أشهر قادمة</SelectItem>
                                        <SelectItem value="12">12 شهرًا قادمًا</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleGenerateForecast} disabled={generating}>
                                {generating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Wand2 className="ml-2 h-4 w-4" />}
                                {generating ? 'جاري التحليل...' : 'أنشئ التنبؤ'}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>خطأ في العملية</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {forecast && (
                <Card>
                    <CardHeader>
                        <CardTitle>نتائج التنبؤ</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="font-semibold mb-2">جدول التنبؤات</h4>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>الشهر</TableHead>
                                        <TableHead className="text-left">الإيرادات المتوقعة</TableHead>
                                        <TableHead className="text-left">المصروفات المتوقعة</TableHead>
                                        <TableHead className="text-left">الربح المتوقع</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {forecast.forecastSummary.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-medium">{item.month}</TableCell>
                                            <TableCell className="text-left font-mono text-green-600">{formatCurrency(item.revenue)}</TableCell>
                                            <TableCell className="text-left font-mono text-red-600">({formatCurrency(item.expenses)})</TableCell>
                                            <TableCell className={`text-left font-mono font-bold ${item.profit >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                                                {formatCurrency(item.profit)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        
                        <div className="space-y-2">
                             <h4 className="font-semibold mb-2">تحليل الذكاء الاصطناعي</h4>
                              <Alert>
                                <Wand2 className="h-4 w-4" />
                                <AlertDescription className="whitespace-pre-wrap">{forecast.analysis}</AlertDescription>
                            </Alert>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-semibold">مستوى الثقة في التنبؤ</span>
                                <span className="font-mono font-bold text-primary">{Math.round(forecast.confidenceScore * 100)}%</span>
                            </div>
                            <Progress value={forecast.confidenceScore * 100} />
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
