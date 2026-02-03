
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X, Camera, Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { addDoc, collection, serverTimestamp, query, where, getDocs, runTransaction, doc, getDoc, orderBy, limit, deleteField, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Employee, Governorate, Area, Department, Job } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/auth-context';
import { toFirestoreDate } from '@/services/date-converter';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


export default function NewEmployeePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { language } = useLanguage();
    const { user: currentUser } = useAuth();
    
    const [formData, setFormData] = useState<Partial<Employee> & { departmentId?: string }>({
        employeeNumber: '',
        fullName: '',
        nameEn: '',
        dob: '',
        gender: undefined,
        civilId: '',
        nationality: 'كويتي',
        residencyExpiry: '',
        contractExpiry: '',
        mobile: '',
        emergencyContact: '',
        email: '',
        departmentId: '',
        jobTitle: '',
        position: undefined,
        workStartTime: '08:00',
        workEndTime: '17:00',
        hireDate: '',
        contractType: 'permanent',
        basicSalary: '',
        housingAllowance: '',
        transportAllowance: '',
        salaryPaymentType: undefined,
        bankName: '',
        iban: '',
        status: 'active',
    });
    
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingNumber, setIsGeneratingNumber] = useState(true);
    const fromAppointmentId = searchParams.get('fromAppointmentId');
    
    const [departments, setDepartments] = useState<Department[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [refDataLoading, setRefDataLoading] = useState(true);
    const [jobsLoading, setJobsLoading] = useState(false);
    
    const [includeHousing, setIncludeHousing] = useState(false);
    const [includeTransport, setIncludeTransport] = useState(false);


     // Effect to pre-fill from URL
    useEffect(() => {
        const nameFromUrl = searchParams.get('nameAr');
        const mobileFromUrl = searchParams.get('mobile');
        const engineerFromUrl = searchParams.get('engineerId');

        if (nameFromUrl) {
            setFormData(prev => ({...prev, fullName: nameFromUrl}));
        }
        if (mobileFromUrl) {
            setFormData(prev => ({...prev, mobile: mobileFromUrl}));
        }
    }, [searchParams]);

    // Fetch File ID & Ref Data
    useEffect(() => {
        if (!firestore) return;

        const generateFileId = async () => {
            setIsGeneratingNumber(true);
            try {
                const employeesRef = collection(firestore, 'employees');
                const querySnapshot = await getDocs(employeesRef);
                let maxNumber = 100;
                querySnapshot.forEach(doc => {
                     const num = parseInt(doc.data().employeeNumber, 10);
                     if (!isNaN(num) && num > maxNumber) maxNumber = num;
                });
                const nextNumber = String(maxNumber + 1);
                setFormData(prev => ({ ...prev, employeeNumber: nextNumber }));
            } catch (error) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل توليد الرقم الوظيفي.' });
            } finally {
                setIsGeneratingNumber(false);
            }
        };
        
        const fetchRefData = async () => {
            setRefDataLoading(true);
            try {
                const deptsQuery = query(collection(firestore, 'departments'), orderBy('name'));
                const deptsSnapshot = await getDocs(deptsQuery);
                setDepartments(deptsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
            } catch (e) {
                 toast({ variant: 'destructive', title: 'خطأ', description: 'فشل جلب الأقسام.' });
            } finally {
                setRefDataLoading(false);
            }
        };

        generateFileId();
        fetchRefData();
    }, [firestore, toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        let sanitizedValue: string | number = value;
        if (id === 'fullName') {
            sanitizedValue = value.replace(/[^ \u0600-\u06FF]/g, '');
        } else if (id === 'nameEn') {
            sanitizedValue = value.replace(/[^ a-zA-Z]/g, '');
        } else if (id === 'basicSalary' || id === 'housingAllowance' || id === 'transportAllowance') {
            sanitizedValue = value; // Keep as string for input control, will be converted to number on submit
        }
        setFormData(prev => ({ ...prev, [id]: sanitizedValue }));
    };

    const handleSelectChange = (id: keyof Employee | 'departmentId', value: any) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleDepartmentChange = useCallback(async (deptId: string) => {
        if (!deptId || !firestore) return;

        setFormData(prev => ({ ...prev, departmentId: deptId, jobTitle: '' }));
        setJobs([]);
        setJobsLoading(true);
        try {
            const jobsQuery = query(collection(firestore, `departments/${deptId}/jobs`), orderBy('name'));
            const jobsSnapshot = await getDocs(jobsQuery);
            setJobs(jobsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job)));
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error fetching jobs' });
        } finally {
            setJobsLoading(false);
        }
    }, [firestore, toast]);
    
    const departmentOptions = useMemo(() => departments.map(d => ({ value: d.id, label: d.name })), [departments]);
    const jobOptions = useMemo(() => jobs.map(j => ({ value: j.name, label: j.name })), [jobs]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات أو تحديد المستخدم الحالي.' });
            return;
        }
        setIsLoading(true);
        
        try {
            const selectedDept = departments.find(d => d.id === formData.departmentId);
            const departmentName = selectedDept?.name || '';
            
            const requiredFields: (keyof Employee)[] = ['employeeNumber', 'fullName', 'nameEn', 'civilId', 'mobile', 'department', 'jobTitle', 'hireDate', 'basicSalary'];
             for (const field of requiredFields) {
                const value = field === 'department' ? departmentName : formData[field];
                if (value === undefined || value === null || (typeof value !== 'number' && value === '')) {
                     if (field === 'employeeNumber') {
                         toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: `الرقم الوظيفي لم يتم توليده بعد. الرجاء الانتظار.` });
                    } else {
                        toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: `الرجاء تعبئة حقل "${field}" الأساسي المطلوب.` });
                    }
                    setIsLoading(false);
                    return;
                }
            }
            
            const civilIdQuery = query(collection(firestore, 'employees'), where('civilId', '==', formData.civilId));
            const civilIdSnapshot = await getDocs(civilIdQuery);
            if (!civilIdSnapshot.empty) {
                toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'الرقم المدني هذا مسجل لموظف آخر.' });
                setIsLoading(false);
                return;
            }

            const mobileQuery = query(collection(firestore, 'employees'), where('mobile', '==', formData.mobile));
            const mobileSnapshot = await getDocs(mobileQuery);
            if (!mobileSnapshot.empty) {
                toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'رقم الجوال هذا مسجل لموظف آخر.' });
                setIsLoading(false);
                return;
            }


            const hireDate = toFirestoreDate(formData.hireDate as string);
            if(!hireDate) {
                 toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'تاريخ التعيين مطلوب' });
                 setIsLoading(false);
                 return;
            }


            if (formData.salaryPaymentType === 'transfer' && !formData.iban) {
                toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'رقم الحساب الدولي (IBAN) مطلوب عند اختيار التحويل البنكي.' });
                setIsLoading(false);
                return;
            }

            const employeeData: DocumentData = {
                ...formData,
                department: departmentName,
                hireDate: hireDate,
                basicSalary: Number(formData.basicSalary) || 0,
                housingAllowance: includeHousing ? Number(formData.housingAllowance) || 0 : 0,
                transportAllowance: includeTransport ? Number(formData.transportAllowance) || 0 : 0,
                status: 'active',
                createdAt: serverTimestamp(),
                terminationDate: null,
                terminationReason: null,
                noticeStartDate: null,
                annualLeaveAccrued: 0,
                annualLeaveUsed: 0,
                carriedLeaveDays: 0,
                sickLeaveUsed: 0,
                emergencyLeaveUsed: 0,
                maxEmergencyLeave: 5,
                lastVacationAccrualDate: hireDate,
                lastLeaveResetDate: hireDate,
            };
            delete employeeData.departmentId; // Remove temporary field before saving

            const dateFields: (keyof Employee)[] = ['dob', 'residencyExpiry', 'contractExpiry'];
            dateFields.forEach(field => {
                const dateValue = toFirestoreDate(formData[field] as string);
                if (dateValue) {
                    employeeData[field] = dateValue;
                } else {
                    delete employeeData[field]; 
                }
            });

            if (formData.contractType === 'permanent') {
                delete employeeData.contractExpiry;
            }
            
            const batch = writeBatch(firestore);

            const newEmployeeRef = doc(collection(firestore, 'employees'));
            batch.set(newEmployeeRef, employeeData);

            const auditLogRef = doc(collection(firestore, `employees/${newEmployeeRef.id}/auditLogs`));
            batch.set(auditLogRef, {
                employeeId: newEmployeeRef.id,
                changeType: 'Creation',
                field: 'employee',
                oldValue: null,
                newValue: {
                    fullName: employeeData.fullName,
                    jobTitle: employeeData.jobTitle,
                    department: employeeData.department,
                    basicSalary: employeeData.basicSalary
                },
                effectiveDate: employeeData.hireDate,
                changedBy: currentUser.uid,
                notes: 'إنشاء ملف موظف جديد.'
            });

            await batch.commit();

            toast({ title: 'نجاح', description: 'تم حفظ الموظف وسجل الإنشاء بنجاح.' });
            router.push('/dashboard/hr');
        } catch (error) {
            console.error("Error saving employee:", error);
            const errorMessage = error instanceof Error ? error.message : 'لم يتم حفظ الموظف. يرجى التأكد من صحة التواريخ والبيانات المدخلة.';
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Card dir="rtl">
            <form onSubmit={handleSubmit}>
                <CardHeader>
                    <CardTitle>إضافة موظف جديد</CardTitle>
                    <CardDescription>
                        قم بتعبئة جميع الحقول المطلوبة لإنشاء ملف موظف جديد في النظام.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Personal Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">المعلومات الشخصية</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                            <div className="md:col-span-1 flex flex-col items-center gap-2">
                                <Avatar className='h-32 w-32'>
                                    <AvatarImage src="" />
                                    <AvatarFallback><Camera className='h-8 w-8 text-muted-foreground' /></AvatarFallback>
                                </Avatar>
                                <Button type="button" variant="outline" size="sm">رفع صورة شخصية</Button>
                            </div>
                            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="employeeNumber">الرقم الوظيفي</Label>
                                    <Input id="employeeNumber" value={isGeneratingNumber ? "جاري التوليد..." : formData.employeeNumber} onChange={() => {}} readOnly disabled className="bg-muted/50" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="fullName">الاسم بالعربية <span className="text-destructive">*</span></Label>
                                    <Input id="fullName" value={formData.fullName} onChange={handleInputChange} placeholder="مثال: علياء العامري" required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="nameEn">الاسم بالإنجليزية <span className="text-destructive">*</span></Label>
                                    <Input id="nameEn" value={formData.nameEn} onChange={handleInputChange} placeholder="e.g. Alyaa Alameri" dir="ltr" required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="dob">تاريخ الميلاد</Label>
                                    <Input id="dob" type="date" value={formData.dob} onChange={handleInputChange} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="gender">النوع</Label>
                                    <Select dir="rtl" value={formData.gender} onValueChange={(v) => handleSelectChange('gender', v)}>
                                        <SelectTrigger id="gender"><SelectValue placeholder="اختر..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="male">ذكر</SelectItem>
                                            <SelectItem value="female">أنثى</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Legal & Residency */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">المعلومات القانونية والإقامة</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="civilId">الرقم المدني <span className="text-destructive">*</span></Label>
                                <Input id="civilId" value={formData.civilId} onChange={handleInputChange} placeholder="12-digit number" dir="ltr" maxLength={12} required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="nationality">الجنسية</Label>
                                <Input id="nationality" value={formData.nationality} onChange={handleInputChange} placeholder="مثال: كويتي" />
                            </div>
                            {formData.nationality !== 'كويتي' && (
                                <div className="grid gap-2">
                                    <Label htmlFor="residencyExpiry">تاريخ انتهاء الإقامة</Label>
                                    <Input id="residencyExpiry" type="date" value={formData.residencyExpiry} onChange={handleInputChange} required={formData.nationality !== 'كويتي'} />
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* Contact Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">معلومات الاتصال</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="mobile">رقم الجوال <span className="text-destructive">*</span></Label>
                                <Input id="mobile" dir="ltr" value={formData.mobile} onChange={handleInputChange} placeholder="+965 XXXX XXXX" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="emergencyContact">رقم طوارئ</Label>
                                <Input id="emergencyContact" dir="ltr" value={formData.emergencyContact} onChange={handleInputChange} placeholder="+965 XXXX XXXX" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="email">البريد الإلكتروني</Label>
                                <Input id="email" type="email" dir="ltr" value={formData.email} onChange={handleInputChange} placeholder="employee@example.com" />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Employment Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">معلومات التوظيف والعقد</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="department">القسم <span className="text-destructive">*</span></Label>
                                <InlineSearchList 
                                    value={formData.departmentId || ''}
                                    onSelect={handleDepartmentChange}
                                    options={departmentOptions}
                                    placeholder={refDataLoading ? "تحميل..." : "اختر القسم..."}
                                    disabled={refDataLoading}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="jobTitle">الوظيفة <span className="text-destructive">*</span></Label>
                                <InlineSearchList
                                    value={formData.jobTitle || ''}
                                    onSelect={(v) => handleSelectChange('jobTitle', v)}
                                    options={jobOptions}
                                    placeholder={
                                        jobsLoading 
                                        ? "تحميل الوظائف..." 
                                        : !formData.departmentId 
                                            ? "اختر قسمًا أولاً" 
                                            : (jobs.length === 0 ? "لا يوجد وظائف بهذا القسم" : "اختر الوظيفة...")
                                    }
                                    disabled={!formData.departmentId || jobsLoading || jobs.length === 0}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="position">المنصب</Label>
                                <Select dir="rtl" value={formData.position} onValueChange={(v) => handleSelectChange('position', v)}>
                                    <SelectTrigger id="position"><SelectValue placeholder="اختر..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="head">رئيس قسم</SelectItem>
                                        <SelectItem value="employee">موظف</SelectItem>
                                        <SelectItem value="assistant">مساعد</SelectItem>
                                        <SelectItem value="contractor">متعاقد</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="hireDate">تاريخ التعيين <span className="text-destructive">*</span></Label>
                                <Input id="hireDate" type="date" value={formData.hireDate} onChange={handleInputChange} required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="contractType">نوع العقد</Label>
                                <Select dir="rtl" value={formData.contractType} onValueChange={(v) => handleSelectChange('contractType', v as 'permanent' | 'temporary' | 'subcontractor')}>
                                    <SelectTrigger id="contractType"><SelectValue placeholder="اختر..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="permanent">دائم</SelectItem>
                                        <SelectItem value="temporary">مؤقت</SelectItem>
                                        <SelectItem value="subcontractor">متعهّد</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {(formData.contractType === 'temporary' || formData.contractType === 'subcontractor') && (
                                <div className="grid gap-2">
                                    <Label htmlFor="contractExpiry">تاريخ انتهاء العقد</Label>
                                    <Input id="contractExpiry" type="date" value={formData.contractExpiry} onChange={handleInputChange} required={formData.contractType !== 'permanent'} />
                                </div>
                            )}
                            <div className="grid gap-2">
                                <Label htmlFor="workStartTime">وقت بدء الدوام</Label>
                                <Input id="workStartTime" type="time" value={formData.workStartTime} onChange={handleInputChange} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="workEndTime">وقت انتهاء الدوام</Label>
                                <Input id="workEndTime" type="time" value={formData.workEndTime} onChange={handleInputChange} />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Salary & Bank */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">الراتب والبنك</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                            <div className="grid gap-2 md:col-span-3">
                                <Label htmlFor="basicSalary">الراتب الأساسي <span className="text-destructive">*</span></Label>
                                <Input id="basicSalary" type="number" dir="ltr" value={formData.basicSalary} onChange={handleInputChange} placeholder="0.000" required />
                            </div>

                            <div className="items-center flex space-x-2 space-y-2">
                                <Checkbox id="includeHousing" checked={includeHousing} onCheckedChange={(checked) => setIncludeHousing(checked as boolean)} />
                                <label htmlFor="includeHousing" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    تضمين بدل السكن
                                </label>
                            </div>
                            
                            {includeHousing && (
                                <div className="grid gap-2 md:col-span-2">
                                    <Label htmlFor="housingAllowance">قيمة بدل السكن</Label>
                                    <Input id="housingAllowance" type="number" dir="ltr" value={formData.housingAllowance} onChange={handleInputChange} placeholder="0.000" />
                                </div>
                            )}

                            <div className="items-center flex space-x-2 space-y-2 mt-4 md:mt-0">
                                <Checkbox id="includeTransport" checked={includeTransport} onCheckedChange={(checked) => setIncludeTransport(checked as boolean)} />
                                <label htmlFor="includeTransport" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    تضمين بدل النقل
                                </label>
                            </div>
                            
                            {includeTransport && (
                                <div className="grid gap-2 md:col-span-2">
                                    <Label htmlFor="transportAllowance">قيمة بدل النقل</Label>
                                    <Input id="transportAllowance" type="number" dir="ltr" value={formData.transportAllowance} onChange={handleInputChange} placeholder="0.000" />
                                </div>
                            )}
                            
                            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="salaryPaymentType">نوع الراتب</Label>
                                    <Select dir="rtl" value={formData.salaryPaymentType} onValueChange={(v) => handleSelectChange('salaryPaymentType', v)}>
                                        <SelectTrigger id="salaryPaymentType"><SelectValue placeholder="اختر..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="transfer">تحويل بنكي</SelectItem>
                                            <SelectItem value="cheque">شيك</SelectItem>
                                            <SelectItem value="cash">كاش</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {formData.salaryPaymentType === 'transfer' && (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="bankName">اسم البنك</Label>
                                            <Select dir="rtl" value={formData.bankName} onValueChange={(v) => handleSelectChange('bankName', v)}>
                                                <SelectTrigger id="bankName"><SelectValue placeholder="اختر البنك..." /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NBK">بنك الكويت الوطني</SelectItem>
                                                    <SelectItem value="KFH">بيت التمويل الكويتي</SelectItem>
                                                    <SelectItem value="GulfBank">بنك الخليج</SelectItem>
                                                    <SelectItem value="BurganBank">بنك برقان</SelectItem>
                                                    <SelectItem value="KIB">بنك الكويت الدولي</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="iban">رقم الحساب الدولي (IBAN) <span className="text-destructive">*</span></Label>
                                            <Input id="iban" value={formData.iban} onChange={handleInputChange} placeholder="KWXXXXXXXXXXXXXXXXXXXXXXXXXX" dir="ltr" required={formData.salaryPaymentType === 'transfer'} />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => router.back()} className="ml-2">
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={isLoading || isGeneratingNumber}>
                    {isLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                    {isLoading ? 'جاري الحفظ...' : 'حفظ الموظف'}
                  </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
