
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
import { Loader2, Save, CalendarCheck, ArrowRight, AlertCircle, User, Calculator, Sparkles } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc } from 'firebase/firestore';
import { useBranding } from '@/context/branding-context';
import { calculateWorkingDays } from '@/services/leave-calculator';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toFirestoreDate } from '@/services/date-converter';
import { startOfDay, endOfDay, isBefore } from 'date-fns';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { createNotification } from '@/services/notification-service';

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
    const { data: publicHolidays = [], loading: holidaysLoading } = useSubscription<Holiday>(firestore, 'holidays');
    const { branding, loading: brandingLoading } = useBranding();

    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [leaveType, setLeaveType] = useState<'Annual' | 'Sick' | 'Emergency' | 'Unpaid'>('Annual');
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [notes, setNotes] = useState('');
    
    const [overlapError, setOverlapError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);

    // 🛡️ تعريف صلاحية الإدارة (Sovereign Authority Logic)
    const isAdmin = useMemo(() => 
        ['Admin', 'HR', 'Developer'].includes(currentUser?.role || '')
    , [currentUser]);

    useEffect(() => {
        const employeeIdFromUrl = searchParams.get('employeeId');
        if (employeeIdFromUrl) {
            setSelectedEmployeeId(employeeIdFromUrl);
        } else if (currentUser && !isAdmin) {
            setSelectedEmployeeId(currentUser.employeeId || '');
        }
    }, [currentUser, searchParams, isAdmin]);

    useEffect(() => {
        if (startDate && endDate && isBefore(startOfDay(endDate), startOfDay(startDate))) {
            setEndDate(undefined);
            toast({
                variant: 'destructive',
                title: 'تنبيه تاريخ',
                description: 'تاريخ نهاية الإجازة يجب أن يكون لاحقاً لتاريخ البداية.',
            });
        }
        setOverlapError(null);
    }, [startDate, endDate, toast]);

    useEffect(() => {
        if (!firestore || !selectedEmployeeId || !startDate || !endDate || !tenantId) return;

        const checkOverlaps = async () => {
            try {
                const leavePath = getTenantPath('leaveRequests', tenantId);
                const q = query(
                    collection(firestore, leavePath),
                    where('employeeId', '==', selectedEmployeeId)
                );
                const snap = await getDocs(q);
                
                const hasOverlap = snap.docs.some(docSnap => {
                    const existing = docSnap.data() as LeaveRequest;
                    if (!['pending', 'approved', 'on-leave'].includes(existing.status)) return false;
                    const exStart = toFirestoreDate(existing.startDate);
                    const exEnd = toFirestoreDate(existing.endDate);
                    return (exStart && exEnd && startOfDay(startDate) <= endOfDay(exEnd) && endOfDay(endDate) >= startOfDay(exStart));
                });

                if (hasOverlap) setOverlapError("عذراً، يوجد إجازة أخرى مسجلة للموظف في نفس هذا التوقيت.");
                else setOverlapError(null);
            } catch (e) { console.error(e); }
        };
        checkOverlaps();
    }, [selectedEmployeeId, startDate, endDate, firestore, tenantId]);

    const loading = employeesLoading || holidaysLoading || brandingLoading;

    const leaveDuration = useMemo(() => {
        if (!startDate || !endDate || startDate > endDate) {
            return { totalDays: 0, workingDays: 0 };
        }
        return calculateWorkingDays(startDate, endDate, branding?.work_hours?.holidays || [], publicHolidays);
    }, [startDate, endDate, branding, publicHolidays]);

    const employeeOptions = useMemo(() => (employees || []).map(e => ({ value: e.id!, label: e.fullName })), [employees]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (savingRef.current) return;

        if (!firestore || !currentUser || !tenantId || !selectedEmployeeId || !startDate || !endDate) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء تعبئة جميع الحقول المطلوبة.' });
            return;
        }

        savingRef.current = true;
        setIsSaving(true);

        try {
            const leavePath = getTenantPath('leaveRequests', tenantId);
            const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || { fullName: currentUser.fullName };
            
            const dataToSave = {
                employeeId: selectedEmployeeId,
                employeeName: (selectedEmployee as any).fullName,
                leaveType: leaveType,
                startDate: startDate,
                endDate: endDate,
                days: leaveDuration.totalDays,
                workingDays: leaveDuration.workingDays,
                notes: notes,
                status: 'pending' as const,
                createdAt: serverTimestamp(),
                companyId: tenantId
            };

            const newDocRef = await addDoc(collection(firestore, leavePath), cleanFirestoreData(dataToSave));
            
            const usersPath = getTenantPath('users', tenantId);
            const adminHRUsersQuery = query(collection(firestore, usersPath), where('role', 'in', ['Admin', 'HR']));
            const adminsSnap = await getDocs(adminHRUsersQuery);
            
            adminsSnap.forEach(adminDoc => {
                if (adminDoc.id !== currentUser.id) {
                    createNotification(firestore, {
                        userId: adminDoc.id,
                        title: 'طلب إجازة جديد',
                        body: `قدم الموظف ${(selectedEmployee as any).fullName} طلب إجازة ${leaveTypeTranslations[leaveType]}.`,
                        link: `/dashboard/hr/leaves/${newDocRef.id}`
                    });
                }
            });

            toast({ title: 'تم تقديم الطلب', description: 'تم إخطار الإدارة بطلبك بنجاح.' });
            router.push('/dashboard/hr/leaves');
        } catch (error) {
            setIsSaving(false);
            savingRef.current = false;
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        }
    };
    
    if (loading) return <div className="p-8 max-w-4xl mx-auto"><Skeleton className="h-96 w-full rounded-[2.5rem]" /></div>;

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20" dir="rtl">
            <div className="no-print flex items-center justify-between mb-4 px-2">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-bold">
                    <ArrowRight className="h-4 w-4" /> العودة
                </Button>
            </div>

            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                <form onSubmit={handleSubmit}>
                    <CardHeader className="bg-primary/5 pb-8 border-b">
                        <CardTitle className="text-2xl font-black">تقديم طلب إجازة جديد</CardTitle>
                        <CardDescription className="text-base font-medium">تحديد التواريخ لضمان دقة الرصيد وسجل الحضور.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        {overlapError && (
                            <Alert variant="destructive" className="rounded-3xl border-2 border-red-500 bg-red-50 py-6 animate-in zoom-in-95">
                                <AlertCircle className="h-6 w-6 text-red-600" />
                                <AlertTitle className="text-lg font-black text-red-800">تنبيه تداخل مواعيد</AlertTitle>
                                <AlertDescription className="text-sm font-bold text-red-700 mt-2">{overlapError}</AlertDescription>
                            </Alert>
                        )}

                        <div className="grid gap-2">
                            <Label className="font-black text-gray-700 pr-1">الموظف المعني *</Label>
                            {isAdmin ? (
                                <InlineSearchList
                                    value={selectedEmployeeId}
                                    onSelect={setSelectedEmployeeId}
                                    options={employeeOptions}
                                    placeholder="اختر موظفاً من القائمة..."
                                    disabled={isSaving}
                                    className="h-12 rounded-xl border-2"
                                />
                            ) : (
                                <div className="h-12 rounded-xl border-2 bg-muted/20 px-4 flex items-center font-black text-[#1e1b4b] gap-2">
                                    <User className="h-4 w-4 opacity-40" />
                                    {currentUser?.fullName}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
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
                            <div className="grid gap-2 text-center">
                                <Label className="font-bold text-xs opacity-50">أيام العمل المحتسبة</Label>
                                <div className="h-12 rounded-xl bg-primary/5 border-2 border-dashed border-primary/20 flex items-center justify-center font-black text-primary text-xl">
                                    {leaveDuration.workingDays} يوم
                                </div>
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

                        <div className="grid gap-2">
                            <Label className="font-bold text-gray-700 pr-1">السبب / ملاحظات إضافية *</Label>
                            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} required rows={3} className="rounded-2xl border-2 p-4" placeholder="اذكر سبب الإجازة بوضوح..." disabled={isSaving} />
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted/10 p-8 border-t flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving} className="h-12 px-8 font-bold">إلغاء</Button>
                        <Button type="submit" disabled={isSaving || !!overlapError} className="h-14 px-16 rounded-2xl font-black text-xl shadow-xl shadow-primary/30 gap-3 min-w-[280px]">
                            {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                            إرسال الطلب
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
