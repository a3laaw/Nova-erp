
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X, Loader2, Users, Clock } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import type { Employee, Department, Job, WorkShift } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DateInput } from '../ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';
import { Checkbox } from '../ui/checkbox';
import { useBranding } from '@/context/branding-context';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { subYears, startOfToday, addYears } from 'date-fns';

interface EmployeeFormProps {
    onSave: (data: Partial<Employee>) => Promise<void>;
    onClose: () => void;
    initialData?: Partial<Employee> | null;
    isSaving?: boolean;
    employeeNumber?: string | null;
}

const commonNationalities = [
  "كويتي", "سعودي", "إماراتي", "بحريني", "قطري", "عماني",
  "مصري", "سوري", "لبناني", "أردني", "فلسطيني", "يمني",
  "هندي", "باكستاني", "فلبيني", "بنغلاديشي", "نيبالي", "إيراني",
  "بريطاني", "أمريكي"
].sort((a,b) => a.localeCompare(b, 'ar'));

const nationalityOptions = commonNationalities.map(n => ({ value: n, label: n }));

const getDeptPrefix = (deptName: string) => {
    if (!deptName) return 'G';
    const name = deptName.toLowerCase();
    if (name.includes('كهرباء')) return 'E';
    if (name.includes('صحي') || name.includes('ميكانيك')) return 'M';
    if (name.includes('إنشائي') || name.includes('هيكل') || name.includes('بناء')) return 'C';
    if (name.includes('معماري')) return 'A';
    if (name.includes('خارجية')) return 'L';
    return 'G';
};

