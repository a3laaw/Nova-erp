
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Checkbox } from '../ui/checkbox';
import { InlineSearchList } from '../ui/inline-search-list';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, getDocs, query, where, writeBatch, serverTimestamp, doc } from 'firebase/firestore';
import type { Department, Employee, ClientTransaction, TransactionAssignment } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Loader2, Save } from 'lucide-react';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { Input } from '../ui/input';

// Interface for what the dialog manages
interface AssignmentState {
  departmentId: string;
  departmentName: string;
  selected: boolean;
  engineerId: string;
  notes: string;
  existingAssignmentId?: string;
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

    useEffect(() => {
        if (!firestore || !isOpen) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const deptsQuery = query(collection(firestore, 'departments'));
                const engineersQuery = query(collection(firestore, 'employees'), where('status', '==', 'active'));
                const existingAssignmentsQuery = query(collection(firestore, 'transaction_assignments'), where('transactionId', '==', transaction.id));
                
                const [deptsSnap, engsSnap, assignmentsSnap] = await Promise.all([
                    getDocs(deptsQuery),
                    getDocs(engineersQuery),
                    getDocs(existingAssignmentsQuery),
                ]);

                const allDepartments = deptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
                const allEngineers = engsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
                setEngineers(allEngineers);
                
                const existingAssignmentsMap = new Map(assignmentsSnap.docs.map(doc => {
                    const data = doc.data();
                    return [data.departmentId, { id: doc.id, ...data }];
                }));
                
                const initialAssignments = allDepartments.map(dept => {
                    const existing = existingAssignmentsMap.get(dept.id);
                    return {
                        departmentId: dept.id,
                        departmentName: dept.name,
                        selected: !!existing,
                        engineerId: existing?.engineerId || '',
                        notes: existing?.notes || '',
                        existingAssignmentId: existing?.id,
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
    }, [firestore, isOpen, transaction.id, toast]);

    const handleAssignmentChange = (departmentId: string, field: 'selected' | 'engineerId' | 'notes', value: string | boolean) => {
        setAssignments(prev => prev.map(a => a.departmentId === departmentId ? { ...a, [field]: value } : a));
    };

    const getEngineersForDept = (deptName: string) => {
        return engineers
            .filter(e => e.department === deptName && (e.jobTitle?.includes('مهندس') || e.jobTitle?.includes('موظف')))
            .map(e => ({ value: e.id!, label: e.fullName }));
    };

    const handleSave = async () => {
        if (!firestore || !currentUser || !transaction.id) return;
        
        setIsSaving(true);
        const batch = writeBatch(firestore);
        const assignmentsRef = collection(firestore, 'transaction_assignments');

        const notificationsToSend: any[] = [];

        for (const assignment of assignments) {
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
                 if(targetUserId) {
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

    return (
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
                                        <TableRow key={a.departmentId} className={!a.selected ? 'opacity-50' : ''}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={a.selected}
                                                    onCheckedChange={(checked) => handleAssignmentChange(a.departmentId, 'selected', !!checked)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-semibold">{a.departmentName}</TableCell>
                                            <TableCell>
                                                <InlineSearchList 
                                                    value={a.engineerId}
                                                    onSelect={(value) => handleAssignmentChange(a.departmentId, 'engineerId', value)}
                                                    options={getEngineersForDept(a.departmentName)}
                                                    placeholder="اختر موظف..."
                                                    disabled={!a.selected}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    value={a.notes}
                                                    onChange={(e) => handleAssignmentChange(a.departmentId, 'notes', e.target.value)}
                                                    placeholder="ملاحظات للقسم..."
                                                    disabled={!a.selected}
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
    );
}
