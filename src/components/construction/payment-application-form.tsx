
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
  FileText, 
  Target, 
  Calculator,
  X,
  History,
  AlertTriangle
} from 'lucide-react';
import { useFirebase, useSubscription, useDocument } from '@/firebase';
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
  Timestamp,
} from 'firebase/firestore';
import type { ConstructionProject, Boq, BoqItem, Account, PaymentApplication } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const itemSchema = z.object({
  boqItemId: z.string(),
  description: z.string(),
  unit: z.string(),
  unitPrice: z.number(),
  previousQuantity: z.number().default(0),
  currentQuantity: z.preprocess(
    (v) => parseFloat(String(v || '0')),
    z.number().min(0, 'الكمية لا يمكن أن تكون سالبة')
  ),
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

  // 1. Fetch Active Projects
  const { data: projects = [], loading: projectsLoading } = useSubscription<ConstructionProject>(
    firestore, 
    'projects', 
    [where('status', '==', 'قيد التنفيذ')]
  );

  const {
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      date: new Date(),
      items: [],
    },
  });

  const { fields, replace } = useFieldArray({ control, name: 'items' });
  const selectedProjectId = watch('projectId');
  const watchedItems = useWatch({ control, name: 'items' });

  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  // 2. Fetch BOQ Items and Previous Quantities when project changes
  useEffect(() => {
    if (!selectedProjectId || !firestore || !selectedProject?.boqId) {
      replace([]);
      return;
    }

    const loadBoqWithHistory = async () => {
      setLoadingHistory(true);
      try {
        // Fetch all items in the project's BOQ
        const boqItemsSnap = await getDocs(query(
            collection(firestore, `boqs/${selectedProject.boqId}/items`),
            orderBy('itemNumber')
        ));
        
        // Fetch all previous approved applications for this project to calculate cumulative quantities
        const prevAppsSnap = await getDocs(query(
            collection(firestore, 'payment_applications'),
            where('projectId', '==', selectedProjectId),
            where('status', 'in', ['approved', 'paid'])
        ));

        const previousTotals = new Map<string, number>();
        prevAppsSnap.forEach(doc => {
            const app = doc.data() as PaymentApplication;
            app.items.forEach(item => {
                const current = previousTotals.get(item.boqItemId) || 0;
                previousTotals.set(item.boqItemId, current + (item.currentQuantity || 0));
            });
        });

        const appItems = boqItemsSnap.docs
            .map(doc => {
                const item = doc.data() as BoqItem;
                const prevQty = previousTotals.get(doc.id) || 0;
                return {
                    boqItemId: doc.id,
                    description: item.description,
                    unit: item.unit || 'مقطوعية',
                    unitPrice: item.sellingUnitPrice || 0,
                    previousQuantity: prevQty,
                    currentQuantity: 0,
                    plannedQuantity: item.quantity,
                    isHeader: item.isHeader
                };
            })
            .filter(i => !i.isHeader && i.previousQuantity < i.plannedQuantity);

        replace(appItems);
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحميل بيانات المقايسة والسجلات السابقة.' });
      } finally {
        setLoadingHistory(false);
      }
    };

    loadBoqWithHistory();
  }, [selectedProjectId, firestore, selectedProject, replace, toast]);

  // 3. Generate Application Number
  useEffect(() => {
    if (!firestore || !selectedProjectId) return;
    const generateNumber = async () => {
        const currentYear = new Date().getFullYear();
        const counterRef = doc(firestore, 'counters', 'paymentApplications');
        const counterDoc = await getDoc(counterRef);
        let nextNumber = 1;
        if (counterDoc.exists()) {
            const counts = counterDoc.data()?.counts || {};
            nextNumber = (counts[currentYear] || 0) + 1;
        }
        setAppNumber(`APP-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
    };
    generateNumber();
  }, [firestore, selectedProjectId]);

  // 4. Load Chart of Accounts
  useEffect(() => {
    if (!firestore) return;
    getDocs(query(collection(firestore, 'chartOfAccounts'))).then(snap => {
        setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
    });
  }, [firestore]);

  const totalAmount = useMemo(() => {
    return (watchedItems || []).reduce((sum, item) => sum + (Number(item.currentQuantity) || 0) * (item.unitPrice || 0), 0);
  }, [watchedItems]);

  const onSubmit = async (data: ApplicationFormValues) => {
    if (!firestore || !currentUser || !selectedProject) return;

    setIsSaving(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            const currentYear = new Date().getFullYear();
            const appCounterRef = doc(firestore, 'counters', 'paymentApplications');
            const appCounterDoc = await transaction.get(appCounterRef);
            const nextNumber = ((appCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
            const finalAppNumber = `APP-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

            const newAppRef = doc(collection(firestore, 'payment_applications'));
            const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));

            const clientSnap = await transaction.get(doc(firestore, 'clients', selectedProject.clientId));
            const clientName = clientSnap.exists() ? clientSnap.data().nameAr : 'عميل غير معروف';

            const processedItems = data.items.map(item => ({
                ...item,
                totalQuantity: item.previousQuantity + item.currentQuantity,
                totalAmount: item.currentQuantity * item.unitPrice
            })).filter(i => i.currentQuantity > 0);

            if (processedItems.length === 0) throw new Error("يجب إدخال كمية منفذة لواحد من البنود على الأقل.");

            const appData = {
                applicationNumber: finalAppNumber,
                date: data.date,
                projectId: data.projectId,
                clientId: selectedProject.clientId,
                clientName,
                projectName: selectedProject.projectName,
                items: processedItems,
                totalAmount,
                status: 'draft',
                journalEntryId: newJournalEntryRef.id,
                createdAt: serverTimestamp(),
                createdBy: currentUser.id,
            };

            // Accounting Logic: Debit Client / Credit Revenue
            const revenueAccount = accounts.find(a => a.code === '4101'); // إيرادات استشارات/مقاولات
            const clientAccount = accounts.find(a => a.name === clientName && a.parentCode === '1102');

            if (revenueAccount && clientAccount) {
                const jeData = {
                    entryNumber: `JE-${finalAppNumber}`,
                    date: data.date,
                    narration: `إثبات مستخلص أعمال #${finalAppNumber} - مشروع: ${selectedProject.projectName}`,
                    status: 'draft',
                    totalDebit: totalAmount,
                    totalCredit: totalAmount,
                    lines: [
                        { accountId: clientAccount.id!, accountName: clientName, debit: totalAmount, credit: 0, auto_profit_center: data.projectId },
                        { accountId: revenueAccount.id!, accountName: revenueAccount.name, debit: 0, credit: totalAmount, auto_profit_center: data.projectId }
                    ],
                    clientId: selectedProject.clientId,
                    transactionId: data.projectId,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                };
                transaction.set(newJournalEntryRef, cleanFirestoreData(jeData));
            }

            transaction.set(newAppRef, cleanFirestoreData(appData));
            transaction.set(appCounterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
        });

        toast({ title: 'تم الحفظ', description: 'تم إنشاء المستخلص والقيد المحاسبي كمسودة بنجاح.' });
        router.push(`/dashboard/construction/projects/${selectedProjectId}`);
    } catch (error: any) {
        console.error(error);
        toast({ variant: 'destructive', title: 'خطأ', description: error.message || 'فشل حفظ المستخلص.' });
    } finally {
        setIsSaving(false);
    }
  };

  const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: p.projectName })), [projects]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/30 p-6 rounded-2xl border">
        <div className="grid gap-2">
          <Label className="font-bold">المشروع المستهدف *</Label>
          <Controller
            control={control}
            name="projectId"
            render={({ field }) => (
              <InlineSearchList 
                value={field.value} 
                onSelect={field.onChange} 
                options={projectOptions}
                placeholder={projectsLoading ? "جاري التحميل..." : "اختر المشروع لإصدار مستخلص له..."}
                disabled={projectsLoading || isSaving}
              />
            )}
          />
        </div>
        <div className="grid gap-2">
          <Label className="font-bold">رقم المستخلص</Label>
          <Input value={appNumber} disabled className="font-mono font-bold text-primary" />
        </div>
        <div className="grid gap-2">
          <Label className="font-bold">تاريخ المستخلص</Label>
          <Controller
            name="date"
            control={control}
            render={({ field }) => <DateInput value={field.value} onChange={field.onChange} disabled={isSaving}/>}
          />
        </div>
      </div>

      {loadingHistory ? (
        <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-10 w-10 text-primary" /><p className="mt-4 text-muted-foreground">جاري تحليل بنود المقايسة والسجلات السابقة...</p></div>
      ) : fields.length > 0 ? (
        <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-card">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="h-14 border-b-2">
                <TableHead className="px-6 font-bold text-base">بيان الأعمال (BOQ)</TableHead>
                <TableHead className="text-center font-bold">الوحدة</TableHead>
                <TableHead className="text-center font-bold">الكمية التعاقدية</TableHead>
                <TableHead className="text-center font-bold">منفذ سابقاً</TableHead>
                <TableHead className="text-center font-bold bg-primary/5 text-primary">الكمية الحالية</TableHead>
                <TableHead className="text-left px-8 font-bold text-base">المبلغ المستحق</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => {
                const item = watchedItems?.[index];
                const lineTotal = (Number(item?.currentQuantity) || 0) * (item?.unitPrice || 0);
                const remaining = item?.plannedQuantity - item?.previousQuantity;

                return (
                  <TableRow key={field.id} className="h-20 border-b last:border-0 hover:bg-muted/5">
                    <TableCell className="px-6">
                        <div className="font-bold text-lg">{item?.description}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">سعر الوحدة: {formatCurrency(item?.unitPrice || 0)}</div>
                    </TableCell>
                    <TableCell className="text-center">{item?.unit}</TableCell>
                    <TableCell className="text-center font-mono font-bold text-muted-foreground">{item?.plannedQuantity}</TableCell>
                    <TableCell className="text-center font-mono text-indigo-600 font-bold">{item?.previousQuantity || 0}</TableCell>
                    <TableCell className="bg-primary/[0.02] py-2">
                      <Input 
                        type="number" step="any" 
                        {...register(`items.${index}.currentQuantity`)} 
                        placeholder={`باقي: ${remaining}`}
                        className="text-center font-black text-xl w-28 h-11 rounded-xl border-2 border-primary/20 shadow-inner mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-left font-mono font-black text-xl px-8 bg-muted/5 border-r">
                      {formatCurrency(lineTotal)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter className="bg-primary/5">
              <TableRow className="h-24 border-t-4 border-primary/20">
                <TableCell colSpan={5} className="text-right px-12 font-black text-2xl">إجمالي قيمة المطالبة الحالية:</TableCell>
                <TableCell className="text-left font-mono text-3xl font-black text-primary px-8 border-r bg-primary/5">
                  {formatCurrency(totalAmount)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : selectedProjectId && (
        <Alert variant="default" className="p-12 text-center bg-green-50 border-green-200">
            <AlertTitle className="text-2xl font-black text-green-800">تم إنجاز كافة بنود المقايسة!</AlertTitle>
            <AlertDescription className="text-green-700 text-lg">لا توجد كميات متبقية للفوترة في هذا المشروع.</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-4 pt-8 border-t">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="h-12 px-10 rounded-xl font-bold">إلغاء</Button>
        <Button onClick={handleSubmit(onSubmit)} disabled={isSaving || fields.length === 0} className="h-12 px-16 rounded-xl font-black text-lg shadow-xl shadow-primary/20 min-w-[280px]">
          {isSaving ? <Loader2 className="animate-spin ml-3 h-6 w-6" /> : <Save className="ml-3 h-6 w-6" />}
          حفظ وإصدار المستخلص
        </Button>
      </div>
    </form>
  );
}
