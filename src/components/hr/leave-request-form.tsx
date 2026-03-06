'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import type { Employee, LeaveRequest, Holiday } from '@/lib/types';
import { Loader2, Save, Upload } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useBranding } from '@/context/branding-context';
import { calculateWorkingDays } from '@/services/leave-calculator';
import { InlineSearchList } from '../ui/inline-search-list';
import { toFirestoreDate } from '@/services/date-converter';

interface LeaveRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  leaveRequestToEdit?: LeaveRequest | null;
}

export function LeaveRequestForm({ isOpen, onClose, onSaveSuccess, leaveRequestToEdit }: LeaveRequestFormProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { branding, loading: brandingLoading } = useBranding();
  const { toast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<Holiday[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [leaveType, setLeaveType] = useState<'Annual' | 'Sick' | 'Emergency' | 'Unpaid'>('Annual');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const isEditing = !!leaveRequestToEdit;

  useEffect(() => {
    if (isOpen) {
        if (isEditing && leaveRequestToEdit) {
            setSelectedEmployeeId(leaveRequestToEdit.employeeId);
            setLeaveType(leaveRequestToEdit.leaveType);
            setStartDate(toFirestoreDate(leaveRequestToEdit.startDate));
            setEndDate(toFirestoreDate(leaveRequestToEdit.endDate));
            setNotes(leaveRequestToEdit.notes || '');
        } else {
             if (currentUser?.role !== 'Admin' && currentUser?.role !== 'HR') {
              setSelectedEmployeeId(currentUser?.employeeId || '');
            } else {
              setSelectedEmployeeId('');
            }
            setLeaveType('Annual');
            setStartDate(undefined);
            setEndDate(undefined);
            setNotes('');
        }
    }
  }, [isOpen, isEditing, leaveRequestToEdit, currentUser]);


  useEffect(() => {
    if (!isOpen || !firestore) return;
    const fetchRefs = async () => {
      setLoadingRefs(true);
      try {
        const [empSnap, holidaySnap] = await Promise.all([
          getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active'))),
          getDocs(query(collection(firestore, 'holidays')))
        ]);
        setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
        setPublicHolidays(holidaySnap.docs.map(d => ({ id: d.id, ...d.data() } as Holiday)));
      } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحميل البيانات المرجعية.' });
      } finally {
        setLoadingRefs(false);
      }
    };
    fetchRefs();
  }, [isOpen, firestore, toast]);

  const leaveDuration = useMemo(() => {
    if (!startDate || !endDate) return { totalDays: 0, workingDays: 0 };
    return calculateWorkingDays(startDate, endDate, branding?.work_hours?.holidays || [], publicHolidays);
  }, [startDate, endDate, branding, publicHolidays]);

  const employeeOptions = useMemo(() => employees.map(e => ({ value: e.id!, label: e.fullName })), [employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !currentUser || !selectedEmployeeId || !leaveType || !startDate || !endDate) {
      toast({ variant: 'destructive', title: 'حقول ناقصة', description: 'الرجاء تعبئة جميع الحقول المطلوبة.' });
      return;
    }
    
    setIsSaving(true);
    try {
      const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
      if (!selectedEmployee) throw new Error('لم يتم العثور على الموظف المختار.');

      const dataToSave = {
        employeeId: selectedEmployeeId,
        employeeName: selectedEmployee.fullName,
        leaveType: leaveType,
        startDate: startDate,
        endDate: endDate,
        days: leaveDuration.totalDays,
        workingDays: leaveDuration.workingDays,
        notes: notes,
      };
      
      if (isEditing && leaveRequestToEdit?.id) {
        const leaveRef = doc(firestore, 'leaveRequests', leaveRequestToEdit.id);
        await updateDoc(leaveRef, dataToSave);
        toast({ title: 'نجاح', description: 'تم تعديل طلب الإجازة بنجاح.' });
      } else {
        const newRequest = {
            ...dataToSave,
            status: 'pending' as const,
            createdAt: serverTimestamp(),
        };
        await addDoc(collection(firestore, 'leaveRequests'), newRequest);
        toast({ title: 'نجاح', description: 'تم إرسال طلب الإجازة بنجاح.' });
      }
      
      onSaveSuccess();
      onClose();

    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل حفظ الطلب.";
      toast({ variant: 'destructive', title: 'خطأ', description: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'تعديل طلب إجازة' : 'طلب إجازة جديد'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'قم بتعديل تفاصيل طلب الإجازة.' : 'سيتم إرسال الطلب للموافقة من قبل مدير النظام أو قسم الموارد البشرية.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {(currentUser?.role === 'Admin' || currentUser?.role === 'HR') && (
              <div className="grid gap-2">
                <Label htmlFor="employee">الموظف</Label>
                <InlineSearchList
                    value={selectedEmployeeId}
                    onSelect={setSelectedEmployeeId}
                    options={employeeOptions}
                    placeholder="اختر موظفًا..."
                    disabled={loadingRefs}
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
                <DateInput value={startDate} onChange={setStartDate} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">إلى تاريخ</Label>
                <DateInput value={endDate} onChange={setEndDate} />
              </div>
            </div>
            {leaveDuration.totalDays > 0 && (
              <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">
                <p>إجمالي الأيام: <strong>{leaveDuration.totalDays}</strong> أيام</p>
                <p>أيام العمل المحسوبة: <strong>{leaveDuration.workingDays}</strong> أيام عمل</p>
              </div>
            )}
             <div className="grid gap-2">
              <Label htmlFor="notes">السبب / ملاحظات</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="attachment">مرفقات (اختياري)</Label>
                <Button type="button" variant="outline" asChild>
                    <label className="cursor-pointer">
                        <Upload className="ml-2 h-4 w-4"/>
                        رفع ملف (مثل تقرير طبي)
                        <input type="file" className="sr-only" />
                    </label>
                </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
              {isEditing ? 'حفظ التعديلات' : 'إرسال الطلب'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
