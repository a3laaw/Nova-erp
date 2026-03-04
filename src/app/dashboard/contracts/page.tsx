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
import { Separator } from '@/components/ui/separator';

/**
 * صفحة العقود الموقعة:
 * تم دمج البحث بالاسم والهاتف في خانة واحدة ذكية لسهولة الاستخدام.
 */
export default function ContractsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [contractNo, setContractNo] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  return (
    <div className="min-h-full -m-8 p-8 bg-[#F8F9FE]" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* مسارات العمل السريعة */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* المسار المرن - Modern Blue (#2E5BCC) */}
            <Card className="relative rounded-[2.5rem] border-none shadow-xl bg-gradient-to-br from-[#2E5BCC] to-[#1c46a8] text-white overflow-hidden group hover:scale-[1.01] transition-all">
                <CardHeader className="relative z-10">
                    <div className="flex justify-between items-start">
                        <div className="p-3 bg-white/20 rounded-2xl shadow-inner"><FileText className="h-8 w-8 text-white" /></div>
                        <Badge variant="outline" className="text-white border-white/40 font-bold px-3">المسار المرن</Badge>
                    </div>
                    <CardTitle className="text-2xl font-black mt-4 text-white">إنشاء عرض سعر</CardTitle>
                    <CardDescription className="text-blue-50 font-medium">للمشاريع التي تتطلب تفاوضاً مالياً ومراجعة من المالك قبل التعاقد.</CardDescription>
                </CardHeader>
                <CardFooter className="relative z-10 pt-0 pb-8">
                    <Button asChild className="w-full h-12 bg-white text-[#2E5BCC] hover:bg-blue-50 font-black text-lg rounded-xl gap-2 shadow-lg active:scale-95 transition-all">
                        <Link href="/dashboard/accounting/quotations/new">
                            ابدأ بإنشاء عرض سعر
                            <ArrowRightLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                </CardFooter>
                <div className="absolute -bottom-10 -right-10 opacity-10 rotate-12 pointer-events-none">
                    <FileText className="h-64 w-64" />
                </div>
            </Card>

            {/* المسار القانوني - Dark Emerald (#14453D) */}
            <Card className="relative rounded-[2.5rem] border-none shadow-xl bg-gradient-to-br from-[#14453D] to-[#0d2e29] text-white overflow-hidden group hover:scale-[1.01] transition-all">
                <CardHeader className="relative z-10">
                    <div className="flex justify-between items-start">
                        <div className="p-3 bg-white/20 rounded-2xl shadow-inner"><FileSignature className="h-8 w-8 text-white" /></div>
                        <Badge variant="outline" className="text-white border-white/40 font-bold px-3">المسار الفوري</Badge>
                    </div>
                    <CardTitle className="text-2xl font-black mt-4 text-white">عقد مباشر (بدون عرض)</CardTitle>
                    <CardDescription className="text-emerald-50 font-medium">للتعاقد الفوري على المعاملات والخدمات المباشرة المتفق عليها مسبقاً.</CardDescription>
                </CardHeader>
                <CardFooter className="relative z-10 pt-0 pb-8">
                    <Button asChild className="w-full h-12 bg-white text-[#14453D] hover:bg-emerald-50 font-black text-lg rounded-xl gap-2 shadow-lg active:scale-95 transition-all">
                        <Link href="/dashboard/contracts/new">
                            توقيع عقد مباشر الآن
                            <PlusCircle className="h-5 w-5" />
                        </Link>
                    </Button>
                </CardFooter>
                <div className="absolute -bottom-10 -right-10 opacity-10 rotate-12 pointer-events-none">
                    <FileSignature className="h-64 w-64" />
                </div>
            </Card>
        </div>

        {/* سجل العقود الموقعة */}
        <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-muted/10 border-b pb-8 px-8">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary"><FileSignature className="h-6 w-6"/></div>
                  <div>
                      <CardTitle className="text-2xl font-black text-gray-800">سجل العقود الموقعة</CardTitle>
                      <CardDescription className="text-base font-medium">متابعة كافة العقود القانونية والمالية المرتبطة بالعملاء.</CardDescription>
                  </div>
              </div>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
              {/* واجهة الفلاتر الموحدة */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-muted/20 p-8 rounded-[2rem] border-2 border-dashed border-gray-200">
                  <div className="grid gap-2 lg:col-span-1">
                      <Label className="font-bold flex items-center gap-2 text-gray-700">
                        بحث (الاسم أو الهاتف) <Search className="h-4 w-4 text-primary opacity-70"/>
                      </Label>
                      <Input 
                          placeholder="اكتب اسم العميل أو رقم هاتفه..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="bg-white rounded-xl h-11 shadow-sm border-gray-100 focus:shadow-md focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
                      />
                  </div>
                  <div className="grid gap-2">
                      <Label className="font-bold text-gray-700"># رقم العقد</Label>
                      <Input 
                          placeholder="رقم العقد..." 
                          value={contractNo}
                          onChange={(e) => setContractNo(e.target.value)}
                          className="bg-white rounded-xl h-11 font-mono shadow-sm border-gray-100 focus:shadow-md focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
                      />
                  </div>
                  <div className="grid gap-2 lg:col-span-2">
                      <Label className="font-bold flex items-center gap-2 text-gray-700">
                        <Calendar className="h-4 w-4 text-primary opacity-70"/> نطاق تاريخ العقد
                      </Label>
                      <div className="flex items-center gap-2">
                          <DateInput value={dateFrom} onChange={setDateFrom} className="flex-1 shadow-sm rounded-xl h-11" />
                          <span className="text-muted-foreground text-xs font-bold">إلى</span>
                          <DateInput value={dateTo} onChange={setDateTo} className="flex-1 shadow-sm rounded-xl h-11" />
                      </div>
                  </div>
              </div>

              {/* الجدول الزمني للعقود */}
              <ConstructionContractsList 
                  searchQuery={searchQuery}
                  contractNo={contractNo}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
              />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
