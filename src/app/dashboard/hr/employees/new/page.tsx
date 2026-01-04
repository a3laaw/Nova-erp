
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { addDoc, collection, serverTimestamp, type WithFieldValue, DocumentData } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';


export default function NewEmployeePage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const [formData, setFormData] = useState<Partial<Employee>>({
        fullName: '',
        nameEn: '',
        dob: '',
        gender: undefined,
        maritalStatus: undefined,
        dependents: 0,
        civilId: '',
        visaType: 'kuwaiti',
        residencyExpiry: '',
        contractExpiry: '',
        mobile: '',
        emergencyContact: '',
        email: '',
        department: '',
        jobTitle: '',
        position: undefined,
        hireDate: '',
        contractType: 'permanent',
        basicSalary: 0,
        housingAllowance: 0,
        transportAllowance: 0,
        salaryPaymentType: undefined,
        bankName: '',
        iban: '',
        status: 'active',
    });

    const [isLoading, setIsLoading] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (id: keyof Employee, value: any) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات. الرجاء المحاولة مرة أخرى.' });
            return;
        }
        setIsLoading(true);
        
        try {
            // --- Validation ---
            if (!formData.fullName || !formData.nameEn || !formData.civilId || !formData.mobile || !formData.department || !formData.jobTitle || !formData.hireDate) {
                 toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'الرجاء تعبئة جميع الحقول الأساسية المطلوبة.' });
                 setIsLoading(false);
                 return;
            }

            if (formData.salaryPaymentType === 'transfer' && !formData.iban) {
                toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'رقم الحساب الدولي (IBAN) مطلوب عند اختيار التحويل البنكي.' });
                setIsLoading(false);
                return;
            }

            // --- Data Sanitization & Preparation ---
            const hireDate = new Date(formData.hireDate);

            const employeeData: DocumentData = {
                // Required fields
                fullName: formData.fullName,
                nameEn: formData.nameEn,
                civilId: formData.civilId,
                mobile: formData.mobile,
                department: formData.department,
                jobTitle: formData.jobTitle,
                hireDate: hireDate.toISOString(),
                contractType: formData.contractType || 'permanent',
                basicSalary: Number(formData.basicSalary) || 0,
                status: 'active',
                
                // Optional fields (set to null if empty)
                dob: formData.dob ? new Date(formData.dob).toISOString() : null,
                gender: formData.gender || null,
                maritalStatus: formData.maritalStatus || null,
                dependents: Number(formData.dependents) || 0,
                visaType: formData.visaType || null,
                residencyExpiry: formData.residencyExpiry ? new Date(formData.residencyExpiry).toISOString() : null,
                contractExpiry: formData.contractExpiry ? new Date(formData.contractExpiry).toISOString() : null,
                emergencyContact: formData.emergencyContact || null,
                email: formData.email || null,
                position: formData.position || null,
                housingAllowance: Number(formData.housingAllowance) || 0,
                transportAllowance: Number(formData.transportAllowance) || 0,
                salaryPaymentType: formData.salaryPaymentType || null,
                bankName: formData.bankName || null,
                iban: formData.iban || null,

                // Default values for new employee
                terminationDate: null,
                terminationReason: null,
                lastVacationAccrualDate: hireDate.toISOString(),
                lastLeaveResetDate: hireDate.toISOString(),
                annualLeaveAccrued: 0,
                annualLeaveUsed: 0,
                carriedLeaveDays: 0,
                sickLeaveUsed: 0,
                emergencyLeaveUsed: 0,
                maxEmergencyLeave: 5, // Default value
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(firestore, 'employees'), employeeData);

            toast({ title: 'نجاح', description: 'تم حفظ الموظف بنجاح.' });
            router.push('/dashboard/hr');
        } catch (error) {
            console.error("Error adding employee: ", error);
            const errorMessage = error instanceof Error ? error.message : 'لم يتم حفظ الموظف. الرجاء المحاولة مرة أخرى.';
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };


    if (!isClient) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/4" />
                    <Skeleton className="h-4 w-1/2" />
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
                 <CardFooter className="flex justify-end">
                    <Skeleton className="h-10 w-28" />
                </CardFooter>
            </Card>
        )
    }

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
                                <Button variant="outline" size="sm">رفع صورة شخصية</Button>
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
                                <div className="grid gap-2">
                                    <Label htmlFor="maritalStatus">الحالة الاجتماعية</Label>
                                    <Select dir="rtl" value={formData.maritalStatus} onValueChange={(v) => handleSelectChange('maritalStatus', v)}>
                                        <SelectTrigger id="maritalStatus"><SelectValue placeholder="اختر..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="single">أعزب</SelectItem>
                                            <SelectItem value="married">متزوج</SelectItem>
                                            <SelectItem value="divorced">مطلق</SelectItem>
                                            <SelectItem value="widowed">أرمل</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="dependents">عدد أفراد العائلة</Label>
                                    <Input id="dependents" type="number" value={formData.dependents} onChange={handleInputChange} placeholder="0" />
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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="basicSalary">الراتب الأساسي <span className="text-destructive">*</span></Label>
                                <Input id="basicSalary" type="number" dir="ltr" value={formData.basicSalary} onChange={handleInputChange} placeholder="0.000" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="housingAllowance">بدل السكن</Label>
                                <Input id="housingAllowance" type="number" dir="ltr" value={formData.housingAllowance} onChange={handleInputChange} placeholder="0.000" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="transportAllowance">بدل النقل</Label>
                                <Input id="transportAllowance" type="number" dir="ltr" value={formData.transportAllowance} onChange={handleInputChange} placeholder="0.000" />
                            </div>
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
                                    <div className="grid gap-2 md:col-span-2">
                                        <Label htmlFor="iban">رقم الحساب الدولي (IBAN) <span className="text-destructive">*</span></Label>
                                        <Input id="iban" value={formData.iban} onChange={handleInputChange} placeholder="KWXXXXXXXXXXXXXXXXXXXXXXXXXX" dir="ltr" required={formData.salaryPaymentType === 'transfer'} />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                    <Button type="submit" disabled={isLoading}>
                        <Save className="ml-2 h-4 w-4" />
                        {isLoading ? 'جاري الحفظ...' : 'حفظ الموظف'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}

    