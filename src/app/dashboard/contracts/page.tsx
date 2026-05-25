
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
  Sparkles,
  RotateCcw,
  Filter
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

/**
 * @fileOverview مركز إدارة المبيعات والأرشيف التعاقدي الموحد (V58.0).
 * يجمع العقود الموقعة (المباشرة والمحولة) وعروض الأسعار في منصة رقابية واحدة.
 */
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
        {/* --- الهيدر الرئيسي --- */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 px-4 no-print">
            <div className="space-y-1 text-center lg:text-right">
                <h1 className="text-4xl font-black flex items-center justify-center lg:justify-start gap-4 text-[#1e1b4b] tracking-tighter">
                    <FileSignature className="h-10 w-10 text-[#FF7A00]" />
                    إدارة المبيعات والأرشيف التعاقدي
                </h1>
                <p className="text-base font-bold text-slate-500 pr-2 border-r-4 border-[#FF7A00]/20">
                    مركز التحكم في عروض الأسعار، العقود المبرمة، ومصفوفات الدفعات المعتمدة.
                </p>
            </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className={cn(isGlass ? "tabs-frame-primary" : "mb-10")}>
                <TabsList className={cn(
                    "w-full h-auto bg-transparent p-0 gap-8 grid grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto"
                )}>
                    {/* تبويب العقود الموقعة - الأرشيف */}
                    <TabsTrigger 
                        value="signed-contracts" 
                        className={cn(
                            "transition-all duration-500 text-right h-auto p-8 rounded-[2.5rem] border-2 flex flex-col items-start gap-4 shadow-xl",
                            activeTab === 'signed-contracts' 
                                ? "bg-white border-[#FF7A00] shadow-orange-500/10 scale-[1.02]" 
                                : "bg-white/40 border-transparent text-slate-400 hover:bg-white/60"
                        )}
                    >
                        <div className={cn(
                            "p-3 rounded-2xl shadow-inner",
                            activeTab === 'signed-contracts' ? "bg-[#FF7A00] text-white" : "bg-slate-100 text-slate-400"
                        )}>
                            <Construction className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                            <Badge variant="outline" className={cn("mb-1 font-black text-[9px] uppercase tracking-widest", activeTab === 'signed-contracts' ? "bg-orange-50 text-[#FF7A00] border-[#FF7A00]/20" : "")}>Sovereign Archive</Badge>
                            <h3 className="text-2xl font-black leading-none">العقود الموقعة</h3>
                            <p className="text-xs font-bold opacity-60">أرشيف كافة الاتفاقيات المبرمة (مباشرة أو محولة).</p>
                        </div>
                        <Button asChild className="w-full h-11 rounded-xl font-black text-sm gap-2 mt-4 bg-[#FF7A00] hover:bg-[#E66D00] shadow-lg shadow-orange-500/20 no-print">
                            <Link href="/dashboard/contracts/new">توقيع عقد مباشر +</Link>
                        </Button>
                    </TabsTrigger>

                    {/* تبويب عروض الأسعار */}
                    <TabsTrigger 
                        value="quotations" 
                        className={cn(
                            "transition-all duration-500 text-right h-auto p-8 rounded-[2.5rem] border-2 flex flex-col items-start gap-4 shadow-xl",
                            activeTab === 'quotations' 
                                ? "bg-white border-[#7209B7] shadow-indigo-500/10 scale-[1.02]" 
                                : "bg-white/40 border-transparent text-slate-400 hover:bg-white/60"
                        )}
                    >
                        <div className={cn(
                            "p-3 rounded-2xl shadow-inner",
                            activeTab === 'quotations' ? "bg-[#7209B7] text-white" : "bg-slate-100 text-slate-400"
                        )}>
                            <FileText className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                            <Badge variant="outline" className={cn("mb-1 font-black text-[9px] uppercase tracking-widest", activeTab === 'quotations' ? "bg-indigo-50 text-[#7209B7] border-[#7209B7]/20" : "")}>Price Offers</Badge>
                            <h3 className="text-2xl font-black leading-none">عروض الأسعار</h3>
                            <p className="text-xs font-bold opacity-60">إدارة المقترحات الفنية والمالية المقدمة للملاك.</p>
                        </div>
                        <Button asChild variant="outline" className="w-full h-11 rounded-xl font-black text-sm gap-2 mt-4 border-[#7209B7]/30 text-[#7209B7] bg-indigo-50/50 hover:bg-indigo-100 no-print">
                            <Link href="/dashboard/accounting/quotations/new">إنشاء عرض سعر جديد +</Link>
                        </Button>
                    </TabsTrigger>
                </TabsList>
            </div>

            <div className="mt-10 space-y-6">
                <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/95">
                    <div className="p-10 space-y-8">
                        {/* شريط البحث والفلاتر (The Sovereign Radar) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-8 rounded-[2.5rem] border-2 border-dashed border-slate-100 bg-slate-50/50 no-print">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#FF7A00] opacity-40"/>
                                <Input 
                                    placeholder="اسم العميل أو الهاتف..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="rounded-xl h-12 border-2 bg-white font-black text-black shadow-inner"
                                />
                            </div>
                            <div className="relative">
                                <Input 
                                    placeholder="رقم العقد / المرجع..." 
                                    value={contractNo}
                                    onChange={(e) => setContractNo(e.target.value)}
                                    className="rounded-xl h-12 font-mono border-2 bg-white font-black text-primary shadow-inner"
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="rounded-xl h-12 border-2 bg-white font-black text-black shadow-inner">
                                    <SelectValue placeholder="الحالة..." />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="all">كل الحالات التعاقدية</SelectItem>
                                    {activeTab === 'quotations' ? (
                                        <>
                                            <SelectItem value="draft">مسودة</SelectItem>
                                            <SelectItem value="sent">تم الإرسال</SelectItem>
                                            <SelectItem value="accepted">مقبول</SelectItem>
                                        </>
                                    ) : (
                                        <>
                                            <SelectItem value="in-progress">فعال / نشط</SelectItem>
                                            <SelectItem value="on-hold">معلق إدارياً</SelectItem>
                                            <SelectItem value="completed">منتهي / مكتمل</SelectItem>
                                            <SelectItem value="cancelled" className="text-red-600 font-bold">ملغي / مفسوخ</SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                                <DateInput value={dateFrom} onChange={setDateFrom} className="flex-1 rounded-xl h-12 border-2" placeholder="من" />
                                <DateInput value={dateTo} onChange={setDateTo} className="flex-1 rounded-xl h-12 border-2" placeholder="إلى" />
                            </div>
                        </div>

                        <TabsContent value="quotations" className="animate-in fade-in slide-in-from-bottom-4 duration-500 m-0">
                            <QuotationsList 
                                searchQuery={searchQuery} 
                                dateFrom={dateFrom} 
                                dateTo={dateTo} 
                                statusFilter={statusFilter}
                            />
                        </TabsContent>

                        <TabsContent value="signed-contracts" className="animate-in fade-in slide-in-from-bottom-4 duration-500 m-0">
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
