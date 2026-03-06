'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import type { Employee, LeaveRequest, Holiday } from '@/lib/types';
import { Loader2, Save, Sparkles, Clock, Calculator, Info, History, ArrowRight } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useBranding } from '@/context/branding-context';
import { calculateWorkingDays, calculateAnnualLeaveBalance } from '@/services/leave-calculator';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useSubscription } from '@/hooks/use-subscription';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toFirestoreDate } from '@/services/date-converter';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn, formatCurrency } from '@/lib/utils';

export default function NewLeaveRequestPage() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');
    const { data: publicHolidays, loading: holidaysLoading } = useSubscription<Holiday>(firestore, 'holidays');
    const { branding, loading: brandingLoading } = useBranding();

    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [leaveType, setLeaveType] = useState<'Annual' | 'Sick' | 'Emergency' | 'Unpaid'>('Annual');
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [notes, setNotes] = useState('');
    const [passportReceived, setPassportReceived] = useState(false);
    
    const [lastLeaveInfo, setLastLeaveInfo] = useState<LeaveRequest | null>(null);
    const [loadingContext, setLoadingContext] = useState(false);
    const [hasCheckedContext, setHasCheckedContext] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);

    useEffect(() => {
        if (currentUser && currentUser.role !== 'Admin' && currentUser.role !== 'HR') {
            setSelectedEmployeeId(currentUser.employeeId);
        }
    }, [currentUser]);

    // ✨ محرك جلب السياق الذكي المطور (تجنب مشاكل الفهرسة عبر الفرز البرمجي)
    useEffect(() => {
        if (!firestore || !selectedEmployeeId) {
            setLastLeaveInfo(null);
            setHasCheckedContext(false);
            return;
        }

        const fetchLastLeave = async () => {
            setLoadingContext(true);
            try {
                // نكتفي بفلترة الموظف برمجياً لضمان عدم توقف الاستعلام بسبب نقص الفهارس المركبة
                const q = query(
                    collection(firestore, 'leaveRequests'),
                    where('employeeId', '==', selectedEmployeeId)
                );
                const snap = await getDocs(q);
                
                const history = snap.docs
                    .map(d => ({ id: d.id, ...d.data() } as LeaveRequest))
                    .filter(l => ['approved', 'on-leave', 'returned'].includes(l.status))
                    .sort((a, b) => {
                        const dateB = toFirestoreDate(b.endDate)?.getTime() || 0;
                        const dateA = toFirestoreDate(a.endDate)?.getTime() || 0;
                        return dateB - dateA;
                    });

                if (history.length > 0) {
                    setLastLeaveInfo(history[0]);
                } else {
                    setLastLeaveInfo(null);
                }
                setHasCheckedContext(true);
            } catch (e) {
                console.error("Context fetch failed:", e);
            } finally {
                setLoadingContext(false);
            }
        };

        fetchLastLeave();
    }, [firestore, selectedEmployeeId]);

    const loading = employeesLoading || holidaysLoading || brandingLoading;

    const leaveAnalysis = useMemo(() => {
        if (!startDate || !endDate) return { totalDays: 0, workingDays: 0, paidDays: 0, unpaidDays: 0 };
        
        const days = calculateWorkingDays(startDate, endDate, branding?.work_hours?.holidays || [], publicHolidays);
        const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
        
        if (!selectedEmployee || leaveType !== 'Annual') {
            return { ...days, paidDays: days.workingDays, unpaidDays: 0 };
        }

        const currentBalance = calculateAnnualLeaveBalance(selectedEmployee, new Date());
        const paidDays = Math.min(days.workingDays, currentBalance);
        const unpaidDays = Math.max(0, days.workingDays - paidDays);

        return { ...days, paidDays, unpaidDays };
    }, [startDate, endDate, branding, publicHolidays, employees, selectedEmployeeId, leaveType]);

    const employeeOptions = useMemo(() => (employees || []).map(e => ({ value: e.id!, label: e.fullName })), [employees]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (savingRef.current) return;

        if (!firestore || !currentUser || !selectedEmployeeId || !leaveType || !startDate || !endDate) {
            toast({ variant: 'destructive', title: 'حقول ناقصة', description: 'الرجاء تعبئة جميع الحقول المطلوبة.' });
            return;
        }

        const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
        if (!selectedEmployee) {
             toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم العثور على الموظف.' });
            return;
        }

        savingRef.current = true;
        setIsSaving(true);

        try {
            const newRequest = {
                employeeId: selectedEmployeeId,
                employeeName: selectedEmployee.fullName,
                leaveType: leaveType,
                startDate: startDate,
                endDate: endDate,
                days: leaveAnalysis.totalDays,
                workingDays: leaveAnalysis.workingDays,
                unpaidDays: leaveAnalysis.unpaidDays,
                notes: notes,
                passportReceived: passportReceived,
                status: 'pending' as const,
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(firestore, 'leaveRequests'), newRequest);
            toast({ title: 'نجاح', description: 'تم إرسال طلب الإجازة بنجاح.' });
            router.push('/dashboard/hr/leaves');
        } catch (error) {
            savingRef.current = false;
            setIsSaving(false);
            const message = error instanceof Error ? error.message : "فشل حفظ الطلب.";
            toast({ variant: 'destructive', title: 'خطأ', description: message });
        }
    };
    
    return (
        <Card className="max-w-2xl mx-auto rounded-[2.5rem] border-none shadow-xl overflow-hidden" dir="rtl">
            <form onSubmit={handleSubmit}>
                 <CardHeader className="bg-primary/5 pb-8 border-b">
                    <CardTitle className="text-2xl font-black">تقديم طلب إجازة جديد</CardTitle>
                    <CardDescription className="text-base">
                      سيتم إرسال الطلب للموافقة من قبل مدير النظام أو قسم الموارد البشرية.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                     {(currentUser?.role === 'Admin' || currentUser?.role === 'HR') && (
                      <div className="grid gap-2">
                        <Label htmlFor="employee" className="font-bold text-gray-700">الموظف <span className="text-destructive">*</span></Label>
                        <InlineSearchList
                            value={selectedEmployeeId}
                            onSelect={setSelectedEmployeeId}
                            options={employeeOptions}
                            placeholder={loading ? 'جاري التحميل...' : 'اختر موظفًا...'}
                            disabled={loading || isSaving}
                            className="h-12 rounded-xl"
                        />
                      </div>
                    )}

                    {!loadingContext && hasCheckedContext && selectedEmployeeId && (
                        lastLeaveInfo ? (
                            <Alert className="rounded-2xl border-2 border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-500">
                                <Sparkles className="h-5 w-5 text-primary" />
                                <AlertTitle className="text-primary font-black text-sm">سياق القرار (HR Insights)</AlertTitle>
                                <AlertDescription className="mt-1 text-xs font-bold leading-relaxed">
                                    كانت آخر إجازة لهذا الموظف من نوع <strong>{leaveTypeTranslations[lastLeaveInfo.leaveType]}</strong>، 
                                    انتهت بتاريخ <strong>{format(toFirestoreDate(lastLeaveInfo.endDate)!, 'dd/MM/yyyy')}</strong> 
                                    أي منذ <strong>{formatDistanceToNow(toFirestoreDate(lastLeaveInfo.endDate)!, { locale: ar })}</strong> تقريباً.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <Alert className="rounded-2xl border-2 border-slate-200 bg-slate-50 animate-in fade-in">
                                <History className="h-5 w-5 text-slate-400" />
                                <AlertTitle className="text-slate-600 font-bold text-xs">سجل الموظف</AlertTitle>
                                <AlertDescription className="text-xs text-slate-500 font-medium italic">
                                    هذا الموظف لم يسبق له الخروج في إجازة مسجلة بالنظام من قبل.
                                </AlertDescription>
                            </Alert>
                        )
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="grid gap-2">
                        <Label htmlFor="leaveType" className="font-bold text-gray-700">نوع الإجازة <span className="text-destructive">*</span></Label>
                        <Select value={leaveType} onValueChange={(v) => setLeaveType(v as any)} disabled={isSaving}>
                            <SelectTrigger id="leaveType" className="h-12 rounded-xl"><SelectValue/></SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="Annual">سنوية</SelectItem>
                                <SelectItem value="Sick">مرضية</SelectItem>
                                <SelectItem value="Emergency">طارئة</SelectItem>
                                <SelectItem value="Unpaid">بدون أجر</SelectItem>
                            </SelectContent>
                        </Select>
                      </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="grid gap-2">
                        <Label htmlFor="startDate" className="font-bold text-gray-700">من تاريخ <span className="text-destructive">*</span></Label>
                        <DateInput value={startDate} onChange={setStartDate} disabled={isSaving} className="h-12 rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="endDate" className="font-bold text-gray-700">إلى تاريخ <span className="text-destructive">*</span></Label>
                        <DateInput value={endDate} onChange={setEndDate} disabled={isSaving} className="h-12 rounded-xl" />
                      </div>
                    </div>

                    {leaveAnalysis.totalDays > 0 && (
                      <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                        <div className="text-sm font-bold p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col sm:flex-row justify-around gap-4 text-center">
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase text-muted-foreground tracking-widest">إجمالي الأيام</p>
                                <p className="text-2xl font-black">{leaveAnalysis.totalDays} يوم</p>
                            </div>
                            <Separator orientation="vertical" className="h-10 hidden sm:block mx-4" />
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase text-muted-foreground tracking-widest">أيام العمل الفعلية</p>
                                <p className="text-2xl font-black text-primary">{leaveAnalysis.workingDays} يوم</p>
                            </div>
                        </div>

                        {leaveType === 'Annual' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-green-50 border border-green-100 flex flex-col items-center gap-1">
                                    <Label className="text-[10px] font-black text-green-700 uppercase">خصم من الرصيد</Label>
                                    <p className="text-2xl font-black text-green-800 font-mono">{leaveAnalysis.paidDays} <span className="text-sm font-bold">يوم</span></p>
                                </div>
                                <div className={cn(
                                    "p-4 rounded-2xl border flex flex-col items-center gap-1 transition-all",
                                    leaveAnalysis.unpaidDays > 0 ? "bg-orange-50 border-orange-200 animate-pulse" : "bg-muted/30 border-muted opacity-40"
                                )}>
                                    <Label className={cn("text-[10px] font-black uppercase", leaveAnalysis.unpaidDays > 0 ? "text-orange-700" : "text-muted-foreground")}>بدون راتب (عجز رصيد)</Label>
                                    <p className={cn("text-2xl font-black font-mono", leaveAnalysis.unpaidDays > 0 ? "text-orange-800" : "text-muted-foreground")}>
                                        {leaveAnalysis.unpaidDays} <span className="text-sm font-bold">يوم</span>
                                    </p>
                                </div>
                            </div>
                        )}
                      </div>
                    )}

                     <div className="grid gap-2">
                      <Label htmlFor="notes" className="font-bold text-gray-700">السبب / ملاحظات <span className="text-destructive">*</span></Label>
                      <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} required rows={3} className="rounded-2xl border-2" placeholder="اشرح سبب طلب الإجازة..." disabled={isSaving} />
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse p-4 bg-muted/30 rounded-2xl border">
                        <Checkbox id="passportReceived" checked={passportReceived} onCheckedChange={(checked) => setPassportReceived(!!checked)} disabled={isSaving} />
                        <Label htmlFor="passportReceived" className="font-bold cursor-pointer text-gray-700">هل تم استلام جواز السفر من الموظف؟</Label>
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/10 p-8 border-t flex justify-end gap-3">
                     <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSaving} className="h-12 px-8 font-bold">إلغاء</Button>
                    <Button type="submit" disabled={isSaving || loading} className="h-14 px-16 rounded-2xl font-black text-xl shadow-xl shadow-primary/30 gap-3 min-w-[280px]">
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6"/> : <Save className="h-6 w-6" />}
                        {isSaving ? 'جاري الحفظ...' : 'إرسال طلب الإجازة'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
