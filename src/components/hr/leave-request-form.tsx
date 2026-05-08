'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import type { Employee, LeaveRequest, Holiday } from '@/lib/types';
import { Loader2, Save, Upload, Info, User } from 'lucide-react';
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
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'HR' || currentUser?.role === 'Developer';

  useEffect(() => {
    if (isOpen) {
        if (isEditing && leaveRequestToEdit) {
            setSelectedEmployeeId(leaveRequestToEdit.employeeId);
            setLeaveType(leaveRequestToEdit.leaveType);
            setStartDate(toFirestoreDate(leaveRequestToEdit.startDate) || undefined);
            setEndDate(toFirestoreDate(leaveRequestToEdit.endDate) || undefined);
            setNotes(leaveRequestToEdit.notes || '');
        } else {
             if (!isAdmin) {
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
  }, [isOpen, isEditing, leaveRequestToEdit, currentUser, isAdmin]);


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
      const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || (selectedEmployeeId === currentUser?.employeeId ? { fullName: currentUser.fullName } : null);
      if (!selectedEmployee) throw new Error('لم يتم العثور على الموظف المختار.');

      const dataToSave = {
        employeeId: selectedEmployeeId,
        employeeName: (selectedEmployee as any).fullName || (selectedEmployee as any).nameAr,
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
      <DialogContent dir="rtl" className="max-w-lg rounded-[2rem] shadow-2xl border-none p-0 overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-8 bg-primary/5 border-b">
            <DialogTitle className="text-2xl font-black text-[#1e1b4b]">
                {isEditing ? 'تعديل طلب إجازة' : 'طلب إجازة جديد'}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-slate-500 mt-1">
              {isEditing ? 'قم بتعديل تفاصيل طلب الإجازة.' : 'سيتم إرسال الطلب للموافقة من قبل الإدارة.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 p-8">
            <div className="grid gap-2">
                <Label htmlFor="employee" className="font-black text-gray-700 pr-1">الموظف المعني *</Label>
                {isAdmin ? (
                    <InlineSearchList
                        value={selectedEmployeeId}
                        onSelect={setSelectedEmployeeId}
                        options={employeeOptions}
                        placeholder={loadingRefs ? 'جاري التحميل...' : 'اختر موظفاً من القائمة...'}
                        disabled={loadingRefs || isSaving}
                        className="h-12 rounded-xl border-2"
                    />
                ) : (
                    <div className="h-12 rounded-xl border-2 bg-muted/20 px-4 flex items-center font-black text-[#1e1b4b] gap-2">
                        <User className="h-4 w-4 opacity-40" />
                        {currentUser?.fullName}
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="leaveType" className="font-bold mr-1">نوع الإجازة *</Label>
                <Select value={leaveType} onValueChange={(v) => setLeaveType(v as any)} disabled={isSaving}>
                    <SelectTrigger id="leaveType" className="h-11 rounded-xl border-2 font-bold"><SelectValue/></SelectTrigger>
                    <SelectContent dir="rtl">
                        <SelectItem value="Annual">سنوية</SelectItem>
                        <SelectItem value="Sick">مرضية</SelectItem>
                        <SelectItem value="Emergency">طارئة</SelectItem>
                        <SelectItem value="Unpaid">بدون أجر</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2" />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate" className="font-bold mr-1">من تاريخ *</Label>
                <DateInput value={startDate} onChange={setStartDate} className="h-11 rounded-xl border-2" disabled={isSaving} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate" className="font-bold mr-1">إلى تاريخ *</Label>
                <DateInput value={endDate} onChange={setEndDate} className="h-11 rounded-xl border-2" disabled={isSaving} />
              </div>
            </div>
            {leaveDuration.totalDays > 0 && (
              <div className="text-sm font-bold p-4 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20 flex justify-around">
                <p>إجمالي الأيام: <span className="text-lg font-black">{leaveDuration.totalDays}</span></p>
                <p>أيام العمل: <span className="text-lg font-black">{leaveDuration.workingDays}</span></p>
              </div>
            )}
             <div className="grid gap-2">
              <Label htmlFor="notes" className="font-bold mr-1">السبب / ملاحظات *</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} required rows={3} className="rounded-2xl border-2 p-4 text-base font-medium" placeholder="اشرح سبب طلب الإجازة..." disabled={isSaving} />
            </div>
          </div>
          <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
            <Button type="submit" disabled={isSaving} className="rounded-xl font-black px-12 h-12 shadow-xl shadow-primary/30 gap-2 bg-[#7209B7] text-white hover:bg-black transition-all">
              {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
              {isEditing ? 'حفظ التعديلات' : 'تقديم الطلب'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}