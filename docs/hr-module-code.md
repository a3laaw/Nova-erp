# الكود الكامل لوحدة الموارد البشرية (HR)

هذا المستند يحتوي على الشرح الكامل والأكواد المصدرية لجميع الملفات المتعلقة بوحدة الموارد البشرية في النظام.

---

## 1. نظرة عامة على المميزات

هذا ملخص للمميزات الرئيسية في هذه الوحدة، مأخوذ من ملف الشرح `docs/hr-features.md`.

*   **ملف الموظف المتكامل:** سجل شامل لكل موظف يحتوي على جميع بياناته الشخصية، الوظيفية، والمالية.
*   **إدارة إنهاء الخدمة وسجل التدقيق:** يمكنك إنهاء خدمة موظف مع تحديد السبب، ويقوم النظام بتسجيل جميع التغييرات التي تطرأ على ملف الموظف في سجل تدقيق خاص به.
*   **نظام الإجازات والاستئذانات:** نظام متكامل لتقديم ومتابعة طلبات الإجازات (سنوية، مرضية، طارئة) والاستئذانات (تأخير أو خروج مبكر) مع دورة موافقات وقيود ذكية وتحديث تلقائي لأرصدة الموظفين.
*   **الحضور والانصراف والرواتب:** وحدة متكاملة لمعالجة رواتب الموظفين، بدءًا من رفع ملف الحضور، ومعالجة البيانات بذكاء، وإنشاء كشوف الرواتب، وانتهاءً بإنشاء قيد محاسبي تلقائي عند تأكيد الدفع.
*   **حاسبة مكافأة نهاية الخدمة:** أداة دقيقة لحساب مستحقات نهاية الخدمة للموظف وفقًا لقانون العمل الكويتي.

---

## 2. الأكواد المصدرية

فيما يلي الأكواد الكاملة للملفات بالترتيب.

### صفحة إضافة موظف (`src/app/dashboard/hr/employees/new/page.tsx`)

هذه هي الصفحة التي تعرض نموذج إضافة موظف جديد.

```tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFirebase } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp, query, where, getDocs, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import type { Employee } from '@/lib/types';
import { EmployeeForm } from '@/components/hr/employee-form';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { cleanFirestoreData } from '@/lib/utils'; // IMPROVED: Import the data cleaning utility.

export default function NewEmployeePage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    const [employeeNumber, setEmployeeNumber] = useState<string | null>(null);

    useEffect(() => {
        if (!firestore) return;
        const generateEmployeeNumber = async () => {
            try {
                const counterRef = doc(firestore, 'counters', 'employees');
                const counterDoc = await getDoc(counterRef);
                let nextNumber = 101;
                if (counterDoc.exists()) {
                    nextNumber = (counterDoc.data()?.lastNumber || 100) + 1;
                }
                setEmployeeNumber(String(nextNumber));
            } catch (error) {
                console.error("Error generating employee number:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في توليد الرقم الوظيفي.' });
                setEmployeeNumber('Error');
            }
        };
        generateEmployeeNumber();
    }, [firestore, toast]);
    
    const handleSave = useCallback(async (newEmployeeData: Partial<Employee>) => {
        if (!firestore || !currentUser || !employeeNumber || employeeNumber === 'Error') {
             toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الحفظ، الرقم الوظيفي غير متاح.' });
             return;
        }
        
        setIsSaving(true);
        let newEmployeeId = '';

        try {
            // --- VALIDATION LOGIC ---
            if (newEmployeeData.mobile) {
                const mobileQuery = query(collection(firestore, 'employees'), where('mobile', '==', newEmployeeData.mobile));
                const mobileSnapshot = await getDocs(mobileQuery);
                if (!mobileSnapshot.empty) {
                    throw new Error('رقم الهاتف هذا مسجل بالفعل لموظف آخر.');
                }
            }
            if (newEmployeeData.civilId) {
                const civilIdQuery = query(collection(firestore, 'employees'), where('civilId', '==', newEmployeeData.civilId));
                const civilIdSnapshot = await getDocs(civilIdQuery);
                if (!civilIdSnapshot.empty) {
                    throw new Error('الرقم المدني هذا مسجل بالفعل لموظف آخر.');
                }
            }

            await runTransaction(firestore, async (transaction) => {
                const employeeCounterRef = doc(firestore, 'counters', 'employees');
                const employeeCounterDoc = await transaction.get(employeeCounterRef);
                
                let nextNumber = 101;
                if (employeeCounterDoc.exists()) {
                    nextNumber = (employeeCounterDoc.data()?.lastNumber || 100) + 1;
                }
                
                transaction.set(employeeCounterRef, { lastNumber: nextNumber }, { merge: true });
                
                const newEmployeeNumber = String(nextNumber);

                if (newEmployeeNumber !== employeeNumber) {
                    console.warn(`Race condition detected for employee number. UI showed ${employeeNumber}, saved as ${newEmployeeNumber}`);
                }

                const finalEmployeeData = {
                  ...newEmployeeData,
                  employeeNumber: newEmployeeNumber,
                  status: 'active' as const,
                  createdAt: serverTimestamp(),
                  lastLeaveResetDate: new Date(),
                  annualLeaveBalance: 0,
                  annualLeaveAccrued: 0,
                  annualLeaveUsed: 0,
                  carriedLeaveDays: 0,
                  sickLeaveUsed: 0,
                  emergencyLeaveUsed: 0,
                };

                const newEmployeeRef = doc(collection(firestore, 'employees'));
                newEmployeeId = newEmployeeRef.id;
                // FIXED: Use cleanFirestoreData to prevent 'undefined' values from being sent.
                transaction.set(newEmployeeRef, cleanFirestoreData(finalEmployeeData));
            });

            toast({ title: 'نجاح', description: 'تمت إضافة الموظف بنجاح.' });

            const adminHRUsersQuery = query(collection(firestore, 'users'), where('role', 'in', ['Admin', 'HR']));
            const querySnapshot = await getDocs(adminHRUsersQuery);
            
            const notificationPromises: Promise<void>[] = [];
            querySnapshot.forEach(userDoc => {
                const userId = userDoc.id;
                if (userId !== currentUser.id) {
                    const notificationPromise = createNotification(firestore, {
                        userId: userId,
                        title: 'تمت إضافة موظف جديد',
                        body: `قام ${currentUser.fullName} بإضافة الموظف الجديد "${newEmployeeData.fullName}".`,
                        link: `/dashboard/hr/employees`
                    });
                    notificationPromises.push(notificationPromise);
                }
            });

            await Promise.all(notificationPromises);
            
            router.push(`/dashboard/hr/employees`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'فشل إضافة الموظف.';
            toast({ title: "خطأ", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, currentUser, toast, router, employeeNumber]);

    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <CardHeader>
                <CardTitle>إضافة موظف جديد</CardTitle>
                <CardDescription>قم بتعبئة بيانات الموظف الجديد لإنشاء ملف له في النظام.</CardDescription>
            </CardHeader>
            <CardContent>
                <EmployeeForm
                    onSave={handleSave}
                    onClose={() => router.back()}
                    isSaving={isSaving}
                    employeeNumber={employeeNumber}
                />
            </CardContent>
        </Card>
    );
}
```

### نموذج إضافة موظف (`src/components/hr/employee-form.tsx`)

هذا هو المكون الأساسي للنموذج، ويحتوي على جميع حقول الإدخال والقوائم المنسدلة التي طلبتها.

