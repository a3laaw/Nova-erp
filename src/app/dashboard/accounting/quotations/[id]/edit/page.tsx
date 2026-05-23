'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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

/**
 * صفحة تعديل عرض السعر الموحدة:
 * تسحب كافة البيانات القديمة وتحدثها في المسار السيادي المعتمد.
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

    const quotationPath = useMemo(() => 
        id && tenantId ? getTenantPath(`quotations/${id}`, tenantId) : null
    , [id, tenantId]);

    const { data: quotation, loading, error } = useDocument<Quotation>(firestore, quotationPath);

    const handleSave = useCallback(async (data: Omit<Quotation, 'id' | 'quotationNumber' | 'createdAt' | 'createdBy'>) => {
        if (!firestore || !currentUser || !id || !quotation || !tenantId) return;

        setIsSaving(true);
        try {
            const finalPath = getTenantPath(`quotations/${id}`, tenantId);
            const quotationRefDoc = doc(firestore, finalPath!);
            
            const totalAmount = data.financialsType === 'fixed'
                ? (data.items || []).reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0)
                : data.totalAmount;
            
            const finalData = { 
                ...data, 
                totalAmount,
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.id
            };
            
            await updateDoc(quotationRefDoc, cleanFirestoreData(finalData));

            toast({ title: 'نجاح التحديث', description: 'تم حفظ التعديلات على عرض السعر بنجاح.' });
            router.push(`/dashboard/accounting/quotations/${id}`);

        } catch (error: any) {
            console.error("Error updating quotation:", error);
            toast({ title: "فشل الحفظ", description: error.message || 'حدث خطأ في الصلاحيات.', variant: "destructive" });
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
        return <p className="text-center py-20 font-black opacity-30">عذراً، لم يتم العثور على عرض السعر المطلوب.</p>;
    }

    if (quotation.status === 'accepted') {
        return (
             <Card className="max-w-2xl mx-auto rounded-[2.5rem] p-10 mt-20 text-center" dir="rtl">
                <CardHeader>
                    <div className="p-4 bg-orange-100 rounded-3xl w-fit mx-auto mb-4"><AlertTriangle className="h-10 w-10 text-orange-600"/></div>
                    <CardTitle className="text-2xl font-black text-[#1e1b4b]">عرض سعر مغلق</CardTitle>
                    <CardDescription className="text-lg font-bold">لا يمكن تعديل عرض السعر بعد تحويله لعقد رسمي. يرجى مراجعة العقد المرتبط.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => router.back()} className="h-12 px-10 rounded-xl font-bold">العودة للخلف</Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="max-w-4xl mx-auto rounded-[3rem] border-none shadow-2xl overflow-hidden glass-effect" dir="rtl">
            <CardHeader className="bg-primary/5 pb-8 border-b">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-3xl font-black text-[#1e1b4b] tracking-tighter">تعديل عرض السعر</CardTitle>
                        <CardDescription className="font-bold text-base mt-1">تعديل تفاصيل عرض السعر قبل إرساله للعميل.</CardDescription>
                    </div>
                    <div className="text-left bg-white p-4 rounded-2xl border shadow-inner min-w-[160px]">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground block mb-1 text-center">رقم العرض</Label>
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
    );
}

import { AlertTriangle } from 'lucide-react';
