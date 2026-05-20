
'use client';

import { useState, useCallback, useEffect, Suspense, useMemo } from 'react';
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
import { cn, getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Calculator, Sparkles, AlertCircle, Building2, Layers, Zap, Droplets, Ruler } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const deptPrefixes: Record<string, string> = {
    'arch': 'ARCH',
    'facade': 'FAC',
    'struct': 'STR',
    'elec': 'ELEC',
    'sani': 'SANI',
    'mech': 'MECH',
    'general': 'GEN'
};

/**
 * صفحة إصدار عرض سعر جديد (Sovereign Quote Engine V15.0):
 * تم تفعيل الترقيم القطاعي (ARCH, FAC...) وإصلاح كافة أخطاء الـ Reference.
 */
function NewQuotationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [selectedDept, setSelectedDept] = useState('arch');
  const [quotationNumber, setQuotationNumber] = useState('جاري التوليد...');
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(true);
  
  const tenantId = currentUser?.currentCompanyId;

  // ✨ محرك توليد رقم عرض السعر الموحد والقطاعي ✨
  useEffect(() => {
    if (!firestore || !tenantId) return;
    setIsGeneratingNumber(true);
    
    const generateNumber = async () => {
        try {
            const currentYear = new Date().getFullYear();
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
            
            const prefix = deptPrefixes[selectedDept] || 'Q';
            setQuotationNumber(`${String(nextNumber).padStart(4, '0')}-${prefix}-${currentYear}`);
        } catch (error: any) {
            console.error("❌ Number Generation Failure:", error);
            setQuotationNumber('خطأ في الصلاحيات');
        } finally {
            setIsGeneratingNumber(false);
        }
    };
    generateNumber();
  }, [firestore, tenantId, selectedDept]);

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
            
            const prefix = deptPrefixes[selectedDept] || 'Q';
            const finalQuotationNumber = `${String(nextNumber).padStart(4, '0')}-${prefix}-${currentYear}`;
            
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
                quotationDept: selectedDept,
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
  }, [firestore, currentUser, toast, router, isGeneratingNumber, tenantId, selectedDept]);

  return (
    <Card className="max-w-4xl mx-auto rounded-[3rem] border-none shadow-2xl overflow-hidden glass-effect" dir="rtl">
        <CardHeader className="bg-primary/5 pb-8 border-b">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary"><Calculator className="h-6 w-6"/></div>
                        <CardTitle className="text-3xl font-black tracking-tighter text-[#1e1b4b]">إنشاء عرض سعر جديد</CardTitle>
                    </div>
                    <CardDescription className="font-bold text-base pr-11">املأ التفاصيل الفنية والمالية بدقة لضمان تحويلها لعقد رسمي لاحقاً.</CardDescription>
                </div>
                <div className="text-left bg-white p-4 rounded-2xl border shadow-inner min-w-[160px]">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground block mb-1">رقم العرض المعتمد</Label>
                    <div className={cn("font-mono text-2xl font-black", quotationNumber.includes('خطأ') ? "text-red-600" : "text-primary")}>
                        {isGeneratingNumber ? <Skeleton className="h-8 w-24" /> : quotationNumber}
                    </div>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
            {/* 🛡️ محرك اختيار القسم لتحديد الترقيم 🛡️ */}
            <div className="p-6 bg-white rounded-3xl border-2 border-dashed border-primary/20 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary"><Layers className="h-6 w-6" /></div>
                    <div>
                        <Label className="font-black text-primary text-base">القسم المختص بالعرض *</Label>
                        <p className="text-[10px] text-muted-foreground font-bold">سيقوم النظام بتحديث كود الترقيم آلياً حسب اختيارك.</p>
                    </div>
                </div>
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                    <SelectTrigger className="w-full md:w-64 h-12 rounded-xl border-2 font-black text-primary">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                        <SelectItem value="arch">القسم المعماري (ARCH)</SelectItem>
                        <SelectItem value="facade">قسم الواجهات (FAC)</SelectItem>
                        <SelectItem value="struct">القسم الإنشائي (STR)</SelectItem>
                        <SelectItem value="elec">قسم الكهرباء (ELEC)</SelectItem>
                        <SelectItem value="sani">القسم الصحي (SANI)</SelectItem>
                        <SelectItem value="mech">قسم الميكانيك (MECH)</SelectItem>
                        <SelectItem value="general">نشاط عام (GEN)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

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
