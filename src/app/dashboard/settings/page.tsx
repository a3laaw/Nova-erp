'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Users, Palette, Database, Clock, CreditCard, ShieldCheck, Building, FileSignature } from 'lucide-react';
import { cn } from '@/lib/utils';

const settingsFeatures = [
    {
        title: 'إدارة المستخدمين',
        description: 'إدارة حسابات دخول الموظفين وصلاحياتهم في النظام.',
        href: '/dashboard/settings/users',
        icon: Users,
        color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
    },
    {
        title: 'العلامة التجارية',
        description: 'تخصيص هوية النظام وشعار الشركة والتقارير المطبوعة.',
        href: '/dashboard/settings/branding',
        icon: Palette,
        color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300'
    },
    {
        title: 'البيانات المرجعية',
        description: 'التحكم في القوائم المنسدلة مثل الأقسام والوظائف والمواقع.',
        href: '/dashboard/settings/reference-data',
        icon: Database,
        color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300'
    },
    {
        title: 'الدوام والمواعيد',
        description: 'تحديد أوقات العمل الرسمية وأيام العطل لجداول الحجوزات.',
        href: '/dashboard/settings/work-hours',
        icon: Clock,
        color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300'
    },
    {
        title: 'طرق الدفع',
        description: 'إدارة طرق الدفع والعمولات البنكية المرتبطة بها.',
        href: '/dashboard/settings/payment-methods',
        icon: CreditCard,
        color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-300'
    },
    {
        title: 'سلامة البيانات',
        description: 'أدوات متقدمة لفحص وتصحيح وحذف البيانات في النظام.',
        href: '/dashboard/settings/data-integrity',
        icon: ShieldCheck,
        color: 'bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-300'
    },
     {
        title: 'إدارة الشركات',
        description: 'إدارة الشركات والفروع المختلفة داخل النظام.',
        href: '/dashboard/settings/companies',
        icon: Building,
        color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-300'
    },
     {
        title: 'نماذج العقود',
        description: 'إنشاء وإدارة قوالب العقود القابلة لإعادة الاستخدام.',
        href: '/dashboard/contracts',
        icon: FileSignature,
        color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300'
    },
];

export default function SettingsDashboardPage() {
  return (
    <Card dir="rtl">
        <CardHeader>
            <CardTitle>الإعدادات العامة للنظام</CardTitle>
            <CardDescription>تحكم في جميع جوانب النظام من هذه اللوحة المركزية.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {settingsFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                    <Link href={feature.href} key={feature.href} className="group block">
                        <Card className="h-full hover:shadow-lg hover:-translate-y-1 transition-all">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <CardTitle className="text-base font-bold">{feature.title}</CardTitle>
                                     <div className={cn("flex-shrink-0 p-2 rounded-lg", feature.color)}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>{feature.description}</CardDescription>
                            </CardContent>
                        </Card>
                    </Link>
                );
            })}
        </CardContent>
    </Card>
  );
}
