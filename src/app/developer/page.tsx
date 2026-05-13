
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirebase, useSubscription } from '@/firebase';
import { doc, collection, orderBy, query, getDocs, where, writeBatch, serverTimestamp, deleteDoc, Timestamp } from 'firebase/firestore';
import type { Company, CompanyRequest } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    PlusCircle, Building2, Search, Loader2, Terminal, 
    MoreHorizontal, ArrowRightLeft, 
    FileStack, Settings, Trash2, ShieldAlert, Sparkles, CheckCircle2
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CompanyRegistrationForm } from '@/components/developer/company-registration-form';
import { addDays } from 'date-fns';

const activityTranslations: Record<string, string> = {
    general: 'نشاط تجاري عام',
    food_delivery: 'مطاعم وتوصيل أغذية',
    construction: 'مقاولات وبناء إنشائي',
    consulting: 'استشارات هندسية',
};

// 🛡️ المصفوفة السحابية الماستر لحقن الشركات الجديدة
const MASTER_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCX4Zms4_pkTGy0chAJPyF6P6g9XCRAXk8",
  authDomain: "studio-8039389980-3d2d0.firebaseapp.com",
  projectId: "studio-8039389980-3d2d0",
  storageBucket: "studio-8039389980-3d2d0.firebasestorage.app",
  messagingSenderId: "828494117254",
  appId: "1:828494117254:web:d0c31facd0d0bb2f341407",
  measurementId: "G-Q7DPZ802VJ"
};

