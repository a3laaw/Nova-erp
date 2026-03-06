'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Loader2, Save, Upload, AlertCircle } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, serverTimestamp, query, getDocs } from 'firebase/firestore';
import { useBranding } from '@/context/branding-context';
import { calculateWorkingDays, calculateAnnualLeaveBalance } from '@/services/leave-calculator';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useSubscription } from '@/hooks/use-subscription';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';


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
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (currentUser && currentUser.role !== 'Admin' && currentUser.role !== 'HR') {
            setSelectedEmployeeId(currentUser.employeeId);
        }
    }, [currentUser]);

    const loading = employeesLoading || holidaysLoading || brandingLoading;

    const leaveDuration = useMemo(() => {
        if (!startDate || !endDate) return { totalDays: 0, workingDays: 0 };
        return calculateWorkingDays(startDate, endDate, branding?.work_hours?.holidays || [], publicHolidays);
    }, [startDate, endDate, branding, publicHolidays]);

    const employeeOptions = useMemo(() => (employees || []).map(e => ({ value: e.id!, label: e.fullName })), [employees]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser || !selectedEmployeeId || !leaveType || !startDate || !endDate) {
            toast({ variant: 'destructive', title: 'حقول ناقصة', description: 'الرجاء تعبئة جميع الحقول المطلوبة.' });
            return;
        }

        const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
        if (!selectedEmployee) {
             toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم العثور على الموظف.' });
            return;
        }
        
        if (leaveType === 'Annual') {
            const currentBalance = calculateAnnualLeaveBalance(selectedEmployee, new Date());
            if (currentBalance < leaveDuration.workingDays) {
                toast({
                    variant: 'destructive',
                    title: 'رصيد غير كافٍ',
                    description: `رصيد الإجازات المتبقي للموظف (${currentBalance} أيام) لا يكفي لتغطية هذه الإجازة (${leaveDuration.workingDays} أيام عمل).`
                });
                return;
            }
        }

        setIsSaving(true);
        try {
            const newRequest = {
                employeeId: selectedEmployeeId,
                employeeName: selectedEmployee.fullName,
                leaveType: leaveType,
                startDate: startDate,
                endDate: endDate,
                days: leaveDuration.totalDays,
                workingDays: leaveDuration.workingDays,
                notes: notes,
                passportReceived: passportReceived,
                status: 'pending' as const,
                createdAt: serverTimestamp(),
            };
            await addDoc(collection(firestore, 'leaveRequests'), newRequest);
            toast({ title: 'نجاح', description: 'تم إرسال طلب الإجازة بنجاح.' });
            router.push('/dashboard/hr/leaves');
        } catch (error) {
            const message = error instanceof Error ? error.message : "فشل حفظ الطلب.";
            toast({ variant: 'destructive', title: 'خطأ', description: message });
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Card className="max-w-2xl mx-auto rounded-[2.5rem] border-none shadow-xl overflow-hidden" dir="rtl">
            <form onSubmit={handleSubmit}>
                 <CardHeader className="bg-primary/5 pb-8 border-b">
                    <CardTitle className="text-2xl font-black">طلب إجازة جديد</CardTitle>
                    <CardDescription className="text-base">
                      سيتم إرسال الطلب للموافقة من قبل مدير النظام أو قسم الموارد البشرية.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                     {(currentUser?.role === 'Admin' || currentUser?.role === 'HR') && (
                      <div className="grid gap-2">
                        <Label htmlFor="employee" className="font-bold">الموظف <span className="text-destructive">*</span></Label>
                        <InlineSearchList
                            value={selectedEmployeeId}
                            onSelect={setSelectedEmployeeId}
                            options={employeeOptions}
                            placeholder={loading ? 'جاري التحميل...' : 'اختر موظفًا...'}
                            disabled={loading}
                            className="h-11 rounded-xl"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="grid gap-2">
                        <Label htmlFor="leaveType" className="font-bold">نوع الإجازة <span className="text-destructive">*</span></Label>
                        <Select value={leaveType} onValueChange={(v) => setLeaveType(v as any)}>
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
                        <Label htmlFor="startDate" className="font-bold">من تاريخ <span className="text-destructive">*</span></Label>
                        <DateInput value={startDate} onChange={setStartDate} className="h-11 rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="endDate" className="font-bold">إلى تاريخ <span className="text-destructive">*</span></Label>
                        <DateInput value={endDate} onChange={setEndDate} className="h-11 rounded-xl" />
                      </div>
                    </div>
                    {leaveDuration.totalDays > 0 && (
                      <div className="text-sm text-primary font-bold p-4 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20 flex justify-around">
                        <p>إجمالي الأيام: <span className="text-lg font-black">{leaveDuration.totalDays}</span></p>
                        <Separator orientation="vertical" className="h-6" />
                        <p>أيام العمل الفعلية: <span className="text-lg font-black">{leaveDuration.workingDays}</span></p>
                      </div>
                    )}
                     <div className="grid gap-2">
                      <Label htmlFor="notes" className="font-bold">السبب / ملاحظات <span className="text-destructive">*</span></Label>
                      <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} required rows={3} className="rounded-2xl" />
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse p-4 bg-muted/30 rounded-xl">
                        <Checkbox id="passportReceived" checked={passportReceived} onCheckedChange={(checked) => setPassportReceived(!!checked)} />
                        <Label htmlFor="passportReceived" className="font-bold cursor-pointer">هل تم استلام جواز السفر من الموظف؟</Label>
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/10 p-8 border-t flex justify-end gap-3">
                     <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSaving} className="h-12 px-8 font-bold">إلغاء</Button>
                    <Button type="submit" disabled={isSaving || loading} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/20 gap-2">
                        {isSaving ? <Loader2 className="animate-spin h-5 w-5"/> : <Save className="h-5 w-5" />}
                        {isSaving ? 'جاري الإرسال...' : 'إرسال طلب الإجازة'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
