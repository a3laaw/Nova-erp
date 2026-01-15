
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Info, Loader2, Upload, AlertCircle, CalendarCheck, Wallet } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, query, where, addDoc, updateDoc, doc, serverTimestamp, getDocs, type DocumentData, Timestamp } from 'firebase/firestore';
import type { Employee, LeaveRequest } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { differenceInCalendarDays, format, differenceInDays } from 'date-fns';
import { useLeaveCalculator } from '@/hooks/useLeaveCalculator';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import { toFirestoreDate } from '@/services/date-converter';

interface LeaveRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
  requestToEdit?: LeaveRequest | null;
}

type LeaveType = 'Annual' | 'Sick' | 'Emergency' | 'Unpaid';


export function LeaveRequestForm({ isOpen, onClose, requestToEdit }: LeaveRequestFormProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [employeesLoading, setEmployeesLoading] = useState(true);

    const [employeeId, setEmployeeId] = useState('');
    const [leaveType, setLeaveType] = useState<LeaveType | ''>('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [notes, setNotes] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const isEditing = !!requestToEdit;

    useEffect(() => {
        const fetchEmployees = async () => {
            if (!firestore || !isOpen) return;
            setEmployeesLoading(true);
            try {
                // Fetch only active employees
                const q = query(collection(firestore, 'employees'), where('status', '==', 'active'));
                const querySnapshot = await getDocs(q);
                const fetchedEmployees: Employee[] = [];
                 querySnapshot.forEach((doc) => {
                    fetchedEmployees.push({ id: doc.id, ...doc.data() } as Employee);
                });
                fetchedEmployees.sort((a, b) => a.fullName.localeCompare(b.fullName));
                setEmployees(fetchedEmployees);
            } catch (error) {
                console.error("Failed to fetch employees:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب قائمة الموظفين.' });
            } finally {
                setEmployeesLoading(false);
            }
        };

        fetchEmployees();
    }, [firestore, isOpen, toast]);
    
    const resetForm = useCallback(() => {
        setEmployeeId('');
        setLeaveType('');
        setStartDate('');
        setEndDate('');
        setNotes('');
        setFile(null);
    }, []);
    
    // Pre-fill form if editing
    useEffect(() => {
        if (isEditing && requestToEdit) {
            setEmployeeId(requestToEdit.employeeId);
            setLeaveType(requestToEdit.leaveType);
            const start = requestToEdit.startDate ? (requestToEdit.startDate as any).toDate() : new Date();
            const end = requestToEdit.endDate ? (requestToEdit.endDate as any).toDate() : new Date();
            setStartDate(format(start, 'yyyy-MM-dd'));
            setEndDate(format(end, 'yyyy-MM-dd'));
            setNotes(requestToEdit.notes || '');
        } else {
            resetForm();
        }
    }, [requestToEdit, isEditing, resetForm, isOpen]);


    const { workingDays, loading: calculating, error: calcError } = useLeaveCalculator(startDate, endDate);

    const selectedEmployee = useMemo(() => {
        return employees.find(emp => emp.id === employeeId) || null;
    }, [employeeId, employees]);
    
    const currentBalance = useMemo(() => {
        if (!selectedEmployee) return 0;

        const hireDate = toFirestoreDate(selectedEmployee.hireDate);
        if (!hireDate) return 0;

        const daysOfService = differenceInDays(new Date(), hireDate);
        
        // Employee can only apply for annual leave after 9 months.
        if (daysOfService < 270) {
            return 0;
        }
        
        const totalAccrued = (daysOfService / 365.25) * 30;

        const used = selectedEmployee.annualLeaveUsed || 0;
        const carried = selectedEmployee.carriedLeaveDays || 0;

        // If we are editing a previously approved request, we need to temporarily add its days back
        // to the balance to show the correct state *before* this request is (re)submitted.
        const daysToExclude = isEditing && requestToEdit?.leaveType === 'Annual' && requestToEdit?.status === 'approved' && requestToEdit?.workingDays ? requestToEdit.workingDays : 0;

        const balance = totalAccrued + carried - (used - daysToExclude);

        return Math.floor(Math.max(0, balance));
    }, [selectedEmployee, isEditing, requestToEdit]);

    const remainingBalance = useMemo(() => {
        if (leaveType !== 'Annual') return currentBalance;
        return currentBalance - workingDays;
    }, [currentBalance, workingDays, leaveType]);


    const totalCalendarDays = useMemo(() => {
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (start > end) return -1;
            return differenceInCalendarDays(end, start) + 1;
        }
        return 0;
    }, [startDate, endDate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !selectedEmployee) return;
        
        if (!employeeId || !leaveType || !startDate || !endDate) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تعبئة جميع الحقول الإلزامية.' });
            return;
        }
        if (totalCalendarDays <= 0) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.' });
            return;
        }
        if (leaveType === 'Sick' && !file && !isEditing) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء إرفاق التقرير الطبي للإجازة المرضية.' });
            return;
        }
        if (calcError) {
             toast({ variant: 'destructive', title: 'خطأ في الحساب', description: 'لا يمكن تقديم الطلب أثناء وجود خطأ في حساب الأيام.' });
            return;
        }
        
        setIsSaving(true);
        try {
            // --- Validation for existing requests ---
            if (!isEditing) {
                const existingRequestsQuery = query(
                    collection(firestore, 'leaveRequests'),
                    where('employeeId', '==', employeeId),
                    where('status', 'in', ['pending', 'approved'])
                );
                const existingRequestsSnapshot = await getDocs(existingRequestsQuery);
                const overlappingRequest = existingRequestsSnapshot.docs.some(doc => {
                    const req = doc.data();
                    const reqStart = toFirestoreDate(req.startDate);
                    const reqEnd = toFirestoreDate(req.endDate);
                    const newStart = toFirestoreDate(startDate);
                    const newEnd = toFirestoreDate(endDate);
                    if (reqStart && reqEnd && newStart && newEnd) {
                        // Check for overlap: (StartA <= EndB) and (EndA >= StartB)
                        return newStart <= reqEnd && newEnd >= reqStart;
                    }
                    return false;
                });
                if (overlappingRequest) {
                    toast({
                        variant: 'destructive',
                        title: 'طلب متعارض',
                        description: 'لدى هذا الموظف بالفعل طلب إجازة معتمد أو معلق يتعارض مع هذه التواريخ.',
                    });
                    setIsSaving(false);
                    return;
                }
            }


            // In a real app, you would upload the file to Firebase Storage first and get the URL
            const dataToSave = {
                employeeId: employeeId,
                employeeName: selectedEmployee.fullName,
                leaveType: leaveType,
                startDate: Timestamp.fromDate(new Date(startDate)),
                endDate: Timestamp.fromDate(new Date(endDate)),
                days: totalCalendarDays,
                workingDays: workingDays,
                notes: notes,
                attachmentUrl: null, // Placeholder for file URL
            };

            if (isEditing && requestToEdit) {
                 const requestRef = doc(firestore, 'leaveRequests', requestToEdit.id);
                 await updateDoc(requestRef, {
                    ...dataToSave,
                    status: 'pending', // Reset status to pending on edit
                 });
                 toast({ title: 'نجاح', description: 'تم تعديل طلب الإجازة بنجاح.' });
            } else {
                await addDoc(collection(firestore, 'leaveRequests'), {
                    ...dataToSave,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                });
                toast({ title: 'نجاح', description: 'تم تقديم طلب الإجازة بنجاح.' });
            }

            onClose();
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'خطأ', description: `فشل ${isEditing ? 'تعديل' : 'تقديم'} الطلب. الرجاء المحاولة مرة أخرى.` });
        } finally {
            setIsSaving(false);
        }
    }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
                <DialogTitle>{isEditing ? 'تعديل طلب إجازة' : 'طلب إجازة جديد'}</DialogTitle>
                <DialogDescription>
                    {isEditing ? `تعديل الطلب الخاص بالموظف: ${requestToEdit?.employeeName}` : 'قم بتعبئة النموذج لتقديم طلب إجازة جديد لأحد الموظفين.'}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label htmlFor="employee">الموظف <span className="text-destructive">*</span></Label>
                    <Select dir="rtl" value={employeeId} onValueChange={setEmployeeId} required disabled={isEditing}>
                        <SelectTrigger id="employee" disabled={employeesLoading || isEditing}>
                            <SelectValue placeholder={employeesLoading ? "تحميل..." : "اختر الموظف..."} />
                        </SelectTrigger>
                        <SelectContent>
                            {employeesLoading && <div className='p-2'><Skeleton className='h-8 w-full' /></div>}
                            {!employeesLoading && employees.length === 0 ? (
                                <p className="p-2 text-xs text-muted-foreground">لا يوجد موظفون نشطون حالياً.</p>
                            ) : (
                                employees.map(emp => (
                                    <SelectItem key={emp.id} value={emp.id!}>{emp.fullName}</SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="leaveType">نوع الإجازة <span className="text-destructive">*</span></Label>
                    <Select dir="rtl" value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)} required>
                        <SelectTrigger id="leaveType">
                            <SelectValue placeholder="اختر نوع الإجازة..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Annual">سنوية</SelectItem>
                            <SelectItem value="Sick">مرضية</SelectItem>
                            <SelectItem value="Emergency">طارئة</SelectItem>
                            <SelectItem value="Unpaid">بدون راتب</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="startDate">من تاريخ <span className="text-destructive">*</span></Label>
                        <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="endDate">إلى تاريخ <span className="text-destructive">*</span></Label>
                        <Input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
                    </div>
                </div>

                {/* Dynamic Calculation Section */}
                {selectedEmployee && startDate && endDate && totalCalendarDays > 0 && leaveType === 'Annual' && (
                     <Alert variant="default" className="bg-muted/50">
                        <Info className="h-4 w-4" />
                        <AlertTitle>ملخص الرصيد (للإجازة السنوية فقط)</AlertTitle>
                        <AlertDescription className="space-y-2 mt-2">
                           {calculating ? (
                                <div className='flex items-center gap-2'><Loader2 className='h-4 w-4 animate-spin' /> جاري حساب أيام العمل...</div>
                           ) : calcError ? (
                                <div className='text-destructive'>{calcError}</div>
                           ) : (
                            <>
                                <div className="flex justify-between items-center">
                                    <span className='flex items-center gap-1'><CalendarCheck className='h-4 w-4 text-muted-foreground' />أيام العمل المطلوبة:</span>
                                    <span className="font-bold text-primary">{workingDays} أيام</span>
                                </div>
                                 <div className="flex justify-between items-center">
                                    <span className='flex items-center gap-1'><Wallet className='h-4 w-4 text-muted-foreground' />الرصيد الحالي للموظف:</span>
                                    <span>{currentBalance} يوم</span>
                                </div>
                                <hr className="border-dashed" />
                                <div className={cn("flex justify-between font-semibold items-center", remainingBalance < 0 && "text-destructive")}>
                                    <span className='flex items-center gap-1'><Wallet className='h-4 w-4' />الرصيد المتبقي بعد الطلب:</span>
                                    <span>{remainingBalance} يوم</span>
                                </div>
                                {remainingBalance < 0 && (
                                     <div className="text-destructive text-xs flex items-center gap-1 p-2 bg-destructive/10 rounded-md">
                                        <AlertCircle className="h-3 w-3"/>
                                        الرصيد سيكون سالبًا!
                                    </div>
                                )}
                            </>
                           )}
                        </AlertDescription>
                    </Alert>
                )}
                 {totalCalendarDays < 0 && <Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertTitle>خطأ في التاريخ</AlertTitle><AlertDescription>تاريخ النهاية يجب أن يكون بعد تاريخ البداية.</AlertDescription></Alert>}

                <div className="grid gap-2">
                    <Label htmlFor="notes">ملاحظات</Label>
                    <Textarea id="notes" placeholder={leaveType === 'Emergency' ? 'سبب الإجازة الطارئة (إلزامي)' : 'أدخل ملاحظاتك هنا...'} value={notes} onChange={e => setNotes(e.target.value)} required={leaveType === 'Emergency'} />
                </div>
                {leaveType === 'Sick' && (
                    <div className="grid gap-2">
                        <Label htmlFor="file-upload">تقرير طبي {isEditing ? '(اختياري عند التعديل)' : '(إلزامي)'}</Label>
                        <div className="flex items-center gap-2">
                           <Button asChild variant="outline" className="flex-1">
                             <label htmlFor="file-upload" className="cursor-pointer">
                                <Upload className="ml-2 h-4 w-4" />
                                {file ? file.name : 'اختر ملف'}
                             </label>
                           </Button>
                           <Input id="file-upload" type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept="image/*,.pdf" />
                        </div>
                    </div>
                )}
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                <Button type="submit" disabled={isSaving || calculating || !!calcError}>
                    {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    {isSaving ? 'جاري الحفظ...' : (isEditing ? 'حفظ التعديلات' : 'تقديم الطلب')}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