```tsx
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
            <div className="space-y-6 py-4 px-1 max-h-[70vh] overflow-y-auto">
                <section className="space-y-4 p-4 border rounded-lg">
                     <h3 className="font-semibold text-lg">المعلومات الأساسية</h3>
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
                     <div className="grid gap-1.5 pt-4">
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
                    <section className="space-y-4 p-4 border rounded-lg bg-muted/30">
                        <h3 className="font-semibold text-lg">الأجر</h3>
                        <div className="grid gap-1.5 max-w-sm">
                            <Label htmlFor="dailyRate">اليومية (د.ك) <span className="text-destructive">*</span></Label>
                            <Input id="dailyRate" type="number" step="0.001" value={formData.dailyRate} onChange={handleInputChange} dir="ltr" required />
                        </div>
                    </section>
                )}
                
                {!isSimpleLayout && (
                    <>
                        <section className="space-y-4 p-4 border rounded-lg">
                            <h3 className="font-semibold text-lg">المعلومات الوظيفية</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                    <Label>الرقم الوظيفي</Label>
                                    <Input value={employeeNumber || ''} disabled readOnly />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="hireDate">تاريخ التعيين <span className="text-destructive">*</span></Label>
                                    <DateInput value={formData.hireDate} onChange={(date) => handleSelectChange('hireDate', date!)} />
                                </div>
                            </div>
                            {formData.contractType === 'special' && (
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-4">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="workStartTime">يبدأ الدوام الساعة</Label>
                                        <Input id="workStartTime" type="time" value={formData.workStartTime} onChange={handleInputChange} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="workEndTime">ينتهي الدوام الساعة</Label>
                                        <Input id="workEndTime" type="time" value={formData.workEndTime} onChange={handleInputChange} />
                                    </div>
                                </div>
                            )}
                        </section>
                        
                        <section className="space-y-4 p-4 border rounded-lg">
                            <h3 className="font-semibold text-lg">المعلومات المالية</h3>
                             {formData.contractType === 'piece-rate' && (
                                <div className="p-4 border rounded-md bg-muted/50 space-y-4">
                                   <RadioGroup
                                        value={formData.pieceRateMode}
                                        onValueChange={(value: "salary_with_target" | "per_piece") => handleSelectChange('pieceRateMode', value)}
                                        className="flex items-center space-x-4 rtl:space-x-reverse"
                                    >
                                        <div className="flex items-center space-x-2 rtl:space-x-reverse"><RadioGroupItem value="salary_with_target" id="r-salary" /><Label htmlFor="r-salary">راتب مع تارجت</Label></div>
                                        <div className="flex items-center space-x-2 rtl:space-x-reverse"><RadioGroupItem value="per_piece" id="r-piece" /><Label htmlFor="r-piece">بالقطعة فقط</Label></div>
                                    </RadioGroup>
                                     {formData.pieceRateMode === 'salary_with_target' && (<div className="grid gap-1.5 max-w-sm"><Label htmlFor="targetDescription">التارجت الشهري</Label><Input id="targetDescription" type="number" value={formData.targetDescription} onChange={handleInputChange} /></div>)}
                                     {formData.pieceRateMode === 'per_piece' && (<div className="grid gap-1.5 max-w-sm"><Label htmlFor="pieceRate">سعر القطعة (د.ك)</Label><Input id="pieceRate" type="number" step="any" value={formData.pieceRate} onChange={handleInputChange} /></div>)}
                                </div>
                            )}
                            {showStandardSalary && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start pt-2">
                                    <div className="grid gap-1.5"><Label htmlFor="basicSalary">الراتب الأساسي (د.ك) <span className="text-destructive">*</span></Label><Input id="basicSalary" type="number" step="0.001" value={formData.basicSalary} onChange={handleInputChange} dir="ltr" required /></div>
                                    <div className="grid gap-1.5"><div className="flex items-center gap-2 mb-2"><Checkbox id="show-housing" checked={showHousingAllowance} onCheckedChange={(c) => setShowHousingAllowance(!!c)}/><Label htmlFor="show-housing">إضافة بدل سكن</Label></div>{showHousingAllowance && <Input id="housingAllowance" type="number" step="0.001" value={formData.housingAllowance} onChange={handleInputChange} dir="ltr" />}</div>
                                    <div className="grid gap-1.5"><div className="flex items-center gap-2 mb-2"><Checkbox id="show-transport" checked={showTransportAllowance} onCheckedChange={(c) => setShowTransportAllowance(!!c)}/><Label htmlFor="show-transport">إضافة بدل مواصلات</Label></div>{showTransportAllowance && <Input id="transportAllowance" type="number" step="0.001" value={formData.transportAllowance} onChange={handleInputChange} dir="ltr" />}</div>
                                </div>
                            )}
                            {(formData.contractType === 'percentage' || formData.contractType === 'special') && (<div className="grid gap-1.5 max-w-sm"><Label htmlFor="contractPercentage">نسبة العقد (%)</Label><Input id="contractPercentage" type="number" step="0.1" value={formData.contractPercentage} onChange={handleInputChange} dir="ltr" /></div>)}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t mt-4">
                                <div className="grid gap-1.5"><Label htmlFor="salaryPaymentType">طريقة دفع الراتب</Label><Select value={formData.salaryPaymentType} onValueChange={(v) => handleSelectChange('salaryPaymentType', v as Employee['salaryPaymentType'])} dir="rtl"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">كاش</SelectItem><SelectItem value="cheque">شيك</SelectItem><SelectItem value="transfer">تحويل بنكي</SelectItem></SelectContent></Select></div>
                                {formData.salaryPaymentType === 'transfer' && (<><div className="grid gap-1.5"><Label htmlFor="bankName">اسم البنك</Label><Input id="bankName" value={formData.bankName} onChange={handleInputChange} /></div><div className="grid gap-1.5"><Label htmlFor="accountNumber">رقم الحساب</Label><Input id="accountNumber" value={formData.accountNumber} onChange={handleInputChange} dir="ltr"/></div></>)}
                            </div>
                        </section>

                        <section className="space-y-4 p-4 border rounded-lg">
                            <h3 className="font-semibold text-lg">معلومات شخصية إضافية</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="grid gap-1.5"><Label htmlFor="nameEn">الاسم (بالإنجليزية)</Label><Input id="nameEn" dir="ltr" value={formData.nameEn} onChange={handleInputChange} /></div>
                                <div className="grid gap-1.5"><Label htmlFor="civilId">الرقم المدني <span className="text-destructive">*</span></Label><Input id="civilId" value={formData.civilId} onChange={handleInputChange} dir="ltr" required /></div>
                                <div className="grid gap-1.5"><Label htmlFor="dob">تاريخ الميلاد</Label><DateInput value={formData.dob} onChange={(date) => handleSelectChange('dob', date)} /></div>
                                <div className="grid gap-1.5"><Label htmlFor="gender">الجنس</Label><Select value={formData.gender} onValueChange={(v) => handleSelectChange('gender', v as Employee['gender'])} dir="rtl"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="male">ذكر</SelectItem><SelectItem value="female">أنثى</SelectItem></SelectContent></Select></div>
                                <div className="grid gap-1.5"><Label htmlFor="nationality">الجنسية</Label><InlineSearchList value={formData.nationality} onSelect={(value) => handleSelectChange('nationality', value)} options={nationalityOptions} placeholder="اختر الجنسية..." /></div>
                                {formData.nationality && formData.nationality.trim() !== 'كويتي' && (<div className="grid gap-1.5"><Label htmlFor="residencyExpiry">تاريخ انتهاء الإقامة</Label><DateInput value={formData.residencyExpiry} onChange={(date) => handleSelectChange('residencyExpiry', date)} /></div>)}
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
```

