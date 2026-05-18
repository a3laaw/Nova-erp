'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { Loader2, Save, X, AlertCircle, CalendarRange } from 'lucide-react';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, updateDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { useBranding } from '@/context/branding-context';
import { calculateWorkingDays } from '@/services/leave-calculator';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { toFirestoreDate } from '@/services/date-converter';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { isBefore, startOfDay, endOfDay } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getTenantPath } from '@/lib/utils';

export default function EditLeaveRequestPage() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const tenantId = currentUser?.currentCompanyId;

    const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');
    const { data: publicHolidays, loading: holidaysLoading } = useSubscription<Holiday>(firestore, 'holidays');
    const { branding, loading: brandingLoading } = useBranding();
    
    const leaveRequestRef = useMemo(() => firestore && id ? doc(firestore, 'leaveRequests', id) : null, [firestore, id]);
    const { data: leaveRequest, loading: leaveLoading } = useDocument<LeaveRequest>(firestore, leaveRequestRef?.path || null);
    
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [leaveType, setLeaveType] = useState<'Annual' | 'Sick' | 'Emergency' | 'Unpaid'>('Annual');
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [notes, setNotes] = useState('');
    const [passportReceived, setPassportReceived] = useState(false);
    const [overlapError, setOverlapError] = useState<string | null>(null);
    
    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);

    useEffect(() => {
        if (leaveRequest) {
            setSelectedEmployeeId(leaveRequest.employeeId);
            setLeaveType(leaveRequest.leaveType);
            setStartDate(toFirestoreDate(leaveRequest.startDate) || undefined);
            setEndDate(toFirestoreDate(leaveRequest.endDate) || undefined);
            setNotes(leaveRequest.notes || '');
            setPassportReceived(leaveRequest.passportReceived || false);
        }
    }, [leaveRequest]);

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

    const loading = employeesLoading || holidaysLoading || brandingLoading || leaveLoading;

    const leaveAnalysis = useMemo(() => {
        if (!startDate || !endDate || isBefore(startOfDay(endDate), startOfDay(startDate))) return { totalDays: 0, workingDays: 0 };
        return calculateWorkingDays(startDate, endDate, branding?.work_hours?.holidays || [], publicHolidays);
    }, [startDate, endDate, branding, publicHolidays]);

    const employeeOptions = useMemo(() => (employees || []).map(e => ({ value: e.id!, label: e.fullName })), [employees]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (savingRef.current) return;

        if (!firestore || !currentUser || !id || !selectedEmployeeId || !leaveType || !startDate || !endDate || !tenantId) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء تعبئة الحقول المطلوبة.' });
            return;
        }

        savingRef.current = true;
        setIsSaving(true);
        setOverlapError(null);
        
        try {
            const leaveCollectionPath = getTenantPath('leaveRequests', tenantId);
            const overlapQuery = query(
                collection(firestore, leaveCollectionPath),
                where('employeeId', '==', selectedEmployeeId),
                where('status', 'in', ['pending', 'approved', 'on-leave'])
            );
            const overlapSnap = await getDocs(overlapQuery);
            const hasOverlap = overlapSnap.docs.some(docSnap => {
                if (docSnap.id === id) return false;
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
                const errorMsg = "يوجد تداخل مع إجازة أخرى مسجلة للموظف في نفس التوقيت المختار.";
                setOverlapError(errorMsg);
                toast({ variant: 'destructive', title: 'تنبيه تداخل', description: errorMsg });
                setIsSaving(false);
                savingRef.current = false;
                return;
            }

            const leaveRef = doc(firestore, 'leaveRequests', id);
            await updateDoc(leaveRef, {
                employeeId: selectedEmployeeId,
                leaveType: leaveType,
                startDate: startDate,
                endDate: endDate,
                days: leaveAnalysis.totalDays,
                workingDays: leaveAnalysis.workingDays,
                notes: notes,
                passportReceived: passportReceived
            });
            
            toast({ title: 'نجاح', description: 'تم تحديث طلب الإجازة بنجاح.' });
            router.push('/dashboard/hr/leaves');
        } catch (error: any) {
            setIsSaving(false);
            savingRef.current = false;
            toast({ variant: 'destructive', title: 'خطأ', description: error.message || 'فشل التحديث.' });
        }
    };
    
    if (loading) return <div className="p-8"><Skeleton className="h-96 w-full rounded-[2.5rem]" /></div>;

    return (
        <Card className="max-w-4xl mx-auto rounded-[2.5rem] border-none shadow-xl overflow-hidden" dir="rtl">
            <form onSubmit={handleSubmit}>
                 <CardHeader className="bg-primary/5 pb-8 border-b">
                    <CardTitle className="text-2xl font-black">تعديل طلب إجازة</CardTitle>
                    <CardDescription className="text-base">تحديث بيانات الإجازة المجدولة للموظف.</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    {overlapError && (
                        <Alert variant="destructive" className="rounded-2xl border-2 border-red-500 bg-red-50 py-6 mb-4">
                            <AlertCircle className="h-6 w-6 text-red-600" />
                            <AlertTitle className="text-lg font-black text-red-800">تنبيه تداخل مواعيد</AlertTitle>
                            <AlertDescription className="text-sm font-bold text-red-700 mt-1">{overlapError}</AlertDescription>
                        </Alert>
                    )}

                    <div className="grid gap-2">
                        <Label className="font-bold text-gray-700 pr-1">الموظف المعني</Label>
                        <InlineSearchList
                            value={selectedEmployeeId}
                            onSelect={setSelectedEmployeeId}
                            options={employeeOptions}
                            placeholder="اختر..."
                            disabled={isSaving || !currentUser?.role.includes('Admin')}
                            className="h-11 rounded-xl"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="grid gap-2">
                        <Label className="font-bold text-gray-700 pr-1">نوع الإجازة *</Label>
                        <Select value={leaveType} onValueChange={(v) => setLeaveType(v as any)} disabled={isSaving}>
                            <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue/></SelectTrigger>
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
                        <Label className="font-bold text-gray-700 pr-1">من تاريخ *</Label>
                        <DateInput value={startDate} onChange={setStartDate} disabled={isSaving} className="h-11 rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label className="font-bold text-gray-700 pr-1">إلى تاريخ *</Label>
                        <DateInput value={endDate} onChange={setEndDate} disabled={isSaving} className="h-11 rounded-xl" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label className="font-bold text-gray-700 pr-1">المبررات / ملاحظات</Label>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="rounded-2xl border-2 p-4" disabled={isSaving} />
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/10 p-8 border-t flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSaving}>إلغاء</Button>
                    <Button type="submit" disabled={isSaving} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/20 gap-2">
                        {isSaving ? <Loader2 className="animate-spin h-5 w-5"/> : <Save className="h-5 w-5" />} حفظ التعديلات
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
