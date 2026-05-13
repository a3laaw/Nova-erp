'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useFirebase, useSubscription } from '@/firebase';
import { doc, collection, writeBatch, serverTimestamp, getDocs, query, where, Timestamp } from 'firebase/firestore';
import type { Company } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    PlusCircle, Building2, Search, Loader2, Terminal, 
    MoreHorizontal, ArrowRightLeft, 
    Settings, Trash2, ShieldAlert, Sparkles, CheckCircle2,
    Wrench, AlertCircle, ShieldCheck, ShieldX, Copy, Key,
    Info, ExternalLink, RotateCcw, Activity
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CompanyRegistrationForm } from '@/components/developer/company-registration-form';
import { addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { format } from 'date-fns';

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
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth() as any;
  const { toast } = useToast();
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'READY' | 'MANUAL_MODE'>('MANUAL_MODE');

  const { data: rawCompanies, loading: companiesLoading } = useSubscription<Company>(firestore, 'companies', []);

  useEffect(() => {
    const checkSystem = async () => {
        try {
            const res = await fetch('/api/manage-tenant-user', { method: 'POST', body: JSON.stringify({ action: 'check' }) });
            const data = await res.json();
            setSystemStatus(data.status);
        } catch (e) { setSystemStatus('MANUAL_MODE'); }
    };
    checkSystem();
  }, []);

  const filteredCompanies = useMemo(() => {
    if (!rawCompanies) return [];
    return [...rawCompanies].sort((a, b) => ((b.updatedAt as any)?.toMillis?.() || 0) - ((a.updatedAt as any)?.toMillis?.() || 0))
      .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [rawCompanies, searchQuery]);

  const handleSwitchToCompany = async (company: Company) => {
    if (!firestore || !currentUser || isProcessing) return;
    setIsProcessing(company.id!);
    try {
        await fetch('/api/switch-company', { method: 'POST', body: JSON.stringify({ uid: currentUser.id, companyId: company.id, companyName: company.name }) });
        toast({ title: '✅ تم التقمص السيادي' });
        router.push('/dashboard');
    } finally { setIsProcessing(null); }
  };

  const handleDeleteCompany = async () => {
    if (!firestore || !companyToDelete) return;
    setIsProcessing(companyToDelete.id!);
    try {
        const batch = writeBatch(firestore);
        batch.delete(doc(firestore, 'companies', companyToDelete.id!));
        const globalQuery = query(collection(firestore, 'global_users'), where('companyId', '==', companyToDelete.id!));
        const globalSnap = await getDocs(globalQuery);
        globalSnap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        toast({ title: '🗑️ تم تصفية المنشأة نهائياً' });
    } catch (e) { toast({ variant: 'destructive', title: 'خطأ في الحذف' }); } finally { setIsProcessing(null); setCompanyToDelete(null); }
  };

  const handleRepairData = async () => {
    if (!firestore) return;
    setIsRepairing(true);
    try {
        const batch = writeBatch(firestore);
        const companiesSnap = await getDocs(collection(firestore, 'companies'));
        
        let repairedCount = 0;
        for (const companyDoc of companiesSnap.docs) {
            const data = companyDoc.data() as Company;
            const updates: any = {};

            if (!data.firebaseConfig || !data.firebaseConfig.apiKey) {
                updates.firebaseConfig = MASTER_FIREBASE_CONFIG;
                updates.firebaseProjectId = MASTER_FIREBASE_CONFIG.projectId;
            }

            const globalQuery = query(collection(firestore, 'global_users'), where('email', '==', data.adminEmail));
            const globalSnap = await getDocs(globalQuery);
            if (globalSnap.empty) {
                const globalRef = doc(collection(firestore, 'global_users'));
                batch.set(globalRef, {
                    email: data.adminEmail.toLowerCase().trim(),
                    username: data.adminEmail.split('@')[0],
                    companyId: companyDoc.id,
                    createdAt: serverTimestamp()
                });
            }

            if (Object.keys(updates).length > 0) {
                batch.update(companyDoc.ref, updates);
                repairedCount++;
            }
        }

        await batch.commit();
        toast({ title: '🛠️ تم الانتهاء من الترميم', description: `تم إصلاح ومزامنة ${repairedCount} منشأة قديمة بنجاح.` });
    } catch (e) { toast({ variant: 'destructive', title: 'فشل الترميم' }); } finally { setIsRepairing(false); }
  };

  return (
    <div className="space-y-10" dir="rtl">
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-[#1e1b4b]">
            <CardHeader className="p-10 pb-8 bg-indigo-950/60 border-b border-white/10">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-600 rounded-[2.2rem] shadow-[0_0_40px_rgba(79,70,229,0.4)] border-2 border-white/20"><Terminal className="h-10 w-10 text-white" /></div>
                        <div className="text-right">
                            <CardTitle className="text-4xl font-black text-white tracking-tighter flex items-center gap-3">
                                غرفة التحكم السيادية
                                {systemStatus === 'READY' ? (
                                    <Badge className="bg-green-600 rounded-full font-black text-[9px] gap-1 px-3"><ShieldCheck className="h-3 w-3"/> الأتمتة نشطة</Badge>
                                ) : (
                                    <Badge variant="destructive" className="animate-pulse rounded-full font-black text-[9px] gap-1 px-3"><ShieldX className="h-3 w-3"/> التفعيل يدوي</Badge>
                                )}
                            </CardTitle>
                            <CardDescription className="text-indigo-200 font-bold text-lg opacity-80 mt-1">إدارة المنظمات، الأتمتة، والترميم السحابي الموحد.</CardDescription>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <Button onClick={handleRepairData} disabled={isRepairing} variant="outline" className="h-14 px-8 rounded-2xl font-black text-lg gap-3 text-white border-white/20 hover:bg-white/10">
                            {isRepairing ? <Loader2 className="animate-spin h-6 w-6"/> : <RotateCcw className="h-6 w-6" />} ترميم البيانات القديمة
                        </Button>
                        <Button onClick={() => { setSelectedCompany(null); setIsFormOpen(true); }} className="h-14 px-10 rounded-2xl font-black text-xl gap-3 shadow-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all"><PlusCircle className="h-6 w-6" /> تأسيس منشأة</Button>
                    </div>
                </div>
            </CardHeader>
        </Card>

        {systemStatus === 'MANUAL_MODE' && (
            <Alert className="rounded-3xl border-2 border-red-500 bg-red-50/50 p-6 animate-in slide-in-from-top-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <AlertTitle className="text-red-800 font-black text-lg">تنبيه: محرك الأتمتة متوقف!</AlertTitle>
                <AlertDescription className="text-red-700 font-bold text-sm leading-relaxed mt-2">
                    النظام لا يجد ملف مفتاح الأمان <code className="bg-white px-2 py-0.5 rounded font-mono">service-account.json</code>. 
                    <br/>
                    بسبب ذلك، لا يمكن للنظام تسجيل الإيميلات آلياً في الكونسول. 
                    <strong> الحل: </strong> يرجى إضافة الموظفين يدوياً في <strong>Firebase Console > Authentication</strong> بنفس الإيميلات الظاهرة في الجدول أدناه.
                </AlertDescription>
            </Alert>
        )}

        <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-white/95">
            <CardHeader className="bg-slate-50 border-b p-8 px-12 flex flex-row justify-between items-center">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-950 opacity-40" />
                    <Input placeholder="بحث باسم المنشأة..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12 rounded-2xl bg-white border-2 border-indigo-100 font-bold" />
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="h-3 w-3" />
                    تم العثور على {filteredCompanies.length} منشأة
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-[#1e1b4b]"><TableRow className="border-none"><TableHead className="px-12 font-black text-white text-right">المنظمة / البريد السيادي</TableHead><TableHead className="font-black text-indigo-100 text-center">حالة الحساب</TableHead><TableHead className="font-black text-indigo-100 text-center">تاريخ التأسيس</TableHead><TableHead className="text-left px-12 font-black text-indigo-100">إجراءات السيادة</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {companiesLoading ? <TableRow><TableCell colSpan={4} className="text-center p-20"><Loader2 className="animate-spin h-12 w-12 mx-auto text-indigo-200" /></TableCell></TableRow> :
                        filteredCompanies.map(company => (
                            <TableRow key={company.id} className="h-24 border-slate-100 group transition-all">
                                <TableCell className="px-12">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-sm"><Building2 className="h-6 w-6" /></div>
                                        <div className="flex flex-col">
                                            <span className="font-black text-xl text-[#1e1b4b]">{company.name}</span>
                                            <span className="font-mono text-xs text-primary font-black flex items-center gap-1">
                                                {company.adminEmail}
                                                <Button variant="ghost" size="icon" className="h-4 w-4 opacity-40 hover:opacity-100" onClick={() => { navigator.clipboard.writeText(company.adminEmail); toast({ title: '📋 تم النسخ' }); }}>
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                            </span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className="flex flex-col items-center gap-1">
                                        <Badge className={cn("px-6 py-1 rounded-full font-black text-[9px] border-2", company.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')}>
                                            {company.isActive ? 'ACTIVE' : 'LOCKED'}
                                        </Badge>
                                        {systemStatus === 'MANUAL_MODE' && (
                                            <span className="text-[8px] font-bold text-orange-600 flex items-center gap-1"><Info className="h-2 w-2"/> بانتظار الإضافة للكونسول</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center font-bold text-xs text-slate-500">
                                    {company.createdAt ? format(company.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: ar }) : '-'}
                                </TableCell>
                                <TableCell className="text-left px-12">
                                    <div className="flex items-center justify-end gap-3">
                                        <Button onClick={() => handleSwitchToCompany(company)} variant="outline" className="rounded-xl font-bold h-10 gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-all active:scale-95">
                                            {isProcessing === company.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <ArrowRightLeft className="h-4 w-4"/>} 
                                            تقمص الشخصية
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-slate-50 border shadow-sm"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" dir="rtl" className="w-64 rounded-2xl p-2 shadow-2xl border-none"><DropdownMenuLabel className="font-black px-3 py-2">الإدارة العليا</DropdownMenuLabel><DropdownMenuItem onClick={() => { setSelectedCompany(company); setIsFormOpen(true); }} className="rounded-xl py-3 font-bold gap-3"><Settings className="h-4 w-4 text-indigo-600" /> تعديل الإعدادات والربط</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setCompanyToDelete(company)} className="text-red-600 rounded-xl py-3 font-bold gap-3 focus:bg-red-50"><Trash2 className="h-4 w-4" /> تصفية المنشأة نهائياً</DropdownMenuItem></DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter className="p-4 bg-slate-900 text-white flex justify-center gap-4 text-[10px] font-black uppercase tracking-[0.4em]">
                <ShieldCheck className="h-3 w-3 text-green-400" />
                Nova Sovereign Core — Platform Management Console
            </CardFooter>
        </Card>
        
        <CompanyRegistrationForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} company={selectedCompany} />
        
        <AlertDialog open={!!companyToDelete} onOpenChange={() => setCompanyToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-[2.5rem] border-none shadow-2xl p-10">
                <AlertDialogHeader>
                    <div className="p-3 bg-red-100 rounded-2xl text-red-600 w-fit mb-4 shadow-inner"><ShieldAlert className="h-10 w-10"/></div>
                    <AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد الإجراء السيادي النهائي؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2 text-slate-600">أنت على وشك حذف منشأة <strong>"{companyToDelete?.name}"</strong> بالكامل. <br/><br/> <span className="font-black text-red-600 underline">تحذير: لا يمكن استعادة السجلات المالية أو ملفات الموظفين بعد الحذف.</span></AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2">تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteCompany} disabled={!!isProcessing} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-xl shadow-red-200"> {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : 'تأكيد الحذف النهائي'} </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}