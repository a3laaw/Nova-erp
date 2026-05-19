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
    Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { ProjectsList } from '@/components/construction/projects-list';

export default function ExecutiveProjectsPage() {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div className="space-y-10" dir="rtl">
            {/* 🛡️ الهيدر الرئيسي السيادي المحدث بالهوية البرتقالية 🛡️ */}
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">إدارة المشاريع التنفيذية</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-bold text-sm">متابعة الهيكل الفني، الإنجاز الميداني، والتكاليف الحقيقية للمواقع النشطة.</CardDescription>
                                </div>
                            </div>
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                <Briefcase className="h-10 w-10 text-white" />
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/95 shadow-2xl">
                <CardHeader className="bg-muted/10 border-b p-8 px-10">
                    <div className="flex items-center justify-between">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                            <Input placeholder="بحث في المشاريع..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12 rounded-2xl bg-white border-none shadow-inner font-bold" />
                        </div>
                        <Button asChild variant="outline" className="h-11 px-6 rounded-xl font-bold gap-2 bg-white/60 border-primary/20 text-primary">
                            <Link href="/dashboard/construction/field-visits"><MapPin className="h-5 w-5" /> خطة الزيارات</Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-8">
                    <ProjectsList searchQuery={searchQuery} />
                </CardContent>
            </Card>
        </div>
    );
}