export default function DeveloperDashboard() {
  const { firestore, auth: clientAuth } = useFirebase();
  const { user: currentUser } = useAuth() as any;
  const { toast } = useToast();
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  const { data: rawCompanies, loading: companiesLoading } = useSubscription<Company>(firestore, 'companies', []);
  const { data: requests, loading: requestsLoading } = useSubscription<CompanyRequest>(firestore, 'company_requests', [orderBy('createdAt', 'desc')]);

  const filteredCompanies = useMemo(() => {
    if (!rawCompanies) return [];
    let processed = [...rawCompanies].sort((a, b) => {
        const timeB = (b.createdAt as any)?.toMillis?.() || 0;
        const timeA = (a.createdAt as any)?.toMillis?.() || 0;
        return timeB - timeA;
    });
    if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        processed = processed.filter(c => c.name.toLowerCase().includes(lower) || c.adminEmail?.toLowerCase().includes(lower));
    }
    return processed;
  }, [rawCompanies, searchQuery]);

  const handleSwitchToCompany = async (company: Company) => {
    if (!firestore || !currentUser || isProcessing) return;
    setIsProcessing(company.id!);
    try {
        await fetch('/api/switch-company', {
            method: 'POST',
            body: JSON.stringify({ uid: currentUser.id, companyId: company.id, companyName: company.name })
        });
        if (clientAuth?.currentUser) await clientAuth.currentUser.getIdToken(true);
        toast({ title: 'تم التقمص السيادي بنجاح' });
        router.push('/dashboard');
    } catch (e) {
        toast({ variant: 'destructive', title: 'فشل التقمص' });
    } finally { setIsProcessing(null); }
  };

  /**
   * محرك التفعيل السيادي الموحد (The Final Unification Logic)
   */
  const handleActivateCompany = async (req: CompanyRequest) => {
    if (!firestore || isProcessing) return;
    setIsProcessing(req.id!);
    try {
      // 1. توليد هوية سيادية نظيفة وموحدة
      const companyId = `comp-${Math.random().toString(36).substring(2, 9)}`;
      const safeUsername = req.username?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'admin';
      const sovereignEmail = `${safeUsername}@${companyId}.nova`;

      // 2. إنشاء حساب الأمان (Auth) عبر الـ API
      const createRes = await fetch('/api/manage-tenant-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: sovereignEmail, 
          password: req.adminPassword, 
          displayName: req.contactName, 
          action: 'create' 
        })
      });
      
      const authResult = await createRes.json();
      if (!authResult.success) throw new Error(authResult.error);

      const batch = writeBatch(firestore);
      const companyRef = doc(firestore, 'companies', companyId);
      const trialEndDate = addDays(new Date(), 7);

      // 3. إنشاء وثيقة الشركة مع حقن المصفوفة آلياً
      batch.set(companyRef, {
        name: req.companyName,
        activity: req.activity,
        adminEmail: sovereignEmail,
        adminPassword: req.adminPassword,
        contactPhone: req.phone,
        isActive: true,
        subscriptionType: 'trial',
        trialEndDate: Timestamp.fromDate(trialEndDate),
        maxUsersLimit: 5,
        firebaseProjectId: MASTER_FIREBASE_CONFIG.projectId,
        firebaseConfig: MASTER_FIREBASE_CONFIG,
        createdAt: serverTimestamp(),
      });

      // 4. إنشاء المستخدم الإداري داخل الشركة
      const userRef = doc(firestore, `companies/${companyId}/users`, authResult.uid);
      batch.set(userRef, {
        id: authResult.uid,
        uid: authResult.uid,
        fullName: req.contactName,
        email: sovereignEmail,
        username: safeUsername,
        role: 'Admin',
        isActive: true,
        companyId: companyId,
        createdAt: serverTimestamp()
      });

      // 5. الربط بالفهرس العالمي (المفتاح الذهبي للدخول)
      const globalRef = doc(collection(firestore, 'global_users'));
      batch.set(globalRef, {
        email: sovereignEmail,
        username: safeUsername,
        companyId: companyId,
        uid: authResult.uid,
        createdAt: serverTimestamp(),
      });

      // 6. تحديث حالة الطلب
      batch.update(doc(firestore, 'company_requests', req.id!), { 
        status: 'activated',
        activatedAt: serverTimestamp(),
        companyId: companyId 
      });

      await batch.commit();
      toast({ 
        title: '✅ تم تفعيل البيئة السيادية', 
        description: `المنشأة جاهزة للدخول بإيميل: ${sovereignEmail}` 
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'فشل التفعيل', description: e.message });
    } finally { setIsProcessing(null); }
  };

  const handleDeleteCompany = async () => {
    if (!firestore || !companyToDelete || isProcessing) return;
    setIsProcessing(companyToDelete.id!);
    try {
        const batch = writeBatch(firestore);
        batch.delete(doc(firestore, 'companies', companyToDelete.id!));
        const gQuery = query(collection(firestore, 'global_users'), where('companyId', '==', companyToDelete.id));
        const gSnap = await getDocs(gQuery);
        gSnap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        toast({ title: '✅ تم إنهاء السيادة', description: `تم حذف منشأة ${companyToDelete.name} نهائياً.` });
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ في الحذف' });
    } finally { setIsProcessing(null); setCompanyToDelete(null); }
  };

  return (
    <div className="space-y-10" dir="rtl">
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-[#1e1b4b]">
            <CardHeader className="p-10 pb-8 bg-indigo-950/60 border-b border-white/10">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-600 rounded-[2.2rem] shadow-[0_0_40px_rgba(79,70,229,0.4)] border-2 border-white/20"><Terminal className="h-10 w-10 text-white" /></div>
                        <div className="text-right">
                            <CardTitle className="text-4xl font-black text-white tracking-tighter">غرفة التحكم السيادية</CardTitle>
                            <CardDescription className="text-indigo-200 font-bold text-lg opacity-80 mt-1">إدارة المنظمات، التراخيص، والحماية السحابية.</CardDescription>
                        </div>
                    </div>
                    <Button onClick={() => { setSelectedCompany(null); setIsFormOpen(true); }} className="h-14 px-10 rounded-2xl font-black text-xl gap-3 shadow-2xl bg-indigo-600 hover:bg-indigo-700">
                        <PlusCircle className="h-6 w-6" /> تأسيس منشأة جديدة
                    </Button>
                </div>
            </CardHeader>
        </Card>

        <Tabs defaultValue="companies" className="space-y-8">
            <TabsList className="bg-indigo-950/40 p-1.5 rounded-3xl border border-white/10 h-16 w-fit mx-auto flex gap-4">
                <TabsTrigger value="companies" className="rounded-2xl px-10 font-black text-lg gap-2 data-[state=active]:bg-indigo-600"><Building2 className="h-5 w-5"/> المنظمات</TabsTrigger>
                <TabsTrigger value="requests" className="rounded-2xl px-10 font-black text-lg gap-2 data-[state=active]:bg-indigo-600"><FileStack className="h-5 w-5"/> طلبات الانضمام</TabsTrigger>
            </TabsList>

            <TabsContent value="companies">
                <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-white/95">
                    <CardHeader className="bg-slate-50 border-b p-8 px-12">
                        <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-950 opacity-40" /><Input placeholder="بحث باسم المنشأة..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12 rounded-2xl bg-white border-2 border-indigo-100 font-bold" /></div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-[#1e1b4b]"><TableRow className="border-none"><TableHead className="px-12 font-black text-white text-right">المنظمة</TableHead><TableHead className="font-black text-indigo-100 text-center">التواصل</TableHead><TableHead className="font-black text-indigo-100 text-center">الحالة</TableHead><TableHead className="text-left px-12 font-black text-indigo-100">إجراءات</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {companiesLoading ? <TableRow><TableCell colSpan={4} className="text-center p-20"><Loader2 className="animate-spin h-12 w-12 mx-auto text-indigo-50" /></TableCell></TableRow> :
                                filteredCompanies.map(company => (
                                    <TableRow key={company.id} className="h-28 border-slate-100 group transition-all">
                                        <TableCell className="px-12"><div className="flex items-center gap-4"><div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><Building2 className="h-6 w-6" /></div><div className="flex flex-col"><span className="font-black text-xl text-[#1e1b4b]">{company.name}</span><span className="font-mono text-xs text-primary font-black">@{company.adminEmail?.split('@')[0]}</span></div></div></TableCell>
                                        <TableCell className="text-center"><p className="font-bold text-slate-700">{company.contactPhone || '-'}</p></TableCell>
                                        <TableCell className="text-center"><Badge className={cn("px-6 py-1.5 rounded-full font-black text-[10px] border-2", company.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>{company.isActive ? 'ACTIVE' : 'LOCKED'}</Badge></TableCell>
                                        <TableCell className="text-left px-12">
                                            <div className="flex items-center justify-end gap-3">
                                                <Button onClick={() => handleSwitchToCompany(company)} variant="outline" className="rounded-xl font-bold h-10 gap-2">{isProcessing === company.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <ArrowRightLeft className="h-4 w-4"/>} دخول</Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-slate-50 border"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" dir="rtl" className="w-56 rounded-2xl p-2 shadow-2xl"><DropdownMenuItem onClick={() => { setSelectedCompany(company); setIsFormOpen(true); }} className="rounded-xl py-3 font-bold gap-3"><Settings className="h-4 w-4 text-indigo-600" /> تعديل الترخيص</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setCompanyToDelete(company)} className="text-red-600 rounded-xl py-3 font-bold gap-3"><Trash2 className="h-4 w-4" /> حذف المنشأة نهائياً</DropdownMenuItem></DropdownMenuContent>
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
                                <TableRow key={req.id} className="h-32">
                                    <TableCell className="px-12"><div className="flex flex-col"><span className="font-black text-2xl tracking-tight">{req.companyName}</span><Badge variant="outline" className="bg-white text-indigo-700 font-bold w-fit mt-1">{activityTranslations[req.activity || 'general']}</Badge></div></TableCell>
                                    <TableCell className="text-center"><Badge variant="secondary" className="font-mono text-lg font-black text-primary">@{req.username || req.email.split('@')[0]}</Badge></TableCell>
                                    <TableCell className="text-left px-12">
                                        {req.status === 'pending' ? (
                                            <Button 
                                                onClick={() => handleActivateCompany(req)} 
                                                disabled={isProcessing === req.id} 
                                                className="rounded-2xl font-black gap-2 bg-green-600 h-12 px-8 shadow-lg"
                                            >
                                                {isProcessing === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle2 className="h-4 w-4" />} 
                                                تفعيل البيئة
                                            </Button>
                                        ) : <Badge className="bg-green-100 text-green-700 font-black px-6 py-2 rounded-full">ACTIVATED</Badge>}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            </TabsContent>
        </Tabs>
        <CompanyRegistrationForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} company={selectedCompany} />
        <AlertDialog open={!!companyToDelete} onOpenChange={() => setCompanyToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-[2.5rem] border-none shadow-2xl p-10">
                <AlertDialogHeader>
                    <div className="p-3 bg-red-100 rounded-2xl text-red-600 w-fit mb-4"><ShieldAlert className="h-10 w-10"/></div>
                    <AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد الإنهاء السيادي؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-lg font-medium leading-relaxed">أنت على وشك حذف منشأة <strong>"{companyToDelete?.name}"</strong> بالكامل. <br/><br/> <span className="font-black text-red-600 underline">تحذير: لا يمكن استعادة هذه المنشأة بعد الحذف.</span></AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2">تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteCompany} disabled={!!isProcessing} className="bg-destructive hover:bg-destructive/90 rounded-xl font-black h-12 px-12"> {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : 'نعم، قم بالإنهاء والحذف'} </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
