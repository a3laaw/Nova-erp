'use client';

import { useState, useMemo, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '../ui/button';
import { useFirebase, useSubscription } from '@/firebase';
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
    deleteField,
    deleteDoc
} from 'firebase/firestore';
import type { ClientTransaction, WorkStage, Employee, Client, Boq } from '@/lib/types';
import { 
    Loader2, 
    ShieldAlert, 
    RotateCcw, 
    UserX, 
    Trash2, 
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

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

            // جلب كافة المعاملات المرتبطة بالشركة
            const txsSnap = await getDocs(query(collectionGroup(firestore, 'transactions'), where('companyId', '==', tenantId)));
            
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
                toast({ title: 'نجاح المزامنة العميقة', description: `تم تحديث ذكاء الـ WBS لـ ${updateCount} معاملة بنجاح.` });
            } else {
                toast({ title: 'البيانات محدثة', description: 'كافة المعاملات تتبع القواعد الحالية.' });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'فشل المزامنة', description: e.message });
        } finally { setIsProcessing(false); }
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
 * 🔥 محرك التطهير المالي والعملياتي الشامل (The Sovereign Deep Purge Engine V82.0) 🔥
 * تم تحصينه لمسح كافة المجلدات الفرعية (المعاملات والـ BOQ) لضمان تصفير المنظومة.
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
        'purchaseOrders',
        'rfqs',
        'grns',
        'inventoryAdjustments',
        'field_visits',
        'notifications',
        'userProductivity',
        'hub_posts',
        'points_ledger',
        'letter_of_credits',
        'recurring_obligations',
        'custody_reconciliations'
    ];

    const handlePurge = async () => {
        if (!firestore || !tenantId || confirmText !== 'تطهير') return;
        
        setIsPurging(true);
        try {
            // 🛡️ 1. مسح القوائم الرئيسية 🛡️
            for (const collName of collectionsToPurge) {
                const collPath = getTenantPath(collName, tenantId);
                if (!collPath) continue;

                const snap = await getDocs(collection(firestore, collPath));
                if (!snap.empty) {
                    const batch = writeBatch(firestore);
                    snap.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                }
            }

            // 🛡️ 2. مسح المعاملات وسجل العميل (Nested Paths) 🛡️
            const clientsPath = getTenantPath('clients', tenantId);
            const clientsSnap = await getDocs(collection(firestore, clientsPath!));
            
            for (const clientDoc of clientsSnap.docs) {
                // مسح المعاملات والـ Timeline الخاص بها
                const txsSnap = await getDocs(collection(firestore, `${clientDoc.ref.path}/transactions`));
                for (const txDoc of txsSnap.docs) {
                    const timelineSnap = await getDocs(collection(firestore, `${txDoc.ref.path}/timelineEvents`));
                    const subBatch = writeBatch(firestore);
                    timelineSnap.forEach(td => subBatch.delete(td.ref));
                    subBatch.delete(txDoc.ref);
                    await subBatch.commit();
                }

                // مسح سجل الحركات (History)
                const historySnap = await getDocs(collection(firestore, `${clientDoc.ref.path}/history`));
                const histBatch = writeBatch(firestore);
                historySnap.forEach(hd => histBatch.delete(hd.ref));
                
                // تصفير حالة العميل والعدادات
                histBatch.update(clientDoc.ref, { 
                    status: 'new', 
                    transactionCounter: 0,
                    updatedAt: serverTimestamp() 
                });
                await histBatch.commit();
            }

            // 🛡️ 3. مسح بنود الـ BOQ (Nested Paths) 🛡️
            const boqsPath = getTenantPath('boqs', tenantId);
            const boqsSnap = await getDocs(collection(firestore, boqsPath!));
            for (const boqDoc of boqsSnap.docs) {
                const itemsSnap = await getDocs(collection(firestore, `${boqDoc.ref.path}/items`));
                const boqBatch = writeBatch(firestore);
                itemsSnap.forEach(id => boqBatch.delete(id.ref));
                boqBatch.delete(boqDoc.ref);
                await boqBatch.commit();
            }

            // 🛡️ 4. مسح عدادات الترقيم (Reset Counters) 🛡️
            const countersPath = getTenantPath('counters', tenantId);
            const countersSnap = await getDocs(collection(firestore, countersPath!));
            const counterBatch = writeBatch(firestore);
            countersSnap.forEach(d => counterBatch.delete(d.ref));
            await counterBatch.commit();

            toast({ title: '✅ تم التطهير الشامل والمجمدات', description: 'تم تصفير كافة العمليات والمعاملات الميدانية بنجاح.' });
            setIsImportConfirmOpen(false);
            setConfirmText('');
        } catch (e: any) {
            console.error("Purge Failure:", e);
            toast({ variant: 'destructive', title: 'فشل التطهير العميق', description: 'يرجى مراجعة الصلاحيات أو الاتصال بالمطور.' });
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
                        <h3 className="font-black text-xl text-red-700">تطهير شامل لكافة العمليات (Sovereign Deep Purge)</h3>
                        <p className="text-xs font-bold text-red-600/70 mt-0.5">مسح القيود، المعاملات، جداول الكميات، والمستخلصات (مع الإبقاء على العملاء).</p>
                    </div>
                </div>
                <Button onClick={() => setIsImportConfirmOpen(true)} variant="destructive" className="rounded-xl font-black gap-2 shadow-xl shadow-red-200 px-8 h-12">
                    <Trash2 className="h-5 w-5" /> بدء التطهير العميق
                </Button>
            </div>

            <AlertDialog open={isAlertOpen} onOpenChange={(v) => { setIsImportConfirmOpen(v); setConfirmText(''); }}>
                <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl bg-white max-w-xl">
                    <AlertDialogHeader>
                        <div className="p-4 bg-red-100 rounded-3xl w-fit mb-4 border border-red-200 animate-pulse">
                            <DatabaseZap className="h-10 w-10 text-red-600" />
                        </div>
                        <AlertDialogTitle className="text-2xl font-black text-red-800 tracking-tighter">إجراء سيادي: تصفير المنظومة!</AlertDialogTitle>
                        <AlertDialogDescription className="text-lg font-bold text-slate-600 leading-relaxed mt-2">
                            سيقوم هذا المحرك بمسح نهائي لكافة العمليات المالية والميدانية (بما فيها المعاملات والـ BOQ) لضمان بدء دورة عمل نظيفة.
                            <br /><br />
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
                        <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2">إلغاء</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handlePurge} 
                            disabled={confirmText !== 'تطهير' || isPurging} 
                            className="bg-red-600 hover:bg-black rounded-xl font-black h-12 px-12 shadow-xl shadow-red-200 flex-1"
                        >
                            {isPurging ? <Loader2 className="animate-spin h-5 w-5"/> : 'نعم، تطهير المنشأة'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function TerminatedEmployeesManager() {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  const tenantId = user?.currentCompanyId;
  const employeesPath = getTenantPath('employees', tenantId);

  const terminatedEmployeesQuery = useMemo(() => [where('status', '==', 'terminated')], []);
  const { data: terminatedEmployees, loading } = useSubscription<Employee>(firestore, 'employees', terminatedEmployeesQuery);

  const handleConfirmDelete = async () => {
    if (!firestore || !employeeToDelete || !employeesPath || !tenantId) return;
    
    const docPath = getTenantPath(`employees/${employeeToDelete.id}`, tenantId);
    deleteDoc(doc(firestore, docPath!))
        .then(() => {
            toast({ title: 'نجاح', description: `تم حذف الموظف نهائياً.` });
        })
        .catch(async (serverError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docPath!,
                operation: 'delete'
            }));
        })
        .finally(() => setEmployeeToDelete(null));
  };

  return (
    <div className="space-y-4">
        <h3 className="font-black text-lg flex items-center gap-2 text-[#1e1b4b]"><UserX className="h-5 w-5 text-red-500" /> إدارة السجلات الملغاة</h3>
        <div className="border-2 rounded-[2rem] overflow-hidden shadow-inner bg-white">
            <Table>
                <TableHeader className="bg-slate-50"><TableRow><TableHead className="px-8 font-black text-slate-900">اسم الموظف السابق</TableHead><TableHead className="font-black text-slate-900">تاريخ الإنهاء</TableHead><TableHead className="text-left px-8 font-black text-slate-900">حذف نهائي</TableHead></TableRow></TableHeader>
                <TableBody>
                    {!loading && (terminatedEmployees || []).length === 0 ? <TableRow><TableCell colSpan={3} className="h-32 text-center opacity-30 italic font-black text-xl">لا توجد سجلات.</TableCell></TableRow> :
                    (terminatedEmployees || []).map(emp => (
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