### ملف جدول الموظفين (`src/components/hr/employees-table.tsx`)

```tsx
'use client';
import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash2, Edit, Loader2, Calendar } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '@/context/auth-context';
import type { Employee } from '@/lib/types';
import { toFirestoreDate } from '@/services/date-converter';
import { format, differenceInYears } from 'date-fns';
import { Label } from '@/components/ui/label';
import { useFirebase, useSubscription } from '@/firebase';
import { doc, updateDoc, query, orderBy, collection } from 'firebase/firestore';
import { searchEmployees } from '@/lib/cache/fuse-search';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '../ui/input';
import { DateInput } from '../ui/date-input';


type EmployeeStatus = 'active' | 'on-leave' | 'terminated';

const statusTranslations: Record<EmployeeStatus, string> = {
  active: 'نشط',
  'on-leave': 'في إجازة',
  terminated: 'منتهية خدماته',
};

const statusColors: Record<EmployeeStatus, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  'on-leave': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  terminated: 'bg-red-100 text-red-800 border-red-200',
};

interface EmployeesTableProps {
    searchQuery: string;
}

export function EmployeesTable({ searchQuery }: EmployeesTableProps) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    
    // CHANGED: Default filter is now 'active'
    const [statusFilter, setStatusFilter] = useState('active');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [serviceDurationFilter, setServiceDurationFilter] = useState('all');
    
    const employeesQuery = useMemo(() => {
        if (!firestore) return null;
        return [orderBy('createdAt', 'desc')];
    }, [firestore]);

    const { data: employees, loading, error } = useSubscription<Employee>(firestore, 'employees', employeesQuery || []);

    const [employeeToTerminate, setEmployeeToTerminate] = useState<Employee | null>(null);
    const [isTerminating, setIsTerminating] = useState(false);
    const [terminationReason, setTerminationReason] = useState<'resignation' | 'termination' | null>(null);

    const departmentOptions = useMemo(() => {
        if (!employees) return [];
        const depts = new Set(employees.map(emp => emp.department).filter(Boolean));
        return Array.from(depts);
    }, [employees]);


    const filteredEmployees = useMemo(() => {
        const today = new Date();
        let filtered = employees;

        if (statusFilter !== 'all') {
            filtered = filtered.filter(emp => emp.status === statusFilter);
        }

        if (departmentFilter !== 'all') {
            filtered = filtered.filter(emp => emp.department === departmentFilter);
        }
        
        if (serviceDurationFilter !== 'all') {
            filtered = filtered.filter(emp => {
                const hireDate = toFirestoreDate(emp.hireDate);
                if (!hireDate) return false;

                const yearsOfService = differenceInYears(today, hireDate);

                switch (serviceDurationFilter) {
                    case '1-3':
                        return yearsOfService >= 1 && yearsOfService < 3;
                    case '3-6':
                        return yearsOfService >= 3 && yearsOfService < 6;
                    case '6-10':
                        return yearsOfService >= 6 && yearsOfService < 10;
                    case '10+':
                        return yearsOfService >= 10;
                    default:
                        return true;
                }
            });
        }
        
        return searchEmployees(filtered, searchQuery);
    }, [employees, searchQuery, statusFilter, departmentFilter, serviceDurationFilter]);

    const formatDate = (dateValue: any) => {
        const date = toFirestoreDate(dateValue);
        if (!date) return '-';
        return format(date, 'dd/MM/yyyy');
    };

    const handleTerminateClick = (employee: Employee) => {
        setEmployeeToTerminate(employee);
    };

    const handleTerminationConfirm = async () => {
        if (!employeeToTerminate || !terminationReason || !firestore) {
             toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تحديد سبب إنهاء الخدمة.' });
             return;
        };
        setIsTerminating(true);
        try {
            const employeeRef = doc(firestore, 'employees', employeeToTerminate.id!);
            await updateDoc(employeeRef, {
                status: 'terminated',
                terminationDate: new Date(),
                terminationReason: terminationReason
            });
            toast({ title: 'نجاح', description: 'تم إنهاء خدمة الموظف بنجاح.'});
        } catch (error) {
            console.error("Error terminating employee:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إنهاء خدمة الموظف.' });
        } finally {
            setIsTerminating(false);
            setEmployeeToTerminate(null);
            setTerminationReason(null);
        }
    };

    return (
        <>
            <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
                <div className="grid gap-2">
                    <Label htmlFor="status-filter">الحالة</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger id="status-filter" className="w-full sm:w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">الكل</SelectItem>
                            {Object.entries(statusTranslations).map(([key, value]) => (
                                <SelectItem key={key} value={key}>{value}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="department-filter">القسم</Label>
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger id="department-filter" className="w-full sm:w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">الكل</SelectItem>
                            {departmentOptions.map(dept => (
                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="service-duration-filter">مدة الخدمة</Label>
                    <Select value={serviceDurationFilter} onValueChange={setServiceDurationFilter}>
                        <SelectTrigger id="service-duration-filter" className="w-full sm:w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">الكل</SelectItem>
                            <SelectItem value="1-3">من 1-3 سنوات</SelectItem>
                            <SelectItem value="3-6">من 3-6 سنوات</SelectItem>
                            <SelectItem value="6-10">من 6-10 سنوات</SelectItem>
                            <SelectItem value="10+">أكثر من 10 سنوات</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>الاسم الكامل</TableHead>
                            <TableHead>الرقم الوظيفي</TableHead>
                            <TableHead>القسم</TableHead>
                            <TableHead>تاريخ التعيين</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead><span className="sr-only">الإجراءات</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                        ))}
                        {!loading && filteredEmployees.length === 0 && (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center">
                                {searchQuery ? 'لا توجد نتائج تطابق البحث.' : 'لا يوجد موظفون لعرضهم.'}
                            </TableCell></TableRow>
                        )}
                        {!loading && filteredEmployees.map((employee) => (
                            <TableRow key={employee.id}>
                                <TableCell className="font-medium">
                                    <Link href={`/dashboard/hr/employees/${employee.id}`} className="hover:underline">
                                        {employee.fullName}
                                    </Link>
                                </TableCell>
                                <TableCell className="font-mono">{employee.employeeNumber}</TableCell>
                                <TableCell>{employee.department}</TableCell>
                                <TableCell>{formatDate(employee.hireDate)}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={statusColors[employee.status]}>
                                        {statusTranslations[employee.status]}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">Toggle menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" dir="rtl">
                                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                            <DropdownMenuItem asChild>
                                                <Link href={`/dashboard/hr/employees/${employee.id}/edit`}>تعديل</Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            {employee.status !== 'terminated' && (
                                                <DropdownMenuItem onClick={() => handleTerminateClick(employee)} className="text-destructive focus:text-destructive">إنهاء الخدمة</DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={!!employeeToTerminate} onOpenChange={() => setEmployeeToTerminate(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد إنهاء الخدمة</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم تغيير حالة الموظف "{employeeToTerminate?.fullName}" إلى "منتهية خدمته" وتجميد حسابه.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="mt-4 space-y-2">
                         <Label>الرجاء تحديد سبب إنهاء الخدمة:</Label>
                         <div className="flex gap-4">
                            <Button variant={terminationReason === 'resignation' ? 'default' : 'outline'} onClick={() => setTerminationReason('resignation')}>استقالة</Button>
                            <Button variant={terminationReason === 'termination' ? 'default' : 'outline'} onClick={() => setTerminationReason('termination')}>إنهاء خدمات</Button>
                        </div>
                    </div>
                    <AlertDialogFooter className='mt-4'>
                        <AlertDialogCancel disabled={isTerminating}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleTerminationConfirm} disabled={!terminationReason || isTerminating} className="bg-destructive hover:bg-destructive/90">
                            {isTerminating ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، قم بالإنهاء'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
```

