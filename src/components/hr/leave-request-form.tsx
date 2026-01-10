'use client';

import { useState, useEffect } from 'react';
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
import { useFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import type { Employee } from '@/lib/types';


interface LeaveRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (request: any) => void;
}

type LeaveType = 'سنوية' | 'مرضية' | 'طارئة';

export function LeaveRequestForm({ isOpen, onClose, onSave }: LeaveRequestFormProps) {
    const { firestore } = useFirebase();
    const [employees, setEmployees] = useState<Employee[]>([]);
    
    const employeesCollection = firestore ? collection(firestore, 'employees') : null;
    const employeesQuery = employeesCollection ? query(employeesCollection, where('status', '==', 'active'), orderBy('fullName')) : null;

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Add validation logic here
        onSave({ employeeId, leaveType, startDate, endDate, notes });
        onClose();
    }
    
    const days = startDate && endDate ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)) + 1 : 0;

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
                    <Label htmlFor="employee">الموظف</Label>
                    <Select dir="rtl" value={employeeId} onValueChange={setEmployeeId}>
                        <SelectTrigger id="employee" disabled={loading}>
                            <SelectValue placeholder={loading ? "تحميل..." : "اختر الموظف..."} />
                        </SelectTrigger>
                        <SelectContent>
                            {employees.map(emp => (
                                <SelectItem key={emp.id} value={emp.id!}>{emp.fullName}</SelectItem>
                            ))}
                            {error && <p className='text-xs text-destructive p-2'>فشل جلب الموظفين</p>}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="leaveType">نوع الإجازة</Label>
                    <Select dir="rtl" value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
                        <SelectTrigger id="leaveType">
                            <SelectValue placeholder="اختر نوع الإجازة..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="سنوية">سنوية</SelectItem>
                            <SelectItem value="مرضية">مرضية</SelectItem>
                            <SelectItem value="طارئة">طارئة</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="startDate">من تاريخ</Label>
                        <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="endDate">إلى تاريخ</Label>
                        <Input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                </div>
                 {days > 0 && <Alert variant="default" className='bg-muted/50'><AlertDescription>مجموع الأيام: {days} يوم</AlertDescription></Alert>}
                <div className="grid gap-2">
                    <Label htmlFor="notes">ملاحظات</Label>
                    <Textarea id="notes" placeholder={leaveType === 'طارئة' ? 'سبب الإجازة الطارئة (إلزامي)' : 'أدخل ملاحظاتك هنا...'} value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                {leaveType === 'مرضية' && (
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
                <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
                <Button type="submit">تقديم الطلب</Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
