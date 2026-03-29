
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirebase, useSubscription } from '@/firebase';
import { doc, updateDoc, collection, orderBy, query, getDocs, where, addDoc, serverTimestamp, runTransaction, Timestamp } from 'firebase/firestore';
import type { Company, CompanyRequest } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
    PlusCircle, Building2, Search, Loader2, Terminal, Pencil, 
    MoreHorizontal, DatabaseZap, ArrowRightLeft, ShieldCheck, 
    Activity, Users, Clock, Timer, CheckCircle2, ShieldAlert, 
    FileStack, Rocket, XCircle, Key, Copy 
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn, cleanFirestoreData } from '@/lib/utils';
import { CompanyRegistrationForm } from '@/components/developer/company-registration-form';
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
import { format, isPast, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';

const activityTranslations: Record<string, string> = {
    general: 'تجاري عام',
    food_delivery: 'مطاعم وأغذية',
    construction: 'مقاولات وبناء',
    consulting: 'استشارات هندسية',
};

export default function DeveloperDashboard() {
  const { firestore, auth: clientAuth } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [selectedCompanyForEdit, setSelectedCompanyForEdit] = useState<Company | null>(null);
  
  const [usersUsage, setUsersUsage] = useState<Record<string, number>>({});

  const { data: rawCompanies, loading } = useSubscription<Company>(firestore, 'companies', []);
  const { data: requests, loading: requestsLoading } = useSubscription<CompanyRequest>(firestore, 'company_requests', [orderBy('createdAt', 'desc')]);

  // محرك رصد استهلاك التراخيص (License Usage Radar)
  useEffect(() => {
    if (!firestore || rawCompanies.length === 0) return;
    
    const fetchUsage = async () => {
        const usageMap: Record<string, number> = {};
        // استعلام سيادي لفحص عدد المستخدمين في كل منشأة عبر الفهرس العالمي
        const globalUsersSnap = await getDocs(collection(firestore, 'global_users'));
        globalUsersSnap.forEach(d => {
            const companyId = d.data().companyId;
            usageMap[companyId] = (usageMap[companyId] || 0) + 1;
        });
        setUsersUsage(usageMap);
    };
    fetchUsage();
  }, [firestore, rawCompanies]);

  const filteredCompanies = useMemo(() => {
    if (!rawCompanies) return [];
    
    let processed = [...rawCompanies].sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
    });

    if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        processed = processed.filter(c => 
            c.name.toLowerCase().includes(lower) || 
            c.adminEmail?.toLowerCase().includes(lower)
        );
    }
    
    return processed;
  }, [rawCompanies, searchQuery]);

  const handleApproveRequest = async (request: CompanyRequest) => {
    if (!firestore || isProcessing) return;
    setIsProcessing(request.id!);
    
    try {
        // 🛡️ 1. إنشاء الحساب في خادم الأمان (Firebase Auth) أولاً
        const authResponse = await fetch('/api/manage-tenant-user', {
            method: 'POST',
            body: JSON.stringify({
                email: request.email,
                password: request.adminPassword,
                displayName: request.contactName,
                action: 'create'
            })
        });
        const authResult = await authResponse.json();
        if (!authResult.success) throw new Error(authResult.error);

        const companyId = `comp_${Math.random().toString(36).substring(2, 9)}`;
        const trialEndDate = addDays(new Date(), 14);

        await runTransaction(firestore, async (transaction) => {
            const companyRef = doc(firestore, 'companies', companyId);
            
            // 2. تأسيس المنشأة الرئيسية
            transaction.set(companyRef, {
                name: request.companyName,
                activityType: request.activity,
                adminEmail: request.email.toLowerCase().trim(),
                adminPassword: request.adminPassword,
                subscriptionType: 'trial',
                trialEndDate: Timestamp.fromDate(trialEndDate),
                maxUsersLimit: 5, // حصة تجريبية افتراضية
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

            // 🛡️ 3. التأسيس الهيكلي: إنشاء الموظف/المدير الأول داخل مجلد الشركة حصراً
            const tenantUserRef = doc(firestore, `companies/${companyId}/users`, authResult.uid);
            transaction.set(tenantUserRef, {
                uid: authResult.uid,
                email: request.email.toLowerCase().trim(),
                username: request.email.split('@')[0],
                fullName: request.contactName,
                role: 'Admin',
                isActive: true,
                companyId: companyId,
                createdAt: serverTimestamp()
            });

            // 4. تحديث الفهرس العالمي للتوجيه السريع عند الدخول
            const globalUserRef = doc(collection(firestore, 'global_users'));
            transaction.set(globalUserRef, {
                email: request.email.toLowerCase().trim(),
                username: request.email.split('@')[0],
                companyId: companyId,
                role: 'Admin'
            });

            // 5. إغلاق الطلب
            transaction.update(doc(firestore, 'company_requests', request.id!), { status: 'approved' });
        });

        toast({ title: 'تم التفعيل الهيكلي', description: `تم تأسيس منشأة "${request.companyName}" وحفظ حساب المالك داخل هيكلها المعزول بنجاح.` });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'فشل التفعيل', description: e.message });
    } finally {
        setIsProcessing(null);
    }
  };

  const handleSwitchToCompany = async (company: Company) => {
    if (!firestore || !currentUser || isProcessing) return;
    setIsProcessing(company.id!);
    try {
        const response = await fetch('/api/switch-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: currentUser.id,
                companyId: company.id,
                companyName: company.name
            })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        // تحديث التوكين السيادي لتبديل الجلسة فوراً
        if (clientAuth?.currentUser) {
            await clientAuth.currentUser.getIdToken(true);
        }

        toast({ title: 'نجاح التقمص الإداري', description: `تم تحويل الجلسة إلى منشأة ${company.name} بنجاح.` });
        router.push('/dashboard');
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'فشل التبديل', description: e.message });
    } finally {
        setIsProcessing(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'تم النسخ', description: 'تم نسخ بيانات الدخول للعهدة.' });
  };

  return (
    <div className="space-y-10" dir="rtl">
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-[#1e1b4b]">
            <CardHeader className="p-10 pb-8 bg-indigo-950/60 border-b border-white/10">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-600 rounded-[2.2rem] shadow-[0_0_40px_rgba(79,70,229,0.5)] border-2 border-white/20">
                            <Terminal className="h-10 w-10 text-white" />
                        </div>
                        <div className="text-right">
                            <CardTitle className="text-4xl font-black text-white tracking-tighter">غرفة التحكم الكبرى</CardTitle>
                            <CardDescription className="text-indigo-200 font-bold text-lg opacity-80 mt-1">إدارة البنية التحتية، مراجعة طلبات الانضمام، ومزامنة التراخيص السحابية.</CardDescription>
                        </div>
                    </div>
                    <Badge className="bg-green-500 text-white font-black px-6 py-1.5 rounded-full border-2 border-white/20 shadow-lg animate-pulse uppercase tracking-widest">Master Node: Active</Badge>
                </div>
            </CardHeader>
        </Card>

        <Tabs defaultValue="companies" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <TabsList className="bg-indigo-950/40 p-1.5 rounded-3xl border border-white/10 backdrop-blur-xl h-16 w-fit mx-auto flex gap-4">
                <TabsTrigger value="companies" className="rounded-2xl px-10 font-black text-lg gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                    <Building2 className="h-5 w-5"/> المنشآت النشطة
                </TabsTrigger>
                <TabsTrigger value="requests" className="rounded-2xl px-10 font-black text-lg gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white relative">
                    <FileStack className="h-5 w-5"/> طلبات الانضمام
                    {requests.filter(r => r.status === 'pending').length > 0 && (
                        <span className="absolute -top-1 -right-1 h-6 w-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-black animate-bounce shadow-lg">
                            {requests.filter(r => r.status === 'pending').length}
                        </span>
                    )}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="companies">
                <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-white/95">
                    <CardHeader className="p-10 border-b-4 border-[#1e1b4b] bg-slate-50">
                        <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                            <div className="relative w-full max-w-xl">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-indigo-600" />
                                <Input 
                                    placeholder="بحث سيادي في قائمة المنشآت..." 
                                    value={searchQuery} 
                                    onChange={e => setSearchQuery(e.target.value)} 
                                    className="pl-14 h-14 rounded-3xl border-2 border-slate-200 text-black font-black text-xl shadow-inner focus:ring-4 focus:ring-indigo-100 transition-all"
                                />
                            </div>
                            <Button onClick={() => { setSelectedCompanyForEdit(null); setIsRegistrationOpen(true); }} className="h-14 px-12 rounded-[2rem] font-black text-xl gap-3 bg-[#1e1b4b] text-white hover:bg-black shadow-2xl transition-all">
                                <PlusCircle className="h-6 w-6" /> إضافة وتأسيس منشأة
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-[#1e1b4b] h-16">
                                <TableRow className="border-none">
                                    <TableHead className="px-12 font-black text-white text-base text-right">المنشأة وبيانات الدخول</TableHead>
                                    <TableHead className="font-black text-indigo-100 text-base text-center">الاشتراك</TableHead>
                                    <TableHead className="font-black text-indigo-100 text-base text-center">الحصة</TableHead>
                                    <TableHead className="font-black text-indigo-100 text-base text-center">الحالة</TableHead>
                                    <TableHead className="text-left px-12 font-black text-indigo-100 text-base">التحكم</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={5} className="text-center p-20"><Loader2 className="animate-spin h-12 w-12 mx-auto text-indigo-500" /></TableCell></TableRow>
                                ) : filteredCompanies.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-64 text-center text-slate-300 font-black text-2xl uppercase">No Entities Found</TableCell></TableRow>
                                ) : (
                                    filteredCompanies.map(company => {
                                        const trialDate = toFirestoreDate(company.trialEndDate);
                                        const isExpired = trialDate && isPast(trialDate) && company.subscriptionType === 'trial';
                                        return (
                                            <TableRow key={company.id} className={cn("h-36 hover:bg-indigo-50/50 border-slate-100 group transition-all", isExpired && "bg-red-50/30")}>
                                                <TableCell className="px-12">
                                                    <div className="flex items-center gap-6">
                                                        <div className="p-4 bg-indigo-100 rounded-3xl border-2 border-indigo-200 group-hover:bg-[#1e1b4b] transition-all">
                                                            <Building2 className="h-10 w-10 text-indigo-600 group-hover:text-white" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-black text-2xl tracking-tight">{company.name}</span>
                                                            <div className="flex flex-col gap-1 mt-2">
                                                                <div className="flex items-center gap-2 bg-indigo-50/50 px-3 py-1 rounded-xl border border-indigo-100 w-fit">
                                                                    <Key className="h-3 w-3 text-indigo-600" />
                                                                    <span className="text-[10px] font-black text-indigo-900">{company.adminEmail}</span>
                                                                    <Separator orientation="vertical" className="h-3 bg-indigo-200" />
                                                                    <span className="text-[10px] font-black text-indigo-600 font-mono">{company.adminPassword || '****'}</span>
                                                                    <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-indigo-100" onClick={() => copyToClipboard(`Email: ${company.adminEmail}\nPassword: ${company.adminPassword}`)}>
                                                                        <Copy className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                                <Badge variant="outline" className="bg-white text-indigo-700 font-bold text-[9px] w-fit">{activityTranslations[company.activityType || 'general']}</Badge>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className={cn("px-4 py-1 rounded-full font-black text-[9px] tracking-widest", company.subscriptionType === 'trial' ? (isExpired ? "bg-red-600" : "bg-orange-500") : "bg-indigo-600")}>
                                                        {company.subscriptionType === 'trial' ? `DEMO (${isExpired ? 'EXPIRED' : 'ACTIVE'})` : 'PREMIUM'}
                                                    </Badge>
                                                    {trialDate && <p className="text-[10px] font-bold mt-1 text-muted-foreground">ينتهي: {format(trialDate, 'dd/MM/yyyy')}</p>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="font-black text-xl text-indigo-950">{usersUsage[company.id!] || 0} / {company.maxUsersLimit}</div>
                                                    <span className="text-[9px] font-black text-muted-foreground uppercase">Users Quota</span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className={cn("px-6 py-1.5 rounded-full font-black text-[10px] border-2", company.isActive && !isExpired ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')}>
                                                        {company.isActive && !isExpired ? 'ACTIVE' : 'LOCKED'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-left px-12">
                                                    <div className="flex justify-end gap-4 opacity-0 group-hover:opacity-100 transition-all">
                                                        <Button onClick={() => handleSwitchToCompany(company)} disabled={isProcessing === company.id} className="rounded-2xl font-black gap-3 bg-indigo-600 text-white hover:bg-indigo-700 h-12 shadow-xl border-b-4 border-indigo-900">
                                                            {isProcessing === company.id ? <Loader2 className="h-5 w-5 animate-spin"/> : <ArrowRightLeft className="h-5 w-5" />}
                                                            التحكم السيادي
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-white border-2 shadow-md" onClick={() => { setSelectedCompanyForEdit(company); setIsRegistrationOpen(true); }}><Pencil className="h-6 w-6" /></Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
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
                                <TableHead className="px-12 font-black text-white text-base text-right">الطلب والمنشأة</TableHead>
                                <TableHead className="font-black text-indigo-100 text-base text-center">التاريخ</TableHead>
                                <TableHead className="font-black text-indigo-100 text-base text-center">البيانات</TableHead>
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
                                    <TableRow key={req.id} className="h-32 hover:bg-indigo-50/50 border-slate-100 group transition-all">
                                        <TableCell className="px-12">
                                            <div className="flex items-center gap-6">
                                                <div className="p-4 bg-orange-100 rounded-3xl text-orange-600">
                                                    <Rocket className="h-8 w-8" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-black text-2xl tracking-tight">{req.companyName}</span>
                                                    <Badge variant="outline" className="bg-white text-indigo-700 font-bold w-fit mt-1">{activityTranslations[req.activity || 'general']}</Badge>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-muted-foreground">
                                            {req.createdAt ? format(toFirestoreDate(req.createdAt)!, 'dd/MM/yyyy', { locale: ar }) : '-'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <p className="font-black text-indigo-900">{req.contactName}</p>
                                            <p className="text-xs font-mono">{req.email}</p>
                                            <div className="flex items-center justify-center gap-2 mt-1">
                                                <Badge variant="secondary" className="font-mono text-[9px]">{req.adminPassword}</Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-left px-12">
                                            <div className="flex justify-end gap-3">
                                                {req.status === 'pending' ? (
                                                    <Button onClick={() => handleApproveRequest(req)} disabled={isProcessing === req.id} className="rounded-2xl font-black gap-2 bg-green-600 hover:bg-green-700 h-12 px-8 shadow-xl shadow-green-100 border-b-4 border-green-900">
                                                        {isProcessing === req.id ? <Loader2 className="animate-spin h-5 w-5"/> : <CheckCircle2 className="h-5 w-5" />} اعتماد وتفعيل هيكل المجلدات
                                                    </Button>
                                                ) : (
                                                    <Badge className="bg-green-100 text-green-700 font-black px-6 py-2 rounded-full border-2 border-green-200">STRUCTURE ESTABLISHED</Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </TabsContent>
        </Tabs>

        <CompanyRegistrationForm isOpen={isRegistrationOpen} onClose={() => setIsRegistrationOpen(false)} company={selectedCompanyForEdit} />
    </div>
  );
}
