'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Languages, 
    Calculator, 
    UserPlus, 
    Save, 
    Loader2, 
    Zap, 
    ShieldCheck, 
    Landmark,
    FileText,
    Percent,
    Clock
} from 'lucide-react';
import { useFirebase, useDocument } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { DateInput } from '@/components/ui/date-input';

export function GlobalConfigManager() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState('localization');

    const configPath = useMemo(() => user?.currentCompanyId ? `companies/${user.currentCompanyId}/settings/system_config` : null, [user?.currentCompanyId]);
    const { data: config, loading } = useDocument<any>(firestore, configPath);

    const [localConfig, setLocalConfig] = useState<any>(null);

    useEffect(() => {
        if (config) setLocalConfig(config);
        else setLocalConfig({
            localization: { splash_loading: 'جاري التحميل', employee_label: 'الموظف', login_title: 'Nova' },
            hrRules: { annualLeaveQuota: 30, indemnityDivisor: 26, probationPeriodDays: 90, experienceLetterTemplate: 'نشهد نحن شركة [اسم_الشركة] بأن السيد [اسم_الموظف] قد عمل لدينا بمهنة [المسمى_الوظيفي]...' },
            financeConfig: { decimalPrecision: 3, currencyCode: 'KD', prefixes: { journalEntry: 'JV', purchaseOrder: 'PO', cashReceipt: 'CRV' } },
            featureFlags: { enableWarehouse: true, enableHR: true, enableProcurement: true, budgetThreshold: 90 },
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
            toast({ title: '✅ تم حفظ الثوابت المركزية' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        } finally { setIsSaving(false); }
    };

    if (loading || !localConfig) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>;

    return (
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/95">
            <CardHeader className="bg-indigo-600 text-white p-10">
                <div className="flex justify-between items-center">
                    <div className="text-right">
                        <CardTitle className="text-3xl font-black">قاموس الثوابت والمصطلحات</CardTitle>
                        <CardDescription className="text-indigo-100 font-bold opacity-80 mt-1">ضبط قوانين العمل الكويتية، العملات، ومسميات الواجهة.</CardDescription>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving} className="h-14 px-12 rounded-2xl font-black text-xl gap-3 bg-white text-indigo-600 hover:bg-slate-50 border-none transition-all active:scale-95 shadow-2xl">
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />} حفظ الثوابت
                    </Button>
                </div>
            </CardHeader>

            <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
                <div className="bg-slate-50 p-2 border-b">
                    <TabsList className="bg-transparent h-auto gap-2">
                        <TabsTrigger value="localization" className="rounded-xl px-8 font-black gap-2 h-11 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <Languages className="h-4 w-4" /> مسميات الواجهة
                        </TabsTrigger>
                        <TabsTrigger value="hr" className="rounded-xl px-8 font-black gap-2 h-11 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <UserPlus className="h-4 w-4" /> قوانين الـ HR
                        </TabsTrigger>
                        <TabsTrigger value="finance" className="rounded-xl px-8 font-black gap-2 h-11 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <Calculator className="h-4 w-4" /> الإعدادات المالية
                        </TabsTrigger>
                        <TabsTrigger value="flags" className="rounded-xl px-8 font-black gap-2 h-11 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <Zap className="h-4 w-4" /> تفعيل الموديولات
                        </TabsTrigger>
                    </TabsList>
                </div>

                <CardContent className="p-10">
                    <TabsContent value="localization" className="m-0 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-6">
                                <Label className="font-black text-indigo-600 border-r-4 border-indigo-600 pr-3 block">شاشة التحميل (Cinemagraph)</Label>
                                <div className="grid gap-4 bg-slate-50 p-6 rounded-3xl border-2 border-dashed">
                                    <div className="grid gap-2">
                                        <Label className="text-xs font-bold text-slate-500">نص الانتظار</Label>
                                        <Input value={localConfig.localization?.splash_loading} onChange={e => setLocalConfig({...localConfig, localization: {...localConfig.localization, splash_loading: e.target.value}})} className="h-12 rounded-xl bg-white border-2" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-xs font-bold text-slate-500">شعار الدخول الرئيسي</Label>
                                        <Input value={localConfig.localization?.login_title} onChange={e => setLocalConfig({...localConfig, localization: {...localConfig.localization, login_title: e.target.value}})} className="h-12 rounded-xl bg-white border-2" />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <Label className="font-black text-slate-800 border-r-4 border-slate-400 pr-3 block">مسميات الكيانات</Label>
                                <div className="grid gap-2 bg-slate-50 p-6 rounded-3xl border-2 border-dashed">
                                    <Label className="text-xs font-bold text-slate-500">تسمية الموظفين</Label>
                                    <Input value={localConfig.localization?.employee_label} onChange={e => setLocalConfig({...localConfig, localization: {...localConfig.localization, employee_label: e.target.value}})} className="h-12 rounded-xl bg-white border-2" />
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="hr" className="m-0 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                            <div className="p-8 bg-indigo-50/50 rounded-[2rem] border-2 border-dashed border-indigo-200 text-center space-y-3">
                                <Label className="font-black text-indigo-700 uppercase text-[10px] tracking-widest flex items-center justify-center gap-1"><Clock className="h-3 w-3"/> رصيد الإجازة السنوية</Label>
                                <Input type="number" value={localConfig.hrRules?.annualLeaveQuota} onChange={e => setLocalConfig({...localConfig, hrRules: {...localConfig.hrRules, annualLeaveQuota: parseInt(e.target.value)}})} className="h-14 text-center font-black text-4xl text-indigo-900 bg-white border-none shadow-inner" />
                            </div>
                            <div className="p-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 text-center space-y-3">
                                <Label className="font-black text-slate-500 uppercase text-[10px] tracking-widest flex items-center justify-center gap-1"><Calculator className="h-3 w-3"/> قاسم حساب اليومية</Label>
                                <Select value={String(localConfig.hrRules?.indemnityDivisor)} onValueChange={v => setLocalConfig({...localConfig, hrRules: {...localConfig.hrRules, indemnityDivisor: parseInt(v)}})}>
                                    <SelectTrigger className="h-14 rounded-2xl bg-white font-black text-3xl text-slate-800 border-none shadow-inner"><SelectValue /></SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="26">26 يوم (كويتي)</SelectItem>
                                        <SelectItem value="30">30 يوم (كامل)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="p-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 text-center space-y-3">
                                <Label className="font-black text-slate-500 uppercase text-[10px] tracking-widest">فترة التجربة (يوم)</Label>
                                <Input type="number" value={localConfig.hrRules?.probationPeriodDays} onChange={e => setLocalConfig({...localConfig, hrRules: {...localConfig.hrRules, probationPeriodDays: parseInt(e.target.value)}})} className="h-14 text-center font-black text-4xl bg-white border-none shadow-inner" />
                            </div>
                        </div>
                        <div className="p-8 bg-muted/20 rounded-[2rem] border-2 border-dashed">
                            <Label className="font-black text-indigo-600 mb-4 flex items-center gap-2"><FileText className="h-4 w-4"/> قالب شهادة الخبرة الذكي</Label>
                            <Textarea value={localConfig.hrRules?.experienceLetterTemplate} onChange={e => setLocalConfig({...localConfig, hrRules: {...localConfig.hrRules, experienceLetterTemplate: e.target.value}})} rows={6} className="rounded-2xl border-none shadow-inner text-base leading-loose font-medium bg-white" />
                            <p className="text-[10px] font-bold text-slate-400 mt-2">استخدم الرموز: [اسم_الموظف]، [المسمى_الوظيفي]، [تاريخ_التعيين].</p>
                        </div>
                    </TabsContent>

                    <TabsContent value="finance" className="m-0 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-8">
                                <h3 className="font-black text-xl text-primary border-r-8 border-primary pr-4 flex items-center gap-3"><Landmark className="h-6 w-6"/> الدقة والعملات</h3>
                                <div className="grid gap-6 bg-slate-50 p-6 rounded-3xl border-2 border-dashed">
                                    <div className="grid gap-2">
                                        <Label className="font-bold text-xs text-slate-500">دقة الكسور العشرية (0.000)</Label>
                                        <Input type="number" max="4" min="0" value={localConfig.financeConfig?.decimalPrecision} onChange={e => setLocalConfig({...localConfig, financeConfig: {...localConfig.financeConfig, decimalPrecision: parseInt(e.target.value)}})} className="h-12 rounded-xl bg-white border-2 text-xl font-black text-primary text-center w-32" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="font-bold text-xs text-slate-500">رمز العملة (KWD)</Label>
                                        <Input value={localConfig.financeConfig?.currencyCode} onChange={e => setLocalConfig({...localConfig, financeConfig: {...localConfig.financeConfig, currencyCode: e.target.value}})} className="h-12 rounded-xl bg-white border-2 w-32 font-black text-center" />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-8">
                                <h3 className="font-black text-xl text-indigo-600 border-r-8 border-indigo-600 pr-4 flex items-center gap-3"><FileText className="h-6 w-6"/> بادئات الترقيم المعتمدة</h3>
                                <div className="grid grid-cols-2 gap-6 p-8 bg-indigo-50/30 rounded-[2.5rem] border-2 border-dashed border-indigo-100">
                                    <div className="grid gap-1.5"><Label className="text-[10px] font-black uppercase text-indigo-400">قيود اليومية</Label><Input value={localConfig.financeConfig?.prefixes?.journalEntry} onChange={e => setLocalConfig({...localConfig, financeConfig: {...localConfig.financeConfig, prefixes: {...localConfig.financeConfig.prefixes, journalEntry: e.target.value}}})} className="font-mono font-black text-indigo-700 bg-white" /></div>
                                    <div className="grid gap-1.5"><Label className="text-[10px] font-black uppercase text-indigo-400">أوامر الشراء</Label><Input value={localConfig.financeConfig?.prefixes?.purchaseOrder} onChange={e => setLocalConfig({...localConfig, financeConfig: {...localConfig.financeConfig, prefixes: {...localConfig.financeConfig.prefixes, purchaseOrder: e.target.value}}})} className="font-mono font-black text-indigo-700 bg-white" /></div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="flags" className="m-0 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-8">
                                <h3 className="font-black text-xl text-slate-800 border-r-8 border-indigo-600 pr-4">إدارة الموديولات (Feature Flags)</h3>
                                <div className="grid gap-4 bg-slate-50 p-6 rounded-3xl border-2 border-dashed">
                                    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border shadow-sm">
                                        <Label className="font-black text-slate-700">موديول المخازن والمستودعات</Label>
                                        <Switch checked={localConfig.featureFlags?.enableWarehouse} onCheckedChange={v => setLocalConfig({...localConfig, featureFlags: {...localConfig.featureFlags, enableWarehouse: v}})} />
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border shadow-sm">
                                        <Label className="font-black text-slate-700">موديول المشتريات الخارجية</Label>
                                        <Switch checked={localConfig.featureFlags?.enableProcurement} onCheckedChange={v => setLocalConfig({...localConfig, featureFlags: {...localConfig.featureFlags, enableProcurement: v}})} />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-8">
                                <h3 className="font-black text-xl text-[#FF7A00] border-r-8 border-[#FF7A00] pr-4 flex items-center gap-2"><Percent className="h-6 w-6"/> عتبات التنبيه الرقابي</h3>
                                <div className="p-8 bg-orange-50 border-2 border-[#FF7A00]/20 rounded-[2.5rem] text-center space-y-4 shadow-inner">
                                    <Label className="font-black text-[#FF7A00] uppercase text-[10px] tracking-widest">تنبيه ميزانية المشروع (%)</Label>
                                    <Input type="number" value={localConfig.featureFlags?.budgetThreshold} onChange={e => setLocalConfig({...localConfig, featureFlags: {...localConfig.featureFlags, budgetThreshold: parseInt(e.target.value)}})} className="h-16 rounded-2xl text-center font-black text-5xl text-[#FF7A00] border-none bg-white shadow-inner" />
                                    <p className="text-[10px] font-bold text-orange-600 italic">يتم إطلاق تحذير فور تجاوز تكاليف الخرسانة والحديد لهذه النسبة.</p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </CardContent>
            </Tabs>
        </Card>
    );
}