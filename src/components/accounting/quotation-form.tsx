'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Save, X, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import type { Client, Quotation, QuotationItem, ContractTemplate, ContractScopeItem, ContractTerm, TransactionType, WorkStage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toFirestoreDate } from '@/services/date-converter';
import { collection, getDocs, query, collectionGroup, orderBy, where, limit } from 'firebase/firestore';

const generateId = () => Math.random().toString(36).substring(2, 9);

const itemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, "الوصف مطلوب"),
  quantity: z.preprocess((v) => parseFloat(String(v || '1')), z.number().min(0.01)),
  unitPrice: z.preprocess(v => parseFloat(String(v || '0')), z.number().min(0)).optional(),
  percentage: z.preprocess(v => parseFloat(String(v || '0')), z.number().min(0)).optional(),
  condition: z.string().optional(),
  total: z.number().optional(), // Added for calculation
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
  scopeOfWork: z.array(z.any()).optional(),
  termsAndConditions: z.array(z.any()).optional(),
  openClauses: z.array(z.any()).optional(),
  templateDescription: z.string().optional(),
});


type QuotationFormValues = z.infer<typeof quotationSchema>;

interface QuotationFormProps {
    onSave: (data: any) => Promise<void>;
    onClose: () => void;
    initialData?: Partial<Quotation> | null;
    isSaving?: boolean;
}

export function QuotationForm({ onSave, onClose, initialData = null, isSaving = false }: QuotationFormProps) {
  const isEditing = !!initialData;
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [allTransactionTypes, setAllTransactionTypes] = useState<any[]>([]);
  const [allTemplates, setAllTemplates] = useState<ContractTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(true);

  const { register, handleSubmit, control, formState: { errors }, watch, setValue, reset } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");
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
        fetchedClients.sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));
        setClients(fetchedClients);
        
        setAllTemplates(templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate)));
        setAllTransactionTypes(transTypesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));

      } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات المرجعية.' });
      } finally {
        setRefDataLoading(false);
      }
    };
    fetchRefData();
  }, [firestore, toast]);
  
  const populateFormFromTemplate = useCallback((template: ContractTemplate | null) => {
    if (template) {
      setValue('financialsType', template.financials?.type || 'fixed');
      setValue('totalAmount', template.financials?.totalAmount || 0);

      const notesParts: string[] = [];
      if (template.description) {
        notesParts.push(`**ملخص:**\n${template.description}`);
      }
      setValue('templateDescription', template.description || '');
      
      const scope = template.scopeOfWork || [];
      setValue('scopeOfWork', scope);
      if (scope.length > 0) {
          notesParts.push(`\n**نطاق العمل:**\n${scope.map((item, index) => `${index + 1}. ${item.title}: ${item.description || ''}`).join('\n')}`);
      }

      const terms = template.termsAndConditions || [];
      setValue('termsAndConditions', terms);
      if (terms.length > 0) {
          notesParts.push(`\n**الشروط والأحكام:**\n${terms.map(term => `- ${term.text}`).join('\n')}`);
      }
      
      const open = template.openClauses || [];
      setValue('openClauses', open);
      if (open.length > 0) {
          notesParts.push(`\n**بنود إضافية:**\n${open.map(clause => `- ${clause.text}`).join('\n')}`);
      }
      
      setValue('notes', notesParts.join('\n\n'));

      const newItems = template.financials?.milestones?.map(milestone => {
        const isPercentage = template.financials?.type === 'percentage';
        const value = Number(milestone.value || 0);
        return {
          id: milestone.id || generateId(),
          description: milestone.name,
          quantity: 1,
          unitPrice: isPercentage ? 0 : value,
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
        setValue('templateDescription', '');
        setValue('scopeOfWork', []);
        setValue('termsAndConditions', []);
        setValue('openClauses', []);
        setValue('notes', '');
        replace([{ id: generateId(), description: '', quantity: 1, unitPrice: 0, percentage: 0, condition: '' }]);
    }
  }, [replace, setValue]);


  const selectedTransactionTypeId = watch("transactionTypeId");
  useEffect(() => {
    if (isEditing) return; // Don't auto-change template on edit
    if (!selectedTransactionTypeId || allTransactionTypes.length === 0 || allTemplates.length === 0) return;

    const transType = allTransactionTypes.find(t => t.id === selectedTransactionTypeId);
    if (!transType) return;
    
    setValue('subject', transType.name);
    
    const matchingTemplates = allTemplates.filter(t => t.transactionTypes?.includes(transType.name));
    
    // Simplified logic: just pick the first one if it exists
    const templateToUse = matchingTemplates.length > 0 ? matchingTemplates[0] : null;
    populateFormFromTemplate(templateToUse);
    
    if (transType.departmentIds && transType.departmentIds.length > 0) {
        setValue('departmentId', transType.departmentIds[0]);
    }
  }, [isEditing, selectedTransactionTypeId, allTransactionTypes, allTemplates, setValue, populateFormFromTemplate]);

  useEffect(() => {
    if (initialData) {
      reset({
        ...initialData,
        date: toFirestoreDate(initialData.date) || new Date(),
        validUntil: toFirestoreDate(initialData.validUntil) || new Date(),
        items: initialData.items?.map(item => ({
            ...item,
            unitPrice: item.unitPrice || 0,
            percentage: item.percentage || 0,
        })) || [],
      });
    }
  }, [initialData, reset]);

  const clientOptions = useMemo(() => clients.map(c => ({ value: c.id, label: c.nameAr, searchKey: c.mobile })), [clients]);
  const transactionTypeOptions = useMemo(() => allTransactionTypes.map(t => ({ value: t.id, label: t.name })), [allTransactionTypes]);
  
  const onSubmit = (data: QuotationFormValues) => {
    const processedItems = data.items.map(item => {
        const isPercentage = data.financialsType === 'percentage';
        const percentage = Number(item.percentage || 0);
        const unitPrice = isPercentage 
            ? 0
            : Number(item.unitPrice || 0);
        const total = isPercentage
            ? (percentage / 100) * (data.totalAmount || 0)
            : unitPrice * (Number(item.quantity) || 1);
        
        return { ...item, unitPrice, percentage, total };
    });
    
    onSave({ ...data, items: processedItems });
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-6 py-4 px-1 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid gap-2">
                  <Label>العميل <span className="text-destructive">*</span></Label>
                  <Controller
                      control={control} name="clientId"
                      render={({ field }) => (
                          <InlineSearchList value={field.value} onSelect={field.onChange} options={clientOptions} placeholder={refDataLoading ? 'تحميل...' : 'ابحث عن عميل...'} disabled={refDataLoading || isEditing} />
                      )}
                  />
                  {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
              </div>
               <div className="grid gap-2">
                  <Label>نوع المعاملة <span className="text-destructive">*</span></Label>
                  <Controller control={control} name="transactionTypeId"
                      render={({ field }) => (
                          <InlineSearchList value={field.value} onSelect={field.onChange} options={transactionTypeOptions} placeholder={refDataLoading ? 'تحميل...' : 'اختر نوع المعاملة...'} disabled={refDataLoading || isEditing}/>
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
      </div>
      <DialogFooter className="mt-6 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
          <Button type="submit" disabled={isSaving || refDataLoading}>
              {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
              {isSaving ? 'جاري الحفظ...' : 'حفظ'}
          </Button>
      </DialogFooter>
    </form>
  )
}
