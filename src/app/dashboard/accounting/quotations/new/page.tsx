'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Save, X, Loader2, PlusCircle, Trash2, ArrowUp, ArrowDown, FileSignature } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, collectionGroup, where, limit } from 'firebase/firestore';
import type { Client, QuotationItem, ContractTemplate, ContractScopeItem, ContractTerm, TransactionType, WorkStage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { DateInput } from '@/components/ui/date-input';
import { useAuth } from '@/context/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { Separator } from '@/components/ui/separator';

const generateId = () => Math.random().toString(36).substring(2, 9);

const itemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, "الوصف مطلوب"),
  quantity: z.preprocess((v) => parseFloat(String(v || '1')), z.number().min(0.01)),
  unitPrice: z.preprocess(v => parseFloat(String(v || '0')), z.number().min(0)).optional(),
  percentage: z.preprocess(v => parseFloat(String(v || '0')), z.number().min(0)).optional(),
  condition: z.string().optional(),
});

const quotationSchema = z.object({
  clientId: z.string().min(1, 'العميل مطلوب.'),
  subject: z.string().min(1, 'الموضوع مطلوب.'),
  date: z.date({ required_error: "التاريخ مطلوب." }),
  validUntil: z.date({ required_error: "تاريخ الانتهاء مطلوب." }),
  items: z.array(itemSchema).min(1, 'يجب إضافة بند واحد على الأقل.'),
  notes: z.string().optional(),
  departmentId: z.string().min(1, 'القسم مطلوب'),
  transactionTypeId: z.string().min(1, 'نوع المعاملة مطلوب'),
  financialsType: z.enum(['fixed', 'percentage']),
  totalAmount: z.preprocess((a) => parseFloat(String(a || '0')), z.number().optional()),
});


type QuotationFormValues = z.infer<typeof quotationSchema>;

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


