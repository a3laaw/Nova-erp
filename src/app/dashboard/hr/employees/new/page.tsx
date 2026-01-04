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
import { addDoc, collection, serverTimestamp, type DocumentData } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

// دالة مساعدة لتحويل التاريخ بأمان
const safeDateToISO = (dateString: string | null | undefined): string | null => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date.toISOString();
};

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
      toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات.' });
      return;
    }
    setIsLoading(true);
    
    try {
      // --- التحقق من الحقول المطلوبة ---
      const requiredFields: (keyof Employee)[] = ['fullName', 'nameEn', 'civilId', 'mobile', 'department', 'jobTitle', 'hireDate'];
      for (const field of requiredFields) {
        if (!formData[field]) {
          toast({ variant: 'destructive', title: 'حقل مطلوب', description: `الرجاء تعبئة "${field}"` });
          setIsLoading(false);
          return;
        }
      }

      // --- التحقق من صلاحية تاريخ التعيين ---
      if (formData.hireDate && isNaN(new Date(formData.hireDate).getTime())) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'تاريخ التعيين غير صالح.' });
        setIsLoading(false);
        return;
      }

      if (formData.salaryPaymentType === 'transfer' && !formData.iban) {
        toast({ variant: 'destructive', title: 'IBAN مطلوب', description: 'يرجى إدخال رقم الحساب الدولي.' });
        setIsLoading(false);
        return;
      }

      // --- بناء كائن الموظف ---
      const employeeData: DocumentData = {
        fullName: formData.fullName,
        nameEn: formData.nameEn,
        civilId: formData.civilId,
        mobile: formData.mobile,
        department: formData.department,
        jobTitle: formData.jobTitle,
        hireDate: safeDateToISO(formData.hireDate),
        contractType: formData.contractType || 'permanent',
        basicSalary: Number(formData.basicSalary) || 0,
        status: 'active',
        createdAt: serverTimestamp(),

        // الحقول الاختيارية
        dob: safeDateToISO(formData.dob),
        residencyExpiry: safeDateToISO(formData.residencyExpiry),
        contractExpiry: safeDateToISO(formData.contractExpiry),
        gender: formData.gender || null,
        maritalStatus: formData.maritalStatus || null,
        dependents: Number(formData.dependents) || 0,
        visaType: formData.visaType || null,
        emergencyContact: formData.emergencyContact || null,
        email: formData.email || null,
        position: formData.position || null,
        housingAllowance: Number(formData.housingAllowance) || 0,
        transportAllowance: Number(formData.transportAllowance) || 0,
        salaryPaymentType: formData.salaryPaymentType || null,
        bankName: formData.bankName || null,
        iban: formData.iban || null,

        // إعدادات الإجازات
        terminationDate: null,
        terminationReason: null,
        annualLeaveAccrued: 0,
        annualLeaveUsed: 0,
        carriedLeaveDays: 0,
        sickLeaveUsed: 0,
        emergencyLeaveUsed: 0,
        maxEmergencyLeave: 5,
        lastVacationAccrualDate: safeDateToISO(formData.hireDate),
        lastLeaveResetDate: safeDateToISO(formData.hireDate),
      };

      await addDoc(collection(firestore, 'employees'), employeeData);
      toast({ title: 'نجاح', description: 'تم حفظ الموظف بنجاح.' });
      router.push('/dashboard/hr');

    } catch (error) {
      console.error("Employee save error:", error);
      toast({ 
        variant: 'destructive', 
        title: 'خطأ في الحفظ', 
        description: 'يرجى التأكد من صحة التواريخ ومحاولة مرة أخرى.' 
      });
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
    );
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
                <Button type="button" variant="outline" size="sm">رفع صورة شخصية</Button>
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
                  <Label htmlFor="civilId">الرقم المدني <span className="text-destructive">*</span></Label>
                  <Input id="civilId" value={formData.civilId} onChange={handleInputChange} placeholder="12345678" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gender">النوع</Label>
                  <Select value={formData.gender ?? ''} onValueChange={(value) => handleSelectChange('gender', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر النوع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">ذكر</SelectItem>
                      <SelectItem value="female">أنثى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="maritalStatus">الحالة الاجتماعية</Label>
                  <Select value={formData.maritalStatus ?? ''} onValueChange={(value) => handleSelectChange('maritalStatus', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">أعزب</SelectItem>
                      <SelectItem value="married">متزوج</SelectItem>
                      <SelectItem value="divorced">مطلق</SelectItem>
                      <SelectItem value="widowed">أرمل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Employment Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">بيانات التوظيف</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="department">القسم <span className="text-destructive">*</span></Label>
                <Input id="department" value={formData.department} onChange={handleInputChange} placeholder="هندسة، محاسبة، ..." required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jobTitle">الوظيفة <span className="text-destructive">*</span></Label>
                <Input id="jobTitle" value={formData.jobTitle} onChange={handleInputChange} placeholder="مهندس معماري، محاسب، ..." required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="position">المنصب</Label>
                <Select value={formData.position ?? ''} onValueChange={(value) => handleSelectChange('position', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المنصب" />
                  </SelectTrigger>
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
                <Select value={formData.contractType ?? 'permanent'} onValueChange={(value) => handleSelectChange('contractType', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">دائم</SelectItem>
                    <SelectItem value="temporary">مؤقت</SelectItem>
                    <SelectItem value="subcontractor">متعهّد</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contractExpiry">تاريخ انتهاء العقد</Label>
                <Input id="contractExpiry" type="date" value={formData.contractExpiry} onChange={handleInputChange} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Residency & Contact */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">الإقامة وبيانات الاتصال</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="visaType">نوع الإقامة</Label>
                <Select value={formData.visaType ?? 'kuwaiti'} onValueChange={(value) => handleSelectChange('visaType', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kuwaiti">كويتي</SelectItem>
                    <SelectItem value="engineer">مهندس</SelectItem>
                    <SelectItem value="worker">عامل</SelectItem>
                    <SelectItem value="driver">سائق</SelectItem>
                    <SelectItem value="admin">إداري</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="residencyExpiry">تاريخ انتهاء الإقامة</Label>
                <Input id="residencyExpiry" type="date" value={formData.residencyExpiry} onChange={handleInputChange} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mobile">رقم الجوال <span className="text-destructive">*</span></Label>
                <Input id="mobile" value={formData.mobile} onChange={handleInputChange} placeholder="965123456" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="emergencyContact">رقم طوارئ</Label>
                <Input id="emergencyContact" value={formData.emergencyContact} onChange={handleInputChange} placeholder="965987654" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="email@example.com" dir="ltr" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Salary Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">بيانات الراتب</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="basicSalary">الراتب الأساسي <span className="text-destructive">*</span></Label>
                <Input id="basicSalary" type="number" value={formData.basicSalary} onChange={handleInputChange} placeholder="400" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="housingAllowance">بدل السكن</Label>
                <Input id="housingAllowance" type="number" value={formData.housingAllowance} onChange={handleInputChange} placeholder="100" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="transportAllowance">بدل المواصلات</Label>
                <Input id="transportAllowance" type="number" value={formData.transportAllowance} onChange={handleInputChange} placeholder="50" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="salaryPaymentType">نوع الراتب</Label>
                <Select value={formData.salaryPaymentType ?? ''} onValueChange={(value) => handleSelectChange('salaryPaymentType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر نوع الدفع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">كاش</SelectItem>
                    <SelectItem value="cheque">شيك</SelectItem>
                    <SelectItem value="transfer">تحويل بنكي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.salaryPaymentType === 'transfer' && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="bankName">اسم البنك</Label>
                    <Input id="bankName" value={formData.bankName} onChange={handleInputChange} placeholder="البنك الوطني" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="iban">IBAN <span className="text-destructive">*</span></Label>
                    <Input id="iban" value={formData.iban} onChange={handleInputChange} placeholder="KWXX..." required />
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2" dir="ltr">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            إلغاء
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'جاري الحفظ...' : 'حفظ الموظف'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
