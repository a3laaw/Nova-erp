'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { Loader2, Save, PlusCircle, Trash2, ArrowUp, ArrowDown, FileSignature } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { doc, updateDoc, getDoc, collection, serverTimestamp, getDocs, query, runTransaction, limit, where, collectionGroup, orderBy, writeBatch, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Client, ClientTransaction, ContractClause, ContractTemplate, ContractTerm, ContractScopeItem, TransactionStage, Employee, Department, Account, ContractFinancialMilestone, WorkStage } from '@/lib/types';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { Separator } from '../ui/separator';
import { InlineSearchList } from '../ui/inline-search-list';

interface ContractClausesFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess?: () => void;
  transaction: ClientTransaction | null | Partial<ClientTransaction>;
  clientId: string;
  clientName: string;
  quotationIdToUpdate?: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);
const arabicOrdinals = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً', 'سابعاً', 'ثامناً', 'تاسعاً', 'عاشراً', 'حادي عشر', 'ثاني عشر', 'ثالث عشر', 'رابع عشر', 'خامس عشر'];
const milestoneNames = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];

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
        <Button variant="ghost" type="button" onClick={onContinueWithout}>
          متابعة بدون نموذج (إنشاء يدوي)
        </Button>
      </DialogFooter>
    </>
  );
}