export function EmployeeForm({ onSave, onClose, initialData = null, isSaving = false, employeeNumber = null }: EmployeeFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { branding } = useBranding();
    
    const [formData, setFormData] = useState<Partial<Employee>>({
        fullName: '', nameEn: '', civilId: '', mobile: '',
        hireDate: new Date(), department: '', jobTitle: '',
        workTeam: '', shiftId: '',
        contractType: 'permanent' as Employee['contractType'], basicSalary: 0,
        housingAllowance: 0, transportAllowance: 0,
        salaryPaymentType: 'cash' as Employee['salaryPaymentType'],
        bankName: '', accountNumber: '', iban: '',
        contractPercentage: 0, gender: 'male' as Employee['gender'],
        dob: undefined, nationality: '', residencyExpiry: undefined,
        workStartTime: '08:00', workEndTime: '17:00',
        pieceRateMode: 'salary_with_target' as 'salary_with_target' | 'per_piece',
        targetDescription: 0, pieceRate: 0, dailyRate: 0,
    });

    const [showHousingAllowance, setShowHousingAllowance] = useState(false);
    const [showTransportAllowance, setShowTransportAllowance] = useState(false);
    const [isCustomHours, setIsCustomHours] = useState(false);
    
    const [departments, setDepartments] = useState<Department[]>([]);
    const [jobs, setJobs] = useState<(Job & { departmentId: string })[]>([]);
    const [refDataLoading, setRefDataLoading] = useState(true);

    const { data: shifts = [] } = useSubscription<WorkShift>(firestore, 'work_shifts', [orderBy('name')]);
    
    const isDayLaborer = formData.contractType === 'day_laborer';
    const isSimpleLayout = isDayLaborer;

    const showTeamSelection = useMemo(() => {
        return formData.jobTitle === 'عامل' || formData.contractType === 'day_laborer';
    }, [formData.jobTitle, formData.contractType]);

    useEffect(() => {
        if (initialData) {
            const data = {
                ...formData,
                fullName: initialData.fullName || (initialData as any).nameAr || '',
                nameEn: initialData.nameEn || (initialData as any).nameEn || '',
                civilId: initialData.civilId || '',
                mobile: initialData.mobile || '',
                hireDate: toFirestoreDate(initialData.hireDate) || new Date(),
                department: initialData.department || '',
                jobTitle: initialData.jobTitle || '',
                workTeam: (initialData as any).workTeam || '',
                shiftId: initialData.shiftId || '',
                contractType: initialData.contractType || 'permanent',
                basicSalary: Number(initialData.basicSalary ?? 0),
                housingAllowance: Number(initialData.housingAllowance ?? 0),
                transportAllowance: Number(initialData.transportAllowance ?? 0),
                salaryPaymentType: initialData.salaryPaymentType || 'cash',
                bankName: initialData.bankName || '',
                accountNumber: initialData.accountNumber || '',
                iban: initialData.iban || '',
                contractPercentage: Number(initialData.contractPercentage ?? 0),
                gender: initialData.gender || 'male',
                dob: toFirestoreDate(initialData.dob) || undefined,
                nationality: initialData.nationality || '',
                residencyExpiry: toFirestoreDate(initialData.residencyExpiry) || undefined,
                workStartTime: initialData.workStartTime || '08:00',
                workEndTime: initialData.workEndTime || '17:00',
                pieceRateMode: initialData.pieceRateMode || 'salary_with_target',
                targetDescription: Number(initialData.targetDescription ?? 0),
                pieceRate: Number(initialData.pieceRate ?? 0),
                dailyRate: Number(initialData.dailyRate ?? 0),
            };
            setFormData(data);
            setShowHousingAllowance(Number(data.housingAllowance) > 0);
            setShowTransportAllowance(Number(data.transportAllowance) > 0);
            setIsCustomHours(!!initialData.workStartTime);
        }
    }, [initialData]);

    useEffect(() => {
        if (!firestore) return;
        const fetchReferenceData = async () => {
            setRefDataLoading(true);
            try {
                const deptsQuery = query(collection(firestore, 'departments'), orderBy('order'));
                const jobsQuery = query(collectionGroup(firestore, 'jobs'));
                const [deptsSnapshot, jobsSnapshot] = await Promise.all([getDocs(deptsQuery), getDocs(jobsQuery)]);
                setDepartments(deptsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
                setJobs(jobsSnapshot.docs.map(doc => ({ id: doc.id, departmentId: doc.ref.parent.parent!.id, ...doc.data() } as Job & { departmentId: string })));
            } finally { setRefDataLoading(false); }
        };
        fetchReferenceData();
    }, [firestore]);

    const handleShiftSelect = (sId: string) => {
        const shift = shifts.find(s => s.id === sId);
        if (shift) {
            setFormData(prev => ({ ...prev, shiftId: sId, workStartTime: shift.startTime, workEndTime: shift.endTime }));
            setIsCustomHours(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        let sanitizedValue: any = value;
        if (id === 'mobile') sanitizedValue = value.replace(/\D/g, '').slice(0, 8);
        else if (id === 'civilId') sanitizedValue = value.replace(/\D/g, '').slice(0, 12);
        setFormData(prev => ({ ...prev, [id]: sanitizedValue }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.fullName || !formData.mobile) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تعبئة الاسم والجوال.' });
            return;
        }
        await onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-6 py-4 px-1 max-h-[70vh] overflow-y-auto">
                <section className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg">المعلومات الأساسية</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-1.5"><Label>الاسم الكامل *</Label><Input id="fullName" value={formData.fullName ?? ''} onChange={handleInputChange} required /></div>
                        <div className="grid gap-1.5"><Label>رقم الجوال *</Label><Input id="mobile" value={formData.mobile ?? ''} onChange={handleInputChange} dir="ltr" maxLength={8} required /></div>
                    </div>
                </section>

                <section className="space-y-4 p-4 border rounded-lg bg-blue-50/20 border-blue-100">
                    <h3 className="font-black text-primary flex items-center gap-2"><Clock className="h-5 w-5" /> إعدادات الدوام والوردية</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label>اختيار وردية الدوام (Shift)</Label>
                            <Select value={formData.shiftId} onValueChange={handleShiftSelect}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="اختر من القائمة..." /></SelectTrigger>
                                <SelectContent dir="rtl">{shifts.map(s => <SelectItem key={s.id} value={s.id!}>{s.name} ({s.startTime} - {s.endTime})</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                            <Checkbox id="custom-hours" checked={isCustomHours} onCheckedChange={(c) => setIsCustomHours(!!c)} />
                            <Label htmlFor="custom-hours" className="cursor-pointer font-bold">تخصيص أوقات دوام استثنائية للموظف</Label>
                        </div>
                    </div>
                    {isCustomHours && (
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blue-100 animate-in slide-in-from-top-2">
                            <div className="grid gap-2"><Label>يبدأ الدوام الساعة</Label><Input type="time" value={formData.workStartTime} onChange={e => setFormData(p => ({...p, workStartTime: e.target.value}))} className="bg-white" /></div>
                            <div className="grid gap-2"><Label>ينتهي الدوام الساعة</Label><Input type="time" value={formData.workEndTime} onChange={e => setFormData(p => ({...p, workEndTime: e.target.value}))} className="bg-white" /></div>
                        </div>
                    )}
                </section>

                <section className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg">المعلومات الوظيفية</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-1.5">
                            <Label>القسم *</Label>
                            <InlineSearchList value={formData.department ?? ''} onSelect={(v) => setFormData(p => ({...p, department: v}))} options={departments.map(d => ({value: d.name, label: d.name}))} placeholder="اختر قسمًا..." />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>المسمى الوظيفي *</Label>
                            <InlineSearchList value={formData.jobTitle ?? ''} onSelect={(v) => setFormData(p => ({...p, jobTitle: v}))} options={jobs.filter(j => j.departmentId === departments.find(d => d.name === formData.department)?.id).map(j => ({value: j.name, label: j.name}))} placeholder="اختر مسمى..." disabled={!formData.department} />
                        </div>
                    </div>
                </section>
            </div>
            <DialogFooter className="mt-6 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                <Button type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin ml-2 h-4 w-4" /> : <Save className="ml-2 h-4 w-4" />} حفظ</Button>
            </DialogFooter>
        </form>
    );
}
