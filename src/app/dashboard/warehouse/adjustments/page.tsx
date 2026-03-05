
'use client';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Ban, Loader2, MoreHorizontal, Eye, Trash2, RotateCcw, AlertCircle } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-red-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-600/10 rounded-2xl text-red-600 shadow-inner">
                                <RotateCcw className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black">المردودات والتسويات المخزنية</CardTitle>
                                <CardDescription className="text-base font-medium">متابعة إرجاع المواد للموردين، مرتجعات العملاء، وعجز التوالف والسرقة.</CardDescription>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button asChild variant="outline" className="h-11 px-6 rounded-xl font-bold gap-2 border-primary text-primary hover:bg-primary/5">
                                <Link href="/dashboard/warehouse/adjustments/new?type=purchase_return">
                                    <PlusCircle className="h-4 w-4" />
                                    مردود مشتريات
                                </Link>
                            </Button>
                            <Button asChild className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-red-100 bg-red-600 hover:bg-red-700">
                                <Link href="/dashboard/warehouse/adjustments/new?type=damage">
                                    <Ban className="ml-2 h-5 w-5" />
                                    تسجيل توالف
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="pt-8">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1.5 rounded-2xl h-auto mb-8">
                            <TabsTrigger value="all" className="rounded-xl py-3 font-black">كافة السجلات ({allAdjustments.length})</TabsTrigger>
                            <TabsTrigger value="returns" className="rounded-xl py-3 font-black">المردودات (Ret)</TabsTrigger>
                            <TabsTrigger value="losses" className="rounded-xl py-3 font-black text-red-600">التوالف والعجز</TabsTrigger>
                        </TabsList>

                        <div className="border rounded-2xl overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="px-6 font-bold">رقم الإذن</TableHead>
                                        <TableHead>التاريخ</TableHead>
                                        <TableHead>النوع</TableHead>
                                        <TableHead>الملاحظات</TableHead>
                                        <TableHead className="text-left">القيمة</TableHead>
                                        <TableHead className="w-[80px] text-center"><span className="sr-only">الإجراءات</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={6} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                                    ) : filteredAdjustments.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">لا توجد سجلات مطابقة.</TableCell></TableRow>
                                    ) : (
                                        filteredAdjustments.map(adj => {
                                            const hasIntegrityError = !adj.journalEntryId || !existingJeIds.has(adj.journalEntryId);
                                            return (
                                                <TableRow key={adj.id} className={cn("hover:bg-muted/30 h-16", hasIntegrityError && "bg-red-50/20")}>
                                                    <TableCell className="px-6 font-mono font-bold text-primary">
                                                        <Link href={`/dashboard/warehouse/adjustments/${adj.id}`} className="hover:underline">
                                                            {adj.adjustmentNumber}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell>{toFirestoreDate(adj.date) ? format(toFirestoreDate(adj.date)!, 'dd/MM/yyyy') : '-'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={cn(
                                                            "font-bold px-3",
                                                            adj.type.includes('return') ? 'bg-blue-50 text-blue-700' : 
                                                            ['damage', 'theft'].includes(adj.type) ? 'bg-red-50 text-red-700' : ''
                                                        )}>
                                                            {typeTranslations[adj.type] || adj.type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs max-w-xs truncate italic text-muted-foreground">{adj.notes}</TableCell>
                                                    <TableCell className="text-left font-mono font-black text-primary">
                                                        {formatCurrency(adj.items?.reduce((sum, i) => sum + (i.totalCost || 0), 0) || 0)}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreHorizontal className="h-4 w-4" /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" dir="rtl" className="rounded-xl">
                                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/warehouse/adjustments/${adj.id}`)}>
                                                                    <Eye className="ml-2 h-4 w-4" /> عرض السجل
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => setItemToDelete(adj)} className="text-destructive">
                                                                    <Trash2 className="ml-2 h-4 w-4" /> حذف نهائياً
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Tabs>
                </CardContent>
            </Card>

            <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
                <AlertDialogContent dir="rtl" className="rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black">حذف سجل التسوية؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم مسح هذا السجل نهائياً. يرجى مراجعة القيد المحاسبي المرتبط قبل الحذف لضمان سلامة موازين المراجعة.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold">
                            {isDeleting ? <Loader2 className="animate-spin ml-2 h-4 w-4"/> : 'نعم، حذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
