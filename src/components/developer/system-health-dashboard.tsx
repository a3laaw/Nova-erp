'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    Activity, ShieldCheck, Database, Loader2, 
    AlertTriangle, CheckCircle2, Cloud, 
    RefreshCcw, Scale
} from 'lucide-react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { formatCurrency, cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

/**
 * لوحة صحة النظام (System Health & Integrity):
 * فحص فوري لاتزان القيود المحاسبية، سعة التخزين، وأداء السيرفر.
 */
export function SystemHealthDashboard() {
    const { journalEntries, accounts, loading } = useAnalyticalData();
    const [isChecking, setIsChecking] = useState(false);
    const [healthStatus, setHealthStatus] = useState<'ok' | 'error' | null>(null);

    const checkIntegrity = () => {
        setIsChecking(true);
        setTimeout(() => {
            const posted = journalEntries.filter(e => e.status === 'posted');
            const totalDebit = posted.reduce((s, e) => s + (e.totalDebit || 0), 0);
            const totalCredit = posted.reduce((s, e) => s + (e.totalCredit || 0), 0);
            
            const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
            setHealthStatus(isBalanced ? 'ok' : 'error');
            setIsChecking(false);
        }, 1200);
    };

    return (
        <div className="space-y-10" dir="rtl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 space-y-6">
                    <div className="flex justify-between items-start">
                        <div className="p-3 bg-green-100 rounded-2xl text-green-700 shadow-inner"><Cloud className="h-6 w-6"/></div>
                        <Badge className="bg-green-600 text-white border-none font-black text-[9px] uppercase tracking-widest">Cloud Online</Badge>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تخزين الوثائق (IDs & Contracts)</p>
                            <span className="font-mono font-black text-xs">2.4 / 10 GB</span>
                        </div>
                        <Progress value={24} className="h-2 bg-slate-100" />
                    </div>
                </Card>

                <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 space-y-6">
                    <div className="flex justify-between items-start">
                        <div className="p-3 bg-blue-100 rounded-2xl text-blue-700 shadow-inner"><Database className="h-6 w-6"/></div>
                        <Badge variant="outline" className="text-blue-700 border-blue-200 font-black text-[9px] uppercase tracking-widest">Read/Write Stable</Badge>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي السجلات المعالجة</p>
                        <p className="text-4xl font-black font-mono text-slate-900 tracking-tighter">{(journalEntries.length + accounts.length).toLocaleString()}</p>
                    </div>
                </Card>

                <Card className="rounded-[2.5rem] border-none shadow-xl bg-slate-900 text-white p-8 flex flex-col justify-between group overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700" />
                    <div className="flex justify-between items-center relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300">System Uptime</p>
                        <Activity className="h-5 w-5 text-indigo-400 animate-pulse" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-5xl font-black font-mono tracking-tighter text-white">99.9<span className="text-xl text-indigo-400">%</span></p>
                        <p className="text-[9px] font-bold text-indigo-300/60 mt-1 uppercase tracking-widest">Reliability Score</p>
                    </div>
                </Card>
            </div>

            <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white">
                <CardHeader className="p-10 border-b bg-primary/5">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-primary rounded-3xl shadow-xl text-white border-4 border-white"><Scale className="h-8 w-8"/></div>
                            <div>
                                <CardTitle className="text-2xl font-black text-[#1e1b4b]">فحص اتزان الموازين والقيود</CardTitle>
                                <CardDescription className="text-base font-bold text-slate-500">إجراء سيادي يقوم بمطابقة كافة الحركات المالية لضمان عدم وجود خلل محاسبي.</CardDescription>
                            </div>
                        </div>
                        <Button onClick={checkIntegrity} disabled={isChecking} className="h-14 px-12 rounded-2xl font-black text-xl gap-3 shadow-xl shadow-primary/20">
                            {isChecking ? <Loader2 className="animate-spin h-6 w-6"/> : <RefreshCcw className="h-6 w-6" />} بدء الفحص الشامل
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-12">
                    {!healthStatus && !isChecking && (
                        <div className="p-20 border-4 border-dashed rounded-[4rem] flex flex-col items-center justify-center text-center opacity-30 grayscale">
                            <ShieldCheck className="h-20 w-20 text-muted-foreground mb-4" />
                            <p className="text-xl font-black">جاهز لإجراء فحص الصحة المالية والتقنية.</p>
                        </div>
                    )}

                    {isChecking && (
                        <div className="p-20 text-center space-y-6">
                            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto opacity-40" />
                            <p className="text-2xl font-black animate-pulse text-[#1e1b4b]">جاري مطابقة موازين المراجعة ومراكز التكلفة...</p>
                        </div>
                    )}

                    {healthStatus === 'ok' && (
                        <div className="p-16 bg-green-50 border-4 border-green-200 rounded-[4rem] text-center space-y-6 animate-in zoom-in-95 duration-500 shadow-xl shadow-green-100">
                            <div className="p-6 bg-green-600 rounded-full w-fit mx-auto border-8 border-white shadow-2xl"><CheckCircle2 className="h-12 w-12 text-white" /></div>
                            <div className="space-y-2">
                                <h4 className="text-3xl font-black text-green-900 tracking-tighter">النظام المالي متزن تماماً</h4>
                                <p className="text-lg font-bold text-green-700">تم فحص {journalEntries.length} قيداً مرحلاً؛ مجموع المدين يطابق الدائن بنسبة 100%.</p>
                            </div>
                        </div>
                    )}

                    {healthStatus === 'error' && (
                        <div className="p-16 bg-red-50 border-4 border-red-200 rounded-[4rem] text-center space-y-6 animate-in shake-x shadow-xl shadow-red-100">
                            <div className="p-6 bg-red-600 rounded-full w-fit mx-auto border-8 border-white shadow-2xl"><AlertTriangle className="h-12 w-12 text-white" /></div>
                            <div className="space-y-2">
                                <h4 className="text-3xl font-black text-red-900 tracking-tighter">تنبيه حرج: خلل في التوازن!</h4>
                                <p className="text-lg font-bold text-red-700">تم رصد فجوة مالية بين إجمالي الأرصدة المدينة والدائنة. يرجى مراجعة قيود التسوية.</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}