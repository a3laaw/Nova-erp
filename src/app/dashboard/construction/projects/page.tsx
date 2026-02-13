
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ProjectsList } from '@/components/construction/projects-list';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default function ConstructionProjectsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>لوحة مشاريع المقاولات</CardTitle>
                        <CardDescription>
                            عرض وإدارة جميع المشاريع التنفيذية.
                        </CardDescription>
                    </div>
                     <Button asChild size="sm" className="gap-1">
                        <Link href="/dashboard/construction/projects/new">
                            <PlusCircle className="h-4 w-4" />
                            إنشاء مشروع جديد
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <ProjectsList />
            </CardContent>
        </Card>
    );
}
