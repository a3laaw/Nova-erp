'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFirebase, useDocument } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import type { Quotation } from '@/lib/types';
import { QuotationForm } from '@/components/accounting/quotation-form';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * صفحة تعديل عرض السعر الموحدة (Sovereign Edit Engine V15.0):
 * تم تحصين محرك الحفظ ليتعامل بمرونة مع البيانات القديمة ويظهر تنبيهات الأخطاء.
 */
export default function EditQuotationPage() {
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const tenantId = currentUser?.currentCompanyId;
    const [isSaving, setIsSaving] = useState(false);

    // 🛡️ توجيه مسار الاستماع للمنظومة المعزولة
    const quotationPath = useMemo(() => 
        id && tenantId ? getTenantPath(`quotations/${id}`, tenantId) : null
    , [id, tenantId]);

    const { data: quotation, loading, error } = useDocument<Quotation>(firestore, quotationPath);

    const handleSave = useCallback(async (formData: any) => {
        if (!firestore || !currentUser || !id || !quotation || !tenantId) return;

        setIsSaving(true);
        try {
            const finalPath = getTenantPath(`quotations/${id}`, tenantId);
            const quotationRefDoc = doc(firestore, finalPath!);
            
            // حساب الإجمالي النهائي لضمان الصحة المالية
            const totalAmount = formData.financialsType === 'fixed'
                ? (formData.items || []).reduce((sum: number, item: any) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0)
                : formData.totalAmount;
            
            const finalData = { 
                ...formData, 
                totalAmount,
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.id,
                companyId: tenantId
            };
            
            await updateDoc(quotationRefDoc, cleanFirestoreData(finalData));

            toast({ title: '✅ تم تحديث عرض السعر', description: 'تم حفظ كافة التعديلات والمواصفات الفنية بنجاح.' });
            router.push(`/dashboard/accounting/quotations/${id}`);

        } catch (error: any) {
            console.error("Quotation Save Error:", error);
            toast({ variant: "destructive", title: "فشل الحفظ", description: error.message || 'حدث خطأ غير متوقع أثناء الحفظ.' });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, currentUser, id, quotation, router, toast, tenantId]);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-12" dir="rtl">
                <Skeleton className="h-32 w-full rounded-[2.5rem] mb-6" />
                <Skeleton className="h-[600px] w-full rounded-[3rem]" />
            </div>
        );
    }
    
    if (error || !quotation) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4" dir="rtl">
                <AlertTriangle className="h-16 w-16 text-red-500 opacity-20" />
                <p className="font-black text-xl opacity-30 italic">عذراً، لم يتم العثور على عرض السعر المطلوب.</p>
                <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-bold"><ArrowRight className="h-4 w-4"/> العودة للخلف</Button>
            </div>
        );
    }

    if (quotation.status === 'accepted') {
        return (
             <Card className="max-w-2xl mx-auto rounded-[2.5rem] p-10 mt-20 text-center shadow-2xl border-none" dir="rtl">
                <CardHeader>
                    <div className="p-4 bg-orange-100 rounded-3xl w-fit mx-auto mb-4 border border-orange-200"><AlertTriangle className="h-10 w-10 text-orange-600"/></div>
                    <CardTitle className="text-2xl font-black text-[#1e1b4b]">عرض سعر مغلق (عقد مبرم)</CardTitle>
                    <CardDescription className="text-lg font-bold text-slate-500">لا يمكن تعديل عرض السعر بعد تحويله لعقد رسمي. يرجى مراجعة تفاصيل العقد في صفحة العميل.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <Button onClick={() => router.back()} className="h-14 px-12 rounded-2xl font-black text-lg shadow-xl shadow-primary/20">العودة للخلف</Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in duration-700" dir="rtl">
            <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden glass-effect">
                <CardHeader className="bg-primary/5 pb-8 border-b">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-3xl font-black text-[#1e1b4b] tracking-tighter">تعديل عرض السعر</CardTitle>
                            <CardDescription className="font-bold text-base mt-1 text-slate-500">مراجعة وتحديث المواصفات الفنية والترتيبات المالية للمالك.</CardDescription>
                        </div>
                        <div className="text-left bg-white p-4 rounded-2xl border-2 shadow-inner min-w-[160px]">
                            <Label className="text-[10px] font-black uppercase text-slate-400 block mb-1 text-center">رقم العرض</Label>
                            <div className="font-mono text-xl font-black text-center text-primary">
                                {quotation.quotationNumber}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8">
                    <QuotationForm
                        initialData={quotation}
                        onSave={handleSave}
                        onClose={() => router.back()}
                        isSaving={isSaving}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
