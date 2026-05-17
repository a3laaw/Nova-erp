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
    Settings2,
    Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppTheme } from '@/context/theme-context';
import { Badge } from '@/components/ui/badge';

const settingsFeatures = [
    {
        title: 'إدارة المستخدمين',
        description: 'إدارة حسابات دخول الموظفين وصلاحياتهم السيادية في النظام.',
        href: '/dashboard/settings/users',
        icon: Users,
        color: 'bg-blue-500/10 text-blue-600 border-blue-500/20'
    },
    {
        title: 'العلامة التجارية',
        description: 'تخصيص هوية النظام وشعار الشركة والتقارير المطبوعة.',
        href: '/dashboard/settings/branding',
        icon: Palette,
        color: 'bg-orange-500/10 text-orange-600 border-orange-500/20'
    },
    {
        title: 'إعدادات القوائم',
        description: 'التحكم في الأقسام والوظائف ومراحل العمل وسحب وإفلات الترتيب.',
        href: '/dashboard/settings/reference-data',
        icon: Network,
        color: 'bg-green-500/10 text-green-600 border-green-500/20'
    },
    {
        title: 'مواعيد العمل',
        description: 'تحديد أوقات الدوام الرسمية وأيام العطل وبروتوكول رمضان.',
        href: '/dashboard/settings/work-hours',
        icon: Clock,
        color: 'bg-amber-500/10 text-amber-600 border-amber-500/20'
    },
    {
        title: 'طرق الدفع',
        description: 'إدارة عمولات بوابات الدفع والتحصيل المالي الآلي.',
        href: '/dashboard/settings/payment-methods',
        icon: CreditCard,
        color: 'bg-teal-500/10 text-teal-600 border-teal-500/20'
    },
    {
        title: 'سلامة البيانات',
        description: 'أدوات متقدمة لتطهير السجلات وفحص التوازن المالي.',
        href: '/dashboard/settings/data-integrity',
        icon: ShieldCheck,
        color: 'bg-slate-500/10 text-slate-600 border-slate-500/20'
    },
     {
        title: 'نماذج العقود',
        description: 'بناء وتخصيص قوالب العقود والدفعات المالية الموحدة.',
        href: '/dashboard/settings/contract-templates',
        icon: FileSignature,
        color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
    },
    {
        title: 'إدارة الفئات',
        description: 'تنظيم وتصنيف الأصناف المخزنية والخدمات في دليل شجري.',
        href: '/dashboard/settings/classifications',
        icon: Tags,
        color: 'bg-pink-500/10 text-pink-600 border-pink-500/20'
    },
];

export default function SettingsDashboardPage() {
  const { theme } = useAppTheme();
  const isGlass = theme === 'glass';

  return (
    <div className="space-y-10 pb-20" dir="rtl">
        {/* --- Header Frame --- */}
        <Card className={cn(
            "border-none rounded-[3rem] overflow-hidden relative",
            "bg-gradient-to-l from-white/60 to-orange-50/40 backdrop-blur-3xl border-white/60 shadow-2xl"
        )}>
            <div className="absolute top-0 right-0 w-64 h-full bg-primary/5 -skew-x-12 transform translate-x-10 pointer-events-none" />
            <CardHeader className="pb-10 px-10 border-b border-orange-100/30 relative z-10">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="p-5 bg-primary/10 rounded-[2.2rem] text-primary shadow-inner border border-primary/20 animate-in zoom-in duration-500">
                            <Settings2 className="h-10 w-10" />
                        </div>
                        <div className="text-right">
                            <CardTitle className="text-3xl font-black text-[#1e1b4b] tracking-tighter">إعدادات النظام المركزية</CardTitle>
                            <CardDescription className="text-lg font-bold text-slate-500 mt-1">تخصيص القواعد، الهوية البصرية، والرقابة السيادية للمنظومة.</CardDescription>
                        </div>
                    </div>
                    <Badge variant="outline" className="bg-white/60 text-primary border-primary/20 px-6 py-2 rounded-2xl font-black text-xs gap-2 shadow-sm">
                        <Sparkles className="h-3 w-3 animate-pulse" />
                        الوصول الإداري الكامل
                    </Badge>
                </div>
            </CardHeader>
        </Card>

        {/* --- Features Grid --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-2">
            {settingsFeatures.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                    <Link href={feature.href} key={feature.href} className="group block h-full">
                        <Card className={cn(
                            "h-full border-2 border-transparent rounded-[2.8rem] transition-all duration-500",
                            "bg-gradient-to-br from-white/80 to-amber-50/30 backdrop-blur-2xl shadow-xl",
                            "hover:border-primary/30 hover:-translate-y-2 hover:shadow-[0_20px_50px_-20px_rgba(255,122,0,0.15)]",
                            "relative overflow-hidden group"
                        )}>
                            {/* Decorative element inside card */}
                            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                            
                            <CardHeader className="pb-4 relative z-10">
                                <div className="flex items-start justify-between">
                                     <div className={cn(
                                         "flex-shrink-0 p-4 rounded-2xl border-2 transition-all duration-500 shadow-sm",
                                         "group-hover:scale-110 group-hover:shadow-lg group-hover:rotate-3",
                                         feature.color
                                     )}>
                                        <Icon className="h-7 w-7" />
                                    </div>
                                    <div className="p-2 rounded-full bg-white/40 opacity-0 group-hover:opacity-100 transition-all duration-500 -translate-x-4 group-hover:translate-x-0 shadow-sm border border-white/60">
                                        <ArrowRight className="h-5 w-5 text-primary rotate-180" />
                                    </div>
                                </div>
                                <CardTitle className="text-2xl font-black mt-6 text-[#1e1b4b] tracking-tight group-hover:text-primary transition-colors">
                                    {feature.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <CardDescription className="text-sm font-bold text-slate-500 leading-loose min-h-[48px]">
                                    {feature.description}
                                </CardDescription>
                            </CardContent>
                            <div className="px-8 pb-8 pt-2 relative z-10">
                                <div className="h-1 w-12 bg-primary/20 rounded-full group-hover:w-full transition-all duration-700" />
                            </div>
                        </Card>
                    </Link>
                );
            })}
        </div>
    </div>
  );
}
