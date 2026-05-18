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
import { Loader2, Save, ShieldAlert, Info, User, AlertCircle } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { InlineSearchList } from '../ui/inline-search-list';
import { startOfMonth, endOfMonth, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { toFirestoreDate } from '@/services/date-converter';
import { cn, getTenantPath } from '@/lib/utils';

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
  const tenantId = currentUser?.currentCompanyId;

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [permissionType, setPermissionType] = useState<'late_arrival' | 'early_departure'>('late_arrival');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [overlapError, setOverlapError] = useState<string | null>(null);
  
  const isEditing = !!permissionToEdit;
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'HR' || currentUser?.role === 'Developer';

  useEffect(() => {
    if (isOpen) {
        if (isEditing && permissionToEdit) {
            setSelectedEmployeeId(permissionToEdit.employeeId);
            setPermissionType(permissionToEdit.type);
            setDate(toFirestoreDate(permissionToEdit.date) || undefined);
            setReason(permissionToEdit.reason);
        } else {
             if (!isAdmin) {
              setSelectedEmployeeId(currentUser?.employeeId || '');
            } else {
              setSelectedEmployeeId('');
            }
            setPermissionType('late_arrival');
            setDate(new Date());
            setReason('');
        }
        setOverlapError(null);
    }
  }, [isOpen, isEditing, permissionToEdit, currentUser, isAdmin]);

  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);
  const employeeOptions = useMemo(() => activeEmployees.map(e => ({ value: e.id!, label: e.fullName })), [activeEmployees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !currentUser || !selectedEmployeeId || !permissionType || !date || !reason.trim() || !tenantId) {
      toast({ variant: 'destructive', title: 'حقول ناقصة', description: 'الرجاء تعبئة جميع الحقول المطلوبة.' });
      return;
    }
    
    setIsSaving(true);
    setOverlapError(null);

    try {
      const selectedEmployee = activeEmployees.find(e => e.id === selectedEmployeeId) || (selectedEmployeeId === currentUser?.employeeId ? { fullName: currentUser.fullName } : null);
      if (!selectedEmployee) throw new Error('لم يتم العثور على الموظف المختار أو أنه غير نشط.');
      
      const checkDateStart = startOfDay(date);

      // 🛡️ رادار منع التضارب السيادي: التحقق من وجود إجازة معتمدة في نفس التاريخ 🛡️
      const leavesPath = getTenantPath('leaveRequests', tenantId);
      const leavesQuery = query(
          collection(firestore, leavesPath),
          where('employeeId', '==', selectedEmployeeId)
      );
      const leavesSnapshot = await getDocs(leavesQuery);
      const hasOverlappingLeave = leavesSnapshot.docs.some(docSnap => {
          const l = docSnap.data() as LeaveRequest;
          const leaveStart = toFirestoreDate(l.startDate);
          const leaveEnd = toFirestoreDate(l.endDate);
          // المنع يسري إذا كانت الحالة (موافق عليه، في إجازة، أو عاد للعمل وتاريخ الاستئذان ضمن الفترة)
          return ['approved', 'on-leave', 'returned'].includes(l.status) &&
                 leaveStart && leaveEnd &&
                 checkDateStart >= startOfDay(leaveStart) && checkDateStart <= endOfDay(leaveEnd);
      });

      if (hasOverlappingLeave) {
          const msg = "⚠️ منع رقابي: لا يمكن تقديم طلب استئذان لموظف في إجازة معتمدة في هذا التاريخ.";
          setOverlapError(msg);
          toast({ variant: 'destructive', title: 'تضارب مواعيد', description: msg });
          setIsSaving(false);
          return;
      }

      const permissionsPath = getTenantPath('permissionRequests', tenantId);

      if (!isEditing) {
        const startOfMonthDate = startOfMonth(date);
        const endOfMonthDate = endOfMonth(date);
        
        const permissionsQuery = query(
            collection(firestore, permissionsPath),
            where('employeeId', '==', selectedEmployeeId)
        );
        const permissionsSnapshot = await getDocs(permissionsQuery);
        const allUserPermissions = permissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        // التحقق من الحد الأقصى (3 شهرياً)
        const approvedCountInMonth = allUserPermissions.filter(p => {
            const pDate = toFirestoreDate(p.date);
            return p.status === 'approved' && pDate && pDate >= startOfMonthDate && pDate <= endOfMonthDate;
        }).length;

        if (approvedCountInMonth >= 3) {
            throw new Error('لقد استنفذ الموظف الحد الأقصى للاستئذانات الموافق عليها (3) لهذا الشهر.');
        }
        
        const sameDayRequest = allUserPermissions.some(p => {
            const pDate = toFirestoreDate(p.date);
            return pDate && isSameDay(pDate, date) && p.status !== 'rejected';
        });

        if (sameDayRequest) {
             throw new Error('يوجد طلب استئذان آخر مسجل لهذا الموظف في نفس اليوم.');
        }
      }

      const dataToSave = {
        employeeId: selectedEmployeeId,
        employeeName: (selectedEmployee as any).fullName || (selectedEmployee as any).nameAr,
        type: permissionType,
        date: date,
        reason: reason,
        companyId: tenantId
      };
      
      if (isEditing && permissionToEdit?.id) {
        const reqRef = doc(firestore, permissionsPath, permissionToEdit.id);
        await updateDoc(reqRef, dataToSave);
        toast({ title: 'نجاح التحديث' });
      } else {
        const newRequest = {
            ...dataToSave,
            status: 'pending' as const,
            createdAt: serverTimestamp(),
        };
        await addDoc(collection(firestore, permissionsPath), newRequest);
        toast({ title: 'نجاح التقديم' });
      }
      
      onSaveSuccess();
      onClose();

    } catch (error: any) {
      const message = error instanceof Error ? error.message : "فشل حفظ الطلب.";
      toast({ variant: 'destructive', title: 'خطأ', description: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-md rounded-[2.5rem] shadow-2xl border-none p-0 overflow-hidden bg-white" 
        dir="rtl"
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-8 bg-primary/5 border-b">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                    <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                    <DialogTitle className="text-xl font-black text-[#1e1b4b]">
                        {isEditing ? 'تعديل طلب استئذان' : 'تقديم طلب استئذان'}
                    </DialogTitle>
                    <DialogDescription className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">
                        سيخضع الطلب للتدقيق ورقابة التداخل مع الإجازات.
                    </DialogDescription>
                </div>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-6">
            {/* 🛡️ التنبيه السيادي في أعلى الشاشة (Top Banner) 🛡️ */}
            {overlapError && (
                <Alert variant="destructive" className="rounded-2xl border-2 border-red-500 bg-red-50 shadow-sm animate-in slide-in-from-top-4 duration-500 py-6">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                    <AlertTitle className="text-lg font-black text-red-800">تحذير رقابي حرج</AlertTitle>
                    <AlertDescription className="text-sm font-bold text-red-700 mt-2 leading-relaxed">
                        {overlapError}
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-2">
                <Label htmlFor="employee" className="font-black text-gray-700 pr-1">الموظف المعني *</Label>
                {isAdmin ? (
                    <InlineSearchList
                        value={selectedEmployeeId}
                        onSelect={(v) => { setSelectedEmployeeId(v); setOverlapError(null); }}
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
                <Label htmlFor="permissionType" className="font-bold text-gray-700 pr-1">نوع الاستئذان *</Label>
                <Select value={permissionType} onValueChange={(v) => setPermissionType(v as any)} disabled={isSaving}>
                    <SelectTrigger id="permissionType" className="h-12 rounded-xl border-2 font-bold"><SelectValue/></SelectTrigger>
                    <SelectContent dir="rtl">
                        <SelectItem value="late_arrival">تأخير صباحي</SelectItem>
                        <SelectItem value="early_departure">خروج مبكر</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date" className="font-bold text-gray-700 pr-1">تاريخ الاستئذان *</Label>
                <DateInput value={date} onChange={(d) => { setDate(d); setOverlapError(null); }} className="h-12 rounded-xl border-2" disabled={isSaving} />
              </div>
            </div>

             <div className="grid gap-2">
              <Label htmlFor="reason" className="font-bold text-gray-700 pr-1">السبب / مبرر الطلب *</Label>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} className="rounded-2xl border-2 p-4 text-base font-medium focus:ring-primary/20" placeholder="اشرح سبب الاستئذان بدقة..." disabled={isSaving} />
            </div>
            
            <Alert className="bg-primary/5 border-primary/20 rounded-2xl">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle className="text-xs font-black text-primary uppercase">قواعد الرقابة والامتثال</AlertTitle>
                <AlertDescription className="text-[10px] font-bold text-slate-600 mt-1 leading-relaxed">
                    • الحد الأقصى: 3 استئذانات موافق عليها شهرياً. <br/>
                    • يُمنع الاستئذان قطعياً في أيام الإجازات المعتمدة (سنوية، مرضية، طارئة).
                </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
            <Button type="submit" disabled={isSaving || !!overlapError} className="rounded-xl font-black px-12 h-12 shadow-xl shadow-primary/30 gap-2 bg-[#7209B7] text-white hover:bg-black transition-all">
              {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
              {isEditing ? 'حفظ التعديلات' : 'إرسال الطلب'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
