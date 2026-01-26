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
import type { ClientTransaction, ContractClause, ContractTemplate, ContractTerm, ContractScopeItem, TransactionStage } from '@/lib/types';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ContractClausesFormProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: ClientTransaction | null;
  clientId: string;
  clientName: string;
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


export function ContractClausesForm({ isOpen, onClose, transaction, clientId, clientName }: ContractClausesFormProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

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
        // Fetch all available contract templates
        const allTemplatesQuery = query(collection(firestore, 'contractTemplates'));
        const allTemplatesSnapshot = await getDocs(allTemplatesQuery);
        const templates = allTemplatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate));

        // Fetch all possible work stages robustly
        const stagesQuery = query(collectionGroup(firestore, 'workStages'));
        const stagesSnapshot = await getDocs(stagesQuery);
        const uniqueStages = new Map<string, MultiSelectOption>();
        stagesSnapshot.forEach(stageDoc => {
            const stageName = stageDoc.data().name as string;
            if (stageName && !uniqueStages.has(stageName)) {
                uniqueStages.set(stageName, { value: stageName, label: stageName });
            }
        });
        const stages = Array.from(uniqueStages.values()).sort((a, b) => a.label.localeCompare(b.label));

        if (stages.length === 0) {
            console.warn("Firebase Studio: No work stages found in any 'workStages' subcollection. The condition dropdown will be empty.");
        }
        
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
      const matchingTemplates = referenceData.templates.filter(t => t.transactionTypes?.includes(transaction.transactionType));
      
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


  const handleClauseChange = (index: number, field: keyof ContractClause, value: any) => {
    const updatedClauses = [...clauses];
    const clauseToUpdate = { ...updatedClauses[index] };
    (clauseToUpdate as any)[field] = value;
    updatedClauses[index] = clauseToUpdate;
    setClauses(updatedClauses);
  };
  
  const addClause = () => {
    const newName = `الدفعة ${milestoneNames[clauses.length] || `(${clauses.length + 1})`}`;
    setClauses(prev => [...prev, { id: generateId(), name: newName, amount: 0, status: 'غير مستحقة', condition: '' }]);
  };

  const removeClause = (id: string) => {
    setClauses(prev => prev.filter(c => c.id !== id));
  };
  
  const addScopeItem = () => setScopeOfWork(prev => [...prev, { id: generateId(), title: '', description: '' }]);
  const removeScopeItem = (id: string) => setScopeOfWork(prev => prev.filter(s => s.id !== id));
  const handleScopeChange = (id: string, field: 'title' | 'description', value: string) => {
      setScopeOfWork(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const reorderScopeItem = (index: number, direction: 'up' | 'down') => {
      const newItems = [...scopeOfWork];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newItems.length) return;
      [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
      setScopeOfWork(newItems);
  };

  const addTerm = () => setTerms(prev => [...prev, { id: generateId(), text: '' }]);
  const removeTerm = (id: string) => setTerms(prev => prev.filter(t => t.id !== id));
  const handleTermChange = (id: string, text: string) => setTerms(prev => prev.map(t => (t.id === id ? { ...t, text } : t)));
  const reorderTerm = (index: number, direction: 'up' | 'down') => {
      const newTerms = [...terms];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newTerms.length) return;
      [newTerms[index], newTerms[newIndex]] = [newTerms[newIndex], newTerms[index]];
      setTerms(newTerms);
  };

  const addOpenClause = () => setOpenClauses(prev => [...prev, { id: generateId(), text: '' }]);
  const removeOpenClause = (id: string) => setOpenClauses(prev => prev.filter(t => t.id !== id));
  const handleOpenClauseChange = (id: string, text: string) => setOpenClauses(prev => prev.map(t => (t.id === id ? { ...t, text } : t)));
  const reorderOpenClause = (index: number, direction: 'up' | 'down') => {
      const newClauses = [...openClauses];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newClauses.length) return;
      [newClauses[index], newClauses[newIndex]] = [newClauses[newIndex], newClauses[index]];
      setOpenClauses(newClauses);
  };

  const totalAmount = useMemo(() => {
    return clauses.reduce((acc, clause) => acc + Number(clause.amount), 0);
  }, [clauses]);

  const handleSubmit = async () => {
    if (!firestore || !transaction?.id || !currentUser) return;
    setIsSaving(true);
    try {
        // --- Reads Outside Transaction ---
        const parentAccountQuery = query(collection(firestore, 'chartOfAccounts'), where('name', '==', 'العملاء'), limit(1));
        const revenueAccountQuery = query(collection(firestore, 'chartOfAccounts'), where('name', '==', 'إيرادات استشارات هندسية'), limit(1));
        const clientAccountQuery = query(collection(firestore, 'chartOfAccounts'), where('name', '==', clientName), limit(1));

        const [parentAccountSnap, revenueAccountSnap, clientAccountSnap] = await Promise.all([
            getDocs(parentAccountQuery),
            getDocs(revenueAccountQuery),
            getDocs(clientAccountQuery)
        ]);

        if (parentAccountSnap.empty) throw new Error('حساب "العملاء" الرئيسي غير موجود في شجرة الحسابات.');
        if (revenueAccountSnap.empty) throw new Error('حساب "إيرادات استشارات هندسية" غير موجود في شجرة الحسابات.');

        const customersAccountDoc = parentAccountSnap.docs[0];
        const revenueAccountDoc = revenueAccountSnap.docs[0];
        
        // --- Firestore Transaction ---
        await runTransaction(firestore, async (transaction_firestore) => {
            // --- Transactional Reads ---
            const clientRef = doc(firestore, 'clients', clientId);
            const transactionRef = doc(firestore, 'clients', clientId, 'transactions', transaction.id!);
            const coaClientCounterRef = doc(firestore, 'counters', 'coa_clients');
            const journalEntryCounterRef = doc(firestore, 'counters', 'journalEntries');

            const [clientSnap, currentTransactionSnap, coaClientCounterDoc, journalEntryCounterDoc] = await Promise.all([
                transaction_firestore.get(clientRef),
                transaction_firestore.get(transactionRef),
                transaction_firestore.get(coaClientCounterRef),
                transaction_firestore.get(journalEntryCounterRef)
            ]);

            if (!clientSnap.exists()) throw new Error("Client not found.");
            if (!currentTransactionSnap.exists()) throw new Error("Transaction not found.");

            const clientData = clientSnap.data();
            const currentTransactionData = currentTransactionSnap.data() as ClientTransaction;

            // --- Transactional Writes ---

            // 1. Prepare contract and stage data
            const contractData = {
                clauses: clauses,
                scopeOfWork: scopeOfWork,
                termsAndConditions: terms,
                openClauses: openClauses,
                totalAmount: totalAmount,
                financialsType: chosenTemplate?.financials?.type || 'fixed',
            };

            const updatedStages = currentTransactionData.stages?.map(stage => {
                if (stage.name === 'توقيع العقد' && stage.status !== 'completed') {
                    return { ...stage, status: 'completed' as const, endDate: serverTimestamp() };
                }
                return stage;
            });

            // 2. Update the transaction with contract details and updated stage
            const updatePayload: any = { 
                contract: contractData,
                stages: updatedStages || currentTransactionData.stages 
            };
            
            const safeUpdatePayload = cleanFirestoreData(updatePayload);
            transaction_firestore.update(transactionRef, safeUpdatePayload);
            
            // This logic only runs when creating a contract for the first time for a client
            if (clientData.status === 'new') {
                let clientAccountId: string;
                transaction_firestore.update(clientRef, { status: 'contracted' });

                const historyCollectionRef = collection(firestore, `clients/${clientId}/history`);
                transaction_firestore.set(doc(historyCollectionRef), {
                    type: 'log',
                    content: `تغيرت حالة الملف من "جديد" إلى "تم التعاقد" بعد إنشاء أول عقد.`,
                    userId: currentUser.id,
                    userName: currentUser.fullName || 'النظام',
                    userAvatar: currentUser.avatarUrl || '',
                    createdAt: serverTimestamp(),
                });
                
                if (clientAccountSnap.empty) {
                    const parentCode = customersAccountDoc.data().code as string;
                    const lastClientCodeNumber = coaClientCounterDoc.exists() ? coaClientCounterDoc.data()?.lastNumber || 0 : 0;
                    const nextClientCodeNumber = lastClientCodeNumber + 1;
                    const clientAccountCode = `${parentCode}${String(nextClientCodeNumber).padStart(3, '0')}`;

                    transaction_firestore.set(coaClientCounterRef, { lastNumber: nextClientCodeNumber }, { merge: true });
                    const newAccountRef = doc(collection(firestore, 'chartOfAccounts'));
                    transaction_firestore.set(newAccountRef, {
                        name: clientData.nameAr,
                        code: clientAccountCode,
                        type: customersAccountDoc.data().type,
                        level: (customersAccountDoc.data().level as number) + 1,
                    });
                    clientAccountId = newAccountRef.id;
                } else {
                    clientAccountId = clientAccountSnap.docs[0].id;
                }
                
                // Create the Journal Entry
                const currentYear = new Date().getFullYear();
                const nextJournalEntryNumber = (journalEntryCounterDoc.exists() ? journalEntryCounterDoc.data()?.counts?.[currentYear] || 0 : 0) : 0) + 1;
                const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));
                const journalLines = [
                    { accountId: clientAccountId, accountName: clientData.nameAr, debit: totalAmount, credit: 0 },
                    { accountId: revenueAccountDoc.id, accountName: revenueAccountDoc.data().name, debit: 0, credit: totalAmount }
                ];
                transaction_firestore.set(newJournalEntryRef, {
                    entryNumber: `JV-${currentYear}-${String(nextJournalEntryNumber).padStart(4, '0')}`,
                    date: serverTimestamp(),
                    narration: `إثبات مديونية العميل ${clientData.nameAr} عن عقد معاملة "${transaction.transactionType}"`,
                    totalDebit: totalAmount,
                    totalCredit: totalAmount,
                    status: 'draft',
                    lines: journalLines,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                    clientId: clientId,
                    transactionId: transaction.id!,
                });
                transaction_firestore.set(journalEntryCounterRef, { counts: { [currentYear]: nextJournalEntryNumber } }, { merge: true });
            }
        });

        toast({ title: 'نجاح', description: 'تم حفظ بنود العقد وإنشاء قيد المديونية بنجاح.' });
        onClose();
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
                    <div>
                        <Label className="text-base font-semibold">البنود المالية</Label>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>البند</TableHead>
                              <TableHead>شرط الاستحقاق</TableHead>
                              <TableHead className="w-[150px] text-left">المبلغ (د.ك)</TableHead>
                              <TableHead><span className="sr-only">إجراءات</span></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clauses.map((clause, index) => (
                              <TableRow key={clause.id}>
                                <TableCell className="font-medium">
                                   <Input 
                                    value={clause.name}
                                    onChange={(e) => handleClauseChange(index, 'name', e.target.value)}
                                    placeholder={`دفعة ${index + 1}`}
                                  />
                                </TableCell>
                                <TableCell>
                                   <Select value={clause.condition || '_NONE_'} onValueChange={(v) => handleClauseChange(index, 'condition', v === '_NONE_' ? '' : v)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر مرحلة العمل" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="_NONE_">بدون شرط</SelectItem>
                                            {referenceData.stages.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                  <Input 
                                    type="number"
                                    value={clause.amount}
                                    onChange={(e) => handleClauseChange(index, 'amount', Number(e.target.value))}
                                    className="text-left dir-ltr"
                                  />
                                </TableCell>
                                <TableCell>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeClause(clause.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell colSpan={2} className="font-bold">الإجمالي</TableCell>
                              <TableCell className="text-left font-bold font-mono">
                                {formatCurrency(totalAmount)}
                              </TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                        <div className="flex justify-end mt-2">
                            <Button type="button" size="sm" variant="outline" onClick={addClause}><PlusCircle className="ml-2 h-4 w-4"/> إضافة دفعة</Button>
                        </div>
                    </div>
                    
                    <div className="grid gap-2 pt-4">
                        <div className='flex justify-between items-center'>
                          <Label className="text-base font-semibold">نطاق العمل</Label>
                          <Button type="button" size="sm" variant="outline" onClick={addScopeItem}><PlusCircle className="ml-2 h-4 w-4"/> إضافة بند</Button>
                        </div>
                        <div className='space-y-2'>
                            {scopeOfWork.map((item, index) => (
                                <div key={item.id} className="flex items-start gap-2 p-2 border rounded-md">
                                    <span className="text-sm font-semibold pt-2">{arabicOrdinals[index] || `${index + 1}-`}</span>
                                    <div className="flex-grow space-y-2">
                                        <Input
                                            placeholder={`عنوان البند ${index + 1}`}
                                            value={item.title}
                                            onChange={(e) => handleScopeChange(item.id, 'title', e.target.value)}
                                        />
                                        <Textarea
                                            placeholder={`وصف تفصيلي للبند...`}
                                            value={item.description}
                                            onChange={(e) => handleScopeChange(item.id, 'description', e.target.value)}
                                            rows={2}
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderScopeItem(index, 'up')} disabled={index === 0}>
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderScopeItem(index, 'down')} disabled={index === scopeOfWork.length - 1}>
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeScopeItem(item.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="grid gap-2 pt-4">
                        <div className='flex justify-between items-center'>
                          <Label className="text-base font-semibold">الشروط والأحكام</Label>
                          <Button type="button" size="sm" variant="outline" onClick={addTerm}><PlusCircle className="ml-2 h-4 w-4"/> إضافة شرط</Button>
                        </div>
                        <div className='space-y-2'>
                            {terms.map((term, index) => (
                                <div key={term.id} className="flex items-center gap-2">
                                    <span className="text-sm font-semibold pt-2">{arabicOrdinals[index] || `${index + 1}-`}</span>
                                    <Textarea
                                        placeholder={`نص الشرط ${index + 1}`}
                                        value={term.text}
                                        onChange={(e) => handleTermChange(term.id, e.target.value)}
                                        rows={2}
                                    />
                                    <div className="flex flex-col">
                                        <Button variant="ghost" size="icon" type="button" onClick={() => reorderTerm(index, 'up')} disabled={index === 0}><ArrowUp className="h-4 w-4"/></Button>
                                        <Button variant="ghost" size="icon" type="button" onClick={() => reorderTerm(index, 'down')} disabled={index === terms.length - 1}><ArrowDown className="h-4 w-4"/></Button>
                                    </div>
                                    <Button variant="ghost" size="icon" type="button" onClick={() => removeTerm(term.id)}><Trash2 className="text-destructive h-4 w-4"/></Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-2 pt-4">
                        <div className='flex justify-between items-center'>
                          <Label className="text-base font-semibold">بنود إضافية</Label>
                          <Button type="button" size="sm" variant="outline" onClick={addOpenClause}><PlusCircle className="ml-2 h-4 w-4"/> إضافة بند</Button>
                        </div>
                        <div className='space-y-2'>
                            {openClauses.map((clause, index) => (
                                <div key={clause.id} className="flex items-center gap-2">
                                    <span className="text-sm font-semibold pt-2">{arabicOrdinals[index] || `${index + 1}-`}</span>
                                    <Textarea
                                        placeholder={`نص البند الإضافي ${index + 1}`}
                                        value={clause.text}
                                        onChange={(e) => handleOpenClauseChange(clause.id, e.target.value)}
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
                    </div>
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
