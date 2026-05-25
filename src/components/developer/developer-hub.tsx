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
    Lock, AlertTriangle, Zap, Building2, Wallet,
    FileText,
    Target
} from 'lucide-react';
import { useFirebase, useDocument } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn, getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

/**
 * مكوّن محركات الإعدادات الشاملة (The 5-Tab System Engine V32.0):
 * يسمح للمطور بتخصيص كافة قواعد وقوانين البرنامج بلمسة زر.
 */
export function DeveloperHub() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [activeTab, setActiveTab] = useState('localization');
    const [isSaving, setIsSaving] = useState(false);

    // 🛡️ جلب الإعدادات المركزية للمنشأة الحالية 🛡️
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
            toast({ title: '✅ تم حفظ الإعدادات المركزية' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        } finally { setIsSaving(false); }
    };

    if (loading || !localConfig) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-indigo-500" /></div>;

    return (
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/95">
            <CardHeader className="bg-indigo-600 text-white p-10">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-white/10 rounded-[1.8rem] backdrop-blur-md border border-white/20 shadow-xl">
                            <Settings2 className="h-8 w-8 text-white" />
                        </div>
                        <div className="text-right">
                            <CardTitle className="text-3xl font-black tracking-tight">محركات الإعدادات الشاملة</CardTitle>
                            <CardDescription className="text-indigo-100 font-bold opacity-80">تحكم في نصوص، قوانين، وميزانيات المنشأة ديناميكياً.</CardDescription>
                        </div>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving} className="h-14 px-16 rounded-2xl font-black text-xl gap-3 bg-white text-indigo-600 hover:bg-slate-50 shadow-2xl shadow-indigo-900/20 border-none transition-all active:scale-95">
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                        اعتماد ونشر القواعد
                    </Button>
                </div>
            </CardHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="bg-slate-50 p-2 border-b">
                    <TabsList className="bg-transparent h-auto gap-2">
                        <TabsTrigger value="localization" className="rounded-xl px-8 font-black gap-2 h-11 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <Languages className="h-4 w-4" /> المسميات والنصوص
                        </TabsTrigger>
                        <TabsTrigger value="hr" className="rounded-xl px-8 font-black gap-2 h-11 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <UserPlus className="h-4 w-4" /> قوانين الموارد البشرية
                        </TabsTrigger>
                        <TabsTrigger value="finance" className="rounded-xl px-8 font-black gap-2 h-11 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <Calculator className="h-4 w-4" /> المالية واللوجستيات
                        </TabsTrigger>
                        <TabsTrigger value="flags" className="rounded-xl px-8 font-black gap-2 h-11 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <Zap className="h-4 w-4" /> تفعيل الموديولات
                        </TabsTrigger>
                        <TabsTrigger value="audit" className="rounded-full px-8 font-black gap-2 h-11 data-[state=active]:bg-white data-[state=active]:shadow-md">
                            <History className="h-4 w-4" /> الأمان والصحة
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="p-10 bg-white">
                    {/* 1. تبويب المسميات */}
                    <TabsContent value="localization" className="m-0 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-8">
                                <h3 className="font-black text-xl text-indigo-600 border-r-8 border-indigo-600 pr-4">نصوص الواجهة الرئيسية</h3>
                                <div className="space-y-6">
                                    <div className="grid gap-2">
                                        <Label className="font-bold text-slate-500 mr-1">نص شاشة التحميل (Loading)</Label>
                                        <Input value={localConfig.localization?.splash_loading} onChange={e => setLocalConfig({...localConfig, localization: {...localConfig.localization, splash_loading: e.target.value}})} className="h-12 rounded-xl bg-slate-50 border-2" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="font-bold text-slate-500 mr-1">عنوان صفحة الدخول</Label>
                                        <Input value={localConfig.localization?.login_title} onChange={e => setLocalConfig({...localConfig, localization: {...localConfig.localization, login_title: e.target.value}})} className="h-12 rounded-xl bg-slate-50 border-2" />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-8">
                                <h3 className="font-black text-xl text-slate-800 border-r-8 border-slate-400 pr-4">تسميات الكيانات</h3>
                                <div className="space-y-6">
                                    <div className="grid gap-2">
                                        <Label className="font-bold text-slate-500 mr-1">مسمى "الموظف"</Label>
                                        <Input value={localConfig.localization?.employee_label} onChange={e => setLocalConfig({...localConfig, localization: {...localConfig.localization, employee_label: e.target.value}})} className="h-12 rounded-xl bg-slate-50 border-2" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* 2. تبويب الموارد البشرية */}
                    <TabsContent value="hr" className="m-0 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                            <div className="p-8 bg-indigo-50/50 rounded-[2rem] border-2 border-dashed border-indigo-200 text-center space-y-4">
                                <Label className="font-black text-indigo-700 uppercase text-[10px] tracking-widest">رصيد الإجازة السنوية</Label>
                                <Input type="number" value={localConfig.hrRules?.annualLeaveQuota} onChange={e => setLocalConfig({...localConfig, hrRules: {...localConfig.hrRules, annualLeaveQuota: parseInt(e.target.value)}})} className="h-14 text-center font-black text-3xl text-indigo-900 bg-white border-none shadow-inner" />
                            </div>
                            <div className="p-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 text-center space-y-4">
                                <Label className="font-black text-slate-500 uppercase text-[10px] tracking-widest">قاسم حساب اليومية</Label>
                                <Select value={String(localConfig.hrRules?.indemnityDivisor)} onValueChange={v => setLocalConfig({...localConfig, hrRules: {...localConfig.hrRules, indemnityDivisor: parseInt(v)}})}>
                                    <SelectTrigger className="h-14 rounded-2xl bg-white font-black text-2xl text-slate-800 border-none shadow-inner"><SelectValue /></SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="26">26 يوم (عرف كويتي)</SelectItem>
                                        <SelectItem value="30">30 يوم (تقويم كامل)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="p-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 text-center space-y-4">
                                <Label className="font-black text-slate-500 uppercase text-[10px] tracking-widest">فترة التجربة (يوم)</Label>
                                <Input type="number" value={localConfig.hrRules?.probationPeriodDays} onChange={e => setLocalConfig({...localConfig, hrRules: {...localConfig.hrRules, probationPeriodDays: parseInt(e.target.value)}})} className="h-14 text-center font-black text-3xl bg-white border-none shadow-inner" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="font-black text-lg text-indigo-600 flex items-center gap-2"><FileText className="h-5 w-5"/> محرك قوالب الوثائق</h3>
                            <div className="p-8 bg-muted/20 rounded-[2rem] border-2 border-dashed">
                                <Label className="font-bold text-xs mb-2 block">صيغة شهادة الخبرة (تدعم الرموز الذكية):</Label>
                                <Textarea value={localConfig.hrRules?.experienceLetterTemplate} onChange={e => setLocalConfig({...localConfig, hrRules: {...localConfig.hrRules, experienceLetterTemplate: e.target.value}})} rows={8} className="rounded-2xl border-none shadow-inner text-base leading-loose font-medium bg-white" />
                            </div>
                        </div>
                    </TabsContent>

                    {/* 3. تبويب المالية */}
                    <TabsContent value="finance" className="m-0 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-8">
                                <h3 className="font-black text-xl text-primary border-r-8 border-primary pr-4 flex items-center gap-3"><Wallet className="h-6 w-6"/> إعدادات المحاسبة</h3>
                                <div className="grid gap-6">
                                    <div className="grid gap-2">
                                        <Label className="font-bold">دقة الكسور العشرية (العملة)</Label>
                                        <Input type="number" max="4" min="0" value={localConfig.financeConfig?.decimalPrecision} onChange={e => setLocalConfig({...localConfig, financeConfig: {...localConfig.financeConfig, decimalPrecision: parseInt(e.target.value)}})} className="h-12 rounded-xl bg-slate-50 border-2 text-xl font-black text-primary text-center w-32" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="font-bold">كود العملة الافتراضي</Label>
                                        <Input value={localConfig.financeConfig?.currencyCode} onChange={e => setLocalConfig({...localConfig, financeConfig: {...localConfig.financeConfig, currencyCode: e.target.value}})} className="h-12 rounded-xl bg-slate-50 border-2 w-32 font-black text-center" />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-8">
                                <h3 className="font-black text-xl text-indigo-600 border-r-8 border-indigo-600 pr-4 flex items-center gap-3"><Key className="h-6 w-6"/> بادئات الترقيم المعتمدة (Prefixes)</h3>
                                <div className="grid grid-cols-2 gap-6 p-8 bg-indigo-50/30 rounded-[2.5rem] border-2 border-dashed border-indigo-100">
                                    <div className="grid gap-1.5"><Label className="text-[10px] font-black uppercase text-indigo-400">قيود اليومية</Label><Input value={localConfig.financeConfig?.prefixes?.journalEntry} onChange={e => setLocalConfig({...localConfig, financeConfig: {...localConfig.financeConfig, prefixes: {...localConfig.financeConfig.prefixes, journalEntry: e.target.value}}})} className="font-mono font-black text-indigo-700 bg-white" /></div>
                                    <div className="grid gap-1.5"><Label className="text-[10px] font-black uppercase text-indigo-400">سندات الصرف</Label><Input value={localConfig.financeConfig?.prefixes?.paymentVoucher} onChange={e => setLocalConfig({...localConfig, financeConfig: {...localConfig.financeConfig, prefixes: {...localConfig.financeConfig.prefixes, paymentVoucher: e.target.value}}})} className="font-mono font-black text-indigo-700 bg-white" /></div>
                                    <div className="grid gap-1.5"><Label className="text-[10px] font-black uppercase text-indigo-400">سندات القبض</Label><Input value={localConfig.financeConfig?.prefixes?.cashReceipt} onChange={e => setLocalConfig({...localConfig, financeConfig: {...localConfig.financeConfig, prefixes: {...localConfig.financeConfig.prefixes, cashReceipt: e.target.value}}})} className="font-mono font-black text-indigo-700 bg-white" /></div>
                                    <div className="grid gap-1.5"><Label className="text-[10px] font-black uppercase text-indigo-400">أوامر الشراء</Label><Input value={localConfig.financeConfig?.prefixes?.purchaseOrder} onChange={e => setLocalConfig({...localConfig, financeConfig: {...localConfig.financeConfig, prefixes: {...localConfig.financeConfig.prefixes, purchaseOrder: e.target.value}}})} className="font-mono font-black text-indigo-700 bg-white" /></div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* 4. تبويب الموديولات */}
                    <TabsContent value="flags" className="m-0 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-8">
                                <h3 className="font-black text-xl text-slate-800 border-r-8 border-indigo-600 pr-4">تفعيل أقسام النظام</h3>
                                <div className="grid gap-4">
                                    <ModuleSwitch label="موديول المخازن والمستودعات" description="تتبع الكميات، التوالف، والتحويلات." checked={localConfig.featureFlags?.enableWarehouse} onChange={v => setLocalConfig({...localConfig, featureFlags: {...localConfig.featureFlags, enableWarehouse: v}})} />
                                    <ModuleSwitch label="موديول الموارد البشرية والرواتب" description="البصمة، الإجازات، وعقود الموظفين." checked={localConfig.featureFlags?.enableHR} onChange={v => setLocalConfig({...localConfig, featureFlags: {...localConfig.featureFlags, enableHR: v}})} />
                                    <ModuleSwitch label="موديول المشتريات الخارجية" description="طلبات التسعير (RFQ) وعروض الموردين." checked={localConfig.featureFlags?.enableProcurement} onChange={v => setLocalConfig({...localConfig, featureFlags: {...localConfig.featureFlags, enableProcurement: v}})} />
                                </div>
                            </div>
                            <div className="space-y-8">
                                <h3 className="font-black text-xl text-red-600 border-r-8 border-red-600 pr-4">عتبات الرقابة والتحذير</h3>
                                <div className="p-8 bg-red-50 border-2 border-red-100 rounded-[2.5rem] space-y-6">
                                    <div className="grid gap-3">
                                        <Label className="font-black text-red-900 text-lg">تنبيه ميزانية المشروع (%)</Label>
                                        <Input type="number" value={localConfig.featureFlags?.budgetThreshold} onChange={e => setLocalConfig({...localConfig, featureFlags: {...localConfig.featureFlags, budgetThreshold: parseInt(e.target.value)}})} className="h-14 rounded-2xl text-center font-black text-4xl text-red-600 border-none bg-white shadow-inner" />
                                        <p className="text-[10px] font-bold text-red-700 text-center">يطلق النظام تحذيراً فورياً للمدير عند وصول التكاليف لهذه النسبة.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* 5. تبويب الأمان والصحة */}
                    <TabsContent value="audit" className="m-0 animate-in fade-in duration-500">
                        <div className="space-y-10">
                            <div className="flex justify-between items-center bg-red-50 p-8 rounded-[2.5rem] border-2 border-red-100 shadow-sm">
                                <div className="flex items-center gap-6">
                                    <div className="p-4 bg-red-600 rounded-3xl text-white shadow-xl"><ShieldCheck className="h-8 w-8" /></div>
                                    <div>
                                        <h3 className="text-2xl font-black text-red-900">مركز مراقبة سلامة البيانات</h3>
                                        <p className="text-sm font-bold text-red-700">فحص اتزان الحسابات ومراقبة محاولات التلاعب أو الحذف.</p>
                                    </div>
                                </div>
                                <Button variant="outline" className="rounded-xl font-black gap-2 border-red-200 text-red-600 bg-white hover:bg-red-100 h-12 px-8">
                                    <Activity className="h-5 w-5" /> فحص التوازن المحاسبي
                                </Button>
                            </div>
                            
                            <div className="p-20 border-4 border-dashed rounded-[4rem] bg-muted/5 flex flex-col items-center justify-center text-center gap-4 opacity-30">
                                <History className="h-16 w-16 text-muted-foreground" />
                                <p className="font-black text-2xl">سجل مراقبة العمليات (Audit Log) قيد التهيئة.</p>
                                <p className="text-sm font-bold max-w-sm">سيقوم هذا القسم بتوثيق كل تعديل أو حذف في النظام مع تسجيل المستخدم، التوقيت، والقيم السابقة واللاحقة.</p>
                            </div>
                        </div>
                    </TabsContent>
                </div>
            </Tabs>
        </Card>
    );
}

function ModuleSwitch({ label, description, checked, onChange }: any) {
    return (
        <div className="flex items-center justify-between p-6 bg-white rounded-3xl border-2 hover:border-indigo-600/30 transition-all shadow-sm group">
            <div className="space-y-1 text-right">
                <Label className="font-black text-base text-slate-800">{label}</Label>
                <p className="text-[10px] text-slate-400 font-bold group-hover:text-indigo-500 transition-colors">{description}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-indigo-600" />
        </div>
    );
}

