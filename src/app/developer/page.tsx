
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useFirebase, useSubscription } from '@/firebase';
import { 
    doc, 
    collection, 
    writeBatch, 
    serverTimestamp, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    deleteDoc,
    updateDoc,
    getDoc
} from 'firebase/firestore';
import type { Company, CompanyRequest, UserProfile } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    PlusCircle, Building2, Search, Loader2, Terminal, 
    MoreHorizontal, Trash2, CheckCircle2,
    Activity, UserPlus, ShieldCheck, Pencil, Sparkles, Wallet,
    X, History, Settings2, Key, Zap, Lock, Rocket,
    ArrowRight,
    RefreshCcw,
    FileText
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn, getTenantPath, generateStableId } from '@/lib/utils';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { CompanyRegistrationForm } from '@/components/developer/company-registration-form';
import { DeveloperHub } from '@/components/developer/developer-hub';
import { PermissionsMatrix } from '@/components/developer/permissions-matrix';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';

export default function DeveloperDashboard() {
  const { firestore, auth } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMainTab, setActiveMainTab] = useState('entities');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // --- حالات التفعيل والتحرير ---
  const [requestToActivate, setRequestToActivate] = useState<CompanyRequest | null>(null);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState<Company | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  // 🛡️ جلب كافة المنشآت والطلبات دون استثناء لضمان ظهور الأرشيف 🛡️
  const { data: companies, loading: companiesLoading } = useSubscription<Company>(firestore, 'companies');
  const { data: requests, loading: requestsLoading } = useSubscription<CompanyRequest>(firestore, 'company_requests', [orderBy('createdAt', 'desc')]);

  const filteredCompanies = useMemo(() => {
    if (!companies) return [];
    return [...companies].sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime() || 0;
        const timeB = b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime() || 0;
        return timeB - timeA;
    }).filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [companies, searchQuery]);

  const filteredRequests = useMemo(() => {
      if (!requests) return [];
      if (!searchQuery) return requests;
      const lower = searchQuery.toLowerCase();
      return requests.filter(r => 
        r.companyName.toLowerCase().includes(lower) || 
        r.contactName.toLowerCase().includes(lower)
      );
  }, [requests, searchQuery]);

  const handleDeleteCompany = async () => {
    if (!firestore || !companyToDelete) return;
    setIsProcessing('deleting');
    try {
        const batch = writeBatch(firestore);
        batch.delete(doc(firestore, 'companies', companyToDelete.id!));
        
        // تطهير الفهرس العالمي للمستخدمين المرتبطين بهذه المنشأة
        const globalUsersQuery = query(collection(firestore, 'global_users'), where('companyId', '==', companyToDelete.id));
        const globalUsersSnap = await getDocs(globalUsersQuery);
        globalUsersSnap.forEach(d => batch.delete(d.ref));
        
        await batch.commit();
        toast({ title: '✅ تم مسح المنشأة وتطهير السجلات' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'فشل الحذف', description: e.message });
    } finally {
        setIsProcessing(null);
        setCompanyToDelete(null);
    }
  };

  const handleActivateRequest = async () => {
    if (!firestore || !auth?.currentUser || !requestToActivate) return;
    setIsProcessing('activating');
    try {
        const idToken = await auth.currentUser.getIdToken();
        const companyId = `comp-${generateStableId()}`;
        const tempPassword = `Nova@${Math.floor(1000 + Math.random() * 9000)}`;
        
        const response = await fetch('/api/manage-tenant-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ 
                action: 'create_tenant_user', 
                companyId, 
                email: requestToActivate.email, 
                password: tempPassword, 
                displayName: requestToActivate.contactName, 
                username: requestToActivate.username, 
                role: 'Admin' 
            })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        const batch = writeBatch(firestore);
        const companyRef = doc(firestore, 'companies', companyId);
        
        batch.set(companyRef, { 
            name: requestToActivate.companyName, 
            adminEmail: requestToActivate.email.toLowerCase().trim(), 
            adminUsername: requestToActivate.username, 
            activityType: requestToActivate.activity, 
            status: 'active', 
            subscriptionType: 'trial', 
            maxUsersLimit: 5, 
            createdAt: serverTimestamp(), 
            updatedAt: serverTimestamp() 
        });

        const requestRef = doc(firestore, 'company_requests', requestToActivate.id!);
        batch.update(requestRef, { 
            status: 'activated', 
            activatedAt: serverTimestamp(), 
            targetCompanyId: companyId 
        });

        await batch.commit();
        toast({ title: '🎉 تم التفعيل بنجاح', description: `تم إنشاء حساب بكلمة مرور: ${tempPassword}` });
        setRequestToActivate(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'فشل التفعيل', description: e.message });
    } finally { setIsProcessing(null); }
  };

  return (
    <div className="space-y-10" dir="rtl">
        {/* 🛡️ الهيدر المضيء الفاخر 🛡️ */}
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl border border-indigo-100/50">
            <CardHeader className="p-10 pb-8 bg-indigo-600/5 border-b border-indigo-100/50">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-600 rounded-[2.2rem] shadow-xl shadow-indigo-100 border-2 border-white">
                            <Terminal className="h-8 w-8 text-white" />
                        </div>
                        <div className="text-right">
                            <CardTitle className="text-3xl font-black text-[#1e1b4b] tracking-tighter">غرفة التحكم والسيادة</CardTitle>
                            <CardDescription className="text-slate-500 font-bold text-base mt-1">إدارة المنشآت السحابية، تفعيل التراخيص، ومراقبة صحة النظام.</CardDescription>
                        </div>
                    </div>
                    <Button onClick={() => { setCompanyToEdit(null); setIsEditFormOpen(true); }} className="h-12 px-8 rounded-2xl font-black text-base gap-3 bg-indigo-600 hover:bg-indigo-700 shadow-2xl shadow-indigo-200 border-none transition-all active:scale-95">
                        <PlusCircle className="h-5 w-5" /> إضافة منشأة يدوياً
                    </Button>
                </div>
            </CardHeader>
        </Card>

        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
            <div className="flex justify-center mb-10">
                <TabsList className="bg-white p-1.5 rounded-[2.5rem] border border-indigo-100 h-16 w-full max-w-4xl shadow-xl">
                    <TabsTrigger value="entities" className="rounded-full flex-1 font-black gap-3 h-full text-base data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
                        <Building2 className="h-5 w-5" /> المنشآت والطلبات
                    </TabsTrigger>
                    <TabsTrigger value="config" className="rounded-full flex-1 font-black gap-3 h-full text-base data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
                        <Settings2 className="h-5 w-5" /> إعدادات النظام الشاملة
                    </TabsTrigger>
                    <TabsTrigger value="permissions" className="rounded-full flex-1 font-black gap-3 h-full text-base data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
                        <ShieldCheck className="h-5 w-5" /> مصفوفة الأمان
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="entities" className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                <Tabs defaultValue="companies" className="space-y-6">
                    <div className="flex justify-start px-4">
                        <TabsList className="bg-white/60 p-1 rounded-2xl h-11 border border-indigo-50 shadow-inner">
                            <TabsTrigger value="companies" className="rounded-xl px-8 font-black text-xs gap-3">
                                المنشآت النشطة 
                                <Badge variant="secondary" className="h-4 px-2 text-[9px] bg-indigo-600 text-white border-none">{companies.length}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="requests" className="rounded-xl px-8 font-black text-xs gap-3">
                                طلبات الانضمام 
                                <Badge className="h-4 px-2 text-[9px] bg-orange-500 border-none animate-pulse">
                                    {requests.filter(r => r.status === 'pending').length}
                                </Badge>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="companies" className="m-0">
                        <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-white">
                            <CardHeader className="bg-slate-50 border-b p-8 px-12 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="relative w-full max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input 
                                        placeholder="بحث باسم المنشأة أو البريد..." 
                                        value={searchQuery} 
                                        onChange={(e) => setSearchQuery(e.target.value)} 
                                        className="pl-10 h-12 rounded-2xl bg-white border-2 border-slate-100 font-bold text-black" 
                                    />
                                </div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                                    <Activity className="h-3 w-3 text-green-500" />
                                    إجمالي المنشآت الموثقة: {companies.length}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-indigo-50/50 h-14 border-b">
                                        <TableRow className="border-none">
                                            <TableHead className="px-12 font-black text-[#1e1b4b] text-right">المنظمة والبريد الإداري</TableHead>
                                            <TableHead className="font-black text-[#1e1b4b] text-center">نوع الاشتراك</TableHead>
                                            <TableHead className="font-black text-[#1e1b4b] text-center">تاريخ الانضمام</TableHead>
                                            <TableHead className="text-left px-12 font-black text-[#1e1b4b]">تحكم</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {companiesLoading ? (
                                            Array.from({ length: 4 }).map((_, i) => (
                                                <TableRow key={i}><TableCell colSpan={4} className="px-12 py-8"><Skeleton className="h-12 w-full rounded-2xl" /></TableCell></TableRow>
                                            ))
                                        ) : filteredCompanies.length === 0 ? (
                                            <TableRow><TableCell colSpan={4} className="h-64 text-center text-slate-300 font-black italic text-xl">لا توجد منشآت مسجلة حالياً.</TableCell></TableRow>
                                        ) : (
                                            filteredCompanies.map(company => (
                                                <TableRow key={company.id} className="h-24 border-slate-50 group transition-all border-b last:border-0 hover:bg-indigo-50/20">
                                                    <TableCell className="px-12">
                                                        <div className="flex items-center gap-4">
                                                            <div className="p-3 rounded-2xl shadow-sm bg-white border border-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
                                                                <Building2 className="h-6 w-6" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-xl text-black leading-none mb-1">{company.name}</span>
                                                                <span className="font-mono text-xs text-indigo-600 font-black opacity-40">{company.adminEmail}</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="outline" className={cn("px-4 py-1 rounded-full font-black text-[9px] uppercase border-2 shadow-sm", company.subscriptionType === 'premium' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200')}>
                                                            {company.subscriptionType === 'premium' ? 'Premium Plan' : 'Trial Mode'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col items-center">
                                                            <span className="font-mono text-xs font-black text-slate-800">
                                                                {toFirestoreDate(company.createdAt) ? format(toFirestoreDate(company.createdAt)!, 'dd/MM/yyyy') : '---'}
                                                            </span>
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Joined</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-left px-12">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-slate-100 border shadow-sm group-hover:bg-white transition-all"><MoreHorizontal className="h-5 w-5" /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" dir="rtl" className="w-64 rounded-2xl p-2 shadow-2xl border-none bg-white">
                                                                <DropdownMenuLabel className="font-black px-3 py-2 text-xs text-slate-400 uppercase">إدارة المنشأة</DropdownMenuLabel>
                                                                <DropdownMenuItem onClick={() => { setCompanyToEdit(company); setIsEditFormOpen(true); }} className="rounded-xl py-3 font-bold gap-3 cursor-pointer text-black">
                                                                    <Pencil className="h-4 w-4 text-indigo-600" /> تعديل الإعدادات
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem className="rounded-xl py-3 font-bold gap-3 text-primary cursor-pointer">
                                                                    <Wallet className="h-4 w-4" /> تمديد الاشتراك
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator className="bg-slate-100" />
                                                                <DropdownMenuItem onClick={() => setCompanyToDelete(company)} className="text-red-600 rounded-xl py-3 font-bold gap-3 focus:bg-red-50 cursor-pointer">
                                                                    <Trash2 className="h-4 w-4" /> حذف المنشأة نهائياً
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="requests" className="m-0">
                         <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-white">
                            <CardHeader className="bg-slate-50 border-b p-8 px-12">
                                <CardTitle className="text-xl font-black flex items-center gap-3">
                                    <History className="h-6 w-6 text-primary" /> أرشيف طلبات الانضمام الكامل
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-indigo-50/50 h-14">
                                        <TableRow className="border-none">
                                            <TableHead className="px-12 font-black text-[#1e1b4b] text-right">المنشأة والمالك</TableHead>
                                            <TableHead className="font-black text-[#1e1b4b] text-center">بيانات التواصل والحساب</TableHead>
                                            <TableHead className="font-black text-[#1e1b4b] text-center">التاريخ</TableHead>
                                            <TableHead className="text-left px-12 font-black text-[#1e1b4b]">الحالة / الإجراء</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {requestsLoading ? (
                                            Array.from({ length: 3 }).map((_, i) => (
                                                <TableRow key={i}><TableCell colSpan={4} className="px-12 py-8"><Skeleton className="h-12 w-full rounded-2xl" /></TableCell></TableRow>
                                            ))
                                        ) : filteredRequests.length === 0 ? <TableRow><TableCell colSpan={4} className="h-64 text-center opacity-30 italic font-black text-xl">لا توجد طلبات مسجلة.</TableCell></TableRow> :
                                        filteredRequests.map(req => (
                                            <TableRow key={req.id} className="h-24 group transition-all border-b last:border-0 hover:bg-indigo-50/20">
                                                <TableCell className="px-12">
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-xl text-black leading-tight mb-1">{req.companyName}</span>
                                                        <span className="text-xs font-bold text-indigo-600 flex items-center gap-2">
                                                            <UserPlus className="h-3 w-3"/> {req.contactName}
                                                            <Badge variant="outline" className="text-[7px] h-3 px-1 border-indigo-100">{req.activity}</Badge>
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col gap-1 items-center">
                                                        <span className="text-xs font-mono font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{req.email}</span>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-[10px] font-black text-indigo-700">{req.phone}</span>
                                                            <span className="text-[9px] font-bold text-slate-400">ID: {req.username}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center font-bold text-[10px] opacity-40">
                                                    {req.createdAt ? format(req.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: ar }) : '-'}
                                                </TableCell>
                                                <TableCell className="text-left px-12">
                                                    {req.status === 'pending' ? (
                                                        <Button 
                                                            onClick={() => setRequestToActivate(req)}
                                                            className="h-11 px-8 rounded-xl font-black bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100 gap-2 border-none"
                                                        >
                                                            <Rocket className="h-4 w-4" /> مراجعة وتفعيل
                                                        </Button>
                                                    ) : (
                                                        <Badge className="bg-indigo-600 text-white font-black px-6 py-2 rounded-2xl flex items-center gap-2 w-fit shadow-md border-none">
                                                            <CheckCircle2 className="h-4 w-4"/> مفعّل بنجاح
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </TabsContent>

            <TabsContent value="config" className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                <DeveloperHub />
            </TabsContent>

            <TabsContent value="permissions" className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                <PermissionsMatrix />
            </TabsContent>
        </Tabs>

        {isEditFormOpen && (
            <CompanyRegistrationForm 
                isOpen={isEditFormOpen} 
                onClose={() => { setIsEditFormOpen(false); setCompanyToEdit(null); }} 
                company={companyToEdit} 
            />
        )}

        {/* واجهات التأكيد والقرارات */}
        <AlertDialog open={!!requestToActivate} onOpenChange={() => setRequestToActivate(null)}>
            <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl bg-white max-w-xl">
                <AlertDialogHeader>
                    <div className="p-4 bg-green-100 rounded-3xl w-fit mb-4 shadow-inner"><Rocket className="h-10 w-10 text-green-600"/></div>
                    <AlertDialogTitle className="text-2xl font-black text-[#1e1b4b]">تأسيس المنشأة السحابية</AlertDialogTitle>
                    <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2 text-slate-600">
                        سيقوم النظام آلياً بإنشاء قاعدة بيانات معزولة لمنشأة <strong>"{requestToActivate?.companyName}"</strong> وحقن حساب المدير الأعلى لها.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-10 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2 text-black">تراجع</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleActivateRequest} 
                        disabled={isProcessing === 'activating'} 
                        className="bg-green-600 hover:bg-green-700 rounded-xl font-black h-12 px-12 shadow-xl shadow-green-100 flex-1"
                    >
                        {isProcessing === 'activating' ? <Loader2 className="animate-spin h-5 w-5"/> : 'تأكيد التفعيل الفوري'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!companyToDelete} onOpenChange={() => setCompanyToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl bg-white">
                <AlertDialogHeader>
                    <div className="p-4 bg-red-100 rounded-3xl w-fit mb-4 shadow-inner"><Trash2 className="h-10 w-10 text-red-600"/></div>
                    <AlertDialogTitle className="text-2xl font-black text-red-700 tracking-tighter">تأكيد حذف المنشأة نهائياً؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2 text-slate-600">
                        تحذير: سيتم مسح كافة البيانات، المستخدمين، والمشاريع التابعة لمنشأة <strong>"{companyToDelete?.name}"</strong>. هذا الإجراء لا يمكن التراجع عنه.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2 text-black">تراجع</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleDeleteCompany} 
                        disabled={isProcessing === 'deleting'} 
                        className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-xl shadow-red-200"
                    >
                        {isProcessing === 'deleting' ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، حذف نهائي'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

