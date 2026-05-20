'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CustodyReconciliationList } from '@/components/hr/custody-reconciliation-list';
import { RotateCcw, Wallet, Sparkles, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function CustodyReconciliationsPage() {
    return (
        <div className="space-y-10" dir="rtl">
            {/* 🛡️ الهيدر الرئيسي المحدث بالهوية البرتقالية 🛡️ */}
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">إدارة تسويات العهد النقدية</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-bold text-sm">مراجعة مصروفات الموظفين الميدانية وربطها محاسبياً بشجرة الحسابات.</CardDescription>
                                </div>
                            </div>
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                <Wallet className="h-10 w-10 text-white" />
                            </div>
                        </div>
                        <Button asChild className="h-12 px-8 rounded-2xl font-black gap-2 bg-white text-[#FF7A00] shadow-xl hover:bg-slate-50 border-none">
                            <Link href="/dashboard/hr/custody-reconciliation/new">
                                <RotateCcw className="h-5 w-5" />
                                إضافة
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/95">
                <CardContent className="pt-8">
                    <CustodyReconciliationList />
                </CardContent>
            </Card>
        </div>
    );
}
