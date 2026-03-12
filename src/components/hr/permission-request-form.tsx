
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import type { Employee, PermissionRequest, LeaveRequest } from '@/lib/types';
import { Loader2, Save, Upload, ShieldAlert } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { InlineSearchList } from '../ui/inline-search-list';
import { startOfMonth, endOfMonth, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Info } from 'lucide-react';
import { toFirestoreDate } from '@/services/date-converter';

interface PermissionRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  permissionToEdit?: PermissionRequest | null;
  employees: Employee[];
  loadingRefs: boolean;
}

export function PermissionRequestForm({ isOpen, onClose, onSaveSuccess, permissionToEdit, employees, loadingRefs }: PermissionRequestFormProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [permissionType, setPermissionType] = useState<'late_arrival' | 'early_departure'>('late_arrival');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const isEditing = !!permissionToEdit;

  useEffect(() => {
    if (isOpen) {
        if (isEditing && permissionToEdit) {
            setSelectedEmployeeId(permissionToEdit.employeeId);
            setPermissionType(permissionToEdit.type);
            setDate(toFirestoreDate(permissionToEdit.date) || undefined);
            setReason(permissionToEdit.reason);
        } else {
             if (currentUser?.role !== 'Admin' && currentUser?.role !== 'HR') {
              setSelectedEmployeeId(currentUser?.employeeId || '');
            } else {
              setSelectedEmployeeId('');
            }
            setPermissionType('late_arrival');
            setDate(new Date());
            setReason('');
        }
    }
  }, [isOpen, isEditing, permissionToEdit, currentUser]);

  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);
  const employeeOptions = useMemo(() => activeEmployees.map(e => ({ value: e.id!, label: e.fullName })), [activeEmployees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !currentUser || !selectedEmployeeId || !permissionType || !date || !reason.trim()) {
      toast({ variant: 'destructive', title: 'حقول ناقصة', description: 'الرجاء تعبئة جميع الحقول المطلوبة.' });
      return;
    }
    
    setIsSaving(true);
    try {
      const selectedEmployee = activeEmployees.find(e => e.id === selectedEmployeeId);
      if (!selectedEmployee) throw new Error('لم يتم العثور على الموظف المختار أو أنه غير نشط.');
      
      const checkDateStart = startOfDay(date);
      const checkDateEnd = endOfDay(date);

      // --- الدرع الرقابي: التحقق من وجود إجازة معتمدة في نفس التاريخ ---
      const leavesQuery = query(
          collection(firestore, 'leaveRequests'),
          where('employeeId', '==', selectedEmployeeId)
      );
      const leavesSnapshot = await getDocs(leavesQuery);
      const hasOverlappingLeave = leavesSnapshot.docs.some(docSnap => {
          const l = docSnap.data() as LeaveRequest;
          const leaveStart = toFirestoreDate(l.startDate);
          const leaveEnd = toFirestoreDate(l.endDate);
          return ['approved', 'on-leave', 'returned'].includes(l.status) &&
                 leaveStart && leaveEnd &&
                 checkDateStart >= startOfDay(leaveStart) && checkDateStart <= endOfDay(leaveEnd);
      });

      if (hasOverlappingLeave) {
          throw new Error('⚠️ منع رقابي: لا يمكن تقديم طلب استئذان لموظف في إجازة معتمدة في هذا التاريخ.');
      }

      if (!isEditing) {
        const startOfMonthDate = startOfMonth(date);
        const endOfMonthDate = endOfMonth(date);
        
        const permissionsQuery = query(
            collection(firestore, 'permissionRequests'),
            where('employeeId', '==', selectedEmployeeId)
        );
        const permissionsSnapshot = await getDocs(permissionsQuery);
        const allUserPermissions = permissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        const approvedCountInMonth = allUserPermissions.filter(p => {
            const pDate = toFirestoreDate(p.date);
            return p.status === 'approved' && pDate && pDate >= startOfMonthDate && pDate <= endOfMonthDate;
        }).length;

        if (approvedCountInMonth >= 3) {
            throw new Error('لقد استنفذ الموظف الحد الأقصى للاستئذانات الموافق عليها (3) لهذا الشهر.');
        }
        
        const sameDayRequest = allUserPermissions.some(p => {
            const pDate = toFirestoreDate(p.date);
            return pDate && isSameDay(pDate, date);
        });

        if (sameDayRequest) {
             throw new Error('يوجد طلب استئذان آخر مسجل لهذا الموظف في نفس اليوم.');
        }
      }

      const dataToSave = {
        employeeId: selectedEmployeeId,
        employeeName: selectedEmployee.fullName,
        type: permissionType,
        date: date,
        reason: reason,
      };
      
      if (isEditing && permissionToEdit?.id) {
        const reqRef = doc(firestore, 'permissionRequests', permissionToEdit.id);
        await updateDoc(reqRef, dataToSave);
        toast({ title: 'نجاح', description: 'تم تعديل طلب الاستئذان بنجاح.' });
      } else {
        const newRequest = {
            ...dataToSave,
            status: 'pending' as const,
            createdAt: serverTimestamp(),
        };
        await addDoc(collection(firestore, 'permissionRequests'), newRequest);
        toast({ title: 'نجاح', description: 'تم إرسال طلب الاستئذان بنجاح.' });
      }
      
      onSaveSuccess();
      onClose();

    } catch (error: any) {
      const message = error instanceof Error ? error.message : "فشل حفظ الطلب.";
      toast({ variant: 'destructive', title: 'خطأ في العملية', description: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-md rounded-[2rem] shadow-2xl border-none" 
        dir="rtl"
        onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[cmdk-root]') || target.closest('[role="listbox"]') || target.closest('[data-radix-popper-content-wrapper]') || target.closest('[data-inline-search-list-options]')) {
                e.preventDefault();
            }
        }}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-black flex items-center gap-2">
                <ShieldAlert className="text-primary h-5 w-5" />
                {isEditing ? 'تعديل طلب استئذان' : 'طلب استئذان جديد'}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold">
              سيخضع الطلب لرقابة التداخل مع الإجازات ومسيرة الرواتب.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            {(currentUser?.role === 'Admin' || currentUser?.role === 'HR') && (
              <div className="grid gap-2">
                <Label htmlFor="employee" className="font-bold mr-1">الموظف المعني *</Label>
                <InlineSearchList
                    value={selectedEmployeeId}
                    onSelect={setSelectedEmployeeId}
                    options={employeeOptions}
                    placeholder={loadingRefs ? 'جاري التحميل...' : 'اختر موظفاً...'}
                    disabled={loadingRefs || isSaving}
                    className="h-11 rounded-xl"
                />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="permissionType" className="font-bold mr-1">نوع الاستئذان *</Label>
                <Select value={permissionType} onValueChange={(v) => setPermissionType(v as any)} disabled={isSaving}>
                    <SelectTrigger id="permissionType" className="h-11 rounded-xl border-2"><SelectValue/></SelectTrigger>
                    <SelectContent dir="rtl">
                        <SelectItem value="late_arrival">تأخير صباحي</SelectItem>
                        <SelectItem value="early_departure">خروج مبكر</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date" className="font-bold mr-1">تاريخ الاستئذان *</Label>
                <DateInput value={date} onChange={setDate} className="h-11 rounded-xl" disabled={isSaving} />
              </div>
            </div>
             <div className="grid gap-2">
              <Label htmlFor="reason" className="font-bold mr-1">السبب / مبرر الطلب *</Label>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} className="rounded-2xl border-2" placeholder="اشرح سبب الاستئذان..." disabled={isSaving} />
            </div>
            
            <Alert className="bg-primary/5 border-primary/20 rounded-2xl">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle className="text-xs font-black text-primary uppercase">قواعد الرقابة</AlertTitle>
                <AlertDescription className="text-[10px] font-bold text-slate-600 mt-1">
                    • الحد الأقصى: 3 استئذانات شهرياً. <br/>
                    • يُمنع الاستئذان في أيام الإجازات المعتمدة.
                </AlertDescription>
            </Alert>
          </div>
          <DialogFooter className="gap-2 border-t pt-6">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold">إلغاء</Button>
            <Button type="submit" disabled={isSaving} className="rounded-xl font-black px-10 shadow-lg shadow-primary/20">
              {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
              {isEditing ? 'حفظ التعديلات' : 'إرسال الطلب'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
