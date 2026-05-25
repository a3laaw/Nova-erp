
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useFirebase, useSubscription } from '@/firebase';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    doc, 
    writeBatch, 
    serverTimestamp,
    getDocs
} from 'firebase/firestore';
import type { Company, CompanyRequest } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Terminal, Building2, Workflow, Settings2, ShieldCheck, 
    Activity, History, PlusCircle, Search, Rocket, Sparkles,
    Database, Network, Zap, LayoutGrid
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { cn, generateStableId } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// استيراد المكونات الفرعية لتبويبات المطور
import { DeveloperHub } from '@/components/developer/developer-hub';
import { PermissionsMatrix } from '@/components/developer/permissions-matrix';

/**
 * غرفة التحكم والسيادة المركزية (Sovereign Master Hub V40.0):
 * - البوابة الموحدة لإدارة الـ Metadata.
 * - عزل كامل للمنطق عن الكود.
 * - تصميم زجاجي لؤلؤي مطابق للمعايير.
 */
export default function DeveloperDashboard() {
  const { firestore, auth } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('tenants');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // جلب البيانات العالمية للمطور
  const { data: companies, loading: companiesLoading } = useSubscription<Company>(firestore, 'companies');
  const { data: requests, loading: requestsLoading } = useSubscription<CompanyRequest>(firestore, 'company_requests', [orderBy('createdAt', 'desc')]);

  const stats = useMemo(() => ({
      activeCompanies: companies.length,
      pendingRequests: requests.filter(r => r.status === 'pending').length
  }), [companies, requests]);

  const handleActivateRequest = async (request: CompanyRequest) => {
    if (!firestore || !auth?.currentUser) return;
    setIsProcessing(true);
    try {
        const idToken = await auth.currentUser.getIdToken();
        const companyId = `comp-${generateStableId()}`;
        
        // محاكاة لطلب الـ API الخلفي لإنشاء مستخدم للمنشأة
        const response = await fetch('/api/manage-tenant-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ 
                action: 'create_tenant_user', 
                companyId, 
                email: request.email, 
                password: `Nova@${Math.floor(1000 + Math.random() * 9000)}`, 
                displayName: request.contactName, 
                username: request.username, 
                role: 'Admin' 
            })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        const batch = writeBatch(firestore);
        batch.set(doc(firestore, 'companies', companyId), {
            name: request.companyName,
            status: 'active',
            subscriptionType: 'trial',
            createdAt: serverTimestamp(),
            companyId: companyId
        });

        batch.update(doc(firestore, 'company_requests', request.id!), { status: 'activated' });
        await batch.commit();
        toast({ title: '✅ تم التفعيل بنجاح' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'فشل التفعيل', description: e.message });
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-1000" dir="rtl">
        {/* هيدر غرفة التحكم */}
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/60 backdrop-blur-2xl border border-white/40">
            <CardHeader className="p-10 pb-8 bg-indigo-600/5 border-b">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-600 rounded-[2.2rem] shadow-2xl border-4 border-white">
                            <Terminal className="h-8 w-8 text-white" />
                        </div>
                        <div className="text-right">
                            <CardTitle className="text-4xl font-black text-[#1e1b4b] tracking-tighter">مركز التحكم والسيادة</CardTitle>
                            <CardDescription className="text-slate-500 font-bold text-lg mt-1">تخصيص كامل للنظام عبر مصفوفات الـ Metadata دون تدخل برمي.</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-white p-2 rounded-[1.8rem] border shadow-inner">
                        <div className="px-6 border-l border-slate-100 text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Tenants</p>
                            <p className="text-2xl font-black text-indigo-600 font-mono">{stats.activeCompanies}</p>
                        </div>
                        <Button className="h-12 px-8 rounded-2xl font-black gap-2 shadow-xl bg-indigo-600 hover:bg-indigo-700 border-none transition-all active:scale-95">
                            <PlusCircle className="h-5 w-5" /> إضافة منشأة
                        </Button>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-center mb-10">
                <TabsList className="bg-white/50 p-1.5 rounded-[2.5rem] border border-indigo-50 h-16 w-full max-w-5xl shadow-xl backdrop-blur-xl">
                    <TabsTrigger value="tenants" className="rounded-full flex-1 font-black gap-2 h-full text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <Building2 className="h-4 w-4" /> المنشآت والطلبات
                    </TabsTrigger>
                    <TabsTrigger value="ui-builder" className="rounded-full flex-1 font-black gap-2 h-full text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <LayoutGrid className="h-4 w-4" /> باني الشاشات
                    </TabsTrigger>
                    <TabsTrigger value="automation" className="rounded-full flex-1 font-black gap-2 h-full text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <Zap className="h-4 w-4" /> محرك الأتمتة
                    </TabsTrigger>
                    <TabsTrigger value="config" className="rounded-full flex-1 font-black gap-2 h-full text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <Settings2 className="h-4 w-4" /> الثوابت والمصطلحات
                    </TabsTrigger>
                    <TabsTrigger value="permissions" className="rounded-full flex-1 font-black gap-2 h-full text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <ShieldCheck className="h-4 w-4" /> مصفوفة الأمان
                    </TabsTrigger>
                    <TabsTrigger value="health" className="rounded-full flex-1 font-black gap-2 h-full text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        <Activity className="h-4 w-4" /> صحة النظام
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="tenants" className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="grid grid-cols-1 gap-10">
                    {/* عرض طلبات الانضمام المعلقة */}
                    <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white">
                        <CardHeader className="bg-slate-50 border-b p-8 px-12">
                            <CardTitle className="text-2xl font-black text-[#1e1b4b] flex items-center gap-3">
                                <Rocket className="h-6 w-6 text-orange-500 animate-pulse" /> طلبات الانضمام الجديدة
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-indigo-50/50 h-14 border-b">
                                    <TableRow className="border-none text-right">
                                        <TableHead className="px-12 font-black text-indigo-900">المنظمة</TableHead>
                                        <TableHead className="font-black text-indigo-900">المالك المسؤول</TableHead>
                                        <TableHead className="font-black text-indigo-900">البريد</TableHead>
                                        <TableHead className="text-left px-12 font-black text-indigo-900">الإجراء</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {requestsLoading ? <TableRow><TableCell colSpan={4} className="p-10 text-center"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> :
                                     requests.length === 0 ? <TableRow><TableCell colSpan={4} className="h-48 text-center opacity-30 italic font-black text-xl">لا توجد طلبات جديدة.</TableCell></TableRow> :
                                     requests.map(req => (
                                        <TableRow key={req.id} className="h-20 border-b last:border-0 hover:bg-slate-50 transition-colors">
                                            <TableCell className="px-12 font-black text-lg">{req.companyName}</TableCell>
                                            <TableCell className="font-bold text-slate-600">{req.contactName}</TableCell>
                                            <TableCell className="font-mono text-xs opacity-60">{req.email}</TableCell>
                                            <TableCell className="text-left px-12">
                                                {req.status === 'pending' ? (
                                                    <Button onClick={() => handleActivateRequest(req)} className="bg-green-600 hover:bg-green-700 rounded-xl font-black gap-2 h-10 px-6 border-none shadow-lg shadow-green-100">
                                                        <Sparkles className="h-4 w-4" /> تفعيل المنشأة
                                                    </Button>
                                                ) : <Badge className="bg-indigo-600 text-white font-black px-6 py-1.5 rounded-xl border-none">مفعّل</Badge>}
                                            </TableCell>
                                        </TableRow>
                                     ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            <TabsContent value="ui-builder" className="animate-in fade-in duration-500">
                <Card className="rounded-[3rem] border-none shadow-2xl p-20 flex flex-col items-center justify-center text-center gap-6 opacity-30 grayscale bg-white">
                    <div className="p-10 bg-indigo-50 rounded-[3rem] border-4 border-dashed border-indigo-200">
                        <LayoutGrid className="h-24 w-24 text-indigo-600" />
                    </div>
                    <p className="text-3xl font-black text-[#1e1b4b]">محرك الشاشات الديناميكي قيد التحصين</p>
                    <p className="text-lg font-bold max-w-md">سيسمح لك هذا القسم بتعريف شاشات جديدة، تحديد حقولها، وربطها بالجداول آلياً عبر الـ Metadata.</p>
                </Card>
            </TabsContent>

            <TabsContent value="config" className="animate-in fade-in duration-500">
                <DeveloperHub />
            </TabsContent>

            <TabsContent value="permissions" className="animate-in fade-in duration-500">
                <PermissionsMatrix />
            </TabsContent>

            <TabsContent value="health" className="animate-in fade-in duration-500">
                <Card className="rounded-[3rem] border-none shadow-2xl p-20 flex flex-col items-center justify-center text-center gap-6 opacity-30 grayscale bg-white">
                    <div className="p-10 bg-indigo-50 rounded-[3rem] border-4 border-dashed border-indigo-200">
                        <Activity className="h-24 w-24 text-indigo-600" />
                    </div>
                    <p className="text-3xl font-black text-[#1e1b4b]">مركز مراقبة النبض السيادي قيد التحصين</p>
                    <p className="text-lg font-bold max-w-md">سيقوم هذا القسم بفحص توازن الموازين، مراقبة سعة السيرفر، وتتبع سجل التدقيق الكامل.</p>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}

