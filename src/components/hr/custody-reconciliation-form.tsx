'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Save, PlusCircle, Trash2, Banknote, Camera, Info, ShieldCheck, Wallet, Target, User, UploadCloud, FileText, X, Image as ImageIcon } from 'lucide-react';
import { useFirebase, useSubscription, useStorage } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, where, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Account, Employee, CustodyReconciliation, JournalEntry, ConstructionProject, Client } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData, generateStableId, cn } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { DateInput } from '@/components/ui/date-input';
import Image from 'next/image';

const itemSchema = z.object({
  id: z.string(),
  description: z.string().min(1, "بيان المصروف مطلوب."),
  amount: z.preprocess((v) => parseFloat(String(v || '')), z.number().positive("المبلغ مطلوب")),
  projectId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  attachmentUrl: z.string().optional(),
});

const reconciliationSchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  employeeId: z.string().min(1, "الموظف مطلوب."),
  items: z.array(itemSchema).min(1, 'يجب إضافة بند مصروف واحد على الأقل.'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof reconciliationSchema>;

export function CustodyReconciliationForm() {
    const { firestore, storage } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);
    const [recNumber, setRecNumber] = useState('جاري التوليد...');
    const [custodyBalance, setCustodyBalance] = useState(0);
    const [loadingBalance, setLoadingBalance] = useState(false);
    
    // لإدارة الملفات المرفوعة قبل الحفظ النهائي
    const [previews, setPreviews] = useState<Record<string, { url: string, file: File }>>({});
    const [isDragging, setIsDragging] = useState<string | null>(null);

    const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
    const { data: projects = [], loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, 'projects', [where('status', '==', 'قيد التنفيذ')]);
    const { data: clients = [], loading: clientsLoading } = useSubscription<Client>(firestore, 'clients', [orderBy('nameAr')]);
    const { data: accounts = [] } = useSubscription<Account>(firestore, 'chartOfAccounts', [orderBy('code')]);

    const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(reconciliationSchema),
        defaultValues: {
            date: new Date(),
            employeeId: currentUser?.role !== 'Admin' ? currentUser?.employeeId : '',
            items: [{ id: generateStableId(), description: '', amount: '', projectId: '', clientId: '' } as any],
        }
    });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });
    const watchedItems = useWatch({ control, name: "items" });
    const selectedEmployeeId = watch('employeeId');

    const totalSpent = useMemo(() =>
        (watchedItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [watchedItems]);

    useEffect(() => {
        if (!firestore || !selectedEmployeeId) {
            setCustodyBalance(0);
            return;
        }
        setLoadingBalance(true);
        const fetchBalance = async () => {
            try {
                const emp = employees.find(e => e.id === selectedEmployeeId);
                const custodyAcc = accounts.find(a => a.parentCode === '110102' && a.name.includes(emp?.fullName || ''));
                if (!custodyAcc) {
                    setCustodyBalance(0);
                    return;
                }
                const jesSnap = await getDocs(query(collection(firestore, 'journalEntries'), where('status', '==', 'posted')));
                const balance = jesSnap.docs.flatMap(d => (d.data() as JournalEntry).lines)
                    .filter(l => l.accountId === custodyAcc.id)
                    .reduce((sum, l) => sum + (l.debit || 0) - (l.credit || 0), 0);
                setCustodyBalance(balance);
            } finally {
                setLoadingBalance(false);
            }
        };
        fetchBalance();
    }, [selectedEmployeeId, firestore, accounts, employees]);

    useEffect(() => {
        if (!firestore) return;
        const generateNumber = async () => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'custodyReconciliations');
            const counterDoc = await getDoc(counterRef);
            const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
            setRecNumber(`REC-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
        };
        generateNumber();
    }, [firestore]);

    const handleFileDrop = (itemId: string, files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        const url = URL.createObjectURL(file);
        setPreviews(prev => ({ ...prev, [itemId]: { url, file } }));
        toast({ title: 'تم إرفاق المستند', description: 'سيتم رفعه عند حفظ التسوية.' });
    };

    const onSubmit = async (data: FormValues) => {
        if (!firestore || !currentUser || !storage) return;
        if (totalSpent > custodyBalance && currentUser.role !== 'Admin') {
            toast({ variant: 'destructive', title: 'تجاوز الرصيد', description: 'لا يمكنك تسوية مبلغ أكبر من المتوفر في عهدتك.' });
            return;
        }

        if (savingRef.current) return;
        savingRef.current = true;
        setIsSaving(true);

        try {
            const finalItems = [];
            for (const item of data.items) {
                let attachmentUrl = '';
                const fileData = previews[item.id];
                if (fileData) {
                    const storageRef = ref(storage, `reconciliations/${currentUser.id}/${Date.now()}_${fileData.file.name}`);
                    const uploadResult = await uploadBytes(storageRef, fileData.file);
                    attachmentUrl = await getDownloadURL(uploadResult.ref);
                }

                const project = projects.find(p => p.id === item.projectId);
                const client = clients.find(c => c.id === item.clientId);

                finalItems.push({
                    description: item.description,
                    amount: Number(item.amount),
                    projectId: item.projectId || null,
                    projectName: project?.projectName || null,
                    clientId: item.clientId || null,
                    clientName: client?.nameAr || null,
                    attachmentUrl
                });
            }

            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'custodyReconciliations');
                const counterDoc = await transaction.get(counterRef);
                const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const finalRecNumber = `REC-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

                const newRecRef = doc(collection(firestore, 'custody_reconciliations'));
                transaction.set(newRecRef, cleanFirestoreData({
                    reconciliationNumber: finalRecNumber,
                    employeeId: data.employeeId,
                    employeeName: employees.find(e => e.id === data.employeeId)?.fullName,
                    date: data.date,
                    totalAmount: totalSpent,
                    items: finalItems,
                    status: 'pending',
                    notes: data.notes,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                }));

                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });

            toast({ title: 'تم إرسال التسوية', description: 'بانتظار مراجعة واعتماد المحاسب المالي.' });
            router.push('/dashboard/hr/employees');
        } catch (error) {
            console.error("Save error:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إرسال طلب التسوية.' });
            setIsSaving(false);
            savingRef.current = false;
        }
    };

    const employeeOptions = useMemo(() => employees.map(e => ({ value: e.id!, label: e.fullName })), [employees]);
    const combinedEntityOptions = useMemo(() => [
        ...projects.map(p => ({ value: p.id!, label: `مشروع: ${p.projectName}` })),
        ...clients.map(c => ({ value: c.id!, label: `عميل: ${c.nameAr}` }))
    ], [projects, clients]);

    return (
        <Card className="max-w-5xl mx-auto rounded-[2.5rem] border-none shadow-2xl overflow-hidden" dir="rtl">
            <form onSubmit={(e) => { e.preventDefault(); if (!isSaving) handleSubmit(onSubmit)(e); }}>
                <CardHeader className="bg-primary/5 pb-8 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><Wallet className="h-8 w-8"/></div>
                        <div>
                            <CardTitle className="text-2xl font-black">تسوية عهدة نقدية (مطورة)</CardTitle>
                            <CardDescription>اسحب وأفلت الفواتير لتعبئة المرفقات ومعاينتها لحظياً بنظام Odoo الاحترافي.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="grid gap-2">
                            <Label className="font-black text-gray-700 pr-1">الموظف صاحب العهدة</Label>
                            <Controller
                                control={control}
                                name="employeeId"
                                render={({ field }) => (
                                    <InlineSearchList 
                                        value={field.value} 
                                        onSelect={field.onChange} 
                                        options={employeeOptions}
                                        placeholder="ابحث عن الموظف..."
                                        disabled={currentUser?.role !== 'Admin' || isSaving}
                                        className="h-12 rounded-2xl border-2"
                                    />
                                )}
                            />
                        </div>
                        <div className="bg-white/50 p-4 rounded-3xl border-2 border-dashed border-primary/20 flex items-center justify-between shadow-inner">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase text-primary">الرصيد المتاح للتحميل</Label>
                                <p className="text-2xl font-black text-primary font-mono">
                                    {loadingBalance ? <Loader2 className="h-4 w-4 animate-spin"/> : formatCurrency(custodyBalance)}
                                </p>
                            </div>
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary font-black">KD</div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex justify-between items-center px-2">
                            <Label className="text-xl font-black flex items-center gap-2">
                                <PlusCircle className="h-5 w-5 text-primary" /> قائمة بنود التسوية
                            </Label>
                            <Badge variant="outline" className="font-bold border-primary/20 text-primary bg-primary/5">
                                {fields.length} بنود مدرجة
                            </Badge>
                        </div>

                        <div className="space-y-4">
                            {fields.map((field, index) => (
                                <div key={field.id} className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-6 bg-white border-2 rounded-[2rem] shadow-sm hover:shadow-md transition-all group relative">
                                    <div className="lg:col-span-4 space-y-4">
                                        <div className="grid gap-1.5">
                                            <Label className="text-[10px] font-black text-muted-foreground uppercase pr-1">بيان المصروف</Label>
                                            <Input 
                                                {...register(`items.${index}.description`)} 
                                                placeholder="بترول، غداء عمال..." 
                                                className="h-11 rounded-xl border-2 font-bold" 
                                                disabled={isSaving}
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label className="text-[10px] font-black text-muted-foreground uppercase pr-1">المشروع / العميل</Label>
                                            <Controller
                                                control={control}
                                                name={`items.${index}.projectId`}
                                                render={({ field: catField }) => (
                                                    <InlineSearchList 
                                                        value={catField.value || ''} 
                                                        onSelect={catField.onChange} 
                                                        options={combinedEntityOptions} 
                                                        placeholder="اربط بمشروع..." 
                                                        className="h-11 rounded-xl border-dashed"
                                                        disabled={isSaving}
                                                    />
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="lg:col-span-2 flex flex-col justify-center gap-1.5">
                                        <Label className="text-[10px] font-black text-primary uppercase pr-1">المبلغ (د.ك)</Label>
                                        <Input 
                                            type="number" 
                                            step="any" 
                                            {...register(`items.${index}.amount`)} 
                                            onWheel={(e) => e.currentTarget.blur()}
                                            disabled={isSaving}
                                            className="h-14 text-2xl font-black text-primary text-center rounded-2xl border-2 border-primary/20 bg-primary/[0.02] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                        />
                                    </div>

                                    <div className="lg:col-span-5 relative">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase pr-1 block mb-1.5">المرفقات (سحب وإفلات)</Label>
                                        <div 
                                            onDragOver={(e) => { e.preventDefault(); setIsDragging(field.id); }}
                                            onDragLeave={() => setIsDragging(null)}
                                            onDrop={(e) => { e.preventDefault(); setIsDragging(null); handleFileDrop(field.id, e.dataTransfer.files); }}
                                            className={cn(
                                                "h-32 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden group/drop",
                                                isDragging === field.id ? "bg-primary/10 border-primary scale-[1.02]" : "bg-muted/30 border-muted-foreground/20 hover:bg-muted/50",
                                                previews[field.id] && "border-solid border-green-500/30 bg-green-50/10"
                                            )}
                                        >
                                            {previews[field.id] ? (
                                                <div className="absolute inset-0 group/preview animate-in fade-in zoom-in duration-300">
                                                    {previews[field.id].file.type.startsWith('image/') ? (
                                                        <Image src={previews[field.id].url} alt="Receipt" fill className="object-cover" />
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center h-full gap-2">
                                                            <FileText className="h-10 w-10 text-primary" />
                                                            <span className="text-[10px] font-bold text-primary truncate max-w-[150px]">{previews[field.id].file.name}</span>
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center">
                                                        <Button 
                                                            type="button" 
                                                            variant="destructive" 
                                                            size="icon" 
                                                            className="rounded-full h-8 w-8"
                                                            onClick={() => setPreviews(prev => { const n = {...prev}; delete n[field.id]; return n; })}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <UploadCloud className="h-8 w-8 text-muted-foreground opacity-30 group-hover/drop:scale-110 group-hover/drop:text-primary transition-all" />
                                                    <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60">اسحب الفاتورة هنا</p>
                                                </>
                                            )}
                                            <input 
                                                type="file" 
                                                className="absolute inset-0 opacity-0 cursor-pointer" 
                                                onChange={(e) => handleFileDrop(field.id, e.target.files)}
                                                accept="image/*,.pdf"
                                                disabled={isSaving}
                                            />
                                        </div>
                                    </div>

                                    <div className="lg:col-span-1 flex items-center justify-center">
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => remove(index)} 
                                            disabled={fields.length <= 1 || isSaving}
                                            className="h-10 w-10 text-destructive hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => append({ id: generateStableId(), description: '', amount: '', projectId: '', clientId: '' } as any)} 
                            disabled={isSaving} 
                            className="w-full h-14 border-dashed border-2 rounded-3xl gap-3 font-black text-primary hover:bg-primary/5 transition-all shadow-sm active:scale-[0.99]"
                        >
                            <PlusCircle className="h-6 w-6 text-primary" /> إضافة فاتورة مصروف أخرى
                        </Button>
                    </div>

                    <div className="grid gap-3 p-8 bg-white/40 rounded-[2.5rem] border-2 border-dashed border-muted-foreground/10">
                        <Label className="font-black text-gray-700 pr-2">ملاحظات إضافية للمحاسب المالي</Label>
                        <Textarea 
                            {...register('notes')} 
                            placeholder="اشرح أي تفاصيل إضافية حول المصروفات المرفوعة..." 
                            className="rounded-3xl border-none shadow-inner text-base p-6 min-h-[120px]" 
                            disabled={isSaving}
                        />
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between gap-4 p-10 border-t bg-muted/10 rounded-b-[2.5rem]">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">الرصيد المتبقي بعد التسوية:</Label>
                        <p className={cn(
                            "text-3xl font-black font-mono tracking-tight", 
                            custodyBalance - totalSpent < 0 ? "text-red-600" : "text-green-600"
                        )}>
                            {formatCurrency(custodyBalance - totalSpent)}
                        </p>
                    </div>
                    <Button 
                        type="submit" 
                        disabled={isSaving || totalSpent === 0} 
                        className="h-16 px-20 rounded-3xl font-black text-2xl shadow-2xl shadow-primary/30 min-w-[350px] gap-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="animate-spin h-8 w-8"/>
                                <span>جاري المعالجة...</span>
                            </>
                        ) : (
                            <>
                                <Save className="h-8 w-8"/>
                                <span>اعتماد وإرسال للمراجعة</span>
                            </>
                        )}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}