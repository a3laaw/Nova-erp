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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, PlusCircle, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { doc, updateDoc, getDoc, collection, serverTimestamp, getDocs, query, runTransaction, limit, where, collectionGroup, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { ClientTransaction, ContractClause, ContractTemplate, ContractTerm, ContractScopeItem, TransactionStage, WorkStage } from '@/lib/types';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { useRouter } from 'next/navigation';

interface ContractClausesFormProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: ClientTransaction | null | Partial<ClientTransaction>;
  clientId: string;
  clientName: string;
  quotationIdToUpdate?: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);
const milestoneNames = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];
const arabicOrdinals = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً', 'سابعاً', 'ثامناً', 'تاسعاً', 'عاشراً', 'حادي عشر', 'ثاني عشر', 'ثالث عشر', 'رابع عشر', 'خامس عشر'];


// --- Sub-component for Template Selection ---
function TemplateSelectionView({
  templates,
  onSelect,
  onContinueWithout,
}: {
  templates: ContractTemplate[];
  onSelect: (template: ContractTemplate) => void;
  onContinueWithout: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>اختر نموذج العقد</DialogTitle>
        <DialogDescription>
          تم العثور على عدة نماذج مرتبطة بنوع هذه المعاملة. الرجاء اختيار النموذج المناسب للبدء.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className="block w-full text-right p-4 border rounded-lg hover:bg-accent transition-colors"
          >
            <p className="font-semibold">{t.title}</p>
            <p className="text-sm text-muted-foreground">{t.description}</p>
          </button>
        ))}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onContinueWithout}>
          متابعة بدون نموذج (إنشاء يدوي)
        </Button>
      </DialogFooter>
    </>
  );
}


