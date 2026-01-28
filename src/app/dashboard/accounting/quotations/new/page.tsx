'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import type { Client, QuotationItem, ContractTemplate } from '@/lib/types';
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
});

const quotationSchema = z.object({
  clientId: z.string().min(1, 'العميل مطلوب.'),
  subject: z.string().min(1, 'الموضوع مطلوب.'),
  date: z.string().min(1, 'تاريخ عرض السعر مطلوب.'),
  validUntil: z.string().min(1, 'تاريخ انتهاء الصلاحية مطلوب.'),
  items: z.array(itemSchema).min(1, 'يجب إضافة بند واحد على الأقل.'),
  notes: z.string().optional(),
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
  const [clientsLoading, setClientsLoading] = useState(true);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  // Form-related states
  const [quotationNumber, setQuotationNumber] = useState('جاري التوليد...');
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');


  const { register, handleSubmit, control, formState: { errors }, watch, setValue, reset } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    mode: 'onChange',
    defaultValues: {
      clientId: clientIdFromUrl || '',
      date: new Date().toISOString().split('T')[0],
      validUntil: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
      items: [{ id: generateId(), description: '', quantity: 1, unitPrice: 0 }],
      notes: '',
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = watch("items");

  const totalAmount = useMemo(() =>
    (watchedItems || []).reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0),
  [watchedItems]);


  // Fetch clients and templates
  useEffect(() => {
    if (!firestore) return;
    const fetchRefData = async () => {
      setClientsLoading(true);
      setTemplatesLoading(true);
      try {
        const clientsQuery = query(collection(firestore, 'clients'), orderBy('nameAr'));
        const templatesQuery = query(collection(firestore, 'contractTemplates'), orderBy('title'));

        const [clientsSnapshot, templatesSnapshot] = await Promise.all([
            getDocs(clientsQuery),
            getDocs(templatesQuery)
        ]);

        const fetchedClients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        setClients(fetchedClients);
        
        const fetchedTemplates = templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate));
        setTemplates(fetchedTemplates);

      } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات المرجعية.' });
      } finally {
        setClientsLoading(false);
        setTemplatesLoading(false);
      }
    };
    fetchRefData();
  }, [firestore, toast]);
  
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

  // Handle template selection
  useEffect(() => {
    const template = templates.find(t => t.id === selectedTemplateId);
    if (template) {
      setValue('subject', template.title, { shouldValidate: true });

      const notesParts: string[] = [];
      if (template.description) {
        notesParts.push(`**ملخص:**\n${template.description}`);
      }

      if (template.scopeOfWork && template.scopeOfWork.length > 0) {
          notesParts.push(`\n**نطاق العمل:**\n${template.scopeOfWork.map((item, index) => `${index + 1}. ${item.title}: ${item.description || ''}`).join('\n')}`);
      }
      
      if (template.termsAndConditions && template.termsAndConditions.length > 0) {
          notesParts.push(`\n**الشروط والأحكام:**\n${template.termsAndConditions.map(term => `- ${term.text}`).join('\n')}`);
      }
      
      if (template.openClauses && template.openClauses.length > 0) {
          notesParts.push(`\n**بنود إضافية:**\n${template.openClauses.map(clause => `- ${clause.text}`).join('\n')}`);
      }
      
      setValue('notes', notesParts.join('\n\n'), { shouldValidate: true });


      const newItems = template.financials?.milestones?.map(milestone => ({
        id: milestone.id || generateId(),
        description: milestone.name,
        quantity: 1,
        unitPrice: milestone.value,
      })) || [];

      if (newItems.length > 0) {
        replace(newItems);
      } else {
        replace([{ id: generateId(), description: '', quantity: 1, unitPrice: 0 }]);
      }
    }
  }, [selectedTemplateId, templates, replace, setValue]);
  
  const clientOptions = useMemo(() =>
    clients.map(c => ({ value: c.id, label: c.nameAr, searchKey: c.mobile }))
  , [clients]);
  
  const templateOptions = useMemo(() =>
    templates.map(t => ({ value: t.id!, label: t.title }))
  , [templates]);

  const onSubmit = async (data: QuotationFormValues) => {
    if (!firestore || isGeneratingNumber) return;
    setIsSaving(true);
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
            const client = clients.find(c => c.id === data.clientId);
            
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
                items: processedItems,
                totalAmount: totalAmount,
                notes: data.notes,
                status: 'draft',
                createdAt: serverTimestamp(),
            });
        });
        
        toast({ title: 'نجاح', description: 'تم حفظ عرض السعر كمسودة.' });
        router.push('/dashboard/accounting/quotations');

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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-2">
                        <Label>العميل <span className="text-destructive">*</span></Label>
                        <Controller
                            control={control}
                            name="clientId"
                            render={({ field }) => (
                                <InlineSearchList
                                    value={field.value}
                                    onSelect={field.onChange}
                                    options={clientOptions}
                                    placeholder={clientsLoading ? 'تحميل...' : 'ابحث عن عميل...'}
                                    disabled={clientsLoading || !!clientIdFromUrl}
                                />
                            )}
                        />
                        {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label>استيراد من نموذج عقد (اختياري)</Label>
                        <InlineSearchList
                            value={selectedTemplateId}
                            onSelect={setSelectedTemplateId}
                            options={[{value: '', label: '-- بدون نموذج --'}, ...templateOptions]}
                            placeholder={templatesLoading ? 'تحميل النماذج...' : 'ابحث عن نموذج عقد...'}
                            disabled={templatesLoading}
                        />
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
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ id: generateId(), description: '', quantity: 1, unitPrice: 0 })}>
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إضافة بند
                        </Button>
                     </div>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="notes">ملاحظات إضافية</Label>
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
