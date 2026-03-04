
'use client';

import React, { useState } from 'react';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, FileText, ArrowRightLeft, FileSignature, Search, Phone, User, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConstructionContractsList } from '@/components/construction/construction-contracts-list';
import { DateInput } from '@/components/ui/date-input';

/**
 * صفحة العقود المبرمة (مركز العمليات):
 * تم تحديث الألوان لتعكس الهوية الجديدة (Emerald Green & Steel Blue).
 */
export default function ContractsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [contractNo, setContractNo] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  return (
    <div className="space-y-10" dir="rtl">
      {/* مسارات العمل السريعة */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* المسار المرن - Steel Blue / Indigo */}
          <Card className="relative rounded-[2rem] border-none shadow-xl bg-gradient-to-br from-[#3F51B5] to-[#283593] text-white overflow-hidden group hover:scale-[1.02] transition-transform">
              <CardHeader className="relative z-10">
                  <div className="flex justify-between items-start">
                      <div className="p-3 bg-white/20 rounded-2xl"><FileText className="h-8 w-8" /></div>
                      <Badge variant="outline" className="text-white border-white/40">المسار المالي المرن</Badge>
                  </div>
                  <CardTitle className="text-2xl font-black mt-4">إنشاء عرض سعر</CardTitle>
                  <CardDescription className="text-blue-50 font-bold">للمشاريع التي تتطلب تفاوضاً مالياً ومراجعة من المالك قبل التعاقد.</CardDescription>
              </CardHeader>
              <CardFooter className="relative z-10 pt-0 pb-8">
                  <Button asChild className="w-full h-12 bg-white text-[#3F51B5] hover:bg-blue-50 font-black text-lg rounded-xl gap-2 shadow-lg">
                      <Link href="/dashboard/accounting/quotations/new">
                          ابدأ بإنشاء عرض سعر
                          <ArrowRightLeft className="h-5 w-5 rtl:rotate-180" />
                      </Link>
                  </Button>
              </CardFooter>
              <div className="absolute -bottom-10 -right-10 opacity-10 rotate-12 group-hover:scale-110 transition-transform">
                  <FileText className="h-64 w-64" />
              </div>
          </Card>

          {/* المسار القانوني - Emerald Green */}
          <Card className="relative rounded-[2rem] border-none shadow-xl bg-gradient-to-br from-[#1B4D3E] to-[#0D2E24] text-white overflow-hidden group hover:scale-[1.02] transition-transform">
              <CardHeader className="relative z-10">
                  <div className="flex justify-between items-start">
                      <div className="p-3 bg-white/20 rounded-2xl"><FileSignature className="h-8 w-8" /></div>
                      <Badge variant="outline" className="text-white border-white/40">المسار القانوني الفوري</Badge>
                  </div>
                  <CardTitle className="text-2xl font-black mt-4">عقد مباشر (بدون عرض)</CardTitle>
                  <CardDescription className="text-emerald-50 font-bold">للتعاقد الفوري على المعاملات والخدمات المباشرة المتفق عليها مسبقاً.</CardDescription>
              </CardHeader>
              <CardFooter className="relative z-10 pt-0 pb-8">
                  <Button asChild className="w-full h-12 bg-white text-[#1B4D3E] hover:bg-emerald-50 font-black text-lg rounded-xl gap-2 shadow-lg">
                      <Link href="/dashboard/contracts/new">
                          توقيع عقد مباشر الآن
                          <PlusCircle className="h-5 w-5" />
                      </Link>
                  </Button>
              </CardFooter>
              <div className="absolute -bottom-10 -right-10 opacity-10 rotate-12 group-hover:scale-110 transition-transform">
                  <FileSignature className="h-64 w-64" />
              </div>
          </Card>
      </div>

      {/* سجل العقود الموقعة */}
      <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-card">
        <CardHeader className="bg-muted/10 border-b pb-8 px-8">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary"><FileSignature className="h-6 w-6"/></div>
                <div>
                    <CardTitle className="text-2xl font-black">سجل العقود الموقعة</CardTitle>
                    <CardDescription className="text-base font-medium">متابعة كافة العقود القانونية والمالية المرتبطة بالعملاء.</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
            {/* واجهة الفلاتر المتقدمة */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 bg-muted/30 p-6 rounded-3xl border-2 border-dashed">
                <div className="grid gap-2">
                    <Label className="font-bold flex items-center gap-2"><User className="h-3.5 w-3.5 text-primary"/> اسم العميل</Label>
                    <Input 
                        placeholder="ابحث بالاسم..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-background rounded-xl h-10 shadow-sm"
                    />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-primary"/> رقم الهاتف</Label>
                    <Input 
                        placeholder="ابحث بالجوال..." 
                        value={phoneQuery}
                        onChange={(e) => setPhoneQuery(e.target.value)}
                        className="bg-background rounded-xl h-10 shadow-sm"
                        dir="ltr"
                    />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold flex items-center gap-2"># رقم العقد</Label>
                    <Input 
                        placeholder="رقم العقد..." 
                        value={contractNo}
                        onChange={(e) => setContractNo(e.target.value)}
                        className="bg-background rounded-xl h-10 font-mono shadow-sm"
                    />
                </div>
                <div className="grid gap-2 lg:col-span-2">
                    <Label className="font-bold flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-primary"/> نطاق تاريخ العقد</Label>
                    <div className="flex items-center gap-2">
                        <DateInput value={dateFrom} onChange={setDateFrom} className="flex-1 shadow-sm" />
                        <span className="text-muted-foreground">إلى</span>
                        <DateInput value={dateTo} onChange={setDateTo} className="flex-1 shadow-sm" />
                    </div>
                </div>
            </div>

            {/* الجدول الزمني للعقود */}
            <ConstructionContractsList 
                searchQuery={searchQuery}
                phoneQuery={phoneQuery}
                contractNo={contractNo}
                dateFrom={dateFrom}
                dateTo={dateTo}
            />
        </CardContent>
      </Card>
    </div>
  )
}
