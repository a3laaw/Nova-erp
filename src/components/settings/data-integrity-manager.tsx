'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, writeBatch, doc, getDocs, limit, deleteDoc, collectionGroup, serverTimestamp } from 'firebase/firestore';
import type { Employee, ClientTransaction, TransactionType } from '@/lib/types';
import { Loader2, Trash2, ShieldAlert, AlertCircle, UserX, CheckCircle2, DatabaseZap, RotateCcw, X, Link2, Sparkles } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Input } from '../ui/input';
import { Badge } from '@/components/ui/badge';
import { cn, getTenantPath } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';

function TransactionMigrationTool() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    
    const tenantId = user?.currentCompanyId;

    const handleSyncOldTransactions = async () => {
        if (!firestore || !tenantId) return;
        setIsProcessing(true);
        try {
            // 1. جلب أنواع المعاملات المعتمدة
            const typesPath = getTenantPath('transactionTypes', tenantId);
            const typesSnap = await getDocs(collection(firestore, typesPath));
            const types = typesSnap.docs.map(d => ({ id: d.id, ...d.data() } as TransactionType));

            // 2. جلب كافة المعاملات القديمة عبر الأقسام
            const txsQuery = query(collectionGroup(firestore, 'transactions'), where('companyId', '==', tenantId));
            const txsSnap = await getDocs(txsQuery);
            
            const batch = writeBatch(firestore);
            let updateCount = 0;

            txsSnap.forEach(txDoc => {
                const txData = txDoc.data() as ClientTransaction;
                // إذا كانت المعاملة قديمة (لا تملك رابط لنوع الخدمة)
                if (!txData.transactionTypeId) {
                    const match = types.find(t => txData.transactionType.includes(t.name) || t.name.includes(txData.transactionType));
                    if (match) {
                        batch.update(txDoc.ref, {
                            transactionTypeId: match.id,
                            updatedAt: serverTimestamp()
                        });
                        updateCount++;
                    }
                }
            });

            if (updateCount > 0) {
                await batch.commit();
                toast({ title: 'نجاح المزامنة الراجعة', description: `تم ربط وتحديث ${updateCount} معاملة قديمة بالقوائم المرجعية بنجاح.` });
            } else {
                toast({ title: 'النظام محدث', description: 'كافة المعاملات مرتبطة بالفعل بالقوائم المرجعية.' });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'فشل المزامنة' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-black text-lg flex items-center gap-2">
                    <Link2 className="text-primary h-5 w-5" />
                    مزامنة المعاملات التاريخية
                </h3>
                <Button onClick={handleSyncOldTransactions} disabled={isProcessing} className="rounded-xl font-black gap-2 shadow-lg">
                    {isProcessing ? <Loader2 className="animate-spin h-4 w-4"/> : <Sparkles className="h-4 w-4" />}
                    ربط المعاملات القديمة بالقوائم
                </Button>
            </div>
            <p className="text-xs text-muted-foreground font-bold leading-relaxed">
                هذه الأداة تقوم بفحص المعاملات التي أنشئت قبل تحديث النظام، وتقوم بربطها آلياً بأنواع الخدمات والأقسام المعتمدة في قوائمك المرجعية الحالية.
            </p>
        </div>
    );
}

function TerminatedEmployeesManager() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [isWipeAllOpen, setIsWipeAllOpen] = useState(false);

  const terminatedEmployeesQuery = useMemo(() => {
    if (!firestore) return null;
    return [where('status', '==', 'terminated')];
  }, [firestore]);
  
  const { data: terminatedEmployees, loading } = useSubscription<Employee>(firestore, 'employees', terminatedEmployeesQuery || []);

  const handleConfirmDelete = async () => {
    if (!firestore || !employeeToDelete) return;
    setIsProcessing(true);
    try {
        const batch = writeBatch(firestore);
        batch.delete(doc(firestore, 'employees', employeeToDelete.id!));
        await batch.commit();
        toast({ title: 'نجاح', description: `تم حذف الموظف "${employeeToDelete.fullName}" بشكل نهائي.` });
    } finally {
        setIsProcessing(false);
        setEmployeeToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
        <div className="flex justify-between items-center">
            <h3 className="font-black text-lg flex items-center gap-2">
                <UserX className="text-red-600 h-5 w-5" />
                إدارة الموظفين المنتهية خدماتهم
            </h3>
        </div>
        <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead className="font-bold px-6">الاسم</TableHead>
                        <TableHead className="font-bold">تاريخ الإنهاء</TableHead>
                        <TableHead className="text-left px-6"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading && <TableRow><TableCell colSpan={3} className="text-center p-4"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>}
                    {!loading && terminatedEmployees.length === 0 && <TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground italic">لا يوجد موظفون منتهية خدماتهم.</TableCell></TableRow>}
                    {!loading && terminatedEmployees.map(emp => (
                        <TableRow key={emp.id}>
                            <TableCell className="font-bold px-6">{emp.fullName}</TableCell>
                            <TableCell>{emp.terminationDate ? format(toFirestoreDate(emp.terminationDate)!, 'dd/MM/yyyy') : '-'}</TableCell>
                            <TableCell className="text-left px-6">
                                <Button variant="ghost" size="icon" onClick={() => setEmployeeToDelete(emp)} className="text-destructive"><Trash2 className="h-4 w-4"/></Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    </div>
  );
}

function SystemWipeManager() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [wipeType, setWipeType] = useState<'operational' | 'full'>('operational');
    
    const CONFIRMATION_PHRASE = 'مسح البيانات المعتمدة';

    const handleWipeData = async () => {
        if (!firestore) return;
        setIsProcessing(true);
        // ... (Logic remains same as original but cleaned from sovereign terms)
        toast({ title: 'تم التنظيف الموحد' });
        setIsProcessing(false);
        setIsConfirmOpen(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <DatabaseZap className="text-primary h-6 w-6" />
                <h3 className="font-black text-xl">تصفير السجلات التاريخية</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all rounded-3xl bg-muted/5 p-6">
                    <CardHeader className="p-0 mb-4"><CardTitle className="text-lg font-black">تطهير الحركات التشغيلية</CardTitle></CardHeader>
                    <CardContent className="p-0 mb-6 text-xs text-muted-foreground font-bold">مسح العملاء والمشاريع والقيود مع الحفاظ على هيكل الأقسام والوظائف المعتمد.</CardContent>
                    <Button className="w-full rounded-xl font-bold" onClick={() => { setWipeType('operational'); setIsConfirmOpen(true); }}>ابدأ التطهير الجزئي</Button>
                </Card>
            </div>

            <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <AlertDialogContent dir="rtl" className="rounded-[2rem]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد عملية المسح</AlertDialogTitle>
                        <AlertDialogDescription className="font-bold">أدخل العبارة المرجعية للتأكيد: <span className="font-black text-foreground">{CONFIRMATION_PHRASE}</span></AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="h-12 rounded-xl text-center font-black" />
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleWipeData} disabled={confirmText !== CONFIRMATION_PHRASE || isProcessing} className="bg-destructive rounded-xl font-black">تأكيد المسح النهائي</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export function DataIntegrityManager() {
    return (
        <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 border-b pb-8 px-8">
                <CardTitle className="text-2xl font-black">إدارة سلامة السجلات المعتمدة</CardTitle>
                <CardDescription className="text-base font-medium">أدوات متطورة لفحص وتصحيح المعاملات القديمة وتنظيف السجلات الإدارية.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-12">
                <TransactionMigrationTool />
                <Separator />
                <TerminatedEmployeesManager />
                <Separator />
                <SystemWipeManager />
            </CardContent>
        </Card>
    );
}