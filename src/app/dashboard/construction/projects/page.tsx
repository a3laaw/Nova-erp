'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Briefcase, 
    Search,
    LayoutGrid,
    MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { ProjectsList } from '@/components/construction/projects-list';

export default function ExecutiveProjectsPage() {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div className="space-y-10" dir="rtl">
            <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-gradient-to-l from-white to-sky-50 shadow-sm">
                <CardHeader className="pb-8 px-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                        <div className="space-y-1 text-center lg:text-right">
                            <CardTitle className="text-3xl font-black flex items-center justify-center lg:justify-start gap-4">
                                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                                    <Briefcase className="h-8 w-8" />
                                </div>
                                إدارة المشاريع التنفيذية
                            </CardTitle>
                            <CardDescription className="text-base font-bold text-slate-500 mt-1 pr-16">
                                متابعة الهيكل الفني، الإنجاز الميداني، والتكاليف الحقيقية للمواقع النشطة.
                            </CardDescription>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                                <Input
                                    placeholder="بحث في المشاريع..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 h-11 rounded-xl bg-white border-none shadow-inner font-bold"
                                />
                            </div>
                            <Button asChild variant="outline" className="h-11 px-6 rounded-xl font-bold gap-2 bg-white/60 border-primary/20 text-primary">
                                <Link href="/dashboard/construction/field-visits">
                                    <MapPin className="h-5 w-5" />
                                    خطة الزيارات
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/95">
                <CardHeader className="bg-muted/10 border-b p-8 px-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-black flex items-center gap-2">
                                <LayoutGrid className="text-primary h-5 w-5" />
                                المشاريع القائمة في المواقع
                            </CardTitle>
                            <CardDescription>قائمة المشاريع النشطة المرتبطة بجداول كميات (BOQ) معتمدة.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-8">
                    <ProjectsList searchQuery={searchQuery} />
                </CardContent>
            </Card>
        </div>
    );
}
