'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { 
    Users, 
    Palette, 
    Clock, 
    CreditCard, 
    ShieldCheck, 
    Building, 
    FileSignature, 
    Tags, 
    Network,
    ArrowRight,
    Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const settingsFeatures = [
    {
        title: 'إدارة المستخدمين',
        description: 'إدارة حسابات دخول الموظفين وصلاحياتهم في النظام.',
        href: '/dashboard/settings/users',
        icon: Users,
        color: 'bg-blue-100 text-blue-600'
    },
    {
        title: 'العلامة التجارية',
        description: 'تخصيص هوية النظام وشعار الشركة والتقارير المطبوعة.',
        href: '/dashboard/settings/branding',
        icon: Palette,
        color: 'bg-purple-100 text-purple-600'
    },
    {
        title: 'البيانات المرجعية',
        description: 'التحكم في القوائم المنسدلة مثل الأقسام والوظائف والمواقع.',
        href: '/dashboard/settings/reference-data',
        icon: Network,
        color: 'bg-green-100 text-green-600'
    },
    {
        title: 'الدوام والمواعيد',
        description: 'تحديد أوقات العمل الرسمية وأيام العطل والورديات.',
        href: '/dashboard/settings/work-hours',
        icon: Clock,
        color: 'bg-orange-100 text-orange-600'
    },
    {
        title: 'طرق الدفع',
        description: 'إدارة طرق الدفع والعمولات البنكية المرتبطة بها.',
        href: '/dashboard/settings/payment-methods',
        icon: CreditCard,
        color: 'bg-teal-100 text-teal-600'
    },
    {
        title: 'سلامة البيانات',
        description: 'أدوات متقدمة لفحص وتصحيح وحذف البيانات في النظام.',
        href: '/dashboard/settings/data-integrity',
        icon: ShieldCheck,
        color: 'bg-slate-100 text-slate-600'
    },
     {
        title: 'إدارة الشركات',
        description: 'إدارة الشركات والفروع المختلفة داخل النظام.',
        href: '/dashboard/settings/companies',
        icon: Building,
        color: 'bg-cyan-100 text-cyan-600'
    },
     {
        title: 'نماذج العقود',
        description: 'إنشاء وإدارة قوالب العقود الموحدة للشركة.',
        href: '/dashboard/settings/contract-templates',
        icon: FileSignature,
        color: 'bg-indigo-100 text-indigo-600'
    },
    {
        title: 'إدارة الفئات',
        description: 'تنظيم وتصنيف الأصناف والخدمات في المخازن.',
        href: '/dashboard/settings/classifications',
        icon: Tags,
        color: 'bg-pink-100 text-pink-600'
    },
];

export default function SettingsDashboardPage() {
  return (
    <div className="space-y-8" dir="rtl">
        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-gradient-to-l from-white to-purple-50 dark:from-card dark:to-card">
            <CardHeader className="pb-8 px-8 border-b">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                        <Settings2 className="h-8 w-8" />
                    </div>
                    <div>
                        <CardTitle className="text-3xl font-black">إعدادات النظام المركزية</CardTitle>
                        <CardDescription className="text-base font-medium">قم بتخصيص كافة قواعد العمل والهوية البصرية والرقابة من هنا.</CardDescription>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
            {settingsFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                    <Link href={feature.href} key={feature.href} className="group block">
                        <Card className="h-full border-none shadow-sm rounded-[2rem] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white">
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                     <div className={cn("flex-shrink-0 p-3 rounded-2xl transition-colors", feature.color)}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <div className="p-1 rounded-full bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ArrowRight className="h-4 w-4 text-muted-foreground rotate-180" />
                                    </div>
                                </div>
                                <CardTitle className="text-xl font-black mt-4 text-gray-800">{feature.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-sm font-medium leading-relaxed">{feature.description}</CardDescription>
                            </CardContent>
                        </Card>
                    </Link>
                );
            })}
        </div>
    </div>
  );
}
