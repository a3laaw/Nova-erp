
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { useBranding } from '@/context/branding-context';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Wallet, Users, Calendar, Briefcase, Bot } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';

const features = [
  {
    title: 'محاسبة متكاملة',
    description: 'من شجرة الحسابات وقيود اليومية إلى القوائم المالية المتوافقة مع المعايير الدولية.',
    icon: <Wallet className="h-8 w-8" />,
    image: PlaceHolderImages.find(p => p.id === 'feature-accounting'),
  },
  {
    title: 'إدارة الموارد البشرية',
    description: 'ملفات الموظفين، نظام الإجازات، معالجة الرواتب، وحساب نهاية الخدمة بسهولة.',
    icon: <Users className="h-8 w-8" />,
    image: PlaceHolderImages.find(p => p.id === 'feature-hr'),
  },
  {
    title: 'نظام مواعيد ذكي',
    description: 'تقويم مزدوج يمنع تعارض الحجوزات تلقائياً مع تخصيص كامل لأوقات الدوام.',
    icon: <Calendar className="h-8 w-8" />,
    image: PlaceHolderImages.find(p => p.id === 'feature-appointments'),
  },
  {
    title: 'إدارة المشاريع والعقود',
    description: 'تتبع مراحل عمل كل معاملة، وإدارة العقود والدفعات المرتبطة بها.',
    icon: <Briefcase className="h-8 w-8" />,
    image: PlaceHolderImages.find(p => p.id === 'feature-projects'),
  },
];

export default function LandingPage() {
  const heroImage = PlaceHolderImages.find(p => p.id === 'login-background');
  
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="px-4 lg:px-6 h-16 flex items-center shadow-sm">
        <Link href="/" className="flex items-center justify-center">
          <span className="text-xl font-bold">Nova ERP</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Button asChild>
            <Link href="/dashboard">
              الدخول إلى النظام
              <ArrowLeft className="mr-2 h-4 w-4" />
            </Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="relative w-full pt-24 md:pt-32 lg:pt-40">
          <div className="absolute inset-0 z-0">
            {heroImage && (
              <Image
                src={heroImage.imageUrl}
                alt={heroImage.description}
                fill
                className="object-cover opacity-10"
                data-ai-hint={heroImage.imageHint}
                priority
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          </div>
          <div className="container px-4 md:px-6 relative z-10">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none">
                  النظام المتكامل لإدارة أعمالك الهندسية
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                  من المحاسبة والموارد البشرية إلى إدارة المشاريع والمواعيد، Nova ERP يوفر لك كل ما تحتاجه في مكان واحد.
                </p>
              </div>
              <div className="space-x-4">
                <Button size="lg" asChild>
                  <Link href="/dashboard">
                    ابدأ الآن
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
        
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">مميزات النظام</div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">مصمم لشركتك الهندسية</h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  نظام شامل يربط جميع أقسام شركتك، ويوفر أدوات ذكية لتسهيل سير العمل وزيادة الإنتاجية.
                </p>
              </div>
            </div>
            <div className="mx-auto grid items-start gap-8 sm:max-w-4xl sm:grid-cols-2 md:gap-12 lg:max-w-5xl lg:grid-cols-2">
              {features.map((feature) => (
                <Card key={feature.title} className="overflow-hidden hover:shadow-xl transition-shadow duration-300">
                  <CardContent className="p-0">
                    {feature.image && (
                      <div className="aspect-video relative">
                        <Image
                          src={feature.image.imageUrl}
                          alt={feature.image.description}
                          fill
                          className="object-cover"
                          data-ai-hint={feature.image.imageHint}
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <div className="flex items-center gap-4 mb-2">
                        <div className="bg-primary/10 text-primary p-3 rounded-full">{feature.icon}</div>
                        <h3 className="text-xl font-bold">{feature.title}</h3>
                      </div>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} Nova ERP. جميع الحقوق محفوظة.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link href="#" className="text-xs hover:underline underline-offset-4">
            شروط الاستخدام
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4">
            سياسة الخصوصية
          </Link>
        </nav>
      </footer>
    </div>
  );
}
