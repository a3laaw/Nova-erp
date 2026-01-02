
'use client';
import { useState } from 'react';
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
import { z } from 'zod';
import type { Employee } from '@/lib/types';


// In a real app, this would use react-hook-form and Zod for validation
export default function NewEmployeePage() {
    const [contractType, setContractType] = useState<Employee['contractType'] | ''>('');
    const [salaryPaymentType, setSalaryPaymentType] = useState<Employee['salaryPaymentType'] | ''>('');

    return (
        <Card dir="rtl">
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
                                <Label htmlFor="nameAr">الاسم بالعربية</Label>
                                <Input id="nameAr" placeholder="مثال: علياء العامري" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="nameEn">الاسم بالإنجليزية</Label>
                                <Input id="nameEn" placeholder="e.g. Alyaa Alameri" dir="ltr" required />
                            </div>
                             <div className="grid gap-2">
                                <Label htmlFor="dob">تاريخ الميلاد</Label>
                                <Input id="dob" type="date" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="gender">النوع</Label>
                                <Select dir="rtl" required>
                                    <SelectTrigger id="gender"><SelectValue placeholder="اختر..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">ذكر</SelectItem>
                                        <SelectItem value="female">أنثى</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="maritalStatus">الحالة الاجتماعية</Label>
                                <Select dir="rtl">
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
                                <Input id="dependents" type="number" placeholder="0" />
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
                            <Label htmlFor="civilId">الرقم المدني</Label>
                            <Input id="civilId" placeholder="12-digit number" dir="ltr" maxLength={12} required />
                        </div>
                         <div className="grid gap-2">
                            <Label htmlFor="visaType">نوع الإقامة / التأشيرة</Label>
                            <Select dir="rtl" required>
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
                        <div className="grid gap-2">
                            <Label htmlFor="residencyExpiry">تاريخ انتهاء الإقامة</Label>
                            <Input id="residencyExpiry" type="date" required />
                        </div>
                    </div>
                </div>

                 <Separator />

                {/* Contact Info */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2">معلومات الاتصال</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="mobile">رقم الجوال</Label>
                            <Input id="mobile" dir="ltr" placeholder="+965 XXXX XXXX" required />
                        </div>
                         <div className="grid gap-2">
                            <Label htmlFor="emergencyContact">رقم طوارئ</Label>
                            <Input id="emergencyContact" dir="ltr" placeholder="+965 XXXX XXXX" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">البريد الإلكتروني</Label>
                            <Input id="email" type="email" dir="ltr" placeholder="employee@example.com" />
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Employment Info */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2">معلومات التوظيف والعقد</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div className="grid gap-2">
                            <Label htmlFor="department">القسم</Label>
                            <Input id="department" placeholder="e.g., هندسة, محاسبة" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="jobTitle">الوظيفة</Label>
                            <Input id="jobTitle" placeholder="e.g., مهندس مدني, محاسب عام" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="position">المنصب</Label>
                            <Select dir="rtl" required>
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
                            <Label htmlFor="hireDate">تاريخ التعيين</Label>
                            <Input id="hireDate" type="date" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="contractType">نوع العقد</Label>
                            <Select dir="rtl" onValueChange={(v) => setContractType(v as Employee['contractType'])} required>
                                <SelectTrigger id="contractType"><SelectValue placeholder="اختر..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="permanent">دائم</SelectItem>
                                    <SelectItem value="temporary">مؤقت</SelectItem>
                                    <SelectItem value="subcontractor">متعهّد</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {(contractType === 'temporary' || contractType === 'subcontractor') && (
                            <div className="grid gap-2">
                                <Label htmlFor="contractExpiry">تاريخ انتهاء العقد</Label>
                                <Input id="contractExpiry" type="date" required />
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
                            <Label htmlFor="basicSalary">الراتب الأساسي</Label>
                            <Input id="basicSalary" type="number" dir="ltr" placeholder="0.000" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="housingAllowance">بدل السكن</Label>
                            <Input id="housingAllowance" type="number" dir="ltr" placeholder="0.000" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="transportAllowance">بدل النقل</Label>
                            <Input id="transportAllowance" type="number" dir="ltr" placeholder="0.000" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="salaryPaymentType">نوع الراتب</Label>
                            <Select dir="rtl" onValueChange={(v) => setSalaryPaymentType(v as Employee['salaryPaymentType'])}>
                                <SelectTrigger id="salaryPaymentType"><SelectValue placeholder="اختر..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="transfer">تحويل بنكي</SelectItem>
                                    <SelectItem value="cheque">شيك</SelectItem>
                                    <SelectItem value="cash">كاش</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {salaryPaymentType === 'transfer' && (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="bankName">اسم البنك</Label>
                                     <Select dir="rtl" >
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
                                    <Label htmlFor="iban">رقم الحساب الدولي (IBAN)</Label>
                                    <Input id="iban" placeholder="KWXXXXXXXXXXXXXXXXXXXXXXXXXX" dir="ltr" required />
                                </div>
                            </>
                        )}
                    </div>
                </div>

            </CardContent>
            <CardFooter className="flex justify-end">
                <Button>
                    <Save className="ml-2 h-4 w-4" />
                    حفظ الموظف
                </Button>
            </CardFooter>
        </Card>
    );
}
