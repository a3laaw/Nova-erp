'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    writeBatch, 
    doc, 
    serverTimestamp, 
    collectionGroup,
    deleteField
} from 'firebase/firestore';
import type { ClientTransaction, WorkStage, Employee, Client } from '@/lib/types';
import { 
    Loader2, 
    ShieldAlert, 
    Sparkles, 
    RotateCcw, 
    UserX, 
    Trash2, 
    AlertTriangle, 
    DatabaseZap,
    RefreshCw,
    Ban
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

/**
 * 🛠️ محرك مزامنة المسارات الفنية (WBS Sync Engine)
 */
function TechnicalWbsSyncTool() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    
    const tenantId = user?.currentCompanyId;

    const handleSyncWbsStructure = async () => {
        if (!firestore || !tenantId) return;
        setIsProcessing(true);
        try {
            const stagesSnap = await getDocs(query(collectionGroup(firestore, 'workStages'), where('companyId', '==', tenantId)));
            const masterStages = stagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as WorkStage));

            const txsQuery = query(collectionGroup(firestore, 'transactions'), where('companyId', '==', tenantId));
            const txsSnap = await getDocs(txsQuery);
            
            const batch = writeBatch(firestore);
            let updateCount = 0;

            txsSnap.forEach(txDoc => {
                const txData = txDoc.data() as ClientTransaction;
                const currentStages = txData.stages || [];
                let hasChanges = false;

                const updatedStages = currentStages.map(stage => {
                    const match = masterStages.find(ms => ms.name === stage.name);
                    if (match) {
                        hasChanges = true;
                        return {
                            ...stage,
                            stageId: match.id,
                            trackingType: match.trackingType || stage.trackingType || 'duration',
                            expectedDurationDays: match.expectedDurationDays || stage.expectedDurationDays || null,
                            maxOccurrences: match.maxOccurrences || stage.maxOccurrences || null,
                            nextStageIds: match.nextStageIds || []
                        };
                    }
                    return stage;
                });

                if (hasChanges) {
                    batch.update(txDoc.ref, { 
                        stages: updatedStages,
                        updatedAt: serverTimestamp() 
                    });
                    updateCount++;
                }
            });

            if (updateCount > 0) {
                await batch.commit();
                toast({ title: 'نجاح المزامنة العميقة', description: `تم تحديث ذكاء الـ WBS لـ ${updateCount} معاملة قديمة بنجاح.` });
            } else {
                toast({ title: 'البيانات محدثة', description: 'كافة المعاملات تتبع القواعد الحالية للقوائم المرجعية.' });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'فشل المزامنة', description: e.message });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-4 p-8 bg-primary/5 rounded-[2.5rem] border-2 border-dashed border-primary/20">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-primary border border-primary/10"><RotateCcw className="h-6 w-6"/></div>
                    <div>
                        <h3 className="font-black text-xl text-primary">مزامنة ذكاء المراحل (WBS Retro-Sync)</h3>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">تحديث المعاملات القديمة لتبني القواعد الهندسية الجديدة.</p>
                    </div>
                </div>
                <Button onClick={handleSyncWbsStructure} disabled={isProcessing} className="rounded-xl font-black gap-2 shadow-xl shadow-primary/20 px-8">
                    {isProcessing ? <Loader2 className="animate-spin h-4 w-4"/> : <RefreshCw className="h-4 w-4" />}
                    تشغيل محرك المزامنة
                </Button>
            </div>
        </div>
    );
}

/**
 * 🔥 محرك التطهير المالي والعملياتي الشامل (The Sovereign Purge Engine) 🔥
 */
