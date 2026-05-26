
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import type { Employee, PermissionRequest, LeaveRequest } from '@/lib/types';
import { Loader2, Save, User, AlertCircle, Clock, CalendarCheck } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { InlineSearchList } from '../ui/inline-search-list';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toFirestoreDate } from '@/services/date-converter';
import { cn, getTenantPath } from '@/lib/utils';
import { Input } from '../ui/input';
import { createNotification } from '@/services/notification-service';

interface PermissionRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  permissionToEdit?: PermissionRequest | null;
  employees: Employee[];
  loadingRefs: boolean;
}

const typeTranslations: Record<string, string> = {
    late_arrival: 'تأخير صباحي',
    early_departure: 'خروج مبكر',
};

export function PermissionRequestForm({ isOpen, onClose, onSaveSuccess, permissionToEdit, employees, loadingRefs }: PermissionRequestFormProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const tenantId = currentUser?.currentCompanyId;

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [permissionType, setPermissionType] = useState<'late_arrival' | 'early_departure'>('late_arrival');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [durationHours, setDurationHours] = useState('1');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [overlapError, setOverlapError] = useState<string | null>(null);
  
  const [monthlyTotalHours, setMonthlyTotalHours] = useState(0);
  const [loadingQuota, setLoadingQuota] = useState(false);
  
  const isAdmin = ['Admin', 'HR', 'Developer'].includes(currentUser?.role || '');

  useEffect(() => {
    if (isOpen) {
        setIsSaving(false);
        setOverlapError(null);
        if (permissionToEdit) {
            setSelectedEmployeeId(permissionToEdit.employeeId);
            setPermissionType(permissionToEdit.type);
            setDate(toFirestoreDate(permissionToEdit.date) || undefined);
            setReason(permissionToEdit.reason);
            setDurationHours(String(permissionToEdit.durationHours || '1'));
        } else {
            setSelectedEmployeeId(!isAdmin ? (currentUser?.employeeId || '') : '');
            setPermissionType('late_arrival');
            setDate(new Date());
            setReason('');
            setDurationHours('1');
        }
    }
  }, [isOpen, permissionToEdit, currentUser, isAdmin]);

  useEffect(() => {
    setOverlapError(null);
    if (!isOpen || !firestore || !selectedEmployeeId || !date || !tenantId) {
        setMonthlyTotalHours(0);
        return;
    }

    const checkMonthlyQuotaAndOverlaps = async () => {
        setLoadingQuota(true);
        try {
            const monthStart = startOfMonth(date);
            const monthEnd = endOfMonth(date);
            const permissionsPath = getTenantPath('permissionRequests', tenantId);
            
            const q = query(
                collection(firestore, permissionsPath!),
                where('employeeId', '==', selectedEmployeeId)
            );
            
            const snap = await getDocs(q);
            let totalHours = 0;
            snap.forEach(docSnap => {
                const data = docSnap.data() as PermissionRequest;
                if (permissionToEdit && docSnap.id === permissionToEdit.id) return;
                
                const pDate = toFirestoreDate(data.date);
                if (pDate && pDate >= monthStart && pDate <= monthEnd && ['pending', 'approved'].includes(data.status)) {
                    totalHours += (data.durationHours || 0);
                }
            });
            setMonthlyTotalHours(totalHours);

            const leavesPath = getTenantPath('leaveRequests', tenantId);
            const checkDateStart = startOfDay(date);
            const leavesSnap = await getDocs(query(collection(firestore, leavesPath!), where('employeeId', '==', selectedEmployeeId)));
            const hasLeave = leavesSnap.docs.some(d => {
                const l = d.data() as LeaveRequest;
                if (!['approved', 'on-leave', 'returned'].includes(l.status)) return false;
                const s = toFirestoreDate(l.startDate);
                const e = toFirestoreDate(l.endDate);
                return s && e && checkDateStart >= startOfDay(s) && checkDateStart <= endOfDay(e);
            });

            if (hasLeave) {
                setOverlapError("عذراً، الموظف لديه إجازة معتمدة في هذا التاريخ؛ لا يمكن طلب استئذان في يوم إجازة.");
            }
        } catch (e) {
            console.error(e);
        } finally { setLoadingQuota(false); }
    };

    checkMonthlyQuotaAndOverlaps();
  }, [isOpen, selectedEmployeeId, date, firestore, tenantId, permissionToEdit]);

  const employeeOptions = useMemo(() => employees.filter(e => e.status === 'active').map(e => ({ value: e.id!, label: e.fullName })), [employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !currentUser || !selectedEmployeeId || !date || !reason.trim() || !tenantId) return;

    const duration = parseFloat(durationHours);
    if (isNaN(duration) || duration <= 0 || duration > 3) {
        toast({ variant: 'destructive', title: 'تنبيه إداري', description: 'مدة الاستئذان الواحدة يجب ألا تتجاوز 3 ساعات.' });
        return;
    }

    if ((monthlyTotalHours + duration) > 12) {
        toast({ variant: 'destructive', title: 'تجاوز الحد الشهري', description: 'هذا الطلب يتجاوز سقف الـ 12 ساعة المسموح بها شهرياً.' });
        return;
    }
    
    setIsSaving(true);
    try {
      const permissionsPath = getTenantPath('permissionRequests', tenantId);
      const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
      
      const dataToSave = {
        employeeId: selectedEmployeeId,
        employeeName: selectedEmployee?.fullName || currentUser.fullName,
        type: permissionType,
        date: date,
        durationHours: duration,
        reason: reason,
      };
      
      if (permissionToEdit?.id) {
          await updateDoc(doc(firestore, permissionsPath!, permissionToEdit.id), dataToSave);
      } else {
          await addDoc(collection(firestore, permissionsPath!), { ...dataToSave, status: 'pending', createdAt: serverTimestamp(), companyId: tenantId });
          
          // 🚀 إخطار الإدارة والـ HR بالطلب الجديد 🚀
          const usersPath = getTenantPath('users', tenantId);
          const adminHRUsersQuery = query(collection(firestore, usersPath!), where('role', 'in', ['Admin', 'HR']));
          const adminsSnap = await getDocs(adminHRUsersQuery);
          
          adminsSnap.forEach(adminDoc => {
              if (adminDoc.id !== currentUser.id) {
                  createNotification(firestore, {
                      userId: adminDoc.id,
                      title: '🕒 طلب استئذان جديد',
                      body: `قدم الموظف ${selectedEmployee?.fullName || currentUser.fullName} طلب ${typeTranslations[permissionType]}.`,
                      link: `/dashboard/hr/permissions`
                  }, tenantId);
              }
          });
      }
      
      onSaveSuccess(); onClose();
      toast({ title: 'تم تقديم الطلب بنجاح' });
    } catch (error) { setIsSaving(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-md rounded-[2.5rem] shadow-2xl border-none p-0 overflow-hidden bg-white">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-8 bg-primary/5 border-b">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><Clock className="h-6 w-6" /></div>
                <div>
                    <DialogTitle className="text-xl font-black text-[#1e1b4b]">{permissionToEdit ? 'تعديل الاستئذان' : 'طلب استئذان جديد'}</DialogTitle>
                </div>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-6">
            {overlapError && (
                <Alert variant="destructive" className="rounded-2xl border-2 border-red-500 bg-red-50 py-6 mb-2 animate-in zoom-in-95">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                    <AlertTitle className="text-lg font-black text-red-800">تنبيه تداخل مواعيد</AlertTitle>
                    <AlertDescription className="text-sm font-bold text-red-700 mt-2">{overlapError}</AlertDescription>
                </Alert>
            )}

            <div className="p-5 bg-indigo-50 border-2 border-indigo-200 rounded-[2rem] flex items-center justify-between shadow-inner">
                <div className="space-y-1">
                    <Label className="text-[10px] font-black text-indigo-700 uppercase">الرصيد الشهري المستخدم</Label>
                    <p className="text-2xl font-black text-indigo-900 font-mono">
                        {loadingQuota ? <Loader2 className="h-4 w-4 animate-spin"/> : `${monthlyTotalHours} / 12`} <span className="text-xs">ساعة</span>
                    </p>
                </div>
                <div className="p-3 bg-indigo-600/10 rounded-2xl text-indigo-600"><CalendarCheck className="h-6 w-6"/></div>
            </div>

            <div className="grid gap-2">
                <Label className="font-black text-gray-700 pr-1">الموظف المعني *</Label>
                {isAdmin ? <InlineSearchList value={selectedEmployeeId} onSelect={setSelectedEmployeeId} options={employeeOptions} placeholder={loadingRefs ? 'جاري التحميل...' : 'اختر موظفاً...'} disabled={loadingRefs || isSaving} /> : <div className="h-12 rounded-xl border-2 bg-muted/20 px-4 flex items-center font-black text-[#1e1b4b] gap-2"><User className="h-4 w-4 opacity-40" />{currentUser?.fullName}</div>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="font-bold text-gray-700 pr-1">النوع</Label>
                <Select value={permissionType} onValueChange={(v: any) => setPermissionType(v)} disabled={isSaving}>
                    <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue/></SelectTrigger>
                    <SelectContent dir="rtl">
                        <SelectItem value="late_arrival">تأخير صباحي</SelectItem>
                        <SelectItem value="early_departure">خروج مبكر</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label className="font-bold text-gray-700 pr-1">تاريخ اليوم *</Label><DateInput value={date} onChange={setDate} className="h-11 rounded-xl border-2" disabled={isSaving} /></div>
            </div>

            <div className="grid gap-2">
                <Label className="font-black text-gray-700 pr-1 flex items-center gap-2"><Clock className="h-3 w-3 text-primary" /> مدة الاستئذان المطلوب (ساعات) *</Label>
                <div className="flex items-center gap-3">
                    <Input type="number" step="0.5" max="3" min="0.5" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} className="h-12 rounded-xl border-2 text-center font-black text-xl text-primary w-24" />
                    <span className="text-[10px] font-bold text-muted-foreground">الحد الأقصى للطلب هو 3 ساعات.</span>
                </div>
            </div>

             <div className="grid gap-2"><Label className="font-bold text-gray-700 pr-1">المبررات / السبب *</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} className="rounded-2xl border-2 p-4 text-base font-medium" placeholder="اذكر سبب الطلب بوضوح..." disabled={isSaving} /></div>
          </div>

          <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">تراجع</Button>
            <Button type="submit" disabled={isSaving || !!overlapError || (monthlyTotalHours >= 12 && !permissionToEdit)} className="rounded-xl font-black px-12 h-12 shadow-xl shadow-primary/30 gap-2 bg-[#7209B7] text-white hover:bg-black transition-all">
              {isSaving ? <Loader2 className="animate-spin h-5 w-5"/> : <Save className="ml-2 h-4 w-4" />} {permissionToEdit ? 'تحديث الطلب' : 'تقديم الطلب'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