export default function NewQuotationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const clientIdFromUrl = searchParams.get('clientId');

  const [clients, setClients] = useState<Client[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<any[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(true);

  const [quotationNumber, setQuotationNumber] = useState('جاري التوليد...');
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(true);
  
  const [scopeOfWork, setScopeOfWork] = useState<ContractScopeItem[]>([]);
  const [terms, setTerms] = useState<ContractTerm[]>([]);
  const [openClauses, setOpenClauses] = useState<ContractTerm[]>([]);

  const [step, setStep] = useState<'form' | 'select'>('form');
  const [availableTemplates, setAvailableTemplates] = useState<ContractTemplate[]>([]);
  const [chosenTemplate, setChosenTemplate] = useState<ContractTemplate | null>(null);


  const { register, handleSubmit, control, formState: { errors }, watch, setValue, getValues } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    mode: 'onChange',
    defaultValues: {
      clientId: clientIdFromUrl || '',
      date: new Date(),
      validUntil: new Date(new Date().setDate(new Date().getDate() + 30)),
      items: [{ id: generateId(), description: '', quantity: 1, unitPrice: 0, percentage: 0, condition: '' }],
      notes: '',
      departmentId: '',
      transactionTypeId: '',
      subject: '',
      financialsType: 'fixed',
      totalAmount: 0,
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = watch("items");
  const selectedTransactionTypeId = watch("transactionTypeId");
  const financials_type = watch("financialsType");
  const total_amount = watch("totalAmount");
  
  const totalCalculatedAmount = useMemo(() => {
    if (financials_type === 'fixed') {
        return (watchedItems || []).reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
    }
    return total_amount || 0;
  }, [watchedItems, financials_type, total_amount]);


  useEffect(() => {
    if (!firestore) return;
    const fetchRefData = async () => {
      setRefDataLoading(true);
      try {
        const [clientsSnapshot, templatesSnapshot, transTypesSnapshot] = await Promise.all([
          getDocs(query(collection(firestore, 'clients'), where('isActive', '==', true), orderBy('createdAt', 'desc'), limit(200))),
          getDocs(query(collection(firestore, 'contractTemplates'), orderBy('title'))),
          getDocs(query(collection(firestore, 'transactionTypes'), orderBy('name')))
        ]);

        const fetchedClients = clientsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Client))
            .filter(c => c && c.nameAr && c.isActive === true);
        
        // Sorting is now done client-side on the fetched (limited) data for better UX
        fetchedClients.sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));
        setClients(fetchedClients);
        
        setTemplates(templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate)));
        setTransactionTypes(transTypesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));

      } catch (error) {
        console.error("Error fetching ref data for quotations:", error)
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات المرجعية.' });
      } finally {
        setRefDataLoading(false);
      }
    };
    fetchRefData();
  }, [firestore, toast]);
  

  const populateFormFromTemplate = useCallback((template: ContractTemplate | null) => {
    replace([{ id: generateId(), description: '', quantity: 1, unitPrice: 0, percentage: 0, condition: '' }]);
    setScopeOfWork([]);
    setTerms([]);
    setOpenClauses([]);
    setValue('notes', '');
    
    if (template) {
      setValue('financialsType', template.financials?.type || 'fixed');
      setValue('totalAmount', template.financials?.totalAmount || 0);

      const notesParts: string[] = [];
      if (template.description) {
        notesParts.push(`**ملخص:**\n${template.description}`);
      }
      
      setScopeOfWork(template.scopeOfWork || []);
      if (template.scopeOfWork && template.scopeOfWork.length > 0) {
          notesParts.push(`\n**نطاق العمل:**\n${template.scopeOfWork.map((item, index) => `${index + 1}. ${item.title}: ${item.description || ''}`).join('\n')}`);
      }

      setTerms(template.termsAndConditions || []);
      if (template.termsAndConditions && template.termsAndConditions.length > 0) {
          notesParts.push(`\n**الشروط والأحكام:**\n${template.termsAndConditions.map(term => `- ${term.text}`).join('\n')}`);
      }
      
      setOpenClauses(template.openClauses || []);
      if (template.openClauses && template.openClauses.length > 0) {
          notesParts.push(`\n**بنود إضافية:**\n${template.openClauses.map(clause => `- ${clause.text}`).join('\n')}`);
      }
      
      setValue('notes', notesParts.join('\n\n'), { shouldValidate: true });

      const newItems = template.financials?.milestones?.map(milestone => {
        const isPercentage = template.financials?.type === 'percentage';
        const value = Number(milestone.value || 0);
        return {
          id: milestone.id || generateId(),
          description: milestone.name,
          quantity: 1,
          unitPrice: isPercentage ? (value / 100) * (template.financials?.totalAmount || 0) : value,
          percentage: isPercentage ? value : 0,
          condition: milestone.condition || '',
        };
      }) || [];

      if (newItems.length > 0) {
        replace(newItems);
      }
    } else {
        setValue('financialsType', 'fixed');
        setValue('totalAmount', 0);
    }
    setChosenTemplate(template);
  }, [replace, setValue]);


  useEffect(() => {
    if (!selectedTransactionTypeId || transactionTypes.length === 0 || templates.length === 0) return;

    const transType = transactionTypes.find(t => t.id === selectedTransactionTypeId);
    if (!transType) return;
    
    setValue('subject', transType.name, { shouldValidate: true });
    
    const matchingTemplates = templates.filter(t => t.transactionTypes?.includes(transType.name));
    
    if (matchingTemplates.length > 1) {
        setAvailableTemplates(matchingTemplates);
        setStep('select');
    } else {
        const templateToUse = matchingTemplates.length === 1 ? matchingTemplates[0] : null;
        populateFormFromTemplate(templateToUse);
        setStep('form');
    }
    
    if (transType.departmentIds && transType.departmentIds.length > 0) {
        setValue('departmentId', transType.departmentIds[0], { shouldValidate: true });
    }

  }, [selectedTransactionTypeId, transactionTypes, templates, setValue, populateFormFromTemplate]);

  useEffect(() => {
    if (!firestore) return;
    setIsGeneratingNumber(true);
    const generateNumber = async () => {
        try {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'quotations');
            const counterDoc = await getDoc(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            setQuotationNumber(`Q-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
        } catch (error) {
            setQuotationNumber('خطأ');
        } finally {
            setIsGeneratingNumber(false);
        }
    };
    generateNumber();
  }, [firestore]);
  
  const clientOptions = useMemo(() =>
    clients.map(c => ({ value: c.id, label: c.nameAr, searchKey: c.mobile }))
  , [clients]);
  
  const transactionTypeOptions = useMemo(() => transactionTypes.map(t => ({ value: t.id, label: t.name })), [transactionTypes]);

  const onSubmit = async (data: QuotationFormValues) => {
    if (!firestore || !currentUser || isGeneratingNumber) return;
    setIsSaving(true);
    let newQuotationId = '';
    try {
        await runTransaction(firestore, async (transaction) => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'quotations');
            const counterDoc = await transaction.get(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            
            const newQuotationNumber = `Q-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

            const newQuotationRef = doc(collection(firestore, 'quotations'));
            newQuotationId = newQuotationRef.id;
            const client = clients.find(c => c.id === data.clientId);
            
            const processedItems = data.items.map(item => {
                const isPercentage = data.financialsType === 'percentage';
                const percentage = Number(item.percentage || 0);
                const unitPrice = isPercentage 
                    ? (percentage / 100) * (data.totalAmount || 0) 
                    : Number(item.unitPrice || 0);
                
                return {
                    id: item.id || generateId(),
                    description: item.description,
                    quantity: Number(item.quantity),
                    unitPrice: unitPrice,
                    total: unitPrice * Number(item.quantity),
                    percentage: isPercentage ? percentage : undefined,
                    condition: item.condition,
                };
            });

            const finalTotalAmount = processedItems.reduce((sum, item) => sum + item.total, 0);

            const quotationData = {
                quotationNumber: newQuotationNumber,
                quotationSequence: nextNumber,
                quotationYear: currentYear,
                clientId: data.clientId,
                clientName: client?.nameAr || '',
                date: data.date,
                validUntil: data.validUntil,
                subject: data.subject,
                departmentId: data.departmentId,
                transactionTypeId: data.transactionTypeId,
                items: processedItems,
                totalAmount: finalTotalAmount,
                notes: data.notes,
                status: 'draft',
                createdAt: serverTimestamp(),
                createdBy: currentUser.id,
                financialsType: data.financialsType,
                scopeOfWork: scopeOfWork,
                termsAndConditions: terms,
                openClauses: openClauses,
                templateDescription: chosenTemplate?.description || '',
            };
            
            transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            transaction.set(newQuotationRef, cleanFirestoreData(quotationData));
        });
        
        toast({ title: 'نجاح', description: 'تم حفظ عرض السعر كمسودة.' });
        if (newQuotationId) {
            router.push(`/dashboard/accounting/quotations/${newQuotationId}`);
        } else {
            router.push('/dashboard/accounting/quotations');
        }

    } catch (error) {
        console.error("Error saving quotation:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم حفظ عرض السعر.' });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog open={step === 'select'} onOpenChange={(open) => !open && setStep('form')}>
        <DialogContent>
          <TemplateSelectionView 
            templates={availableTemplates}
            onSelect={(selected) => {
              populateFormFromTemplate(selected);
              setStep('form');
            }}
            onContinueWithout={() => {
              populateFormFromTemplate(null);
              setStep('form');
            }}
          />
        </DialogContent>
      </Dialog>
    
      <Card className="max-w-4xl mx-auto" dir="rtl">
        <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>عرض سعر جديد</CardTitle>
                        <CardDescription>املأ التفاصيل لإنشاء عرض سعر جديد.</CardDescription>
                    </div>
                    <div className="text-right">
                        <Label>رقم العرض</Label>
                        <div className="font-mono text-lg font-semibold h-7">
                            {isGeneratingNumber ? <Skeleton className="h-6 w-24" /> : quotationNumber}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-2">
                        <Label>العميل <span className="text-destructive">*</span></Label>
                        <Controller
                            control={control} name="clientId"
                            render={({ field }) => (
                                <InlineSearchList value={field.value} onSelect={field.onChange} options={clientOptions} placeholder={refDataLoading ? 'تحميل...' : 'ابحث عن عميل...'} disabled={refDataLoading || !!clientIdFromUrl} />
                            )}
                        />
                        {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
                    </div>
                     <div className="grid gap-2">
                        <Label>نوع المعاملة <span className="text-destructive">*</span></Label>
                        <Controller control={control} name="transactionTypeId"
                            render={({ field }) => (
                                <InlineSearchList value={field.value} onSelect={field.onChange} options={transactionTypeOptions} placeholder={refDataLoading ? 'تحميل...' : 'اختر نوع المعاملة...'} disabled={refDataLoading}/>
                            )}
                        />
                        {errors.transactionTypeId && <p className="text-xs text-destructive">{errors.transactionTypeId.message}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <div className="grid gap-2 md:col-span-1">
                        <Label htmlFor="subject">الموضوع <span className="text-destructive">*</span></Label>
                        <Input id="subject" {...register('subject')} />
                        {errors.subject && <p className="text-xs text-destructive">{errors.subject.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="date">التاريخ <span className="text-destructive">*</span></Label>
                        <Controller name="date" control={control} render={({ field }) => ( <DateInput value={field.value} onChange={field.onChange} /> )} />
                        {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="validUntil">صالح حتى تاريخ <span className="text-destructive">*</span></Label>
                        <Controller name="validUntil" control={control} render={({ field }) => ( <DateInput value={field.value} onChange={field.onChange} /> )} />
                        {errors.validUntil && <p className="text-xs text-destructive">{errors.validUntil.message}</p>}
                    </div>
                </div>
                
                 {financials_type === 'percentage' && (
                    <div className="grid gap-2 md:w-1/3">
                        <Label>إجمالي قيمة العقد (لحساب النسب)</Label>
                        <Input type="number" {...register('totalAmount')} />
                    </div>
                 )}

                <div>
                    <Label className="mb-2 block">البنود</Label>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-2/5">الوصف</TableHead>
                                <TableHead className="w-[100px]">الكمية</TableHead>
                                <TableHead className="w-1/5">{financials_type === 'percentage' ? 'النسبة' : 'سعر الوحدة'}</TableHead>
                                <TableHead className="w-1/6 text-left">الإجمالي</TableHead>
                                <TableHead className="w-[50px]"><span className="sr-only">حذف</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => {
                                const item = watchedItems?.[index] || {};
                                const lineTotal = financials_type === 'percentage'
                                    ? ((Number(item?.percentage) || 0) / 100) * (total_amount || 0)
                                    : (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0);

                                return (
                                <TableRow key={field.id}>
                                    <TableCell>
                                        <Textarea {...register(`items.${index}.description`)} placeholder="وصف البند..."/>
                                        {errors.items?.[index]?.description && <p className="text-xs text-destructive mt-1">{errors.items?.[index]?.description?.message}</p>}
                                        {watchedItems?.[index]?.condition && (
                                            <div className="mt-2 text-xs text-muted-foreground p-2 bg-muted/50 rounded-md">
                                                <span className="font-semibold">شرط الاستحقاق:</span> {watchedItems[index].condition}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" step="any" {...register(`items.${index}.quantity`)} className="dir-ltr" />
                                    </TableCell>
                                    <TableCell>
                                        {financials_type === 'percentage' ? (
                                            <div className="flex items-center gap-1">
                                                <Input type="number" step="any" {...register(`items.${index}.percentage`)} className="dir-ltr" />
                                                <span className="text-sm">%</span>
                                            </div>
                                        ) : (
                                            <Input type="number" step="0.001" {...register(`items.${index}.unitPrice`)} className="dir-ltr" />
                                        )}
                                    </TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(lineTotal)}</TableCell>
                                    <TableCell>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={3} className="font-bold text-lg">الإجمالي</TableCell>
                                <TableCell className="font-bold font-mono text-lg text-left">{formatCurrency(totalCalculatedAmount)}</TableCell>
                                <TableCell />
                            </TableRow>
                        </TableFooter>
                    </Table>
                     <div className="flex justify-start mt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ id: generateId(), description: '', quantity: 1, unitPrice: 0, percentage: 0, condition: '' })}>
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إضافة بند
                        </Button>
                     </div>
                </div>
                {errors.items && <p className="text-destructive text-sm mt-2">{errors.items.root?.message || errors.items.message}</p>}

                <div className="grid gap-2">
                    <Label htmlFor="notes">ملاحظات إضافية (تحتوي على بنود العقد)</Label>
                    <Textarea id="notes" {...register('notes')} placeholder="شروط الدفع، معلومات الضمان، إلخ." rows={5}/>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>إلغاء</Button>
                <Button type="submit" disabled={isSaving || isGeneratingNumber}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                    حفظ كمسودة
                </Button>
            </CardFooter>
        </form>
      </Card>
    </>
  );
}
