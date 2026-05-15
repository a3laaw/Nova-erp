'use client';

import { useState, useMemo } from 'react';
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
} from 'firebase/firestore';
import type { Company, CompanyRequest } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    PlusCircle, Building2, Search, Loader2, Terminal, 
    MoreHorizontal, Trash2, CheckCircle2,
    Activity, Rocket, UserPlus, Lock, Send, X, RefreshCw, User, Settings2, Pencil
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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
import { CompanyRegistrationForm } from '@/components/developer/company-registration-form';

export default function DeveloperDashboard() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const [requestToActivate, setRequestToActivate] = useState<CompanyRequest | null>(null);
  const [activationPassword, setActivationPassword] = useState('');
  const [activationResult, setActivationResult] = useState<{ email: string, pass: string } | null>(null);
  
  const [companyToEdit, setCompanyToEdit] = useState<Company | null>(null);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  const { data: companies, loading: companiesLoading } = useSubscription<Company>(firestore, 'companies', []);
  const requestsQuery = useMemo(() => [orderBy('createdAt', 'desc')], []);
  const { data: requests, loading: requestsLoading } = useSubscription<CompanyRequest>(firestore, 'company_requests', requestsQuery);

  const filteredCompanies = useMemo(() => {
    if (!companies) return [];
    return [...companies].sort((a, b) => ((b.updatedAt as any)?.toMillis?.() || 0) - ((a.updatedAt as any)?.toMillis?.() || 0))
      .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [companies, searchQuery]);

  const generateStrongPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
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
                contactName: requestToActivate.contactName,
                email: requestToActivate.email,
                activity: requestToActivate.activity || 'consulting',
                password: activationPassword,
                requestId: requestToActivate.id
            })
        });

        const result = await response.json();
        if (result.success) {
            setActivationResult({ email: requestToActivate.email, pass: activationPassword });
            toast({ title: 'تم التفعيل بنجاح' });
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

  const copyWelcomeMessage = () => {
    if (!activationResult || !requestToActivate) return;
    const msg = `أهلاً بك في عائلة Nova ERP! 🚀\n\nتم تفعيل منشأتك: *${requestToActivate.companyName}*\n\nبيانات الدخول:\n📧 البريد: ${activationResult.email}\n🔑 كلمة المرور: ${activationResult.pass}\n\nنتمنى لك عملاً موفقاً!`;
    navigator.clipboard.writeText(msg);
    toast({ title: 'تم النسخ' });
  };

  const handleEditCompany = (company: Company) => {
    setCompanyToEdit(company);
    setIsEditFormOpen(true);
  };

  return (
    <div className="space-y-10" dir="rtl">
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-slate-900">
            <CardHeader className="p-10 pb-8 bg-slate-950/60 border-b border-white/10">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-600 rounded-[2.2rem] shadow-xl border-2 border-white/20">
                            <Terminal className="h-10 w-10 text-white" />
                        </div>
                        <div className="text-right text-white">
                            <CardTitle className="text-4xl font-black tracking-tighter">غرفة التحكم الرئيسية</CardTitle>
                            <CardDescription className="text-indigo-200 font-bold text-lg opacity-80 mt-1">إدارة المنشآت وتفعيل الحسابات الجديدة.</CardDescription>
                        </div>
                    </div>
                    <Button onClick={() => { setCompanyToEdit(null); setIsEditFormOpen(true); }} className="h-12 px-8 rounded-2xl font-black gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-900/40">
                        <PlusCircle className="h-5 w-5" /> إضافة منشأة يدوياً
                    </Button>
                </div>
            </CardHeader>
        </Card>

        <Tabs defaultValue="requests" className="w-full">
            <TabsList className="bg-white/10 p-1 rounded-2xl border border-white/10 mb-6 h-14">
                <TabsTrigger value="requests" className="rounded-xl px-10 font-black gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                    <Rocket className="h-4 w-4" /> طلبات الانضمام
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
                                <TableHead className="px-10 font-black text-right text-slate-900">المنشأة والمالك</TableHead>
                                <TableHead className="font-black text-center text-slate-900">التواصل</TableHead>
                                <TableHead className="font-black text-center text-slate-900">التاريخ</TableHead>
                                <TableHead className="text-left px-12 font-black text-slate-900">الإجراء</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {requestsLoading ? <TableRow><TableCell colSpan={4} className="text-center p-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></TableCell></TableRow> :
                            requests.length === 0 ? <TableRow><TableCell colSpan={4} className="h-64 text-center opacity-30 italic font-black text-xl">لا توجد طلبات معلقة.</TableCell></TableRow> :
                            requests.map(req => (
                                <TableRow key={req.id} className="h-24 group transition-all border-b">
                                    <TableCell className="px-10">
                                        <div className="flex flex-col">
                                            <span className="font-black text-xl text-slate-900">{req.companyName}</span>
                                            <span className="text-xs font-bold text-primary flex items-center gap-1"><User className="h-3 w-3"/> {req.contactName}</span>
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
                                                className="h-11 px-8 rounded-xl font-black bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100 gap-2"
                                            >
                                                <UserPlus className="h-4 w-4" /> مراجعة وتفعيل
                                            </Button>
                                        ) : (
                                            <Badge className="bg-blue-50 text-blue-700 border-blue-100 font-black px-4 py-1.5 rounded-xl flex items-center gap-2 w-fit">
                                                <CheckCircle2 className="h-3 w-3"/> تم التفعيل
                                            </Badge>
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
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-950 opacity-40" />
                            <Input placeholder="بحث باسم المنشأة..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12 rounded-2xl bg-white border-2 border-indigo-100 font-bold" />
                        </div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Activity className="h-3 w-3" />
                            إجمالي المنشآت: {filteredCompanies.length}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-slate-900">
                                <TableRow className="border-none">
                                    <TableHead className="px-12 font-black text-white text-right">المنظمة والبريد الإداري</TableHead>
                                    <TableHead className="font-black text-indigo-100 text-center">نوع الاشتراك</TableHead>
                                    <TableHead className="font-black text-indigo-100 text-center">تاريخ التأسيس</TableHead>
                                    <TableHead className="text-left px-12 font-black text-indigo-100">تحكم</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {companiesLoading ? <TableRow><TableCell colSpan={4} className="text-center p-20"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary" /></TableCell></TableRow> :
                                filteredCompanies.length === 0 ? <TableRow><TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic font-bold">لا توجد منشآت نشطة حالياً.</TableCell></TableRow> :
                                filteredCompanies.map(company => (
                                    <TableRow key={company.id} className="h-24 border-slate-100 group transition-all border-b">
                                        <TableCell className="px-12">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-sm"><Building2 className="h-6 w-6" /></div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-xl text-slate-900">{company.name}</span>
                                                    <span className="font-mono text-xs text-primary font-black">{company.adminEmail}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={cn("px-4 py-1 rounded-full font-black text-[9px] uppercase", company.subscriptionType === 'premium' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200')}>
                                                {company.subscriptionType === 'premium' ? 'Premium Plan' : 'Trial Mode'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-xs text-slate-500">
                                            {company.createdAt ? format(company.createdAt.toDate(), 'dd/MM/yyyy', { locale: ar }) : '-'}
                                        </TableCell>
                                        <TableCell className="text-left px-12">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-slate-50 border shadow-sm group-hover:bg-white transition-all"><MoreHorizontal className="h-5 w-5" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" dir="rtl" className="w-64 rounded-2xl p-2 shadow-2xl border-none">
                                                    <DropdownMenuLabel className="font-black px-3 py-2 text-xs text-slate-400 uppercase">إدارة المنشأة</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleEditCompany(company)} className="rounded-xl py-3 font-bold gap-3">
                                                        <Pencil className="h-4 w-4 text-indigo-600" /> تعديل إعدادات المنشأة
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => setCompanyToDelete(company)} className="text-red-600 rounded-xl py-3 font-bold gap-3 focus:bg-red-50">
                                                        <Trash2 className="h-4 w-4" /> حذف المنشأة نهائياً
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
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

        {isEditFormOpen && (
            <CompanyRegistrationForm 
                isOpen={isEditFormOpen} 
                onClose={() => { setIsEditFormOpen(false); setCompanyToEdit(null); }} 
                company={companyToEdit} 
            />
        )}

        <Dialog open={!!requestToActivate} onOpenChange={() => !isProcessing && setRequestToActivate(null)}>
            <DialogContent dir="rtl" className="max-w-2xl p-0 rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                <DialogHeader className="p-8 bg-slate-900 text-white text-right">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-600 rounded-2xl text-white shadow-xl"><CheckCircle2 className="h-8 w-8" /></div>
                        <div className="text-right">
                            <DialogTitle className="text-2xl font-black text-white">تفعيل الحساب السحابي</DialogTitle>
                            <DialogDescription className="text-indigo-200 font-bold">للمنشأة: {requestToActivate?.companyName}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-10 space-y-8">
                    {!activationResult ? (
                        <>
                            <div className="grid grid-cols-2 gap-8 bg-slate-50 p-8 rounded-[2rem] border-2 border-slate-100 shadow-inner">
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">المالك المسؤول</Label>
                                    <p className="font-black text-xl text-slate-900">{requestToActivate?.contactName}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">البريد المعتمد</Label>
                                    <p className="font-mono font-bold text-indigo-600">{requestToActivate?.email}</p>
                                </div>
                            </div>

                            <div className="grid gap-3">
                                <Label className="font-black text-[#1e1b4b] pr-2">كلمة المرور التأسيسية للمالك *</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input 
                                            value={activationPassword} 
                                            onChange={(e) => setActivationPassword(e.target.value)}
                                            className="h-12 rounded-xl pr-10 border-2 font-mono font-black text-lg text-primary"
                                            placeholder="أدخل كلمة المرور..."
                                        />
                                    </div>
                                    <Button type="button" variant="outline" onClick={generateStrongPassword} className="h-12 rounded-xl border-2 font-bold gap-2 text-primary hover:bg-primary/5">
                                        <RefreshCw className="h-4 w-4" /> توليد تلقائي
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-8 animate-in zoom-in-95 duration-500">
                            <div className="p-8 bg-green-50 rounded-[2rem] border-2 border-green-200 text-center space-y-2">
                                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
                                <h3 className="text-2xl font-black text-green-800">تم التفعيل بنجاح!</h3>
                                <p className="text-sm font-bold text-green-700">تم تأسيس قاعدة البيانات وحساب المالك.</p>
                            </div>

                            <div className="p-8 bg-slate-900 rounded-[2rem] text-white shadow-2xl space-y-4">
                                <div className="flex justify-between border-b border-white/10 pb-3">
                                    <span className="text-xs font-bold text-slate-400">البريد الإلكتروني:</span>
                                    <span className="font-mono font-black text-indigo-400">{activationResult.email}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-xs font-bold text-slate-400">كلمة المرور:</span>
                                    <span className="font-mono font-black text-green-400">{activationResult.pass}</span>
                                </div>
                            </div>
                            <Button onClick={copyWelcomeMessage} className="w-full h-14 rounded-2xl font-black text-lg gap-3 shadow-xl bg-green-600 hover:bg-green-700 transition-all">
                                <Send className="h-5 w-5" /> نسخ بيانات الدخول
                            </Button>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-8 bg-slate-50 border-t flex gap-4">
                    {!activationResult ? (
                        <>
                            <Button variant="ghost" onClick={() => setRequestToActivate(null)} disabled={!!isProcessing} className="rounded-xl font-bold h-12 px-8 text-slate-500">إلغاء</Button>
                            <Button onClick={handleActivateRequest} disabled={!!isProcessing || !activationPassword} className="flex-1 h-14 rounded-2xl font-black text-xl shadow-xl bg-indigo-600 hover:bg-indigo-700 gap-3">
                                {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Rocket className="h-6 w-6" />} تفعيل المنشأة الآن
                            </Button>
                        </>
                    ) : (
                        <Button onClick={() => setRequestToActivate(null)} className="w-full h-14 rounded-2xl font-black text-lg bg-slate-900 hover:bg-black">إغلاق النافذة</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <AlertDialog open={!!companyToDelete} onOpenChange={() => setCompanyToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl bg-white">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد حذف المنشأة؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2 text-slate-600">
                        أنت على وشك حذف منشأة <strong>"{companyToDelete?.name}"</strong> بالكامل. سيتم مسح كافة البيانات المرتبطة بها نهائياً.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2">تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteCompany} disabled={!!isProcessing} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-xl shadow-red-200">
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : 'نعم، تأكيد الحذف النهائي'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
