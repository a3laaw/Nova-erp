
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirebase, useSubscription } from '@/firebase';
import { doc, updateDoc, collection, orderBy, query, getDocs, where, addDoc, serverTimestamp, runTransaction, Timestamp, deleteField } from 'firebase/firestore';
import type { Company, CompanyRequest, UserProfile } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
    PlusCircle, Building2, Search, Loader2, Terminal, Pencil, 
    MoreHorizontal, DatabaseZap, ArrowRightLeft, ShieldCheck, 
    Activity, Users, Clock, CheckCircle2, ShieldAlert, 
    FileStack, Rocket, Key, Copy, AlertCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toFirestoreDate } from '@/services/date-converter';
import { format, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';

const activityTranslations: Record<string, string> = {
    general: 'تجاري عام',
    food_delivery: 'مطاعم وأغذية',
    construction: 'مقاولات وبناء',
    consulting: 'استشارات هندسية',
};

/**
 * لوحة تحكم المطور:
 * مسؤولة عن "تأسيس" المنشآت الجديدة وضمان عزلها التام.
 */
export default function DeveloperDashboard() {
  const { firestore, auth: clientAuth } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const { data: rawCompanies, loading } = useSubscription<Company>(firestore, 'companies', []);
  const { data: requests, loading: requestsLoading } = useSubscription<CompanyRequest>(firestore, 'company_requests', [orderBy('createdAt', 'desc')]);

  const filteredCompanies = useMemo(() => {
    if (!rawCompanies) return [];
    let processed = [...rawCompanies].sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
    });
    if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        processed = processed.filter(c => c.name.toLowerCase().includes(lower) || c.adminEmail?.toLowerCase().includes(lower));
    }
    return processed;
  }, [rawCompanies, searchQuery]);

  /**
   * محرك التفعيل الآلي (Sovereign Provisioning):
   * يقوم بإنشاء شركة نظيفة تماماً بمعرف جديد، وبناء الهوية الرقمية للمدير.
   */
  const handleApproveRequest = async (request: any) => {
    if (!firestore || isProcessing) return;
    setIsProcessing(request.id!);
    try {
        const companyId = `comp_${Math.random().toString(36).substring(2, 9)}`;
        const username = request.username; // الاسم الذي اختاره العميل
        const internalEmail = `${username}@${companyId}.nova`; // الهوية الرقمية المعزولة

        // 1. إنشاء الحساب في Firebase Auth عبر الـ API السيادي
        const authResponse = await fetch('/api/manage-tenant-user', {
            method: 'POST',
            body: JSON.stringify({
                email: internalEmail,
                password: request.adminPassword,
                displayName: request.contactName,
                action: 'create'
            })
        });
        const authResult = await authResponse.json();
        if (!authResult.success && !authResult.simulated) throw new Error(authResult.error);

        const trialEndDate = addDays(new Date(), 14);

        await runTransaction(firestore, async (transaction) => {
            // 2. إنشاء وثيقة الشركة الرئيسية
            const companyRef = doc(firestore, 'companies', companyId);
            transaction.set(companyRef, {
                name: request.companyName,
                activityType: request.activity,
                adminEmail: internalEmail,
                adminPassword: request.adminPassword,
                contactPhone: request.phone, // حفظ الهاتف للتواصل اللاحق
                contactEmail: request.email, // حفظ الإيميل الحقيقي للتواصل اللاحق
                subscriptionType: 'trial',
                trialEndDate: Timestamp.fromDate(trialEndDate),
                maxUsersLimit: 5,
                isActive: true,
                firebaseConfig: {
                    apiKey: "AIzaSyCX4Zms4_pkTGy0chAJPyF6P6g9XCRAXk8",
                    authDomain: "studio-8039389980-3d2d0.firebaseapp.com",
                    projectId: "studio-8039389980-3d2d0",
                    appId: "1:828494117254:web:d0c31facd0d0bb2f341407",
                },
                createdAt: serverTimestamp(),
                createdBy: 'system-auto-approval'
            });

            // 3. إنشاء ملف المدير في المجلد المعزول الخاص بالشركة
            const tenantUserRef = doc(firestore, `companies/${companyId}/users`, authResult.uid || 'simulated-uid');
            transaction.set(tenantUserRef, {
                uid: authResult.uid || 'simulated-uid',
                email: internalEmail,
                username: username,
                fullName: request.contactName,
                role: 'Admin',
                isActive: true,
                companyId: companyId,
                createdAt: serverTimestamp()
            });

            // 4. تحديث الفهرس العالمي لتمكين الدخول باسم المستخدم
            const globalUserRef = doc(collection(firestore, 'global_users'));
            transaction.set(globalUserRef, {
                email: internalEmail,
                username: username,
                companyId: companyId,
                role: 'Admin'
            });

            // 5. تحديث حالة الطلب
            transaction.update(doc(firestore, 'company_requests', request.id!), { status: 'approved' });
        });
        
        toast({ 
            title: 'تم التأسيس بنجاح', 
            description: `المنشأة "${request.companyName}" جاهزة الآن. الدخول بـ: ${username}` 
        });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'فشل التفعيل', description: e.message });
    } finally { setIsProcessing(null); }
  };

  const handleSwitchToCompany = async (company: Company) => {
    if (!firestore || !currentUser || isProcessing) return;
    setIsProcessing(company.id!);
    try {
        const response = await fetch('/api/switch-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: currentUser.id, companyId: company.id, companyName: company.name })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        
        if (clientAuth?.currentUser) await clientAuth.currentUser.getIdToken(true);
        toast({ title: 'تم التبديل', description: `أنت الآن في بيئة عمل: ${company.name}` });
        router.push('/dashboard');
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    } finally { setIsProcessing(null); }
  };

  return (
    <div className="space-y-10" dir="rtl">
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-[#1e1b4b]">
            <CardHeader className="p-10 pb-8 bg-indigo-950/60 border-b border-white/10">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-600 rounded-[2.2rem] shadow-[0_0_40px_rgba(79,70,229,0.5)] border-2 border-white/20"><Terminal className="h-10 w-10 text-white" /></div>
                        <div className="text-right">
                            <CardTitle className="text-4xl font-black text-white tracking-tighter">لوحة إدارة المنصة</CardTitle>
                            <CardDescription className="text-indigo-200 font-bold text-lg opacity-80 mt-1">تأسيس المنظمات الجديدة، إدارة التراخيص، ومتابعة قاعدة بيانات التواصل.</CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <Tabs defaultValue="companies" className="space-y-8 animate-in fade-in duration-700">
            <TabsList className="bg-indigo-950/40 p-1.5 rounded-3xl border border-white/10 backdrop-blur-xl h-16 w-fit mx-auto flex gap-4">
                <TabsTrigger value="companies" className="rounded-2xl px-10 font-black text-lg gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                    <Building2 className="h-5 w-5"/> المنظمات المشتركة
                </TabsTrigger>
                <TabsTrigger value="requests" className="rounded-2xl px-10 font-black text-lg gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white relative">
                    <FileStack className="h-5 w-5"/> طلبات الانضمام
                    {requests.filter(r => r.status === 'pending').length > 0 && <span className="absolute -top-1 -right-1 h-6 w-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-black animate-bounce shadow-lg">{requests.filter(r => r.status === 'pending').length}</span>}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="companies">
                <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-white/95">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-[#1e1b4b] h-16">
                                <TableRow className="border-none">
                                    <TableHead className="px-12 font-black text-white text-base text-right">المنظمة وبيانات الدخول</TableHead>
                                    <TableHead className="font-black text-indigo-100 text-base text-center">بيانات التواصل</TableHead>
                                    <TableHead className="font-black text-indigo-100 text-base text-center">الحصة</TableHead>
                                    <TableHead className="font-black text-indigo-100 text-base text-center">الحالة</TableHead>
                                    <TableHead className="text-left px-12 font-black text-indigo-100 text-base">التحكم</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={5} className="text-center p-20"><Loader2 className="animate-spin h-12 w-12 mx-auto text-indigo-500" /></TableCell></TableRow>
                                ) : filteredCompanies.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-64 text-center text-slate-300 font-black text-2xl uppercase">No Organizations Found</TableCell></TableRow>
                                ) : (
                                    filteredCompanies.map(company => (
                                        <TableRow key={company.id} className="h-32 border-slate-100 group transition-all">
                                            <TableCell className="px-12">
                                                <div className="flex items-center gap-4">
                                                    <Building2 className="h-8 w-8 text-indigo-600" />
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-xl">{company.name}</span>
                                                        <span className="font-mono text-xs text-primary font-bold">Username: {company.adminEmail?.split('@')[0]}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <p className="font-bold text-slate-700">{company.contactPhone || '-'}</p>
                                                <p className="text-[10px] font-mono text-muted-foreground">{company.contactEmail || '-'}</p>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="font-black text-xl text-indigo-950">{(company as any).currentUsersCount || 0} / {company.maxUsersLimit}</div>
                                                <span className="text-[9px] font-black text-muted-foreground uppercase">Users Limit</span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className={cn("px-6 py-1.5 rounded-full font-black text-[10px] border-2", company.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')}>
                                                    {company.isActive ? 'ACTIVE' : 'LOCKED'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-left px-12">
                                                <Button onClick={() => handleSwitchToCompany(company)} variant="outline" className="rounded-xl font-bold h-10 gap-2 border-indigo-200 text-indigo-700">
                                                    <ArrowRightLeft className="h-4 w-4"/> دخول للمنظمة
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="requests">
                <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-white/95">
                    <Table>
                        <TableHeader className="bg-[#1e1b4b] h-16">
                            <TableRow className="border-none">
                                <TableHead className="px-12 font-black text-white text-base text-right">المنظمة</TableHead>
                                <TableHead className="font-black text-indigo-100 text-base text-center">اسم المستخدم المختار</TableHead>
                                <TableHead className="font-black text-indigo-100 text-base text-center">بيانات التواصل</TableHead>
                                <TableHead className="text-left px-12 font-black text-indigo-100 text-base">القرار</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {requestsLoading ? (
                                <TableRow><TableCell colSpan={4} className="text-center p-20"><Loader2 className="animate-spin h-12 w-12 mx-auto text-indigo-500" /></TableCell></TableRow>
                            ) : requests.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="h-64 text-center text-slate-300 font-black text-2xl uppercase">No Pending Requests</TableCell></TableRow>
                            ) : (
                                requests.map(req => (
                                    <TableRow key={req.id} className="h-32 group transition-all">
                                        <TableCell className="px-12">
                                            <div className="flex flex-col">
                                                <span className="font-black text-2xl tracking-tight">{req.companyName}</span>
                                                <Badge variant="outline" className="bg-white text-indigo-700 font-bold w-fit mt-1">{activityTranslations[req.activity || 'general']}</Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary" className="font-mono text-lg font-black text-primary">@{req.username}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <p className="font-black text-indigo-900">{req.contactName}</p>
                                            <p className="text-xs font-bold text-muted-foreground">{req.phone}</p>
                                            <p className="text-[10px] font-mono text-muted-foreground">{req.email}</p>
                                        </TableCell>
                                        <TableCell className="text-left px-12">
                                            {req.status === 'pending' ? (
                                                <Button 
                                                    onClick={() => handleApproveRequest(req)} 
                                                    disabled={!!isProcessing} 
                                                    className="rounded-2xl font-black gap-2 bg-green-600 hover:bg-green-700 h-12 px-8"
                                                >
                                                    {isProcessing === req.id ? <Loader2 className="animate-spin h-5 w-5"/> : <CheckCircle2 className="h-5 w-5" />} 
                                                    تفعيل وبناء البيئة
                                                </Button>
                                            ) : (
                                                <Badge className="bg-green-100 text-green-700 font-black px-6 py-2 rounded-full border-2 border-green-200">
                                                    ACTIVATED
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}