// --- NEW Sub-component for Transaction Selection ---
function TransactionSelectionView({
  transactions,
  onSelect,
  onCreateNew,
}: {
  transactions: ClientTransaction[];
  onSelect: (txId: string) => void;
  onCreateNew: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>ربط العقد بمعاملة</DialogTitle>
        <DialogDescription>
          هذا العقد جديد. الرجاء اختيار المعاملة الداخلية التي تريد ربط هذا العقد بها، أو قم بإنشاء معاملة جديدة.
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="h-[60vh]">
        <div className="py-4 space-y-2 px-6">
          <h4 className="font-semibold text-sm mb-2">المعاملات الحالية (بدون عقد)</h4>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center p-4">لا توجد معاملات حالية بدون عقد لهذا العميل.</p>
          ) : (
            transactions.map((tx) => (
              <button
                key={tx.id}
                onClick={() => onSelect(tx.id!)}
                className="block w-full text-right p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <p className="font-semibold">{tx.transactionType}</p>
                <p className="text-sm text-muted-foreground">رقم: {tx.transactionNumber || 'N/A'}</p>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
      <DialogFooter className="pt-4 border-t">
        <Button variant="outline" type="button" onClick={onCreateNew}>
          <PlusCircle className="ml-2 h-4 w-4" />
          أو، إنشاء معاملة جديدة لهذا العقد
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
  const [termsAndConditions, setTermsAndConditions] = useState<ContractTerm[]>([]);
  const [openClauses, setOpenClauses] = useState<ContractTerm[]>([]);
  
  const [financials, setFinancials] = useState<ContractTemplate['financials']>({
    type: 'fixed',
    totalAmount: 0,
    discount: 0,
    milestones: [],
  });
  
  // Control flow state
  const [step, setStep] = useState<'loading' | 'select-transaction' | 'select-template' | 'edit-contract'>('loading');
  const [availableTemplates, setAvailableTemplates] = useState<ContractTemplate[]>([]);
  const [chosenTemplate, setChosenTemplate] = useState<ContractTemplate | null>(null);
  const [clientTransactions, setClientTransactions] = useState<ClientTransaction[]>([]);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [referenceData, setReferenceData] = useState<{ stages: MultiSelectOption[], templates: ContractTemplate[], employees: Employee[], departments: Department[] }>({ stages: [], templates: [], employees: [], departments: [] });
  const [loadingRefData, setLoadingRefData] = useState(true);

  // This effect resets the entire component's state when the dialog is closed.
  useEffect(() => {
    if (!isOpen) {
      setScopeOfWork([]);
      setTermsAndConditions([]);
      setOpenClauses([]);
      setIsSaving(false);
      setStep('loading');
      setAvailableTemplates([]);
      setChosenTemplate(null);
      setFinancials({ type: 'fixed', totalAmount: 0, discount: 0, milestones: [] });
      setReferenceData({ templates: [], stages: [], employees: [], departments: [] });
      setClientTransactions([]);
      setSelectedTransactionId(null);
      setLoadingRefData(true);
    }
  }, [isOpen]);

  const populateFormFromExistingContract = useCallback((contract: NonNullable<ClientTransaction['contract']>) => {
    setScopeOfWork(JSON.parse(JSON.stringify(contract.scopeOfWork || [])));
    setTermsAndConditions(JSON.parse(JSON.stringify(contract.termsAndConditions || [])));
    setOpenClauses(JSON.parse(JSON.stringify(contract.openClauses || [])));
    
    setFinancials({
        type: contract.financialsType || 'fixed',
        totalAmount: contract.totalAmount || 0,
        discount: 0,
        milestones: (contract.clauses || []).map(c => ({
            id: c.id,
            name: c.name,
            condition: c.condition || '',
            value: contract.financialsType === 'percentage' ? c.percentage || 0 : c.amount,
        }))
    });

    setChosenTemplate(null);
  }, []);

  const populateFormFromTemplate = useCallback((template: ContractTemplate | null) => {
      setScopeOfWork(template?.scopeOfWork || []);
      setTermsAndConditions(template?.termsAndConditions || []);
      setOpenClauses(template?.openClauses || []);
      setFinancials(template?.financials || { type: 'fixed', totalAmount: 0, discount: 0, milestones: [] });
      setChosenTemplate(template);
  }, []);

  const populateFormFromQuotation = useCallback(() => {
    if (!transaction?.contract) return;
    const contractData = transaction.contract;
    
    setScopeOfWork(contractData.scopeOfWork || []);
    setTermsAndConditions(contractData.termsAndConditions || []);
    setOpenClauses(contractData.openClauses || []);
    
    setFinancials({
        type: contractData.financialsType || 'fixed',
        totalAmount: contractData.totalAmount || 0,
        discount: 0,
        milestones: (contractData.clauses || []).map(c => ({
            id: c.id || generateId(),
            name: c.name,
            condition: c.condition || '',
            value: contractData.financialsType === 'percentage' ? c.percentage || 0 : c.amount,
        }))
    });
  }, [transaction]);

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
        if(transaction.departmentId) {
            const departmentStagesQuery = query(collection(firestore, `departments/${transaction.departmentId}/workStages`), orderBy('order', 'asc'));
            const departmentStagesSnapshot = await getDocs(departmentStagesQuery);
            stages = departmentStagesSnapshot.docs.map(doc => ({ value: doc.data().name, label: doc.data().name }));
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
        
        setReferenceData({ templates, stages, employees, departments });
        
        // --- Step Determination Logic ---
        if (transaction.id) { // Editing an existing transaction
            setSelectedTransactionId(transaction.id);
            if (transaction.contract) {
                populateFormFromExistingContract(transaction.contract);
                setStep('edit-contract');
            } else {
                const matchingTemplates = templates.filter(t => t.transactionTypes?.includes(transaction.transactionType || ''));
                if (matchingTemplates.length > 1) {
                    setAvailableTemplates(matchingTemplates);
                    setStep('select-template');
                } else {
                    const templateToUse = matchingTemplates.length === 1 ? matchingTemplates[0] : null;
                    populateFormFromTemplate(templateToUse);
                    setStep('edit-contract');
                }
            }
        } else { // New contract from quotation
            if (clientId) {
                const txQuery = query(collection(firestore, 'clients', clientId, 'transactions'));
                const txSnap = await getDocs(txQuery);
                const allTx = txSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientTransaction));
                // **ROBUST FILTERING**
                const availableTx = allTx.filter(tx => !tx.contract || !Array.isArray(tx.contract.clauses) || tx.contract.clauses.length === 0);
                
                setClientTransactions(availableTx);
                populateFormFromQuotation();
                setStep('select-transaction');
            } else {
                throw new Error("clientId is required to create a new contract.");
            }
        }

      } catch (error) {
        console.error("Error fetching reference data:", error);
        toast({ variant: "destructive", title: "خطأ", description: "فشل في جلب البيانات المرجعية." });
      } finally {
        setLoadingRefData(false);
      }
    };

    fetchAllReferenceData();
  }, [isOpen, firestore, transaction, clientId, toast, populateFormFromExistingContract, populateFormFromTemplate, populateFormFromQuotation]);

  const handleSelectTransaction = (txId: string) => {
    setSelectedTransactionId(txId);
    setStep('edit-contract');
  };

  const handleCreateNewTransaction = () => {
    setSelectedTransactionId('__NEW__');
    setStep('edit-contract');
  };

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


  const addTerm = () => setTermsAndConditions(prev => [...prev, { id: generateId(), text: '' }]);
  const updateTerm = (id: string, value: string) => {
    setTermsAndConditions(prev => prev.map(term => term.id === id ? { ...term, text: value } : term));
  };
  const removeTerm = (id: string) => setTermsAndConditions(prev => prev.filter(term => term.id !== id));
  const reorderTerm = (index: number, direction: 'up' | 'down') => {
    const newTerms = [...termsAndConditions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newTerms.length) return;
    [newTerms[index], newTerms[newIndex]] = [newTerms[newIndex], newTerms[index]];
    setTermsAndConditions(newTerms);
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
  
  const addMilestone = () => {
    setFinancials(prev => {
      const newIndex = prev.milestones.length;
      const newName = `الدفعة ${milestoneNames[newIndex] || `(${newIndex + 1})`}`;
      return {
        ...prev,
        milestones: [...prev.milestones, { id: generateId(), name: newName, condition: '', value: 0 }]
      };
    });
  };
  const updateMilestone = (id: string, field: keyof ContractFinancialMilestone, value: string | number) => {
    setFinancials(prev => ({ ...prev, milestones: prev.milestones.map(m => m.id === id ? { ...m, [field]: value } : m) }));
  };
  const removeMilestone = (id: string) => {
    setFinancials(prev => ({ ...prev, milestones: prev.milestones.filter(m => m.id !== id) }));
  };
  
  const totalAmount = useMemo(() => {
    if (financials.type === 'fixed') {
        return financials.milestones.reduce((sum, m) => sum + Number(m.value || 0), 0);
    }
    return financials.totalAmount;
  }, [financials]);

  const totalMilestoneValue = useMemo(() => financials.milestones.reduce((sum, m) => sum + Number(m.value || 0), 0), [financials.milestones]);

  const handleSubmit = async () => {
    if (!firestore || !transaction || !currentUser || !clientName) {
        toast({ variant: 'destructive', title: 'خطأ في البيانات', description: 'بيانات غير كافية لإنشاء العقد.' });
        return;
    }
    setIsSaving(true);
    let finalTransactionId = selectedTransactionId;

    try {
        // --- PRE-TRANSACTION READS ---
        const [revenueAccountSnap, parentAccountSnap, clientAccountSnap, jeQuerySnap] = await Promise.all([
            getDocs(query(collection(firestore, 'chartOfAccounts'), where('name', '==', 'إيرادات استشارات هندسية'), limit(1))),
            getDocs(query(collection(firestore, 'chartOfAccounts'), where('name', '==', 'العملاء'), limit(1))),
            getDocs(query(collection(firestore, 'chartOfAccounts'), where('name', '==', clientName), limit(1))),
            selectedTransactionId && selectedTransactionId !== '__NEW__'
                ? getDocs(query(collection(firestore, 'journalEntries'), where('transactionId', '==', selectedTransactionId)))
                : Promise.resolve(null)
        ]);

        if (revenueAccountSnap.empty) throw new Error("حساب 'إيرادات استشارات هندسية' غير موجود.");
        if (parentAccountSnap.empty) throw new Error("حساب 'العملاء' الرئيسي غير موجود.");
        
        let existingDebtJournalEntryId: string | null = null;
        jeQuerySnap?.docs.forEach(doc => {
            if (doc.data().narration?.includes('إثبات مديونية')) {
                existingDebtJournalEntryId = doc.id;
            }
        });
        
        // --- TRANSACTION STARTS ---
        await runTransaction(firestore, async (transaction_firestore) => {
            const currentYear = new Date().getFullYear();
            const clientRef = doc(firestore, 'clients', clientId);
            const coaClientCounterRef = doc(firestore, 'counters', 'coa_clients');
            const journalEntryCounterRef = doc(firestore, 'counters', 'journalEntries');

            const [clientSnap, coaClientCounterDoc, journalEntryCounterDoc] = await Promise.all([
                transaction_firestore.get(clientRef),
                transaction_firestore.get(coaClientCounterRef),
                transaction_firestore.get(journalEntryCounterRef),
            ]);

            if (!clientSnap.exists()) throw new Error("Client not found.");
            const clientData = clientSnap.data() as Client;
            
            // --- ALL WRITES ---
            const isNewContractCreation = !transaction.contract;
            let clientAccountId = clientAccountSnap.empty ? null : clientAccountSnap.docs[0].id;

            if (!clientAccountId) {
                const parentAccountData = parentAccountSnap.docs[0].data();
                const parentAccountCode = parentAccountData.code as string;
                const nextClientCodeNumber = (coaClientCounterDoc.data()?.lastNumber || 0) + 1;
                
                const newAccountData: Omit<Account, 'id'> = {
                    name: clientName, code: `${parentAccountCode}${String(nextClientCodeNumber).padStart(3, '0')}`,
                    type: 'asset', level: parentAccountData.level + 1, parentCode: parentAccountCode,
                    isPayable: true, statement: 'Balance Sheet', balanceType: 'Debit',
                };
                const newAccountRef = doc(collection(firestore, 'chartOfAccounts'));
                clientAccountId = newAccountRef.id;
                transaction_firestore.set(newAccountRef, newAccountData);
                transaction_firestore.set(coaClientCounterRef, { lastNumber: nextClientCodeNumber }, { merge: true });
            }

            const originalTransaction = clientTransactions.find(tx => tx.id === selectedTransactionId) || transaction;
            const assignedEngineerId = originalTransaction.assignedEngineerId || clientData.assignedEngineer || null;
            
            if ((originalTransaction.transactionType || '').includes('سكن خاص') && !assignedEngineerId) {
                throw new Error('يجب إسناد مهندس مسؤول لملف العميل أولاً قبل إنشاء عقد سكن خاص.');
            }

            const finalTotalAmount = financials.type === 'fixed'
              ? financials.milestones.reduce((sum, m) => sum + Number(m.value || 0), 0)
              : financials.totalAmount;
        
            const finalClauses = (financials.milestones || []).map(milestone => {
                const amount = financials.type === 'percentage'
                    ? ((Number(milestone.value) || 0) / 100) * (finalTotalAmount || 0)
                    : (Number(milestone.value) || 0);
                return {
                    id: milestone.id, name: milestone.name, condition: milestone.condition,
                    amount: amount, status: 'غير مستحقة' as const,
                    ...(financials.type === 'percentage' && { percentage: Number(milestone.value) || 0 }),
                };
            });

            const contractPayload = { clauses: finalClauses, scopeOfWork, termsAndConditions, openClauses, totalAmount: finalTotalAmount, financialsType: financials.type };
            
            if (selectedTransactionId && selectedTransactionId !== '__NEW__') {
                finalTransactionId = selectedTransactionId;
                const transactionRef = doc(firestore, 'clients', clientId, 'transactions', finalTransactionId);
                const transactionPayload: any = { contract: contractPayload, updatedAt: serverTimestamp() };
                if (isNewContractCreation) transactionPayload.status = 'in-progress';
                if (assignedEngineerId && assignedEngineerId !== originalTransaction.assignedEngineerId) {
                    transactionPayload.assignedEngineerId = assignedEngineerId;
                }
                transaction_firestore.update(transactionRef, cleanFirestoreData(transactionPayload));
            } else {
                const currentCounter = clientData.transactionCounter || 0;
                const newCounter = currentCounter + 1;
                const transactionNumber = `CL${clientData.fileNumber}-TX${String(newCounter).padStart(2, '0')}`;
                transaction_firestore.update(clientRef, { transactionCounter: newCounter });

                const newTransactionRef = doc(collection(firestore, `clients/${clientId}/transactions`));
                finalTransactionId = newTransactionRef.id;
                const engineer = referenceData.employees.find(e => e.id === assignedEngineerId);
                const department = referenceData.departments.find(d => d.name === engineer?.department);
                
                const transactionPayload = {
                    ...transaction, transactionNumber, assignedEngineerId: assignedEngineerId,
                    departmentId: transaction.departmentId || department?.id, status: 'in-progress',
                    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), contract: contractPayload,
                };
                transaction_firestore.set(newTransactionRef, cleanFirestoreData(transactionPayload));
            }
            
            const engineer = referenceData.employees.find(e => e.id === assignedEngineerId);
            const department = referenceData.departments.find(d => d.name === engineer?.department);
            const autoTags = {
                clientId, transactionId: finalTransactionId, auto_profit_center: finalTransactionId,
                auto_resource_id: assignedEngineerId,
                ...(department && { auto_dept_id: department.id }),
            };
            
            const revenueAccountId = revenueAccountSnap.docs[0].id;
            const revenueAccountName = revenueAccountSnap.docs[0].data().name;

            const jePayload = {
                narration: `إثبات مديونية ${clientName} عن عقد "${transaction.transactionType}"`,
                totalDebit: finalTotalAmount, totalCredit: finalTotalAmount,
                lines: [
                    { accountId: clientAccountId, accountName: clientName, debit: finalTotalAmount, credit: 0, ...autoTags },
                    { accountId: revenueAccountId, accountName: revenueAccountName, debit: 0, credit: finalTotalAmount, ...autoTags }
                ],
                clientId, transactionId: finalTransactionId, date: serverTimestamp(),
            };

            if (existingDebtJournalEntryId) {
                const jeRef = doc(firestore, 'journalEntries', existingDebtJournalEntryId);
                transaction_firestore.update(jeRef, jePayload);
            } else {
                const nextJournalEntryNumber = ((journalEntryCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const newEntryNumber = `JV-${currentYear}-${String(nextJournalEntryNumber).padStart(4, '0')}`;
                
                const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));
                transaction_firestore.set(newJournalEntryRef, {
                    ...jePayload,
                    entryNumber: newEntryNumber,
                    status: 'draft',
                    createdBy: currentUser!.id,
                    createdAt: serverTimestamp(),
                });
                transaction_firestore.set(journalEntryCounterRef, { counts: { [currentYear]: nextJournalEntryNumber } }, { merge: true });
            }

            if (clientData.status === 'new') {
                transaction_firestore.update(clientRef, { status: 'contracted' });
            }

            if (quotationIdToUpdate) {
                transaction_firestore.update(doc(firestore, 'quotations', quotationIdToUpdate), { transactionId: finalTransactionId, status: 'accepted' });
            }

            const finalTransactionType = originalTransaction.transactionType || transaction.transactionType;

            const milestonesText = finalClauses.map(c => `- دفعة "${c.name}": ${formatCurrency(c.amount)}`).join('\n');
            const commentContent = `**[إشعار مالي]**\nقام ${currentUser!.fullName} بإنشاء عقد لهذه المعاملة بقيمة إجمالية ${formatCurrency(finalTotalAmount)}.\n\n**تفاصيل الدفعات:**\n${milestonesText}`;
            const commentData = { type: 'comment' as const, content: commentContent, userId: currentUser!.id, userName: currentUser!.fullName, userAvatar: currentUser!.avatarUrl, createdAt: serverTimestamp() };
            
            const logContentForTimeline = `أنشأ ${currentUser!.fullName} العقد للمعاملة.`;
            const logDataForTimeline = { type: 'log' as const, content: logContentForTimeline, userId: currentUser!.id, userName: currentUser!.fullName, userAvatar: currentUser!.avatarUrl, createdAt: serverTimestamp() };

            const logContentForHistory = `قام ${currentUser!.fullName} بإنشاء عقد لمعاملة "${finalTransactionType}" بقيمة إجمالية ${formatCurrency(finalTotalAmount)}.`;
            const logDataForHistory = { type: 'log' as const, content: logContentForHistory, userId: currentUser!.id, userName: currentUser!.fullName, userAvatar: currentUser!.avatarUrl, createdAt: serverTimestamp() };
            
            const historyCollectionRef = collection(firestore, `clients/${clientId}/history`);
            const transactionTimelineRef = collection(firestore, `clients/${clientId}/transactions/${finalTransactionId!}/timelineEvents`);

            transaction_firestore.set(doc(historyCollectionRef), logDataForHistory);
            transaction_firestore.set(doc(transactionTimelineRef), commentData);
            transaction_firestore.set(doc(transactionTimelineRef), logDataForTimeline);
        });
        
        toast({ title: 'نجاح', description: 'تم حفظ العقد والقيد المحاسبي بنجاح.' });
        if (onSaveSuccess) onSaveSuccess();
        onClose();
        if(finalTransactionId) router.push(`/dashboard/clients/${clientId}/transactions/${finalTransactionId}`);

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
        className="max-w-4xl h-[90vh]" 
        dir="rtl"
        onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[cmdk-root]') || target.closest('[data-radix-popper-content-wrapper]') || target.closest('[role="dialog"]')) {
              e.preventDefault();
            }
        }}
      >
        {step === 'loading' && (
            <>
                <DialogHeader><DialogTitle>جاري التحميل...</DialogTitle></DialogHeader>
                <div className='flex justify-center items-center h-48'><Loader2 className="h-8 w-8 animate-spin" /></div>
            </>
        )}
        {step === 'select-transaction' && (
            <TransactionSelectionView
                transactions={clientTransactions}
                onSelect={handleSelectTransaction}
                onCreateNew={handleCreateNewTransaction}
            />
        )}
        {step === 'select-template' && (
          <TemplateSelectionView 
            templates={availableTemplates}
            onSelect={(selected) => {
              populateFormFromTemplate(selected);
              setStep('edit-contract');
            }}
            onContinueWithout={() => {
              populateFormFromTemplate(null);
              setStep('edit-contract');
            }}
          />
        )}
        
        {step === 'edit-contract' && (
          <>
            <DialogHeader>
              <DialogTitle>إدارة بنود العقد للمعاملة</DialogTitle>
              <DialogDescription>
                {chosenTemplate ? `تعديل الدفعات المالية والشروط للعقد "${chosenTemplate.title}".` : transaction?.contract ? 'تعديل العقد الحالي.' : 'لا يوجد نموذج عقد لهذه المعاملة، قم بالإنشاء اليدوي.'}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[calc(90vh-250px)] px-6">
                <div className="py-4 space-y-8">
                     <section className="space-y-4">
                        <div className="grid grid-cols-1">
                            <div className="grid gap-2">
                                <Label>العميل</Label>
                                <Input value={clientName} disabled readOnly />
                            </div>
                        </div>
                    </section>
                    <Separator />
                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">نطاق العمل (Scope of Work)</h3>
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
                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">الشروط والأحكام</h3>
                            <Button size="sm" variant="outline" type="button" onClick={addTerm}><PlusCircle className="ml-2"/> إضافة شرط</Button>
                        </div>
                         {termsAndConditions.map((term, index) => (
                            <div key={term.id} className="flex items-center gap-2">
                               <span className="pt-2 font-semibold">{arabicOrdinals[index] || `${index + 1}-`}</span>
                               <Textarea value={term.text} onChange={(e) => updateTerm(term.id, e.target.value)} rows={2} className="flex-grow"/>
                               <div className="flex flex-col">
                                <Button variant="ghost" size="icon" type="button" onClick={() => reorderTerm(index, 'up')} disabled={index === 0}><ArrowUp className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="icon" type="button" onClick={() => reorderTerm(index, 'down')} disabled={index === termsAndConditions.length - 1}><ArrowDown className="h-4 w-4"/></Button>
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
                                        <Input type="number" value={m.value} onChange={e => {
                                            const num = parseFloat(e.target.value);
                                            updateMilestone(m.id, 'value', isNaN(num) ? 0 : num)
                                        }} className="dir-ltr text-left"/>
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
                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">بنود إضافية (اختياري)</h3>
                            <Button size="sm" variant="outline" type="button" onClick={addOpenClause}><PlusCircle className="ml-2"/> إضافة بند</Button>
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
                {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                {transaction?.contract ? 'حفظ التعديلات' : 'إنشاء العقد والقيد المحاسبي'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
