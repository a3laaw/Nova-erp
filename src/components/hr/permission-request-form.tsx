'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import type { Employee, PermissionRequest } from '@/lib/types';
import { Loader2, Save } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { InlineSearchList } from '../ui/inline-search-list';
import { startOfMonth, endOfMonth } from 'date-fns';
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

  const employeeOptions = useMemo(() => employees.map(e => ({ value: e.id!, label: e.fullName })), [employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !currentUser || !selectedEmployeeId || !permissionType || !date || !reason.trim()) {
      toast({ variant: 'destructive', title: 'حقول ناقصة', description: 'الرجاء تعبئة جميع الحقول المطلوبة.' });
      return;
    }
    
    setIsSaving(true);
    try {
      const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
      if (!selectedEmployee) throw new Error('لم يتم العثور على الموظف المختار.');
      
      if (!isEditing) {
        const startOfMonthDate = startOfMonth(date);
        const endOfMonthDate = endOfMonth(date);

        const permissionsQuery = query(
          collection(firestore, 'permissionRequests'),
          where('employeeId', '==', selectedEmployeeId),
          where('status', '==', 'approved')
        );
        
        const permissionsSnapshot = await getDocs(permissionsQuery);
        const approvedCountInMonth = permissionsSnapshot.docs.filter(doc => {
            const permissionDate = toFirestoreDate(doc.data().date);
            return permissionDate && permissionDate >= startOfMonthDate && permissionDate <= endOfMonthDate;
        }).length;

        if (approvedCountInMonth >= 3) {
            throw new Error('لقد استنفذ الموظف الحد الأقصى للاستئذانات (3) لهذا الشهر.');
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
            <DialogTitle>{isEditing ? 'تعديل طلب استئذان' : 'طلب استئذان جديد'}</DialogTitle>
            <DialogDescription>
              سيتم إرسال الطلب للموافقة عليه من قبل مدير النظام أو قسم الموارد البشرية.
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
                <Label htmlFor="permissionType">نوع الاستئذان</Label>
                <Select value={permissionType} onValueChange={(v) => setPermissionType(v as any)}>
                    <SelectTrigger id="permissionType"><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="late_arrival">تأخير صباحي</SelectItem>
                        <SelectItem value="early_departure">خروج مبكر</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">تاريخ الاستئذان</Label>
                <DateInput value={date} onChange={setDate} />
              </div>
            </div>
             <div className="grid gap-2">
              <Label htmlFor="reason">السبب / ملاحظات</Label>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>ملاحظة</AlertTitle>
                <AlertDescription>
                    الحد الأقصى المسموح به لطلبات الاستئذان هو 3 طلبات موافق عليها شهريًا.
                </AlertDescription>
            </Alert>
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