### ملف الإجازات (`src/app/dashboard/hr/leaves/page.tsx`)

```tsx
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LeaveRequestsList } from '@/components/hr/leave-requests-list';

export default function LeaveRequestsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>إدارة الإجازات</CardTitle>
                <CardDescription>عرض وتقديم وموافقة على طلبات الإجازات للموظفين.</CardDescription>
            </CardHeader>
            <CardContent>
                <LeaveRequestsList />
            </CardContent>
        </Card>
    );
}
```

### ملف الاستئذانات (`src/app/dashboard/hr/permissions/page.tsx`)

```tsx
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PermissionRequestsList } from '@/components/hr/permission-requests-list';

export default function PermissionRequestsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>إدارة الاستئذانات</CardTitle>
                <CardDescription>عرض وتقديم وموافقة على طلبات الاستئذان (تأخير أو خروج مبكر).</CardDescription>
            </CardHeader>
            <CardContent>
                <PermissionRequestsList />
            </CardContent>
        </Card>
    );
}
```

### ملف الرواتب (`src/app/dashboard/hr/payroll/page.tsx`)

```tsx
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AttendanceUploader } from '@/components/hr/attendance-uploader';
import { PayrollGenerator } from '@/components/hr/payroll-generator';
import { Users2, Sheet, FileSpreadsheet } from 'lucide-react';
import { PayslipsList } from '@/components/hr/payslips-list';

export default function PayrollPage() {
    return (
        <Tabs defaultValue="attendance" dir="rtl">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="attendance">
                    <Users2 className="ml-2 h-4 w-4" />
                    1. رفع الحضور والانصراف
                </TabsTrigger>
                <TabsTrigger value="payroll">
                    <Sheet className="ml-2 h-4 w-4" />
                    2. معالجة الرواتب
                </TabsTrigger>
                 <TabsTrigger value="payslips">
                    <FileSpreadsheet className="ml-2 h-4 w-4" />
                    3. عرض الكشوفات
                </TabsTrigger>
            </TabsList>
            <TabsContent value="attendance" className="mt-4">
                <AttendanceUploader />
            </TabsContent>
            <TabsContent value="payroll" className="mt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>معالجة كشوف الرواتب</CardTitle>
                        <CardDescription>
                           توليد كشوف الرواتب الشهرية بناءً على سجلات الحضور والغياب للموظفين.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <PayrollGenerator />
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="payslips" className="mt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>كشوف الرواتب المُنشأة</CardTitle>
                        <CardDescription>
                           مراجعة وتأكيد دفع كشوف الرواتب التي تم إنشاؤها.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <PayslipsList />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
```

