'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirebase, useSubscription } from '@/firebase';
import { doc, updateDoc, collection, orderBy, query } from 'firebase/firestore';
import type { Company } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Building2, Power, PowerOff, Search, Loader2, Terminal, Globe, Pencil, MoreHorizontal, DatabaseZap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CompanyRegistrationForm } from '@/components/developer/company-registration-form';
import { useCompany } from '@/context/company-context';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function DeveloperDashboard() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const { setCurrentCompany } = useCompany();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [selectedCompanyForEdit, setSelectedCompanyForEdit] = useState<Company | null>(null);

  const { data: companies, loading } = useSubscription<Company>(firestore, 'companies', [orderBy('createdAt', 'desc')]);

  const filteredCompanies = useMemo(() => {
    if (!searchQuery) return companies;
    const lower = searchQuery.toLowerCase();
    return companies.filter(c => 
        c.name.toLowerCase().includes(lower) || 
        c.adminEmail.toLowerCase().includes(lower) ||
        c.firebaseProjectId.toLowerCase().includes(lower)
    );
  }, [companies, searchQuery]);

  const handleToggleActive = async (company: Company) => {
    if (!firestore) return;
    setIsProcessing(company.id!);
    try {
        await updateDoc(doc(firestore, 'companies', company.id!), { isActive: !company.isActive });
        toast({ title: 'نجاح التغيير', description: `تم ${!company.isActive ? 'تفعيل' : 'تعطيل'} الشركة بنجاح.` });
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ' });
    } finally {
        setIsProcessing(null);
    }
  };

  const handleEnterAsCompany = (company: Company) => {
      setCurrentCompany(company);
      toast({ title: 'دخول سيادي', description: `تم ربط الجلسة ببيئة عمل ${company.name}` });
      router.push('/dashboard');
  };

  return (
    <div className="space-y-10" dir="rtl">
        {/* Header Section */}
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden glass-effect">
            <CardHeader className="p-10 pb-8 bg-indigo-950/60 border-b border-white/10">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-600 rounded-[2.2rem] shadow-[0_0_40px_rgba(79,70,229,0.5)] border-2 border-white/20">
                            <Terminal className="h-10 w-10 text-white" />
                        </div>
                        <div className="text-right">
                            <CardTitle className="text-4xl font-black text-white tracking-tighter drop-shadow-lg">غرفة التحكم الكبرى</CardTitle>
                            <CardDescription className="text-indigo-200 font-bold text-lg opacity-80 mt-1">إدارة البنية التحتية السحابية والشركات المستأجرة لـ Nova ERP.</CardDescription>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <Badge className="bg-green-500 text-white font-black px-6 py-1.5 rounded-full border-2 border-white/20 shadow-lg animate-pulse">SYSTEM STATUS: ONLINE</Badge>
                            <span className="text-[10px] font-black text-indigo-300 mt-2 uppercase tracking-[0.3em]">Master Core v2.8</span>
                        </div>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <Tabs defaultValue="companies" className="w-full">
            <div className="flex justify-start mb-10 px-4">
                <TabsList className="bg-white/5 p-2 rounded-[2.5rem] border border-white/10 h-auto backdrop-blur-3xl shadow-inner">
                    <TabsTrigger value="companies" className="rounded-[2rem] font-black gap-2 px-12 py-4 text-white/40 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-2xl transition-all text-lg">
                        <Building2 className="h-6 w-6" /> الشركات المستأجرة
                    </TabsTrigger>
                    <TabsTrigger value="infra" className="rounded-[2rem] font-black gap-2 px-12 py-4 text-white/40 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-2xl transition-all text-lg">
                        <DatabaseZap className="h-6 w-6" /> البنية التحتية
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="companies" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-white/95 backdrop-blur-3xl border border-white/40">
                    <CardHeader className="p-10 border-b border-indigo-100 bg-indigo-50/50">
                        <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                            <div className="relative w-full max-w-xl group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-600" />
                                <Input 
                                    placeholder="بحث سيادي في قاعدة البيانات العالمية..." 
                                    value={searchQuery} 
                                    onChange={e => setSearchQuery(e.target.value)} 
                                    className="pl-12 h-14 rounded-3xl border-indigo-200 bg-white text-[#1e1b4b] font-black text-lg placeholder:text-slate-400 shadow-inner focus:ring-4 focus:ring-indigo-100 transition-all border-2"
                                />
                            </div>
                            <Button onClick={() => { setSelectedCompanyForEdit(null); setIsRegistrationOpen(true); }} className="h-14 px-12 rounded-[2rem] font-black text-xl gap-3 bg-[#1e1b4b] text-white hover:bg-black shadow-2xl shadow-indigo-500/20 active:translate-y-1 transition-all">
                                <PlusCircle className="h-6 w-6" /> إضافة منشأة هندسية
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-[#1e1b4b] h-16">
                                    <TableRow className="border-none hover:bg-transparent">
                                        <TableHead className="px-12 font-black text-white text-base">المنشأة الهندسية</TableHead>
                                        <TableHead className="font-black text-indigo-100 text-base text-center">FIREBASE INFRASTRUCTURE</TableHead>
                                        <TableHead className="font-black text-indigo-100 text-base text-center">الحالة</TableHead>
                                        <TableHead className="text-left px-12 font-black text-indigo-100 text-base">إجراءات التحكم</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={4} className="text-center p-40"><Loader2 className="animate-spin h-16 w-16 mx-auto text-indigo-500" /></TableCell></TableRow>
                                    ) : filteredCompanies.length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="h-80 text-center text-slate-300 italic font-black text-2xl tracking-widest uppercase">No Active Tenants Found</TableCell></TableRow>
                                    ) : (
                                        filteredCompanies.map(company => (
                                            <TableRow key={company.id} className="h-28 hover:bg-indigo-50/50 border-indigo-50 group transition-all">
                                                <TableCell className="px-12">
                                                    <div className="flex items-center gap-6">
                                                        <div className="p-4 bg-indigo-100 rounded-3xl border border-indigo-200 group-hover:bg-indigo-600 transition-all shadow-inner group-hover:shadow-indigo-500/40">
                                                            <Building2 className="h-8 w-8 text-indigo-600 group-hover:text-white" />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="font-black text-[#1e1b4b] text-2xl tracking-tight">{company.name}</span>
                                                            <span className="text-xs text-indigo-600 font-black uppercase tracking-[0.1em] opacity-60">{company.adminEmail}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="bg-slate-100 w-fit px-6 py-2 rounded-xl border border-slate-200 mx-auto font-mono font-black text-sm text-slate-600">
                                                        {company.firebaseProjectId}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className={cn("px-6 py-1.5 rounded-full font-black text-xs tracking-widest", company.isActive ? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-red-100 text-red-700 border-2 border-red-200')}>
                                                        {company.isActive ? 'ACTIVE' : 'SUSPENDED'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-left px-12">
                                                    <div className="flex justify-end gap-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                        <Button 
                                                            variant="outline" 
                                                            className="rounded-2xl font-black gap-3 border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white h-12 shadow-lg px-8 border-2"
                                                            onClick={() => handleEnterAsCompany(company)}
                                                        >
                                                            <Globe className="h-5 w-5" /> الدخول للنظام
                                                        </Button>
                                                        
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-white border border-indigo-100 text-indigo-600 hover:bg-indigo-50 shadow-md">
                                                                    <MoreHorizontal className="h-6 w-6" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" dir="rtl" className="rounded-[2rem] shadow-2xl p-3 bg-white border-indigo-50 w-72 animate-in zoom-in-95">
                                                                <DropdownMenuLabel className="font-black px-4 py-3 text-indigo-600 uppercase tracking-widest text-[10px]">Sovereign Commands</DropdownMenuLabel>
                                                                <DropdownMenuSeparator className="bg-indigo-50" />
                                                                <DropdownMenuItem onClick={() => { setSelectedCompanyForEdit(company); setIsRegistrationOpen(true); }} className="gap-3 rounded-xl py-4 px-4 font-black text-base cursor-pointer hover:bg-indigo-50 transition-colors">
                                                                    <Pencil className="h-5 w-5 text-indigo-600" /> تعديل بيانات المنشأة
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleToggleActive(company)} disabled={isProcessing === company.id} className={cn("gap-3 rounded-xl py-4 px-4 font-black text-base cursor-pointer transition-colors", company.isActive ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50")}>
                                                                    {company.isActive ? <PowerOff className="h-5 w-5" /> : <Power className="h-5 w-5" />}
                                                                    {company.isActive ? 'تعطيل الجلسات' : 'تفعيل الجلسات'}
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
            </TabsContent>
        </Tabs>

        <CompanyRegistrationForm 
            isOpen={isRegistrationOpen} 
            onClose={() => setIsRegistrationOpen(false)} 
            company={selectedCompanyForEdit}
        />
    </div>
  );
}