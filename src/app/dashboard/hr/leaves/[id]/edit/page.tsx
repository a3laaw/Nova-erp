
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
import { Loader2, Save, X } from 'lucide-react';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, updateDoc } from 'firebase/firestore';
import { useBranding } from '@/context/branding-context';
import { calculateWorkingDays } from '@/services/leave-calculator';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { toFirestoreDate } from '@/services/date-converter';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { isBefore, startOfDay } from 'date-fns';

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

    // الرقابة المنطقية: تصفير تاريخ النهاية إذا كان قبل البداية
    useEffect(() => {
        if (startDate && endDate && isBefore(startOfDay(endDate), startOfDay(startDate))) {
            setEndDate(undefined);
            toast({
                variant: 'destructive',
                title: 'خطأ منطقي',
                description: 'التاريخ غلط، لا يجوز أن يسبق تاريخ النهاية تاريخ البداية.',
            });
        }
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

        if (!firestore || !currentUser || !id || !selectedEmployeeId || !leaveType || !startDate || !endDate) {
            toast({ variant: 'destructive', title: 'حقول ناقصة', description: 'الرجاء تعبئة جميع الحقول المطلوبة.' });
            return;
        }

        // الرقابة النهائية
        if (isBefore(startOfDay(endDate), startOfDay(startDate))) {
            toast({ variant: 'destructive', title: 'تاريخ غير صالح', description: 'التاريخ غلط، لا يجوز أن يسبق تاريخ النهاية تاريخ البداية.' });
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
            const leaveRef = doc(firestore, 'leaveRequests', id);
            await updateDoc(leaveRef, {
                employeeId: selectedEmployeeId,
                employeeName: selectedEmployee.fullName,
                leaveType: leaveType,
                startDate: startDate,
                endDate: endDate,
                days: leaveAnalysis.totalDays,
                workingDays: leaveAnalysis.workingDays,
                notes: notes,
                passportReceived: passportReceived
            });
            
            toast({ title: 'نجاح', description: 'تم تعديل طلب الإجازة بنجاح.' });
            router.push('/dashboard/hr/leaves');
        } catch (error) {
            savingRef.current = false;
            setIsSaving(false);
            const message = error instanceof Error ? error.message : "فشل تعديل الطلب.";
            toast({ variant: 'destructive', title: 'خطأ', description: message });
        }
    };
    
    if (loading) {
        return <Card className="max-w-2xl mx-auto"><CardContent className="p-8"><Skeleton className="h-96 w-full rounded-2xl" /></CardContent></Card>
    }

    if (!leaveRequest) {
        return <div className="text-center p-10">لم يتم العثور على طلب الإجازة.</div>
    }

    return (
        <Card className="max-w-2xl mx-auto rounded-[2.5rem] border-none shadow-xl overflow-hidden" dir="rtl">
            <form onSubmit={handleSubmit}>
                 <CardHeader className="bg-primary/5 pb-8 border-b">
                    <CardTitle className="text-2xl font-black">تعديل طلب إجازة</CardTitle>
                    <CardDescription className="text-base">
                      تعديل بيانات طلب الإجازة للموظف: {leaveRequest.employeeName}.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                     {(currentUser?.role === 'Admin' || currentUser?.role === 'HR') && (
                      <div className="grid gap-2">
                        <Label htmlFor="employee" className="font-bold">الموظف</Label>
                        <InlineSearchList
                            value={selectedEmployeeId}
                            onSelect={setSelectedEmployeeId}
                            options={employeeOptions}
                            placeholder={loading ? 'جاري التحميل...' : 'اختر موظفًا...'}
                            disabled={loading || isSaving}
                            className="h-11 rounded-xl"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="grid gap-2">
                        <Label htmlFor="leaveType" className="font-bold">نوع الإجازة</Label>
                        <Select value={leaveType} onValueChange={(v) => setLeaveType(v as any)} disabled={isSaving}>
                            <SelectTrigger id="leaveType" className="h-11 rounded-xl"><SelectValue/></SelectTrigger>
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
                        <Label htmlFor="startDate" className="font-bold">من تاريخ</Label>
                        <DateInput value={startDate} onChange={setStartDate} disabled={isSaving} className="h-11 rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="endDate" className="font-bold">إلى تاريخ</Label>
                        <DateInput value={endDate} onChange={setEndDate} disabled={isSaving} className="h-11 rounded-xl" />
                      </div>
                    </div>
                    {leaveAnalysis.totalDays > 0 && (
                      <div className="text-sm text-primary font-bold p-4 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20 flex justify-around">
                        <p>إجمالي الأيام: <span className="text-lg font-black">{leaveAnalysis.totalDays}</span></p>
                        <p>أيام العمل الفعلية: <span className="text-lg font-black">{leaveAnalysis.workingDays}</span></p>
                      </div>
                    )}
                     <div className="grid gap-2">
                      <Label htmlFor="notes" className="font-bold">السبب / ملاحظات</Label>
                      <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} required rows={3} className="rounded-2xl" disabled={isSaving} />
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse p-4 bg-muted/30 rounded-xl">
                        <Checkbox id="passportReceived" checked={passportReceived} onCheckedChange={(checked) => setPassportReceived(!!checked)} disabled={isSaving} />
                        <Label htmlFor="passportReceived" className="font-bold cursor-pointer">تم استلام جواز السفر</Label>
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/10 p-8 border-t flex justify-end gap-3">
                     <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSaving} className="h-12 px-8 font-bold">إلغاء</Button>
                    <Button type="submit" disabled={isSaving || loading} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/20 gap-2">
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
                        {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
