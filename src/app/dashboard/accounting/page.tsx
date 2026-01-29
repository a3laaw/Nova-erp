'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Sparkles, BookUser, FileText, BookOpen, ArrowUpCircle, ArrowDownCircle, Banknote, Scale, LineChart, Users, ArrowLeftRight } from 'lucide-react';
import { useLanguage } from '@/context/language-context';

const accountingSections = [
    {
        title: 'قيود اليومية',
        description: 'إنشاء وتصفح قيود اليومية العامة.',
        link: '/dashboard/accounting/journal-entries',
        icon: <BookOpen className="h-8 w-8 text-primary" />,
    },
    {
        title: 'شجرة الحسابات',
        description: 'إدارة دليل الحسابات الخاص بالشركة.',
        link: '/dashboard/accounting/chart-of-accounts',
        icon: <BookUser className="h-8 w-8 text-primary" />,
    },
    {
        title: 'سندات القبض',
        description: 'عرض وإدارة جميع سندات القبض الواردة من العملاء.',
        link: '/dashboard/accounting/cash-receipts',
        icon: <ArrowDownCircle className="h-8 w-8 text-green-600" />,
    },
    {
        title: 'سندات الصرف',
        description: 'إدارة الشيكات والمدفوعات الصادرة للموردين والموظفين.',
        link: '/dashboard/accounting/payment-vouchers',
        icon: <ArrowUpCircle className="h-8 w-8 text-red-600" />,
    },
     {
        title: 'عروض الأسعار',
        description: 'إنشاء وإدارة عروض الأسعار المقدمة للعملاء.',
        link: '/dashboard/accounting/quotations',
        icon: <FileText className="h-8 w-8 text-primary" />,
    },
    {
        title: 'الفواتير',
        description: 'إنشاء وتتبع فواتير العملاء المستحقة والمدفوعة.',
        link: '/dashboard/accounting/invoices',
        icon: <FileText className="h-8 w-8 text-primary" />,
    },
     {
        title: 'المساعد المحاسبي الذكي',
        description: 'استخدم الذكاء الاصطناعي لتحويل الأوامر النصية إلى قيود محاسبية.',
        link: '/dashboard/accounting/assistant',
        icon: <Sparkles className="h-8 w-8 text-primary" />,
    },
    {
        title: 'كشف حساب',
        description: 'عرض كشف حساب تفصيلي لأي حساب في شجرة الحسابات.',
        link: '/dashboard/accounting/account-statement',
        icon: <Banknote className="h-8 w-8 text-primary" />,
    },
    {
        title: 'ميزان المراجعة',
        description: 'عرض أرصدة الحسابات المدينة والدائنة خلال فترة.',
        link: '/dashboard/accounting/trial-balance',
        icon: <Scale className="h-8 w-8 text-primary" />,
    },
    {
        title: 'قائمة المركز المالي',
        description: 'عرض الأصول والالتزامات وحقوق الملكية.',
        link: '/dashboard/accounting/balance-sheet',
        icon: <Scale className="h-8 w-8 text-primary" />,
    },
    {
        title: 'قائمة الدخل',
        description: 'قياس الأداء المالي والربحية خلال فترة.',
        link: '/dashboard/accounting/income-statement',
        icon: <LineChart className="h-8 w-8 text-primary" />,
    },
    {
        title: 'قائمة التدفقات النقدية',
        description: 'تتبع حركة النقد الداخل والخارج.',
        link: '/dashboard/accounting/cash-flow',
        icon: <ArrowLeftRight className="h-8 w-8 text-primary" />,
    },
    {
        title: 'قائمة التغير في حقوق الملكية',
        description: 'تتبع التغير في حصص الملاك والأرباح المحتجزة.',
        link: '/dashboard/accounting/equity-statement',
        icon: <Users className="h-8 w-8 text-primary" />,
    },
    {
        title: 'الإيضاحات المتممة',
        description: 'تفاصيل وشروحات إضافية حول بنود القوائم المالية.',
        link: '/dashboard/accounting/financial-statement-notes',
        icon: <FileText className="h-8 w-8 text-primary" />,
    },
];

export default function AccountingPage() {
  const { language } = useLanguage();
  return (
    <div dir="rtl">
        <Card className='mb-6'>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>لوحة التحكم المحاسبية</CardTitle>
                        <CardDescription>
                            نظرة عامة على القسم المحاسبي وانتقال سريع للأقسام المختلفة.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {accountingSections.map((section) => (
                <Card key={section.link}>
                    <CardHeader className="flex flex-row items-center gap-4">
                        {section.icon}
                        <div>
                            <CardTitle>{section.title}</CardTitle>
                            <CardDescription>{section.description}</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                         <Button asChild className="w-full">
                            <Link href={section.link}>
                                الانتقال إلى {section.title} <ArrowRight className="mr-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
    </div>
  );
}
