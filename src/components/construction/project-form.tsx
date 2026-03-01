
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import type { ConstructionProject, Client, Employee, ClientTransaction, ConstructionType } from '@/lib/types';
import { Loader2, Save, X, LayoutGrid } from 'lucide-react';
import { DialogFooter } from '../ui/dialog';
import { query, collection, getDocs, orderBy } from 'firebase/firestore';

const projectSchema = z.object({
  projectName: z.string().min(1, "اسم المشروع مطلوب."),
  clientId: z.string().min(1, "العميل مطلوب."),
  projectType: z.enum(['استشاري', 'تنفيذي', 'مختلط'], { required_error: "نوع المشروع مطلوب." }),
  constructionTypeId: z.string().optional().nullable(),
  contractValue: z.preprocess((a) => parseFloat(String(a || '0')), z.number().min(0, "قيمة العقد يجب أن تكون رقمًا موجبًا.")),
  startDate: z.date({ required_error: 'تاريخ البدء مطلوب.' }),
  endDate: z.date({ required_error: 'تاريخ الانتهاء مطلوب.' }),
  status: z.enum(['مخطط', 'قيد التنفيذ', 'مكتمل', 'معلق']),
  mainEngineerId: z.string().min(1, "المهندس الرئيسي مطلوب."),
  progressPercentage: z.preprocess((a) => parseInt(String(a || '0'), 10), z.number().min(0).max(100)),
  linkedTransactionId: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface ProjectFormProps {
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
  initialData?: Partial<ConstructionProject> | null;
  isSaving?: boolean;
}

export function ProjectForm({ onSave, onClose, initialData = null, isSaving = false }: ProjectFormProps) {
    const { firestore } = useFirebase();

    const { data: clients, loading: clientsLoading } = useSubscription<Client>(firestore, 'clients');
    const { data: engineers, loading: engineersLoading } = useSubscription<Employee>(firestore, 'employees');
    const { data: constructionTypes, loading: typesLoading } = useSubscription<ConstructionType>(firestore, 'construction_types', [orderBy('name')]);
    
    const [clientTransactions, setClientTransactions] = useState<ClientTransaction[]>([]);
    const [transactionsLoading, setTransactionsLoading] = useState(false);

    const { register, handleSubmit, control, watch, formState: { errors }, reset } = useForm<ProjectFormValues>({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            projectName: '',
            clientId: '',
            projectType: 'تنفيذي',
            constructionTypeId: '',
            contractValue: 0,
            startDate: new Date(),
            endDate: new Date(),
            status: 'مخطط',
            mainEngineerId: '',
            progressPercentage: 0,
            linkedTransactionId: '',
        }
    });

    const selectedClientId = watch('clientId');

    useEffect(() => {
        if (initialData) {
            reset({
                ...initialData,
                startDate: initialData.startDate?.toDate ? initialData.startDate.toDate() : new Date(),
                endDate: initialData.endDate?.toDate ? initialData.endDate.toDate() : new Date(),
            });
        }
    }, [initialData, reset]);

    useEffect(() => {
        if (selectedClientId && firestore) {
            setTransactionsLoading(true);
            const transactionsQuery = query(collection(firestore, `clients/${selectedClientId}/transactions`));
            getDocs(transactionsQuery).then(snapshot => {
                setClientTransactions(snapshot.docs.map(d => ({id: d.id, ...d.data()} as ClientTransaction)));
            }).finally(() => setTransactionsLoading(false));
        } else {
            setClientTransactions([]);
        }
    }, [selectedClientId, firestore]);
    
    const clientOptions = useMemo(() => (clients || []).map(c => ({ value: c.id!, label: c.nameAr })), [clients]);
    const engineerOptions = useMemo(() => (engineers || []).filter(e=> e.jobTitle?.includes('مهندس')).map(e => ({ value: e.id!, label: e.fullName })), [engineers]);
    const transactionOptions = useMemo(() => clientTransactions.map(t => ({value: t.id!, label: `${t.transactionNumber} - ${t.transactionType}`})), [clientTransactions]);
    const constructionTypeOptions = useMemo(() => constructionTypes.map(t => ({ value: t.id!, label: t.name })), [constructionTypes]);

    const loadingRefs = clientsLoading || engineersLoading || typesLoading;

    const onSubmit = (data: ProjectFormValues) => {
        const client = clients.find(c => c.id === data.clientId);
        const engineer = engineers.find(e => e.id === data.mainEngineerId);
        const cType = constructionTypes.find(t => t.id === data.constructionTypeId);
        
        onSave({ 
            ...data, 
            clientName: client?.nameAr, 
            mainEngineerName: engineer?.fullName,
            constructionTypeName: cType?.name || null
        });
    };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-6 py-4 px-1 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="projectName">اسم المشروع <span className="text-destructive">*</span></Label>
                    <Input id="projectName" {...register('projectName')} disabled={isSaving} />
                    {errors.projectName && <p className="text-xs text-destructive">{errors.projectName.message}</p>}
                </div>
                <div className="grid gap-2">
                    <Label>العميل <span className="text-destructive">*</span></Label>
                    <Controller control={control} name="clientId" render={({ field }) => (
                        <InlineSearchList value={field.value} onSelect={field.onChange} options={clientOptions} placeholder={loadingRefs ? "تحميل..." : "اختر عميلاً..."} disabled={loadingRefs || isSaving} />
                    )} />
                    {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
                </div>
            </div>

            <div className="p-4 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20 space-y-4">
                <div className="flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-primary" />
                    <Label className="font-black text-primary">قالب سير عمل المشروع</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>نوع المقاولات (Standard)</Label>
                        <Controller control={control} name="constructionTypeId" render={({ field }) => (
                            <InlineSearchList 
                                value={field.value || ''} 
                                onSelect={field.onChange} 
                                options={constructionTypeOptions} 
                                placeholder="اختر نوع المشروع لاستنساخ مراحله..." 
                                disabled={loadingRefs || isSaving || isEditing} 
                            />
                        )} />
                        <p className="text-[10px] text-muted-foreground italic">سيقوم النظام آلياً باستنساخ شجرة المراحل المعتمدة لهذا النوع فور الحفظ.</p>
                    </div>
                    <div className="grid gap-2">
                        <Label>ربط بمعاملة (اختياري)</Label>
                        <Controller control={control} name="linkedTransactionId" render={({ field }) => (
                            <InlineSearchList value={field.value || ''} onSelect={field.onChange} options={transactionOptions} placeholder={!selectedClientId ? "اختر عميلاً أولاً" : transactionsLoading ? "تحميل..." : "اختر معاملة..."} disabled={!selectedClientId || transactionsLoading || isSaving} />
                        )} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="grid gap-2">
                    <Label>المهندس الرئيسي <span className="text-destructive">*</span></Label>
                    <Controller control={control} name="mainEngineerId" render={({ field }) => (
                        <InlineSearchList value={field.value} onSelect={field.onChange} options={engineerOptions} placeholder={loadingRefs ? "تحميل..." : "اختر مهندسًا..."} disabled={loadingRefs || isSaving} />
                    )} />
                    {errors.mainEngineerId && <p className="text-xs text-destructive">{errors.mainEngineerId.message}</p>}
                </div>
                <div className="grid gap-2">
                    <Label>نوع المشروع</Label>
                     <Controller name="projectType" control={control} render={({field}) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent><SelectItem value="تنفيذي">تنفيذي</SelectItem><SelectItem value="استشاري">استشاري</SelectItem><SelectItem value="مختلط">مختلط</SelectItem></SelectContent>
                        </Select>
                     )}/>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="contractValue">قيمة العقد الإجمالية</Label>
                    <Input id="contractValue" type="number" step="0.001" {...register('contractValue')} disabled={isSaving} className="font-mono" />
                </div>
                <div className="grid gap-2">
                    <Label>الحالة</Label>
                    <Controller name="status" control={control} render={({field}) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent><SelectItem value="مخطط">مخطط</SelectItem><SelectItem value="قيد التنفيذ">قيد التنفيذ</SelectItem><SelectItem value="مكتمل">مكتمل</SelectItem><SelectItem value="معلق">معلق</SelectItem></SelectContent>
                        </Select>
                    )}/>
                </div>
                <div className="grid gap-2">
                    <Label>نسبة الإنجاز الحالي (%)</Label>
                    <Input type="number" min="0" max="100" {...register('progressPercentage')} disabled={isSaving} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="grid gap-2">
                    <Label>تاريخ البدء</Label>
                     <Controller name="startDate" control={control} render={({ field }) => (<DateInput value={field.value} onChange={field.onChange} disabled={isSaving} />)}/>
                     {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
                </div>
                <div className="grid gap-2">
                    <Label>تاريخ الانتهاء المتوقع</Label>
                    <Controller name="endDate" control={control} render={({ field }) => (<DateInput value={field.value} onChange={field.onChange} disabled={isSaving} />)}/>
                    {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
                </div>
            </div>
        </div>
        <DialogFooter className="mt-6 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
            <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                {isSaving ? 'جاري الحفظ واستنساخ المراحل...' : 'حفظ المشروع'}
            </Button>
        </DialogFooter>
    </form>
  )
}
