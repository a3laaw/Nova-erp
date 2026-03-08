'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X, Loader2, Users, Clock, Banknote, Briefcase, User, ShieldCheck, Phone, Globe } from 'lucide-react';
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
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

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
  "هندي", "باكستاني", "فلبيني", "بنغلاديشي", "نيبالي", "إإيراني",
  "بريطاني", "أمريكي"
].sort((a,b) => a.localeCompare(b, 'ar'));

const nationalityOptions = commonNationalities.map(n => ({ value: n, label: n }));

export function EmployeeForm({ onSave, onClose, initialData = null, isSaving = false, employeeNumber = null }: EmployeeFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { branding } = useBranding();
    
    const [formData, setFormData] = useState<Partial<Employee>>({
        fullName: '',
        nameEn: '',
        civilId: '',
        mobile: '',
        hireDate: new Date(),
        department: '',
        jobTitle: '',
        shiftId: '',
        contractType: 'permanent',
        basicSalary: 0,
        housingAllowance: 0,
        transportAllowance: 0,
        salaryPaymentType: 'cash',
        bankName: '',
        accountNumber: '',
        iban: '',
        contractPercentage: 0,
        gender: 'male',
        dob: undefined,
        nationality: '',
        residencyExpiry: undefined,
        workStartTime: '08:00',
        workEndTime: '17:00',
        pieceRateMode: 'salary_with_target',
        targetDescription: 0,
        pieceRate: 0,
        dailyRate: 0,
    });

    const [showHousingAllowance, setShowHousingAllowance] = useState(false);
    const [showTransportAllowance, setShowTransportAllowance] = useState(false);
    const [isCustomHours, setIsCustomHours] = useState(false);
    
    const [departments, setDepartments] = useState<Department[]>([]);
    const [jobs, setJobs] = useState<(Job & { departmentId: string })[]>([]);
    const [refDataLoading, setRefDataLoading] = useState(true);

    const { data: shifts = [] } = useSubscription<WorkShift>(firestore, 'work_shifts', [orderBy('name')]);
    
    const isDayLaborer = formData.contractType === 'day_laborer';

    // ✨ تحديث البيانات عند فتح شاشة التعديل
    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialData,
                fullName: initialData.fullName || (initialData as any).nameAr || '',
                nameEn: initialData.nameEn || (initialData as any).nameEn || '',
                hireDate: toFirestoreDate(initialData.hireDate) || new Date(),
                dob: toFirestoreDate(initialData.dob) || undefined,
                residencyExpiry: toFirestoreDate(initialData.residencyExpiry) || undefined,
                basicSalary: Number(initialData.basicSalary || 0),
                housingAllowance: Number(initialData.housingAllowance || 0),
                transportAllowance: Number(initialData.transportAllowance || 0),
                dailyRate: Number(initialData.dailyRate || 0),
                contractPercentage: Number(initialData.contractPercentage || 0),
                // 🛡️ حماية حقل طريقة الدفع من الظهور فارغاً
                salaryPaymentType: initialData.salaryPaymentType || 'cash',
                nationality: initialData.nationality || '',
            });
            setShowHousingAllowance(Number(initialData.housingAllowance) > 0);
            setShowTransportAllowance(Number(initialData.transportAllowance) > 0);
            setIsCustomHours(!!initialData.workStartTime && !initialData.shiftId);
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
        let finalVal: any = value;
        if (['basicSalary', 'housingAllowance', 'transportAllowance', 'dailyRate', 'contractPercentage'].includes(id)) {
            finalVal = parseFloat(value) || 0;
        }
        setFormData(prev => ({ ...prev, [id]: finalVal }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.fullName || !formData.mobile || !formData.nationality) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء تعبئة الاسم والجوال والجنسية.' });
            return;
        }
        await onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="py-4 px-1 space-y-8 max-h-[75vh] overflow-y-auto scrollbar-none">
                
                {/* 1. المعلومات الأساسية والشخصية */}
                <section className="space-y-6 p-6 border rounded-[2rem] bg-card shadow-sm">
                    <h3 className="font-black text-lg flex items-center gap-2"><User className="h-5 w-5 text-primary"/> المعلومات الشخصية والأساسية</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">الاسم الكامل بالعربية *</Label>
                            <Input id="fullName" value={formData.fullName || ''} onChange={handleInputChange} required className="h-11 rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">الاسم بالإنجليزية</Label>
                            <Input id="nameEn" value={formData.nameEn || ''} onChange={handleInputChange} dir="ltr" className="h-11 rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">رقم الجوال *</Label>
                            <div className="relative">
                                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input id="mobile" value={formData.mobile || ''} onChange={handleInputChange} dir="ltr" required className="pr-10 h-11 rounded-xl" />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">الرقم المدني</Label>
                            <Input id="civilId" value={formData.civilId || ''} onChange={handleInputChange} dir="ltr" maxLength={12} className="h-11 rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">الجنسية *</Label>
                            <InlineSearchList 
                                value={formData.nationality || ''} 
                                onSelect={v => setFormData(p => ({...p, nationality: v}))} 
                                options={nationalityOptions} 
                                placeholder="اختر الجنسية..." 
                                className="h-11" 
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">تاريخ الميلاد</Label>
                            <DateInput value={formData.dob} onChange={d => setFormData(p => ({...p, dob: d}))} />
                        </div>
                    </div>
                </section>

                {/* 2. بيانات الإقامة والوثائق (تظهر فقط لغير الكويتيين) */}
                {formData.nationality && formData.nationality !== 'كويتي' && (
                    <section className="space-y-6 p-6 border rounded-[2rem] bg-orange-50/10 border-orange-100 shadow-sm animate-in fade-in zoom-in-95">
                        <h3 className="font-black text-lg flex items-center gap-2 text-orange-800"><ShieldCheck className="h-5 w-5" /> الوثائق وتاريخ الإقامة</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="grid gap-2">
                                <Label className="font-bold mr-1">تاريخ انتهاء الإقامة</Label>
                                <DateInput value={formData.residencyExpiry} onChange={d => setFormData(p => ({...p, residencyExpiry: d}))} />
                            </div>
                        </div>
                    </section>
                )}

                {/* 3. المعلومات الوظيفية والدوام */}
                <section className="space-y-6 p-6 border rounded-[2rem] bg-muted/10">
                    <h3 className="font-black text-lg flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary"/> التعيين والدوام</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">القسم *</Label>
                            <InlineSearchList value={formData.department || ''} onSelect={v => setFormData(p => ({...p, department: v, jobTitle: ''}))} options={departments.map(d => ({value: d.name, label: d.name}))} placeholder="اختر القسم..." className="h-11" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">المسمى الوظيفي *</Label>
                            <InlineSearchList value={formData.jobTitle || ''} onSelect={v => setFormData(p => ({...p, jobTitle: v}))} options={jobs.filter(j => j.departmentId === departments.find(d => d.name === formData.department)?.id).map(j => ({value: j.name, label: j.name}))} placeholder="اختر المسمى..." disabled={!formData.department} className="h-11" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">نوع التعاقد *</Label>
                            <Select value={formData.contractType} onValueChange={(v: any) => setFormData(p => ({...p, contractType: v}))}>
                                <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="permanent">دائم</SelectItem>
                                    <SelectItem value="temporary">مؤقت</SelectItem>
                                    <SelectItem value="day_laborer">عامل باليومية</SelectItem>
                                    <SelectItem value="percentage">نسبة من العقود</SelectItem>
                                    <SelectItem value="special">دوام خاص</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">تاريخ المباشرة</Label>
                            <DateInput value={formData.hireDate} onChange={d => setFormData(p => ({...p, hireDate: d}))} />
                        </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">الوردية (Shift)</Label>
                            <Select value={formData.shiftId} onValueChange={handleShiftSelect}>
                                <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue placeholder="اختر الوردية..." /></SelectTrigger>
                                <SelectContent dir="rtl">{shifts.map(s => <SelectItem key={s.id} value={s.id!}>{s.name} ({s.startTime}-{s.endTime})</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-white rounded-xl border mb-0.5">
                            <Checkbox id="custom-h" checked={isCustomHours} onCheckedChange={c => setIsCustomHours(!!c)} />
                            <Label htmlFor="custom-h" className="cursor-pointer font-bold text-xs">تخصيص ساعات دوام للموظف</Label>
                        </div>
                    </div>
                    {isCustomHours && (
                        <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                            <div className="grid gap-1.5"><Label className="text-[10px] uppercase font-bold mr-1">بداية الدوام</Label><Input type="time" value={formData.workStartTime} onChange={e => setFormData(p => ({...p, workStartTime: e.target.value}))} className="h-10 rounded-lg bg-white" /></div>
                            <div className="grid gap-1.5"><Label className="text-[10px] uppercase font-bold mr-1">نهاية الدوام</Label><Input type="time" value={formData.workEndTime} onChange={e => setFormData(p => ({...p, workEndTime: e.target.value}))} className="h-10 rounded-lg bg-white" /></div>
                        </div>
                    )}
                </section>

                {/* 4. المعلومات المالية والرواتب */}
                <section className="space-y-6 p-6 border rounded-[2.5rem] bg-emerald-50/20 border-emerald-100 shadow-sm">
                    <h3 className="font-black text-lg flex items-center gap-2 text-emerald-800"><Banknote className="h-5 w-5" /> المعلومات المالية والرواتب</h3>
                    
                    {isDayLaborer ? (
                        <div className="grid gap-2 max-w-xs animate-in zoom-in-95">
                            <Label className="font-black text-emerald-900">أجرة اليومية (د.ك) *</Label>
                            <Input id="dailyRate" type="number" step="0.001" value={formData.dailyRate} onChange={handleInputChange} className="h-12 text-2xl font-black text-center font-mono border-2 border-emerald-200 bg-white rounded-2xl" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="grid gap-2">
                                    <Label className="font-bold text-emerald-900">الراتب الأساسي (د.ك) *</Label>
                                    <Input id="basicSalary" type="number" step="0.001" value={formData.basicSalary} onChange={handleInputChange} className="h-11 font-mono font-bold bg-white" />
                                </div>
                                <div className="grid gap-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Checkbox id="h-allow" checked={showHousingAllowance} onCheckedChange={c => setShowHousingAllowance(!!c)} />
                                        <Label htmlFor="h-allow" className="text-xs font-bold cursor-pointer">إضافة بدل سكن</Label>
                                    </div>
                                    <Input id="housingAllowance" type="number" step="0.001" value={formData.housingAllowance} onChange={handleInputChange} disabled={!showHousingAllowance} className="h-11 font-mono bg-white" />
                                </div>
                                <div className="grid gap-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Checkbox id="t-allow" checked={showTransportAllowance} onCheckedChange={c => setShowTransportAllowance(!!c)} />
                                        <Label htmlFor="t-allow" className="text-xs font-bold cursor-pointer">إضافة بدل مواصلات</Label>
                                    </div>
                                    <Input id="transportAllowance" type="number" step="0.001" value={formData.transportAllowance} onChange={handleInputChange} disabled={!showTransportAllowance} className="h-11 font-mono bg-white" />
                                </div>
                            </div>
                            {formData.contractType === 'percentage' && (
                                <div className="grid gap-2 max-w-xs animate-in slide-in-from-right-2">
                                    <Label className="font-bold text-emerald-900">نسبة العمولات من العقود (%)</Label>
                                    <Input id="contractPercentage" type="number" step="0.1" value={formData.contractPercentage} onChange={handleInputChange} className="h-11 font-mono font-black text-center bg-white" />
                                </div>
                            )}
                        </div>
                    )}

                    <Separator className="bg-emerald-100" />

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                        <div className="grid gap-2">
                            <Label className="font-bold text-xs text-muted-foreground mr-1">طريقة دفع الراتب</Label>
                            <Select value={formData.salaryPaymentType} onValueChange={v => setFormData(p => ({...p, salaryPaymentType: v as any}))}>
                                <SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue placeholder="اختر الطريقة..." /></SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="cash">نقداً (كاش)</SelectItem>
                                    <SelectItem value="transfer">تحويل بنكي</SelectItem>
                                    <SelectItem value="cheque">شيك</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {formData.salaryPaymentType === 'transfer' && (
                            <>
                                <div className="grid gap-2"><Label className="font-bold text-xs mr-1">اسم البنك</Label><Input id="bankName" value={formData.bankName} onChange={handleInputChange} className="h-10 bg-white" /></div>
                                <div className="grid gap-2"><Label className="font-bold text-xs mr-1">رقم الحساب</Label><Input id="accountNumber" value={formData.accountNumber} onChange={handleInputChange} dir="ltr" className="h-10 bg-white font-mono" /></div>
                                <div className="grid gap-2"><Label className="font-bold text-xs mr-1">IBAN</Label><Input id="iban" value={formData.iban} onChange={handleInputChange} dir="ltr" className="h-10 bg-white font-mono" /></div>
                            </>
                        )}
                    </div>
                </section>
            </div>

            <DialogFooter className="mt-6 pt-6 border-t bg-muted/10 rounded-b-[2rem] p-6">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
                <Button type="submit" disabled={isSaving} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/20 gap-2">
                    {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                    حفظ الملف الوظيفي
                </Button>
            </DialogFooter>
        </form>
    );
}