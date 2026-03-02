
'use client';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ProjectsList } from '@/components/construction/projects-list';
import { Button } from '@/components/ui/button';
import { PlusCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';

export default function ConstructionProjectsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    
    return (
        <Card dir="rtl" className="border-none shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/10 pb-8">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-3xl font-black">لوحة مشاريع المقاولات</CardTitle>
                        <CardDescription className="text-base font-medium">
                            عرض وإدارة جميع المشاريع التنفيذية النشطة والمخططة.
                        </CardDescription>
                    </div>
                     <Button asChild className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-primary/20">
                        <Link href="/dashboard/construction/projects/new">
                            <PlusCircle className="h-5 w-5" />
                            إنشاء مشروع جديد
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-6">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="ابحث باسم المشروع أو العميل أو رقم المشروع..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="pl-10 h-11 rounded-xl shadow-sm border-2"
                        />
                    </div>
                </div>
                <ProjectsList searchQuery={searchQuery} />
            </CardContent>
        </Card>
    );
}
