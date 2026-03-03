
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { 
  Save, 
  Loader2, 
  Target, 
  Calculator,
  ShieldCheck,
  ArrowDownCircle
} from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import {
  collection,
  runTransaction,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import type { ConstructionProject, BoqItem, Account, PaymentApplication, InventoryAdjustment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { formatCurrency, cleanFirestoreData, numberToArabicWords } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { DateInput } from '@/components/ui/date-input';
import { Separator } from '../ui/separator';

const itemSchema = z.object({
  boqItemId: z.string(),
  description: z.string(),
  unit: z.string(),
  unitPrice: z.number(),
  previousQuantity: z.number().default(0),
  currentQuantity: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  plannedQuantity: z.number(),
});

const applicationSchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  projectId: z.string().min(1, 'يجب اختيار المشروع.'),
  items: z.array(itemSchema).min(1, 'يجب إضافة بند واحد على الأقل للمطالبة.'),
});

type ApplicationFormValues = z.infer<typeof applicationSchema>;

export function PaymentApplicationForm({ onClose }: { onClose: () => void }) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [isSaving, setIsSaving] = useState(false);
  const [appNumber, setAppNumber] = useState('جاري التوليد...');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [subsidizedMaterialsValue, setSubsidizedMaterialsValue] = useState(0);

  const { data: projects = [] } = useSubscription<ConstructionProject>(firestore, 'projects', [where('status', '==', 'قيد التنفيذ')]);

  const { handleSubmit, control, watch, formState: { errors }, setValue } = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: { date: new Date(), items: [] }
  });

  const { fields, replace } = useFieldArray({ control, name: 'items' });
  const selectedProjectId = watch('projectId');
  const watchedItems = useWatch({ control, name: "items" });

  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !firestore || !selectedProject?.boqId) return;

    const loadData = async () => {
      setLoadingHistory(true);
      try {
        const [boqItemsSnap, prevAppsSnap, subsidyIssuesSnap] = await Promise.all([
            getDocs(query(collection(firestore, `boqs/${selectedProject.boqId}/items`), orderBy('itemNumber'))),
            getDocs(query(collection(firestore, 'payment_applications'), where('projectId', '==', selectedProjectId), where('status', 'in', ['approved', 'paid']))),
            getDocs(query(collection(firestore, 'grns'), where('projectId', '==', selectedProjectId), where('isSubsidy', '==', true)))
        ]);

        const previousTotals = new Map<string, number>();
        prevAppsSnap.forEach(doc => {
            const app = doc.data() as PaymentApplication;
            app.items.forEach(item => {
                const current = previousTotals.get(item.boqItemId) || 0;
                previousTotals.set(item.boqItemId, current + (item.currentQuantity || 0));
            });
        });

        // حساب قيمة المواد المدعومة المستلمة والتي لم تخصم بعد من مستخلص سابق
        const alreadySubtractedValue = prevAppsSnap.docs.reduce((sum, doc) => sum + (doc.data().subsidizedMaterialsValue || 0), 0);
        const totalReceivedSubsidy = subsidyIssuesSnap.docs.reduce((sum, doc) => sum + (doc.data().totalValue || 0), 0);
        
        setSubsidizedMaterialsValue(Math.max(0, totalReceivedSubsidy - alreadySubtractedValue));

        const appItems = boqItemsSnap.docs
            .map(doc => {
                const item = doc.data() as BoqItem;
                const prevQty = previousTotals.get(doc.id) || 0;
                return {
                    boqItemId: doc.id, description: item.description, unit: item.unit || 'مقطوعية',
                    unitPrice: item.sellingUnitPrice || 0, previousQuantity: prevQty, currentQuantity: 0,
                    plannedQuantity: item.quantity, isHeader: item.isHeader
                };
            })
            .filter(i => !i.isHeader && i.previousQuantity < i.plannedQuantity);

        replace(appItems);
      } catch (e) { console.error(e); } finally { setLoadingHistory(false); }
    };
    loadData();
  }, [selectedProjectId, firestore, selectedProject, replace]);

  useEffect(() => {
    if (!firestore || !selectedProjectId) return;
    const counterRef = doc(firestore, 'counters', 'paymentApplications');
    getDoc(counterRef).then(doc => {
        const nextNumber = ((doc.data()?.counts || {})[new Date().getFullYear()] || 0) + 1;
        setAppNumber(`APP-${new Date().getFullYear()}-${String(nextNumber).padStart(4, '0')}`);
    });
    getDocs(query(collection(firestore, 'chartOfAccounts'))).then(snap => setAccounts(snap.docs.map(d => ({id: d.id, ...d.data()} as Account))));
  }, [firestore, selectedProjectId]);

  const grossAmount = useMemo(() => (watchedItems || []).reduce((sum, item) => sum + (Number(item.currentQuantity) || 0) * (item.unitPrice || 0), 0), [watchedItems]);
  const netDueAmount = Math.max(0, grossAmount - subsidizedMaterialsValue);

  const onSubmit = async (data: ApplicationFormValues) => {
    if (!firestore || !currentUser || !selectedProject) return;
    setIsSaving(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'paymentApplications');
            const counterDoc = await transaction.get(counterRef);
            const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
            const finalAppNumber = `APP-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

            const newAppRef = doc(collection(firestore, 'payment_applications'));
            const newJeRef = doc(collection(firestore, 'journalEntries'));

            const clientSnap = await transaction.get(doc(firestore, 'clients', selectedProject.clientId));
            const clientName = clientSnap.exists() ? clientSnap.data().nameAr : 'عميل غير معروف';

            const appData = {
                applicationNumber: finalAppNumber, date: data.date, projectId: data.projectId,
                clientId: selectedProject.clientId, clientName, projectName: selectedProject.projectName,
                items: data.items.filter(i => i.currentQuantity > 0),
                totalAmount: grossAmount, subsidizedMaterialsValue, netDueAmount,
                status: 'draft', journalEntryId: newJeRef.id, createdAt: serverTimestamp(), createdBy: currentUser.id,
            };

            const revenueAccount = accounts.find(a => a.code === '4101');
            const clientAccount = accounts.find(a => a.name === clientName && a.parentCode === '1102');

            if (revenueAccount && clientAccount) {
                transaction.set(newJeRef, {
                    entryNumber: `JE-${finalAppNumber}`, date: data.date,
                    narration: `إثبات مستخلص #${finalAppNumber} (صافي بعد خصم المدعوم) - مشروع: ${selectedProject.projectName}`,
                    status: 'draft', totalDebit: netDueAmount, totalCredit: netDueAmount,
                    lines: [
                        { accountId: clientAccount.id!, accountName: clientName, debit: netDueAmount, credit: 0, auto_profit_center: data.projectId },
                        { accountId: revenueAccount.id!, accountName: revenueAccount.name, debit: 0, credit: netDueAmount, auto_profit_center: data.projectId }
                    ],
                    clientId: selectedProject.clientId, transactionId: data.projectId, createdAt: serverTimestamp(), createdBy: currentUser.id,
                });
            }

            transaction.set(newAppRef, cleanFirestoreData(appData));
            transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
        });
        toast({ title: 'نجاح', description: 'تم إصدار المستخلص بانتظار المراجعة.' });
        router.push(`/dashboard/construction/projects/${selectedProjectId}`);
    } catch (e: any) { toast({ variant: 'destructive', title: 'خطأ', description: e.message }); } finally { setIsSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/30 p-6 rounded-2xl border">
        <div className="grid gap-2"><Label className="font-bold">المشروع المستهدف *</Label><Controller control={control} name="projectId" render={({ field }) => (<InlineSearchList value={field.value} onSelect={field.onChange} options={projects.map(p => ({ value: p.id!, label: p.projectName }))} placeholder="اختر المشروع..." disabled={isSaving}/>)}/></div>
        <div className="grid gap-2"><Label className="font-bold">رقم المستخلص</Label><Input value={appNumber} disabled className="font-mono font-bold" /></div>
        <div className="grid gap-2"><Label className="font-bold">تاريخ المستخلص</Label><Controller name="date" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} disabled={isSaving}/>}/></div>
      </div>

      {fields.length > 0 ? (
        <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-card">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="h-14 border-b-2">
                <TableHead className="px-6 font-bold">بيان الأعمال (BOQ)</TableHead>
                <TableHead className="text-center font-bold">منفذ سابقاً</TableHead>
                <TableHead className="text-center font-bold bg-primary/5 text-primary">الكمية الحالية</TableHead>
                <TableHead className="text-left px-8 font-bold">المبلغ المستحق (قبل الخصم)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => {
                const item = watchedItems?.[index];
                return (
                  <TableRow key={field.id} className="h-16 border-b last:border-0">
                    <TableCell className="px-6 font-bold">{item?.description}</TableCell>
                    <TableCell className="text-center font-mono">{item?.previousQuantity || 0}</TableCell>
                    <TableCell className="bg-primary/[0.02] py-2"><Input type="number" step="any" {...register(`items.${index}.currentQuantity`)} className="text-center font-black text-xl w-28 h-10 rounded-xl border-2 border-primary/20 mx-auto"/></TableCell>
                    <TableCell className="text-left font-mono font-black text-lg px-8">{formatCurrency((Number(item?.currentQuantity) || 0) * (item?.unitPrice || 0))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter className="bg-muted/30">
              <TableRow className="h-16">
                <TableCell colSpan={3} className="text-right px-12 font-bold">إجمالي الأعمال المنجزة (Gross):</TableCell>
                <TableCell className="text-left font-mono text-xl font-bold px-8">{formatCurrency(grossAmount)}</TableCell>
              </TableRow>
              {subsidizedMaterialsValue > 0 && (
                <TableRow className="h-16 text-orange-700 bg-orange-50/50">
                    <TableCell colSpan={3} className="text-right px-12 font-black flex items-center justify-end gap-2">
                        <ArrowDownCircle className="h-5 w-5" /> خصم قيمة المواد المدعومة المستلمة للمشروع (-):
                    </TableCell>
                    <TableCell className="text-left font-mono text-xl font-black px-8">({formatCurrency(subsidizedMaterialsValue)})</TableCell>
                </TableRow>
              )}
              <TableRow className="h-24 bg-primary/5 border-t-4 border-primary/20">
                <TableCell colSpan={3} className="text-right px-12 font-black text-2xl text-primary">صافي المطالبة المالية الحالية:</TableCell>
                <TableCell className="text-left font-mono text-3xl font-black text-primary px-8">{formatCurrency(netDueAmount)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : selectedProjectId && <div className="p-20 text-center border-2 border-dashed rounded-[3rem] bg-muted/5 font-bold italic">لا توجد بنود متاحة للفوترة حالياً.</div>}

      <div className="flex justify-end gap-4 p-8 border-t">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
        <Button onClick={handleSubmit(onSubmit)} disabled={isSaving || fields.length === 0} className="h-12 px-16 rounded-xl font-black text-lg shadow-xl shadow-primary/20">
          {isSaving ? <Loader2 className="animate-spin ml-3 h-6 w-6" /> : <Save className="ml-3 h-6 w-6" />} حفظ وإصدار المستخلص الصافي
        </Button>
      </div>
    </form>
  );
}
