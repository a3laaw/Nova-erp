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
import { Loader2, Save, Sparkles, Clock, Calculator, Info, History, ArrowRight, AlertCircle } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useBranding } from '@/context/branding-context';
import { calculateWorkingDays, calculateAnnualLeaveBalance } from '@/services/leave-calculator';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useSubscription } from '@/hooks/use-subscription';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toFirestoreDate } from '@/services/date-converter';
import { format, formatDistanceToNow, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn, formatCurrency, getTenantPath } from '@/lib/utils';

const leaveTypeTranslations: Record<string, string> = {
    'Annual': 'سنوية',
    'Sick': 'مرضية',
    'Emergency': 'طارئة',
    'Unpaid': 'بدون أجر'
};

export default function NewLeaveRequestPage() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tenantId = currentUser?.currentCompanyId;

    const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
    const { data: publicHolidays, loading: holidaysLoading } = useSubscription<Holiday>(firestore, 'holidays');
    const { branding, loading: brandingLoading } = useBranding();

    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [leaveType, setLeaveType] = useState<'Annual' | 'Sick' | 'Emergency' | 'Unpaid'>('Annual');
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [notes, setNotes] = useState('');
    const [passportReceived, setPassportReceived] = useState(false);
    
    const [lastLeaveInfo, setLastLeaveInfo] = useState<LeaveRequest | null>(null);
    const [overlapError, setOverlapError] = useState<string | null>(null);
    const [loadingContext, setLoadingContext] = useState(false);
    const [hasCheckedContext, setHasCheckedContext] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);

    useEffect(() => {
        const employeeIdFromUrl = searchParams.get('employeeId');
        if (employeeIdFromUrl) {
            setSelectedEmployeeId(employeeIdFromUrl);
        } else if (currentUser && currentUser.role !== 'Admin' && currentUser.role !== 'HR') {
            setSelectedEmployeeId(currentUser.employeeId || '');
        }
    }, [currentUser, searchParams]);

    useEffect(() => {
        if (startDate && endDate && isBefore(startOfDay(endDate), startOfDay(startDate))) {
            setEndDate(undefined);
            toast({
                variant: 'destructive',
                title: 'تنبيه تاريخ',
                description: 'عذراً، تاريخ نهاية الإجازة يجب أن يكون بعد تاريخ البداية.',
            });
        }
        setOverlapError(null);
    }, [startDate, endDate, toast]);

    useEffect(() => {
        if (!firestore || !selectedEmployeeId || !tenantId) {
            setLastLeaveInfo(null);
            setHasCheckedContext(false);
            return;
        }

        const fetchLastLeave = async () => {
            setLoadingContext(true);
            try {
                const leaveCollectionPath = getTenantPath('leaveRequests', tenantId);
                const q = query(
                    collection(firestore, leaveCollectionPath),
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
    }, [firestore, selectedEmployeeId, tenantId]);

    const loading = employeesLoading || holidaysLoading || brandingLoading;

    const leaveAnalysis = useMemo(() => {
        if (!startDate || !endDate || isBefore(startOfDay(endDate), startOfDay(startDate))) {
            return { totalDays: 0, workingDays: 0, paidDays: 0, unpaidDays: 0 };
        }
        
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

        if (!firestore || !currentUser || !tenantId || !selectedEmployeeId || !leaveType || !startDate || !endDate) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء تعبئة جميع الحقول المطلوبة.' });
            return;
        }

        const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
        if (!selectedEmployee) {
             toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم العثور على الموظف.' });
            return;
        }

        savingRef.current = true;
        setIsSaving(true);
        setOverlapError(null);

        try {
            const leaveCollectionPath = getTenantPath('leaveRequests', tenantId);
            
            // 🛡️ رادار منع التداخل: فحص وجود طلبات أخرى 🛡️
            const overlapQuery = query(
                collection(firestore, leaveCollectionPath),
                where('employeeId', '==', selectedEmployeeId),
                where('status', 'in', ['pending', 'approved', 'on-leave'])
            );
            const overlapSnap = await getDocs(overlapQuery);
            const hasOverlap = overlapSnap.docs.some(docSnap => {
                const existing = docSnap.data() as LeaveRequest;
                const exStart = toFirestoreDate(existing.startDate);
                const exEnd = toFirestoreDate(existing.endDate);
                if (!exStart || !exEnd) return false;
                
                const requestedStart = startOfDay(startDate);
                const requestedEnd = endOfDay(endDate);
                const currentStart = startOfDay(exStart);
                const currentEnd = endOfDay(exEnd);

                return (requestedStart <= currentEnd && requestedEnd >= currentStart);
            });

            if (hasOverlap) {
                const errorMsg = "عذراً، يوجد إجازة أخرى مسجلة للموظف في نفس هذا التوقيت، يرجى مراجعة التواريخ المحددة.";
                setOverlapError(errorMsg);
                toast({ 
                    variant: 'destructive', 
                    title: 'تنبيه تداخل', 
                    description: errorMsg 
                });
                setIsSaving(false);
                savingRef.current = false;
                return;
            }

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
                companyId: tenantId
            };

            await addDoc(collection(firestore, leaveCollectionPath), newRequest);
            toast({ title: 'نجاح', description: 'تم إرسال طلب الإجازة بنجاح.' });
            router.push('/dashboard/hr/leaves');
        } catch (error) {
            savingRef.current = false;
            setIsSaving(false);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الطلب، يرجى المحاولة مرة أخرى.' });
        }
    };
    
    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20" dir="rtl">
            <div className="no-print flex items-center justify-between mb-4">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-bold">
                    <ArrowRight className="h-4 w-4" /> العودة
                </Button>
            </div>

            <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
                <form onSubmit={handleSubmit}>
                    <CardHeader className="bg-primary/5 pb-8 border-b">
                        <CardTitle className="text-2xl font-black">تقديم طلب إجازة جديد</CardTitle>
                        <CardDescription className="text-base">تحديد التواريخ لضمان دقة رصيد الإجازات وسجل الحضور.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        {overlapError && (
                            <Alert variant="destructive" className="rounded-3xl border-2 border-red-500 bg-red-50 shadow-sm animate-in zoom-in-95 py-6">
                                <AlertCircle className="h-6 w-6 text-red-600" />
                                <AlertTitle className="text-lg font-black text-red-800">تنبيه تداخل مواعيد</AlertTitle>
                                <AlertDescription className="text-sm font-bold text-red-700 mt-2 leading-relaxed">
                                    {overlapError}
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="grid gap-2">
                            <Label className="font-black text-gray-700 pr-1">الموظف المعني *</Label>
                            {isAdmin ? (
                                <InlineSearchList
                                    value={selectedEmployeeId}
                                    onSelect={setSelectedEmployeeId}
                                    options={employeeOptions}
                                    placeholder={loading ? 'جاري التحميل...' : 'اختر موظفاً من القائمة...'}
                                    disabled={loading || isSaving}
                                    className="h-12 rounded-xl border-2"
                                />
                            ) : (
                                <div className="h-12 rounded-xl border-2 bg-muted/20 px-4 flex items-center font-black text-[#1e1b4b] gap-2">
                                    <User className="h-4 w-4 opacity-40" />
                                    {currentUser?.fullName}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="grid gap-2">
                                <Label className="font-black text-gray-700 pr-1">نوع الإجازة *</Label>
                                <Select value={leaveType} onValueChange={(v) => setLeaveType(v as any)} disabled={isSaving}>
                                    <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue/></SelectTrigger>
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
                                <Label className="font-black text-gray-700 pr-1">من تاريخ *</Label>
                                <DateInput value={startDate} onChange={setStartDate} disabled={isSaving} className="h-12 rounded-xl" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="font-black text-gray-700 pr-1">إلى تاريخ *</Label>
                                <DateInput value={endDate} onChange={setEndDate} disabled={isSaving} className="h-12 rounded-xl" />
                            </div>
                        </div>

                        {leaveDuration.totalDays > 0 && (
                            <div className="text-sm font-black text-primary p-6 bg-primary/5 rounded-3xl border-2 border-dashed border-primary/20 flex justify-around animate-in zoom-in-95">
                                <div className="text-center">
                                    <p className="text-[10px] uppercase opacity-60">إجمالي الأيام</p>
                                    <p className="text-2xl">{leaveDuration.totalDays} يوم</p>
                                </div>
                                <Separator orientation="vertical" className="h-10 bg-primary/20" />
                                <div className="text-center">
                                    <p className="text-[10px] uppercase opacity-60">أيام العمل</p>
                                    <p className="text-2xl">{leaveDuration.workingDays} يوم</p>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label className="font-bold text-gray-700 pr-1">السبب / ملاحظات الطلب *</Label>
                            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} required rows={3} className="rounded-2xl border-2 p-4 text-base font-medium" placeholder="اذكر سبب الإجازة..." disabled={isSaving} />
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted/10 p-8 border-t flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSaving} className="h-12 px-8 font-bold">إلغاء</Button>
                        <Button type="submit" disabled={isSaving || loading || !!overlapError} className="h-14 px-16 rounded-2xl font-black text-xl shadow-xl shadow-primary/30 gap-3 min-w-[280px]">
                            {isSaving ? <Loader2 className="animate-spin h-6 w-6"/> : <Save className="h-6 w-6" />}
                            إرسال الطلب للمراجعة
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
