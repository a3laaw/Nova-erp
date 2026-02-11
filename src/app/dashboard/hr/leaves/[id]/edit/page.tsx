// ADDED: نظام إجازات إلكتروني هجين مع طباعة نموذج ورقي للتوقيع اليدوي
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Loader2, Save } from 'lucide-react';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, doc, updateDoc, query } from 'firebase/firestore';
import { useBranding } from '@/context/branding-context';
import { calculateWorkingDays } from '@/services/leave-calculator';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { toFirestoreDate } from '@/services/date-converter';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

export default function EditLeaveRequestPage() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');
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
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (leaveRequest) {
            setSelectedEmployeeId(leaveRequest.employeeId);
            setLeaveType(leaveRequest.leaveType);
            setStartDate(toFirestoreDate(leaveRequest.startDate));
            setEndDate(toFirestoreDate(leaveRequest.endDate));
            setNotes(leaveRequest.notes || '');
            setPassportReceived(leaveRequest.passportReceived || false);
        }
    }, [leaveRequest]);

    const loading = employeesLoading || holidaysLoading || brandingLoading || leaveLoading;

    const leaveDuration = useMemo(() => {
        if (!startDate || !endDate) return { totalDays: 0, workingDays: 0 };
        return calculateWorkingDays(startDate, endDate, branding?.work_hours?.holidays || [], publicHolidays);
    }, [startDate, endDate, branding, publicHolidays]);

    const employeeOptions = useMemo(() => (employees || []).map(e => ({ value: e.id!, label: e.fullName })), [employees]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser || !id || !selectedEmployeeId || !leaveType || !startDate || !endDate) {
            toast({ variant: 'destructive', title: 'حقول ناقصة', description: 'الرجاء تعبئة جميع الحقول المطلوبة.' });
            return;
        }

        const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
        if (!selectedEmployee) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم العثور على الموظف.' });
            return;
        }

        setIsSaving(true);
        try {
            const leaveRef = doc(firestore, 'leaveRequests', id);
            await updateDoc(leaveRef, {
                employeeId: selectedEmployeeId,
                employeeName: selectedEmployee.fullName,
                leaveType: leaveType,
                startDate: startDate,
                endDate: endDate,
                days: leaveDuration.totalDays,
                workingDays: leaveDuration.workingDays,
                notes: notes,
                passportReceived: passportReceived
            });
            toast({ title: 'نجاح', description: 'تم تعديل طلب الإجازة بنجاح.' });
            router.push('/dashboard/hr/leaves');
        } catch (error) {
            const message = error instanceof Error ? error.message : "فشل تعديل الطلب.";
            toast({ variant: 'destructive', title: 'خطأ', description: message });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (loading) {
        return <Card className="max-w-2xl mx-auto"><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card>
    }

    if (!leaveRequest) {
        return <div className="text-center p-10">لم يتم العثور على طلب الإجازة.</div>
    }

    return (
        <Card className="max-w-2xl mx-auto" dir="rtl">
            <form onSubmit={handleSubmit}>
                 <CardHeader>
                    <CardTitle>تعديل طلب إجازة</CardTitle>
                    <CardDescription>
                      تعديل بيانات طلب الإجازة للموظف: {leaveRequest.employeeName}.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     {(currentUser?.role === 'Admin' || currentUser?.role === 'HR') && (
                      <div className="grid gap-2">
                        <Label htmlFor="employee">الموظف</Label>
                        <InlineSearchList
                            value={selectedEmployeeId}
                            onSelect={setSelectedEmployeeId}
                            options={employeeOptions}
                            placeholder={loading ? 'جاري التحميل...' : 'اختر موظفًا...'}
                            disabled={loading}
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="leaveType">نوع الإجازة</Label>
                        <Select value={leaveType} onValueChange={(v) => setLeaveType(v as any)}>
                            <SelectTrigger id="leaveType"><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Annual">سنوية</SelectItem>
                                <SelectItem value="Sick">مرضية</SelectItem>
                                <SelectItem value="Emergency">طارئة</SelectItem>
                                <SelectItem value="Unpaid">بدون أجر</SelectItem>
                            </SelectContent>
                        </Select>
                      </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="startDate">من تاريخ</Label>
                        <DateInput value={startDate} onChange={setStartDate} required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="endDate">إلى تاريخ</Label>
                        <DateInput value={endDate} onChange={setEndDate} required />
                      </div>
                    </div>
                    {leaveDuration.totalDays > 0 && (
                      <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">
                        <p>إجمالي الأيام: <strong>{leaveDuration.totalDays}</strong> أيام</p>
                        <p>أيام العمل الفعلية: <strong>{leaveDuration.workingDays}</strong> أيام عمل</p>
                      </div>
                    )}
                     <div className="grid gap-2">
                      <Label htmlFor="notes">السبب / ملاحظات</Label>
                      <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} required />
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <Checkbox id="passportReceived" checked={passportReceived} onCheckedChange={(checked) => setPassportReceived(!!checked)} />
                        <Label htmlFor="passportReceived">تم استلام جواز السفر</Label>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                     <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>إلغاء</Button>
                    <Button type="submit" disabled={isSaving || loading}>
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
                        {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
