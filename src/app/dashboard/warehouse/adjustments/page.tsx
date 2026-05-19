'use client';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, RotateCcw, Ban, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useSubscription } from '@/firebase';
import { where, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { InventoryAdjustment, JournalEntry } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { formatCurrency, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const typeTranslations: Record<string, string> = {
    damage: 'تلف مواد',
    theft: 'فقد / سرقة',
    purchase_return: 'مرتجع مشتريات',
    sales_return: 'مرتجع مبيعات',
    material_issue: 'صرف مواد',
    other: 'تسوية أخرى'
};

export default function AdjustmentsPage() {
    const { firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();
    const [itemToDelete, setItemToDelete] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    
    const adjQuery = useMemo(() => [
        orderBy('date', 'desc')
    ], []);
    
    const { data: allAdjustments, loading, error } = useSubscription<InventoryAdjustment>(firestore, 'inventoryAdjustments', adjQuery);

    const { data: journalEntries } = useSubscription<JournalEntry>(firestore, 'journalEntries');
    const existingJeIds = useMemo(() => new Set(journalEntries.map(d => d.id)), [journalEntries]);

    const filteredAdjustments = useMemo(() => {
        if (activeTab === 'all') return allAdjustments;
        if (activeTab === 'returns') return allAdjustments.filter(a => ['purchase_return', 'sales_return'].includes(a.type));
        if (activeTab === 'losses') return allAdjustments.filter(a => ['damage', 'theft'].includes(a.type));
        return allAdjustments;
    }, [allAdjustments, activeTab]);

    const handleDelete = async () => {
        if (!itemToDelete || !firestore) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'inventoryAdjustments', itemToDelete.id!));
            toast({ title: 'نجاح', description: 'تم حذف السجل بنجاح.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف السجل.' });
        } finally {
            setIsDeleting(false);
            setItemToDelete(null);
        }
    };

    return (
        <div className="space-y-10" dir="rtl">
            {/* 🛡️ الهيدر الرئيسي السيادي المحدث بالهوية البرتقالية 🛡️ */}
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">المردودات والتسويات المخزنية</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-bold text-sm">متابعة إرجاع المواد للموردين، مرتجعات العملاء، وحالات التلف أو العجز المكتشف.</CardDescription>
                                </div>
                            </div>
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                <RotateCcw className="h-10 w-10 text-white" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button asChild variant="outline" className="h-12 px-6 rounded-2xl font-black gap-2 bg-white/20 text-white border-white/40 hover:bg-white/30 backdrop-blur-md">
                                <Link href="/dashboard/warehouse/adjustments/new?type=purchase_return">
                                    إرجاع لمورد
                                </Link>
                            </Button>
                            <Button asChild className="h-12 px-8 rounded-2xl font-black gap-2 bg-white text-[#FF7A00] shadow-xl hover:bg-slate-50 border-none">
                                <Link href="/dashboard/warehouse/adjustments/new?type=damage">
                                    <PlusCircle className="h-5 w-5" /> إضافة تسوية
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/95">
                <CardContent className="pt-8">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="flex justify-center mb-8">
                            <TabsList className="w-full max-w-2xl h-14 bg-muted/50 p-1 rounded-2xl border">
                                <TabsTrigger value="all" className="rounded-xl flex-1 font-black">كافة السجلات ({allAdjustments.length})</TabsTrigger>
                                <TabsTrigger value="returns" className="rounded-xl flex-1 font-black">المردودات (Ret)</TabsTrigger>
                                <TabsTrigger value="losses" className="rounded-xl flex-1 font-black">التوالف والعجز</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader className="bg-[#F8F9FE]">
                                    <TableRow className="border-none">
                                        <TableHead className="px-8 py-5 font-black text-[#7209B7]">رقم السند</TableHead>
                                        <TableHead className="font-black text-[#7209B7]">التاريخ</TableHead>
                                        <TableHead className="font-black text-[#7209B7]">النوع</TableHead>
                                        <TableHead className="text-left font-black text-[#7209B7]">القيمة</TableHead>
                                        <TableHead className="text-center font-black text-[#7209B7]">إجراء</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? <TableRow><TableCell colSpan={5} className="p-8"><Skeleton className="h-10 w-full rounded-2xl"/></TableCell></TableRow> :
                                    filteredAdjustments.length === 0 ? <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground font-bold italic">لا توجد سجلات.</TableCell></TableRow> :
                                    filteredAdjustments.map(adj => (
                                        <TableRow key={adj.id} className="hover:bg-[#F3E8FF]/20 h-16 group transition-colors">
                                            <TableCell className="px-8 font-mono font-black text-primary"><Link href={`/dashboard/warehouse/adjustments/${adj.id}`} className="hover:underline">{adj.adjustmentNumber}</Link></TableCell>
                                            <TableCell className="font-bold text-xs opacity-60">{formatDate(adj.date)}</TableCell>
                                            <TableCell><Badge variant="outline" className="px-3 font-black text-[10px] bg-white">{typeTranslations[adj.type] || adj.type}</Badge></TableCell>
                                            <TableCell className="text-left font-mono font-black text-[#2E5BCC] text-lg">{formatCurrency(adj.items?.reduce((s,i) => s + (i.totalCost || 0), 0) || 0)}</TableCell>
                                            <TableCell className="text-center">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border group-hover:border-primary/20"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" dir="rtl" className="rounded-xl p-2 shadow-2xl border-none">
                                                        <DropdownMenuItem asChild className="rounded-lg py-3"><Link href={`/dashboard/warehouse/adjustments/${adj.id}`} className="gap-2 font-bold"><Eye className="h-4 w-4"/> عرض</Link></DropdownMenuItem>
                                                        <DropdownMenuItem className="text-red-600 font-black gap-2 rounded-lg py-3 focus:bg-red-50" onClick={() => setItemToDelete(adj)}><Trash2 className="ml-2 h-4 w-4" /> حذف</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Tabs>
                </CardContent>
            </Card>

            <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
                <AlertDialogContent dir="rtl" className="rounded-3xl shadow-2xl border-none">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black text-red-700">تأكيد الحذف النهائي؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-base font-medium leading-relaxed">
                            سيتم حذف السجل نهائياً من النظام. يرجى مراجعة القيود المحاسبية المرتبطة.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6 gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold">إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 rounded-xl font-black px-8">
                            {isDeleting ? <Loader2 className="animate-spin ml-2 h-4 w-4"/> : 'نعم، حذف السجل'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
