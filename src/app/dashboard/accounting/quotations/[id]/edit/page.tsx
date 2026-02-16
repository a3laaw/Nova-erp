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
import { cleanFirestoreData } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export default function EditQuotationPage() {
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);

    const quotationRef = useMemo(() => {
        if (!firestore || !id) return null;
        return doc(firestore, 'quotations', id);
    }, [firestore, id]);

    const { data: quotation, loading, error } = useDocument<Quotation>(firestore, quotationRef ? quotationRef.path : null);

    const handleSave = useCallback(async (data: Omit<Quotation, 'id' | 'quotationNumber' | 'createdAt' | 'createdBy'>) => {
        if (!firestore || !currentUser || !id || !quotation) return;

        setIsSaving(true);
        try {
            const quotationRefDoc = doc(firestore, 'quotations', id);
            
            const totalAmount = data.financialsType === 'fixed'
                ? (data.items || []).reduce((sum, item) => sum + item.total, 0)
                : data.totalAmount;
            
            const finalData = { ...data, totalAmount };
            
            await updateDoc(quotationRefDoc, cleanFirestoreData(finalData));

            toast({ title: 'نجاح', description: 'تم تحديث عرض السعر بنجاح.' });
            router.push(`/dashboard/accounting/quotations/${id}`);

        } catch (error) {
            console.error("Error updating quotation:", error);
            const errorMessage = error instanceof Error ? error.message : 'فشل تحديث عرض السعر.';
            toast({ title: "خطأ", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, currentUser, id, quotation, router, toast]);

    if (loading) {
        return (
            <Card className="max-w-4xl mx-auto" dir="rtl">
                <CardHeader><Skeleton className="h-8 w-48" /></CardHeader>
                <CardContent><Skeleton className="h-96 w-full" /></CardContent>
            </Card>
        );
    }
    
    if (error || !quotation) {
        return <p className="text-center text-destructive">خطأ في تحميل عرض السعر.</p>;
    }

    if (quotation.status !== 'draft') {
        return (
             <Card className="max-w-2xl mx-auto" dir="rtl">
                <CardHeader>
                     <CardTitle>عرض السعر غير قابل للتعديل</CardTitle>
                    <CardDescription>لا يمكن تعديل عرض السعر إلا إذا كانت حالته "مسودة".</CardDescription>
                </CardHeader>
                 <CardContent>
                    <Button onClick={() => router.back()}>العودة</Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>تعديل عرض السعر</CardTitle>
                        <CardDescription>
                            تعديل تفاصيل عرض السعر قبل إرساله للعميل.
                        </CardDescription>
                    </div>
                    <div className="text-right">
                        <Label>رقم العرض</Label>
                        <div className="font-mono text-lg font-semibold h-7">
                            {quotation.quotationNumber}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
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
