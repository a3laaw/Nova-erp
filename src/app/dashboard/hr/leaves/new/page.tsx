// ADDED: نظام إجازات إلكتروني هجين مع طباعة نموذج ورقي للتوقيع اليدوي
// IMPROVED: تحقق رصيد قبل التقديم
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
        <Card className="max-w-2xl mx-auto" dir="rtl">
            <form onSubmit={handleSubmit}>
                 <CardHeader>
                    <CardTitle>طلب إجازة جديد</CardTitle>
                    <CardDescription>
                      سيتم إرسال الطلب للموافقة من قبل مدير النظام أو قسم الموارد البشرية.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     {(currentUser?.role === 'Admin' || currentUser?.role === 'HR') && (
                      <div className="grid gap-2">
                        <Label htmlFor="employee">الموظف <span className="text-destructive">*</span></Label>
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
                        <Label htmlFor="leaveType">نوع الإجازة <span className="text-destructive">*</span></Label>
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
                        <Label htmlFor="startDate">من تاريخ <span className="text-destructive">*</span></Label>
                        <DateInput value={startDate} onChange={setStartDate} required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="endDate">إلى تاريخ <span className="text-destructive">*</span></Label>
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
                      <Label htmlFor="notes">السبب / ملاحظات <span className="text-destructive">*</span></Label>
                      <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} required />
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <Checkbox id="passportReceived" checked={passportReceived} onCheckedChange={(checked) => setPassportReceived(!!checked)} />
                        <Label htmlFor="passportReceived">استلام جواز السفر</Label>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                     <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>إلغاء</Button>
                    <Button type="submit" disabled={isSaving || loading}>
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
                        {isSaving ? 'جاري الإرسال...' : 'إرسال الطلب'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
