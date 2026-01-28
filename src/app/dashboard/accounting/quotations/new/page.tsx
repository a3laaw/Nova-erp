
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
import { Save, X, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, collectionGroup } from 'firebase/firestore';
import type { Client, QuotationItem, ContractTemplate, ContractScopeItem, ContractTerm, Department, TransactionType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

const generateId = () => Math.random().toString(36).substring(2, 9);

const itemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, "الوصف مطلوب"),
  quantity: z.preprocess(v => parseFloat(String(v)), z.number().min(0.01, "الكمية يجب أن تكون أكبر من صفر")),
  unitPrice: z.preprocess(v => parseFloat(String(v)), z.number().min(0, "السعر يجب أن لا يكون سالبًا")),
  condition: z.string().optional(),
});

const quotationSchema = z.object({
  clientId: z.string().min(1, 'العميل مطلوب.'),
  subject: z.string().min(1, 'الموضوع مطلوب.'),
  date: z.string().min(1, 'تاريخ عرض السعر مطلوب.'),
  validUntil: z.string().min(1, 'تاريخ انتهاء الصلاحية مطلوب.'),
  items: z.array(itemSchema).min(1, 'يجب إضافة بند واحد على الأقل.'),
  notes: z.string().optional(),
  departmentId: z.string().min(1, 'القسم مطلوب'),
  transactionTypeId: z.string().min(1, 'نوع المعاملة مطلوب'),
});

type QuotationFormValues = z.infer<typeof quotationSchema>;

