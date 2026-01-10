'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Alert, AlertDescription } from '../ui/alert';
import { Upload } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, addDoc, serverTimestamp, type DocumentData } from 'firebase/firestore';
import type { Employee } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { differenceInCalendarDays } from 'date-fns';

interface LeaveRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
}

type LeaveType = 'Annual' | 'Sick' | 'Emergency' | 'Unpaid';

export function LeaveRequestForm({ isOpen, onClose }: LeaveRequestFormProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [employees, setEmployees] = useState<Employee[]>([]);
    
    const employeesQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'employees'), where('status', '==', 'active'), orderBy('fullName'));
    }, [firestore]);

    const [value, loading, error] = useCollection(employeesQuery);

    useEffect(() => {
        if (value) {
            setEmployees(value.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
        }
    }, [value]);

    const [employeeId, setEmployeeId] = useState('');
    const [leaveType, setLeaveType] = useState<LeaveType | ''>('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [notes, setNotes] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const days = useMemo(() => {
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (start > end) return -1;
            return differenceInCalendarDays(end, start) + 1;
        }
        return 0;
    }, [startDate, endDate]);

    const resetForm = () => {
        setEmployeeId('');
        setLeaveType('');
        setStartDate('');
        setEndDate('');
        setNotes('');
        setFile(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore) return;
        
        // --- Validation ---
        if (!employeeId || !leaveType || !startDate || !endDate) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تعبئة جميع الحقول الإلزامية.' });
            return;
        }
        if (days <= 0) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.' });
            return;
        }
        if (leaveType === 'Sick' && !file) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء إرفاق التقرير الطبي للإجازة المرضية.' });
            return;
        }
        
        setIsSaving(true);
        try {
            const selectedEmployee = employees.find(emp => emp.id === employeeId);
            
            // In a real app, you would upload the file to Firebase Storage first and get the URL
            // For now, we will skip this step.
            
            await addDoc(collection(firestore, 'leaveRequests'), {
                employeeId: employeeId,
                employeeName: selectedEmployee?.fullName || 'N/A',
                leaveType: leaveType,
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString(),
                days: days,
                notes: notes,
                attachmentUrl: null, // Placeholder for file URL
                status: 'pending',
                createdAt: serverTimestamp(),
            });

            toast({ title: 'نجاح', description: 'تم تقديم طلب الإجازة بنجاح.' });
            resetForm();
            onClose();
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تقديم الطلب. الرجاء المحاولة مرة أخرى.' });
        } finally {
            setIsSaving(false);
        }
    }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
                <DialogTitle>طلب إجازة جديد</DialogTitle>
                <DialogDescription>
                    قم بتعبئة النموذج لتقديم طلب إجازة جديد لأحد الموظفين.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label htmlFor="employee">الموظف <span className="text-destructive">*</span></Label>
                    <Select dir="rtl" value={employeeId} onValueChange={setEmployeeId} required>
                        <SelectTrigger id="employee" disabled={loading}>
                            <SelectValue placeholder={loading ? "تحميل..." : "اختر الموظف..."} />
                        </SelectTrigger>
                        <SelectContent>
                            {loading && <p className="p-2 text-xs text-muted-foreground">جاري تحميل الموظفين...</p>}
                            {!loading && employees.length === 0 ? (
                                <p className="p-2 text-xs text-muted-foreground">لا يوجد موظفون نشطون حالياً.</p>
                            ) : (
                                employees.map(emp => (
                                    <SelectItem key={emp.id} value={emp.id!}>{emp.fullName}</SelectItem>
                                ))
                            )}
                             {error && <p className="p-2 text-xs text-destructive">فشل تحميل الموظفين</p>}
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
                 {days > 0 && <Alert variant="default" className='bg-muted/50'><AlertDescription>مجموع الأيام: {days} يوم</AlertDescription></Alert>}
                 {days < 0 && <Alert variant="destructive"><AlertDescription>تاريخ النهاية يجب أن يكون بعد تاريخ البداية.</AlertDescription></Alert>}
                <div className="grid gap-2">
                    <Label htmlFor="notes">ملاحظات</Label>
                    <Textarea id="notes" placeholder={leaveType === 'Emergency' ? 'سبب الإجازة الطارئة (إلزامي)' : 'أدخل ملاحظاتك هنا...'} value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                {leaveType === 'Sick' && (
                    <div className="grid gap-2">
                        <Label htmlFor="file-upload">تقرير طبي (إلزامي)</Label>
                        <div className="flex items-center gap-2">
                           <Button asChild variant="outline" className="flex-1">
                             <label htmlFor="file-upload" className="cursor-pointer">
                                <Upload className="ml-2 h-4 w-4" />
                                {file ? file.name : 'اختر ملف'}
                             </label>
                           </Button>
                           <Input id="file-upload" type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                        </div>
                    </div>
                )}
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'جاري الحفظ...' : 'تقديم الطلب'}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
