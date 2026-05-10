'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirebase, useSubscription } from '@/firebase';
import { doc, updateDoc, collection, orderBy, query, getDocs, where, addDoc, serverTimestamp, runTransaction, Timestamp, deleteField, writeBatch } from 'firebase/firestore';
import type { Company, CompanyRequest, UserProfile } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    PlusCircle, Building2, Search, Loader2, Terminal, Pencil, 
    MoreHorizontal, DatabaseZap, ArrowRightLeft, ShieldCheck, 
    Activity, Users, Clock, CheckCircle2, ShieldAlert, 
    FileStack, Rocket, Key, Copy, AlertCircle, Settings, RefreshCcw, X
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
import { CompanyRegistrationForm } from '@/components/developer/company-registration-form';

const activityTranslations: Record<string, string> = {
    general: 'نشاط تجاري عام',
    food_delivery: 'مطاعم وتوصيل أغذية',
    construction: 'مقاولات وبناء إنشائي',
    consulting: 'استشارات هندسية',
};

export default function DeveloperDashboard() {
  const { firestore, auth: clientAuth } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const { data: rawCompanies, loading: companiesLoading } = useSubscription<Company>(firestore, 'companies', []);
  const { data: requests, loading: requestsLoading } = useSubscription<CompanyRequest>(firestore, 'company_requests', [orderBy('createdAt', 'desc')]);
  
  // اشتراك مجمع للمستخدمين لحساب الحصص
  const { data: allUsers } = useSubscription<UserProfile>(firestore, 'users', [], true);

  const userCountsByCompany = useMemo(() => {
    const counts: Record<string, number> = {};
    (allUsers || []).forEach(u => {
        if (u.companyId) counts[u.companyId] = (counts[u.companyId] || 0) + 1;
    });
    return counts;
  }, [allUsers]);

  const filteredCompanies = useMemo(() => {
    if (!rawCompanies) return [];
    let processed = [...rawCompanies].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        processed = processed.filter(c => c.name.toLowerCase().includes(lower) || c.adminEmail?.toLowerCase().includes(lower));
    }
    return processed;
  }, [rawCompanies, searchQuery]);

  const handleApproveRequest = async (request: any) => {
    if (!firestore || isProcessing) return;
    setIsProcessing(request.id!);
    try {
        const companyId = `comp_${Math.random().toString(36).substring(2, 9)}`;
        const username = request.username || request.email.split('@')[0]; 
        const internalEmail = `${username}@${companyId}.nova`; 

        const authResponse = await fetch('/api/manage-tenant-user', {
            method: 'POST',
            body: JSON.stringify({ email: internalEmail, password: request.adminPassword, displayName: request.contactName, action: 'create' })
        });
        const authResult = await authResponse.json();
        if (!authResult.success && !authResult.simulated) throw new Error(authResult.error);

        await runTransaction(firestore, async (transaction) => {
            const companyRef = doc(firestore, 'companies', companyId);
            transaction.set(companyRef, {
                name: request.companyName, activityType: request.activity || 'general',
                adminEmail: internalEmail, adminPassword: request.adminPassword,
                contactPhone: request.phone, contactEmail: request.email,
                subscriptionType: 'trial', trialEndDate: Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
                maxUsersLimit: 5, isActive: true,
                firebaseConfig: {
                    apiKey: "AIzaSyCX4Zms4_pkTGy0chAJPyF6P6g9XCRAXk8",
                    authDomain: "studio-8039389980-3d2d0.firebaseapp.com",
                    projectId: "studio-8039389980-3d2d0",
                    appId: "1:828494117254:web:d0c31facd0d0bb2f341407",
                },
                createdAt: serverTimestamp()
            });

            const tenantUserRef = doc(firestore, `companies/${companyId}/users`, authResult.uid || 'simulated-uid');
            transaction.set(tenantUserRef, { uid: authResult.uid || 'simulated-uid', email: internalEmail, username: username, fullName: request.contactName, role: 'Admin', isActive: true, companyId: companyId, createdAt: serverTimestamp() });

            const globalUserRef = doc(collection(firestore, 'global_users'));
            transaction.set(globalUserRef, { email: internalEmail, username: username, companyId: companyId, role: 'Admin' });
            transaction.update(doc(firestore, 'company_requests', request.id!), { status: 'approved' });
        });
        toast({ title: 'تم التفعيل' });
    } catch (e: any) { toast({ variant: 'destructive', title: 'فشل التفعيل', description: e.message }); } finally { setIsProcessing(null); }
  };

  const handleRepairAccount = async (company: Company) => {
      if (!firestore || isProcessing) return;
      setIsProcessing(company.id!);
      try {
          const response = await fetch('/api/manage-tenant-user', {
              method: 'POST',
              body: JSON.stringify({ email: company.adminEmail, password: company.adminPassword, displayName: company.name, action: 'repair' })
          });
          const result = await response.json();
          const batch = writeBatch(firestore);
          const globalQuery = query(collection(firestore, 'global_users'), where('email', '==', company.adminEmail));
          const globalSnap = await getDocs(globalQuery);
          if (globalSnap.empty) {
              batch.set(doc(collection(firestore, 'global_users')), { username: company.adminEmail.split('@')[0], email: company.adminEmail, companyId: company.id, role: 'Admin' });
          }
          batch.set(doc(firestore, `companies/${company.id}/users`, result.uid || 'manual-repair'), { uid: result.uid || 'manual-repair', email: company.adminEmail, username: company.adminEmail.split('@')[0], fullName: company.name, role: 'Admin', isActive: true, companyId: company.id, createdAt: serverTimestamp() }, { merge: true });
          await batch.commit();
          toast({ title: 'تم الإصلاح والمزامنة' });
      } finally { setIsProcessing(null); }
  };

  const handleSwitchToCompany = async (company: Company) => {
    if (!firestore || !currentUser || isProcessing) return;
    setIsProcessing(company.id!);
    try {
        const response = await fetch('/api/switch-company', {
            method: 'POST',
            body: JSON.stringify({ uid: currentUser.id, companyId: company.id, companyName: company.name })
        });
        const result = await response.json();
        if (clientAuth?.currentUser) await clientAuth.currentUser.getIdToken(true);
        toast({ title: 'تم التقمص السيادي' });
        router.push('/dashboard');
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
                            <CardTitle className="text-4xl font-black text-white tracking-tighter">غرفة التحكم السيادية</CardTitle>
                            <CardDescription className="text-indigo-200 font-bold text-lg opacity-80 mt-1">إدارة المنظمات والتراخيص.</CardDescription>
                        </div>
                    </div>
                    <Button onClick={() => { setSelectedCompany(null); setIsFormOpen(true); }} className="h-14 px-10 rounded-2xl font-black text-xl gap-3 shadow-2xl bg-indigo-600 hover:bg-indigo-700">
                        <PlusCircle className="h-6 w-6" /> تأسيس منشأة جديدة
                    </Button>
                </div>
            </CardHeader>
        </Card>

        <Tabs defaultValue="companies" className="space-y-8">
            <TabsList className="bg-indigo-950/40 p-1.5 rounded-3xl border border-white/10 backdrop-blur-xl h-16 w-fit mx-auto flex gap-4">
                <TabsTrigger value="companies" className="rounded-2xl px-10 font-black text-lg gap-2 data-[state=active]:bg-indigo-600"><Building2 className="h-5 w-5"/> المنظمات</TabsTrigger>
                <TabsTrigger value="requests" className="rounded-2xl px-10 font-black text-lg gap-2 data-[state=active]:bg-indigo-600"><FileStack className="h-5 w-5"/> الطلبات</TabsTrigger>
            </TabsList>

            <TabsContent value="companies">
                <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-white/95">
                    <CardHeader className="bg-slate-50 border-b p-8 px-12">
                        <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-950 opacity-40" /><Input placeholder="بحث باسم المنشأة..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12 rounded-2xl bg-white border-2 border-indigo-100 font-bold" /></div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-[#1e1b4b]"><TableRow className="border-none"><TableHead className="px-12 font-black text-white text-right">المنظمة</TableHead><TableHead className="font-black text-indigo-100 text-center">التواصل</TableHead><TableHead className="font-black text-indigo-100 text-center">الحصة</TableHead><TableHead className="font-black text-indigo-100 text-center">الحالة</TableHead><TableHead className="text-left px-12 font-black text-indigo-100">إجراءات</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {companiesLoading ? <TableRow><TableCell colSpan={5} className="text-center p-20"><Loader2 className="animate-spin h-12 w-12 mx-auto text-indigo-500" /></TableCell></TableRow> :
                                filteredCompanies.map(company => (
                                    <TableRow key={company.id} className="h-28 border-slate-100 group transition-all">
                                        <TableCell className="px-12"><div className="flex items-center gap-4"><div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><Building2 className="h-6 w-6" /></div><div className="flex flex-col"><span className="font-black text-xl text-[#1e1b4b]">{company.name}</span><span className="font-mono text-xs text-primary font-black">@{company.adminEmail?.split('@')[0]}</span></div></div></TableCell>
                                        <TableCell className="text-center"><p className="font-bold text-slate-700">{company.contactPhone || '-'}</p></TableCell>
                                        <TableCell className="text-center font-black text-xl text-indigo-950">{userCountsByCompany[company.id!] || 0} / {company.maxUsersLimit || 0}</TableCell>
                                        <TableCell className="text-center"><Badge className={cn("px-6 py-1.5 rounded-full font-black text-[10px] border-2", company.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>{company.isActive ? 'ACTIVE' : 'LOCKED'}</Badge></TableCell>
                                        <TableCell className="text-left px-12">
                                            <div className="flex items-center justify-end gap-3">
                                                <Button onClick={() => handleSwitchToCompany(company)} variant="outline" className="rounded-xl font-bold h-10 gap-2">{isProcessing === company.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <ArrowRightLeft className="h-4 w-4"/>} دخول</Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-slate-50 border"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" dir="rtl" className="w-56 rounded-2xl p-2 shadow-2xl"><DropdownMenuItem onClick={() => { setSelectedCompany(company); setIsFormOpen(true); }} className="rounded-xl py-3 font-bold gap-3"><Settings className="h-4 w-4 text-indigo-600" /> تعديل الترخيص</DropdownMenuItem><DropdownMenuItem onClick={() => handleRepairAccount(company)} className="rounded-xl py-3 font-black gap-3 text-blue-600"><RefreshCcw className="h-4 w-4" /> إصلاح ومزامنة</DropdownMenuItem></DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="requests">
                <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-white/95">
                    <Table>
                        <TableHeader className="bg-[#1e1b4b] h-16"><TableRow className="border-none"><TableHead className="px-12 font-black text-white text-right">المنظمة</TableHead><TableHead className="font-black text-indigo-100 text-center">المستخدم</TableHead><TableHead className="text-left px-12 font-black text-indigo-100">القرار</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {requests.map(req => (
                                <TableRow key={req.id} className="h-32"><TableCell className="px-12"><div className="flex flex-col"><span className="font-black text-2xl tracking-tight">{req.companyName}</span><Badge variant="outline" className="bg-white text-indigo-700 font-bold w-fit mt-1">{activityTranslations[req.activity || 'general']}</Badge></div></TableCell><TableCell className="text-center"><Badge variant="secondary" className="font-mono text-lg font-black text-primary">@{req.email.split('@')[0]}</Badge></TableCell><TableCell className="text-left px-12">{req.status === 'pending' ? <Button onClick={() => handleApproveRequest(req)} disabled={!!isProcessing} className="rounded-2xl font-black gap-2 bg-green-600 h-12 px-8 shadow-lg">تفعيل البيئة</Button> : <Badge className="bg-green-100 text-green-700 font-black px-6 py-2 rounded-full">ACTIVATED</Badge>}</TableCell></TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            </TabsContent>
        </Tabs>
        <CompanyRegistrationForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} company={selectedCompany} />
    </div>
  );
}