### حاسبة نهاية الخدمة (`src/app/dashboard/hr/gratuity-calculator/page.tsx`)

```tsx
'use client';

import { GratuityCalculatorView } from "@/components/hr/gratuity-calculator-view";

export default function GratuityCalculatorPage() {
    return <GratuityCalculatorView />;
}
```

### منطق حساب الإجازات ونهاية الخدمة (`src/services/leave-calculator.ts`)

هذا الملف يحتوي على الدوال الرياضية لحساب أيام العمل، أرصدة الإجازات، ومستحقات نهاية الخدمة وفقاً للقانون.

```ts
import { differenceInDays, eachDayOfInterval, format, differenceInYears, differenceInMonths } from 'date-fns';
import type { Holiday, Employee } from '@/lib/types';
import { toFirestoreDate } from './date-converter';

const dayNameToIndex: Record<string, number> = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6
};

export function calculateWorkingDays(
  startDate: Date | undefined,
  endDate: Date | undefined,
  weeklyHolidays: string[],
  publicHolidays: Holiday[]
): { totalDays: number, workingDays: number } {
  if (!startDate || !endDate || startDate > endDate) {
    return { totalDays: 0, workingDays: 0 };
  }

  const totalDays = differenceInDays(endDate, startDate) + 1;
  const interval = { start: startDate, end: endDate };
  const allDaysInInterval = eachDayOfInterval(interval);

  const weeklyHolidayIndexes = new Set(weeklyHolidays.map(day => dayNameToIndex[day]));
  const publicHolidayDates = new Set(publicHolidays.map(h => format(toFirestoreDate(h.date)!, 'yyyy-MM-dd')));

  let workingDays = 0;

  for (const day of allDaysInInterval) {
    const dayIndex = day.getDay();
    const dateString = format(day, 'yyyy-MM-dd');
    
    if (!weeklyHolidayIndexes.has(dayIndex) && !publicHolidayDates.has(dateString)) {
      workingDays++;
    }
  }

  return { totalDays, workingDays };
}

export const calculateAnnualLeaveBalance = (employee: Partial<Employee>, asOfDate: Date): number => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return 0;

    // Calculate total months of service
    const totalMonthsOfService = differenceInMonths(asOfDate, hireDate);
    
    // Accrual is 30 days per year, which is 2.5 days per month.
    const totalAccrued = (totalMonthsOfService / 12) * 30;
    
    const usedLeave = employee.annualLeaveUsed || 0;
    const carriedOver = employee.carriedLeaveDays || 0;

    const balance = totalAccrued + carriedOver - usedLeave;

    return Math.floor(balance > 0 ? balance : 0);
};


export const calculateGratuity = (employee: Employee, asOfDate: Date) => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) {
      return { gratuity: 0, leaveBalancePay: 0, total: 0, notice: 'تاريخ التعيين غير صالح.', yearsOfService: 0, lastSalary: 0, leaveBalance: 0, dailyWage: 0 };
    }

    const yearsOfService = differenceInYears(asOfDate, hireDate);
    const lastSalary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);

    if (lastSalary === 0) {
        return { gratuity: 0, leaveBalancePay: 0, total: 0, notice: 'لم يتم تحديد راتب للموظف.', yearsOfService, lastSalary: 0, leaveBalance: 0, dailyWage: 0 };
    }

    let rawGratuity = 0;
    const dailyWage = lastSalary / 26; // As per common practice for Kuwait law

    // Kuwaiti Private Sector Labor Law No. 6 of 2010, Article 51
    if (yearsOfService <= 5) {
        // 15 days' remuneration for each of the first five years
        rawGratuity = yearsOfService * 15 * dailyWage;
    } else {
        // 15 days for first 5 years + one month's remuneration for each year thereafter.
        const firstFiveYearsGratuity = 5 * 15 * dailyWage;
        const subsequentYears = yearsOfService - 5;
        const subsequentYearsGratuity = subsequentYears * lastSalary;
        rawGratuity = firstFiveYearsGratuity + subsequentYearsGratuity;
    }

    // Cap at 1.5 years salary
    const maxGratuity = 1.5 * 12 * lastSalary;
    rawGratuity = Math.min(rawGratuity, maxGratuity);

    let finalGratuity = rawGratuity;
    let notice = `بناءً على ${yearsOfService.toFixed(1)} سنوات من الخدمة.`;

    if (employee.terminationReason === 'resignation') {
        if (yearsOfService < 3) {
            finalGratuity = 0;
            notice += " (لا يستحق مكافأة لخدمة أقل من 3 سنوات عند الاستقالة)";
        } else if (yearsOfService < 5) {
            finalGratuity = rawGratuity * 0.5;
             notice += " (يستحق نصف المكافأة لخدمة بين 3-5 سنوات عند الاستقالة)";
        } else if (yearsOfService < 10) {
            finalGratuity = rawGratuity * (2 / 3);
            notice += " (يستحق ثلثي المكافأة لخدمة بين 5-10 سنوات عند الاستقالة)";
        }
        // If > 10 years, they get the full amount, so no change needed.
    }

    const leaveBalance = calculateAnnualLeaveBalance(employee, asOfDate);
    const leaveBalancePay = leaveBalance * dailyWage;

    return { 
        gratuity: finalGratuity, 
        leaveBalancePay, 
        total: finalGratuity + leaveBalancePay, 
        notice,
        yearsOfService,
        lastSalary,
        leaveBalance,
        dailyWage,
    };
};
```