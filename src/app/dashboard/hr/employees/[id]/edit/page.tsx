'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Save } from 'lucide-react';
import type { Employee } from '@/lib/types';
import { useFirebase } from '@/firebase';
import { doc, updateDoc, serverTimestamp, type DocumentData, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';


export default function EditEmployeePage() {
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [formData, setFormData] = useState<Partial<Employee> | null>(null);
    const [includeHousing, setIncludeHousing] = useState(false);
    const [includeTransport, setIncludeTransport] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    useEffect(() => {
        if (!id || !firestore) {
            router.push('/dashboard/hr');
            return;
        };

        const fetchEmployee = async () => {
            setIsFetching(true);
            try {
                const employeeDoc = doc(firestore, 'employees', id);
                const employeeSnap = await getDoc(employeeDoc);

                if (employeeSnap.exists()) {
                    const data = employeeSnap.data() as Employee;
                    // Format dates for input fields
                    const formattedData = {
                        ...data,
                        dob: data.dob ? new Date(data.dob).toISOString().split('T')[0] : '',
                        hireDate: data.hireDate ? new Date(data.hireDate).toISOString().split('T')[0] : '',
                        residencyExpiry: data.residencyExpiry ? new Date(data.residencyExpiry).toISOString().split('T')[0] : '',
                        contractExpiry: data.contractExpiry ? new Date(data.contractExpiry).toISOString().split('T')[0] : '',
                    };
                    setFormData(formattedData);
                    setIncludeHousing(!!data.housingAllowance && data.housingAllowance > 0);
                    setIncludeTransport(!!data.transportAllowance && data.transportAllowance > 0);
                } else {
                    toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم العثور على الموظف.' });
                    router.push('/dashboard/hr');
                }
            } catch (error) {
                 toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب بيانات الموظف.' });
                 console.error(error);
            } finally {
                setIsFetching(false);
            }
        };

        fetchEmployee();
    }, [id, firestore, router, toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        let sanitizedValue = value;
        if (id === 'fullName') {
            // Allow Arabic letters and spaces only
            sanitizedValue = value.replace(/[^ \u0600-\u06FF]/g, '');
        } else if (id === 'nameEn') {
            // Allow English letters and spaces only
            sanitizedValue = value.replace(/[^ a-zA-Z]/g, '');
        }
        setFormData(prev => prev ? ({ ...prev, [id]: sanitizedValue }) : null);
    };

    const handleSelectChange = (id: keyof Employee, value: any) => {
        setFormData(prev => prev ? ({ ...prev, [id]: value }) : null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !id || !formData) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات. الرجاء المحاولة مرة أخرى.' });
            return;
        }
        setIsLoading(true);
        
        try {
            // --- Validation ---
            const requiredFields: (keyof Employee)[] = ['fullName', 'nameEn', 'civilId', 'mobile', 'department', 'jobTitle', 'hireDate', 'basicSalary'];
            for (const field of requiredFields) {
                const value = formData[field];
                 if (value === undefined || value === null || value === '') {
                    // For numbers, allow 0
                    if (typeof formData[field] === 'number' && Number(formData[field]) === 0) continue;
                    
                    toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: `الرجاء تعبئة حقل "${field}" الأساسي المطلوب.` });
                    setIsLoading(false);
                    return;
                }
            }
            
            const dateFields: (keyof Employee)[] = ['dob', 'residencyExpiry', 'contractExpiry', 'hireDate'];
            for (const field of dateFields) {
                const dateValue = formData[field];
                if (dateValue && isNaN(new Date(dateValue as string).getTime())) {
                     toast({ variant: 'destructive', title: 'تاريخ غير صالح', description: `قيمة التاريخ المدخلة في حقل "${field}" غير صحيحة.` });
                     setIsLoading(false);
                     return;
                }
            }

            if (formData.salaryPaymentType === 'transfer' && !formData.iban) {
                toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'رقم الحساب الدولي (IBAN) مطلوب عند اختيار التحويل البنكي.' });
                setIsLoading(false);
                return;
            }

            // --- Data Sanitization & Preparation ---
            const employeeData: DocumentData = {
                // Keep all existing data and overwrite changed fields
                ...formData,
                fullName: formData.fullName,
                nameEn: formData.nameEn,
                civilId: formData.civilId,
                mobile: formData.mobile,
                department: formData.department,
                jobTitle: formData.jobTitle,
                hireDate: new Date(formData.hireDate!).toISOString(),
                contractType: formData.contractType || 'permanent',
                basicSalary: Number(formData.basicSalary) || 0,
            };

            // Update optional fields
            if (formData.dob) employeeData.dob = new Date(formData.dob).toISOString();
            if (formData.gender) employeeData.gender = formData.gender;
            if (formData.visaType) employeeData.visaType = formData.visaType;
            if (formData.residencyExpiry) employeeData.residencyExpiry = new Date(formData.residencyExpiry).toISOString();
            
            if ((formData.contractType === 'temporary' || formData.contractType === 'subcontractor') && formData.contractExpiry) {
                employeeData.contractExpiry = new Date(formData.contractExpiry).toISOString();
            } else {
                employeeData.contractExpiry = null;
            }

            if (formData.emergencyContact) employeeData.emergencyContact = formData.emergencyContact;
            if (formData.email) employeeData.email = formData.email;
            if (formData.position) employeeData.position = formData.position;

            employeeData.housingAllowance = includeHousing ? Number(formData.housingAllowance) || 0 : 0;
            employeeData.transportAllowance = includeTransport ? Number(formData.transportAllowance) || 0 : 0;

            if (formData.salaryPaymentType) employeeData.salaryPaymentType = formData.salaryPaymentType;
            if (formData.bankName) employeeData.bankName = formData.bankName;
            if (formData.iban) employeeData.iban = formData.iban;
            if(formData.profilePicture) employeeData.profilePicture = formData.profilePicture;


            const employeeRef = doc(firestore, 'employees', id);
            await updateDoc(employeeRef, employeeData);

            toast({ title: 'نجاح', description: 'تم تحديث بيانات الموظف بنجاح.' });
            router.push(`/dashboard/hr/employees/${id}`);
        } catch (error) {
            console.error("Error saving employee:", error);
            const errorMessage = error instanceof Error ? error.message : 'لم يتم حفظ التغييرات. يرجى التأكد من صحة البيانات المدخلة.';
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };


    if (isFetching || !formData) {
        return (
            <Card dir="rtl">
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                </CardHeader>
                <CardContent className="space-y-8">
                   <div className="space-y-4">
                        <Skeleton className="h-6 w-1/5" />
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                             <div className="md:col-span-1 flex flex-col items-center gap-2">
                                <Skeleton className="h-32 w-32 rounded-full" />
                                <Skeleton className="h-8 w-24" />
                            </div>
                            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Skeleton className="h-10" />
                                <Skeleton className="h-10" />
                                <Skeleton className="h-10" />
                                <Skeleton className="h-10" />
                            </div>
                        </div>
                   </div>
                    <Separator />
                     <div className="space-y-4">
                        <Skeleton className="h-6 w-1/4" />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           <Skeleton className="h-10" />
                           <Skeleton className="h-10" />
                           <Skeleton className="h-10" />
                        </div>
                    </div>
                </CardContent>
                 <CardFooter className="flex justify-end gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-28" />
                </CardFooter>
            </Card>
        )
    }

    return (
        <Card dir="rtl">
            <form onSubmit={handleSubmit}>
                <CardHeader>
                    <CardTitle>تعديل بيانات الموظف</CardTitle>
                    <CardDescription>
                        تعديل ملف الموظف: {formData.fullName}.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Personal Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">المعلومات الشخصية</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                            <div className="md:col-span-1 flex flex-col items-center gap-2">
                                <Avatar className='h-32 w-32'>
                                    <AvatarImage src={formData.profilePicture} />
                                    <AvatarFallback><Camera className='h-8 w-8 text-muted-foreground' /></AvatarFallback>
                                </Avatar>
                                <Button type="button" variant="outline" size="sm">تغيير الصورة</Button>
                            </div>
                            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                <Label htmlFor="visaType">نوع الإقامة / التأشيرة</Label>
                                <Select dir="rtl" value={formData.visaType} onValueChange={(v) => handleSelectChange('visaType', v)}>
                                    <SelectTrigger id="visaType"><SelectValue placeholder="اختر..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="kuwaiti">كويتي</SelectItem>
                                        <SelectItem value="engineer">مهندس</SelectItem>
                                        <SelectItem value="worker">عامل</SelectItem>
                                        <SelectItem value="driver">سائق</SelectItem>
                                        <SelectItem value="admin">إداري</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {formData.visaType !== 'kuwaiti' && (
                                <div className="grid gap-2">
                                    <Label htmlFor="residencyExpiry">تاريخ انتهاء الإقامة</Label>
                                    <Input id="residencyExpiry" type="date" value={formData.residencyExpiry} onChange={handleInputChange} required={formData.visaType !== 'kuwaiti'} />
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
                                <Input id="department" value={formData.department} onChange={handleInputChange} placeholder="e.g., هندسة, محاسبة" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="jobTitle">الوظيفة <span className="text-destructive">*</span></Label>
                                <Input id="jobTitle" value={formData.jobTitle} onChange={handleInputChange} placeholder="e.g., مهندس مدني, محاسب عام" required />
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
                  <Button type="submit" disabled={isLoading}>
                    <Save className="ml-2 h-4 w-4" />
                    {isLoading ? 'جاري حفظ التعديلات...' : 'حفظ التعديلات'}
                  </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
