'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { doc, updateDoc, getDoc, collection, serverTimestamp, getDocs, query, runTransaction, limit, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { ClientTransaction, ContractClause, ContractTemplate, ContractTerm, ContractScopeItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

interface ContractClausesFormProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: ClientTransaction | null;
  clientId: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);
const arabicOrdinals = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً', 'سابعاً', 'ثامناً', 'تاسعاً', 'عاشراً'];


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


export function ContractClausesForm({ isOpen, onClose, transaction, clientId }: ContractClausesFormProps) {
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
    }
  }, [isOpen]);

  // This effect fetches templates and decides which step to show.
  useEffect(() => {
    if (!isOpen || !transaction || !firestore) return;

    const findAndSetTemplate = async () => {
      setStep('loading');
      try {
        if (transaction.contract) {
          // If a contract already exists, we go straight to editing it.
          setScopeOfWork(JSON.parse(JSON.stringify(transaction.contract.scopeOfWork || [])));
          setClauses(JSON.parse(JSON.stringify(transaction.contract.clauses || [])));
          setTerms(JSON.parse(JSON.stringify(transaction.contract.termsAndConditions || [])));
          setOpenClauses(JSON.parse(JSON.stringify(transaction.contract.openClauses || [])));
          setChosenTemplate({
            title: transaction.transactionType,
            financials: {
              type: transaction.contract.financialsType || 'fixed',
              totalAmount: transaction.contract.totalAmount || 0,
              discount: 0,
              milestones: [],
            },
            description: '',
            transactionTypes: [],
            scopeOfWork: [],
            termsAndConditions: [],
            openClauses: [],
          });
          setStep('edit');
        } else {
          // If no contract exists, find matching templates.
          const templatesQuery = query(collection(firestore, 'contractTemplates'));
          const templatesSnapshot = await getDocs(templatesQuery);
          const matchingTemplates = templatesSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate))
            .filter(t => t.transactionTypes.includes(transaction.transactionType));

          if (matchingTemplates.length > 1) {
            setAvailableTemplates(matchingTemplates);
            setStep('select'); // Let the user choose
          } else if (matchingTemplates.length === 1) {
            setChosenTemplate(matchingTemplates[0]);
            setStep('edit'); // Only one found, use it
          } else {
            setChosenTemplate(null);
            setStep('edit'); // No templates found, manual creation
          }
        }
      } catch (error) {
        console.error("Error fetching contract templates:", error);
        toast({ variant: "destructive", title: "خطأ", description: "فشل في جلب نماذج العقود." });
        setStep('edit'); // Fallback to manual edit on error
      }
    };

    findAndSetTemplate();
  }, [isOpen, transaction, firestore, toast]);

  // This effect populates the form fields once a template is chosen or if we enter edit mode.
  useEffect(() => {
      if (step !== 'edit' || !isOpen) return;
      if (transaction?.contract) return; // If editing an existing contract, data is already set.

      const totalContractAmount = chosenTemplate?.financials.totalAmount || 0;
      const isPercentage = chosenTemplate?.financials.type === 'percentage';

      const calculatedClauses = (chosenTemplate?.financials.milestones || []).map(m => ({
          id: m.id || generateId(),
          name: m.name,
          amount: isPercentage ? ((m.value || 0) / 100) * totalContractAmount : (m.value || 0),
          status: 'غير مستحقة',
          percentage: isPercentage ? m.value : undefined
      } as ContractClause));

      setClauses(JSON.parse(JSON.stringify(calculatedClauses)));
      setScopeOfWork(JSON.parse(JSON.stringify(chosenTemplate?.scopeOfWork || [])));
      setTerms(JSON.parse(JSON.stringify(chosenTemplate?.termsAndConditions || [])));
      setOpenClauses(JSON.parse(JSON.stringify(chosenTemplate?.openClauses || [])));
      
  }, [chosenTemplate, step, isOpen, transaction?.contract]);


  const handleAmountChange = (index: number, newAmount: string) => {
    const updatedClauses = [...clauses];
    updatedClauses[index].amount = Number(newAmount) || 0;
    setClauses(updatedClauses);
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
    return clauses.reduce((acc, clause) => acc + clause.amount, 0);
  }, [clauses]);

  const handleSubmit = async () => {
    if (!firestore || !transaction?.id || !currentUser) return;
    setIsSaving(true);
    try {
        // Read parent account OUTSIDE transaction. This is fine.
        const parentAccountQuery = query(collection(firestore, 'chartOfAccounts'), where('name', '==', 'العملاء'), limit(1));
        const parentAccountSnap = await getDocs(parentAccountQuery);
        if (parentAccountSnap.empty) {
            throw new Error('لم يتم العثور على حساب "العملاء" الرئيسي في شجرة الحسابات. يرجى إضافته أولاً.');
        }
        const parentAccount = parentAccountSnap.docs[0].data();
        const parentCode = parentAccount.code as string;
        const parentLevel = parentAccount.level as number;

        await runTransaction(firestore, async (transaction_firestore) => {
            // --- ALL READS MUST GO FIRST ---
            const clientRef = doc(firestore, 'clients', clientId);
            const coaClientCounterRef = doc(firestore, 'counters', 'coa_clients');

            // Read 1: Client data
            const clientSnap = await transaction_firestore.get(clientRef);
            if (!clientSnap.exists()) {
                throw new Error("Client not found.");
            }
            const clientData = clientSnap.data();
            
            // Read 2: Counter data (read it regardless, just in case it's needed)
            const coaClientCounterDoc = await transaction_firestore.get(coaClientCounterRef);

            // --- ALL WRITES GO AFTER READS ---
            const transactionRef = doc(firestore, 'clients', clientId, 'transactions', transaction.id);

            // Write 1: Update the transaction with the contract data
            transaction_firestore.update(transactionRef, {
                contract: {
                    clauses: clauses,
                    scopeOfWork: scopeOfWork,
                    termsAndConditions: terms,
                    openClauses: openClauses,
                    totalAmount: totalAmount,
                    financialsType: chosenTemplate?.financials.type,
                }
            });

            // Conditionally perform more writes if it's a new client contract
            if (clientData.status === 'new') {
                // Now we can use the data we read earlier
                const lastClientCodeNumber = coaClientCounterDoc.exists() ? coaClientCounterDoc.data()?.lastNumber || 0 : 0;
                const nextClientCodeNumber = lastClientCodeNumber + 1;
                const newAccountCode = `${parentCode}${String(nextClientCodeNumber).padStart(3, '0')}`;
                
                // Write 2: update client status
                transaction_firestore.update(clientRef, { status: 'contracted' });

                // Write 3: Log status change
                const historyCollectionRef = collection(firestore, `clients/${clientId}/history`);
                const logContent = `تغيرت حالة الملف من "جديد" إلى "تم التعاقد" بعد إنشاء أول عقد.`;
                transaction_firestore.set(doc(historyCollectionRef), {
                    type: 'log',
                    content: logContent,
                    userId: currentUser.id,
                    userName: currentUser.fullName || 'النظام',
                    userAvatar: currentUser.avatarUrl || '',
                    createdAt: serverTimestamp(),
                });
                
                // Write 4: update counter
                transaction_firestore.set(coaClientCounterRef, { lastNumber: nextClientCodeNumber }, { merge: true });
                
                // Write 5: Create the new account document
                const newAccountRef = doc(collection(firestore, 'chartOfAccounts'));
                const newAccountData = {
                    name: clientData.nameAr,
                    code: newAccountCode,
                    type: parentAccount.type,
                    level: parentLevel + 1,
                };
                transaction_firestore.set(newAccountRef, newAccountData);
            }
        });

        toast({ title: 'نجاح', description: 'تم حفظ بنود العقد وربط العميل بالحسابات بنجاح.' });
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
        className="max-w-3xl" 
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
              setChosenTemplate(selected);
              setStep('edit');
            }}
            onContinueWithout={() => {
              setChosenTemplate(null);
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
            <div className="py-4 space-y-6 max-h-[70vh] overflow-y-auto px-2">
                <div>
                    <Label className="text-base font-semibold">البنود المالية</Label>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>البند</TableHead>
                          <TableHead className="w-[150px] text-left">المبلغ (د.ك)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clauses.map((clause, index) => (
                          <TableRow key={clause.id}>
                            <TableCell className="font-medium">{clause.name}</TableCell>
                            <TableCell>
                              <Input 
                                type="number"
                                value={clause.amount}
                                onChange={(e) => handleAmountChange(index, e.target.value)}
                                className="text-left dir-ltr"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell className="font-bold">الإجمالي</TableCell>
                          <TableCell className="text-left font-bold font-mono">
                            {formatCurrency(totalAmount)}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
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
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderTerm(index, 'up')} disabled={index === 0}>
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderTerm(index, 'down')} disabled={index === terms.length - 1}>
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                </div>
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeTerm(term.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
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
            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                حفظ التغييرات
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
