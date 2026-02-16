'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import type { Quotation, Client } from '@/lib/types';
import { QuotationForm } from '@/components/accounting/quotation-form';
import { cleanFirestoreData } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

export default function NewQuotationPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [quotationNumber, setQuotationNumber] = useState('جاري التوليد...');
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(true);
  
  useEffect(() => {
    if (!firestore) return;
    setIsGeneratingNumber(true);
    const generateNumber = async () => {
        try {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'quotations');
            const counterDoc = await getDoc(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            setQuotationNumber(`Q-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
        } catch (error) {
            setQuotationNumber('خطأ');
        } finally {
            setIsGeneratingNumber(false);
        }
    };
    generateNumber();
  }, [firestore]);

  const handleSave = useCallback(async (data: Omit<Quotation, 'id'>) => {
    if (!firestore || !currentUser || isGeneratingNumber) return;
    setIsSaving(true);
    let newQuotationId = '';
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'quotations');
            const counterDoc = await transaction.get(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            
            const newQuotationNumber = `Q-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
            const newQuotationRef = doc(collection(firestore, 'quotations'));
            newQuotationId = newQuotationRef.id;

            const clientSnap = await getDoc(doc(firestore, 'clients', data.clientId));
            const clientName = clientSnap.exists() ? clientSnap.data().nameAr : 'عميل غير معروف';

            const quotationData = {
                ...data,
                quotationNumber: newQuotationNumber,
                quotationSequence: nextNumber,
                quotationYear: currentYear,
                clientName: clientName,
                status: 'draft',
                createdAt: serverTimestamp(),
                createdBy: currentUser.id,
            };
            
            transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            transaction.set(newQuotationRef, cleanFirestoreData(quotationData));
        });
        
        toast({ title: 'نجاح', description: 'تم حفظ عرض السعر كمسودة.' });
        if (newQuotationId) {
            router.push(`/dashboard/accounting/quotations/${newQuotationId}`);
        } else {
            router.push('/dashboard/accounting/quotations');
        }

    } catch (error) {
        console.error("Error saving quotation:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم حفظ عرض السعر.' });
    } finally {
        setIsSaving(false);
    }
  }, [firestore, currentUser, toast, router, isGeneratingNumber]);

  return (
    <Card className="max-w-4xl mx-auto" dir="rtl">
        <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle>عرض سعر جديد</CardTitle>
                    <CardDescription>املأ التفاصيل لإنشاء عرض سعر جديد.</CardDescription>
                </div>
                <div className="text-right">
                    <Label>رقم العرض</Label>
                    <div className="font-mono text-lg font-semibold h-7">
                        {isGeneratingNumber ? <Skeleton className="h-6 w-24" /> : quotationNumber}
                    </div>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <QuotationForm 
                onSave={handleSave} 
                onClose={() => router.back()} 
                isSaving={isSaving}
            />
        </CardContent>
    </Card>
  );
}
