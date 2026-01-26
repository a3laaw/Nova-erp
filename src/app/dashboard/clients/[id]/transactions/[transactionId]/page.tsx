'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc } from '@/firebase';
import { doc, getDocs, collection, writeBatch, serverTimestamp, updateDoc, query, orderBy } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, BadgeInfo, Calendar, User, History, MessageSquare, Save, Loader2, FileText, Pencil, Printer, Workflow, Play, Check, Pause } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { TransactionTimeline } from '@/components/clients/transaction-timeline';
import type { Employee, ClientTransaction, TransactionStage } from '@/lib/types';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContractClausesForm } from '@/components/clients/contract-clauses-form';
import { cn, cleanFirestoreData } from '@/lib/utils';
import { format, isPast, formatDistanceToNowStrict } from 'date-fns';
import { ar } from 'date-fns/locale';


// Using the same translation objects from client profile page
const transactionStatusTranslations: Record<string, string> = {
  new: 'جديدة',
  'in-progress': 'قيد التنفيذ',
  completed: 'مكتملة',
  submitted: 'تم تسليمها',
  'on-hold': 'مجمدة',
};

const transactionStatusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  'in-progress': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  submitted: 'bg-purple-100 text-purple-800 border-purple-200',
  'on-hold': 'bg-gray-100 text-gray-800 border-gray-200',
};

const stageStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  skipped: 'bg-yellow-100 text-yellow-800',
};

