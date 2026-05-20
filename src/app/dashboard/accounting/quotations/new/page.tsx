'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFirebase } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import type { Quotation } from '@/lib/types';
import { QuotationForm } from '@/components/accounting/quotation-form';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Calculator, Sparkles, AlertCircle } from 'lucide-react';

/**
 * صفحة إصدار عرض سعر جديد (Sovereign Quote Engine V13.0):
 * تم تحصين محرك الترقيم ليعمل عبر المسار الموحد المخصص للمنشأة لضمان تجاوز الرفض الأمني لـ Firebase.
 */
function NewQuotationContent() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [quotationNumber, setQuotationNumber] = useState('جاري التوليد...');
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(true);
  
  const tenantId = currentUser?.currentCompanyId;

  // ✨ محرك توليد رقم عرض السعر الموحد والمحصن ✨
  useEffect(() => {
    if (!firestore || !tenantId) return;
    setIsGeneratingNumber(true);
    
    const generateNumber = async () => {
        try {
            const currentYear = new Date().getFullYear();
            // 🛡️ استخدام المسار الموحد المخصص للمنشأة لضمان الصلاحيات
            const counterPath = getTenantPath('counters/quotations', tenantId);
            
            if (!counterPath) {
                setQuotationNumber('خطأ في تحديد المنشأة');
                return;
            }

            const counterRef = doc(firestore, counterPath);
            const counterDoc = await getDoc(counterRef);
            
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            setQuotationNumber(`Q-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
        } catch (error: any) {
            console.error("❌ Number Generation Permission Failure:", error);
            // إظهار تنبيه تقني للمسؤول
            setQuotationNumber('خطأ في الصلاحيات');
        } finally {
            setIsGeneratingNumber(false);
        }
    };
    generateNumber();
  }, [firestore, tenantId]);

  const handleSave = useCallback(async (data: Omit<Quotation, 'id'>) => {
    if (!firestore || !currentUser || !tenantId || isGeneratingNumber) return;
    setIsSaving(true);
    let newQuotationId = '';
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const currentYear = new Date().getFullYear();
            const counterPath = getTenantPath('counters/quotations', tenantId);
            const counterRef = doc(firestore, counterPath!);
            const counterDoc = await transaction.get(counterRef);
            
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            
            const finalQuotationNumber = `Q-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
            const quotationsPath = getTenantPath('quotations', tenantId);
            const newQuotationRef = doc(collection(firestore, quotationsPath!));
            newQuotationId = newQuotationRef.id;

            const clientPath = getTenantPath(`clients/${data.clientId}`, tenantId);
            const clientSnap = await getDoc(doc(firestore, clientPath!));
            const clientName = clientSnap.exists() ? clientSnap.data().nameAr : 'عميل غير معروف';

            const quotationData = {
                ...data,
                quotationNumber: finalQuotationNumber,
                quotationSequence: nextNumber,
                quotationYear: currentYear,
                clientName: clientName,
                status: 'draft',
                createdAt: serverTimestamp(),
                createdBy: currentUser.id,
                companyId: tenantId
            };
            
            transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            transaction.set(newQuotationRef, cleanFirestoreData(quotationData));
        });
        
        toast({ title: 'نجاح الحفظ', description: 'تم إنشاء مسودة عرض السعر بنجاح.' });
        router.push(`/dashboard/accounting/quotations/${newQuotationId}`);
    } catch (error: any) {
        console.error("Error saving quotation:", error);
        toast({ variant: 'destructive', title: 'فشل الحفظ', description: error.message || 'حدث خطأ غير متوقع.' });
        setIsSaving(false);
    }
  }, [firestore, currentUser, toast, router, isGeneratingNumber, tenantId]);

  return (
    <Card className="max-w-4xl mx-auto rounded-[3rem] border-none shadow-2xl overflow-hidden glass-effect" dir="rtl">
        <CardHeader className="bg-primary/5 pb-8 border-b">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary"><Calculator className="h-6 w-6"/></div>
                        <CardTitle className="text-3xl font-black tracking-tighter">إنشاء عرض سعر جديد</CardTitle>
                    </div>
                    <CardDescription className="font-bold text-base pr-11">املأ التفاصيل الفنية والمالية بدقة لضمان تحويلها لعقد رسمي لاحقاً.</CardDescription>
                </div>
                <div className="text-left bg-white p-4 rounded-2xl border shadow-inner">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground block mb-1">رقم العرض المعتمد</Label>
                    <div className={cn("font-mono text-2xl font-black", quotationNumber.includes('خطأ') ? "text-red-600" : "text-primary")}>
                        {isGeneratingNumber ? <Skeleton className="h-8 w-24" /> : quotationNumber}
                    </div>
                    {quotationNumber.includes('خطأ') && (
                        <p className="text-[8px] font-bold text-red-500 mt-1 max-w-[120px] leading-tight">يرجى مراجعة إعدادات الأمان للمنشأة.</p>
                    )}
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-8">
            <QuotationForm 
                onSave={handleSave} 
                onClose={() => router.back()} 
                isSaving={isSaving}
            />
        </CardContent>
    </Card>
  );
}

export default function NewQuotationPage() {
    return (
        <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-[3rem]" />}>
            <NewQuotationContent />
        </Suspense>
    );
}