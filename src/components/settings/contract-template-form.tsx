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
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { ContractTemplate, TransactionType, ContractClause, ContractTerm } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Trash2, PlusCircle, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, getDocs, query, orderBy, collectionGroup } from 'firebase/firestore';
import { formatCurrency } from '@/lib/utils';
import { Textarea } from '../ui/textarea';

interface ContractTemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ContractTemplate>) => void;
  template: ContractTemplate | null;
}

const initialData: Partial<ContractTemplate> = {
    title: '',
    transactionTypes: [],
    clauses: [],
    termsAndConditions: [],
};

export function ContractTemplateForm({ isOpen, onClose, onSave, template }: ContractTemplateFormProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const isEditing = !!template;
  
  const [formData, setFormData] = useState<Partial<ContractTemplate>>(initialData);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [allTransactionTypes, setAllTransactionTypes] = useState<TransactionType[]>([]);

  useEffect(() => {
    if (firestore && isOpen) {
        setLoadingTypes(true);
        const fetchTypes = async () => {
            const q = query(collectionGroup(firestore, 'transactionTypes'));
            const snapshot = await getDocs(q);
            const uniqueTypes = new Map<string, TransactionType>();
            snapshot.docs.forEach(d => {
                const type = d.data() as TransactionType;
                if (!uniqueTypes.has(type.name)) {
                    uniqueTypes.set(type.name, type);
                }
            });
            setAllTransactionTypes(Array.from(uniqueTypes.values()).sort((a,b) => a.name.localeCompare(b.name)));
            setLoadingTypes(false);
        };
        fetchTypes();
    }
  }, [firestore, isOpen]);

  useEffect(() => {
    if (template && isEditing) {
        setFormData({
            title: template.title,
            transactionTypes: template.transactionTypes || [],
            clauses: JSON.parse(JSON.stringify(template.clauses || [])),
            termsAndConditions: JSON.parse(JSON.stringify(template.termsAndConditions || [])),
        });
    } else {
        setFormData(initialData);
    }
  }, [template, isEditing, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleClauseChange = (index: number, field: keyof ContractClause, value: string | number) => {
      const newClauses = [...(formData.clauses || [])];
      (newClauses[index] as any)[field] = value;
      setFormData(prev => ({ ...prev, clauses: newClauses }));
  };

  const addClause = () => {
      const newClause: ContractClause = { id: Date.now(), name: '', amount: 0, status: 'مستحقة' };
      setFormData(prev => ({ ...prev, clauses: [...(prev.clauses || []), newClause] }));
  };
  
  const removeClause = (index: number) => {
      const newClauses = [...(formData.clauses || [])];
      newClauses.splice(index, 1);
      setFormData(prev => ({ ...prev, clauses: newClauses }));
  };

  const addTerm = () => {
    const newTerm: ContractTerm = { id: Date.now().toString(), text: '' };
    setFormData(prev => ({
        ...prev,
        termsAndConditions: [...(prev.termsAndConditions || []), newTerm]
    }));
  };
  const removeTerm = (id: string) => {
      setFormData(prev => ({
          ...prev,
          termsAndConditions: (prev.termsAndConditions || []).filter(t => t.id !== id)
      }));
  };
  const handleTermChange = (id: string, text: string) => {
      setFormData(prev => ({
          ...prev,
          termsAndConditions: (prev.termsAndConditions || []).map(t => t.id === id ? { ...t, text } : t)
      }));
  };
  const reorderTerm = (index: number, direction: 'up' | 'down') => {
      const terms = [...(formData.termsAndConditions || [])];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= terms.length) return;
      [terms[index], terms[newIndex]] = [terms[newIndex], terms[index]];
      setFormData(prev => ({ ...prev, termsAndConditions: terms }));
  };
  
  const handleTransactionTypeToggle = (typeName: string) => {
    const currentTypes = formData.transactionTypes || [];
    const newTypes = currentTypes.includes(typeName)
      ? currentTypes.filter(t => t !== typeName)
      : [...currentTypes, typeName];
    setFormData(prev => ({ ...prev, transactionTypes: newTypes }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'عنوان النموذج حقل مطلوب.' });
        return;
    }
    const finalData: Partial<ContractTemplate> = {
        title: formData.title,
        transactionTypes: formData.transactionTypes,
        clauses: (formData.clauses || []).map((c, i) => ({ ...c, id: i + 1, amount: Number(c.amount) || 0 })),
        termsAndConditions: (formData.termsAndConditions || []).map((t, i) => ({ ...t, id: (i+1).toString() }))
    };
    onSave(finalData);
  };
  
  const totalAmount = useMemo(() => 
      (formData.clauses || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  , [formData.clauses]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
                <DialogTitle>{isEditing ? 'تعديل نموذج عقد' : 'إنشاء نموذج عقد جديد'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto px-2">
                <div className="grid gap-2">
                    <Label htmlFor="title">عنوان النموذج <span className="text-destructive">*</span></Label>
                    <Input id="title" value={formData.title} onChange={handleChange} required />
                </div>
                
                <div className="grid gap-2">
                    <Label>ربط مع أنواع المعاملات</Label>
                    <ScrollArea className="h-32 border rounded-md p-2">
                        {loadingTypes ? <p>جاري التحميل...</p> : 
                         allTransactionTypes.map(type => (
                             <div key={type.name} className="flex items-center space-x-2 space-y-1">
                                 <Checkbox 
                                    id={`type-${type.name}`}
                                    checked={(formData.transactionTypes || []).includes(type.name)}
                                    onCheckedChange={() => handleTransactionTypeToggle(type.name)}
                                 />
                                 <Label htmlFor={`type-${type.name}`} className="font-normal cursor-pointer">{type.name}</Label>
                             </div>
                         ))
                        }
                    </ScrollArea>
                </div>
                
                <div className="grid gap-2">
                    <div className='flex justify-between items-center'>
                      <Label>بنود العقد المالية</Label>
                      <Button type="button" size="sm" variant="outline" onClick={addClause}><PlusCircle className="ml-2 h-4 w-4"/> إضافة بند</Button>
                    </div>
                    <div className='space-y-2'>
                        {(formData.clauses || []).map((clause, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <Input 
                                    placeholder={`اسم البند ${index + 1}`}
                                    value={clause.name}
                                    onChange={e => handleClauseChange(index, 'name', e.target.value)}
                                />
                                <Input 
                                    type="number"
                                    placeholder="المبلغ"
                                    className="w-32"
                                    value={clause.amount}
                                    onChange={e => handleClauseChange(index, 'amount', Number(e.target.value))}
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeClause(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 text-right font-bold">
                        الإجمالي: {formatCurrency(totalAmount)}
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label>الشروط والأحكام</Label>
                    <div className='space-y-2'>
                        {(formData.termsAndConditions || []).map((term, index) => (
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
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderTerm(index, 'down')} disabled={index === (formData.termsAndConditions || []).length - 1}>
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                </div>
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeTerm(term.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={addTerm} className="w-fit">
                        <PlusCircle className="ml-2 h-4 w-4"/> إضافة شرط
                    </Button>
                </div>

            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
                <Button type="submit">حفظ النموذج</Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
