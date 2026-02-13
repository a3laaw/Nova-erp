
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X, Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import type { Employee, Department, Job } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DateInput } from '../ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';
import { Checkbox } from '../ui/checkbox';
import { useBranding } from '@/context/branding-context';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Textarea } from '../ui/textarea';

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


export function EmployeeForm({ onSave, onClose, initialData = null, isSaving = false, employeeNumber = null }: EmployeeFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { branding } = useBranding();
    
    const [formData, setFormData] = useState({
        fullName: '', nameEn: '', civilId: '', mobile: '',
        hireDate: new Date(), department: '', jobTitle: '',
        contractType: 'permanent' as Employee['contractType'], basicSalary: '',
        housingAllowance: '', transportAllowance: '',
        salaryPaymentType: 'cash' as Employee['salaryPaymentType'],
        bankName: '',
        accountNumber: '',
        iban: '',
        contractPercentage: '',
        gender: 'male' as Employee['gender'],
        dob: undefined as Date | undefined,
        nationality: '',
        residencyExpiry: undefined as Date | undefined,
        workStartTime: '08:00',
        workEndTime: '17:00',
        pieceRateMode: 'salary_with_target' as 'salary_with_target' | 'per_piece',
        targetDescription: '',
        pieceRate: '',
        dailyRate: '',
    });

    const [showHousingAllowance, setShowHousingAllowance] = useState(false);
    const [showTransportAllowance, setShowTransportAllowance] = useState(false);
    
    const [departments, setDepartments] = useState<Department[]>([]);
    const [jobs, setJobs] = useState<(Job & { departmentId: string })[]>([]);
    const [refDataLoading, setRefDataLoading] = useState(true);
    
    const isDayLaborer = formData.contractType === 'day_laborer';
    const isSimpleLayout = isDayLaborer;

    const showStandardSalary = useMemo(() => {
        if (formData.contractType === 'percentage' || 
            formData.contractType === 'day_laborer') {
            return false;
        }
        if (formData.contractType === 'piece-rate' && formData.pieceRateMode === 'per_piece') {
            return false;
        }
        return true;
    }, [formData.contractType, formData.pieceRateMode]);

    useEffect(() => {
        const generalHours = branding?.work_hours?.general;
        const defaultStartTime = generalHours?.morning_start_time || '08:00';
        const defaultEndTime = generalHours?.evening_end_time || '17:00';

        if (initialData) {
            setFormData({
                fullName: initialData.fullName || '',
                nameEn: initialData.nameEn || '',
                civilId: initialData.civilId || '',
                mobile: initialData.mobile || '',
                hireDate: toFirestoreDate(initialData.hireDate) || new Date(),
                department: initialData.department || '',
                jobTitle: initialData.jobTitle || '',
                contractType: initialData.contractType || 'permanent',
                basicSalary: String(initialData.basicSalary || ''),
                housingAllowance: String(initialData.housingAllowance || ''),
                transportAllowance: String(initialData.transportAllowance || ''),
                salaryPaymentType: initialData.salaryPaymentType || 'cash',
                bankName: initialData.bankName || '',
                accountNumber: initialData.accountNumber || '',
                iban: initialData.iban || '',
                contractPercentage: String(initialData.contractPercentage || ''),
                gender: initialData.gender || 'male',
                dob: toFirestoreDate(initialData.dob) || undefined,
                nationality: initialData.nationality || '',
                residencyExpiry: toFirestoreDate(initialData.residencyExpiry) || undefined,
                workStartTime: initialData.workStartTime || defaultStartTime,
                workEndTime: initialData.workEndTime || defaultEndTime,
                pieceRateMode: initialData.pieceRateMode || 'salary_with_target',
                targetDescription: String(initialData.targetDescription || ''),
                pieceRate: String(initialData.pieceRate || ''),
                dailyRate: String(initialData.dailyRate || ''),
            });
            setShowHousingAllowance(!!initialData.housingAllowance && initialData.housingAllowance > 0);
            setShowTransportAllowance(!!initialData.transportAllowance && initialData.transportAllowance > 0);
        } else {
             setFormData(prev => ({
                ...prev,
                fullName: initialData?.fullName || '',
                mobile: initialData?.mobile || '',
                workStartTime: defaultStartTime,
                workEndTime: defaultEndTime,
             }));
            setShowHousingAllowance(false);
            setShowTransportAllowance(false);
        }
    }, [initialData, branding]);

    useEffect(() => {
        const noSalaryContractTypes = ['percentage', 'day_laborer'];
        const workTimeShouldBeHidden = ['permanent', 'percentage', 'piece-rate', 'day_laborer'].includes(formData.contractType);

        if (noSalaryContractTypes.includes(formData.contractType) || (formData.contractType === 'piece-rate' && formData.pieceRateMode === 'per_piece')) {
            setFormData(prev => ({
                ...prev,
                basicSalary: '0',
                housingAllowance: '0',
                transportAllowance: '0',
            }));
            setShowHousingAllowance(false);
            setShowTransportAllowance(false);
        }
        
        if (workTimeShouldBeHidden && branding?.work_hours?.general) {
             setFormData(prev => ({
                ...prev,
                workStartTime: branding.work_hours.general.morning_start_time || '08:00',
                workEndTime: branding.work_hours.general.evening_end_time || '17:00',
            }));
        }
    }, [formData.contractType, formData.pieceRateMode, branding]);


    useEffect(() => {
        if (!firestore) return;
        const fetchReferenceData = async () => {
            setRefDataLoading(true);
            try {
                const deptsQuery = query(collection(firestore, 'departments'));
                const jobsQuery = query(collectionGroup(firestore, 'jobs'));
                
                const [deptsSnapshot, jobsSnapshot] = await Promise.all([getDocs(deptsQuery), getDocs(jobsQuery)]);

                const fetchedDepartments = deptsSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Department))
                    .filter(dept => dept && typeof dept.name === 'string' && dept.name.trim() !== '');

                fetchedDepartments.sort((a,b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name, 'ar'));
                setDepartments(fetchedDepartments);

                const fetchedJobs = jobsSnapshot.docs.map(doc => {
                    const departmentId = doc.ref.parent.parent!.id;
                    return { id: doc.id, departmentId, ...doc.data() } as Job & { departmentId: string };
                }).filter(job => job && job.name);
                
                setJobs(fetchedJobs);

            } catch (error) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات المرجعية.' });
            } finally {
                setRefDataLoading(false);
            }
        };

        fetchReferenceData();
    }, [firestore, toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        let sanitizedValue = value;
        if (id === 'fullName') {
            sanitizedValue = value.replace(/[^ \u0600-\u06FF]/g, ''); 
        } else if (id === 'nameEn') {
            sanitizedValue = value.replace(/[^ a-zA-Z]/g, '');
        }
        setFormData(prev => ({ ...prev, [id]: sanitizedValue }));
    };
    
    const handleSelectChange = (id: keyof typeof formData, value: any) => {
        const newFormData = { ...formData, [id]: value };
        if (id === 'department') {
            newFormData.jobTitle = ''; // Reset job title when department changes
        }
        setFormData(newFormData);
    };
    
    const departmentOptions = useMemo(() => departments.map(d => ({ value: d.name, label: d.name })), [departments]);

    const filteredJobOptions = useMemo(() => {
        if (!formData.department) return [];
        const selectedDept = departments.find(d => d.name === formData.department);
        if (!selectedDept) return [];
        
        return jobs
            .filter(j => j.departmentId === selectedDept.id)
            .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
            .map(j => ({ value: j.name, label: j.name }));
    }, [formData.department, departments, jobs]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.fullName || !formData.mobile) {
            toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'الرجاء تعبئة اسم الموظف بالعربية ورقم الجوال.' });
            return;
        }
        if (!initialData && !isSimpleLayout && !formData.department) {
             toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'الرجاء اختيار قسم للموظف.' });
            return;
        }
        
        const dataToSave: Partial<Employee> = {
            fullName: formData.fullName,
            mobile: formData.mobile,
            contractType: formData.contractType,
        };

        if (isSimpleLayout) {
            dataToSave.department = 'عمالة خارجية';
            dataToSave.jobTitle = 'عامل يومية';
            dataToSave.civilId = formData.civilId || '000000000000';
            dataToSave.hireDate = new Date();
            dataToSave.basicSalary = 0;

            if (isDayLaborer) {
                if (!formData.dailyRate || parseFloat(formData.dailyRate) <= 0) {
                    toast({ variant: 'destructive', title: 'حقل مطلوب', description: 'يجب إدخال اليومية وتكون أكبر من صفر.' });
                    return;
                }
                dataToSave.dailyRate = parseFloat(formData.dailyRate);
            }
        } else {
            // Logic for regular employees
            if (!formData.civilId || !formData.hireDate || !formData.department || !formData.jobTitle) {
                toast({ variant: 'destructive', title: 'حقول مطلوبة', description: 'الرجاء تعبئة جميع الحقول الإلزامية (*).' });
                return;
            }
            const isSalaryRequired = formData.contractType !== 'percentage' && (formData.contractType !== 'piece-rate' || formData.pieceRateMode === 'salary_with_target');
            if (isSalaryRequired && !formData.basicSalary) {
                 toast({ variant: 'destructive', title: 'حقول مطلوبة', description: 'الرجاء إدخال الراتب الأساسي.' });
                return;
            }
            
            Object.assign(dataToSave, {
                nameEn: formData.nameEn,
                civilId: formData.civilId,
                hireDate: formData.hireDate,
                department: formData.department,
                jobTitle: formData.jobTitle,
                salaryPaymentType: formData.salaryPaymentType,
                bankName: formData.salaryPaymentType === 'transfer' ? formData.bankName : '',
                accountNumber: formData.salaryPaymentType === 'transfer' ? formData.accountNumber : '',
                iban: formData.salaryPaymentType === 'transfer' ? formData.iban : '',
                gender: formData.gender,
                dob: formData.dob,
                nationality: formData.nationality,
                workStartTime: formData.workStartTime,
                workEndTime: formData.workEndTime,
            });

            if (formData.contractType === 'piece-rate') {
                dataToSave.pieceRateMode = formData.pieceRateMode;
                if (formData.pieceRateMode === 'salary_with_target') {
                    dataToSave.basicSalary = parseFloat(formData.basicSalary) || 0;
                    dataToSave.targetDescription = parseFloat(formData.targetDescription) || 0;
                    dataToSave.pieceRate = 0;
                } else { // per_piece
                    dataToSave.basicSalary = 0; dataToSave.housingAllowance = 0; dataToSave.transportAllowance = 0;
                    dataToSave.targetDescription = 0;
                    dataToSave.pieceRate = parseFloat(formData.pieceRate) || 0;
                }
            } else {
                 dataToSave.basicSalary = parseFloat(formData.basicSalary) || 0;
                 dataToSave.housingAllowance = showHousingAllowance ? (parseFloat(formData.housingAllowance) || 0) : 0;
                 dataToSave.transportAllowance = showTransportAllowance ? (parseFloat(formData.transportAllowance) || 0) : 0;
            }

            if (formData.nationality && formData.nationality.trim() !== 'كويتي' && formData.residencyExpiry) {
                dataToSave.residencyExpiry = formData.residencyExpiry;
            }
            if (['percentage', 'special'].includes(formData.contractType)) {
                dataToSave.contractPercentage = parseFloat(formData.contractPercentage) || 0;
            }
        }
        
        await onSave(dataToSave);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-8 py-4 px-1 max-h-[70vh] overflow-y-auto">
                <section>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="fullName">الاسم الكامل <span className="text-destructive">*</span></Label>
                            <Input id="fullName" value={formData.fullName} onChange={handleInputChange} required />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="mobile">رقم الجوال <span className="text-destructive">*</span></Label>
                            <Input id="mobile" value={formData.mobile} onChange={handleInputChange} dir="ltr" required />
                        </div>
                    </div>
                </section>
                
                <section>
                     <div className="grid gap-1.5 max-w-sm">
                        <Label htmlFor="contractType">نوع العقد <span className="text-destructive">*</span></Label>
                        <Select value={formData.contractType || ''} onValueChange={(v) => handleSelectChange('contractType', v as Employee['contractType'])} dir="rtl">
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="permanent">دائم</SelectItem>
                                <SelectItem value="temporary">مؤقت</SelectItem>
                                <SelectItem value="piece-rate">بالقطعة / بالإنجاز</SelectItem>
                                <SelectItem value="percentage">نسبة من العقود</SelectItem>
                                <SelectItem value="part-time">دوام جزئي</SelectItem>
                                <SelectItem value="special">دوام خاص</SelectItem>
                                <SelectItem value="day_laborer">عامل باليومية</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </section>

                {isDayLaborer && (
                    <section>
                         <div className="grid gap-1.5 max-w-sm">
                            <Label htmlFor="dailyRate">اليومية (د.ك) <span className="text-destructive">*</span></Label>
                            <Input id="dailyRate" type="number" step="0.001" value={formData.dailyRate} onChange={handleInputChange} dir="ltr" required />
                        </div>
                    </section>
                )}
                
                {!isSimpleLayout && (
                    <>
                        <Separator />
                        {/* Section 1: Personal Information */}
                        <section className="space-y-4">
                            <h3 className="font-semibold text-lg border-b pb-2">المعلومات الشخصية</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="grid gap-1.5 md:col-span-2">
                                    <Label htmlFor="nameEn">الاسم (بالإنجليزية)</Label>
                                    <Input id="nameEn" dir="ltr" value={formData.nameEn} onChange={handleInputChange} />
                                </div>
                                <div className="grid gap-1.5 md:col-span-2">
                                    <Label htmlFor="civilId">الرقم المدني <span className="text-destructive">*</span></Label>
                                    <Input id="civilId" value={formData.civilId} onChange={handleInputChange} dir="ltr" required />
                                </div>
                                
                                <div className="grid gap-1.5">
                                    <Label htmlFor="dob">تاريخ الميلاد</Label>
                                    <DateInput value={formData.dob} onChange={(date) => handleSelectChange('dob', date)} />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="gender">الجنس</Label>
                                    <Select value={formData.gender} onValueChange={(v) => handleSelectChange('gender', v as Employee['gender'])} dir="rtl">
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="male">ذكر</SelectItem>
                                            <SelectItem value="female">أنثى</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="nationality">الجنسية</Label>
                                    <InlineSearchList
                                        value={formData.nationality}
                                        onSelect={(value) => handleSelectChange('nationality', value)}
                                        options={nationalityOptions}
                                        placeholder="اختر الجنسية..."
                                    />
                                </div>
                                {formData.nationality && formData.nationality.trim() !== 'كويتي' && (
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="residencyExpiry">تاريخ انتهاء الإقامة</Label>
                                        <DateInput value={formData.residencyExpiry} onChange={(date) => handleSelectChange('residencyExpiry', date)} />
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Section 2: Job Information */}
                        <section className="space-y-4">
                            <h3 className="font-semibold text-lg border-b pb-2">المعلومات الوظيفية</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                 <div className="grid gap-1.5">
                                    <Label>الرقم الوظيفي</Label>
                                    <Input value={employeeNumber || ''} disabled readOnly />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="department">القسم <span className="text-destructive">*</span></Label>
                                    <InlineSearchList value={formData.department} onSelect={(v) => handleSelectChange('department', v)} options={departmentOptions} placeholder={refDataLoading ? "تحميل..." : "اختر قسمًا..."} disabled={refDataLoading} />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="jobTitle">المسمى الوظيفي <span className="text-destructive">*</span></Label>
                                    <InlineSearchList 
                                        value={formData.jobTitle} 
                                        onSelect={(v) => handleSelectChange('jobTitle', v)} 
                                        options={filteredJobOptions} 
                                        placeholder={!formData.department ? "اختر قسمًا أولاً" : refDataLoading ? "تحميل..." : "اختر مسمى وظيفي..."} 
                                        disabled={refDataLoading || !formData.department}
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="hireDate">تاريخ التعيين <span className="text-destructive">*</span></Label>
                                    <DateInput value={formData.hireDate} onChange={(date) => handleSelectChange('hireDate', date!)} />
                                </div>
                                {formData.contractType === 'special' && (
                                     <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="workStartTime">من الساعة</Label>
                                            <Input id="workStartTime" type="time" value={formData.workStartTime} onChange={handleInputChange} />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="workEndTime">إلى الساعة</Label>
                                            <Input id="workEndTime" type="time" value={formData.workEndTime} onChange={handleInputChange} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Section 3: Financial Information */}
                        <section className="space-y-4">
                            <h3 className="font-semibold text-lg border-b pb-2">المعلومات المالية</h3>
                            {formData.contractType === 'piece-rate' && (
                                <div className="p-4 border rounded-md bg-muted/50 space-y-4">
                                   <RadioGroup
                                        value={formData.pieceRateMode}
                                        onValueChange={(value: "salary_with_target" | "per_piece") => handleSelectChange('pieceRateMode', value)}
                                        className="flex items-center space-x-4 rtl:space-x-reverse"
                                    >
                                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                            <RadioGroupItem value="salary_with_target" id="r-salary" />
                                            <Label htmlFor="r-salary">راتب مع تارجت</Label>
                                        </div>
                                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                            <RadioGroupItem value="per_piece" id="r-piece" />
                                            <Label htmlFor="r-piece">بالقطعة فقط</Label>
                                        </div>
                                    </RadioGroup>
                                    
                                     {formData.pieceRateMode === 'salary_with_target' && (
                                        <div className="grid gap-1.5 max-w-sm">
                                            <Label htmlFor="targetDescription">التارجت الشهري</Label>
                                            <Input id="targetDescription" type="number" value={formData.targetDescription} onChange={handleInputChange} />
                                        </div>
                                    )}
                                     {formData.pieceRateMode === 'per_piece' && (
                                        <div className="grid gap-1.5 max-w-sm">
                                            <Label htmlFor="pieceRate">سعر القطعة (د.ك)</Label>
                                            <Input id="pieceRate" type="number" step="any" value={formData.pieceRate} onChange={handleInputChange} />
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {showStandardSalary && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start pt-2">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="basicSalary">الراتب الأساسي (د.ك) <span className="text-destructive">*</span></Label>
                                        <Input id="basicSalary" type="number" step="0.001" value={formData.basicSalary} onChange={handleInputChange} dir="ltr" required />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <div className="flex items-center gap-2 mb-2"><Checkbox id="show-housing" checked={showHousingAllowance} onCheckedChange={(c) => setShowHousingAllowance(!!c)}/><Label htmlFor="show-housing">إضافة بدل سكن</Label></div>
                                        {showHousingAllowance && <Input id="housingAllowance" type="number" step="0.001" value={formData.housingAllowance} onChange={handleInputChange} dir="ltr" />}
                                    </div>
                                    <div className="grid gap-1.5">
                                        <div className="flex items-center gap-2 mb-2"><Checkbox id="show-transport" checked={showTransportAllowance} onCheckedChange={(c) => setShowTransportAllowance(!!c)}/><Label htmlFor="show-transport">إضافة بدل مواصلات</Label></div>
                                        {showTransportAllowance && <Input id="transportAllowance" type="number" step="0.001" value={formData.transportAllowance} onChange={handleInputChange} dir="ltr" />}
                                    </div>
                                </div>
                            )}

                            {(formData.contractType === 'percentage' || formData.contractType === 'special') && (
                                <div className="grid gap-1.5 max-w-sm">
                                    <Label htmlFor="contractPercentage">نسبة العقد (%)</Label>
                                    <Input id="contractPercentage" type="number" step="0.1" value={formData.contractPercentage} onChange={handleInputChange} dir="ltr" />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="salaryPaymentType">طريقة دفع الراتب</Label>
                                    <Select value={formData.salaryPaymentType} onValueChange={(v) => handleSelectChange('salaryPaymentType', v as Employee['salaryPaymentType'])} dir="rtl">
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">كاش</SelectItem>
                                            <SelectItem value="cheque">شيك</SelectItem>
                                            <SelectItem value="transfer">تحويل بنكي</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {formData.salaryPaymentType === 'transfer' && (
                                    <>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="bankName">اسم البنك</Label>
                                            <Input id="bankName" value={formData.bankName} onChange={handleInputChange} />
                                        </div>
                                         <div className="grid gap-1.5">
                                            <Label htmlFor="accountNumber">رقم الحساب</Label>
                                            <Input id="accountNumber" value={formData.accountNumber} onChange={handleInputChange} dir="ltr"/>
                                        </div>
                                    </>
                                )}
                            </div>
                        </section>
                    </>
                )}
            </div>
            <DialogFooter className="mt-6 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                    {isSaving ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
            </DialogFooter>
        </form>
    );
}

    