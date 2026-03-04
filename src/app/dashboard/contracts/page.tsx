'use client';

import React from 'react';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, FileText, ArrowRightLeft, FileSignature } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

/**
 * صفحة العقود المبرمة (مركز العمليات):
 * تم تنظيف الصفحة من مكتبة القوالب (Templates) بناءً على طلب المستخدم،
 * حيث تدار القوالب الآن من قسم الإعدادات / القوائم المرجعية.
 * الصفحة الآن مخصصة فقط لبدء مسار التعاقد (عرض سعر أو عقد مباشر).
 */
export default function ContractsPage() {
  return (
    <div className="space-y-8" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* مسار عرض السعر */}
          <Card className="rounded-[2rem] border-none shadow-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white overflow-hidden group hover:scale-[1.02] transition-transform">
              <CardHeader className="relative z-10">
                  <div className="flex justify-between items-start">
                      <div className="p-3 bg-white/20 rounded-2xl"><FileText className="h-8 w-8" /></div>
                      <Badge variant="outline" className="text-white border-white/40">المسار المالي المرن</Badge>
                  </div>
                  <CardTitle className="text-2xl font-black mt-4">إنشاء عرض سعر</CardTitle>
                  <CardDescription className="text-blue-100 font-bold">للمشاريع التي تتطلب تفاوضاً مالياً ومراجعة من المالك قبل التعاقد.</CardDescription>
              </CardHeader>
              <CardFooter className="relative z-10 pt-0 pb-8">
                  <Button asChild className="w-full h-12 bg-white text-blue-700 hover:bg-blue-50 font-black text-lg rounded-xl gap-2 shadow-lg">
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

          {/* مسار العقد المباشر */}
          <Card className="rounded-[2rem] border-none shadow-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white overflow-hidden group hover:scale-[1.02] transition-transform">
              <CardHeader className="relative z-10">
                  <div className="flex justify-between items-start">
                      <div className="p-3 bg-white/20 rounded-2xl"><FileSignature className="h-8 w-8" /></div>
                      <Badge variant="outline" className="text-white border-white/40">المسار القانوني الفوري</Badge>
                  </div>
                  <CardTitle className="text-2xl font-black mt-4">عقد مباشر (بدون عرض)</CardTitle>
                  <CardDescription className="text-emerald-100 font-bold">للتعاقد الفوري على المعاملات والخدمات المباشرة المتفق عليها مسبقاً.</CardDescription>
              </CardHeader>
              <CardFooter className="relative z-10 pt-0 pb-8">
                  <Button asChild className="w-full h-12 bg-white text-emerald-700 hover:bg-emerald-50 font-black text-lg rounded-xl gap-2 shadow-lg">
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
    </div>
  )
}
