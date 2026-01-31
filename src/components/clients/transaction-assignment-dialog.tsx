'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Checkbox } from '../ui/checkbox';
import { InlineSearchList } from '../ui/inline-search-list';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, getDocs, query, where, writeBatch, serverTimestamp, doc, collectionGroup } from 'firebase/firestore';
import type { Department, Employee, ClientTransaction, TransactionAssignment, TransactionType } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Loader2, Save, Shield } from 'lucide-react';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { Input } from '../ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../ui/alert-dialog';


interface AssignmentState {
  departmentId: string;
  departmentName: string;
  selected: boolean;
  engineerId: string;
  notes: string;
  existingAssignmentId?: string;
  isAvailable: boolean;
}

interface TransactionAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: ClientTransaction;
  clientName: string;
}

export function TransactionAssignmentDialog({ isOpen, onClose, transaction, clientName }: TransactionAssignmentDialogProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { user: currentUser } = useAuth();

    const [assignments, setAssignments] = useState<AssignmentState[]>([]);
    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [isBypassConfirmOpen, setIsBypassConfirmOpen] = useState(false);
    const [assignmentsToCommit, setAssignmentsToCommit] = useState<AssignmentState[]>([]);


    useEffect(() => {
        if (!firestore || !isOpen) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const deptsQuery = query(collection(firestore, 'departments'));
                const engineersQuery = query(collection(firestore, 'employees'), where('status', '==', 'active'));
                const existingAssignmentsQuery = query(collection(firestore, 'transaction_assignments'), where('transactionId', '==', transaction.id));
                const clientTransactionsQuery = query(collection(firestore, `clients/${transaction.clientId}/transactions`));
                const clientReceiptsQuery = query(collection(firestore, 'cashReceipts'), where('clientId', '==', transaction.clientId));
                const transactionTypesQuery = query(collectionGroup(firestore, 'transactionTypes'));
                
                const [deptsSnap, engsSnap, assignmentsSnap, clientTxnsSnap, clientReceiptsSnap, transTypesSnap] = await Promise.all([
                    getDocs(deptsQuery),
                    getDocs(engineersQuery),
                    getDocs(existingAssignmentsQuery),
                    getDocs(clientTransactionsQuery),
                    getDocs(clientReceiptsQuery),
                    getDocs(transactionTypesQuery),
                ]);

                const allDepartments = deptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
                const allEngineers = engsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
                setEngineers(allEngineers);
                
                const allClientTransactions = clientTxnsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientTransaction));
                const paidTransactionIds = new Set(clientReceiptsSnap.docs.map(doc => doc.data().projectId));
                
                const transactionTypesMap = new Map<string, string>();
                transTypesSnap.forEach(doc => {
                    const type = doc.data() as TransactionType;
                    const deptId = doc.ref.parent.parent?.id;
                    if (deptId) {
                        const deptName = allDepartments.find(d => d.id === deptId)?.name;
                        if (deptName && type.name.includes(deptName)) {
                            transactionTypesMap.set(deptId, type.name);
                        }
                    }
                });

                const existingAssignmentsMap = new Map(assignmentsSnap.docs.map(doc => {
                    const data = doc.data();
                    return [data.departmentId, { id: doc.id, ...data }];
                }));
                
                const initialAssignments = allDepartments.map(dept => {
                    const existing = existingAssignmentsMap.get(dept.id);
                    
                    let isAvailable = false;
                    const openDepts = ['الإنشائي', 'السكرتارية', 'المحاسبة'];
                    if (openDepts.includes(dept.name)) {
                        isAvailable = true;
                    } else {
                        const requiredTransactionType = transactionTypesMap.get(dept.id);
                        if (requiredTransactionType) {
                            const hasPaidPrerequisite = allClientTransactions.some(tx => 
                                tx.id !== transaction.id && // Exclude the current transaction
                                tx.transactionType === requiredTransactionType && 
                                paidTransactionIds.has(tx.id!)
                            );
                            if (hasPaidPrerequisite) {
                                isAvailable = true;
                            }
                        }
                    }

                    return {
                        departmentId: dept.id,
                        departmentName: dept.name,
                        selected: !!existing,
                        engineerId: existing?.engineerId || '',
                        notes: existing?.notes || '',
                        existingAssignmentId: existing?.id,
                        isAvailable: isAvailable,
                    };
                });

                setAssignments(initialAssignments);

            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحميل بيانات الإسناد.' });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [firestore, isOpen, transaction.id, transaction.clientId, toast, currentUser?.role]);

    const handleAssignmentChange = (departmentId: string, field: 'selected' | 'engineerId' | 'notes', value: string | boolean) => {
        setAssignments(prev => prev.map(a => a.departmentId === departmentId ? { ...a, [field]: value } : a));
    };

    const getEngineersForDept = (deptName: string) => {
        return engineers
            .filter(e => e.department === deptName)
            .map(e => ({ value: e.id!, label: e.fullName }));
    };

    const performSave = async (assignmentsToProcess: AssignmentState[]) => {
        if (!firestore || !currentUser || !transaction.id) return;
        setIsSaving(true);
        const batch = writeBatch(firestore);
        const assignmentsRef = collection(firestore, 'transaction_assignments');
    
        const notificationsToSend: any[] = [];
    
        for (const assignment of assignmentsToProcess) {
          if (assignment.selected) {
            if (!assignment.engineerId) {
              toast({ variant: 'destructive', title: 'حقل ناقص', description: `الرجاء اختيار موظف لقسم: ${assignment.departmentName}` });
              setIsSaving(false);
              return;
            }
            const data = {
              transactionId: transaction.id,
              clientId: transaction.clientId,
              departmentId: assignment.departmentId,
              departmentName: assignment.departmentName,
              engineerId: assignment.engineerId,
              notes: assignment.notes,
              status: 'pending',
              createdBy: currentUser.id,
              createdAt: serverTimestamp(),
            };
    
            const engineer = engineers.find(e => e.id === assignment.engineerId);
    
            if (assignment.existingAssignmentId) {
              const docRef = doc(assignmentsRef, assignment.existingAssignmentId);
              batch.update(docRef, { engineerId: data.engineerId, notes: data.notes });
            } else {
              const docRef = doc(assignmentsRef);
              batch.set(docRef, data);
              if (engineer) {
                notificationsToSend.push({
                  engineerId: engineer.id,
                  title: 'تم إسناد معاملة جديدة لك',
                  body: `قام ${currentUser.fullName} بإسناد معاملة "${transaction.transactionType}" الخاصة بالعميل ${clientName} إليك للمتابعة.`
                });
              }
            }
          } else if (assignment.existingAssignmentId) {
            const docRef = doc(assignmentsRef, assignment.existingAssignmentId);
            batch.delete(docRef);
          }
        }
    
        try {
          await batch.commit();
    
          for (const notif of notificationsToSend) {
            const targetUserId = await findUserIdByEmployeeId(firestore, notif.engineerId);
            if (targetUserId) {
              await createNotification(firestore, {
                userId: targetUserId,
                title: notif.title,
                body: notif.body,
                link: `/dashboard/clients/${transaction.clientId}/transactions/${transaction.id}`
              });
            }
          }
    
          toast({ title: 'نجاح', description: 'تم حفظ تحويلات المعاملة بنجاح.' });
          onClose();
        } catch (error) {
          console.error(error);
          toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ التغييرات.' });
        } finally {
          setIsSaving(false);
        }
    };

    const handleSave = async () => {
        const bypassedAssignments = assignments.filter(
            a => a.selected && !a.isAvailable && currentUser?.role === 'Admin'
        );

        if (bypassedAssignments.length > 0) {
            setAssignmentsToCommit(assignments);
            setIsBypassConfirmOpen(true);
        } else {
            await performSave(assignments);
        }
    };
    
    const handleConfirmAndSave = async () => {
        setIsBypassConfirmOpen(false);
        await performSave(assignmentsToCommit);
        setAssignmentsToCommit([]);
    };


    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle>تحويل / إسناد المعاملة للأقسام</DialogTitle>
                    <DialogDescription>
                        اختر الأقسام التي تريد تحويل المعاملة إليها وأسندها للموظف المسؤول في كل قسم.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    {loading ? (
                         <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : (
                         <div className="border rounded-lg max-h-[60vh] overflow-y-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-muted z-10">
                                    <TableRow>
                                        <TableHead className="w-[40px]"></TableHead>
                                        <TableHead className="w-[180px]">القسم</TableHead>
                                        <TableHead>الموظف المسؤول</TableHead>
                                        <TableHead>ملاحظات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {assignments.map(a => (
                                        <TableRow key={a.departmentId} className={!a.isAvailable && currentUser?.role !== 'Admin' ? 'bg-muted/30 text-muted-foreground' : ''}>
                                            <TableCell>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span tabIndex={0} className="flex items-center gap-2">
                                                                <Checkbox
                                                                    checked={a.selected}
                                                                    onCheckedChange={(checked) => handleAssignmentChange(a.departmentId, 'selected', !!checked)}
                                                                    disabled={!a.isAvailable && currentUser?.role !== 'Admin'}
                                                                />
                                                                 {currentUser?.role === 'Admin' && !a.isAvailable && <Shield className="h-4 w-4 text-blue-500" />}
                                                            </span>
                                                        </TooltipTrigger>
                                                        {!a.isAvailable && currentUser?.role !== 'Admin' && (
                                                            <TooltipContent>
                                                                <p>يجب وجود معاملة سابقة مدفوعة لهذا القسم.</p>
                                                            </TooltipContent>
                                                        )}
                                                        {currentUser?.role === 'Admin' && !a.isAvailable && (
                                                            <TooltipContent>
                                                                <p>صلاحية المدير تتجاوز هذا الشرط.</p>
                                                            </TooltipContent>
                                                        )}
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </TableCell>
                                            <TableCell className="font-semibold">{a.departmentName}</TableCell>
                                            <TableCell>
                                                <InlineSearchList 
                                                    value={a.engineerId}
                                                    onSelect={(value) => handleAssignmentChange(a.departmentId, 'engineerId', value)}
                                                    options={getEngineersForDept(a.departmentName)}
                                                    placeholder="اختر موظف..."
                                                    disabled={!a.selected || (!a.isAvailable && currentUser?.role !== 'Admin')}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    value={a.notes}
                                                    onChange={(e) => handleAssignmentChange(a.departmentId, 'notes', e.target.value)}
                                                    placeholder="ملاحظات للقسم..."
                                                    disabled={!a.selected || (!a.isAvailable && currentUser?.role !== 'Admin')}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>إغلاق</Button>
                    <Button onClick={handleSave} disabled={isSaving || loading}>
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                        حفظ
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <AlertDialog open={isBypassConfirmOpen} onOpenChange={setIsBypassConfirmOpen}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>تأكيد تجاوز الصلاحية</AlertDialogTitle>
                    <AlertDialogDescription>
                        أنت على وشك إسناد هذه المعاملة إلى قسم واحد أو أكثر يتطلب معاملة سابقة مدفوعة.
                        <br />
                        باستخدام صلاحياتك كمدير، سيتم تجاوز هذا الشرط. هل تود المتابعة؟
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setAssignmentsToCommit([])} disabled={isSaving}>
                        تراجع
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmAndSave} disabled={isSaving} className="bg-amber-600 hover:bg-amber-700">
                        {isSaving ? 'جاري الحفظ...' : 'نعم، قم بالإسناد'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
