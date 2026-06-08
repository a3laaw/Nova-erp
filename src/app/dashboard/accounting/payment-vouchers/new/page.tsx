'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Save, X, Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, doc, runTransaction, serverTimestamp, Timestamp, getDoc, orderBy, collectionGroup, writeBatch } from 'firebase/firestore';
import type { Account, ClientTransaction, Employee, Department } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { numberToArabicWords, formatCurrency, cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { DateInput } from '@/components/ui/date-input';

// --- Work Domain Definitions ---
const STRUCTURAL_DOMAIN_ACCOUNTS = ['510101', '510102', '510103']; // Concrete, Steel, Excavation
const ARCHITECTURAL_DOMAIN_ACCOUNTS = ['510201', '510202', '510203']; // Paints, Finishes, Interior Design

const paymentVoucherSchema = z.object({
    payeeName: z.string().min(1, 'اسم المستفيد مطلوب'),
    payeeType: z.string().min(1, 'نوع المستفيد مطلوب'),
    amount: z.preprocess((a) => (String(a || '').trim() === '' ? 0 : parseFloat(String(a))), z.number().positive('المبلغ يجب أن يكون أكبر من صفر')),
    paymentDate: z.date({ required_error: 'تاريخ الدفع مطلوب' }),
    paymentMethod: z.string().min(1, 'طريقة الدفع مطلوبة'),
    description: z.string().min(1, 'الوصف مطلوب'),
    reference: z.string().optional(),
    debitAccountId: z.string().min(1, 'حساب المدين مطلوب'),
    creditAccountId: z.string().optional(),
    projectLink: z.string().optional(),
});

type PaymentVoucherFormValues = z.infer<typeof paymentVoucherSchema>;

export default function NewPaymentVoucherPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const tenantId = currentUser?.currentCompanyId;

    const [isSaving, setIsSaving] = useState(false);
    const [voucherNumber, setVoucherNumber] = useState('جاري التوليد...');
    const [isGeneratingVoucher, setIsGeneratingVoucher] = useState(true);
    
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [projects, setProjects] = useState<(ClientTransaction & { clientName: string })[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [refDataLoading, setRefDataLoading] = useState(true);

    const { register, handleSubmit, control, watch, formState: { errors }, setValue } = useForm<PaymentVoucherFormValues>({
        resolver: zodResolver(paymentVoucherSchema),
        defaultValues: { paymentDate: new Date(), amount: '' }
    });
  
    useEffect(() => {
        // ... (pre-fill logic remains the same)
    }, [searchParams, setValue, accounts]);

    const amountValue = watch('amount');
    const selectedDebitAccountId = watch('debitAccountId');
    const payeeType = watch('payeeType');
    const paymentMethod = watch('paymentMethod');
    const amountInWords = useMemo(() => numberToArabicWords(Number(amountValue) || 0), [amountValue]);

    useEffect(() => {
        if (!firestore || !tenantId) return;
        const fetchInitialData = async () => {
            setIsGeneratingVoucher(true);
            setRefDataLoading(true);
            try {
                const counterPath = getTenantPath('counters/paymentVouchers', tenantId)!;
                const counterRef = doc(firestore, counterPath);
                const accPath = getTenantPath('chartOfAccounts', tenantId)!;
                const empPath = getTenantPath('employees', tenantId)!;
                const clientPath = getTenantPath('clients', tenantId)!;
                const deptPath = getTenantPath('departments', tenantId)!;

                const [counterDoc, accSnap, empSnap, clientSnap, deptSnap] = await Promise.all([
                    getDoc(counterRef),
                    getDocs(query(collection(firestore, accPath), orderBy('code'))),
                    getDocs(query(collection(firestore, empPath), orderBy('fullName'))),
                    getDocs(collection(firestore, clientPath)),
                    getDocs(query(collection(firestore, deptPath))),
                ]);

                const projSnap = await getDocs(query(collectionGroup(firestore, 'transactions')));

                const currentYear = new Date().getFullYear();
                let nextNumber = (counterDoc.data()?.counts?.[currentYear] || 0) + 1;
                setVoucherNumber(`PV-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
            
                setAccounts(accSnap.docs.map(d => ({id: d.id, ...d.data()} as Account)));
                setEmployees(empSnap.docs.map(d => ({id: d.id, ...d.data()} as Employee)));
                setDepartments(deptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));

                const clientMap = new Map(clientSnap.docs.map(d => [d.id, d.data().nameAr]));
                const fetchedProjects = projSnap.docs
                  .filter(d => d.ref.path.startsWith(`tenants/${tenantId}/clients`))
                  .map(d => ({...d.data(), id: d.id, clientName: clientMap.get(d.data().clientId)} as ClientTransaction & { clientName: string }));
                setProjects(fetchedProjects.filter(p => p.clientName));

            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل جلب البيانات الأساسية.' });
            } finally {
                setIsGeneratingVoucher(false);
                setRefDataLoading(false);
            }
        };
        fetchInitialData();
    }, [firestore, toast, tenantId]);
  
    const debitAccount = useMemo(() => accounts.find(a => a.id === selectedDebitAccountId), [accounts, selectedDebitAccountId]);
    const showProjectLink = useMemo(() => debitAccount && (debitAccount.code.startsWith('5') || debitAccount.code.startsWith('6')), [debitAccount]);

    const parentAccountCodes = useMemo(() => {
        const codes = new Set<string>();
        if (accounts.length > 0) {
            accounts.forEach(p => {
                accounts.forEach(c => {
                    if (c.code.startsWith(p.code) && c.code !== p.code) {
                        codes.add(p.code);
                    }
                });
            });
        }
        return codes;
    }, [accounts]);

    const creditAccountOptions = useMemo(() => 
        accounts
            .filter(acc => acc.type === 'asset' && acc.isPayable && !parentAccountCodes.has(acc.code))
            .map(acc => ({value: acc.id!, label: `${acc.name} (${acc.code})`, searchKey: acc.code}))
    , [accounts, parentAccountCodes]);

    const debitAccountOptions = useMemo(() => 
        accounts
            .filter(acc => (acc.type === 'expense' || acc.type === 'asset') && !parentAccountCodes.has(acc.code))
            .map(acc => ({value: acc.id!, label: `${acc.name} (${acc.code})`, searchKey: acc.code}))
    , [accounts, parentAccountCodes]);

    const employeePayeeOptions = useMemo(() => employees.map(e => ({ value: e.fullName, label: e.fullName })), [employees]);
    const projectOptions = useMemo(() => projects.map(p => ({ 
        value: `${p.clientId}/${p.id}`, 
        label: `${p.clientName} - ${p.subServiceName || p.transactionType} (${p.transactionNumber})` 
    })), [projects]);

    const onSubmit = async (data: PaymentVoucherFormValues) => {
        if (!firestore || !currentUser || isGeneratingVoucher || !tenantId) return;
        setIsSaving(true);

        try {
            await runTransaction(firestore, async (transaction) => {
                // --- Setup and Validation ---
                const debitAccount = accounts.find(a => a.id === data.debitAccountId);
                const creditAccount = accounts.find(a => a.id === data.creditAccountId);
                if (!debitAccount || !creditAccount) throw new Error("الحسابات المدين أو الدائن غير صحيحة.");

                // --- Analytical Engine Starts Here ---
                let autoTags = {};
                if (showProjectLink && data.projectLink) {
                    const [, transactionId] = data.projectLink.split('/');
                    const project = projects.find(p => p.id === transactionId);
                    if (!project) throw new Error("المشروع المرتبط غير موجود.");

                    // --- Fallback Values (Default Project Manager) ---
                    const fallbackResource = employees.find(e => e.id === project.assignedEngineerId);
                    const fallbackDept = departments.find(d => d.name === fallbackResource?.department);

                    // --- Initialize Dimensions ---
                    let dim_1_general = currentUser.branchId || 'HQ';
                    let dim_2_dept = fallbackDept?.id || 'SYS_UNALLOCATED';
                    let dim_3_project = transactionId;
                    let dim_4_resource = fallbackResource?.id || 'SYS_UNALLOCATED';
                    
                    // --- Dynamic Override based on Work Domain ---
                    if (STRUCTURAL_DOMAIN_ACCOUNTS.includes(debitAccount.code)) {
                        const structuralEngineer = employees.find(e => e.id === project.structuralEngineerId);
                        if (structuralEngineer) {
                            const dept = departments.find(d => d.name === structuralEngineer.department);
                            dim_4_resource = structuralEngineer.id;
                            if(dept) dim_2_dept = dept.id;
                        }
                    } else if (ARCHITECTURAL_DOMAIN_ACCOUNTS.includes(debitAccount.code)) {
                        const architect = employees.find(e => e.id === project.architecturalEngineerId);
                        if (architect) {
                            const dept = departments.find(d => d.name === architect.department);
                            dim_4_resource = architect.id;
                            if(dept) dim_2_dept = dept.id;
                        }
                    }

                    // --- Anti-Null Enforcement ---
                    if (!dim_1_general || !dim_2_dept || !dim_3_project || !dim_4_resource) {
                        throw new Error("فشل حقن الأبعاد التحليلية. لا يمكن أن تكون قيمة أي من الأبعاد فارغة.");
                    }
                    
                    autoTags = {
                        auto_general_center_id: dim_1_general,
                        auto_dept_id: dim_2_dept,
                        auto_profit_center_id: dim_3_project,
                        auto_resource_id: dim_4_resource
                    };
                }
                // --- Analytical Engine Ends ---

                // --- Transaction Processing ---
                const currentYear = new Date().getFullYear();
                const pvCounterRef = getTenantPath('counters/paymentVouchers', tenantId)!;
                const jeCounterRef = getTenantPath('counters/journalEntries', tenantId)!;
                const pvCounterDoc = await transaction.get(doc(firestore, pvCounterRef));
                const jeCounterDoc = await transaction.get(doc(firestore, jeCounterRef));
                
                let pvNextNumber = (pvCounterDoc.data()?.counts?.[currentYear] || 0) + 1;
                let jeNextNumber = (jeCounterDoc.data()?.counts?.[currentYear] || 0) + 1;
                const newVoucherNumber = `PV-${currentYear}-${String(pvNextNumber).padStart(4, '0')}`;
                const newJeNumber = `JV-${currentYear}-${String(jeNextNumber).padStart(4, '0')}`;

                // Create Voucher
                const newVoucherRef = doc(collection(firestore, getTenantPath('paymentVouchers', tenantId)!));
                transaction.set(newVoucherRef, cleanFirestoreData({ /* ... voucher data ... */ }));

                // Create Journal Entry with Mirrored Lines
                const newJournalEntryRef = doc(collection(firestore, getTenantPath('journalEntries', tenantId)!));
                const jeLines = [
                    { accountId: data.debitAccountId, accountName: debitAccount.name, debit: data.amount, credit: 0, ...autoTags },
                    { accountId: data.creditAccountId, accountName: creditAccount.name, debit: 0, credit: data.amount, ...autoTags } 
                ];

                transaction.set(newJournalEntryRef, cleanFirestoreData({
                    entryNumber: newJeNumber, date: data.paymentDate, status: 'posted',
                    narration: `${data.description} (سند صرف رقم ${newVoucherNumber})`,
                    totalDebit: data.amount, totalCredit: data.amount, lines: jeLines,
                    createdAt: serverTimestamp(), createdBy: currentUser.id,
                    companyId: tenantId,
                    ...((showProjectLink && data.projectLink) && {
                      clientId: data.projectLink.split('/')[0],
                      transactionId: data.projectLink.split('/')[1]
                    })
                }));

                // Update Counters
                transaction.set(doc(firestore, pvCounterRef), { counts: { [currentYear]: pvNextNumber } }, { merge: true });
                transaction.set(doc(firestore, jeCounterRef), { counts: { [currentYear]: jeNextNumber } }, { merge: true });
            });
        
            toast({ title: 'نجاح', description: 'تم إنشاء سند الصرف وترحيل القيد المحاسبي بنجاح.' });
            router.push(`/dashboard/accounting/payment-vouchers`);

        } catch (error) {
            console.error("Error saving payment voucher:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: error instanceof Error ? error.message : 'فشل حفظ سند الصرف.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* ... UI remains largely the same, logic is now in the backend ... */}
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>سـنـد صـرف / Payment Voucher</CardTitle>
                            <CardDescription>{isGeneratingVoucher ? <Skeleton className="h-4 w-32" /> : voucherNumber} : رقم السند</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="payeeType">نوع المستفيد <span className="text-destructive">*</span></Label>
                            <Controller
                                name="payeeType"
                                control={control}
                                render={({ field }) => (
                                    <Select dir='rtl' onValueChange={field.onChange} value={field.value}>
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
                            {payeeType === 'employee' ? (
                                <Controller name="payeeName" control={control} render={({ field }) => (
                                    <InlineSearchList value={field.value || ''} onSelect={field.onChange} options={employeePayeeOptions} placeholder={refDataLoading ? "تحميل..." : "اختر موظفًا..."} disabled={refDataLoading} />
                                )} />
                            ) : (
                                <Input id="payeeName" {...register('payeeName')} />
                            )}
                            {errors.payeeName && <p className="text-xs text-destructive">{errors.payeeName.message}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="amount">المبلغ <span className="text-destructive">*</span></Label>
                            <Input id="amount" type="number" step="0.001" placeholder="0.000" className='text-left dir-ltr' {...register('amount')} />
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
                        <Textarea id="description" placeholder="وصف عملية الصرف..." {...register('description')} />
                        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="paymentDate">تاريخ الدفع <span className="text-destructive">*</span></Label>
                            <Controller name="paymentDate" control={control} render={({ field }) => ( <DateInput value={field.value} onChange={field.onChange} /> )} />
                            {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="paymentMethod">طريقة الدفع <span className="text-destructive">*</span></Label>
                            <Controller name="paymentMethod" control={control} render={({ field }) => (
                                <Select dir='rtl' onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger id="paymentMethod"><SelectValue placeholder="اختر طريقة الدفع" /></SelectTrigger>
                                    <SelectContent><SelectItem value="Cash">نقداً</SelectItem><SelectItem value="Cheque">شيك</SelectItem><SelectItem value="Bank Transfer">تحويل بنكي</SelectItem><SelectItem value="EmployeeCustody">عهدة موظف</SelectItem></SelectContent>
                                </Select>
                            )} />
                            {errors.paymentMethod && <p className="text-xs text-destructive">{errors.paymentMethod.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="reference">رقم الشيك/المرجع</Label>
                            <Input id="reference" placeholder="رقم المرجع..." {...register('reference')} />
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
                                        value={field.value || ''} 
                                        onSelect={field.onChange} 
                                        options={debitAccountOptions} 
                                        placeholder={refDataLoading ? "تحميل..." : "اختر حساب المصروف أو المورد..."}
                                        disabled={refDataLoading}
                                    />
                                )}
                            />
                            {errors.debitAccountId && <p className="text-xs text-destructive">{errors.debitAccountId.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="creditAccountId">الحساب الدائن</Label>
                            <Controller
                                name="creditAccountId"
                                control={control}
                                render={({ field }) => (
                                    <InlineSearchList 
                                        value={field.value || ''}
                                        onSelect={field.onChange}
                                        options={creditAccountOptions}
                                        placeholder={refDataLoading ? "تحميل..." : "اختر حساب الصندوق أو البنك..."}
                                        disabled={refDataLoading || paymentMethod === 'EmployeeCustody'}
                                    />
                                )}
                            />
                            {errors.creditAccountId && <p className="text-xs text-destructive">{errors.creditAccountId.message}</p>}
                        </div>
                        {showProjectLink && (
                            <div className="grid gap-2">
                                <Label htmlFor="projectLink">ربط بمشروع (مركز تكلفة)</Label>
                                <Controller name="projectLink" control={control} render={({ field }) => (
                                    <InlineSearchList value={field.value || ''} onSelect={field.onChange} options={projectOptions} placeholder={refDataLoading ? "تحميل..." : "اختر مشروعًا..."} disabled={refDataLoading} />
                                )} />
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>إلغاء</Button>
                    <Button type="submit" disabled={isSaving || isGeneratingVoucher}>
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                        {isSaving ? 'جاري الحفظ...' : 'حفظ'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
