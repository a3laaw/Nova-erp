'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase, useSubscription } from '@/firebase';
import { doc, updateDoc, collection, orderBy, query } from 'firebase/firestore';
import type { Company } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Building2, Power, PowerOff, Search, Loader2, Terminal, Pencil, MoreHorizontal, DatabaseZap, ArrowRightLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CompanyRegistrationForm } from '@/components/developer/company-registration-form';
import { useCompany } from '@/context/company-context';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * @fileOverview غرفة التحكم الكبرى (Developer Console).
 * تم تحديثها لضمان العزل التام للمنظمات وسرعة تحميل البيانات.
 */
export default function DeveloperDashboard() {
  const { firestore, auth: clientAuth } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const { setCurrentCompany } = useCompany();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [selectedCompanyForEdit, setSelectedCompanyForEdit] = useState<Company | null>(null);

  // 🛡️ جلب كافة المنشآت من المجلد الرئيسي مباشرة (Sovereign Fetch)
  const { data: rawCompanies, loading, error } = useSubscription<Company>(firestore, 'companies', []);

  // 🔄 معالجة البيانات برمجياً لضمان السرعة (Client-side Processing)
  const filteredCompanies = useMemo(() => {
    if (!rawCompanies) return [];
    
    // 1. الترتيب: الأحدث أولاً
    let processed = [...rawCompanies].sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
    });

    // 2. الفلترة حسب البحث السيادي
    if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        processed = processed.filter(c => 
            c.name.toLowerCase().includes(lower) || 
            c.adminEmail?.toLowerCase().includes(lower) ||
            c.firebaseProjectId.toLowerCase().includes(lower)
        );
    }
    
    return processed;
  }, [rawCompanies, searchQuery]);

  const handleToggleActive = async (company: Company) => {
    if (!firestore) return;
    setIsProcessing(company.id!);
    try {
        await updateDoc(doc(firestore, 'companies', company.id!), { isActive: !company.isActive });
        toast({ title: 'نجاح التغيير', description: `تم ${!company.isActive ? 'تفعيل' : 'تعطيل'} المنشأة بنجاح.` });
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ في التحديث' });
    } finally {
        setIsProcessing(null);
    }
  };

  const handleSwitchToCompany = async (company: Company) => {
      if (!clientAuth?.currentUser || isProcessing) return;
      
      setIsProcessing(company.id!);
      try {
          const response = await fetch('/api/switch-company', {
              method: 'POST',
              body: JSON.stringify({
                  uid: clientAuth.currentUser.uid,
                  companyId: company.id,
                  companyName: company.name
              })
          });

          const result = await response.json();
          if (result.success) {
              await clientAuth.currentUser.getIdToken(true);
              document.cookie = 'nova-user-session=1; path=/; max-age=86400';
              setCurrentCompany(company);
              toast({ 
                  title: 'تم تفعيل التقمص السيادي', 
                  description: `أنت الآن في وضع التحكم بـ ${company.name}.` 
              });
              window.location.href = '/dashboard';
          } else {
              throw new Error(result.error);
          }
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'فشل التبديل', description: e.message });
      } finally {
          setIsProcessing(null);
      }
  };

  return (
    <div className="space-y-10" dir="rtl">
        {/* Header Section */}
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-[#1e1b4b]">
            <CardHeader className="p-10 pb-8 bg-indigo-950/60 border-b border-white/10">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-600 rounded-[2.2rem] shadow-[0_0_40px_rgba(79,70,229,0.5)] border-2 border-white/20">
                            <Terminal className="h-10 w-10 text-white" />
                        </div>
                        <div className="text-right">
                            <CardTitle className="text-4xl font-black text-white tracking-tighter">غرفة التحكم الكبرى</CardTitle>
                            <CardDescription className="text-indigo-200 font-bold text-lg opacity-80 mt-1">إدارة البنية التحتية والولوج السيادي لكافة المنشآت.</CardDescription>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <Badge className="bg-green-500 text-white font-black px-6 py-1.5 rounded-full border-2 border-white/20 shadow-lg animate-pulse uppercase tracking-widest">Master Node: Connected</Badge>
                    </div>
                </div>
            </CardHeader>
        </Card>

        {error && (
            <Alert variant="destructive" className="rounded-2xl border-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-black">خطأ في جلب البيانات السيادية</AlertTitle>
                <AlertDescription className="font-medium">
                    {error.message || "حدثت مشكلة أثناء محاولة الاتصال بقاعدة بيانات المنشآت."}
                </AlertDescription>
            </Alert>
        )}

        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-white/95 border border-white/40">
                <CardHeader className="p-10 border-b-4 border-[#1e1b4b] bg-slate-50">
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                        <div className="relative w-full max-w-xl group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-indigo-600" />
                            <Input 
                                placeholder="بحث سيادي في قائمة المنشآت..." 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)} 
                                className="pl-14 h-14 rounded-3xl border-2 border-slate-200 bg-white text-black font-black text-xl placeholder:text-slate-400 shadow-inner focus:ring-4 focus:ring-indigo-100 transition-all"
                            />
                        </div>
                        <Button onClick={() => { setSelectedCompanyForEdit(null); setIsRegistrationOpen(true); }} className="h-14 px-12 rounded-[2rem] font-black text-xl gap-3 bg-[#1e1b4b] text-white hover:bg-black shadow-2xl transition-all">
                            <PlusCircle className="h-6 w-6" /> إضافة منشأة جديدة
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto min-h-[400px]">
                        <Table>
                            <TableHeader className="bg-[#1e1b4b] h-16">
                                <TableRow className="border-none hover:bg-transparent">
                                    <TableHead className="px-12 font-black text-white text-base text-right">المنشأة</TableHead>
                                    <TableHead className="font-black text-indigo-100 text-base text-center">ID المشروع</TableHead>
                                    <TableHead className="font-black text-indigo-100 text-base text-center">حالة الخدمة</TableHead>
                                    <TableHead className="text-left px-12 font-black text-indigo-100 text-base">التحكم والتقمص</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center p-40">
                                            <div className="flex flex-col items-center gap-4">
                                                <Loader2 className="animate-spin h-16 w-16 text-indigo-500" />
                                                <p className="font-black text-indigo-600 animate-pulse">جاري جلب قائمة المنشآت من السحابة...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredCompanies.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-80 text-center text-slate-300 italic font-black text-2xl tracking-widest uppercase">No Active Entities Found</TableCell></TableRow>
                                ) : (
                                    filteredCompanies.map(company => (
                                        <TableRow key={company.id} className="h-32 hover:bg-indigo-50/50 border-slate-100 group transition-all">
                                            <TableCell className="px-12">
                                                <div className="flex items-center gap-6">
                                                    <div className="p-4 bg-indigo-100 rounded-3xl border-2 border-indigo-200 group-hover:bg-[#1e1b4b] transition-all shadow-inner">
                                                        <Building2 className="h-10 w-10 text-indigo-600 group-hover:text-white" />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-black text-black text-2xl tracking-tight leading-none">{company.name}</span>
                                                        <span className="text-[10px] text-indigo-600 font-black uppercase tracking-widest opacity-60">{company.adminEmail}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="bg-white px-6 py-2 rounded-xl border-2 border-slate-200 mx-auto font-mono font-black text-xs text-slate-600 shadow-sm">
                                                    {company.firebaseProjectId}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className={cn("px-6 py-1.5 rounded-full font-black text-[10px] tracking-widest border-2", company.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')}>
                                                    {company.isActive ? 'ACTIVE' : 'SUSPENDED'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-left px-12">
                                                <div className="flex justify-end gap-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                    <Button 
                                                        variant="default" 
                                                        className="rounded-2xl font-black gap-3 bg-indigo-600 text-white hover:bg-indigo-700 h-12 shadow-xl px-8 border-b-4 border-indigo-900"
                                                        onClick={() => handleSwitchToCompany(company)}
                                                        disabled={isProcessing === company.id}
                                                    >
                                                        {isProcessing === company.id ? <Loader2 className="h-5 w-5 animate-spin"/> : <ArrowRightLeft className="h-5 w-5" />}
                                                        دخول كـ Super Admin
                                                    </Button>
                                                    
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-white border-2 border-slate-200 text-[#1e1b4b] hover:bg-slate-50 shadow-md">
                                                                <MoreHorizontal className="h-6 w-6" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" dir="rtl" className="rounded-[2rem] shadow-2xl p-3 bg-white border-none w-72">
                                                            <DropdownMenuLabel className="font-black px-3 py-2">خيارات المنشأة</DropdownMenuLabel>
                                                            <DropdownMenuItem onClick={() => { setSelectedCompanyForEdit(company); setIsRegistrationOpen(true); }} className="gap-3 rounded-xl py-4 px-4 font-black text-base cursor-pointer hover:bg-indigo-50">
                                                                <Pencil className="h-5 w-5 text-indigo-600" /> تعديل بيانات الربط
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleToggleActive(company)} disabled={isProcessing === company.id} className={cn("gap-3 rounded-xl py-4 px-4 font-black text-base cursor-pointer", company.isActive ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50")}>
                                                                {company.isActive ? <PowerOff className="h-5 w-5" /> : <Power className="h-5 w-5" />}
                                                                {company.isActive ? 'تعطيل الخدمة' : 'تفعيل الخدمة'}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>

        <CompanyRegistrationForm 
            isOpen={isRegistrationOpen} 
            onClose={() => setIsRegistrationOpen(false)} 
            company={selectedCompanyForEdit}
        />
    </div>
  );
}
