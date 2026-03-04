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
import { 
  PlusCircle, 
  FileText, 
  ArrowRightLeft, 
  FileSignature, 
  Search, 
  Filter, 
  LayoutGrid,
  ClipboardList
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export default function UnifiedContractsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [contractNo, setContractNo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [activeTab, setActiveTab] = useState('signed-contracts');

  return (
    <div className="min-h-full -m-8 p-8 bg-[#F8F9FE]" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* --- بطاقات المسارات السريعة (تغيير الألوان لتناسب الهوية الجديدة) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className={cn(
                "relative rounded-[2.5rem] border-none shadow-xl overflow-hidden transition-all cursor-pointer group",
                activeTab === 'quotations' ? "bg-[#2E5BCC] ring-4 ring-[#2E5BCC]/20" : "bg-white border-2 border-dashed border-gray-200"
            )} onClick={() => setActiveTab('quotations')}>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div className={cn("p-3 rounded-2xl", activeTab === 'quotations' ? "bg-white/20" : "bg-[#2E5BCC]/10")}>
                            <FileText className={cn("h-8 w-8", activeTab === 'quotations' ? "text-white" : "text-[#2E5BCC]")} />
                        </div>
                        <Button asChild size="sm" variant="ghost" className={cn("rounded-full font-bold", activeTab === 'quotations' ? "text-white hover:bg-white/10" : "text-[#2E5BCC]")}>
                            <Link href="/dashboard/accounting/quotations/new">جديد +</Link>
                        </Button>
                    </div>
                    <CardTitle className={cn("text-2xl font-black mt-4", activeTab === 'quotations' ? "text-white" : "text-gray-800")}>عروض الأسعار</CardTitle>
                    <CardDescription className={cn(activeTab === 'quotations' ? "text-blue-50" : "text-gray-500")}>المسار المرن للمشاريع التي تتطلب تفاوضاً.</CardDescription>
                </CardHeader>
            </Card>

            <Card className={cn(
                "relative rounded-[2.5rem] border-none shadow-xl overflow-hidden transition-all cursor-pointer group",
                activeTab === 'signed-contracts' ? "bg-[#14453D] ring-4 ring-[#14453D]/20" : "bg-white border-2 border-dashed border-gray-200"
            )} onClick={() => setActiveTab('signed-contracts')}>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div className={cn("p-3 rounded-2xl", activeTab === 'signed-contracts' ? "bg-white/20" : "bg-[#14453D]/10")}>
                            <FileSignature className={cn("h-8 w-8", activeTab === 'signed-contracts' ? "text-white" : "text-[#14453D]")} />
                        </div>
                        <Button asChild size="sm" variant="ghost" className={cn("rounded-full font-bold", activeTab === 'signed-contracts' ? "text-white hover:bg-white/10" : "text-[#14453D]")}>
                            <Link href="/dashboard/contracts/new">جديد +</Link>
                        </Button>
                    </div>
                    <CardTitle className={cn("text-2xl font-black mt-4", activeTab === 'signed-contracts' ? "text-white" : "text-gray-800")}>العقود الموقعة</CardTitle>
                    <CardDescription className={cn(activeTab === 'signed-contracts' ? "text-emerald-50" : "text-gray-500")}>المسار الفوري للتعاقد المباشر والاعتمادات المالية.</CardDescription>
                </CardHeader>
            </Card>
        </div>

        {/* --- منطقة الفلاتر والجدول الموحد --- */}
        <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-muted/10 border-b pb-8 px-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-xl text-primary">
                          {activeTab === 'quotations' ? <FileText className="h-6 w-6"/> : <FileSignature className="h-6 w-6"/>}
                      </div>
                      <div>
                          <CardTitle className="text-2xl font-black text-gray-800">
                              {activeTab === 'quotations' ? 'سجل عروض الأسعار' : 'سجل العقود الموقعة'}
                          </CardTitle>
                          <CardDescription className="text-base font-medium">متابعة كافة المستندات {activeTab === 'quotations' ? 'المقترحة' : 'القانونية'} للعملاء.</CardDescription>
                      </div>
                  </div>

                  {/* واجهة البحث الذكية */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-white/50 p-4 rounded-2xl border shadow-inner">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-50"/>
                        <Input 
                            placeholder="الاسم أو الهاتف..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white rounded-xl h-10 shadow-sm border-gray-100 pr-4 pl-10"
                        />
                      </div>
                      <Input 
                          placeholder="رقم المستند..." 
                          value={contractNo}
                          onChange={(e) => setContractNo(e.target.value)}
                          className="bg-white rounded-xl h-10 font-mono shadow-sm border-gray-100"
                      />
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="bg-white rounded-xl h-10 shadow-sm border-gray-100">
                            <SelectValue placeholder="الحالة..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="all">كل الحالات</SelectItem>
                            {activeTab === 'quotations' ? (
                                <>
                                    <SelectItem value="draft">مسودة</SelectItem>
                                    <SelectItem value="sent">تم الإرسال</SelectItem>
                                    <SelectItem value="accepted">مقبول</SelectItem>
                                    <SelectItem value="rejected">مرفوض</SelectItem>
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
                          <DateInput value={dateFrom} onChange={setDateFrom} className="flex-1 shadow-sm rounded-xl h-10 text-[10px]" />
                          <DateInput value={dateTo} onChange={setDateTo} className="flex-1 shadow-sm rounded-xl h-10 text-[10px]" />
                      </div>
                  </div>
              </div>
          </CardHeader>
          
          <CardContent className="p-8">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                  <TabsContent value="quotations" className="animate-in fade-in zoom-in-95 duration-300 m-0">
                      <QuotationsList 
                        searchQuery={searchQuery} 
                        dateFrom={dateFrom} 
                        dateTo={dateTo} 
                        statusFilter={statusFilter}
                      />
                  </TabsContent>
                  <TabsContent value="signed-contracts" className="animate-in fade-in zoom-in-95 duration-300 m-0">
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
