
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { Client, ClientTransaction, BoqItem, ContractClause } from '@/lib/types';
import { collection, doc, writeBatch, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Save, X, PlusCircle, Trash2 } from 'lucide-react';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const clauseSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "وصف الدفعة مطلوب."),
  amount: z.preprocess((a) => parseFloat(String(a || '0')), z.number().min(0, "المبلغ مطلوب.")),
});

const contractFormSchema = z.object({
  clauses: z.array(clauseSchema).min(1, 'يجب وجود دفعة واحدة على الأقل.'),
  totalAmount: z.number(),
});

type ContractFormValues = z.infer<typeof contractFormSchema>;

interface ContractFormProps {
    client: Client;
    transaction: ClientTransaction;
    onCancel: () => void;
}

export function ContractForm({ client, transaction, onCancel }: ContractFormProps) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [boqItems, setBoqItems] = useState<BoqItem[]>([]);
    const [loadingBoq, setLoadingBoq] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<ContractFormValues>({
        resolver: zodResolver(contractFormSchema),
    });

    const { fields, append, remove } = useFieldArray({ control, name: "clauses" });
    const watchedClauses = watch('clauses');

    const calculatedTotal = useMemo(() =>
        (watchedClauses || []).reduce((sum, clause) => sum + (Number(clause.amount) || 0), 0),
    [watchedClauses]);
    
    useEffect(() => {
        setValue('totalAmount', calculatedTotal);
    }, [calculatedTotal, setValue]);

    useEffect(() => {
        if (!firestore || !transaction) return;
        setLoadingBoq(true);
        const boqQuery = query(collection(firestore, `clients/${client.id}/transactions/${transaction.id!}/boq`), orderBy('itemNumber'));
        getDocs(boqQuery).then(snap => {
            const items = snap.docs.map(d => ({id: d.id, ...d.data()} as BoqItem));
            setBoqItems(items);
            
            // Pre-fill clauses from BOQ items
            if (items.length > 0) {
                const clausesFromBoq = items.map(item => ({
                    id: item.id!,
                    name: item.description,
                    amount: (item.plannedQuantity || 0) * (item.plannedUnitPrice || 0)
                }));
                setValue('clauses', clausesFromBoq);
            } else {
                 setValue('clauses', [{id: 'initial_clause', name: 'دفعة مقدمة', amount: 0}]);
            }
        }).catch(err => {
            console.error("Error fetching BOQ:", err);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحميل جدول الكميات.' });
        }).finally(() => setLoadingBoq(false));
    }, [firestore, client.id, transaction.id, setValue, toast]);
    
    const onSubmit = async (data: ContractFormValues) => {
        if (!firestore || !currentUser) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const transactionRef = doc(firestore, `clients/${client.id}/transactions/${transaction.id!}`);
            
            const contractData = {
                totalAmount: data.totalAmount,
                clauses: data.clauses.map(c => ({...c, status: 'غير مستحقة'})),
            };

            batch.update(transactionRef, { contract: contractData });
            
            const logContent = `أنشأ ${currentUser.fullName} العقد للمعاملة بقيمة إجمالية ${formatCurrency(data.totalAmount)}.`;
            const logData = {
                type: 'log' as const,
                content: logContent,
                userId: currentUser.id,
                userName: currentUser.fullName,
                userAvatar: currentUser.avatarUrl,
                createdAt: serverTimestamp()
            };
            const timelineRef = collection(transactionRef, 'timelineEvents');
            batch.set(doc(timelineRef), logData);
            
            await batch.commit();

            toast({ title: 'نجاح', description: 'تم إنشاء العقد بنجاح.' });
            router.push(`/dashboard/clients/${client.id}/transactions/${transaction.id!}`);

        } catch (error) {
            console.error("Error saving contract:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ العقد.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            {loadingBoq ? <Skeleton className="h-48 w-full" /> : (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>العميل:</Label><p className="font-semibold">{client.nameAr}</p></div>
                        <div><Label>المعاملة:</Label><p className="font-semibold">{transaction.transactionType}</p></div>
                    </div>
                    {boqItems.length > 0 && (
                        <Alert>
                            <AlertTitle>تم التعبئة من جدول الكميات</AlertTitle>
                            <AlertDescription>تم ملء الدفعات تلقائياً بناءً على جدول الكميات. يمكنك تعديلها حسب الحاجة.</AlertDescription>
                        </Alert>
                    )}
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader><TableRow><TableHead className="w-4/6">وصف الدفعة</TableHead><TableHead className="text-left">المبلغ</TableHead><TableHead/></TableRow></TableHeader>
                            <TableBody>
                                {fields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell><Controller name={`clauses.${index}.name`} control={control} render={({ field }) => <Input {...field} placeholder="مثال: الدفعة الأولى عند توقيع العقد" />} /></TableCell>
                                        <TableCell><Controller name={`clauses.${index}.amount`} control={control} render={({ field }) => <Input type="number" {...field} className="dir-ltr text-left" />} /></TableCell>
                                        <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter><TableRow className="bg-muted"><TableCell className="font-bold text-lg">الإجمالي</TableCell><TableCell colSpan={2} className="text-left font-bold font-mono text-lg">{formatCurrency(calculatedTotal)}</TableCell></TableRow></TableFooter>
                        </Table>
                        {errors.clauses && <p className="p-2 text-xs text-destructive">{errors.clauses.message || errors.clauses.root?.message}</p>}
                    </div>
                     <Button type="button" variant="outline" size="sm" onClick={() => append({ id: new Date().toISOString(), name: '', amount: 0 })}>
                        <PlusCircle className="ml-2 h-4"/> إضافة دفعة
                    </Button>
                    <div className="mt-6 pt-6 border-t flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>تغيير المعاملة</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="ml-2 h-4 animate-spin" /> : <Save className="ml-2 h-4" />}
                            حفظ العقد
                        </Button>
                    </div>
                </div>
            )}
        </form>
    );
}
