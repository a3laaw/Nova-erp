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
import { Label } from '@/components/ui/label';
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

export default function UnifiedContractsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [contractNo, setContractNo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [activeTab, setActiveTab] = useState('signed-contracts');

  return (
    <div className="min-h-full -m-8 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* --- البطاقات التفاعلية (تبويبات) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card 
                className={cn(
                    "relative rounded-[2.5rem] border-none shadow-xl overflow-hidden transition-all duration-500 cursor-pointer group",
                    activeTab === 'quotations' 
                        ? "bg-[#2E5BCC] ring-8 ring-[#2E5BCC]/10 -translate-y-2" 
                        : "bg-white border-2 border-dashed border-gray-200 opacity-80 hover:opacity-100"
                )} 
                onClick={() => setActiveTab('quotations')}
            >
                <CardHeader className="relative z-10 p-8">
                    <div className="flex justify-between items-start">
                        <div className={cn("p-4 rounded-2xl transition-colors", activeTab === 'quotations' ? "bg-white/20" : "bg-[#2E5BCC]/10")}>
                            <FileText className={cn("h-8 w-8", activeTab === 'quotations' ? "text-white" : "text-[#2E5BCC]")} />
                        </div>
                        {activeTab !== 'quotations' && (
                            <Badge variant="secondary" className="bg-[#2E5BCC]/10 text-[#2E5BCC] font-black">المسار المرن</Badge>
                        )}
                    </div>
                    <CardTitle className={cn("text-3xl font-black mt-6 transition-colors", activeTab === 'quotations' ? "text-white" : "text-gray-800")}>
                        عروض الأسعار
                    </CardTitle>
                    <CardDescription className={cn("text-base font-medium mt-2 transition-colors", activeTab === 'quotations' ? "text-blue-50" : "text-gray-500")}>
                        إدارة المسودات والمقترحات المالية للمشاريع الجديدة.
                    </CardDescription>
                    <div className="mt-8">
                        <Button asChild className={cn("w-full h-12 rounded-xl font-black text-lg gap-2 shadow-lg", activeTab === 'quotations' ? "bg-white text-[#2E5BCC] hover:bg-blue-50" : "bg-[#2E5BCC] text-white")}>
                            <Link href="/dashboard/accounting/quotations/new">
                                إنشاء عرض سعر جديد +
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card 
                className={cn(
                    "relative rounded-[2.5rem] border-none shadow-xl overflow-hidden transition-all duration-500 cursor-pointer group",
                    activeTab === 'signed-contracts' 
                        ? "bg-[#14453D] ring-8 ring-[#14453D]/10 -translate-y-2" 
                        : "bg-white border-2 border-dashed border-gray-200 opacity-80 hover:opacity-100"
                )} 
                onClick={() => setActiveTab('signed-contracts')}
            >
                <CardHeader className="relative z-10 p-8">
                    <div className="flex justify-between items-start">
                        <div className={cn("p-4 rounded-2xl transition-colors", activeTab === 'signed-contracts' ? "bg-white/20" : "bg-[#14453D]/10")}>
                            <FileSignature className={cn("h-8 w-8", activeTab === 'signed-contracts' ? "text-white" : "text-[#14453D]")} />
                        </div>
                        {activeTab !== 'signed-contracts' && (
                            <Badge variant="secondary" className="bg-[#14453D]/10 text-[#14453D] font-black">المسار القانوني</Badge>
                        )}
                    </div>
                    <CardTitle className={cn("text-3xl font-black mt-6 transition-colors", activeTab === 'signed-contracts' ? "text-white" : "text-gray-800")}>
                        العقود الموقعة
                    </CardTitle>
                    <CardDescription className={cn("text-base font-medium mt-2 transition-colors", activeTab === 'signed-contracts' ? "text-emerald-50" : "text-gray-500")}>
                        التعاقد المباشر وإثبات المديونيات المالية واللوجستية.
                    </CardDescription>
                    <div className="mt-8">
                        <Button asChild className={cn("w-full h-12 rounded-xl font-black text-lg gap-2 shadow-lg", activeTab === 'signed-contracts' ? "bg-white text-[#14453D] hover:bg-emerald-50" : "bg-[#14453D] text-white")}>
                            <Link href="/dashboard/contracts/new">
                                توقيع عقد مباشر فوري +
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>
        </div>

        {/* --- منطقة الفلاتر والجدول --- */}
        <Card className="rounded-[3rem] border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/10 border-b pb-8 px-8">
              <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                  <div className="flex items-center gap-4">
                      <div className={cn("p-3 rounded-2xl", activeTab === 'quotations' ? "bg-[#2E5BCC]/10 text-[#2E5BCC]" : "bg-[#14453D]/10 text-[#14453D]")}>
                          <LayoutGrid className="h-7 w-7"/>
                      </div>
                      <div>
                          <CardTitle className="text-2xl font-black text-gray-800">
                              {activeTab === 'quotations' ? 'سجل عروض الأسعار' : 'سجل العقود الموقعة'}
                          </CardTitle>
                          <CardDescription className="text-base font-medium">قائمة تفصيلية بكافة المستندات المبرمة.</CardDescription>
                      </div>
                  </div>

                  {/* واجهة الفلاتر السداسية */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-3xl border shadow-inner w-full lg:w-auto">
                      <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40 group-focus-within:opacity-100 transition-opacity"/>
                        <Input 
                            placeholder="الاسم أو الهاتف..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white rounded-xl h-11 shadow-sm border-gray-100 pr-4 pl-10 font-bold"
                        />
                      </div>
                      <Input 
                          placeholder="رقم المستند..." 
                          value={contractNo}
                          onChange={(e) => setContractNo(e.target.value)}
                          className="bg-white rounded-xl h-11 font-mono shadow-sm border-gray-100 font-bold"
                      />
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="bg-white rounded-xl h-11 shadow-sm border-gray-100 font-bold">
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
                          <DateInput value={dateFrom} onChange={setDateFrom} className="flex-1 shadow-sm rounded-xl h-11 text-xs" />
                          <DateInput value={dateTo} onChange={setDateTo} className="flex-1 shadow-sm rounded-xl h-11 text-xs" />
                      </div>
                  </div>
              </div>
          </CardHeader>
          
          <CardContent className="p-8">
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