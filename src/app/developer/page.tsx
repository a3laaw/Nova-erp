
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
import { PlusCircle, Building2, Power, PowerOff, LayoutGrid, Search, Loader2, Terminal, Globe, Pencil, MoreHorizontal, ShieldCheck, DatabaseZap } from 'lucide-react';
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

  const handleEditCompany = (company: Company) => {
      setSelectedCompanyForEdit(company);
      setIsRegistrationOpen(true);
  };

  const handleOpenNewCompany = () => {
      setSelectedCompanyForEdit(null);
      setIsRegistrationOpen(true);
  };

  return (
    <div className="space-y-10" dir="rtl">
        {/* ترويسة المطور السيادية - Glass Diamond Style */}
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden glass-effect">
            <CardHeader className="p-10 pb-8 bg-indigo-950/40 border-b border-white/10">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-600 rounded-[2.2rem] shadow-[0_0_40px_rgba(79,70,229,0.5)] border-2 border-white/20">
                            <Terminal className="h-10 w-10 text-white" />
                        </div>
                        <div className="space-y-1">
                            <CardTitle className="text-4xl font-black text-white tracking-tighter drop-shadow-lg">غرفة التحكم الكبرى</CardTitle>
                            <CardDescription className="text-indigo-200 font-bold text-lg opacity-80">إدارة البنية التحتية السحابية والشركات المستأجرة لـ Nova ERP.</CardDescription>
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
                <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden glass-effect">
                    <CardHeader className="p-10 border-b border-white/10 bg-indigo-950/50">
                        <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                            <div className="relative w-full max-w-xl group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-400 transition-colors group-focus-within:text-white" />
                                <Input 
                                    placeholder="بحث سيادي في قاعدة البيانات العالمية..." 
                                    value={searchQuery} 
                                    onChange={e => setSearchQuery(e.target.value)} 
                                    className="pl-12 h-14 rounded-3xl border-white/20 bg-white/5 text-white font-black text-lg placeholder:text-white/20 shadow-inner focus:bg-white/10 transition-all border-2"
                                />
                            </div>
                            <Button onClick={handleOpenNewCompany} className="h-14 px-12 rounded-[2rem] font-black text-xl gap-3 bg-white text-indigo-950 hover:bg-indigo-50 shadow-2xl shadow-indigo-500/20 border-b-4 border-indigo-200 active:translate-y-1 active:border-b-0 transition-all">
                                <PlusCircle className="h-6 w-6" /> إضافة منشأة هندسية
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-white/5 h-20">
                                    <TableRow className="border-white/10 border-b-2">
                                        <TableHead className="px-12 font-black text-white text-lg">المنشأة الهندسية</TableHead>
                                        <TableHead className="font-black text-indigo-200 text-lg">Firebase Infrastructure</TableHead>
                                        <TableHead className="font-black text-indigo-200 text-lg">الحالة</TableHead>
                                        <TableHead className="text-left px-12 font-black text-indigo-200 text-lg">إجراءات التحكم</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={4} className="text-center p-40"><Loader2 className="animate-spin h-16 w-16 mx-auto text-indigo-500 opacity-50" /></TableCell></TableRow>
                                    ) : filteredCompanies.length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="h-80 text-center text-white/10 italic font-black text-3xl tracking-widest uppercase">No Active Tenants Found</TableCell></TableRow>
                                    ) : (
                                        filteredCompanies.map(company => (
                                            <TableRow key={company.id} className="h-28 hover:bg-white/10 border-white/5 group transition-all">
                                                <TableCell className="px-12">
                                                    <div className="flex items-center gap-6">
                                                        <div className="p-4 bg-white/5 rounded-3xl border border-white/10 group-hover:bg-indigo-600 transition-all shadow-inner group-hover:shadow-indigo-500/40">
                                                            <Building2 className="h-8 w-8 text-indigo-400 group-hover:text-white" />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="font-black text-white text-2xl tracking-tight">{company.name}</span>
                                                            <span className="text-xs text-indigo-300 font-bold uppercase tracking-[0.2em] opacity-60">{company.adminEmail}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-sm text-white/70 font-black">
                                                    <div className="bg-black/20 w-fit px-4 py-1.5 rounded-xl border border-white/5">
                                                        {company.firebaseProjectId}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={cn("px-6 py-1.5 rounded-full font-black text-xs tracking-widest", company.isActive ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-inner')}>
                                                        {company.isActive ? 'ACTIVE' : 'SUSPENDED'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-left px-12">
                                                    <div className="flex justify-end gap-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                        <Button 
                                                            variant="outline" 
                                                            className="rounded-2xl font-black gap-3 border-white/20 bg-white/5 text-white hover:bg-indigo-600 h-12 shadow-xl px-6 border-2"
                                                            onClick={() => handleEnterAsCompany(company)}
                                                        >
                                                            <Globe className="h-5 w-5" /> الدخول للنظام
                                                        </Button>
                                                        
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/20">
                                                                    <MoreHorizontal className="h-6 w-6" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" dir="rtl" className="rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.5)] p-3 bg-slate-950 border-white/10 text-white w-72 animate-in zoom-in-95">
                                                                <DropdownMenuLabel className="font-black px-4 py-3 text-indigo-400 uppercase tracking-widest text-xs">Sovereign Commands</DropdownMenuLabel>
                                                                <DropdownMenuSeparator className="bg-white/10" />
                                                                <DropdownMenuItem onClick={() => handleEditCompany(company)} className="gap-3 rounded-xl py-4 px-4 font-black text-base cursor-pointer hover:bg-indigo-600 transition-colors">
                                                                    <Pencil className="h-5 w-5 text-indigo-400" /> تعديل بيانات المنشأة
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleToggleActive(company)} disabled={isProcessing === company.id} className={cn("gap-3 rounded-xl py-4 px-4 font-black text-base cursor-pointer transition-colors", company.isActive ? "text-red-400 hover:bg-red-600/20" : "text-green-400 hover:bg-green-600/20")}>
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
