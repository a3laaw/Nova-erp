'use client';

import { useState, useMemo, useEffect } from 'react';
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
    Timestamp, 
    orderBy, 
    deleteField, 
    getDoc,
    limit
} from 'firebase/firestore';
import type { Company, CompanyRequest } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    PlusCircle, Building2, Search, Loader2, Terminal, 
    MoreHorizontal, Settings, Trash2, ShieldAlert, CheckCircle2,
    Wrench, AlertCircle, ShieldCheck, ShieldX, Copy, Key,
    Activity, Rocket, UserPlus, Lock, Send, X, Phone, Mail
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

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
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<'READY' | 'MANUAL_MODE'>('MANUAL_MODE');

  const [requestToActivate, setRequestToActivate] = useState<CompanyRequest | null>(null);
  const [activationPassword, setActivationPassword] = useState('');
  const [activationResult, setActivationResult] = useState<{ email: string, pass: string } | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  const { data: companies, loading: companiesLoading } = useSubscription<Company>(firestore, 'companies', []);
  const requestsQuery = useMemo(() => [orderBy('createdAt', 'desc')], []);
  const { data: requests, loading: requestsLoading } = useSubscription<CompanyRequest>(firestore, 'company_requests', requestsQuery);

  useEffect(() => {
    const checkSystem = async () => {
        try {
            const res = await fetch('/api/manage-tenant-user', { 
                method: 'POST', 
                body: JSON.stringify({ action: 'check' }) 
            });
            const data = await res.json();
            setSystemStatus(data.error === 'MISSING_CONFIG' ? 'MANUAL_MODE' : 'READY');
        } catch (e) { setSystemStatus('MANUAL_MODE'); }
    };
    checkSystem();
  }, []);

  const filteredCompanies = useMemo(() => {
    if (!companies) return [];
    return [...companies].sort((a, b) => ((b.updatedAt as any)?.toMillis?.() || 0) - ((a.updatedAt as any)?.toMillis?.() || 0))
      .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [companies, searchQuery]);

  const generateStrongPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setActivationPassword(password);
  };

  const handleActivateRequest = async () => {
    if (!requestToActivate || !activationPassword || isProcessing) return;
    setIsProcessing(requestToActivate.id!);
    
    try {
        const response = await fetch('/api/manage-tenant-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'instant_setup',
                companyName: requestToActivate.companyName,
                activity: requestToActivate.activity,
                employeeCountRange: requestToActivate.employeeCountRange,
                contactName: requestToActivate.contactName,
                email: requestToActivate.email,
                username: requestToActivate.username,
                phone: requestToActivate.phone,
                password: activationPassword,
                requestId: requestToActivate.id
            })
        });

        const result = await response.json();
        if (result.success) {
            setActivationResult({
                email: requestToActivate.email,
                pass: activationPassword
            });
            toast({ title: '✅ تم تفعيل المنشأة بنجاح' });
        } else {
            throw new Error(result.message || result.error);
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'فشل التفعيل', description: e.message });
    } finally {
        setIsProcessing(null);
    }
  };

  const handleDeleteCompany = async () => {
    if (!companyToDelete || !firestore || isProcessing) return;
    setIsProcessing(companyToDelete.id!);
    try {
        const batch = writeBatch(firestore);
        batch.delete(doc(firestore, 'companies', companyToDelete.id!));
        const globalIndexQuery = query(collection(firestore, 'global_users'), where('companyId', '==', companyToDelete.id));
        const globalSnap = await getDocs(globalIndexQuery);
        globalSnap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        toast({ title: 'تم الحذف', description: 'تم مسح المنشأة وكافة سجلاتها بنجاح.' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'فشل الحذف', description: e.message });
    } finally {
        setIsProcessing(null);
        setCompanyToDelete(null);
    }
  };

  const handleRepairData = async () => {
    if (!firestore || isProcessing) return;
    setIsProcessing('repair');
    try {
        const batch = writeBatch(firestore);
        const companiesSnap = await getDocs(collection(firestore, 'companies'));
        let count = 0;
        for (const cDoc of companiesSnap.docs) {
            const data = cDoc.data();
            const updates: any = {};
            if (!data.firebaseConfig || !data.firebaseConfig.apiKey) {
                updates.firebaseConfig = MASTER_FIREBASE_CONFIG;
                updates.firebaseProjectId = MASTER_FIREBASE_CONFIG.projectId;
            }
            if (Object.keys(updates).length > 0) {
                batch.update(cDoc.ref, updates);
                count++;
            }
            const globalQuery = query(collection(firestore, 'global_users'), where('email', '==', data.adminEmail), limit(1));
            const globalSnap = await getDocs(globalQuery);
            if (globalSnap.empty && data.adminEmail) {
                const newGlobalRef = doc(collection(firestore, 'global_users'));
                batch.set(newGlobalRef, {
                    email: data.adminEmail.toLowerCase(),
                    username: data.adminEmail.split('@')[0],
                    companyId: cDoc.id,
                    createdAt: serverTimestamp()
                });
            }
        }
        await batch.commit();
        toast({ title: 'تم الترميم', description: `تم إصلاح ${count} منشأة ومزامنة الفهرس العالمي.` });
    } catch (e) {
        toast({ variant: 'destructive', title: 'فشل الترميم' });
    } finally { setIsProcessing(null); }
  };

  const copyWelcomeMessage = () => {
    if (!activationResult || !requestToActivate) return;
    const msg = `أهلاً بك في عائلة Nova ERP! 🚀\n\nتم تفعيل منشأتك: *${requestToActivate.companyName}*\n\nبيانات الدخول:\n👤 اسم المستخدم: ${requestToActivate.username}\n📧 البريد: ${activationResult.email}\n🔑 كلمة المرور: ${activationResult.pass}\n\nنتمنى لك عملاً موفقاً!`;
    navigator.clipboard.writeText(msg);
    toast({ title: '📋 تم النسخ' });
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
                                غرفة التحكم الرئيسية
                                {systemStatus === 'READY' ? (
                                    <Badge className="bg-green-600 rounded-full font-black text-[9px] gap-1 px-3"><ShieldCheck className="h-3 w-3"/> الأتمتة نشطة</Badge>
                                ) : (
                                    <Badge variant="destructive" className="animate-pulse rounded-full font-black text-[9px] gap-1 px-3"><ShieldX className="h-3 w-3"/> تفعيل يدوي</Badge>
                                )}
                            </CardTitle>
                            <CardDescription className="text-indigo-200 font-bold text-lg opacity-80 mt-1">إدارة المنظمات والاحتضان السحابي الموحد.</CardDescription>
                        </div>
                    </div>
                    <Button onClick={handleRepairData} disabled={!!isProcessing} variant="outline" className="h-14 px-8 rounded-2xl font-black text-lg gap-3 border-indigo-400 text-indigo-400 hover:bg-white/10">
                        {isProcessing === 'repair' ? <Loader2 className="animate-spin h-6 w-6"/> : <Wrench className="h-6 w-6" />}
                        ترميم البيانات القديمة
                    </Button>
                </div>
            </CardHeader>
        </Card>

        {systemStatus === 'MANUAL_MODE' && (
            <Alert className="rounded-3xl border-2 border-red-500 bg-red-50/50 p-6 animate-in slide-in-from-top-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <AlertTitle className="text-red-800 font-black text-lg">تنبيه: محرك الأتمتة متوقف!</AlertTitle>
                <AlertDescription className="text-red-700 font-bold text-sm leading-relaxed mt-2">
                    لم يتم العثور على ملف <strong>service-account.json</strong> صالح. التفعيل سيكتفي بإنشاء سجلات Firestore؛ يجب تفعيل الإيميلات يدوياً في الكونسول.
                </AlertDescription>
            </Alert>
        )}

        <Tabs defaultValue="requests" className="w-full">
            <TabsList className="bg-white/10 p-1 rounded-2xl border border-white/10 mb-6 h-14">
                <TabsTrigger value="requests" className="rounded-xl px-10 font-black gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                    <Rocket className="h-4 w-4" /> طلبات الديمو المعلقة
                    {requests.filter(r => r.status === 'pending').length > 0 && (
                        <Badge className="bg-red-500 text-white h-5 w-5 p-0 flex items-center justify-center rounded-full mr-2">
                            {requests.filter(r => r.status === 'pending').length}
                        </Badge>
                    )}
                </TabsTrigger>
                <TabsTrigger value="companies" className="rounded-xl px-10 font-black gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                    <Building2 className="h-4 w-4" /> المنشآت النشطة
                </TabsTrigger>
            </TabsList>

            <TabsContent value="requests" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white/95">
                    <Table>
                        <TableHeader className="bg-slate-100">
                            <TableRow>
                                <TableHead className="px-10 font-black text-right">المنشأة وصاحب الطلب</TableHead>
                                <TableHead className="font-black text-center">التواصل</TableHead>
                                <TableHead className="font-black text-center">التاريخ</TableHead>
                                <TableHead className="text-left px-12 font-black">القرار الإداري</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {requestsLoading ? <TableRow><TableCell colSpan={4} className="text-center p-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow> :
                            requests.length === 0 ? <TableRow><TableCell colSpan={4} className="h-64 text-center opacity-30 italic font-black text-xl">لا توجد طلبات معلقة.</TableCell></TableRow> :
                            requests.map(req => (
                                <TableRow key={req.id} className="h-24 group transition-all border-b">
                                    <TableCell className="px-10">
                                        <div className="flex flex-col">
                                            <span className="font-black text-xl text-[#1e1b4b]">{req.companyName}</span>
                                            <span className="text-xs font-bold text-primary">{req.contactName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col gap-1 items-center">
                                            <span className="text-xs font-mono font-bold text-slate-500">{req.email}</span>
                                            <span className="text-[10px] font-black text-indigo-600">{req.phone}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center font-bold text-xs opacity-50">
                                        {req.createdAt ? format(req.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: ar }) : '-'}
                                    </TableCell>
                                    <TableCell className="text-left px-12">
                                        {req.status === 'pending' ? (
                                            <Button 
                                                onClick={() => { setRequestToActivate(req); setActivationResult(null); setActivationPassword(''); }}
                                                className="h-11 px-8 rounded-xl font-black bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100 gap-2 active:scale-95 transition-all"
                                            >
                                                <UserPlus className="h-4 w-4" /> تفعيل الحساب
                                            </Button>
                                        ) : (
                                            <Badge className="bg-blue-50 text-blue-700 border-blue-100 font-black px-4 py-1.5 rounded-xl">تم التفعيل</Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            </TabsContent>

            <TabsContent value="companies">
                <Card className="rounded-[3.5rem] border-none shadow-xl overflow-hidden bg-white/95">
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
                            <TableHeader className="bg-[#1e1b4b]"><TableRow className="border-none"><TableHead className="px-12 font-black text-white text-right">المنظمة / البريد الرئيسي</TableHead><TableHead className="font-black text-indigo-100 text-center">حالة الحساب</TableHead><TableHead className="font-black text-indigo-100 text-center">تاريخ التأسيس</TableHead><TableHead className="text-left px-12 font-black text-indigo-100">تحكم</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {companiesLoading ? <TableRow><TableCell colSpan={4} className="text-center p-20"><Loader2 className="animate-spin h-12 w-12 mx-auto" /></TableCell></TableRow> :
                                filteredCompanies.map(company => (
                                    <TableRow key={company.id} className="h-24 border-slate-100 group transition-all border-b">
                                        <TableCell className="px-12">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-sm"><Building2 className="h-6 w-6" /></div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-xl text-[#1e1b4b]">{company.name}</span>
                                                    <span className="font-mono text-xs text-primary font-black">{company.adminEmail}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge className={cn("px-6 py-1 rounded-full font-black text-[9px] border-2", company.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')}>
                                                {company.isActive ? 'ACTIVE' : 'LOCKED'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-xs text-slate-500">
                                            {company.createdAt ? format(company.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: ar }) : '-'}
                                        </TableCell>
                                        <TableCell className="text-left px-12">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-slate-50 border shadow-sm"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" dir="rtl" className="w-64 rounded-2xl p-2 shadow-2xl border-none"><DropdownMenuLabel className="font-black px-3 py-2">الإدارة العليا</DropdownMenuLabel><DropdownMenuItem onClick={() => setCompanyToDelete(company)} className="text-red-600 rounded-xl py-3 font-bold gap-3 focus:bg-red-50"><Trash2 className="h-4 w-4" /> حذف المنشأة نهائياً</DropdownMenuItem></DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

        {/* --- نافذة التفعيل --- */}
        <Dialog open={!!requestToActivate} onOpenChange={() => !isProcessing && setRequestToActivate(null)}>
            <DialogContent dir="rtl" className="max-w-2xl p-0 rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                <DialogHeader className="p-8 bg-slate-900 text-white relative text-right">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 bg-green-600 rounded-2xl text-white shadow-xl"><ShieldCheck className="h-8 w-8" /></div>
                        <div className="text-right">
                            <DialogTitle className="text-2xl font-black text-white">تفعيل الحساب والاحتضان</DialogTitle>
                            <DialogDescription className="text-indigo-200 font-bold">تجهيز بيانات الدخول لمنشأة: {requestToActivate?.companyName}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 space-y-8">
                    {!activationResult ? (
                        <>
                            <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 shadow-inner">
                                <div className="space-y-1 text-right">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">اسم المالك</Label>
                                    <p className="font-black text-lg">{requestToActivate?.contactName}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">رقم الهاتف</Label>
                                    <p className="font-mono font-bold">{requestToActivate?.phone}</p>
                                </div>
                                <div className="col-span-2 space-y-1 text-right">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">البريد الإلكتروني المعتمد</Label>
                                    <p className="font-mono font-bold text-indigo-600">{requestToActivate?.email}</p>
                                </div>
                            </div>

                            <div className="grid gap-2 text-right">
                                <Label className="font-black text-gray-700 pr-1">كلمة المرور التأسيسية</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input 
                                            value={activationPassword} 
                                            onChange={(e) => setActivationPassword(e.target.value)}
                                            className="h-12 rounded-xl pr-10 border-2 font-mono font-black"
                                            placeholder="أدخل كلمة المرور أو ولدها..."
                                        />
                                    </div>
                                    <Button type="button" variant="outline" onClick={generateStrongPassword} className="h-12 rounded-xl border-2 font-bold gap-2 text-primary">توليد كلمة مرور</Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-8 animate-in zoom-in-95 duration-500">
                            <Alert className="rounded-3xl border-2 border-green-500 bg-green-50 p-6">
                                <CheckCircle2 className="h-6 w-6 text-green-600" />
                                <AlertTitle className="text-green-800 font-black text-lg">تم التفعيل بنجاح!</AlertTitle>
                                <AlertDescription className="text-green-700 font-bold mt-2 leading-relaxed">تم تأسيس قاعدة بيانات المنشأة وتفعيل صلاحيات المالك. المنظومة جاهزة للعمل.</AlertDescription>
                            </Alert>

                            <div className="space-y-4">
                                <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-2xl space-y-4">
                                    <div className="flex justify-between border-b border-white/10 pb-3"><span className="text-xs font-bold text-slate-400">اسم المستخدم (ID):</span><span className="font-mono font-black text-indigo-400">{requestToActivate?.username}</span></div>
                                    <div className="flex justify-between border-b border-white/10 pb-3"><span className="text-xs font-bold text-slate-400">كلمة المرور:</span><span className="font-mono font-black text-green-400">{activationResult.pass}</span></div>
                                </div>
                                <Button onClick={copyWelcomeMessage} className="w-full h-12 rounded-xl font-black gap-2 shadow-xl bg-green-600"><Send className="h-4 w-4" /> نسخ رسالة الترحيب للواتساب</Button>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-8 bg-slate-50 border-t flex gap-3">
                    {!activationResult ? (
                        <>
                            <Button variant="ghost" onClick={() => setRequestToActivate(null)} disabled={!!isProcessing} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                            <Button onClick={handleActivateRequest} disabled={!!isProcessing || !activationPassword} className="flex-1 h-14 rounded-2xl font-black text-lg shadow-xl bg-green-600 hover:bg-green-700 gap-3">
                                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />} تفعيل الحساب وإنشاء المنشأة
                            </Button>
                        </>
                    ) : (
                        <Button onClick={() => setRequestToActivate(null)} className="w-full h-14 rounded-2xl font-black text-lg bg-slate-900">إغلاق النافذة</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        <AlertDialog open={!!companyToDelete} onOpenChange={() => setCompanyToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-[2.5rem] border-none shadow-2xl p-10">
                <AlertDialogHeader>
                    <div className="p-3 bg-red-100 rounded-2xl text-red-600 w-fit mb-4"><ShieldAlert className="h-10 w-10"/></div>
                    <AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد حذف المنشأة نهائياً؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2 text-slate-600">أنت على وشك حذف منشأة <strong>"{companyToDelete?.name}"</strong> بالكامل. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2">تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteCompany} disabled={!!isProcessing} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-xl shadow-red-200">{isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : 'تأكيد الحذف'}</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