export default function NewQuotationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const clientIdFromUrl = searchParams.get('clientId');

  // Reference data states
  const [clients, setClients] = useState<Client[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(true);
  const [transactionTypesLoading, setTransactionTypesLoading] = useState(false);

  // Form-related states
  const [quotationNumber, setQuotationNumber] = useState('جاري التوليد...');
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(true);
  
  const [scopeOfWork, setScopeOfWork] = useState<ContractScopeItem[]>([]);
  const [terms, setTerms] = useState<ContractTerm[]>([]);
  const [openClauses, setOpenClauses] = useState<ContractTerm[]>([]);

  const { register, handleSubmit, control, formState: { errors }, watch, setValue, reset, getValues } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    mode: 'onChange',
    defaultValues: {
      clientId: clientIdFromUrl || '',
      date: new Date().toISOString().split('T')[0],
      validUntil: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
      items: [{ id: generateId(), description: '', quantity: 1, unitPrice: 0, condition: '' }],
      notes: '',
      departmentId: '',
      transactionTypeId: '',
      subject: '',
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = watch("items");
  const selectedDepartmentId = watch("departmentId");
  const selectedTransactionTypeId = watch("transactionTypeId");

  const totalAmount = useMemo(() =>
    (watchedItems || []).reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0),
  [watchedItems]);


  // Fetch clients, departments and templates
  useEffect(() => {
    if (!firestore) return;
    const fetchRefData = async () => {
      setRefDataLoading(true);
      try {
        const [clientsSnapshot, departmentsSnapshot, templatesSnapshot] = await Promise.all([
          getDocs(query(collection(firestore, 'clients'), orderBy('nameAr'))),
          getDocs(query(collection(firestore, 'departments'), orderBy('name'))),
          getDocs(query(collection(firestore, 'contractTemplates'), orderBy('title')))
        ]);

        setClients(clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        setDepartments(departmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
        setTemplates(templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate)));

      } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات المرجعية.' });
      } finally {
        setRefDataLoading(false);
      }
    };
    fetchRefData();
  }, [firestore, toast]);
  
  // Fetch transaction types when department changes
  useEffect(() => {
      if (!selectedDepartmentId || !firestore) {
          setTransactionTypes([]);
          return;
      }
      const fetchTransactionTypes = async () => {
          setTransactionTypesLoading(true);
          try {
              const typesQuery = query(collection(firestore, `departments/${selectedDepartmentId}/transactionTypes`), orderBy('name'));
              const typesSnapshot = await getDocs(typesQuery);
              setTransactionTypes(typesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionType)));
          } catch(e) {
              toast({ variant: 'destructive', title: 'خطأ', description: 'فشل جلب أنواع المعاملات.' });
          } finally {
              setTransactionTypesLoading(false);
          }
      };
      fetchTransactionTypes();
  }, [selectedDepartmentId, firestore, toast]);

  // Handle auto-population from template when transaction type is selected
  useEffect(() => {
    if (!selectedTransactionTypeId || transactionTypes.length === 0 || templates.length === 0) return;

    const transType = transactionTypes.find(t => t.id === selectedTransactionTypeId);
    if (!transType) return;
    
    setValue('subject', transType.name, { shouldValidate: true });

    const template = templates.find(t => t.transactionTypes?.includes(transType.name));
    
    // Reset fields before populating
    replace([{ id: generateId(), description: '', quantity: 1, unitPrice: 0, condition: '' }]);
    setScopeOfWork([]);
    setTerms([]);
    setOpenClauses([]);
    setValue('notes', '');
    
    if (template) {
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

      const newItems = template.financials?.milestones?.map(milestone => ({
        id: milestone.id || generateId(),
        description: milestone.name,
        quantity: 1,
        unitPrice: milestone.value,
        condition: milestone.condition || '',
      })) || [];

      if (newItems.length > 0) {
        replace(newItems);
      }
    }
  }, [selectedTransactionTypeId, transactionTypes, templates, setValue, replace]);

  // Generate Quotation Number
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
  
  const departmentOptions = useMemo(() => departments.map(d => ({ value: d.id, label: d.name })), [departments]);
  const transactionTypeOptions = useMemo(() => transactionTypes.map(t => ({ value: t.id, label: t.name })), [transactionTypes]);

  const onSubmit = async (data: QuotationFormValues) => {
    if (!firestore || isGeneratingNumber) return;
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
            
            transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            const newQuotationNumber = `Q-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

            const newQuotationRef = doc(collection(firestore, 'quotations'));
            newQuotationId = newQuotationRef.id;
            const client = clients.find(c => c.id === data.clientId);
            const template = templates.find(t => t.transactionTypes?.includes(transactionTypes.find(tt => tt.id === data.transactionTypeId)?.name || ''));
            
            const processedItems = data.items.map(item => ({
                ...item,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                total: Number(item.quantity) * Number(item.unitPrice),
            }));

            transaction.set(newQuotationRef, {
                quotationNumber: newQuotationNumber,
                quotationSequence: nextNumber,
                quotationYear: currentYear,
                clientId: data.clientId,
                clientName: client?.nameAr || '',
                date: new Date(data.date),
                validUntil: new Date(data.validUntil),
                subject: data.subject,
                departmentId: data.departmentId,
                transactionTypeId: data.transactionTypeId,
                items: processedItems,
                totalAmount: totalAmount,
                notes: data.notes,
                status: 'draft',
                createdAt: serverTimestamp(),
                scopeOfWork: scopeOfWork,
                termsAndConditions: terms,
                openClauses: openClauses,
                templateDescription: template?.description || '',
            });
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
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        <Label>القسم <span className="text-destructive">*</span></Label>
                        <Controller control={control} name="departmentId"
                            render={({ field }) => (
                                <InlineSearchList value={field.value} onSelect={field.onChange} options={departmentOptions} placeholder={refDataLoading ? 'تحميل...' : 'اختر القسم...'} disabled={refDataLoading} />
                            )}
                        />
                        {errors.departmentId && <p className="text-xs text-destructive">{errors.departmentId.message}</p>}
                    </div>
                     <div className="grid gap-2">
                        <Label>نوع المعاملة <span className="text-destructive">*</span></Label>
                        <Controller control={control} name="transactionTypeId"
                            render={({ field }) => (
                                <InlineSearchList value={field.value} onSelect={field.onChange} options={transactionTypeOptions} placeholder={transactionTypesLoading ? 'تحميل...' : 'اختر نوع المعاملة...'} disabled={!selectedDepartmentId || transactionTypesLoading}/>
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
                        <Input id="date" type="date" {...register('date')} />
                        {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="validUntil">صالح حتى تاريخ <span className="text-destructive">*</span></Label>
                        <Input id="validUntil" type="date" {...register('validUntil')} />
                        {errors.validUntil && <p className="text-xs text-destructive">{errors.validUntil.message}</p>}
                    </div>
                </div>
                
                <div>
                    <Label className="mb-2 block">البنود</Label>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-2/5">الوصف</TableHead>
                                <TableHead className="w-1/6">الكمية</TableHead>
                                <TableHead className="w-1/6">سعر الوحدة</TableHead>
                                <TableHead className="w-1/6 text-left">الإجمالي</TableHead>
                                <TableHead className="w-[50px]"><span className="sr-only">حذف</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => {
                                const item = watchedItems[index];
                                const lineTotal = (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0);
                                return (
                                <TableRow key={field.id}>
                                    <TableCell>
                                        <Textarea {...register(`items.${index}.description`)} placeholder="وصف البند..."/>
                                        {errors.items?.[index]?.description && <p className="text-xs text-destructive mt-1">{errors.items?.[index]?.description?.message}</p>}
                                        {watchedItems[index]?.condition && (
                                            <div className="mt-2 text-xs text-muted-foreground p-2 bg-muted/50 rounded-md">
                                                <span className="font-semibold">شرط الاستحقاق:</span> {watchedItems[index].condition}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" {...register(`items.${index}.quantity`)} defaultValue={1} className="dir-ltr" />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" {...register(`items.${index}.unitPrice`)} defaultValue={0} className="dir-ltr" />
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
                                <TableCell className="font-bold font-mono text-lg text-left">{formatCurrency(totalAmount)}</TableCell>
                                <TableCell />
                            </TableRow>
                        </TableFooter>
                    </Table>
                     <div className="flex justify-start mt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ id: generateId(), description: '', quantity: 1, unitPrice: 0, condition: '' })}>
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إضافة بند
                        </Button>
                     </div>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="notes">ملاحظات إضافية (تحتوي على بنود العقد)</Label>
                    <Textarea id="notes" {...register('notes')} placeholder="شروط الدفع، معلومات الضمان، إلخ." rows={5}/>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>
                    <X className="ml-2 h-4 w-4"/> إلغاء
                </Button>
                <Button type="submit" disabled={isSaving || isGeneratingNumber}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                    حفظ كمسودة
                </Button>
            </CardFooter>
        </form>
    </Card>
  );
}

    