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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Save, X, PlusCircle, Trash2, Wallet, Target, User, UploadCloud, FileText, ImageIcon, ScrollText, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { useFirebase, useStorage } from '@/firebase';
import { useSubscription } from '@/hooks/use-subscription';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, where, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Employee, ConstructionProject, Client, Account, JournalEntry, CustodyReconciliation } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData, numberToArabicWords } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { useAppTheme } from '@/context/theme-context';
import { DateInput } from '@/components/ui/date-input';
import Image from 'next/image';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';

/**
 * دالة توليد المعرفات الفريدة
 */
const generateId = () => Math.random().toString(36).substring(2, 9);

/**
 * مخطط التحقق (Zod Schema) لتسوية العهدة
 */
const itemSchema = z.object({
  id: z.string(),
  description: z.string().min(1, "وصف المصروف مطلوب."),
  amount: z.preprocess((v) => parseFloat(String(v || '0')), z.number().positive("المبلغ مطلوب.")),
  projectId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
});

const reconciliationSchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  employeeId: z.string().min(1, "الموظف مطلوب."),
  items: z.array(itemSchema).min(1, 'يجب إضافة بند واحد على الأقل.'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof reconciliationSchema>;

interface PreviewFile {
    id: string;
    url: string;
    file: File;
}

/**
 * مكون منصة المعاينة الذكية (Smart Preview Deck):
 * - يظهر صورتين فقط والبقية عبر التمرير.
 * - عزل كامل لبكرة الماوس عن الصفحة الرئيسية (Scroll Isolation).
 * - معاينة منبثقة مكبرة "شفافة" (pointer-events-none) لا تعيق التمرير.
 */
function SmartPhotoGallery({ 
    itemId, 
    files, 
    onRemove, 
    isSaving 
}: { 
    itemId: string, 
    files: PreviewFile[], 
    onRemove: (fid: string) => void,
    isSaving: boolean 
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [hoveredImage, setHoveredImage] = useState<string | null>(null);

    // ✨ محرك عزل التمرير الجذري (Native Event Capture)
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                // منع التمرير العمودي للصفحة الرئيسية تماماً
                e.preventDefault();
                e.stopPropagation();
                
                // تحويل الحركة لبكرة الصور أفقياً (متوافق مع RTL)
                el.scrollLeft -= e.deltaY;
            }
        };

        // الربط بمستمع أحداث "غير سلبي" للسماح بمنع تمرير الصفحة
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [files.length]);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const scrollAmount = 180;
            scrollRef.current.scrollBy({ 
                left: direction === 'left' ? -scrollAmount : scrollAmount, 
                behavior: 'smooth' 
            });
        }
    };

    if (files.length === 0) {
        return (
            <div className="flex items-center justify-center w-full h-24 opacity-30 italic text-[10px] font-bold border-2 border-dashed rounded-2xl">
                بانتظار إرفاق المستندات...
            </div>
        );
    }

    return (
        <div className="relative group/gallery w-full">
            {/* أزرار التنقل السريع */}
            {files.length > 2 && (
                <>
                    <div className="absolute inset-y-0 -right-2 z-20 flex items-center opacity-0 group-hover/gallery:opacity-100 transition-opacity">
                        <Button 
                            type="button" 
                            variant="secondary" 
                            size="icon" 
                            className="h-6 w-6 rounded-full shadow-lg bg-white/90 border border-primary/20"
                            onClick={() => scroll('right')}
                        >
                            <ChevronRight className="h-3 w-3 text-primary" />
                        </Button>
                    </div>
                    <div className="absolute inset-y-0 -left-2 z-20 flex items-center opacity-0 group-hover/gallery:opacity-100 transition-opacity">
                        <Button 
                            type="button" 
                            variant="secondary" 
                            size="icon" 
                            className="h-6 w-6 rounded-full shadow-lg bg-white/90 border border-primary/20"
                            onClick={() => scroll('left')}
                        >
                            <ChevronLeft className="h-3 w-3 text-primary" />
                        </Button>
                    </div>
                </>
            )}

            {/* حاوية الصور (كادر الرؤية الثنائي) */}
            <div 
                ref={scrollRef}
                className="flex p-2 gap-3 overflow-x-auto scrollbar-none bg-muted/10 rounded-2xl border-2 border-white shadow-inner h-24 items-center max-w-[185px] mx-auto overflow-y-hidden"
                style={{ scrollBehavior: 'smooth' }}
            >
                {files.map((p) => (
                    <div 
                        key={p.id} 
                        className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-white shadow-sm flex-shrink-0 animate-in zoom-in-95 group/img cursor-zoom-in"
                        onMouseEnter={() => p.file.type.startsWith('image/') && setHoveredImage(p.url)}
                        onMouseLeave={() => setHoveredImage(null)}
                    >
                        {p.file.type.startsWith('image/') ? (
                            <Image src={p.url} alt="Receipt" fill className="object-cover" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full bg-indigo-50">
                                <FileText className="h-6 w-6 text-indigo-600" />
                                <span className="text-[7px] font-black text-indigo-800 truncate px-1 w-full text-center">{p.file.name}</span>
                            </div>
                        )}
                        <button 
                            type="button" 
                            onClick={() => onRemove(p.id)}
                            disabled={isSaving}
                            className="absolute top-0.5 left-0.5 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity shadow-md z-20"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                ))}
            </div>

            {/* ✨ المعاينة المنبثقة الخاطفة (Pointer Events None) - لا تعيق التمرير ✨ */}
            {hoveredImage && (
                <div className="fixed z-[9999] pointer-events-none animate-in fade-in zoom-in-95 duration-200"
                     style={{ 
                         top: '50%', 
                         left: '50%', 
                         transform: 'translate(-50%, -50%)',
                         pointerEvents: 'none' 
                     }}>
                    <div className="relative w-[400px] h-[400px] rounded-[2.5rem] overflow-hidden border-8 border-white shadow-[0_0_50px_rgba(0,0,0,0.3)] bg-white">
                        <Image src={hoveredImage} alt="Large Preview" fill className="object-contain p-4" />
                        <div className="absolute bottom-0 left-0 right-0 bg-primary/80 backdrop-blur-md p-3 text-center">
                            <p className="text-white font-black text-xs">معاينة خاطفة للفاتورة</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export function CustodyReconciliationForm() {
    const { firestore, storage } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const { theme } = useAppTheme();

    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);
    const [custodyBalance, setCustodyBalance] = useState(0);
    const [loadingBalance, setLoadingBalance] = useState(false);
    
    const [previews, setPreviews] = useState<Record<string, PreviewFile[]>>({});

    const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
    const { data: projects = [], loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, 'projects', [where('status', '==', 'قيد التنفيذ')]);
    const { data: clients = [], loading: clientsLoading } = useSubscription<Client>(firestore, 'clients', [orderBy('nameAr')]);
    const { data: accounts = [] } = useSubscription<Account>(firestore, 'chartOfAccounts', [orderBy('code')]);

    const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(reconciliationSchema),
        defaultValues: {
            date: new Date(),
            employeeId: currentUser?.role !== 'Admin' ? currentUser?.employeeId : '',
            items: [{ id: generateId(), description: '', amount: '', projectId: '', clientId: '' } as any],
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

    const handleFileDrop = (itemId: string, files: FileList | null) => {
        if (!files || files.length === 0) return;
        
        const newFiles: PreviewFile[] = Array.from(files).map(file => ({
            id: generateId(),
            url: URL.createObjectURL(file),
            file: file
        }));

        setPreviews(prev => ({ 
            ...prev, 
            [itemId]: [...(prev[itemId] || []), ...newFiles] 
        }));
    };

    const removeFile = (itemId: string, fileId: string) => {
        setPreviews(prev => ({
            ...prev,
            [itemId]: (prev[itemId] || []).filter(f => f.id !== fileId)
        }));
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
                const attachmentUrls: string[] = [];
                const filesForThisItem = previews[item.id] || [];
                
                for (const fileData of filesForThisItem) {
                    const storageRef = ref(storage, `reconciliations/${currentUser.id}/${Date.now()}_${fileData.file.name}`);
                    const uploadResult = await uploadBytes(storageRef, fileData.file);
                    const url = await getDownloadURL(uploadResult.ref);
                    attachmentUrls.push(url);
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
                    attachmentUrls: attachmentUrls
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
            router.push('/dashboard/hr/custody-reconciliation');
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

    const isGlass = theme === 'glass';

    return (
        <Card className={cn("max-w-5xl mx-auto rounded-[2.5rem] border-none shadow-2xl overflow-hidden", isGlass && "glass-effect")} dir="rtl">
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardHeader className="bg-primary/5 pb-8 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><Wallet className="h-8 w-8"/></div>
                        <div>
                            <CardTitle className="text-2xl font-black text-slate-900">تسوية عهدة نقدية (منصة الميدان)</CardTitle>
                            <CardDescription className="text-base font-medium">وثق مصروفاتك وارفع صور الفواتير؛ سيقوم المحاسب بربطها محاسبياً لاحقاً.</CardDescription>
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
                                <Label className="text-[10px] font-black uppercase text-primary">الرصيد المتاح حالياً</Label>
                                <p className="text-2xl font-black text-primary font-mono">
                                    {loadingBalance ? <Loader2 className="h-4 w-4 animate-spin"/> : formatCurrency(custodyBalance)}
                                </p>
                            </div>
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary font-black">KD</div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex justify-between items-center px-2">
                            <Label className="text-xl font-black flex items-center gap-2 text-foreground">
                                <ScrollText className="h-5 w-5 text-primary" /> قائمة بنود المصروفات
                            </Label>
                            <Badge variant="outline" className="font-bold border-primary/20 text-primary bg-primary/5 px-4 h-7 rounded-full">
                                {fields.length} بنود مدرجة
                            </Badge>
                        </div>

                        <div className="space-y-6">
                            {fields.map((field, index) => {
                                const rowItem = watchedItems?.[index];
                                const lineTotal = (Number(rowItem?.amount) || 0);
                                return (
                                <div key={field.id} className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-8 bg-white border-2 rounded-[2.5rem] shadow-sm hover:shadow-md transition-all group relative">
                                    
                                    <div className="lg:col-span-4 space-y-4">
                                        <div className="grid gap-1.5">
                                            <Label className="text-[10px] font-black text-muted-foreground uppercase pr-1">بيان المصروف *</Label>
                                            <Input 
                                                {...register(`items.${index}.description`)} 
                                                placeholder="مثال: فاتورة بنزين، صيانة طارئة..." 
                                                className="h-11 rounded-xl border-2 font-bold bg-muted/5 shadow-inner" 
                                                disabled={isSaving}
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label className="text-[10px] font-black text-muted-foreground uppercase pr-1 flex items-center gap-1">
                                                <Target className="h-3 w-3" /> الارتباط بمشروع / مركز تكلفة
                                            </Label>
                                            <Controller
                                                control={control}
                                                name={`items.${index}.projectId`}
                                                render={({ field: projField }) => (
                                                    <InlineSearchList 
                                                        value={projField.value || ''} 
                                                        onSelect={projField.onChange} 
                                                        options={combinedEntityOptions} 
                                                        placeholder="اختر المشروع (اختياري)..." 
                                                        className="h-11 rounded-xl border-dashed"
                                                        disabled={isSaving}
                                                    />
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="lg:col-span-2 flex flex-col justify-center gap-1.5 px-4 lg:border-r lg:border-l">
                                        <Label className="text-[10px] font-black text-primary uppercase text-center">المبلغ المستحق</Label>
                                        <Input 
                                            type="number" 
                                            step="any" 
                                            {...register(`items.${index}.amount`)} 
                                            onWheel={(e) => e.currentTarget.blur()}
                                            disabled={isSaving}
                                            placeholder="0.000"
                                            className="h-14 text-2xl font-black text-primary text-center rounded-2xl border-2 border-primary/20 bg-primary/[0.02] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                        />
                                    </div>

                                    <div className="lg:col-span-5 space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase pr-1">الفواتير والمرفقات (بالبكرة)</Label>
                                        
                                        <div className="flex gap-3 items-center">
                                            <div 
                                                className="w-20 h-24 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 shrink-0 transition-all cursor-pointer relative bg-muted/30 border-muted-foreground/20 hover:bg-muted/50"
                                            >
                                                <UploadCloud className="h-5 w-5 text-primary opacity-40" />
                                                <span className="text-[8px] font-black text-primary text-center leading-tight">إدراج</span>
                                                <input 
                                                    type="file" 
                                                    multiple
                                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                                    onChange={(e) => handleFileDrop(field.id, e.target.files)}
                                                    accept="image/*,.pdf"
                                                    disabled={isSaving}
                                                />
                                            </div>

                                            <SmartPhotoGallery 
                                                itemId={field.id} 
                                                files={previews[field.id] || []} 
                                                onRemove={(fid) => removeFile(field.id, fid)} 
                                                isSaving={isSaving}
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
                            )})}
                        </div>

                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => append({ id: generateId(), description: '', amount: '', projectId: '', clientId: '' } as any)} 
                            disabled={isSaving} 
                            className="w-full h-14 border-dashed border-2 rounded-[2rem] gap-3 font-black text-primary hover:bg-primary/5 transition-all shadow-sm"
                        >
                            <PlusCircle className="h-6 w-6 text-primary" /> إضافة بند مصروف إضافي للتسوية
                        </Button>
                    </div>

                    <div className="grid gap-3 p-8 bg-white/40 rounded-[2.5rem] border-2 border-dashed border-muted-foreground/10">
                        <Label className="font-black text-gray-700 pr-2">ملاحظات إضافية للمحاسب</Label>
                        <Textarea {...register('notes')} placeholder="أدخل أي توضيحات إضافية حول المصروفات المذكورة..." className="rounded-2xl border-none shadow-inner text-base p-6 min-h-[120px]" rows={3} disabled={isSaving}/>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between gap-4 p-10 border-t bg-muted/10 rounded-b-[2.5rem]">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">الرصيد المتبقي المتوقع:</Label>
                        <p className={cn("text-3xl font-black font-mono tracking-tight transition-colors", custodyBalance - totalSpent < 0 ? "text-red-600" : "text-green-600")}>
                            {formatCurrency(custodyBalance - totalSpent)}
                        </p>
                    </div>
                    <Button 
                        type="submit" 
                        disabled={isSaving || totalSpent === 0} 
                        className="h-16 px-20 rounded-3xl font-black text-2xl shadow-2xl shadow-primary/30 min-w-[350px] gap-4"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="animate-spin h-8 w-8"/>
                                <span>جاري الحفظ والرفع...</span>
                            </>
                        ) : (
                            <>
                                <Save className="h-8 w-8"/>
                                <span>اعتماد وإرسال التسوية</span>
                            </>
                        )}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
