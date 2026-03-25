
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
import { PlusCircle, Building2, Power, PowerOff, LayoutGrid, Search, Loader2, Terminal, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CompanyRegistrationForm } from '@/components/developer/company-registration-form';
import { useCompany } from '@/context/company-context';
import { useRouter } from 'next/navigation';

export default function DeveloperDashboard() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const { setCurrentCompany } = useCompany();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);

  const { data: companies, loading } = useSubscription<Company>(firestore, 'companies', [orderBy('createdAt', 'desc')]);

  const filteredCompanies = useMemo(() => {
    if (!searchQuery) return companies;
    return companies.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
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
        {/* ترويسة المطور السيادية */}
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/10 backdrop-blur-3xl border border-white/20">
            <CardHeader className="p-10 pb-8">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-600 rounded-[2rem] shadow-[0_0_30px_rgba(79,70,229,0.4)]">
                            <Terminal className="h-10 w-10 text-white" />
                        </div>
                        <div className="space-y-1">
                            <CardTitle className="text-4xl font-black text-white tracking-tighter">لوحة تحكم الماستر</CardTitle>
                            <CardDescription className="text-indigo-200 font-bold text-lg">إدارة الشركات المستأجرة والبنية التحتية السحابية لـ Nova ERP.</CardDescription>
                        </div>
                    </div>
                    
                    <div className="flex gap-3">
                        <Badge className="bg-green-600 text-white font-black px-6 py-2 rounded-full shadow-lg">LIVE STATUS: ONLINE</Badge>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <Tabs defaultValue="companies" className="w-full">
            <div className="flex justify-start mb-8 px-4">
                <TabsList className="bg-white/5 p-1.5 rounded-[2rem] border border-white/10 h-auto backdrop-blur-xl">
                    <TabsTrigger value="companies" className="rounded-[1.5rem] font-black gap-2 px-10 py-3 text-white/60 data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
                        <Building2 className="h-5 w-5" /> الشركات المستأجرة
                    </TabsTrigger>
                    <TabsTrigger value="infra" className="rounded-[1.5rem] font-black gap-2 px-10 py-3 text-white/60 data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
                        <LayoutGrid className="h-5 w-5" /> البنية التحتية
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="companies" className="space-y-6">
                <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/5 backdrop-blur-2xl border border-white/10">
                    <CardHeader className="p-8 border-b border-white/5">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="relative w-full max-w-md group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400 transition-colors group-focus-within:text-white" />
                                <Input 
                                    placeholder="بحث باسم الشركة المستأجرة..." 
                                    value={searchQuery} 
                                    onChange={e => setSearchQuery(e.target.value)} 
                                    className="pl-10 h-12 rounded-2xl border-white/10 bg-white/5 text-white font-bold placeholder:text-white/30"
                                />
                            </div>
                            <Button onClick={() => setIsRegistrationOpen(true)} className="h-12 px-8 rounded-2xl font-black text-lg gap-2 bg-white text-indigo-900 hover:bg-white/90 shadow-xl">
                                <PlusCircle className="h-5 w-5" /> إضافة شركة جديدة
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-white/5 h-16">
                                <TableRow className="border-white/5">
                                    <TableHead className="px-10 font-black text-indigo-200">المنشأة</TableHead>
                                    <TableHead className="font-black text-indigo-200">Firebase Project</TableHead>
                                    <TableHead className="font-black text-indigo-200">الحالة التشغيلية</TableHead>
                                    <TableHead className="text-left px-10 font-black text-indigo-200">التحكم السيادي</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={4} className="text-center p-32"><Loader2 className="animate-spin h-12 w-12 mx-auto text-indigo-500" /></TableCell></TableRow>
                                ) : filteredCompanies.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-64 text-center text-white/20 italic font-black text-xl">لا توجد منشآت نشطة حالياً.</TableCell></TableRow>
                                ) : (
                                    filteredCompanies.map(company => (
                                        <TableRow key={company.id} className="h-24 hover:bg-white/5 border-white/5 group transition-colors">
                                            <TableCell className="px-10">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-white/5 rounded-2xl border border-white/10 group-hover:bg-indigo-600 transition-colors"><Building2 className="h-6 w-6 text-indigo-400 group-hover:text-white" /></div>
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-white text-lg">{company.name}</span>
                                                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{company.adminEmail}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-[10px] text-white/40">{company.firebaseProjectId}</TableCell>
                                            <TableCell>
                                                <Badge className={cn("px-4 py-1 rounded-full font-black text-[10px]", company.isActive ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-red-600/20 text-red-400 border border-red-500/30')}>
                                                    {company.isActive ? 'ONLINE / ACTIVE' : 'OFFLINE / SUSPENDED'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-left px-10">
                                                <div className="flex justify-end gap-3">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="rounded-xl font-bold gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 h-10"
                                                        onClick={() => handleEnterAsCompany(company)}
                                                    >
                                                        <Globe className="h-4 w-4" /> دخول كالمنشأة
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={() => handleToggleActive(company)}
                                                        disabled={isProcessing === company.id}
                                                        className={cn("h-10 w-10 rounded-xl transition-all shadow-xl", company.isActive ? "text-red-400 bg-red-500/10 hover:bg-red-500 hover:text-white" : "text-green-400 bg-green-500/10 hover:bg-green-500 hover:text-white")}
                                                    >
                                                        {isProcessing === company.id ? <Loader2 className="h-5 w-5 animate-spin" /> : 
                                                         company.isActive ? <PowerOff className="h-5 w-5" /> : <Power className="h-5 w-5" />}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

        <CompanyRegistrationForm 
            isOpen={isRegistrationOpen} 
            onClose={() => setIsRegistrationOpen(false)} 
        />
    </div>
  );
}
