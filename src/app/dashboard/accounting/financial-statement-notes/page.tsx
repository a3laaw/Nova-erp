
'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useBranding } from '@/context/branding-context';
import { useFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function FinancialStatementNotesPage() {
  const { firestore } = useFirebase();
  const { branding, loading: brandingLoading } = useBranding();
  const { toast } = useToast();

  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (branding?.financial_statement_notes) {
      setNotes(branding.financial_statement_notes);
    }
  }, [branding]);

  const handleSave = async () => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات.' });
      return;
    }
    
    setIsSaving(true);
    try {
      const settingsRef = doc(firestore, 'company_settings', 'main');
      await setDoc(settingsRef, { financial_statement_notes: notes }, { merge: true });
      toast({ title: 'نجاح', description: 'تم حفظ الإيضاحات المتممة بنجاح.' });
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: 'لم يتم حفظ التغييرات.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (brandingLoading) {
      return (
        <Card dir="rtl">
            <CardHeader>
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-64 w-full" />
            </CardContent>
            <CardFooter className="flex justify-end">
                <Skeleton className="h-10 w-28" />
            </CardFooter>
        </Card>
      );
  }

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>الإيضاحات المتممة للقوائم المالية</CardTitle>
        <CardDescription>
          أضف وحرر تفاصيل وشروحات إضافية حول السياسات المحاسبية والبنود الهامة في القوائم المالية.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={20}
          placeholder="ابدأ بكتابة إيضاحاتك هنا... مثل:
1. السياسات المحاسبية المتبعة:
   - أساس إعداد القوائم المالية.
   - طريقة تقييم المخزون.
   - ..."
        />
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
            {isSaving ? 'جاري الحفظ...' : 'حفظ الإيضاحات'}
        </Button>
      </CardFooter>
    </Card>
  );
}
