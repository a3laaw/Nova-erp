'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import type { Employee, LeaveRequest, Holiday } from '@/lib/types';
import { Loader2, Save, Info, User, AlertCircle, ShieldCheck, Stethoscope } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useBranding } from '@/context/branding-context';
import { calculateWorkingDays, calculateAnnualLeaveBalance } from '@/services/leave-calculator';
import { InlineSearchList } from '../ui/inline-search-list';
import { toFirestoreDate } from '@/services/date-converter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getTenantPath } from '@/lib/utils';
import { startOfDay, endOfDay, isSameDay, isBefore, startOfYear, endOfYear } from 'date-fns';

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
  const tenantId = currentUser?.currentCompanyId;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<Holiday[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [leaveType, setLeaveType] = useState<'Annual' | 'Sick' | 'Emergency' | 'Unpaid'>('Annual');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [sickLeaveBalanceInfo, setSickLeaveBalanceInfo] = useState<{ used: number, max: number } | null>(null);
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
        setOverlapError(null);
        setSickLeaveBalanceInfo(null);
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

  // ✨ محرك رصد رصيد الإجازات المرضية المتبقي (15 يوم سنوياً)
  useEffect(() => {
    if (!isOpen || !firestore || !selectedEmployeeId || leaveType !== 'Sick' || !tenantId) {
        setSickLeaveBalanceInfo(null);
        return;
    }

    const checkSickBalance = async () => {
        const start = startOfYear(new Date());
        const end = endOfYear(new Date());
        const leavePath = getTenantPath('leaveRequests', tenantId);
        
        const q = query(
            collection(firestore, leavePath),
            where('employeeId', '==', selectedEmployeeId),
            where('leaveType', '==', 'Sick'),
            where('status', 'in', ['approved', 'on-leave', 'returned'])
        );
        
        const snap = await getDocs(q);
        let used = 0;
        snap.forEach(doc => {
            const data = doc.data() as LeaveRequest;
            const lStart = toFirestoreDate(data.startDate);
            if (lStart && lStart >= start && lStart <= end) {
                used += (data.workingDays || 0);
            }
        });
        setSickLeaveBalanceInfo({ used, max: 15 });
    };

    checkSickBalance();
  }, [isOpen, selectedEmployeeId, leaveType, firestore, tenantId]);

  const leaveDuration = useMemo(() => {
    if (!startDate || !endDate) return { totalDays: 0, workingDays: 0 };
    return calculateWorkingDays(startDate, endDate, branding?.work_hours?.holidays || [], publicHolidays);
  }, [startDate, endDate, branding, publicHolidays]);

  const employeeOptions = useMemo(() => employees.map(e => ({ value: e.id!, label: e.fullName })), [employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !currentUser || !selectedEmployeeId || !leaveType || !startDate || !endDate || !tenantId) {
      toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء تعبئة جميع الحقول المطلوبة.' });
      return;
    }

    // ✨ التحقق من سقف الإجازة المرضية (15 يوم)
    if (leaveType === 'Sick' && sickLeaveBalanceInfo) {
        const remaining = sickLeaveBalanceInfo.max - sickLeaveBalanceInfo.used;
        if (leaveDuration.workingDays > remaining) {
            const msg = `عذراً، رصيد الإجازات المرضية المتبقي للموظف هو (${remaining}) أيام فقط لهذا العام. لا يمكن تجاوز 15 يوماً مدفوعاً.`;
            setOverlapError(msg);
            toast({ variant: 'destructive', title: 'تجاوز رصيد المرضيات', description: msg });
            return;
        }
    }
    
    setIsSaving(true);
    setOverlapError(null);

    try {
      const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || (selectedEmployeeId === currentUser?.employeeId ? { fullName: currentUser.fullName } : null);
      if (!selectedEmployee) throw new Error('لم يتم العثور على الموظف المختار.');

      const leaveCollectionPath = getTenantPath('leaveRequests', tenantId);
      
      const overlapQuery = query(
          collection(firestore, leaveCollectionPath),
          where('employeeId', '==', selectedEmployeeId),
          where('status', 'in', ['pending', 'approved', 'on-leave'])
      );
      const overlapSnap = await getDocs(overlapQuery);
      const hasOverlap = overlapSnap.docs.some(docSnap => {
          if (isEditing && docSnap.id === leaveRequestToEdit?.id) return false;
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
          toast({ variant: 'destructive', title: 'تنبيه تداخل مواعيد', description: errorMsg });
          setIsSaving(false);
          return;
      }

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
        toast({ title: 'نجاح', description: 'تم تحديث طلب الإجازة بنجاح.' });
      } else {
        const newRequest = {
            ...dataToSave,
            status: 'pending' as const,
            createdAt: serverTimestamp(),
            companyId: tenantId
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
              تحديد التواريخ ونوع الإجازة لضمان دقة الرصيد وحساب الرواتب.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 p-8">
            {overlapError && (
                <Alert variant="destructive" className="rounded-2xl border-2 border-red-500 bg-red-50 shadow-sm animate-in zoom-in-95 py-4">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <AlertTitle className="text-sm font-black text-red-800">تنبيه تداخل مواعيد</AlertTitle>
                    <AlertDescription className="text-xs font-bold text-red-700 mt-1">
                        {overlapError}
                    </AlertDescription>
                </Alert>
            )}

            {leaveType === 'Sick' && sickLeaveBalanceInfo && (
                <Alert className="rounded-2xl border-2 border-blue-500 bg-blue-50 shadow-sm py-4">
                    <Stethoscope className="h-5 w-5 text-blue-600" />
                    <AlertTitle className="text-sm font-black text-blue-800">رصيد الإجازات المرضية</AlertTitle>
                    <AlertDescription className="text-xs font-bold text-blue-700 mt-1">
                        تم استهلاك ({sickLeaveBalanceInfo.used}) أيام من أصل ({sickLeaveBalanceInfo.max}) أيام مدفوعة لهذا العام.
                    </AlertDescription>
                </Alert>
            )}

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
                        <SelectItem value="Sick">مرضية (بحد أقصى 15 يوم/سنة)</SelectItem>
                        <SelectItem value="Emergency">طارئة</SelectItem>
                        <SelectItem value="Unpaid">بدون أجر</SelectItem>
                    </SelectContent>
                </Select>
              </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate" className="font-bold mr-1">من تاريخ *</Label>
                <DateInput value={startDate} onChange={(d) => { setStartDate(d); setOverlapError(null); }} className="h-11 rounded-xl border-2" disabled={isSaving} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate" className="font-bold mr-1">إلى تاريخ *</Label>
                <DateInput value={endDate} onChange={(d) => { setEndDate(d); setOverlapError(null); }} className="h-11 rounded-xl border-2" disabled={isSaving} />
              </div>
            </div>
            {leaveDuration.totalDays > 0 && (
              <div className="space-y-4">
                <div className="text-sm font-black text-primary p-4 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20 flex justify-around">
                    <p>إجمالي الأيام: <span className="text-lg">{leaveDuration.totalDays}</span></p>
                    <p>أيام العمل: <span className="text-lg">{leaveDuration.workingDays}</span></p>
                </div>
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
