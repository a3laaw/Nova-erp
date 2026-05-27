'use client';

import { PermissionsMatrix } from '@/components/developer/permissions-matrix';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck, Sparkles } from 'lucide-react';

/**
 * صفحة مصفوفة الصلاحيات السيادية:
 * مركز التحكم الرئيسي في رتب الموظفين وما يمكنهم رؤيته أو تنفيذه.
 */
export default function PermissionsSettingsPage() {
    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-indigo-50">
                <CardHeader className="pb-8 px-10 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600/10 rounded-2xl text-indigo-600 shadow-inner">
                            <ShieldCheck className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-3xl font-black text-indigo-900">مصفوفة الرتب والصلاحيات</CardTitle>
                            <CardDescription className="text-base font-bold text-slate-500 mt-1">
                                تخصيص مستويات النفاذ (كامل، عرض، جزئي، مخفي) لكل مهنة وظيفية في المنظومة.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <PermissionsMatrix />
            </div>
        </div>
    );
}