const stageStatusTranslations: Record<string, string> = {
  pending: 'معلقة',
  'in-progress': 'قيد التنفيذ',
  completed: 'مكتملة',
  skipped: 'تم تخطيها',
};

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: React.ReactNode | string | number | null | undefined }) {
    if (!value) return null;
    return (
        <div className="flex items-center gap-4 text-sm">
            <div className="flex-shrink-0 text-muted-foreground pt-1">{icon}</div>
            <div className="font-semibold w-32">{label}</div>
            <div className="text-muted-foreground break-words">{value}</div>
        </div>
    );
}

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const transactionId = Array.isArray(params.transactionId) ? params.transactionId[0] : params.transactionId;
  
  const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());
  const [newStatus, setNewStatus] = useState('');
  const [newEngineerId, setNewEngineerId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isContractFormOpen, setIsContractFormOpen] = useState(false);
  const [stages, setStages] = useState<TransactionStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(true);


  // --- Data Fetching ---
  const transactionRef = useMemo(() => {
    if (!firestore || !clientId || !transactionId) return null;
    return doc(firestore, 'clients', clientId, 'transactions', transactionId);
  }, [firestore, clientId, transactionId]);
  
  const clientRef = useMemo(() => {
    if (!firestore || !clientId) return null;
    return doc(firestore, 'clients', clientId);
  }, [firestore, clientId]);

  const [transactionSnapshot, transactionLoading, transactionError] = useDoc(transactionRef);
  const [clientSnapshot, clientLoading, clientError] = useDoc(clientRef);
  
  useEffect(() => {
    if (!firestore) return;
    const fetchEmployees = async () => {
        try {
            const querySnapshot = await getDocs(collection(firestore, 'employees'));
            const newMap = new Map<string, string>();
            querySnapshot.forEach(doc => {
                const emp = doc.data() as Employee;
                newMap.set(doc.id, emp.fullName);
            });
            setEmployeesMap(newMap);
        } catch (error) {
            console.error("Failed to fetch employees map for transaction detail:", error);
        }
    };
    fetchEmployees();
  }, [firestore]);


  const transaction = useMemo(() => {
    if (transactionSnapshot?.exists()) {
        return { id: transactionSnapshot.id, ...transactionSnapshot.data() } as ClientTransaction;
    }
    return null;
  }, [transactionSnapshot]);
  
  useEffect(() => {
    if (!transaction || !firestore) return;

    const sortAndSetStages = async () => {
        setLoadingStages(true);
        let stagesToSort = [...(transaction.stages || [])];

        // If stages already have an order property, just sort by it.
        if (stagesToSort.every(s => typeof (s as any).order === 'number')) {
            stagesToSort.sort((a, b) => ((a as any).order ?? 999) - ((b as any).order ?? 999));
            setStages(stagesToSort);
            setLoadingStages(false);
            return;
        }

        // --- Fallback for old data: Fetch order from reference data ---
        if (transaction.departmentId) {
            try {
                const stagesQuery = query(
                    collection(firestore, `departments/${transaction.departmentId}/workStages`),
                    orderBy('order', 'asc')
                );
                const stagesSnapshot = await getDocs(stagesQuery);
                const orderMap = new Map<string, number>();
                stagesSnapshot.docs.forEach(doc => {
                    orderMap.set(doc.data().name, doc.data().order);
                });
                
                stagesToSort.sort((a, b) => {
                    const orderA = orderMap.get(a.name) ?? 999;
                    const orderB = orderMap.get(b.name) ?? 999;
                    // Add secondary sort by name for stability if orders are equal
                    if (orderA === orderB) {
                        return a.name.localeCompare(b.name);
                    }
                    return orderA - orderB;
                });

            } catch (e) {
                console.error("Could not fetch reference order for stages, using default sort.", e);
                // Fallback to alphabetical if fetching reference fails
                stagesToSort.sort((a, b) => a.name.localeCompare(b.name));
            }
        } else {
             // If there's no departmentId, just sort alphabetically.
             stagesToSort.sort((a, b) => a.name.localeCompare(b.name));
        }
        
        setStages(stagesToSort);
        setLoadingStages(false);
    };

    sortAndSetStages();
    // Also update basic data
    setNewStatus(transaction.status);
    setNewEngineerId(transaction.assignedEngineerId || '');
    
  }, [transaction, firestore]);

  const client = useMemo(() => {
    if (clientSnapshot?.exists()) {
        return { id: clientSnapshot.id, ...clientSnapshot.data() };
    }
    return null;
  }, [clientSnapshot]);

  const formatDate = (dateValue: any): string => {
      if (!dateValue) return '-';
      const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
      if (isNaN(date.getTime())) return '-';
      return new Intl.DateTimeFormat('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  const handleUpdateTransaction = async () => {
    if (!firestore || !currentUser || !client || !transaction) return;

    const statusChanged = newStatus !== transaction.status;
    const engineerChanged = newEngineerId !== (transaction.assignedEngineerId || '');

    if (!statusChanged && !engineerChanged) {
        toast({ title: 'لا توجد تغييرات', description: 'لم يتم تغيير الحالة أو المهندس المسؤول.' });
        return;
    }
    
    setIsSaving(true);
    
    const batch = writeBatch(firestore);
    const transactionRefDoc = doc(firestore, 'clients', clientId, 'transactions', transactionId);
    const timelineRef = collection(transactionRefDoc, 'timelineEvents');
    
    const updateData: any = { updatedAt: serverTimestamp() };

    if (statusChanged) {
        updateData.status = newStatus;
        const logContent = `قام بتغيير حالة المعاملة من "${transactionStatusTranslations[transaction.status]}" إلى "${transactionStatusTranslations[newStatus]}".`;
        batch.set(doc(timelineRef), {
            type: 'log',
            content: logContent,
            userId: currentUser.id,
            userName: currentUser.fullName,
            userAvatar: currentUser.avatarUrl,
            createdAt: serverTimestamp(),
        });
    }

    if (engineerChanged) {
        updateData.assignedEngineerId = newEngineerId;
        const oldEngineerName = transaction.assignedEngineerId ? employeesMap.get(transaction.assignedEngineerId) || 'غير مسند' : 'غير مسند';
        const newEngineerName = newEngineerId ? employeesMap.get(newEngineerId) || 'غير مسند' : 'غير مسند';
        const logContent = `قام بتغيير المهندس المسؤول من "${oldEngineerName}" إلى "${newEngineerName}".`;
        batch.set(doc(timelineRef), {
            type: 'log',
            content: logContent,
            userId: currentUser.id,
            userName: currentUser.fullName,
            userAvatar: currentUser.avatarUrl,
            createdAt: serverTimestamp(),
        });
        
        if (transaction.transactionType === 'بلدية سكن خاص') {
            const clientRefDoc = doc(firestore, 'clients', clientId);
            batch.update(clientRefDoc, { assignedEngineer: newEngineerId || null });
        }
    }

    const safeUpdateData = cleanFirestoreData(updateData);
    console.log("البيانات قبل التنظيف:", JSON.stringify(updateData, null, 2));
    console.log("البيانات بعد التنظيف:", JSON.stringify(safeUpdateData, null, 2));
    batch.update(transactionRefDoc, safeUpdateData);
    
    try {
        await batch.commit();
        toast({ title: 'نجاح', description: 'تم تحديث المعاملة بنجاح.' });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث المعاملة.' });
    } finally {
        setIsSaving(false);
    }
};

  const handleStageStatusChange = async (stageIndex: number, newStatus: TransactionStage['status']) => {
    if (!firestore || !transaction || !currentUser) return;
    
    const stage = stages[stageIndex];
    
    // Allow 'تعديلات ومناقشات' to be started at any time
    if (newStatus === 'in-progress' && stage.name !== 'تعديلات ومناقشات' && stageIndex > 0 && stages[stageIndex - 1].status !== 'completed') {
        toast({
            variant: 'destructive',
            title: 'لا يمكن بدء هذه المرحلة',
            description: 'الرجاء إكمال المرحلة السابقة أولاً.',
        });
        return;
    }

    const updatedStages = [...stages];
    const stageToUpdate = updatedStages[stageIndex];
    const oldStatus = stageToUpdate.status;
    stageToUpdate.status = newStatus;

    if (newStatus === 'in-progress' && oldStatus !== 'in-progress') {
        stageToUpdate.startDate = new Date();
    }
    
    if (newStatus === 'completed' && oldStatus !== 'completed') {
        stageToUpdate.endDate = new Date();
    }

    if (newStatus === 'pending' && oldStatus === 'in-progress') {
      stageToUpdate.startDate = null;
      stageToUpdate.expectedEndDate = null;
    }
    
    setStages(updatedStages); // Optimistic update

    const transactionRefDoc = doc(firestore, 'clients', clientId, 'transactions', transactionId);
    const timelineCollectionRef = collection(transactionRefDoc, 'timelineEvents');
    
    try {
        const batch = writeBatch(firestore);
        const safeUpdatedStages = cleanFirestoreData({ stages: updatedStages });
        console.log("البيانات قبل التنظيف:", JSON.stringify({ stages: updatedStages }, null, 2));
        console.log("البيانات بعد التنظيف:", JSON.stringify(safeUpdatedStages, null, 2));
        batch.update(transactionRefDoc, safeUpdatedStages);
        
        const logContent = `قام بتغيير حالة المرحلة "${stageToUpdate.name}" إلى "${stageStatusTranslations[newStatus]}".`;
        batch.set(doc(timelineCollectionRef), {
            type: 'log',
            content: logContent,
            userId: currentUser.id,
            userName: currentUser.fullName,
            userAvatar: currentUser.avatarUrl,
            createdAt: serverTimestamp(),
        });

        await batch.commit();

        toast({ title: 'نجاح', description: `تم تحديث حالة المرحلة بنجاح.` });
    } catch (e) {
        console.error("Failed to update stage status:", e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث المرحلة.' });
        // Revert optimistic update on error
        setStages(transaction.stages || []);
    }
  };

  const renderStageTiming = (stage: TransactionStage) => {
    if (stage.status !== 'in-progress' || !stage.expectedEndDate) {
        return null;
    }
    
    const expectedEndDate = stage.expectedEndDate.toDate ? stage.expectedEndDate.toDate() : new Date(stage.expectedEndDate);
    const now = new Date();
    const isOverdue = isPast(expectedEndDate);
    
    const distance = formatDistanceToNowStrict(expectedEndDate, { addSuffix: true, locale: ar });

    return (
        <Badge variant={isOverdue ? "destructive" : "secondary"}>
            {isOverdue ? `متأخر ${distance}` : `متبقي ${distance}`}
        </Badge>
    );
  };


  // --- Render Logic ---
  const isLoading = transactionLoading || clientLoading;

  if (isLoading) {
    return (
        <div className="space-y-6" dir="rtl">
             <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-32 w-full mt-6" />
                </CardContent>
            </Card>
        </div>
    );
  }

  if (transactionError || clientError || !transaction || !client) {
    return (
      <div className="text-center py-10" dir="rtl">
        <p className="text-destructive">{transactionError || clientError ? 'فشل تحميل البيانات.' : 'لم يتم العثور على المعاملة أو العميل.'}</p>
      </div>
    );
  }
  
  return (
    <>
    {transaction && (
        <ContractClausesForm
            isOpen={isContractFormOpen}
            onClose={() => setIsContractFormOpen(false)}
            transaction={transaction}
            clientId={clientId}
        />
    )}
    <div className='space-y-6' dir='rtl'>
        <Card>
            <CardHeader>
                <div className='flex justify-between items-start'>
                    <div className='flex items-center gap-4'>
                        <CardTitle className='text-2xl'>{transaction.transactionType}</CardTitle>
                        {transaction.contract ? (
                           <>
                                <Button variant="outline" size="sm" onClick={() => setIsContractFormOpen(true)}>
                                    <Pencil className="ml-2 h-4 w-4" />
                                    تعديل بنود العقد
                                </Button>
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={`/dashboard/clients/${clientId}/transactions/${transactionId}/contract`}>
                                        <Printer className="ml-2 h-4 w-4" />
                                        عرض وطباعة العقد
                                    </Link>
                                </Button>
                           </>
                        ) : (
                            <Button variant="default" size="sm" onClick={() => setIsContractFormOpen(true)}>
                                إنشاء عقد
                            </Button>
                        )}
                    </div>
                    <Badge variant="outline" className={transactionStatusColors[transaction.status]}>
                        {transactionStatusTranslations[transaction.status]}
                    </Badge>
                </div>
                 <CardDescription>
                    معاملة خاصة بالعميل: <Link href={`/dashboard/clients/${clientId}`} className='text-primary hover:underline'>{client.nameAr}</Link>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className='grid md:grid-cols-2 gap-6'>
                    <InfoRow icon={<User />} label="المهندس المسؤول" value={transaction.assignedEngineerId ? (employeesMap.get(transaction.assignedEngineerId) || 'جاري التحميل...') : <span className='text-muted-foreground'>لم يحدد</span>} />
                    <InfoRow icon={<Calendar />} label="تاريخ الإنشاء" value={formatDate(transaction.createdAt)} />
                </div>
                {transaction.description && (
                     <div className='mt-4 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md'>
                        <p className='font-semibold mb-1 text-foreground'>ملاحظات المعاملة:</p>
                        {transaction.description}
                    </div>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>إدارة المعاملة</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                    <Label htmlFor="status">تغيير الحالة</Label>
                    <Select dir="rtl" value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {Object.keys(transactionStatusTranslations).map(key => (
                                <SelectItem key={key} value={key}>{transactionStatusTranslations[key]}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {transaction.transactionType !== 'بلدية سكن خاص' ? (
                    <div className="grid gap-2">
                        <Label htmlFor="engineer">تغيير المهندس المسؤول</Label>
                        <Select dir="rtl" value={newEngineerId} onValueChange={setNewEngineerId}>
                            <SelectTrigger id="engineer"><SelectValue placeholder="اختر مهندسا..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unassign">إزالة الإسناد</SelectItem>
                                {Array.from(employeesMap.entries()).map(([id, name]) => (
                                    <SelectItem key={id} value={id}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ) : (
                    <div className="grid gap-2">
                        <Label>المهندس المسؤول</Label>
                        <Input value={employeesMap.get(newEngineerId) || 'غير مسند'} readOnly disabled />
                        <p className="text-xs text-muted-foreground">يتم التحكم في المهندس من ملف العميل لهذه المعاملة.</p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex justify-end">
                <Button onClick={handleUpdateTransaction} disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                    حفظ التغييرات
                </Button>
            </CardFooter>
        </Card>
        
         <Tabs defaultValue="stages" dir="rtl">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="stages">مراحل المعاملة</TabsTrigger>
                <TabsTrigger value="comments">التعليقات والمتابعة</TabsTrigger>
                <TabsTrigger value="history">سجل التغييرات</TabsTrigger>
            </TabsList>
            <TabsContent value="stages" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle className='flex items-center gap-2'><Workflow className='text-primary'/> مراحل المعاملة</CardTitle>
                        <CardDescription>تتبع التقدم في كل مرحلة من مراحل المعاملة.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingStages ? <Skeleton className="h-48 w-full" /> : stages.length === 0 ? (
                            <div className="text-center p-8 text-muted-foreground">لا توجد مراحل محددة لهذه المعاملة.</div>
                        ) : (
                            <div className="space-y-4">
                                {stages.map((stage, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                        <div className="flex items-center gap-4">
                                            <Badge variant="outline" className={cn("w-24 justify-center", stageStatusColors[stage.status])}>
                                                {stageStatusTranslations[stage.status]}
                                            </Badge>
                                            <div className="font-semibold">{stage.name}</div>
                                            {renderStageTiming(stage)}
                                        </div>
                                        <div className="flex gap-2">
                                            {stage.status === 'pending' && (
                                                <Button size="sm" variant="outline" onClick={() => handleStageStatusChange(index, 'in-progress')}>
                                                    <Play className="ml-2 h-4 w-4" />
                                                    بدء
                                                </Button>
                                            )}
                                            {stage.status === 'in-progress' && (
                                                <>
                                                    <Button size="sm" variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100" onClick={() => handleStageStatusChange(index, 'completed')}>
                                                        <Check className="ml-2 h-4 w-4" />
                                                        إكمال
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => handleStageStatusChange(index, 'pending')}>
                                                        <Pause className="ml-2 h-4 w-4" />
                                                        إيقاف مؤقت
                                                    </Button>
                                                </>
                                            )}
                                            {stage.status === 'completed' && (
                                                <div className="text-sm text-green-600 flex items-center gap-2">
                                                    <Check className="h-4 w-4" />
                                                    مكتملة في {formatDate(stage.endDate)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="comments" className="mt-6">
                <TransactionTimeline
                  clientId={clientId}
                  transactionId={transactionId}
                  filterType="comment"
                  showInput={true}
                  title="التعليقات والمتابعة"
                  icon={<MessageSquare className="text-primary" />}
                  client={client}
                  transaction={transaction}
                />
            </TabsContent>
            <TabsContent value="history" className="mt-6">
                <TransactionTimeline
                  clientId={clientId}
                  transactionId={transactionId}
                  filterType="log"
                  showInput={false}
                  title="سجل التغييرات"
                  icon={<History className="text-primary" />}
                  client={client}
                  transaction={transaction}
                />
            </TabsContent>
        </Tabs>

    </div>
    </>
  );
}
