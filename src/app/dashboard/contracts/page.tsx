'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useLanguage } from '@/context/language-context';

export default function ContractsPage() {
  const { language } = useLanguage();
  const t = language === 'ar' ? {
    title: 'إدارة العقود',
    description: 'عرض وإنشاء وتعديل العقود الإلكترونية.',
    newContract: 'إنشاء عقد جديد',
    noContracts: 'لا توجد عقود محفوظة بعد.',
  } : {
    title: 'Contract Management',
    description: 'View, create, and edit electronic contracts.',
    newContract: 'New Contract',
    noContracts: 'No saved contracts yet.',
  };

  return (
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </div>
          <Button asChild>
            <Link href="/dashboard/contracts/new">
              <PlusCircle className="ml-2 h-4 w-4" />
              {t.newContract}
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="p-8 text-center border-2 border-dashed rounded-lg">
            <h3 className="mt-4 text-lg font-medium">{t.noContracts}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                ستظهر قائمة العقود المحفوظة هنا.
            </p>
        </div>
      </CardContent>
    </Card>
  );
}
