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
import { doc, updateDoc, writeBatch, getDoc, collection, serverTimestamp, getDocs, query } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { ClientTransaction, ContractClause, ContractTemplate, ContractTerm } from '@/lib/types';
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

export function ContractClausesForm({ isOpen, onClose, transaction, clientId }: ContractClausesFormProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [clauses, setClauses] = useState<ContractClause[]>([]);
  const [terms, setTerms] = useState<ContractTerm[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [template, setTemplate] = useState<ContractTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  useEffect(() => {
    if (!isOpen || !transaction || !firestore) return;

    const findAndSetTemplate = async () => {
      setLoadingTemplate(true);
      try {
        if (transaction.contract) {
          setClauses(JSON.parse(JSON.stringify(transaction.contract.clauses || [])));
          setTerms(JSON.parse(JSON.stringify(transaction.contract.termsAndConditions || [])));
          setTemplate({ title: transaction.transactionType, clauses: [], transactionTypes: [], termsAndConditions: [] }); // Dummy template
        } else {
          const templatesQuery = query(collection(firestore, 'contractTemplates'));
          const templatesSnapshot = await getDocs(templatesQuery);
          const foundTemplate = templatesSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate))
            .find(t => t.transactionTypes.includes(transaction.transactionType));
          
          if (foundTemplate) {
            setTemplate(foundTemplate);
            setClauses(JSON.parse(JSON.stringify(foundTemplate.financials.milestones.map(m => ({id: m.id, name: m.name, amount: m.value, status: 'غير مستحقة'})) || [])));
            setTerms(JSON.parse(JSON.stringify(foundTemplate.termsAndConditions || [])));
          } else {
            setTemplate(null);
            setClauses([]);
            setTerms([]);
          }
        }
      } catch (error) {
        console.error("Error fetching contract templates:", error);
        toast({ variant: "destructive", title: "خطأ", description: "فشل في جلب نماذج العقود." });
      } finally {
        setLoadingTemplate(false);
      }
    };

    findAndSetTemplate();

  }, [isOpen, transaction, firestore, toast]);

  const handleAmountChange = (index: number, newAmount: string) => {
    const updatedClauses = [...clauses];
    updatedClauses[index].amount = Number(newAmount) || 0;
    setClauses(updatedClauses);
  };
  
  const addTerm = () => setTerms(prev => [...prev, { id: Date.now().toString(), text: '' }]);
  const removeTerm = (id: string) => setTerms(prev => prev.filter(t => t.id !== id));
  const handleTermChange = (id: string, text: string) => setTerms(prev => prev.map(t => (t.id === id ? { ...t, text } : t)));
  const reorderTerm = (index: number, direction: 'up' | 'down') => {
      const newTerms = [...terms];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newTerms.length) return;
      [newTerms[index], newTerms[newIndex]] = [newTerms[newIndex], newTerms[index]];
      setTerms(newTerms);
  };

  const totalAmount = useMemo(() => {
    return clauses.reduce((acc, clause) => acc + clause.amount, 0);
  }, [clauses]);

  const handleSubmit = async () => {
    if (!firestore || !transaction?.id || !currentUser) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const transactionRef = doc(firestore, 'clients', clientId, 'transactions', transaction.id);
      const clientRef = doc(firestore, 'clients', clientId);

      // Update the transaction with contract details
      batch.update(transactionRef, {
        contract: {
          clauses: clauses,
          termsAndConditions: terms,
          totalAmount: totalAmount,
        }
      });

      // Check client status and update if it's 'new'
      const clientSnap = await getDoc(clientRef); // Get latest status

      if (clientSnap.exists() && clientSnap.data().status === 'new') {
        batch.update(clientRef, { status: 'contracted' });

        // Add a history log for the status change
        const historyCollectionRef = collection(firestore, `clients/${clientId}/history`);
        const logContent = `تغيرت حالة الملف من "جديد" إلى "تم التعاقد" بعد إنشاء أول عقد.`;
        batch.set(doc(historyCollectionRef), {
            type: 'log',
            content: logContent,
            userId: currentUser.id,
            userName: currentUser.fullName || 'النظام',
            userAvatar: currentUser.avatarUrl || '',
            createdAt: serverTimestamp(),
        });
      }
      
      await batch.commit();

      toast({ title: 'نجاح', description: 'تم حفظ بنود العقد بنجاح.' });
      onClose(); // This might trigger a re-render on the parent, which is good.
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ بنود العقد.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>إدارة بنود العقد للمعاملة</DialogTitle>
          <DialogDescription>
            {loadingTemplate ? 'جاري تحميل النموذج...' : template ? `تعديل الدفعات المالية والشروط للعقد "${template.title}".` : 'لا يوجد نموذج عقد لهذه المعاملة.'}
          </DialogDescription>
        </DialogHeader>
        {loadingTemplate ? <div className='flex justify-center items-center h-48'><Loader2 className="h-8 w-8 animate-spin" /></div> : template ? (
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
                  <Label className="text-base font-semibold">الشروط والأحكام</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addTerm}><PlusCircle className="ml-2 h-4 w-4"/> إضافة شرط</Button>
                </div>
                <div className='space-y-2'>
                    {terms.map((term, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{index + 1}.</span>
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

          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <p>لا يوجد نموذج عقد مرتبط بنوع هذه المعاملة: "{transaction?.transactionType}"</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={isSaving || !template}>
            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
            حفظ التغييرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
