'use client';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Ban, Loader2, MoreHorizontal, Eye, Trash2, RotateCcw, AlertCircle, ShoppingCart, ArrowUpFromLine } from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useSubscription } from '@/firebase';
import { where, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { InventoryAdjustment } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
    
    // تم تعديل الاستعلام ليشمل كافة الأنواع لمنع التعليق (Spinner) وضمان ظهور المردودات
    const adjQuery = useMemo(() => [
        orderBy('date', 'desc')
    ], []);
    
    const { data: allAdjustments, loading, error } = useSubscription<InventoryAdjustment>(firestore, 'inventoryAdjustments', adjQuery);

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
            <Card className="rounded-3xl border-none shadow-sm bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black flex items-center gap-2">
                                <RotateCcw className="text-primary" />
                                سجل العمليات المخزنية الاستثنائية
                            </CardTitle>
                            <CardDescription>متابعة المردودات، التوالف، والعجز المخزني لضمان دقة الأرصدة.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button asChild variant="outline" size="sm" className="rounded-xl border-primary text-primary hover:bg-primary/5">
                                <Link href="/dashboard/warehouse/adjustments/new?type=purchase_return">
                                    <PlusCircle className="ml-2 h-4 w-4" />
                                    مردود مشتريات
                                </Link>
                            </Button>
                            <Button asChild variant="destructive" size="sm" className="rounded-xl">
                                <Link href="/dashboard/warehouse/adjustments/new?type=damage">
                                    <Ban className="ml-2 h-4 w-4" />
                                    تسجيل توالف
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {error && (
                <Alert variant="destructive" className="rounded-2xl border-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>خطأ في جلب البيانات</AlertTitle>
                    <AlertDescription>
                        حدثت مشكلة أثناء الاتصال بقاعدة البيانات. قد يكون السبب نقص في الفهارس (Indexes) أو ضعف في الشبكة.
                    </AlertDescription>
                </Alert>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-2xl h-12">
                    <TabsTrigger value="all" className="rounded-xl font-bold">الكل ({allAdjustments.length})</TabsTrigger>
                    <TabsTrigger value="returns" className="rounded-xl font-bold">المردودات (مشتريات/مبيعات)</TabsTrigger>
                    <TabsTrigger value="losses" className="rounded-xl font-bold">الخسائر (تلف/فقد)</TabsTrigger>
                </TabsList>

                <div className="mt-6 border-2 rounded-[2rem] overflow-hidden bg-card shadow-sm">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="px-6">رقم الإذن</TableHead>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>النوع</TableHead>
                                <TableHead>الملاحظات</TableHead>
                                <TableHead className="text-left">القيمة المالية</TableHead>
                                <TableHead className="w-[80px]"><span className="sr-only">الإجراءات</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="animate-spin h-10 w-10 text-primary" />
                                            <p className="text-sm font-bold text-muted-foreground">جاري فحص وتحديث الأرصدة...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredAdjustments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                            <RotateCcw className="h-12 w-12" />
                                            <p className="text-lg font-black">لا توجد سجلات مطابقة في هذا القسم.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredAdjustments.map(adj => {
                                    const isReturn = adj.type.includes('return');
                                    const isLoss = ['damage', 'theft'].includes(adj.type);
                                    return (
                                        <TableRow key={adj.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="px-6 font-mono font-bold text-primary">
                                                <Link href={`/dashboard/warehouse/adjustments/${adj.id}`} className="hover:underline">
                                                    {adj.adjustmentNumber}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="text-sm font-medium">{toFirestoreDate(adj.date) ? format(toFirestoreDate(adj.date)!, 'dd/MM/yyyy') : '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn(
                                                    "font-bold px-3",
                                                    isReturn ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                                    isLoss ? 'bg-red-50 text-red-700 border-red-200' : ''
                                                )}>
                                                    {typeTranslations[adj.type] || adj.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-xs truncate italic">{adj.notes || '-'}</TableCell>
                                            <TableCell className={cn("text-left font-mono font-black", isLoss ? "text-red-600" : "text-primary")}>
                                                {formatCurrency(adj.items?.reduce((sum, i) => sum + (i.totalCost || 0), 0) || 0)}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreHorizontal className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" dir="rtl" className="rounded-xl">
                                                        <DropdownMenuLabel>إجراءات السجل</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/warehouse/adjustments/${adj.id}`)}>
                                                            <Eye className="ml-2 h-4 w-4" /> عرض / طباعة
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => setItemToDelete(adj)} className="text-destructive">
                                                            <Trash2 className="ml-2 h-4 w-4" /> حذف السجل
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

            <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
                <AlertDialogContent dir="rtl" className="rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black">تأكيد حذف السجل؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف سجل العملية نهائياً من النظام. يرجى ملاحظة أن القيد المحاسبي المرتبط لن يتم حذفه تلقائياً إذا كان قد تم ترحيله.</AlertDialogDescription>
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
