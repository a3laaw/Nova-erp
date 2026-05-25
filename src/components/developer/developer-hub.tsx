'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
    Terminal, Settings2, Languages, ShieldCheck, 
    Calculator, Activity, History, Save, Loader2,
    Database, Network, Key, Sparkles, UserPlus, 
    Lock, AlertTriangle, Zap, Building2, Wallet
} from 'lucide-react';
import { useFirebase, useDocument } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, setDoc, serverTimestamp, collection, getDocs, orderBy, query, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn, getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * مكوّن مركز تحكم المطور (Developer Hub V1.0):
 * يضم الـ 5 تبويبات السيادية للتحكم الكامل في النظام.
 */
export function DeveloperHub() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [activeTab, setActiveTab] = useState('localization');
    const [isSaving, setIsSaving] = useState(false);

    // 🛡️ جلب الإعدادات الحالية من Firestore
    const configPath = useMemo(() => user?.currentCompanyId ? `companies/${user.currentCompanyId}/settings/system_config` : null, [user?.currentCompanyId]);
    const { data: config, loading } = useDocument<any>(firestore, configPath);

    const [localConfig, setLocalConfig] = useState<any>(null);

    useEffect(() => {
        if (config) setLocalConfig(config);
        else setLocalConfig({
            localization: { splash_loading: 'جاري التحميل', employee_label: 'الموظف' },
            hrRules: { annualLeaveQuota: 30, indemnityDivisor: 26, probationPeriodDays: 90 },
            financeConfig: { decimalPrecision: 3, currencyCode: 'KD', prefixes: { journalEntry: 'JV', purchaseOrder: 'PO' } },
            featureFlags: { enableWarehouse: true, enableHR: true, budgetThreshold: 90 },
        });
    }, [config]);

    const handleSave = async () => {
        if (!firestore || !configPath) return;
        setIsSaving(true);
        try {
            await setDoc(doc(firestore, configPath), cleanFirestoreData({
                ...localConfig,
                updatedAt: serverTimestamp(),
                updatedBy: user?.id
            }), { merge: true });
            toast({ title: '✅ تم حفظ الإعدادات المركزية' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        } finally { setIsSaving(false); }
    };

    if (loading || !localConfig) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-slate-900 text-white">
                <CardHeader className="p-10 bg-slate-950/60 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-600 rounded-[2.2rem] shadow-xl border-2 border-white/20">
                            <Terminal className="h-10 w-10 text-white" />
                        </div>
                        <div className="text-right">
                            <CardTitle className="text-3xl font-black tracking-tighter">مركز تحكم المطور</CardTitle>
                            <CardDescription className="text-indigo-200 font-bold opacity-70">إدارة القواعد الحركية، المسميات، وصلاحيات المنشأة.</CardDescription>
                        </div>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving} className="h-14 px-12 rounded-[1.8rem] font-black text-xl gap-3 bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-900/40 min-w-[240px]">
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                        اعتماد التغييرات
                    </Button>
                </CardHeader>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex justify-center mb-8">
                    <TabsList className="bg-white/40 p-1.5 rounded-[2.5rem] border border-white/60 shadow-xl h-16 w-full max-w-5xl backdrop-blur-3xl">
                        <TabsTrigger value="localization" className="rounded-full flex-1 font-black gap-2 h-full text-xs">
                            <Languages className="h-4 w-4" /> المسميات
                        </TabsTrigger>
                        <TabsTrigger value="hr" className="rounded-full flex-1 font-black gap-2 h-full text-xs">
                            <UserPlus className="h-4 w-4" /> قوانين الموارد
                        </TabsTrigger>
                        <TabsTrigger value="finance" className="rounded-full flex-1 font-black gap-2 h-full text-xs">
                            <Calculator className="h-4 w-4" /> المالية والترقيم
                        </TabsTrigger>
                        <TabsTrigger value="flags" className="rounded-full flex-1 font-black gap-2 h-full text-xs">
                            <Zap className="h-4 w-4" /> الموديولات
                        </TabsTrigger>
                        <TabsTrigger value="audit" className="rounded-full flex-1 font-black gap-2 h-full text-xs">
                            <History className="h-4 w-4" /> الأمان والصحة
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
                    {/* 1. تبويب المسميات */}
                    <TabsContent value="localization">
                        <Card className="rounded-[3rem] border-none shadow-2xl bg-white/80 p-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-6">
                                    <h3 className="font-black text-xl text-primary flex items-center gap-2"><Sparkles className="h-5 w-5"/> نصوص الواجهة</h3>
                                    <div className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label>نص شاشة التحميل</Label>
                                            <Input value={localConfig.localization?.splash_loading} onChange={e => setLocalConfig({...localConfig, localization: {...localConfig.localization, splash_loading: e.target.value}})} className="h-12 rounded-xl" />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <h3 className="font-black text-xl text-slate-800 flex items-center gap-2"><Building2 className="h-5 w-5"/> تسميات الموديولات</h3>
                                    <div className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label>مسمى "الموظف"</Label>
                                            <Input value={localConfig.localization?.employee_label} onChange={e => setLocalConfig({...localConfig, localization: {...localConfig.localization, employee_label: e.target.value}})} className="h-12 rounded-xl" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </TabsContent>

                    {/* 2. تبويب الموارد البشرية */}
                    <TabsContent value="hr">
                        <Card className="rounded-[3rem] border-none shadow-2xl bg-white/80 p-10">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="p-6 bg-primary/5 rounded-3xl border-2 border-dashed border-primary/20 text-center space-y-4">
                                    <Label className="font-black text-primary uppercase text-[10px] tracking-widest">رصيد الإجازات السنوية</Label>
                                    <Input type="number" value={localConfig.hrRules?.annualLeaveQuota} onChange={e => setLocalConfig({...localConfig, hrRules: {...localConfig.hrRules, annualLeaveQuota: parseInt(e.target.value)}})} className="h-14 text-center font-black text-3xl text-primary bg-white border-none" />
                                </div>
                                <div className="p-6 bg-indigo-50 rounded-3xl border-2 border-dashed border-indigo-200 text-center space-y-4">
                                    <Label className="font-black text-indigo-700 uppercase text-[10px] tracking-widest">قاسم حساب اليومية</Label>
                                    <Select value={String(localConfig.hrRules?.indemnityDivisor)} onValueChange={v => setLocalConfig({...localConfig, hrRules: {...localConfig.hrRules, indemnityDivisor: parseInt(v)}})}>
                                        <SelectTrigger className="h-14 rounded-2xl bg-white font-black text-2xl text-indigo-900 border-none"><SelectValue /></SelectTrigger>
                                        <SelectContent dir="rtl">
                                            <SelectItem value="26">26 يوم (عرف كويتي)</SelectItem>
                                            <SelectItem value="30">30 يوم (تقويم كامل)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-center space-y-4">
                                    <Label className="font-black text-slate-500 uppercase text-[10px] tracking-widest">فترة التجربة (يوم)</Label>
                                    <Input type="number" value={localConfig.hrRules?.probationPeriodDays} onChange={e => setLocalConfig({...localConfig, hrRules: {...localConfig.hrRules, probationPeriodDays: parseInt(e.target.value)}})} className="h-14 text-center font-black text-3xl bg-white border-none" />
                                </div>
                            </div>
                        </Card>
                    </TabsContent>

                    {/* 3. تبويب المالية */}
                    <TabsContent value="finance">
                        <Card className="rounded-[3rem] border-none shadow-2xl bg-white/80 p-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-6">
                                    <h3 className="font-black text-xl text-[#FF7A00] flex items-center gap-2"><Wallet className="h-5 w-5"/> إعدادات الحساب</h3>
                                    <div className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label>عدد الخانات العشرية (العملة)</Label>
                                            <Input type="number" max="4" min="0" value={localConfig.financeConfig?.decimalPrecision} onChange={e => setLocalConfig({...localConfig, financeConfig: {...localConfig.financeConfig, decimalPrecision: parseInt(e.target.value)}})} className="h-12 rounded-xl" />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <h3 className="font-black text-xl text-primary flex items-center gap-2"><Key className="h-5 w-5"/> اختصارات الترقيم (Prefixes)</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2"><Label>القيود</Label><Input value={localConfig.financeConfig?.prefixes?.journalEntry} onChange={e => setLocalConfig({...localConfig, financeConfig: {...localConfig.financeConfig, prefixes: {...localConfig.financeConfig.prefixes, journalEntry: e.target.value}}})} /></div>
                                        <div className="grid gap-2"><Label>المشتريات</Label><Input value={localConfig.financeConfig?.prefixes?.purchaseOrder} onChange={e => setLocalConfig({...localConfig, financeConfig: {...localConfig.financeConfig, prefixes: {...localConfig.financeConfig.prefixes, purchaseOrder: e.target.value}}})} /></div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </TabsContent>

                    {/* 4. تبويب الموديولات */}
                    <TabsContent value="flags">
                        <Card className="rounded-[3rem] border-none shadow-2xl bg-white/80 p-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-8">
                                    <h3 className="font-black text-xl text-slate-800 border-r-8 border-primary pr-4">تفعيل أقسام المنظومة</h3>
                                    <div className="grid gap-4">
                                        <div className="flex items-center justify-between p-5 bg-white rounded-3xl border shadow-sm">
                                            <div className="space-y-1"><Label className="font-black">موديول المخازن والمستودعات</Label><p className="text-[10px] text-slate-400 font-bold">تتبع الكميات، التوالف، والتحويلات.</p></div>
                                            <Switch checked={localConfig.featureFlags?.enableWarehouse} onCheckedChange={v => setLocalConfig({...localConfig, featureFlags: {...localConfig.featureFlags, enableWarehouse: v}})} />
                                        </div>
                                        <div className="flex items-center justify-between p-5 bg-white rounded-3xl border shadow-sm">
                                            <div className="space-y-1"><Label className="font-black">موديول الموارد البشرية والرواتب</Label><p className="text-[10px] text-slate-400 font-bold">البصمة، الإجازات، وعقود الموظفين.</p></div>
                                            <Switch checked={localConfig.featureFlags?.enableHR} onCheckedChange={v => setLocalConfig({...localConfig, featureFlags: {...localConfig.featureFlags, enableHR: v}})} />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-8">
                                    <h3 className="font-black text-xl text-red-600 border-r-8 border-red-600 pr-4">عتبات التنبيه والرقابة</h3>
                                    <div className="grid gap-4">
                                        <div className="p-6 bg-red-50 border-2 border-red-100 rounded-3xl space-y-4">
                                            <Label className="font-black text-red-900">تنبيه ميزانية المشروع (%)</Label>
                                            <Input type="number" value={localConfig.featureFlags?.budgetThreshold} onChange={e => setLocalConfig({...localConfig, featureFlags: {...localConfig.featureFlags, budgetThreshold: parseInt(e.target.value)}})} className="h-12 rounded-xl text-center font-black text-2xl text-red-600 border-none bg-white shadow-inner" />
                                            <p className="text-[10px] font-bold text-red-700 text-center">يرسل النظام تحذيراً عند وصول التكاليف لهذه النسبة.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </TabsContent>

                    {/* 5. تبويب الأمان والصحة */}
                    <TabsContent value="audit">
                        <Card className="rounded-[3rem] border-none shadow-2xl bg-white/80 p-10">
                            <div className="space-y-8">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-black text-2xl text-red-700 flex items-center gap-3"><ShieldCheck className="h-7 w-7" /> مركز مراقبة صحة النظام</h3>
                                    <Button variant="outline" className="rounded-xl font-black gap-2 border-red-200 text-red-600 bg-red-50 hover:bg-red-100">
                                        <Activity className="h-4 w-4" /> فحص اتزان الحسابات
                                    </Button>
                                </div>
                                <div className="p-10 border-4 border-dashed rounded-[3rem] bg-muted/20 flex flex-col items-center justify-center text-center gap-3 opacity-30">
                                    <History className="h-16 w-16" />
                                    <p className="font-black text-xl">سجل مراقبة العمليات (Audit Log) قيد التهيئة.</p>
                                    <p className="text-sm font-bold">سيظهر هنا كل من قام بتعديل أو حذف أي سجل بالثانية.</p>
                                </div>
                            </div>
                        </Card>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
