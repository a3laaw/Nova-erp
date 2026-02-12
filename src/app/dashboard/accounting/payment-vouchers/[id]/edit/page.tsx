
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, X, Loader2, Info } from 'lucide-react';
import { useFirebase, useDocument } from '@/firebase';
import { collection, query, getDocs, doc, updateDoc, getDoc, serverTimestamp, orderBy, runTransaction, Timestamp, collectionGroup, writeBatch } from 'firebase/firestore';
import type { Account, PaymentVoucher, Employee, ClientTransaction, Department } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { numberToArabicWords, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { format as formatDateFns } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';

const paymentVoucherSchema = z.object({
    payeeName: z.string().min(1, 'اسم المستفيد مطلوب'),
    payeeType: z.string().min(1, 'نوع المستفيد مطلوب'),
    amount: z.preprocess((a) => (String(a || '').trim() === '' ? 0 : parseFloat(String(a))), z.number().positive('المبلغ يجب أن يكون أكبر من صفر')),
    paymentDate: z.string().min(1, 'تاريخ الدفع مطلوب'),
    paymentMethod: z.string().min(1, 'طريقة الدفع مطلوبة'),
    description: z.string().min(1, 'الوصف مطلوب'),
    reference: z.string().optional(),
    debitAccountId: z.string().min(1, 'حساب المدين مطلوب'),
    creditAccountId: z.string().min(1, 'حساب الدائن مطلوب'),
    projectLink: z.string().optional(),
    status: z.enum(['draft', 'paid', 'cancelled']),
});

type PaymentVoucherFormValues = z.infer<typeof paymentVoucherSchema>;

export default function EditPaymentVoucherPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<(ClientTransaction & { clientName: string })[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(true);

  const voucherRef = useMemo(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'paymentVouchers', id);
  }, [firestore, id]);

  const { data: voucherSnap, loading: voucherLoading } = useDocument<PaymentVoucher>(firestore, voucherRef ? voucherRef.path : null);

  const { register, handleSubmit, control, watch, formState: { errors }, reset } = useForm<PaymentVoucherFormValues>({
      resolver: zodResolver(paymentVoucherSchema),
  });

  useEffect(() => {
    if (voucherSnap) {
        const data = voucherSnap;
        reset({
            payeeName: data.payeeName,
            payeeType: data.payeeType,
            amount: data.amount || 0,
            paymentDate: data.paymentDate?.toDate ? formatDateFns(data.paymentDate.toDate(), 'yyyy-MM-dd') : '',
            paymentMethod: data.paymentMethod,
            description: data.description,
            reference: data.reference || '',
            debitAccountId: data.debitAccountId,
            creditAccountId: data.creditAccountId,
            projectLink: data.clientId && data.transactionId ? `${data.clientId}/${data.transactionId}` : '',
            status: data.status,
        });
    }
  }, [voucherSnap, reset, firestore]);

  const amountValue = watch('amount');
  const amountInWords = useMemo(() => {
    const numAmount = Number(amountValue);
    if (numAmount && !isNaN(numAmount)) {
        return numberToArabicWords(numAmount);
    }
    return '';
  }, [amountValue]);

  const debitAccountIdValue = watch('debitAccountId');
  const selectedAccount = useMemo(() => accounts.find(a => a.id === debitAccountIdValue), [accounts, debitAccountIdValue]);
  const showProjectLink = useMemo(() => selectedAccount && selectedAccount.code.startsWith('51'), [selectedAccount]);

  useEffect(() => {
    if (!firestore) return;
    const fetchRefData = async () => {
        setRefDataLoading(true);
        try {
            const [accSnap, empSnap, projSnap, clientSnap, deptSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'chartOfAccounts'), orderBy('code'))),
                getDocs(query(collection(firestore, 'employees'), orderBy('fullName'))),
                getDocs(query(collectionGroup(firestore, 'transactions'))),
                getDocs(collection(firestore, 'clients')),
                getDocs(query(collection(firestore, 'departments'))),
            ]);
            
            setAccounts(accSnap.docs.map(d => ({id: d.id, ...d.data()} as Account)));
            setEmployees(empSnap.docs.map(d => ({id: d.id, ...d.data()} as Employee)));
            setDepartments(deptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));

            const clientMap = new Map(clientSnap.docs.map(d => [d.id, d.data().nameAr]));
            const fetchedProjects = projSnap.docs.map(d => ({...d.data(), id: d.id, clientName: clientMap.get(d.data().clientId)} as ClientTransaction & { clientName: string }));
            setProjects(fetchedProjects.filter(p => p.clientName));
        } catch(e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل جلب البيانات المرجعية.' });
        } finally {
            setRefDataLoading(false);
        }
    };
    fetchRefData();
  }, [firestore, toast]);

  const creditAccountOptions = useMemo(() => accounts.filter(acc => acc.type === 'asset' && acc.isPayable).map(acc => ({value: acc.id!, label: `${acc.name} (${acc.code})`, searchKey: acc.code})), [accounts]);
  const debitAccountOptions = useMemo(() => accounts.filter(acc => acc.type === 'expense' || (acc.type === 'liability' && acc.isPayable)).map(acc => ({value: acc.id!, label: `${acc.name} (${acc.code})`, searchKey: acc.code})), [accounts]);
  const employeePayeeOptions = useMemo(() => employees.map(e => ({ value: e.fullName, label: e.fullName })), [employees]);
  const projectOptions = useMemo(() => projects.map(p => ({ value: `${p.clientId}/${p.id}`, label: `${p.clientName} - ${p.transactionType}` })), [projects]);

  const onSubmit = async (data: PaymentVoucherFormValues) => {
    if (!firestore || !currentUser || !id || !voucherSnap) return;
    
    setIsSaving(true);
    try {
       await runTransaction(firestore, async (transaction_fs) => {
           const voucherRefDoc = doc(firestore, 'paymentVouchers', id);
           
           const debitAccount = accounts.find(a => a.id === data.debitAccountId);
           const creditAccount = accounts.find(a => a.id === data.creditAccountId);
           if (!debitAccount || !creditAccount) {
               throw new Error("لم يتم العثور على حسابات المدين أو الدائن.");
           }

           const updatePayload: any = {
               ...data,
               amount: Number(data.amount),
               amountInWords: amountInWords,
               debitAccountName: debitAccount.name,
               creditAccountName: creditAccount.name,
               paymentDate: new Date(data.paymentDate),
           };

            if (showProjectLink && data.projectLink) {
                const [clientId, transactionId] = data.projectLink.split('/');
                updatePayload.clientId = clientId;
                updatePayload.transactionId = transactionId;
            } else {
                updatePayload.clientId = null;
                updatePayload.transactionId = null;
            }
           
           transaction_fs.update(voucherRefDoc, cleanFirestoreData(updatePayload));
           
           const debitLine: any = { accountId: data.debitAccountId, accountName: debitAccount.name, debit: data.amount, credit: 0 };
            
           if (showProjectLink && data.projectLink) {
                const [clientId, transactionId] = data.projectLink.split('/');
                debitLine.clientId = clientId;
                debitLine.transactionId = transactionId;
                
                const project = projects.find(p => p.id === transactionId);
                if (project && project.assignedEngineerId) {
                    const engineer = employees.find(e => e.id === project.assignedEngineerId);
                    const department = departments.find(d => d.name === engineer?.department);

                    debitLine.auto_profit_center = transactionId;
                    debitLine.auto_resource_id = project.assignedEngineerId;
                    if (department) {
                        debitLine.auto_dept_id = department.id;
                    }
                }
            }

           const newLines = [
                debitLine,
                { accountId: data.creditAccountId, accountName: creditAccount.name, debit: 0, credit: data.amount }
           ];

           const jeUpdatePayload: any = {
                date: Timestamp.fromDate(new Date(data.paymentDate)),
                lines: newLines,
                totalDebit: data.amount,
                totalCredit: data.amount,
                narration: data.description || `تحديث سند صرف رقم ${voucherSnap.voucherNumber} إلى ${data.payeeName}`,
           };
            
           if(voucherSnap.status === 'draft' && data.status === 'paid') {
              jeUpdatePayload.status = 'posted';
           }

           if (voucherSnap.journalEntryId) {
                const jeRef = doc(firestore, 'journalEntries', voucherSnap.journalEntryId);
                transaction_fs.update(jeRef, jeUpdatePayload);
           }

            // If a residency renewal is being paid, update the employee record
            if (voucherSnap.employeeId && voucherSnap.renewalExpiryDate && data.status === 'paid' && voucherSnap.status !== 'paid') {
                const employeeRef = doc(firestore, 'employees', voucherSnap.employeeId);
                const employeeSnap = await transaction_fs.get(employeeRef);
                if (employeeSnap.exists()) {
                    transaction_fs.update(employeeRef, { residencyExpiry: toFirestoreDate(voucherSnap.renewalExpiryDate) });
                    
                    const auditLogRef = doc(collection(firestore, `employees/${voucherSnap.employeeId}/auditLogs`));
                    transaction_fs.set(auditLogRef, {
                        changeType: 'ResidencyUpdate',
                        field: 'residencyExpiry',
                        oldValue: employeeSnap.data().residencyExpiry || null,
                        newValue: voucherSnap.renewalExpiryDate,
                        effectiveDate: serverTimestamp(),
                        changedBy: currentUser.id,
                        notes: `تجديد الإقامة عبر سند الصرف ${voucherSnap.voucherNumber}.`,
                    });
                }
            }
       });
        
        toast({ title: 'نجاح', description: 'تم تحديث سند الصرف والقيد المحاسبي بنجاح.' });
        router.push(`/dashboard/accounting/payment-vouchers/${id}`);

    } catch (error) {
        console.error("Error updating payment voucher:", error);
        toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: error instanceof Error ? error.message : 'فشل حفظ سند الصرف.' });
    } finally {
        setIsSaving(false);
    }
  };
  
  if (voucherLoading || refDataLoading) {
      return (
          <Card className="max-w-4xl mx-auto" dir="rtl">
              <CardHeader><Skeleton className="h-8 w-48" /></CardHeader>
              <CardContent className="space-y-6">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-24 w-full" />
              </CardContent>
          </Card>
      );
  }

  return (
    <Card className="max-w-4xl mx-auto" dir="rtl">
        <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>تعديل سند صرف</CardTitle>
                        <CardDescription>
                            تعديل بيانات سند الصرف رقم: {voucherSnap?.voucherNumber}
                        </CardDescription>
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="status">حالة السند</Label>
                        <Controller name="status" control={control} render={({ field }) => (
                            <Select dir='rtl' onValueChange={field.onChange} value={field.value} disabled={isSaving || voucherSnap?.status !== 'draft'}>
                                <SelectTrigger id="status" className="w-[180px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">مسودة</SelectItem>
                                    <SelectItem value="paid">مدفوع</SelectItem>
                                    <SelectItem value="cancelled">ملغي</SelectItem>
                                </SelectContent>
                            </Select>
                        )}/>
                    </div>
                </div>
                 {voucherSnap?.employeeId && voucherSnap?.renewalExpiryDate && (
                    <Alert variant="default" className="mt-4 bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-200">
                        <Info className="h-4 w-4 !text-blue-600 dark:!text-blue-300" />
                        <AlertTitle>سند تجديد إقامة</AlertTitle>
                        <AlertDescription>
                            عند تغيير حالة هذا السند إلى "مدفوع"، سيتم تحديث تاريخ انتهاء إقامة الموظف تلقائيًا.
                        </AlertDescription>
                    </Alert>
                )}
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="payeeType">نوع المستفيد <span className="text-destructive">*</span></Label>
                        <Controller
                            name="payeeType"
                            control={control}
                            render={({ field }) => (
                                <Select dir='rtl' onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                                    <SelectTrigger id="payeeType"><SelectValue placeholder="اختر نوع المستفيد..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="vendor">مورد</SelectItem>
                                        <SelectItem value="employee">موظف</SelectItem>
                                        <SelectItem value="other">أخرى</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.payeeType && <p className="text-xs text-destructive">{errors.payeeType.message}</p>}
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="payeeName">اسم المستفيد <span className="text-destructive">*</span></Label>
                        <Input id="payeeName" {...register('payeeName')} disabled={isSaving} />
                        {errors.payeeName && <p className="text-xs text-destructive">{errors.payeeName.message}</p>}
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="amount">المبلغ <span className="text-destructive">*</span></Label>
                        <Input id="amount" type="number" step="0.001" placeholder="0.000" className='text-left dir-ltr' {...register('amount')} disabled={isSaving} />
                        {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
                    </div>
                    <div className="md:col-span-2 grid gap-2">
                        <Label>مبلغ وقدره (كتابة)</Label>
                        <div className='p-2 text-sm text-muted-foreground border rounded-md min-h-[40px] bg-muted/50'>
                            {amountInWords || '(سيتم ملؤه تلقائياً)'}
                        </div>
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="description">وذلك عن / البيان <span className="text-destructive">*</span></Label>
                    <Textarea id="description" placeholder="وصف عملية الصرف..." {...register('description')} disabled={isSaving}/>
                     {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="grid gap-2">
                         <Label htmlFor="paymentDate">تاريخ الدفع <span className="text-destructive">*</span></Label>
                        <Controller name="paymentDate" control={control} render={({ field }) => ( <Input id="paymentDate" type="date" value={field.value} onChange={field.onChange} disabled={isSaving} /> )} />
                        {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="paymentMethod">طريقة الدفع <span className="text-destructive">*</span></Label>
                        <Controller
                            name="paymentMethod"
                            control={control}
                            render={({ field }) => (
                                <Select dir='rtl' onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                                    <SelectTrigger id="paymentMethod"><SelectValue placeholder="اختر طريقة الدفع" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Cash">نقداً</SelectItem>
                                        <SelectItem value="Cheque">شيك</SelectItem>
                                        <SelectItem value="Bank Transfer">تحويل بنكي</SelectItem>
                                        <SelectItem value="EmployeeCustody">عهدة موظف</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                         {errors.paymentMethod && <p className="text-xs text-destructive">{errors.paymentMethod.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="reference">رقم الشيك/المرجع</Label>
                        <Input id="reference" placeholder="رقم المرجع..." {...register('reference')} disabled={isSaving}/>
                    </div>
                </div>
                 <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t", showProjectLink && "md:grid-cols-3")}>
                    <div className="grid gap-2">
                        <Label htmlFor="debitAccountId">الحساب المدين (المصروف) <span className="text-destructive">*</span></Label>
                        <Controller
                            name="debitAccountId"
                            control={control}
                            render={({ field }) => (
                                <InlineSearchList 
                                    value={field.value}
                                    onSelect={field.onChange}
                                    options={debitAccountOptions}
                                    placeholder={refDataLoading ? "تحميل..." : "اختر حساب المصروف أو المورد..."}
                                    disabled={refDataLoading || isSaving}
                                />
                            )}
                        />
                         {errors.debitAccountId && <p className="text-xs text-destructive">{errors.debitAccountId.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="creditAccountId">الحساب الدائن (الصندوق/البنك) <span className="text-destructive">*</span></Label>
                         <Controller
                            name="creditAccountId"
                            control={control}
                            render={({ field }) => (
                                <InlineSearchList 
                                    value={field.value}
                                    onSelect={field.onChange}
                                    options={creditAccountOptions}
                                    placeholder={refDataLoading ? "تحميل..." : "اختر حساب الصندوق أو البنك..."}
                                    disabled={refDataLoading || isSaving}
                                />
                            )}
                        />
                         {errors.creditAccountId && <p className="text-xs text-destructive">{errors.creditAccountId.message}</p>}
                    </div>
                    {showProjectLink && (
                        <div className="grid gap-2 md:col-span-1">
                            <Label htmlFor="projectLink">ربط بمشروع (مركز تكلفة)</Label>
                            <Controller
                                name="projectLink"
                                control={control}
                                render={({ field }) => (
                                    <InlineSearchList
                                        value={field.value || ''}
                                        onSelect={field.onChange}
                                        options={projectOptions}
                                        placeholder={refDataLoading ? "تحميل..." : "اختر مشروعًا..."}
                                        disabled={refDataLoading || isSaving}
                                    />
                                )}
                            />
                        </div>
                    )}
                 </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>
                    <X className="ml-2 h-4 w-4" />
                    إلغاء
                </Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                    {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </Button>
            </CardFooter>
        </form>
    </Card>
  );
}
