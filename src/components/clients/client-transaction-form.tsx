'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Info } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, writeBatch, getDoc, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Client, ClientTransaction, TransactionType, Department, WorkStage, TransactionStage } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { InlineSearchList } from '../ui/inline-search-list';


interface ClientTransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

export function ClientTransactionForm({ isOpen, onClose, clientId, clientName }: ClientTransactionFormProps) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [engineersLoading, setEngineersLoading] = useState(true);
    
    const [departments, setDepartments] = useState<Department[]>([]);
    const [departmentsLoading, setDepartmentsLoading] = useState(true);
    const [selectedDepartment, setSelectedDepartment] = useState('');

    const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
    const [typesLoading, setTypesLoading] = useState(false);

    const [workStages, setWorkStages] = useState<WorkStage[]>([]);
    const [stagesLoading, setStagesLoading] = useState(false);

    const [transactionType, setTransactionType] = useState('');
    const [description, setDescription] = useState('');
    const [assignedEngineerId, setAssignedEngineerId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!firestore || !isOpen) return;

        const fetchInitialData = async () => {
            setEngineersLoading(true);
            setDepartmentsLoading(true);
            try {
                const engQuery = query(collection(firestore, 'employees'), where('jobTitle', '!=', ''));
                const deptQuery = query(collection(firestore, 'departments'), orderBy('name'));

                const [engSnapshot, deptSnapshot] = await Promise.all([
                    getDocs(engQuery),
                    getDocs(deptQuery),
                ]);

                const fetchedEngineers: Employee[] = [];
                engSnapshot.forEach((doc) => {
                    const data = doc.data() as Employee;
                    if (data.jobTitle?.includes('مهندس') || data.jobTitle?.toLowerCase().includes('engineer')) {
                        fetchedEngineers.push({ id: doc.id, ...data });
                    }
                });
                setEngineers(fetchedEngineers);

                const fetchedDepts = deptSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
                setDepartments(fetchedDepts);

            } catch (error) {
                console.error("Failed to fetch initial data:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات اللازمة.' });
            } finally {
                setEngineersLoading(false);
                setDepartmentsLoading(false);
            }
        };

        fetchInitialData();
    }, [firestore, isOpen, toast]);

    useEffect(() => {
        if (!firestore || !selectedDepartment) {
            setTransactionTypes([]);
            setWorkStages([]);
            return;
        }

        const fetchDepartmentData = async () => {
            setTypesLoading(true);
            setStagesLoading(true);
            try {
                const typesQuery = query(collection(firestore, `departments/${selectedDepartment}/transactionTypes`), orderBy('name'));
                const stagesQuery = query(collection(firestore, `departments/${selectedDepartment}/workStages`), orderBy('name'));

                const [typesSnapshot, stagesSnapshot] = await Promise.all([
                    getDocs(typesQuery),
                    getDocs(stagesQuery)
                ]);
                
                const fetchedTypes = typesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionType));
                setTransactionTypes(fetchedTypes);

                const fetchedStages = stagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkStage));
                setWorkStages(fetchedStages);

            } catch (error) {
                console.error("Failed to fetch department data:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب بيانات القسم.' });
            } finally {
                setTypesLoading(false);
                setStagesLoading(false);
            }
        };

        fetchDepartmentData();
    }, [firestore, selectedDepartment, toast]);

    const resetForm = () => {
        setTransactionType('');
        setDescription('');
        setAssignedEngineerId('');
        setSelectedDepartment('');
        setWorkStages([]);
    };

    const handleDepartmentChange = (deptId: string) => {
        setSelectedDepartment(deptId);
        setTransactionType(''); // Reset transaction type when department changes
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات أو تحديد المستخدم.' });
            return;
        }

        if (!selectedDepartment || !transactionType) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار القسم ونوع المعاملة.' });
            return;
        }

        setIsSaving(true);

        try {
            const batch = writeBatch(firestore);
            const newTransactionRef = doc(collection(firestore, `clients/${clientId}/transactions`));
            const newTransactionRefId = newTransactionRef.id;

            const selectedDeptName = departments.find(d => d.id === selectedDepartment)?.name || '';

            let engineerForTransactionId: string | null = assignedEngineerId || null;

            // Special logic for "بلدية سكن خاص"
            if (transactionType === 'تصميم بلدية سكن خاص') {
                const clientRef = doc(firestore, 'clients', clientId);
                const clientSnap = await getDoc(clientRef);
                if (clientSnap.exists()) {
                    const clientData = clientSnap.data() as Client;
                    if (clientData.assignedEngineer) {
                        engineerForTransactionId = clientData.assignedEngineer;
                    } else {
                         toast({ variant: 'destructive', title: 'خطأ', description: 'يجب إسناد مهندس مسؤول للعميل أولاً قبل إنشاء معاملة سكن خاص.' });
                         setIsSaving(false);
                         return;
                    }
                }
            }

            const engineer = engineers.find(e => e.id === engineerForTransactionId);
            
            let initialStages: Partial<TransactionStage>[] = [];

            if (transactionType === 'تصميم بلدية سكن خاص') {
                const predefinedStages = [
                    'استفسارات عامة',
                    'توقيع العقد',
                    'الانتهاء من الدور (الارضي والسرداب)',
                    'الانتهاء من الدور الارضي',
                    'الانتهاء من الدور الاول',
                    'الانتهاء من الدور الثاني والسطح',
                    'إصدار واستلام رخصة البناء',
                    'تعديلات ومناقشات',
                ];
                initialStages = predefinedStages.map(name => ({
                    name: name,
                    status: 'pending' as const,
                    startDate: null,
                    endDate: null,
                    notes: ''
                }));
            } else {
                initialStages = workStages.length > 0 ? workStages.map(stage => ({
                    name: stage.name,
                    status: 'pending' as const,
                    startDate: null,
                    endDate: null,
                    notes: ''
                })) : [];
            }


            const newTransactionData: Omit<ClientTransaction, 'id'> = {
                clientId,
                transactionType,
                description,
                assignedEngineerId: engineerForTransactionId,
                status: 'new',
                stages: initialStages,
                departmentId: selectedDepartment,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            batch.set(newTransactionRef, newTransactionData);

            // Add creation log event to the transaction's timeline
            const timelineCollectionRef = collection(newTransactionRef, 'timelineEvents');
            const logEventRef = doc(timelineCollectionRef);
            
            let logContent = `أنشأ المعاملة "${transactionType}".`;
            if (engineer) {
                logContent += ` وأسندها إلى المهندس ${engineer.fullName}.`;
            }

            batch.set(logEventRef, {
                type: 'log',
                content: logContent,
                userId: currentUser.id,
                userName: currentUser.fullName,
                userAvatar: currentUser.avatarUrl,
                createdAt: serverTimestamp(),
            });

            await batch.commit();
            
            toast({ title: 'نجاح', description: 'تمت إضافة المعاملة والسجل بنجاح.' });
            
            // --- Notification Logic ---
            const engineerName = engineer ? engineer.fullName : 'غير مسند';
            const recipients = new Set<string>();

            if (currentUser.id) recipients.add(currentUser.id);

            if (engineerForTransactionId) {
                const targetUserId = await findUserIdByEmployeeId(firestore, engineerForTransactionId);
                if (targetUserId) recipients.add(targetUserId);
            }
            
            for (const recipientId of recipients) {
                const isCreator = recipientId === currentUser.id;
                const title = isCreator ? 'تم إنشاء معاملة بنجاح' : 'تم إسناد معاملة جديدة لك';
                const body = isCreator 
                    ? `لقد أنشأت المعاملة "${transactionType}" للعميل ${clientName} وأسندتها إلى ${engineerName}.`
                    : `أسند إليك ${currentUser.fullName} المعاملة "${transactionType}" للعميل ${clientName}.`;
                
                await createNotification(firestore, { userId: recipientId, title, body, link: `/dashboard/clients/${clientId}/transactions/${newTransactionRefId}` });
            }
            
            resetForm();
            onClose();

        } catch (error) {
            console.error("Error adding transaction:", error);
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: 'فشل في إضافة المعاملة.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const engineerOptions = useMemo(() => {
        if (!selectedDepartment) return [];
        const selectedDeptName = departments.find(d => d.id === selectedDepartment)?.name;
        return engineers.filter(e => e.department === selectedDeptName).map(e => ({ value: e.id!, label: e.fullName, searchKey: e.employeeNumber || e.civilId }))
    }, [engineers, selectedDepartment, departments]);

    const departmentOptions = useMemo(() => departments.map(d => ({ value: d.id, label: d.name })), [departments]);
    const transactionTypeOptions = useMemo(() => transactionTypes.map(t => ({ value: t.name, label: t.name })), [transactionTypes]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { resetForm(); onClose(); } }}>
            <DialogContent
                dir="rtl"
                className="sm:max-w-lg"
                onInteractOutside={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('[cmdk-root]') || target.closest('[role="listbox"]') || target.closest('[data-radix-popper-content-wrapper]') || target.closest('[data-inline-search-list-options]')) {
                        e.preventDefault();
                    }
                }}
            >
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>إضافة معاملة داخلية جديدة</DialogTitle>
                        <DialogDescription>
                            أضف خدمة جديدة لملف العميل. سيتم إشعار المهندس المسؤول (إن وجد).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-6">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="grid gap-2">
                                <Label>القسم <span className="text-destructive">*</span></Label>
                                <InlineSearchList 
                                    value={selectedDepartment} 
                                    onSelect={handleDepartmentChange} 
                                    options={departmentOptions} 
                                    placeholder={departmentsLoading ? "تحميل..." : "اختر القسم..."} 
                                    disabled={departmentsLoading}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>نوع المعاملة <span className="text-destructive">*</span></Label>
                                <InlineSearchList 
                                    value={transactionType} 
                                    onSelect={setTransactionType} 
                                    options={transactionTypeOptions} 
                                    placeholder={!selectedDepartment ? "اختر قسمًا أولاً" : typesLoading ? "تحميل..." : "اختر نوع المعاملة..."} 
                                    disabled={!selectedDepartment || typesLoading || stagesLoading}
                                />
                            </div>
                        </div>

                        {transactionType === 'تصميم بلدية سكن خاص' ? (
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle>إسناد تلقائي</AlertTitle>
                                <AlertDescription>
                                    سيتم إسناد هذه المعاملة تلقائيًا إلى المهندس المسؤول عن ملف العميل.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <div className="grid gap-2">
                                <Label>إسناد إلى مهندس (اختياري)</Label>
                                <InlineSearchList 
                                    value={assignedEngineerId} 
                                    onSelect={setAssignedEngineerId} 
                                    options={engineerOptions} 
                                    placeholder={!selectedDepartment ? "اختر قسمًا أولاً" : engineersLoading ? "تحميل..." : "ابحث بالاسم أو الرقم الوظيفي..."} 
                                    disabled={!selectedDepartment || engineersLoading}
                                />
                            </div>
                        )}
                        
                         <div className="grid gap-2">
                            <Label htmlFor="description">وصف المعاملة</Label>
                            <Textarea 
                                id="description" 
                                placeholder="أضف أي تفاصيل أو ملاحظات إضافية هنا..." 
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            {isSaving ? 'جاري الحفظ...' : 'حفظ المعاملة'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
