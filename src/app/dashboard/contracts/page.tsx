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
  LayoutGrid,
  PlusCircle
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
  TabsList,
  TabsTrigger,
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
    <div className="space-y-8" dir="rtl">
        {/* --- Header & Tab Navigation --- */}
        <Card className={cn(
            "border-none rounded-[2.5rem] overflow-hidden",
            isGlass ? "glass-effect" : "bg-gradient-to-l from-white to-sky-50 shadow-sm"
        )}>
            <CardHeader className="pb-8 px-8 border-b">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                    <div className="space-y-1 text-center lg:text-right">
                        <CardTitle className="text-3xl font-black flex items-center justify-center lg:justify-start gap-3 text-primary">
                            <FileSignature className="h-8 w-8" />
                            عروض الأسعار والعقود
                        </CardTitle>
                        <CardDescription className={cn("text-base font-medium", isGlass && "text-slate-800")}>
                            إدارة المسارات التعاقدية من العرض المالي وحتى توقيع العقد النهائي.
                        </CardDescription>
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <Button asChild variant="outline" className={cn("h-11 px-6 rounded-xl font-bold gap-2", isGlass && "bg-white/40 border-primary/20 text-primary")}>
                            <Link href="/dashboard/accounting/quotations/new">إنشاء عرض سعر</Link>
                        </Button>
                        <Button asChild className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-primary/20">
                            <Link href="/dashboard/contracts/new">
                                <PlusCircle className="ml-2 h-4 w-4" />
                                توقيع عقد مباشر
                            </Link>
                        </Button>
                    </div>
                </div>
            </CardHeader>
        </Card>

        {/* --- Unified Content Card with Tabs --- */}
        <Card className={cn(
            "rounded-[2.5rem] border-none shadow-2xl overflow-hidden",
            isGlass ? "glass-effect" : "bg-white"
        )}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <CardHeader className="bg-muted/10 border-b pb-0 px-10">
                    <TabsList className={cn(
                        "flex justify-start h-auto bg-transparent p-0 gap-8",
                        isGlass && "border-b-0"
                    )}>
                        <TabsTrigger 
                            value="signed-contracts" 
                            className="py-4 px-2 rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent font-black text-lg transition-all"
                        >
                            <FileSignature className="ml-2 h-5 w-5" />
                            السجلات التعاقدية
                        </TabsTrigger>
                        <TabsTrigger 
                            value="quotations" 
                            className="py-4 px-2 rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent font-black text-lg transition-all"
                        >
                            <FileText className="ml-2 h-5 w-5" />
                            عروض الأسعار
                        </TabsTrigger>
                    </TabsList>
                </CardHeader>

                <div className="p-8 space-y-6">
                    {/* --- Unified Filters Section --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 rounded-[2rem] border-2 border-dashed border-muted-foreground/10 bg-muted/5">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40"/>
                            <Input 
                                placeholder="الاسم أو الهاتف..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="rounded-xl h-11 border-2 font-bold"
                            />
                        </div>
                        <Input 
                            placeholder="رقم المستند..." 
                            value={contractNo}
                            onChange={(e) => setContractNo(e.target.value)}
                            className="rounded-xl h-11 font-mono border-2 font-bold"
                        />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="rounded-xl h-11 border-2 font-bold">
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
                            <DateInput value={dateFrom} onChange={setDateFrom} className="flex-1 rounded-xl h-11 border-2" placeholder="من تاريخ" />
                            <DateInput value={dateTo} onChange={setDateTo} className="flex-1 rounded-xl h-11 border-2" placeholder="إلى تاريخ" />
                        </div>
                    </div>

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
                </div>
            </Tabs>
        </Card>
    </div>
  )
}