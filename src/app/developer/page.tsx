'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirebase, useSubscription } from '@/firebase';
import { doc, updateDoc, collection, addDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import type { Company } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Building2, UserCog, Power, PowerOff, LayoutGrid, Search, Loader2, Key } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { useToast } from '@/hooks/use-toast';
import { cn, formatCurrency } from '@/lib/utils';

export default function DeveloperDashboard() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

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
        toast({ title: 'نجاح', description: `تم ${!company.isActive ? 'تفعيل' : 'تعطيل'} الشركة.` });
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ' });
    } finally {
        setIsProcessing(null);
    }
  };

  return (
    <div className="space-y-8" dir="rtl">
        <Tabs defaultValue="companies" className="w-full">
            <div className="flex justify-center mb-10">
                <TabsList className="bg-slate-900/50 p-1.5 rounded-[2rem] border border-white/10 h-auto shadow-2xl backdrop-blur-md">
                    <TabsTrigger value="companies" className="rounded-[1.5rem] font-black gap-2 px-10 py-3 text-white/60 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-xl transition-all">
                        <Building2 className="h-5 w-5" /> إدارة الشركات المستأجرة
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="rounded-[1.5rem] font-black gap-2 px-10 py-3 text-white/60 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-xl transition-all">
                        <UserCog className="h-5 w-5" /> إعدادات النظام الماستر
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="companies" className="space-y-6">
                <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-slate-900/40 backdrop-blur-xl border border-white/5">
                    <CardHeader className="bg-white/5 border-b border-white/10 pb-8 p-10">
                        <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                            <div className="space-y-1 text-center lg:text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tight">سجل المستأجرين (Tenants)</CardTitle>
                                <CardDescription className="text-indigo-300 font-bold">متابعة كافة المشاريع الفرعية والتحكم في وصول الخدمات.</CardDescription>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                                <div className="relative flex-grow lg:w-80">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400" />
                                    <Input 
                                        placeholder="ابحث باسم الشركة..." 
                                        value={searchQuery} 
                                        onChange={e => setSearchQuery(e.target.value)} 
                                        className="pl-10 h-12 rounded-2xl border-white/10 bg-white/5 text-white font-bold"
                                    />
                                </div>
                                <Button className="h-12 px-8 rounded-2xl font-black gap-2 bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-900/20">
                                    <PlusCircle className="h-5 w-5" /> إضافة شركة جديدة
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-white/5 h-16">
                                <TableRow className="border-white/5">
                                    <TableHead className="px-10 font-black text-indigo-200">الاسم التجاري</TableHead>
                                    <TableHead className="font-black text-indigo-200">معرف المشروع (Firebase)</TableHead>
                                    <TableHead className="font-black text-indigo-200">تاريخ الانضمام</TableHead>
                                    <TableHead className="font-black text-indigo-200 text-center">الحالة</TableHead>
                                    <TableHead className="text-left px-10 font-black text-indigo-200">الإجراء</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={5} className="text-center p-32"><Loader2 className="animate-spin h-12 w-12 mx-auto text-indigo-500" /></TableCell></TableRow>
                                ) : filteredCompanies.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-64 text-center text-indigo-300/40 italic font-black text-xl">لا توجد شركات مسجلة في مشروع الماستر.</TableCell></TableRow>
                                ) : (
                                    filteredCompanies.map(company => (
                                        <TableRow key={company.id} className="h-24 hover:bg-white/5 border-white/5 group transition-colors">
                                            <TableCell className="px-10">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-white/5 rounded-2xl border border-white/10 group-hover:bg-indigo-600/20 transition-colors"><Building2 className="h-6 w-6 text-indigo-400" /></div>
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-white text-lg leading-none mb-1">{company.name}</span>
                                                        <Badge variant="outline" className="w-fit text-[8px] h-4 font-black bg-indigo-500/10 text-indigo-400 border-indigo-500/20">TENANT ID: {company.id?.substring(0,8)}</Badge>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-[10px] text-white/40">{company.firebaseProjectId}</TableCell>
                                            <TableCell className="text-xs font-bold text-white/60">
                                                {format(toFirestoreDate(company.createdAt)!, 'dd MMMM yyyy', { locale: ar })}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className={cn("px-4 py-1 rounded-full font-black text-[10px]", company.isActive ? 'bg-green-600 text-white' : 'bg-red-600 text-white')}>
                                                    {company.isActive ? 'نشطة (ONLINE)' : 'معطلة (OFFLINE)'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-left px-10">
                                                <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="outline" size="sm" className="rounded-xl font-bold gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 h-10">
                                                        <LayoutGrid className="h-4 w-4" /> فحص البيانات
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

            <TabsContent value="settings">
                <div className="grid md:grid-cols-2 gap-8">
                    <Card className="rounded-[2.5rem] border-none shadow-2xl bg-slate-900/40 backdrop-blur-xl border border-white/5 p-8">
                        <CardHeader className="px-0 pt-0">
                            <CardTitle className="text-xl font-black text-white flex items-center gap-2">
                                <Key className="text-indigo-400 h-5 w-5"/>
                                بيانات حساب الجذر
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-0 space-y-6">
                            <div className="grid gap-2">
                                <Label className="text-indigo-300 font-bold">اسم المطور</Label>
                                <Input value="Nova Root Developer" disabled className="h-11 rounded-xl bg-white/5 border-white/10 text-white font-bold" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-indigo-300 font-bold">البريد السيادي</Label>
                                <Input value="dev@nova-erp.local" disabled className="h-11 rounded-xl bg-white/5 border-white/10 text-white font-mono" />
                            </div>
                            <Button className="w-full h-12 rounded-xl font-black bg-white/10 text-white border border-white/20 hover:bg-white/20">
                                تغيير كلمة المرور السيادية
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
        </Tabs>
    </div>
  );
}
