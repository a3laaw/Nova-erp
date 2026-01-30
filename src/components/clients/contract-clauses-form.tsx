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
import { doc, updateDoc, getDoc, collection, serverTimestamp, getDocs, query, runTransaction, limit, where, collectionGroup, orderBy, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { ClientTransaction, ContractClause, ContractTemplate, ContractTerm, ContractScopeItem, TransactionStage, Employee, Department, Account } from '@/lib/types';
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
  onSaveSuccess: () => void;
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


export function ContractClausesForm({ isOpen, onClose, onSaveSuccess, transaction, clientId, clientName, quotationIdToUpdate }: ContractClausesFormProps) {
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

  const [referenceData, setReferenceData] = useState<{ stages: MultiSelectOption[], templates: ContractTemplate[], employees: Employee[], departments: Department[] }>({ stages: [], templates: [], employees: [], departments: [] });
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
      setReferenceData({ templates: [], stages: [], employees: [], departments: [] });
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

  // Effect 1: Fetch all reference data (templates, stages, employees, departments) once when the dialog opens.
  useEffect(() => {
    if (!isOpen || !firestore || !transaction) return;

    const fetchAllReferenceData = async () => {
      setLoadingRefData(true);
      setStep('loading');
      try {
        const allTemplatesQuery = query(collection(firestore, 'contractTemplates'));
        const employeesQuery = query(collection(firestore, 'employees'));
        const departmentsQuery = query(collection(firestore, 'departments'));
        
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
            employeesSnapshot,
            departmentsSnapshot,
        ] = await Promise.all([
            getDocs(allTemplatesQuery),
            getDocs(employeesQuery),
            getDocs(departmentsQuery),
        ]);
        
        const templates = allTemplatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate));
        const employees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        const departments = departmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
        
        setDepartmentWorkStages(fetchedDeptStages);
        setReferenceData({ templates, stages, employees, departments });

      } catch (error) {
        console.error("Error fetching reference data:", error);
        toast({ variant: "destructive", title: "خطأ", description: "فشل في جلب البيانات المرجعية." });
        setReferenceData({ templates: [], stages: [], employees: [], departments: [] });
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

    setIsSaving(true);
    let finalTransactionId = transaction.id;

    try {
        // --- PRE-TRANSACTION READS (QUERIES) ---
        // Queries are not allowed inside transactions, so we run them before the transaction starts.
        const clientAccountQuery = query(collection(firestore, 'chartOfAccounts'), where('name', '==', clientName), limit(1));
        const revenueAccountQuery = query(collection(firestore, 'chartOfAccounts'), where('name', '==', 'إيرادات استشارات هندسية'), limit(1));
        const parentAccountQuery = query(collection(firestore, 'chartOfAccounts'), where('name', '==', 'العملاء'), limit(1));

        const [clientAccountSnap, revenueAccountSnap, parentAccountSnap] = await Promise.all([
            getDocs(clientAccountQuery),
            getDocs(revenueAccountQuery),
            getDocs(parentAccountQuery)
        ]);

        if (revenueAccountSnap.empty) {
            throw new Error("حساب 'إيرادات استشارات هندسية' غير موجود.");
        }
        if (clientAccountSnap.empty && parentAccountSnap.empty) {
            throw new Error("حساب 'العملاء' الرئيسي غير موجود في شجرة الحسابات.");
        }

        // --- TRANSACTION ---
        await runTransaction(firestore, async (transaction_firestore) => {
            // --- READ PHASE ---
            const clientRef = doc(firestore, 'clients', clientId);
            const journalEntryCounterRef = doc(firestore, 'counters', 'journalEntries');
            const coaClientCounterRef = doc(firestore, 'counters', 'coa_clients');

            const [clientSnap, journalEntryCounterDoc, coaClientCounterDoc] = await Promise.all([
                transaction_firestore.get(clientRef),
                transaction_firestore.get(journalEntryCounterRef),
                transaction_firestore.get(coaClientCounterDoc)
            ]);

            if (!clientSnap.exists()) throw new Error("Client not found.");
            
            // --- LOGIC / PREPARATION PHASE ---
            const clientData = clientSnap.data();
            let clientAccountId: string;

            if (clientAccountSnap.empty) {
                const parentData = parentAccountSnap.docs[0].data();
                const parentCode = parentData.code as string;
                const nextClientCodeNumber = ((coaClientCounterDoc.data()?.lastNumber) || 0) + 1;
                
                const newAccountData: Account = {
                    name: clientName, code: `${parentCode}${String(nextClientCodeNumber).padStart(3, '0')}`,
                    type: 'asset', level: parentData.level + 1, parentCode: parentCode,
                    isPayable: true, statement: 'Balance Sheet', balanceType: 'Debit',
                };
                
                const newAccountRef = doc(collection(firestore, 'chartOfAccounts'));
                clientAccountId = newAccountRef.id;
                // Defer the writes to the write phase
                transaction_firestore.set(newAccountRef, newAccountData);
                transaction_firestore.set(coaClientCounterRef, { lastNumber: nextClientCodeNumber }, { merge: true });
            } else {
                clientAccountId = clientAccountSnap.docs[0].id;
            }

            const currentYear = new Date().getFullYear();
            const nextJournalEntryNumber = ((journalEntryCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;

            // --- WRITE PHASE ---
            const contractData = { clauses, scopeOfWork, termsAndConditions: terms, openClauses, totalAmount, financialsType: chosenTemplate?.financials?.type || 'fixed' };
            const updatedStages = [...(transaction.stages || [])];
            const contractStageIndex = updatedStages.findIndex(stage => stage.name === 'توقيع العقد');
            if (contractStageIndex > -1 && updatedStages[contractStageIndex].status !== 'completed') {
                const stageToUpdate = { ...updatedStages[contractStageIndex] };
                stageToUpdate.status = 'awaiting-review';
                if (!stageToUpdate.startDate) (stageToUpdate as any).startDate = new Date();
                updatedStages[contractStageIndex] = stageToUpdate as TransactionStage;
            }

            const transactionRef = transaction.id ? doc(firestore, 'clients', clientId, 'transactions', transaction.id) : doc(collection(firestore, `clients/${clientId}/transactions`));
            if (!finalTransactionId) finalTransactionId = transactionRef.id;
            
            const transactionPayload: any = { ...transaction, contract: contractData, stages: updatedStages, status: 'in-progress', updatedAt: serverTimestamp() };
            if (!transaction.id) transactionPayload.createdAt = serverTimestamp();
            
            if (transaction.id) {
                transaction_firestore.update(transactionRef, cleanFirestoreData(transactionPayload));
            } else {
                transaction_firestore.set(transactionRef, cleanFirestoreData(transactionPayload));
            }
            
            const engineer = referenceData.employees.find(e => e.id === transaction.assignedEngineerId);
            const department = referenceData.departments.find(d => d.name === engineer?.department);
            const autoTags = {
                clientId, transactionId: finalTransactionId, auto_profit_center: finalTransactionId,
                auto_resource_id: transaction.assignedEngineerId || null,
                ...(department && { auto_dept_id: department.id }),
            };
            
            const revenueAccountId = revenueAccountSnap.docs[0].id;
            const revenueAccountName = revenueAccountSnap.docs[0].data().name;

            const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));
            transaction_firestore.set(newJournalEntryRef, {
                entryNumber: `JV-${currentYear}-${String(nextJournalEntryNumber).padStart(4, '0')}`, date: serverTimestamp(), narration: `إثبات مديونية ${clientName} عن عقد "${transaction.transactionType}"`,
                totalDebit: totalAmount, totalCredit: totalAmount, status: 'draft',
                lines: [
                    { accountId: clientAccountId, accountName: clientName, debit: totalAmount, credit: 0, ...autoTags },
                    { accountId: revenueAccountId, accountName: revenueAccountName, debit: 0, credit: totalAmount, ...autoTags }
                ],
                createdAt: serverTimestamp(), createdBy: currentUser!.id, clientId, transactionId: finalTransactionId,
            });
            transaction_firestore.set(journalEntryCounterRef, { counts: { [currentYear]: nextJournalEntryNumber } }, { merge: true });

            if (clientData.status === 'new') {
                transaction_firestore.update(clientRef, { status: 'contracted' });
            }

            if (quotationIdToUpdate) {
                const quotationRef = doc(firestore, 'quotations', quotationIdToUpdate);
                transaction_firestore.update(quotationRef, { transactionId: finalTransactionId, status: 'accepted' });
            }

            const historyCollectionRef = collection(firestore, `clients/${clientId}/history`);
            const transactionTimelineRef = collection(firestore, `clients/${clientId}/transactions/${finalTransactionId}/timelineEvents`);
            let contractDetailsComment = `**تم ${transaction.contract ? 'تحديث' : 'توقيع'} العقد**\n\n`;
            contractDetailsComment += `**نوع المعاملة:** ${transaction.transactionType}\n`;
            contractDetailsComment += `**قيمة العقد:** ${formatCurrency(totalAmount)}\n\n`;
            contractDetailsComment += `**الدفعات:**\n` + clauses.map(c => `  - ${c.name}: ${formatCurrency(c.amount)}`).join('\n');
            
            const commentData = { type: 'comment' as const, content: contractDetailsComment, userId: currentUser!.id, userName: currentUser!.fullName || 'النظام', userAvatar: currentUser!.avatarUrl || '', createdAt: serverTimestamp() };
            transaction_firestore.set(doc(transactionTimelineRef), commentData);
            transaction_firestore.set(doc(historyCollectionRef), commentData);
        });

        toast({ title: 'نجاح', description: 'تم حفظ بنود العقد وإنشاء القيد المحاسبي بنجاح.' });
        
        onClose();
        if (finalTransactionId && !transaction.id) {
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
                         <div className="grid md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>نوع العقد المالي</Label>
                                <Select value={financials.type} onValueChange={(v: 'fixed' | 'percentage') => setFinancials(p => ({...p, type: v, milestones: []}))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed">قيمة ثابتة</SelectItem>
                                        <SelectItem value="percentage">نسبة مئوية</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>إجمالي قيمة العقد (د.ك)</Label>
                                <Input type="number" value={financials.totalAmount} onChange={e => setFinancials(p => ({...p, totalAmount: Number(e.target.value)}))} className="dir-ltr text-left" />
                            </div>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                             <h4 className="font-semibold">الدفعات المالية</h4>
                             <Button variant="outline" size="sm" type="button" onClick={addMilestone}><PlusCircle className="ml-2"/> إضافة دفعة</Button>
                        </div>
                        <div className="space-y-2">
                            {financials.milestones.map((m, i) => (
                                 <div key={m.id} className="grid grid-cols-12 gap-2 items-center">
                                    <Label className="col-span-3 font-semibold">{m.name}</Label>
                                    <Select value={m.condition || '_NONE_'} onValueChange={v => updateMilestone(m.id, 'condition', v === '_NONE_' ? '' : v)}>
                                        <SelectTrigger className="col-span-5">
                                            <SelectValue placeholder="اختر مرحلة العمل كشرط..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="_NONE_">بدون شرط</SelectItem>
                                            {referenceData.stages.map(stage => <SelectItem key={stage.value} value={stage.value}>{stage.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <div className="col-span-3 flex items-center gap-1">
                                        <Input type="number" value={m.value} onChange={e => updateMilestone(m.id, 'value', Number(e.target.value))} className="dir-ltr text-left"/>
                                        <span className="text-sm">{financials.type === 'fixed' ? 'د.ك' : '%'}</span>
                                    </div>
                                    <Button variant="ghost" size="icon" type="button" onClick={() => removeMilestone(m.id)} className="col-span-1"><Trash2 className="text-destructive h-4 w-4"/></Button>
                                 </div>
                            ))}
                        </div>
                         {financials.milestones.length > 0 && (
                            <div className="border-t pt-2 mt-2 space-y-1">
                                <div className="flex justify-between font-semibold">
                                    <span>مجموع الدفعات:</span>
                                    <span className="font-mono">{financials.type === 'fixed' ? formatCurrency(totalMilestoneValue) : `${totalMilestoneValue}%`}</span>
                                </div>
                                {financials.type === 'percentage' && totalMilestoneValue !== 100 && <p className="text-destructive text-xs text-center">تحذير: مجموع النسب لا يساوي 100%</p>}
                                 {financials.type === 'fixed' && totalMilestoneValue !== financials.totalAmount && <p className="text-destructive text-xs text-center">تحذير: مجموع الدفعات لا يساوي إجمالي قيمة العقد</p>}
                            </div>
                         )}
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
  )
}