function UniversalDataPurgeTool() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    const [isPurging, setIsPurging] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [isAlertOpen, setIsImportConfirmOpen] = useState(false);

    const tenantId = user?.currentCompanyId;

    const collectionsToPurge = [
        'journalEntries',
        'cashReceipts',
        'paymentVouchers',
        'quotations',
        'payment_applications',
        'boqs',
        'purchaseOrders',
        'rfqs',
        'grns',
        'inventoryAdjustments',
        'field_visits',
        'notifications',
        'userProductivity',
        'hub_posts'
    ];

    const handlePurge = async () => {
        if (!firestore || !tenantId || confirmText !== 'تطهير') return;
        
        setIsPurging(true);
        try {
            // 1. مسح المجموعات المسطحة (Collections)
            for (const collName of collectionsToPurge) {
                const collPath = getTenantPath(collName, tenantId);
                const snap = await getDocs(collection(firestore, collPath!));
                const batch = writeBatch(firestore);
                snap.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }

            // 2. مسح المعاملات (Nested Subcollections) عبر الـ Collection Group
            const txsSnap = await getDocs(query(collectionGroup(firestore, 'transactions'), where('companyId', '==', tenantId)));
            const txBatch = writeBatch(firestore);
            txsSnap.forEach(d => txBatch.delete(d.ref));
            await txBatch.commit();

            // 3. تصفير حالة العملاء وإعادة ضبط عدادات الترقيم
            const clientsSnap = await getDocs(query(collection(firestore, getTenantPath('clients', tenantId)!)));
            const clientBatch = writeBatch(firestore);
            clientsSnap.forEach(d => {
                clientBatch.update(d.ref, { 
                    status: 'new', 
                    transactionCounter: 0,
                    updatedAt: serverTimestamp() 
                });
            });

            // تصفير كافة العدادات (Counters)
            const countersSnap = await getDocs(query(collection(firestore, getTenantPath('counters', tenantId)!)));
            countersSnap.forEach(d => clientBatch.delete(d.ref));

            await clientBatch.commit();

            toast({ title: '✅ تم تطهير البيانات بالكامل', description: 'المنظومة الآن جاهزة لبدء دورة عمل نظيفة وجديدة.' });
            setIsImportConfirmOpen(false);
            setConfirmText('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'فشل التطهير', description: e.message });
        } finally {
            setIsPurging(false);
        }
    };

    return (
        <div className="space-y-4 p-8 bg-red-50 rounded-[2.5rem] border-2 border-dashed border-red-200">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-red-600 border border-red-100"><Ban className="h-6 w-6"/></div>
                    <div>
                        <h3 className="font-black text-xl text-red-700">تطهير البيانات المالية والعملياتية (Reset)</h3>
                        <p className="text-xs font-bold text-red-600/70 mt-0.5">مسح كافة القيود والسندات والعمليات للبدء من جديد (مع الإبقاء على العملاء والموظفين).</p>
                    </div>
                </div>
                <Button onClick={() => setIsImportConfirmOpen(true)} variant="destructive" className="rounded-xl font-black gap-2 shadow-xl shadow-red-200 px-8 h-12">
                    <Trash2 className="h-5 w-5" /> مسح كافة العمليات الحالية
                </Button>
            </div>

            <AlertDialog open={isAlertOpen} onOpenChange={(v) => { setIsImportConfirmOpen(v); setConfirmText(''); }}>
                <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl bg-white max-w-xl">
                    <AlertDialogHeader>
                        <div className="p-4 bg-red-100 rounded-3xl w-fit mb-4 border border-red-200 animate-pulse">
                            <DatabaseZap className="h-10 w-10 text-red-600" />
                        </div>
                        <AlertDialogTitle className="text-2xl font-black text-red-800 tracking-tighter">إجراء خطير: تطهير كامل للبيانات!</AlertDialogTitle>
                        <AlertDialogDescription className="text-lg font-bold text-slate-600 leading-relaxed mt-2">
                            هذا الإجراء سيقوم بمسح نهائي لكافة:
                            <ul className="list-disc pr-6 mt-3 text-sm text-red-700 space-y-1">
                                <li>قيود اليومية والسندات المالية.</li>
                                <li>عروض الأسعار والعقود المبرمة.</li>
                                <li>مسارات المعاملات ومراحل الإنجاز.</li>
                                <li>المستخلصات وجداول الكميات.</li>
                            </ul>
                            <br />
                            <span className="text-red-900 font-black italic block bg-red-50 p-4 rounded-2xl border-2 border-red-200">
                                تنبيه: لا يمكن التراجع عن هذا الإجراء أبداً. اكتب كلمة "تطهير" أدناه للتأكيد:
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-6">
                        <Input 
                            value={confirmText} 
                            onChange={(e) => setConfirmText(e.target.value)} 
                            placeholder="اكتب: تطهير" 
                            className="h-14 rounded-2xl text-center font-black text-2xl border-4 border-red-100 bg-slate-50 focus:bg-white transition-all text-red-600" 
                        />
                    </div>
                    <AlertDialogFooter className="gap-3">
                        <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2">إلغاء وتراجع</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handlePurge} 
                            disabled={confirmText !== 'تطهير' || isPurging} 
                            className="bg-red-600 hover:bg-black rounded-xl font-black h-12 px-12 shadow-xl shadow-red-200 flex-1"
                        >
                            {isPurging ? <Loader2 className="animate-spin h-5 w-5"/> : 'نعم، قم بالتطهير النهائي'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function TerminatedEmployeesManager() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  const terminatedEmployeesQuery = useMemo(() => [where('status', '==', 'terminated')], []);
  const { data: terminatedEmployees, loading } = useSubscription<Employee>(firestore, 'employees', terminatedEmployeesQuery);

  const handleConfirmDelete = async () => {
    if (!firestore || !employeeToDelete) return;
    try {
        await deleteDoc(doc(firestore, 'employees', employeeToDelete.id!));
        toast({ title: 'نجاح', description: `تم حذف الموظف نهائياً.` });
    } finally { setEmployeeToDelete(null); }
  };

  return (
    <div className="space-y-4">
        <h3 className="font-black text-lg flex items-center gap-2 text-[#1e1b4b]"><UserX className="h-5 w-5 text-red-500" /> إدارة السجلات الملغاة</h3>
        <div className="border-2 rounded-[2rem] overflow-hidden shadow-inner bg-white">
            <Table>
                <TableHeader className="bg-slate-50"><TableRow><TableHead className="px-8 font-black text-slate-900">اسم الموظف السابق</TableHead><TableHead className="font-black text-slate-900">تاريخ الإنهاء</TableHead><TableHead className="text-left px-8 font-black text-slate-900">حذف نهائي</TableHead></TableRow></TableHeader>
                <TableBody>
                    {!loading && terminatedEmployees.length === 0 ? <TableRow><TableCell colSpan={3} className="h-32 text-center opacity-30 italic font-black text-xl">لا توجد سجلات.</TableCell></TableRow> :
                    terminatedEmployees.map(emp => (
                        <TableRow key={emp.id} className="h-16 hover:bg-red-50/10">
                            <TableCell className="font-black px-8 text-slate-800">{emp.fullName}</TableCell>
                            <TableCell className="font-bold text-xs opacity-60">{emp.terminationDate ? format(toFirestoreDate(emp.terminationDate)!, 'dd/MM/yyyy') : '-'}</TableCell>
                            <TableCell className="text-left px-8"><Button variant="ghost" size="icon" onClick={() => setEmployeeToDelete(emp)} className="text-red-300 hover:text-red-600 rounded-xl border group-hover:border-red-200"><Trash2 className="h-4 w-4"/></Button></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
        <AlertDialog open={!!employeeToDelete} onOpenChange={() => setEmployeeToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-3xl border-none shadow-2xl">
                <AlertDialogHeader><AlertDialogTitle className="text-xl font-black text-red-700">حذف الموظف نهائياً؟</AlertDialogTitle><AlertDialogDescription className="font-bold">سيتم مسح سجل الموظف "${employeeToDelete?.fullName}" تماماً من الأرشيف.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter className="gap-3 mt-6"><AlertDialogCancel className="rounded-xl font-bold">إلغاء</AlertDialogCancel><AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700 rounded-xl font-black px-10">تأكيد الحذف</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

export function DataIntegrityManager() {
    return (
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/95">
            <CardHeader className="bg-primary/5 border-b pb-8 px-10">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><ShieldAlert className="h-8 w-8" /></div>
                    <div>
                        <CardTitle className="text-2xl font-black text-[#1e1b4b]">أدوات الرقابة وسلامة السجلات</CardTitle>
                        <CardDescription className="text-base font-bold text-slate-500">أدوات سيادية لإعادة ضبط المنظومة، مزامنة المسارات، وتطهير البيانات التاريخية.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-10 space-y-12">
                <UniversalDataPurgeTool />
                <Separator className="opacity-10" />
                <TechnicalWbsSyncTool />
                <Separator className="opacity-10" />
                <TerminatedEmployeesManager />
            </CardContent>
        </Card>
    );
}
