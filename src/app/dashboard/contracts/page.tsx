'use client';

import React, { useState } from 'react';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  FileSignature, 
  Search, 
  LayoutGrid
} from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { ConstructionContractsList } from '@/components/construction/construction-contracts-list';
import { QuotationsList } from '@/components/accounting/quotations-list';
import { DateInput } from '@/components/ui/date-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useAppTheme } from '@/context/theme-context';

export default function UnifiedContractsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [contractNo, setContractNo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [activeTab, setActiveTab] = useState('signed-contracts');
  const { theme } = useAppTheme();
  const isGlass = theme === 'glass';

  return (
    <div className="min-h-full -m-8 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* --- البطاقات التفاعلية (تبويبات زجاجية متباينة) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* تاب عروض الأسعار */}
            <Card 
                className={cn(
                    "relative rounded-[3rem] border-none transition-all duration-500 cursor-pointer group overflow-hidden",
                    activeTab === 'quotations' 
                        ? "glass-effect bg-blue-500/20 border-blue-400/50 shadow-[0_20px_50px_rgba(46,91,204,0.3)] -translate-y-3 ring-2 ring-blue-400/30 scale-100" 
                        : "glass-effect opacity-40 hover:opacity-80 scale-[0.97] grayscale-[0.4] border-transparent"
                )} 
                onClick={() => setActiveTab('quotations')}
            >
                {/* توهج خلفي للتاب المختار */}
                {activeTab === 'quotations' && (
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/20 blur-[80px] rounded-full" />
                )}
                
                <CardHeader className="relative z-10 p-10">
                    <div className="flex justify-between items-start">
                        <div className={cn(
                            "p-4 rounded-2xl transition-all duration-500", 
                            activeTab === 'quotations' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/40" : "bg-slate-200/50 text-slate-500"
                        )}>
                            <FileText className="h-8 w-8" />
                        </div>
                        {activeTab === 'quotations' && (
                            <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 font-black animate-pulse border-blue-200">المسار النشط</Badge>
                        )}
                    </div>
                    <CardTitle className={cn(
                        "text-3xl font-black mt-8 transition-all duration-500", 
                        activeTab === 'quotations' ? "text-blue-900" : "text-slate-400"
                    )}>
                        عروض الأسعار
                    </CardTitle>
                    <CardDescription className={cn(
                        "text-base font-medium mt-2 transition-all duration-500", 
                        activeTab === 'quotations' ? "text-blue-800/70" : "text-slate-400/60"
                    )}>
                        إدارة المقترحات الفنية والمالية بلمسات زجاجية.
                    </CardDescription>
                    <div className="mt-10">
                        <Button asChild className={cn(
                            "w-full h-14 rounded-2xl font-black text-lg gap-2 shadow-xl transition-all duration-500", 
                            activeTab === 'quotations' ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-300/50 text-slate-500 pointer-events-none"
                        )}>
                            <Link href="/dashboard/accounting/quotations/new">
                                إنشاء عرض سعر جديد +
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            {/* تاب العقود الموقعة */}
            <Card 
                className={cn(
                    "relative rounded-[3rem] border-none transition-all duration-500 cursor-pointer group overflow-hidden",
                    activeTab === 'signed-contracts' 
                        ? "glass-effect bg-emerald-500/20 border-emerald-400/50 shadow-[0_20px_50px_rgba(20,69,61,0.3)] -translate-y-3 ring-2 ring-emerald-400/30 scale-100" 
                        : "glass-effect opacity-40 hover:opacity-80 scale-[0.97] grayscale-[0.4] border-transparent"
                )} 
                onClick={() => setActiveTab('signed-contracts')}
            >
                {/* توهج خلفي للتاب المختار */}
                {activeTab === 'signed-contracts' && (
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/20 blur-[80px] rounded-full" />
                )}

                <CardHeader className="relative z-10 p-10">
                    <div className="flex justify-between items-start">
                        <div className={cn(
                            "p-4 rounded-2xl transition-all duration-500", 
                            activeTab === 'signed-contracts' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/40" : "bg-slate-200/50 text-slate-500"
                        )}>
                            <FileSignature className="h-8 w-8" />
                        </div>
                        {activeTab === 'signed-contracts' && (
                            <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700 font-black animate-pulse border-emerald-200">المسار النشط</Badge>
                        )}
                    </div>
                    <CardTitle className={cn(
                        "text-3xl font-black mt-8 transition-all duration-500", 
                        activeTab === 'signed-contracts' ? "text-emerald-900" : "text-slate-400"
                    )}>
                        العقود الموقعة
                    </CardTitle>
                    <CardDescription className={cn(
                        "text-base font-medium mt-2 transition-all duration-500", 
                        activeTab === 'signed-contracts' ? "text-emerald-800/70" : "text-slate-400/60"
                    )}>
                        تأسيس المشاريع الميدانية والربط المالي الصارم.
                    </CardDescription>
                    <div className="mt-10">
                        <Button asChild className={cn(
                            "w-full h-14 rounded-2xl font-black text-lg gap-2 shadow-xl transition-all duration-500", 
                            activeTab === 'signed-contracts' ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-300/50 text-slate-500 pointer-events-none"
                        )}>
                            <Link href="/dashboard/contracts/new">
                                توقيع عقد مباشر فوري +
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>
        </div>

        {/* --- منطقة الفلاتر والجدول (زجاجية موحدة) --- */}
        <Card className={cn(
            "rounded-[3rem] border-none shadow-2xl overflow-hidden",
            isGlass ? "glass-effect" : "bg-white"
        )}>
          <CardHeader className="bg-muted/10 border-b pb-8 px-10">
              <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                  <div className="flex items-center gap-4">
                      <div className={cn(
                          "p-3 rounded-2xl shadow-inner", 
                          activeTab === 'quotations' ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                      )}>
                          <LayoutGrid className="h-7 w-7"/>
                      </div>
                      <div>
                          <CardTitle className="text-2xl font-black text-gray-800">
                              {activeTab === 'quotations' ? 'سجل عروض الأسعار المبرمة' : 'سجل العقود التنفيذية'}
                          </CardTitle>
                          <CardDescription className="text-base font-bold opacity-60">مراجعة البيانات المالية والتواريخ المعتمدة.</CardDescription>
                      </div>
                  </div>

                  {/* واجهة الفلاتر الزجاجية */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-[2.5rem] border-2 border-dashed border-muted-foreground/10 bg-muted/5 w-full lg:w-auto">
                      <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40 group-focus-within:opacity-100 transition-opacity"/>
                        <Input 
                            placeholder="الاسم أو الهاتف..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white/80 rounded-xl h-11 border-none shadow-sm pr-4 pl-10 font-bold"
                        />
                      </div>
                      <Input 
                          placeholder="رقم المستند..." 
                          value={contractNo}
                          onChange={(e) => setContractNo(e.target.value)}
                          className="bg-white/80 rounded-xl h-11 font-mono shadow-sm border-none font-bold"
                      />
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="bg-white/80 rounded-xl h-11 shadow-sm border-none font-bold">
                            <SelectValue placeholder="الحالة..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="all">كل الحالات</SelectItem>
                            {activeTab === 'quotations' ? (
                                <>
                                    <SelectItem value="draft">مسودة</SelectItem>
                                    <SelectItem value="sent">تم الإرسال</SelectItem>
                                    <SelectItem value="accepted">مقبول</SelectItem>
                                </>
                            ) : (
                                <>
                                    <SelectItem value="in-progress">فعال</SelectItem>
                                    <SelectItem value="on-hold">متوقف</SelectItem>
                                    <SelectItem value="completed">مكتمل</SelectItem>
                                    <SelectItem value="cancelled">ملغي</SelectItem>
                                </>
                            )}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                          <DateInput value={dateFrom} onChange={setDateFrom} className="flex-1 shadow-sm rounded-xl h-11 text-xs border-none bg-white/80" />
                          <DateInput value={dateTo} onChange={setDateTo} className="flex-1 shadow-sm rounded-xl h-11 text-xs border-none bg-white/80" />
                      </div>
                  </div>
              </div>
          </CardHeader>
          
          <CardContent className="p-10">
              <Tabs value={activeTab} className="w-full">
                  <TabsContent value="quotations" className="animate-in fade-in zoom-in-95 duration-500 m-0">
                      <QuotationsList 
                        searchQuery={searchQuery} 
                        dateFrom={dateFrom} 
                        dateTo={dateTo} 
                        statusFilter={statusFilter}
                      />
                  </TabsContent>
                  <TabsContent value="signed-contracts" className="animate-in fade-in zoom-in-95 duration-500 m-0">
                      <ConstructionContractsList 
                          searchQuery={searchQuery}
                          contractNo={contractNo}
                          statusFilter={statusFilter}
                          dateFrom={dateFrom}
                          dateTo={dateTo}
                      />
                  </TabsContent>
              </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
