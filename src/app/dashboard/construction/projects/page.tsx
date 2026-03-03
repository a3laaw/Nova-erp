
'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
    PlusCircle, 
    FileText, 
    FileSignature, 
    Briefcase, 
    LayoutGrid,
    Search,
    ArrowRightLeft
} from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { ProjectsList } from '@/components/construction/projects-list';
import { QuotationsList } from '@/components/accounting/quotations-list';
import { ConstructionContractsList } from '@/components/construction/construction-contracts-list';
import { cn } from '@/lib/utils';

export default function ConstructionDashboardPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('projects');

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header Section */}
            <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                        <div className="space-y-1 text-center lg:text-right">
                            <CardTitle className="text-3xl font-black flex items-center justify-center lg:justify-start gap-3">
                                <Briefcase className="text-primary h-8 w-8" />
                                مركز عمليات المقاولات
                            </CardTitle>
                            <CardDescription className="text-base font-medium">
                                إدارة الدورة الكاملة: من عرض السعر والتعاقد حتى التأسيس الفني للمشروع.
                            </CardDescription>
                        </div>
                        
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <Button asChild variant="outline" className="h-11 px-6 rounded-xl font-bold gap-2 border-primary text-primary hover:bg-primary/5">
                                <Link href="/dashboard/accounting/quotations/new">
                                    <FileText className="h-5 w-5" />
                                    عرض سعر جديد
                                </Link>
                            </Button>
                            <Button asChild className="h-11 px-8 rounded-xl font-black gap-2 shadow-lg shadow-primary/20">
                                <Link href="/dashboard/contracts/new">
                                    <FileSignature className="h-5 w-5" />
                                    توقيع عقد مباشر
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Main Content Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 px-2">
                    <TabsList className="grid grid-cols-3 h-auto p-1 bg-muted/50 rounded-2xl w-full md:w-[600px]">
                        <TabsTrigger 
                            value="projects" 
                            className="py-3 rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-md gap-2"
                        >
                            <Briefcase className="h-4 w-4" />
                            المشاريع التنفيذية
                        </TabsTrigger>
                        <TabsTrigger 
                            value="contracts" 
                            className="py-3 rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-md gap-2"
                        >
                            <FileSignature className="h-4 w-4" />
                            العقود المبرمة
                        </TabsTrigger>
                        <TabsTrigger 
                            value="quotations" 
                            className="py-3 rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-md gap-2"
                        >
                            <FileText className="h-4 w-4" />
                            عروض الأسعار
                        </TabsTrigger>
                    </TabsList>

                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="بحث سريع..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-11 rounded-xl shadow-inner bg-muted/20 border-none"
                        />
                    </div>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <TabsContent value="projects" className="mt-0">
                        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                            <CardHeader className="bg-muted/10 border-b">
                                <CardTitle className="text-lg font-black flex items-center gap-2">
                                    <LayoutGrid className="text-primary h-5 w-5" />
                                    المشاريع القائمة والهيكل الفني
                                </CardTitle>
                                <CardDescription>هذه القائمة تعرض المشاريع التي تم تأسيس هيكلها الفني وربطها بالـ BOQ.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <ProjectsList searchQuery={searchQuery} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="contracts" className="mt-0">
                        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                            <CardHeader className="bg-muted/10 border-b">
                                <CardTitle className="text-lg font-black flex items-center gap-2">
                                    <FileSignature className="text-primary h-5 w-5" />
                                    العقود والارتباطات المالية
                                </CardTitle>
                                <CardDescription>متابعة كافة العقود الموقعة مع العملاء والتي لم يتم تأسيس هيكلها الفني بعد.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <ConstructionContractsList searchQuery={searchQuery} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="quotations" className="mt-0">
                        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                            <CardHeader className="bg-muted/10 border-b">
                                <CardTitle className="text-lg font-black flex items-center gap-2">
                                    <FileText className="text-primary h-5 w-5" />
                                    عروض الأسعار والمناقصات
                                </CardTitle>
                                <CardDescription>إدارة المفاوضات المالية وعروض الأسعار المرسلة للعملاء.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <QuotationsList />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
