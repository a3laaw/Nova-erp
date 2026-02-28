
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Save, X, PlusCircle, Trash2, FileStack, Target, Box } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, addDoc, doc, getDoc, serverTimestamp, orderBy, query, runTransaction } from 'firebase/firestore';
import type { Item, ConstructionProject } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { cleanFirestoreData } from '@/lib/utils';

const itemSchema = z.object({
  internalItemId: z.string().min(1, "يجب اختيار صنف."),
  itemName: z.string(),
  quantity: z.preprocess((v) => parseFloat(String(v || '0')), z.number().positive("الكمية مطلوبة")),
  notes: z.string().optional(),
});

const prSchema = z.object({
  projectId: z.string().min(1, "يجب تحديد المشروع أو القسم الطالب."),
  items: z.array(itemSchema).min(1, "يجب إضافة بند واحد على الأقل."),
});

type PrFormValues = z.infer<typeof prSchema>;

const generateStableId = () => Math.random().toString(36).substring(2, 15);

export function PurchaseRequestForm({ onClose }: { onClose: () => void }) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [isSaving, setIsSaving] = useState(false);
    const [requestNumber, setRequestNumber] = useState('جاري التوليد...');

    const { data: items = [], loading: itemsLoading } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    const { data: projects = [], loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, 'projects', [where('status', '==', 'قيد التنفيذ')]);

    const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<PrFormValues>({
        resolver: zodResolver(prSchema),
        defaultValues: { items: [{ internalItemId: '', itemName: '', quantity: 1, notes: '' }] }
    });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });
    const watchedItems = useWatch({ control, name: "items" });

    useEffect(() => {
        if (!firestore) return;
        const generateNumber = async () => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'purchaseRequests');
            const counterDoc = await getDoc(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            setRequestNumber(`PR-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
        };
        generateNumber();
    }, [firestore]);

    const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: p.projectName })), [projects]);
    const itemOptions = useMemo(() => items.map(i => ({ value: i.id!, label: i.name, searchKey: i.sku })), [items]);

    const onSubmit = async (data: PrFormValues) => {
        if (!firestore || !currentUser) return;
        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'purchaseRequests');
                const counterDoc = await transaction.get(counterRef);
                const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const finalNumber = `PR-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

                const newRequestRef = doc(collection(firestore, 'purchase_requests'));
                
                transaction.set(newRequestRef, cleanFirestoreData({
                    requestNumber: finalNumber,
                    date: serverTimestamp(),
                    projectId: data.projectId,
                    requesterId: currentUser.id,
                    requesterName: currentUser.fullName,
                    items: data.items,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                }));

                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });

            toast({ title: 'تم إرسال الطلب', description: 'تم تسجيل طلب الشراء بانتظار موافقة الإدارة.' });
            router.push('/dashboard/purchasing/requests');
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إرسال الطلب.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="grid gap-3">
                    <Label className="font-black text-lg text-primary flex items-center gap-2">
                        <Target className="h-5 w-5" /> المشروع الطالب *
                    </Label>
                    <Controller
                        control={control}
                        name="projectId"
                        render={({ field }) => (
                            <InlineSearchList 
                                value={field.value} 
                                onSelect={field.onChange} 
                                options={projectOptions}
                                placeholder={projectsLoading ? "جاري التحميل..." : "اختر المشروع..."}
                                className="h-12 rounded-2xl border-2"
                            />
                        )}
                    />
                    {errors.projectId && <p className="text-xs text-destructive font-bold">{errors.projectId.message}</p>}
                </div>
                <div className="text-left bg-primary/5 px-6 py-4 rounded-3xl border-2 border-primary/10 shadow-inner">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">رقم الطلب المرجعي</Label>
                    <div className="font-mono text-2xl font-black text-primary">{requestNumber}</div>
                </div>
            </div>

            <div className="space-y-4">
                <Label className="text-xl font-black flex items-center gap-2">
                    <Box className="h-5 w-5 text-primary" /> الأصناف والكميات المطلوبة
                </Label>
                <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-card">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="h-14">
                                <TableHead className="w-[60px]"></TableHead>
                                <TableHead className="font-bold text-base">المادة / الصنف</TableHead>
                                <TableHead className="w-32 text-center font-bold text-base">الكمية</TableHead>
                                <TableHead className="font-bold text-base">ملاحظات إضافية</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => (
                                <TableRow key={field.id} className="h-16 border-b last:border-0 hover:bg-muted/5 transition-colors">
                                    <TableCell className="text-center">
                                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="text-destructive rounded-full"><Trash2 className="h-4 w-4"/></Button>
                                    </TableCell>
                                    <TableCell>
                                        <Controller
                                            name={`items.${index}.internalItemId`}
                                            control={control}
                                            render={({ field: itemField }) => (
                                                <InlineSearchList 
                                                    value={itemField.value} 
                                                    onSelect={(val) => {
                                                        itemField.onChange(val);
                                                        const i = items.find(it => it.id === val);
                                                        if (i) setValue(`items.${index}.itemName`, i.name);
                                                    }} 
                                                    options={itemOptions}
                                                    placeholder="ابحث عن مادة..."
                                                    className="border-none shadow-none focus-visible:ring-0 text-lg font-bold bg-transparent"
                                                />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" step="any" {...register(`items.${index}.quantity`)} className="text-center font-black text-xl border-none focus-visible:ring-0" />
                                    </TableCell>
                                    <TableCell>
                                        <Input {...register(`items.${index}.notes`)} placeholder="مثال: توريد عاجل..." className="border-none focus-visible:ring-0 text-sm" />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <Button type="button" variant="outline" onClick={() => append({ internalItemId: '', itemName: '', quantity: 1, notes: '' })} className="w-full h-12 border-dashed border-2 rounded-2xl gap-2 font-bold hover:bg-primary/5 hover:border-primary/50 transition-all">
                    <PlusCircle className="h-5 w-5 text-primary" /> إضافة بند إضافي
                </Button>
            </div>

            <div className="flex justify-end gap-4 pt-8 border-t">
                <Button type="button" variant="ghost" onClick={onClose} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
                <Button type="submit" disabled={isSaving} className="h-12 px-16 rounded-xl font-black text-lg shadow-xl shadow-primary/20">
                    {isSaving ? <><Loader2 className="ml-3 h-5 w-5 animate-spin"/> جاري الإرسال...</> : <><Save className="ml-3 h-5 w-5"/> تقديم طلب الشراء</>}
                </Button>
            </div>
        </form>
    );
}
