'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import type { Employee, LeaveRequest, Holiday } from '@/lib/types';
import { Loader2, Save, User, AlertCircle, Stethoscope, Clock, CheckCircle2, CalendarRange } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useBranding } from '@/context/branding-context';
import { calculateWorkingDays } from '@/services/leave-calculator';
import { InlineSearchList } from '../ui/inline-search-list';
import { toFirestoreDate } from '@/services/date-converter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getTenantPath } from '@/lib/utils';
import { startOfDay, endOfDay, startOfYear, endOfYear } from 'date-fns';
import { cn } from '@/lib/utils';

interface LeaveRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  leaveRequestToEdit?: LeaveRequest | null;
}

export function LeaveRequestForm({ isOpen, onClose, onSaveSuccess, leaveRequestToEdit }: LeaveRequestFormProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { branding } = useBranding();
  const { toast } = useToast();
  const tenantId = currentUser?.currentCompanyId;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<Holiday[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [leaveType, setLeaveType] = useState<'Annual' | 'Sick' | 'Emergency' | 'Unpaid'>('Annual');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [sickLeaveStats, setSickLeaveStats] = useState({
      used: 0,
      totalLimit: 75
  });

  const isAdmin = ['Admin', 'HR', 'Developer'].includes(currentUser?.role || '');

  useEffect(() => {
    if (isOpen) {
        if (leaveRequestToEdit) {
            setSelectedEmployeeId(leaveRequestToEdit.employeeId);
            setLeaveType(leaveRequestToEdit.leaveType);
            setStartDate(toFirestoreDate(leaveRequestToEdit.startDate) || undefined);
            setEndDate(toFirestoreDate(leaveRequestToEdit.endDate) || undefined);
            setNotes(leaveRequestToEdit.notes || '');
        } else {
            setSelectedEmployeeId(!isAdmin ? (currentUser?.employeeId || '') : '');
            setLeaveType('Annual');
            setStartDate(undefined);
            setEndDate(undefined);
            setNotes('');
        }
        setOverlapError(null);
    }
  }, [isOpen, leaveRequestToEdit, currentUser, isAdmin]);

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
      } finally { setLoadingRefs(false); }
    };
    fetchRefs();
  }, [isOpen, firestore]);

  useEffect(() => {
    if (!isOpen || !firestore || !selectedEmployeeId || leaveType !== 'Sick' || !tenantId) return;
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
            if (lStart && lStart >= start && lStart <= end) used += (data.workingDays || 0);
        });
        setSickLeaveStats({ used, totalLimit: 75 });
    };
    checkSickBalance();
  }, [isOpen, selectedEmployeeId, leaveType, firestore, tenantId]);

  const leaveDuration = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) return { totalDays: 0, workingDays: 0 };
    return calculateWorkingDays(startDate, endDate, branding?.work_hours?.holidays || [], publicHolidays);
  }, [startDate, endDate, branding, publicHolidays]);

  const currentSickTier = useMemo(() => {
      if (leaveType !== 'Sick') return null;
      const u = sickLeaveStats.used;
      if (u < 15) return { label: 'أجر كامل (100%)', color: 'text-green-600', remaining: 15 - u, limit: 15 };
      if (u < 25) return { label: '75% من الأجر', color: 'text-blue-600', remaining: 25 - u, limit: 10 };
      if (u < 35) return { label: '50% من الأجر', color: 'text-orange-600', remaining: 35 - u, limit: 10 };
      if (u < 45) return { label: '25% من الأجر', color: 'text-amber-600', remaining: 45 - u, limit: 10 };
      if (u < 75) return { label: 'بدون أجر (إجازة ممتدة)', color: 'text-red-600', remaining: 75 - u, limit: 30 };
      return { label: 'تجاوز السقف السنوي (75 يوماً)', color: 'text-red-900', remaining: 0, limit: 0 };
  }, [leaveType, sickLeaveStats]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !currentUser || !selectedEmployeeId || !leaveType || !startDate || !endDate || !tenantId) return;

    if (leaveType === 'Sick' && currentSickTier?.remaining === 0) {
        toast({ variant: 'destructive', title: 'تنبيه إداري', description: 'لقد استنفذ الموظف كافة شرائح الإجازة المرضية المتاحة لهذا العام (75 يوماً).' });
        return;
    }

    setIsSaving(true);
    setOverlapError(null);

    try {
      const leaveCollectionPath = getTenantPath('leaveRequests', tenantId);
      const overlapQuery = query(collection(firestore, leaveCollectionPath), where('employeeId', '==', selectedEmployeeId), where('status', 'in', ['pending', 'approved', 'on-leave']));
      const overlapSnap = await getDocs(overlapQuery);
      const hasOverlap = overlapSnap.docs.some(docSnap => {
          if (leaveRequestToEdit && docSnap.id === leaveRequestToEdit.id) return false;
          const existing = docSnap.data() as LeaveRequest;
          const exStart = toFirestoreDate(existing.startDate);
          const exEnd = toFirestoreDate(existing.endDate);
          return (exStart && exEnd && startOfDay(startDate) <= endOfDay(exEnd) && endOfDay(endDate) >= startOfDay(exStart));
      });

      if (hasOverlap) {
          setOverlapError("عذراً، يوجد إجازة أخرى مسجلة للموظف في نفس هذا التوقيت.");
          setIsSaving(false); return;
      }

      const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || { fullName: currentUser.fullName };
      const dataToSave = {
        employeeId: selectedEmployeeId,
        employeeName: (selectedEmployee as any).fullName,
        leaveType, startDate, endDate,
        days: leaveDuration.totalDays,
        workingDays: leaveDuration.workingDays,
        notes,
      };
      
      if (leaveRequestToEdit?.id) await updateDoc(doc(firestore, leaveCollectionPath, leaveRequestToEdit.id), dataToSave);
      else await addDoc(collection(firestore, leaveCollectionPath), { ...dataToSave, status: 'pending', createdAt: serverTimestamp(), companyId: tenantId });
      
      onSaveSuccess(); onClose();
      toast({ title: 'تم تقديم الطلب بنجاح' });
    } catch (error) { setIsSaving(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-lg rounded-[2.5rem] shadow-2xl border-none p-0 overflow-hidden bg-white">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-8 bg-primary/5 border-b">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><CalendarRange className="h-6 w-6" /></div>
                <div>
                    <DialogTitle className="text-xl font-black text-[#1e1b4b]">{leaveRequestToEdit ? 'تعديل طلب الإجازة' : 'طلب إجازة جديد'}</DialogTitle>
                    <DialogDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">تنظيم فترات الغياب والالتزام بقواعد العمل.</DialogDescription>
                </div>
            </div>
          </DialogHeader>
          <div className="grid gap-6 p-8">
            {overlapError && <Alert variant="destructive" className="rounded-2xl border-2 border-red-500 bg-red-50 py-4"><AlertCircle className="h-5 w-5"/><AlertTitle className="text-sm font-black">تنبيه تداخل مواعيد</AlertTitle><AlertDescription className="text-xs font-bold">{overlapError}</AlertDescription></Alert>}

            {leaveType === 'Sick' && currentSickTier && (
                <div className="p-5 bg-blue-50 border-2 border-blue-200 rounded-3xl space-y-3 animate-in zoom-in-95">
                    <div className="flex items-center gap-2 text-blue-800 font-black"><Stethoscope className="h-5 w-5"/> <h4 className="text-sm">حالة استحقاق المرضيات (سنوياً)</h4></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded-xl border shadow-sm">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">الشريحة الحالية</p>
                            <p className={cn("font-black text-sm", currentSickTier.color)}>{currentSickTier.label}</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border shadow-sm">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">المتبقي في الشريحة</p>
                            <p className="font-black text-sm text-blue-700">{currentSickTier.remaining} أيام</p>
                        </div>
                    </div>
                    <p className="text-[9px] text-muted-foreground font-bold italic px-1">نظام متدرج: 15 يوم (100%)، 10 أيام (75%)، 10 أيام (50%)، 10 أيام (25%)، 30 يوم (0%).</p>
                </div>
            )}

            <div className="grid gap-2">
                <Label className="font-black text-gray-700 pr-1">الموظف المعني *</Label>
                {isAdmin ? <InlineSearchList value={selectedEmployeeId} onSelect={setSelectedEmployeeId} options={employees.map(e => ({ value: e.id!, label: e.fullName }))} placeholder={loadingRefs ? 'جاري التحميل...' : 'اختر موظفاً...'} disabled={loadingRefs || isSaving} /> : <div className="h-11 rounded-xl border-2 bg-muted/20 px-4 flex items-center font-black text-[#1e1b4b] gap-2"><User className="h-4 w-4 opacity-40" />{currentUser?.fullName}</div>}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label className="font-bold pr-1">نوع الإجازة *</Label>
                    <Select value={leaveType} onValueChange={(v: any) => setLeaveType(v)} disabled={isSaving}>
                        <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue/></SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="Annual">سنوية اعتيادية</SelectItem>
                            <SelectItem value="Sick">مرضية (قانونية)</SelectItem>
                            <SelectItem value="Emergency">طارئة / عرضية</SelectItem>
                            <SelectItem value="Unpaid">بدون راتب</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold pr-1">مدة الطلب</Label>
                    <div className="h-11 rounded-xl bg-muted/30 border-2 flex items-center justify-center font-black text-primary">{leaveDuration.workingDays} أيام عمل</div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label className="font-bold pr-1">من تاريخ *</Label><DateInput value={startDate} onChange={setStartDate} disabled={isSaving} /></div>
              <div className="grid gap-2"><Label className="font-bold pr-1">إلى تاريخ *</Label><DateInput value={endDate} onChange={setEndDate} disabled={isSaving} /></div>
            </div>
            <div className="grid gap-2"><Label className="font-bold pr-1">المبررات / ملاحظات الموظف *</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} required rows={3} className="rounded-2xl border-2 p-4 font-medium" placeholder="اذكر سبب الإجازة بوضوح..." disabled={isSaving} /></div>
          </div>
          <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">تراجع</Button>
            <Button type="submit" disabled={isSaving || !!overlapError} className="rounded-xl font-black px-12 h-12 shadow-xl shadow-primary/30 gap-2 bg-[#7209B7] text-white hover:bg-black transition-all">
              {isSaving ? <Loader2 className="animate-spin h-5 w-5"/> : <Save className="ml-2 h-4 w-4" />} {leaveRequestToEdit ? 'تحديث الطلب' : 'تقديم الطلب'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
