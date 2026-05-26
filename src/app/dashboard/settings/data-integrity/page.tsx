'use client';
import { DataIntegrityManager } from '@/components/settings/data-integrity-manager';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldAlert, Sparkles } from 'lucide-react';

/**
 * صفحة تحديث البيانات والرقابة السيادية:
 * تحتوي على "محرك التطهير" لإعادة ضبط المنظومة وتصفير القيود والعمليات.
 */
export default function DataIntegritySettingsPage() {
    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-red-50">
                <CardHeader className="pb-8 px-10 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-600/10 rounded-2xl text-red-600 shadow-inner">
                            <ShieldAlert className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-3xl font-black">أدوات الرقابة وتحديث البيانات</CardTitle>
                            <CardDescription className="text-base font-bold text-slate-500 mt-1">
                                إجراءات حساسة مخصصة للمديرين فقط لإدارة صحة السجلات وتصفير العمليات عند الحاجة.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <DataIntegrityManager />
            </div>
        </div>
    );
}
