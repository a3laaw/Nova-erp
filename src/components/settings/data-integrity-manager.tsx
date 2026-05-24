'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp, collectionGroup } from 'firebase/firestore';
import type { ClientTransaction, TransactionType, SubService, WorkStage, Employee } from '@/lib/types';
import { Loader2, ShieldAlert, Link2, Sparkles, DatabaseZap, RotateCcw, UserX, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';

/**
 * 🛠️ محرك مزامنة المسارات الفنية (WBS Sync Engine V2100.0) 🛠️
 * يقوم بتحديث المعاملات القديمة لتتوافق مع القواعد الجديدة في القوائم المرجعية.
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
            // 1. جلب كافة مراحل العمل المعتمدة من القوالب (Level 3)
            const stagesSnap = await getDocs(query(collectionGroup(firestore, 'workStages'), where('companyId', '==', tenantId)));
            const masterStages = stagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as WorkStage));

            // 2. جلب كافة المعاملات النشطة لتحديث هيكلها
            const txsQuery = query(collectionGroup(firestore, 'transactions'), where('companyId', '==', tenantId));
            const txsSnap = await getDocs(txsQuery);
            
            const batch = writeBatch(firestore);
            let updateCount = 0;

            txsSnap.forEach(txDoc => {
                const txData = txDoc.data() as ClientTransaction;
                const currentStages = txData.stages || [];
                let hasChanges = false;

                const updatedStages = currentStages.map(stage => {
                    // البحث عن المرحلة المطابقة في القوائم المرجعية بالاسم
                    const match = masterStages.find(ms => ms.name === stage.name);
                    if (match) {
                        hasChanges = true;
                        return {
                            ...stage,
                            stageId: match.id, // تحديث المعرف للمطابقة المستقبيلة
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
            console.error(e);
            toast({ variant: 'destructive', title: 'فشل المزامنة', description: e.message });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-4 p-6 bg-primary/5 rounded-[2rem] border-2 border-dashed border-primary/20">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm text-primary"><RotateCcw className="h-5 w-5"/></div>
                    <h3 className="font-black text-lg text-primary">مزامنة ذكاء المراحل (WBS Retro-Sync)</h3>
                </div>
                <Button onClick={handleSyncWbsStructure} disabled={isProcessing} className="rounded-xl font-black gap-2 shadow-xl shadow-primary/20">
                    {isProcessing ? <Loader2 className="animate-spin h-4 w-4"/> : <Sparkles className="h-4 w-4" />}
                    تحديث ذكاء المعاملات القديمة
                </Button>
            </div>
            <p className="text-xs text-muted-foreground font-bold leading-relaxed pr-10">
                أداة سيادية تقوم بفحص المعاملات القديمة وحقن قواعد (التبعية، النوع الرقابي، والمدد المتوقعة) المبرمجة حالياً في قوائمك المرجعية، لتعمل كافة البيانات القديمة بنفس ذكاء النظام الجديد.
            </p>
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
        <h3 className="font-black text-lg flex items-center gap-2 text-red-600"><UserX className="h-5 w-5" /> إدارة السجلات الملغاة</h3>
        <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
            <Table>
                <TableHeader className="bg-muted/50"><TableRow><TableHead className="px-6 font-bold">الاسم</TableHead><TableHead className="font-bold">تاريخ الإنهاء</TableHead><TableHead className="text-left px-6"></TableHead></TableRow></TableHeader>
                <TableBody>
                    {!loading && terminatedEmployees.length === 0 ? <TableRow><TableCell colSpan={3} className="h-24 text-center opacity-30 italic">لا توجد سجلات.</TableCell></TableRow> :
                    terminatedEmployees.map(emp => (
                        <TableRow key={emp.id}><TableCell className="font-bold px-6">{emp.fullName}</TableCell><TableCell>{emp.terminationDate ? format(toFirestoreDate(emp.terminationDate)!, 'dd/MM/yyyy') : '-'}</TableCell><TableCell className="text-left px-6"><Button variant="ghost" size="icon" onClick={() => setEmployeeToDelete(emp)} className="text-red-300 hover:text-red-600"><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    </div>
  );
}

export function DataIntegrityManager() {
    return (
        <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 border-b pb-8 px-8">
                <CardTitle className="text-2xl font-black">إدارة سلامة السجلات والبيانات المرجعية</CardTitle>
                <CardDescription className="text-base font-medium">أدوات متطورة لضمان انسجام البيانات التاريخية مع القواعد البرمجية الجديدة للمنظومة.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-12">
                <TechnicalWbsSyncTool />
                <Separator />
                <TerminatedEmployeesManager />
            </CardContent>
        </Card>
    );
}