export function ContractClausesForm({ isOpen, onClose, transaction, clientId, clientName, quotationIdToUpdate }: ContractClausesFormProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Form data state
  const [scopeOfWork, setScopeOfWork] = useState<ContractScopeItem[]>([]);
  const [clauses, setClauses] = useState<ContractClause[]>([]);
  const [terms, setTerms] = useState<ContractTerm[]>([]);
  const [openClauses, setOpenClauses] = useState<ContractTerm[]>([]);
  
  // Control flow state
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<'loading' | 'select' | 'edit'>('loading');
  const [availableTemplates, setAvailableTemplates] = useState<ContractTemplate[]>([]);
  const [chosenTemplate, setChosenTemplate] = useState<ContractTemplate | null>(null);

  const [referenceData, setReferenceData] = useState<{ stages: MultiSelectOption[], templates: ContractTemplate[] }>({ stages: [], templates: [] });
  const [departmentWorkStages, setDepartmentWorkStages] = useState<WorkStage[]>([]);
  const [loadingRefData, setLoadingRefData] = useState(true);

  // This effect resets the entire component's state when the dialog is closed.
  useEffect(() => {
    if (!isOpen) {
      setScopeOfWork([]);
      setClauses([]);
      setTerms([]);
      setOpenClauses([]);
      setIsSaving(false);
      setStep('loading');
      setAvailableTemplates([]);
      setChosenTemplate(null);
      setReferenceData({ stages: [], templates: [] });
      setDepartmentWorkStages([]);
      setLoadingRefData(true);
    }
  }, [isOpen]);

  const populateFormFromExistingContract = useCallback((contract: NonNullable<ClientTransaction['contract']>) => {
    setClauses(JSON.parse(JSON.stringify(contract.clauses || [])));
    setScopeOfWork(JSON.parse(JSON.stringify(contract.scopeOfWork || [])));
    setTerms(JSON.parse(JSON.stringify(contract.termsAndConditions || [])));
    setOpenClauses(JSON.parse(JSON.stringify(contract.openClauses || [])));
    setChosenTemplate({ // Create a mock template object for consistency
      title: transaction?.transactionType || '',
      financials: {
        type: contract.financialsType || 'fixed',
        totalAmount: contract.totalAmount || 0,
        discount: 0,
        milestones: [],
      },
      description: '', transactionTypes: [], scopeOfWork: [], termsAndConditions: [], openClauses: [],
    });
  }, [transaction]);

  const populateFormFromTemplate = useCallback((template: ContractTemplate | null) => {
      const totalContractAmount = template?.financials.totalAmount || 0;
      const isPercentage = template?.financials.type === 'percentage';

      const calculatedClauses = (template?.financials.milestones || []).map(m => ({
          id: m.id || generateId(),
          name: m.name,
          amount: isPercentage ? ((m.value || 0) / 100) * totalContractAmount : (m.value || 0),
          status: 'غير مستحقة' as const,
          percentage: isPercentage ? m.value : undefined,
          condition: m.condition || ''
      }));

      setClauses(calculatedClauses);
      setScopeOfWork(template?.scopeOfWork || []);
      setTerms(template?.termsAndConditions || []);
      setOpenClauses(template?.openClauses || []);
      setChosenTemplate(template);
  }, []);

  // Effect 1: Fetch all reference data (templates, stages) once when the dialog opens.
  useEffect(() => {
    if (!isOpen || !firestore || !transaction) return;

    const fetchAllReferenceData = async () => {
      setLoadingRefData(true);
      setStep('loading');
      try {
        const allTemplatesQuery = query(collection(firestore, 'contractTemplates'));
        
        let stages: MultiSelectOption[] = [];
        let fetchedDeptStages: WorkStage[] = [];

        if(transaction.departmentId) {
            const departmentStagesQuery = query(collection(firestore, `departments/${transaction.departmentId}/workStages`), orderBy('order', 'asc'));
            const departmentStagesSnapshot = await getDocs(departmentStagesQuery);
            fetchedDeptStages = departmentStagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkStage));
            stages = fetchedDeptStages.map(stage => ({ value: stage.name, label: stage.name }));
        }

        const [
            allTemplatesSnapshot,
        ] = await Promise.all([
            getDocs(allTemplatesQuery),
        ]);
        
        const templates = allTemplatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate));
        
        setDepartmentWorkStages(fetchedDeptStages);
        setReferenceData({ templates, stages });

      } catch (error) {
        console.error("Error fetching reference data:", error);
        toast({ variant: "destructive", title: "خطأ", description: "فشل في جلب البيانات المرجعية." });
        setReferenceData({ templates: [], stages: [] });
      } finally {
        setLoadingRefData(false);
      }
    };

    fetchAllReferenceData();
  }, [isOpen, firestore, transaction, toast]);


  // Effect 2: Populate form or show template selection once reference data is loaded.
  useEffect(() => {
    if (loadingRefData || !isOpen || !transaction) return;

    if (transaction.contract) {
      populateFormFromExistingContract(transaction.contract);
      setStep('edit');
    } else {
      const matchingTemplates = referenceData.templates.filter(t => t.transactionTypes?.includes(transaction.transactionType || ''));
      
      if (matchingTemplates.length > 1) {
        setAvailableTemplates(matchingTemplates);
        setStep('select');
      } else {
        const templateToUse = matchingTemplates.length === 1 ? matchingTemplates[0] : null;
        populateFormFromTemplate(templateToUse);
        setStep('edit');
      }
    }
  }, [loadingRefData, isOpen, transaction, referenceData.templates, populateFormFromTemplate, populateFormFromExistingContract]);


  // --- State Handlers ---

  const addScopeItem = () => setScopeOfWork(prev => [...prev, { id: generateId(), title: '', description: '' }]);
  const updateScopeItem = (id: string, field: 'title' | 'description', value: string) => {
    setScopeOfWork(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const removeScopeItem = (id: string) => setScopeOfWork(prev => prev.filter(item => item.id !== id));
  const reorderScopeItem = (index: number, direction: 'up' | 'down') => {
      const newItems = [...scopeOfWork];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newItems.length) return;
      [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
      setScopeOfWork(newItems);
  };

  const addTerm = () => setTerms(prev => [...prev, { id: generateId(), text: '' }]);
  const updateTerm = (id: string, value: string) => {
    setTerms(prev => prev.map(term => term.id === id ? { ...term, text: value } : term));
  };
  const removeTerm = (id: string) => setTerms(prev => prev.filter(term => term.id !== id));
  const reorderTerm = (index: number, direction: 'up' | 'down') => {
    const newTerms = [...terms];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newTerms.length) return;
    [newTerms[index], newTerms[newIndex]] = [newTerms[newIndex], newTerms[index]];
    setTerms(newTerms);
  };

  const addOpenClause = () => setOpenClauses(prev => [...prev, { id: generateId(), text: '' }]);
  const updateOpenClause = (id: string, value: string) => {
    setOpenClauses(prev => prev.map(term => term.id === id ? { ...term, text: value } : term));
  };
  const removeOpenClause = (id: string) => setOpenClauses(prev => prev.filter(term => term.id !== id));
  const reorderOpenClause = (index: number, direction: 'up' | 'down') => {
    const newClauses = [...openClauses];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newClauses.length) return;
    [newClauses[index], newClauses[newIndex]] = [newClauses[newIndex], newClauses[index]];
    setOpenClauses(newClauses);
  };
  
  const addClause = () => {
    setClauses(prev => {
        const newIndex = prev.length;
        const newName = `الدفعة ${milestoneNames[newIndex] || `(${newIndex + 1})`}`;
        return [...prev, { id: generateId(), name: newName, amount: 0, status: 'غير مستحقة', condition: '' }];
    });
  };

  const handleClauseChange = (index: number, field: keyof ContractClause, value: string | number) => {
    setClauses(prev => {
        const newClauses = [...prev];
        const updatedClause = { ...newClauses[index], [field]: value };
        newClauses[index] = updatedClause;
        return newClauses;
    });
  };
  
  const removeClause = (id: string) => {
    setClauses(prev => prev.filter(c => c.id !== id));
  };

  const totalAmount = useMemo(() => clauses.reduce((sum, clause) => sum + Number(clause.amount || 0), 0), [clauses]);


  const handleSubmit = async () => {
    if (!firestore || !transaction || !currentUser) return;
    
    // Check if we are creating a new transaction or updating an existing one
    const isCreatingNewTransaction = !transaction.id;

    setIsSaving(true);
    let finalTransactionId = transaction.id;

    try {
        await runTransaction(firestore, async (transaction_firestore) => {
            const clientRef = doc(firestore, 'clients', clientId);
            
            // --- Transaction and Contract Data ---
            const contractData = { clauses, scopeOfWork, termsAndConditions: terms, openClauses, totalAmount, financialsType: chosenTemplate?.financials?.type || 'fixed' };
            const updatedStages = [...(transaction.stages || [])];
            const contractStageIndex = updatedStages.findIndex(stage => stage.name === 'توقيع العقد');
            if (contractStageIndex > -1 && updatedStages[contractStageIndex].status !== 'completed') {
                const stageToUpdate = { ...updatedStages[contractStageIndex] };
                stageToUpdate.status = 'completed';
                stageToUpdate.endDate = new Date();
                if (!stageToUpdate.startDate) stageToUpdate.startDate = new Date();
                updatedStages[contractStageIndex] = stageToUpdate as TransactionStage;
            }

            let transactionRef: any;

            if (isCreatingNewTransaction) {
                transactionRef = doc(collection(firestore, `clients/${clientId}/transactions`));
                finalTransactionId = transactionRef.id;
                transaction_firestore.set(transactionRef, {
                    ...transaction,
                    contract: contractData,
                    stages: updatedStages,
                    status: 'in-progress',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            } else {
                transactionRef = doc(firestore, 'clients', clientId, 'transactions', transaction.id!);
                const updatePayload = { contract: contractData, stages: updatedStages, status: 'in-progress' };
                transaction_firestore.update(transactionRef, cleanFirestoreData(updatePayload));
            }

            // --- History & Timeline Logging ---
            const historyCollectionRef = collection(firestore, `clients/${clientId}/history`);
            const transactionTimelineRef = collection(firestore, `clients/${clientId}/transactions/${finalTransactionId}/timelineEvents`);
            
            let contractDetailsComment = `**تم ${isCreatingNewTransaction ? 'توقيع' : 'تحديث'} العقد**\n\n`;
            contractDetailsComment += `**نوع المعاملة:** ${transaction.transactionType}\n`;
            contractDetailsComment += `**قيمة العقد:** ${formatCurrency(totalAmount)}\n\n`;
            contractDetailsComment += `**الدفعات:**\n` + clauses.map(c => `  - ${c.name}: ${formatCurrency(c.amount)}`).join('\n');
            
            const commentData = { type: 'comment' as const, content: contractDetailsComment, userId: currentUser.id, userName: currentUser.fullName || 'النظام', userAvatar: currentUser.avatarUrl || '', createdAt: serverTimestamp() };
            transaction_firestore.set(doc(transactionTimelineRef), commentData);
            transaction_firestore.set(doc(historyCollectionRef), commentData);

            // --- Accounting Logic (only on first contract creation for the client) ---
            const clientSnap = await transaction_firestore.get(clientRef);
            if (!clientSnap.exists()) throw new Error("Client not found.");
            
            if (clientSnap.data().status === 'new') {
                transaction_firestore.update(clientRef, { status: 'contracted' });

                const coaClientCounterRef = doc(firestore, 'counters', 'coa_clients');
                const journalEntryCounterRef = doc(firestore, 'counters', 'journalEntries');
                const parentAccountQuery = query(collection(firestore, 'chartOfAccounts'), where('name', '==', 'العملاء'), limit(1));
                const revenueAccountQuery = query(collection(firestore, 'chartOfAccounts'), where('name', '==', 'إيرادات استشارات هندسية'), limit(1));
                const clientAccountQuery = query(collection(firestore, 'chartOfAccounts'), where('name', '==', clientName), limit(1));

                const [coaClientCounterDoc, journalEntryCounterDoc, parentAccountSnap, revenueAccountSnap, clientAccountSnap] = await Promise.all([
                    transaction_firestore.get(coaClientCounterRef),
                    transaction_firestore.get(journalEntryCounterRef),
                    getDocs(parentAccountQuery), getDocs(revenueAccountQuery), getDocs(clientAccountQuery)
                ]);

                if (parentAccountSnap.empty || revenueAccountSnap.empty) throw new Error('حسابات رئيسية مفقودة.');

                let clientAccountId: string;
                if (clientAccountSnap.empty) {
                    const parentCode = parentAccountSnap.docs[0].data().code as string;
                    const nextClientCodeNumber = (coaClientCounterDoc.data()?.lastNumber || 0) + 1;
                    transaction_firestore.set(coaClientCounterRef, { lastNumber: nextClientCodeNumber }, { merge: true });
                    const newAccountRef = doc(collection(firestore, 'chartOfAccounts'));
                    transaction_firestore.set(newAccountRef, { name: clientName, code: `${parentCode}${String(nextClientCodeNumber).padStart(3, '0')}`, type: 'asset', level: 4 });
                    clientAccountId = newAccountRef.id;
                } else {
                    clientAccountId = clientAccountSnap.docs[0].id;
                }

                const currentYear = new Date().getFullYear();
                const nextJournalEntryNumber = ((journalEntryCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));
                transaction_firestore.set(newJournalEntryRef, {
                    entryNumber: `JV-${currentYear}-${String(nextJournalEntryNumber).padStart(4, '0')}`, date: serverTimestamp(), narration: `إثبات مديونية ${clientName} عن عقد "${transaction.transactionType}"`,
                    totalDebit: totalAmount, totalCredit: totalAmount, status: 'draft',
                    lines: [
                        { accountId: clientAccountId, accountName: clientName, debit: totalAmount, credit: 0 },
                        { accountId: revenueAccountSnap.docs[0].id, accountName: revenueAccountSnap.docs[0].data().name, debit: 0, credit: totalAmount }
                    ],
                    createdAt: serverTimestamp(), createdBy: currentUser.id, clientId, transactionId: finalTransactionId,
                });
                transaction_firestore.set(journalEntryCounterRef, { counts: { [currentYear]: nextJournalEntryNumber } }, { merge: true });
            }

            // Link quotation if it exists
            if (quotationIdToUpdate) {
                const quotationRef = doc(firestore, 'quotations', quotationIdToUpdate);
                transaction_firestore.update(quotationRef, { transactionId: finalTransactionId });
            }
        });

        toast({ title: 'نجاح', description: 'تم حفظ بنود العقد بنجاح.' });
        
        const engineerId = transaction.assignedEngineerId;
        const recipients = new Set<string>();
        if (currentUser) recipients.add(currentUser.id);
        if (engineerId) {
            const targetUserId = await findUserIdByEmployeeId(firestore, engineerId);
            if (targetUserId) recipients.add(targetUserId);
        }
        
        for (const recipientId of recipients) {
            const isCreator = recipientId === currentUser?.id;
            const actionText = transaction.contract ? 'تحديث عقد' : 'توقيع عقد';
            await createNotification(firestore, {
                userId: recipientId,
                title: isCreator ? `تم ${actionText} بنجاح` : `${actionText} جديد`,
                body: `قام ${currentUser?.fullName} بـ ${actionText} لمعاملة "${transaction.transactionType}" للعميل ${clientName}.`,
                link: `/dashboard/clients/${clientId}/transactions/${finalTransactionId}`
            });
        }
        
        onClose();
        // Redirect to the new transaction page if it was just created from a quotation
        if (isCreatingNewTransaction && quotationIdToUpdate && finalTransactionId) {
            router.push(`/dashboard/clients/${clientId}/transactions/${finalTransactionId}`);
        }

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'فشل حفظ بنود العقد.';
        toast({ variant: 'destructive', title: 'خطأ', description: errorMessage });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-3xl h-[90vh]" 
        dir="rtl"
        onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[cmdk-root]') || target.closest('[role="listbox"]') || target.closest('[data-radix-popper-content-wrapper]') || target.closest('[data-inline-search-list-options]')) {
                e.preventDefault();
            }
        }}
      >
        {step === 'loading' && (
            <>
                <DialogHeader>
                    <DialogTitle>جاري التحميل...</DialogTitle>
                    <DialogDescription>
                        يتم الآن جلب بيانات العقود والنماذج.
                    </DialogDescription>
                </DialogHeader>
                <div className='flex justify-center items-center h-48'><Loader2 className="h-8 w-8 animate-spin" /></div>
            </>
        )}
        
        {step === 'select' && (
          <TemplateSelectionView 
            templates={availableTemplates}
            onSelect={(selected) => {
              populateFormFromTemplate(selected);
              setStep('edit');
            }}
            onContinueWithout={() => {
              populateFormFromTemplate(null);
              setStep('edit');
            }}
          />
        )}
        
        {step === 'edit' && (
          <>
            <DialogHeader>
              <DialogTitle>إدارة بنود العقد للمعاملة</DialogTitle>
              <DialogDescription>
                {chosenTemplate ? `تعديل الدفعات المالية والشروط للعقد "${chosenTemplate.title}".` : 'لا يوجد نموذج عقد لهذه المعاملة، قم بالإنشاء اليدوي.'}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[calc(90vh-150px)]">
                <div className="p-4 space-y-8">
                    <section className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-semibold">نطاق العمل (Scope of Work)</h3>
                         <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-transparent">.</h3>
                            <Button size="sm" variant="outline" type="button" onClick={addScopeItem}><PlusCircle className="ml-2"/> إضافة بند</Button>
                        </div>
                        {scopeOfWork.map((item, index) => (
                            <div key={item.id} className="flex items-start gap-2 p-2 border rounded-md">
                               <span className="pt-2 font-semibold">{arabicOrdinals[index] || `${index + 1}-`}</span>
                               <div className="flex-grow space-y-2">
                                 <Input placeholder="عنوان البند" value={item.title} onChange={(e) => updateScopeItem(item.id, 'title', e.target.value)} />
                                 <Textarea placeholder="وصف تفصيلي للبند..." value={item.description} onChange={(e) => updateScopeItem(item.id, 'description', e.target.value)} rows={2} />
                               </div>
                                <div className="flex flex-col">
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderScopeItem(index, 'up')} disabled={index === 0}>
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderScopeItem(index, 'down')} disabled={index === scopeOfWork.length - 1}>
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                </div>
                                <Button variant="ghost" size="icon" type="button" onClick={() => removeScopeItem(item.id)} className="shrink-0"><Trash2 className="text-destructive h-4 w-4"/></Button>
                            </div>
                        ))}
                    </section>

                    <section className="space-y-4 p-4 border rounded-lg">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">الشروط والأحكام</h3>
                            <Button size="sm" variant="outline" type="button" onClick={addTerm}><PlusCircle className="ml-2"/> إضافة شرط</Button>
                        </div>
                         {terms.map((term, index) => (
                            <div key={term.id} className="flex items-center gap-2">
                               <span className="pt-2 font-semibold">{arabicOrdinals[index] || `${index + 1}-`}</span>
                               <Textarea value={term.text} onChange={(e) => updateTerm(term.id, e.target.value)} rows={2} className="flex-grow"/>
                               <div className="flex flex-col">
                                <Button variant="ghost" size="icon" type="button" onClick={() => reorderTerm(index, 'up')} disabled={index === 0}><ArrowUp className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="icon" type="button" onClick={() => reorderTerm(index, 'down')} disabled={index === terms.length - 1}><ArrowDown className="h-4 w-4"/></Button>
                               </div>
                               <Button variant="ghost" size="icon" type="button" onClick={() => removeTerm(term.id)}><Trash2 className="text-destructive h-4 w-4"/></Button>
                            </div>
                         ))}
                    </section>

                    <section className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-semibold">البنود المالية</h3>
                         <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40%]">اسم الدفعة</TableHead>
                                        <TableHead>شرط الاستحقاق</TableHead>
                                        <TableHead className="text-left w-[120px]">المبلغ (د.ك)</TableHead>
                                        <TableHead className="w-[50px]"><span className="sr-only">حذف</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {clauses.map((clause, index) => (
                                        <TableRow key={clause.id}>
                                            <TableCell>
                                                <Input value={clause.name} onChange={(e) => handleClauseChange(index, 'name', e.target.value)} />
                                            </TableCell>
                                            <TableCell>
                                                <Select value={clause.condition || '_NONE_'} onValueChange={(v) => handleClauseChange(index, 'condition', v === '_NONE_' ? '' : v)}>
                                                    <SelectTrigger><SelectValue placeholder="اختر شرط..."/></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="_NONE_">- بدون شرط -</SelectItem>
                                                        {referenceData.stages.map(stage => <SelectItem key={stage.value} value={stage.value}>{stage.label}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Input type="number" value={clause.amount} onChange={(e) => handleClauseChange(index, 'amount', Number(e.target.value))} className="dir-ltr text-left" />
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => removeClause(clause.id)}><Trash2 className="text-destructive h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={2} className="font-bold text-lg">الإجمالي</TableCell>
                                        <TableCell className="font-bold text-lg text-left font-mono">{formatCurrency(totalAmount)}</TableCell>
                                        <TableCell />
                                    </TableRow>
                                </TableFooter>
                            </Table>
                         </div>
                         <div className="flex justify-end">
                            <Button variant="outline" size="sm" type="button" onClick={addClause}><PlusCircle className="ml-2"/> إضافة دفعة</Button>
                         </div>
                    </section>
                    
                     <section className="space-y-4 p-4 border rounded-lg">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">بنود إضافية (اختياري)</h3>
                            <Button size="sm" variant="outline" type="button" onClick={addOpenClause}><PlusCircle className="ml-2 h-4 w-4"/> إضافة بند</Button>
                        </div>
                        <div className='space-y-2'>
                            {openClauses.map((clause, index) => (
                                <div key={clause.id} className="flex items-center gap-2">
                                    <span className="pt-2 font-semibold">{arabicOrdinals[index] || `${index + 1}-`}</span>
                                    <Textarea
                                        placeholder={`نص البند الإضافي ${index + 1}`}
                                        value={clause.text}
                                        onChange={(e) => updateOpenClause(clause.id, e.target.value)}
                                        rows={2}
                                    />
                                    <div className="flex flex-col">
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderOpenClause(index, 'up')} disabled={index === 0}>
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderOpenClause(index, 'down')} disabled={index === openClauses.length - 1}>
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeOpenClause(clause.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" type="button" onClick={onClose} disabled={isSaving}>إلغاء</Button>
              <Button type="button" onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                {transaction?.contract ? 'حفظ التعديلات' : 'إنشاء العقد والقيد المحاسبي'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
