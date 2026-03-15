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
  PlusCircle,
  Construction,
  Sparkles
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
import { useAppTheme } from '@/context/theme-context';
import { Badge } from '@/components/ui/badge';

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
    <div className="space-y-10" dir="rtl">
        {/* --- Header --- */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 px-4">
            <div className="space-y-1 text-center lg:text-right">
                <h1 className="text-3xl font-black flex items-center justify-center lg:justify-start gap-3 text-primary">
                    <FileSignature className="h-8 w-8" />
                    عروض الأسعار والعقود
                </h1>
                <p className="text-base font-bold text-muted-foreground">
                    إدارة المسارات التعاقدية والمالية للمشاريع النشطة والجديدة.
                </p>
            </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* --- Card-Style Tab Triggers (Image 1 Style) --- */}
            <TabsList className={cn(
                "w-full h-auto bg-transparent p-0 gap-6",
                isGlass ? "tabs-list-cards" : "grid grid-cols-1 md:grid-cols-2"
            )}>
                <TabsTrigger 
                    value="signed-contracts" 
                    className={cn(
                        "transition-all duration-500 text-right",
                        isGlass ? "tabs-trigger-card" : "flex flex-col items-start p-6 rounded-2xl border bg-white shadow-sm h-full"
                    )}
                >
                    <div className="tab-icon-box">
                        <Construction className="h-6 w-6" />
                    </div>
                    <Badge variant="outline" className="mb-2 bg-primary/10 text-primary border-primary/20 text-[10px] font-black">المسار القانوني</Badge>
                    <h3 className="text-xl font-black mb-1">العقود الموقعة</h3>
                    <p className="text-xs font-bold text-muted-foreground mb-4">التعاقد المباشر وإثبات المديونيات المالية واللوجستية.</p>
                    <Button asChild className="w-full h-10 rounded-xl font-black text-xs gap-2 mt-auto">
                        <Link href="/dashboard/contracts/new">توقيع عقد مباشر فوري +</Link>
                    </Button>
                </TabsTrigger>

                <TabsTrigger 
                    value="quotations" 
                    className={cn(
                        "transition-all duration-500 text-right",
                        isGlass ? "tabs-trigger-card" : "flex flex-col items-start p-6 rounded-2xl border bg-white shadow-sm h-full"
                    )}
                >
                    <div className="tab-icon-box">
                        <FileText className="h-6 w-6" />
                    </div>
                    <Badge variant="outline" className="mb-2 bg-indigo-50 text-indigo-700 border-indigo-100 text-[10px] font-black">المسار المالي</Badge>
                    <h3 className="text-xl font-black mb-1">عروض الأسعار</h3>
                    <p className="text-xs font-bold text-muted-foreground mb-4">إدارة المسودات والمقترحات المالية للمشاريع الجديدة.</p>
                    <Button asChild variant="outline" className="w-full h-10 rounded-xl font-black text-xs gap-2 mt-auto border-primary/30 text-primary bg-primary/5">
                        <Link href="/dashboard/accounting/quotations/new">إنشاء عرض سعر جديد +</Link>
                    </Button>
                </TabsTrigger>
            </TabsList>

            {/* --- Filter Section & Table Content --- */}
            <div className="mt-10 space-y-6">
                <Card className={cn(
                    "rounded-[2.5rem] border-none shadow-xl overflow-hidden",
                    isGlass ? "glass-effect" : "bg-white"
                )}>
                    <div className="p-8 space-y-6">
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
                </Card>
            </div>
        </Tabs>
    </div>
  )
}