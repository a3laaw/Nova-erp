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
import { Loader2, Save, User, AlertCircle, CalendarCheck, Info, Calculator, Sparkles } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useBranding } from '@/context/branding-context';
import { calculateWorkingDays, calculateSickLeaveTiers } from '@/services/leave-calculator';
import { InlineSearchList } from '../ui/inline-search-list';
import { toFirestoreDate } from '@/services/date-converter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { startOfDay, endOfDay } from 'date-fns';
import { Separator } from '../ui/separator';
import { createNotification } from '@/services/notification-service';

interface LeaveRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  leaveRequestToEdit?: LeaveRequest | null;
}

const leaveTypeTranslations: Record<string, string> = {
    'Annual': 'سنوية',
    'Sick': 'مرضية',
    'Emergency': 'طارئة',
    'Unpaid': 'بدون أجر'
};

export function LeaveRequestForm({ isOpen, onClose, onSaveSuccess, leaveRequestToEdit }: LeaveRequestFormProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { branding } = useBranding();
  const { toast } = useToast();
  const tenantId = currentUser?.currentCompanyId;

  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
  const { data: publicHolidays = [] } = useSubscription<Holiday>(firestore, 'holidays');

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [leaveType, setLeaveType] = useState<'Annual' | 'Sick' | 'Emergency' | 'Unpaid'>('Annual');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingQuota, setLoadingQuota] = useState(false);
  const [usedSickDays, setUsedSickDays] = useState(0);

  const isAdmin = ['Admin', 'HR', 'Developer'].includes(currentUser?.role || '');

  useEffect(() => {
    if (isOpen) {
        setIsSaving(false);
        setOverlapError(null);
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
    }
  }, [isOpen, leaveRequestToEdit, currentUser, isAdmin]);

  useEffect(() => {
    if (!isOpen || !firestore || !selectedEmployeeId || !tenantId) return;

    const checkContext = async () => {
        setLoadingQuota(true);
        try {
            const leavePath = getTenantPath('leaveRequests', tenantId);
            const q = query(collection(firestore, leavePath), where('employeeId', '==', selectedEmployeeId));
            const snap = await getDocs(q);
            
            let totalSick = 0;
            snap.forEach(docSnap => {
                const data = docSnap.data() as LeaveRequest;
                if (data.leaveType === 'Sick' && ['approved', 'on-leave', 'returned'].includes(data.status)) {
                    totalSick += data.workingDays || 0;
                }
            });
            setUsedSickDays(totalSick);

            if (startDate && endDate) {
                const hasOverlap = snap.docs.some(docSnap => {
                    if (leaveRequestToEdit && docSnap.id === leaveRequestToEdit.id) return false;
                    const existing = docSnap.data() as LeaveRequest;
                    if (!['pending', 'approved', 'on-leave'].includes(existing.status)) return false;
                    const exStart = toFirestoreDate(existing.startDate);
                    const exEnd = toFirestoreDate(existing.endDate);
                    return (exStart && exEnd && startOfDay(startDate) <= endOfDay(exEnd) && endOfDay(endDate) >= startOfDay(exStart));
                });
                if (hasOverlap) setOverlapError("عذراً، يوجد إجازة أخرى مسجلة للموظف في نفس هذا التوقيت.");
                else setOverlapError(null);
            }
        } finally { setLoadingQuota(false); }
    };
    checkContext();
  }, [isOpen, selectedEmployeeId, startDate, endDate, firestore, tenantId, leaveRequestToEdit]);

  const leaveDuration = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) return { totalDays: 0, workingDays: 0 };
    return calculateWorkingDays(startDate, endDate, branding?.work_hours?.holidays || [], publicHolidays);
  }, [startDate, endDate, branding, publicHolidays]);

  const sickTiers = useMemo(() => {
      if (leaveType !== 'Sick' || leaveDuration.workingDays <= 0) return [];
      return calculateSickLeaveTiers(usedSickDays, leaveDuration.workingDays);
  }, [leaveType, leaveDuration.workingDays, usedSickDays]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !currentUser || !selectedEmployeeId || !startDate || !endDate || !tenantId) return;

    setIsSaving(true);
    try {
      const leavePath = getTenantPath('leaveRequests', tenantId);
      const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || { fullName: currentUser.fullName };
      const dataToSave = {
        employeeId: selectedEmployeeId,
        employeeName: (selectedEmployee as any).fullName,
        leaveType, startDate, endDate,
        days: leaveDuration.totalDays,
        workingDays: leaveDuration.workingDays,
        notes,
        status: 'pending' as const,
        createdAt: serverTimestamp(),
        companyId: tenantId
      };
      
      let finalId = '';
      if (leaveRequestToEdit?.id) {
          finalId = leaveRequestToEdit.id;
          await updateDoc(doc(firestore, leavePath, finalId), cleanFirestoreData(dataToSave));
      } else {
          const docRef = await addDoc(collection(firestore, leavePath), dataToSave);
          finalId = docRef.id;
      }
      
      // 🚀 إرسال إشعارات للإدارة والـ HR
      const adminHRUsersQuery = query(collection(firestore, getTenantPath('users', tenantId)), where('role', 'in', ['Admin', 'HR']));
      const adminsSnap = await getDocs(adminHRUsersQuery);
      adminsSnap.forEach(adminDoc => {
          if (adminDoc.id !== currentUser.id) {
              createNotification(firestore, {
                  userId: adminDoc.id,
                  title: 'طلب إجازة جديد',
                  body: `قدم الموظف ${(selectedEmployee as any).fullName} طلب إجازة ${leaveTypeTranslations[leaveType]}.`,
                  link: `/dashboard/hr/leaves`
              });
          }
      });
      
      onSaveSuccess(); onClose();
      toast({ title: 'تم تقديم الطلب', description: 'تم إخطار الإدارة والـ HR بطلبك الجديد.' });
    } catch (error) { setIsSaving(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-lg rounded-[2.5rem] shadow-2xl border-none p-0 overflow-hidden bg-white">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-8 bg-primary/5 border-b">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><CalendarCheck className="h-6 w-6" /></div>
                <DialogTitle className="text-xl font-black text-[#1e1b4b]">{leaveRequestToEdit ? 'تعديل طلب الإجازة' : 'تقديم طلب إجازة'}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-6">
            {overlapError && <Alert variant="destructive" className="rounded-2xl border-2 border-red-500 bg-red-50 py-4 animate-in zoom-in-95"><AlertCircle className="h-5 w-5"/><AlertTitle className="text-sm font-black">تنبيه تداخل مواعيد</AlertTitle><AlertDescription className="text-xs font-bold">{overlapError}</AlertDescription></Alert>}

            <div className="grid gap-2">
                <Label className="font-black text-gray-700 pr-1">الموظف المعني *</Label>
                {isAdmin ? <InlineSearchList value={selectedEmployeeId} onSelect={setSelectedEmployeeId} options={employees.map(e => ({ value: e.id!, label: e.fullName }))} placeholder="اختر موظفاً..." disabled={isSaving} /> : <div className="h-11 rounded-xl border-2 bg-muted/20 px-4 flex items-center font-black text-[#1e1b4b] gap-2"><User className="h-4 w-4 opacity-40" />{currentUser?.fullName}</div>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label className="font-bold pr-1">نوع الإجازة *</Label>
                    <Select value={leaveType} onValueChange={(v: any) => setLeaveType(v)} disabled={isSaving}>
                        <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue/></SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="Annual">سنوية</SelectItem>
                            <SelectItem value="Sick">مرضية (طبيات)</SelectItem>
                            <SelectItem value="Emergency">طارئة</SelectItem>
                            <SelectItem value="Unpaid">بدون أجر</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2 text-center">
                    <Label className="font-bold text-xs opacity-50">أيام العمل</Label>
                    <div className="h-11 rounded-xl bg-muted/30 border-2 flex items-center justify-center font-black text-primary">{leaveDuration.workingDays} أيام</div>
                </div>
            </div>

            {leaveType === 'Sick' && (
                <div className="p-5 bg-blue-50 border-2 border-blue-200 rounded-[2rem] space-y-3 animate-in slide-in-from-top-4 shadow-inner">
                    <div className="flex justify-between items-center text-xs font-black text-blue-800">
                        <span className="flex items-center gap-2"><Calculator className="h-4 w-4"/> تحليل الشرائح المالية:</span>
                        <span>المستخدم سابقاً: {usedSickDays} يوم</span>
                    </div>
                    <Separator className="bg-blue-200/50" />
                    <div className="space-y-2">
                        {sickTiers.map((tier, i) => (
                            <div key={i} className="flex justify-between text-[11px] font-bold text-blue-900 bg-white/60 p-2 rounded-lg border border-blue-100">
                                <span>{tier.label}:</span>
                                <span>{tier.days} يوم</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label className="font-bold pr-1">من تاريخ *</Label><DateInput value={startDate} onChange={setStartDate} disabled={isSaving} /></div>
              <div className="grid gap-2"><Label className="font-bold pr-1">إلى تاريخ *</Label><DateInput value={endDate} onChange={setEndDate} disabled={isSaving} /></div>
            </div>
            
            <div className="grid gap-2"><Label className="font-bold pr-1">ملاحظات الطلب</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-2xl border-2 p-4" placeholder="اختياري..." disabled={isSaving} /></div>
          </div>

          <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
            <Button type="submit" disabled={isSaving || !!overlapError || loadingQuota} className="rounded-xl font-black px-12 h-12 shadow-xl shadow-primary/30 gap-2 bg-primary text-white hover:bg-black transition-all">
              {isSaving ? <Loader2 className="animate-spin h-5 w-5"/> : <Save className="ml-2 h-4 w-4" />} {leaveRequestToEdit ? 'تحديث' : 'تقديم الطلب'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}