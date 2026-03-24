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
import { PlusCircle, Building2, UserCog, Power, PowerOff, LayoutGrid, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { useToast } from '@/hooks/use-toast';

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
    <div className="space-y-8">
        <Tabs defaultValue="companies" className="w-full">
            <TabsList className="bg-slate-200/50 p-1 rounded-2xl border mb-8 h-auto">
                <TabsTrigger value="companies" className="rounded-xl font-black gap-2 px-8 py-3 data-[state=active]:bg-white">
                    <Building2 className="h-4 w-4" /> إدارة الشركات المستأجرة
                </TabsTrigger>
                <TabsTrigger value="settings" className="rounded-xl font-black gap-2 px-8 py-3 data-[state=active]:bg-white">
                    <UserCog className="h-4 w-4" /> إعدادات حساب المطور
                </TabsTrigger>
            </TabsList>

            <TabsContent value="companies" className="space-y-6">
                <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-white">
                    <CardHeader className="bg-slate-50 border-b pb-6 p-8">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="space-y-1">
                                <CardTitle className="text-xl font-black text-slate-900">سجل الشركات والخدمات</CardTitle>
                                <CardDescription>متابعة كافة المستأجرين النشطين في منصة Nova ERP.</CardDescription>
                            </div>
                            <div className="flex gap-4 w-full md:w-auto">
                                <div className="relative flex-grow md:w-80">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input 
                                        placeholder="ابحث باسم الشركة..." 
                                        value={searchQuery} 
                                        onChange={e => setSearchQuery(e.target.value)} 
                                        className="pl-10 h-11 rounded-2xl border-2"
                                    />
                                </div>
                                <Button className="h-11 px-6 rounded-xl font-black gap-2 bg-blue-600 hover:bg-blue-700">
                                    <PlusCircle className="h-5 w-5" /> إضافة شركة جديدة
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-slate-50/50 h-14">
                                <TableRow>
                                    <TableHead className="px-8 font-black">الاسم التجاري</TableHead>
                                    <TableHead className="font-black">معرف المشروع (Firebase)</TableHead>
                                    <TableHead className="font-black">تاريخ الانضمام</TableHead>
                                    <TableHead className="font-black text-center">الحالة</TableHead>
                                    <TableHead className="text-left px-8 font-black">الإجراء</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={5} className="text-center p-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-blue-600" /></TableCell></TableRow>
                                ) : filteredCompanies.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic">لا توجد شركات مسجلة.</TableCell></TableRow>
                                ) : (
                                    filteredCompanies.map(company => (
                                        <TableRow key={company.id} className="h-20 hover:bg-slate-50 group">
                                            <TableCell className="px-8">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-slate-100 rounded-xl"><Building2 className="h-5 w-5 text-slate-600" /></div>
                                                    <span className="font-black text-slate-900">{company.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs opacity-60">{company.firebaseProjectId}</TableCell>
                                            <TableCell className="text-xs font-bold text-muted-foreground">
                                                {format(toFirestoreDate(company.createdAt)!, 'dd MMMM yyyy', { locale: ar })}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={company.isActive ? 'default' : 'secondary'} className={cn(company.isActive ? 'bg-green-600' : 'bg-slate-200 text-slate-600')}>
                                                    {company.isActive ? 'نشطة' : 'معطلة'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-left px-8">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" size="sm" className="rounded-xl font-bold gap-2">
                                                        <LayoutGrid className="h-4 w-4" /> إدارة البيانات
                                                    </Button>
                                                    <Button 
                                                        variant={company.isActive ? 'ghost' : 'default'} 
                                                        size="icon" 
                                                        onClick={() => handleToggleActive(company)}
                                                        disabled={isProcessing === company.id}
                                                        className={cn("h-9 w-9 rounded-xl", company.isActive ? "text-red-600 hover:bg-red-50" : "bg-green-600 text-white")}
                                                    >
                                                        {isProcessing === company.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                                                         company.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
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
    </div>
  );
}
