
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
import { Loader2, Save, FileText, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';

export default function FinancialStatementNotesPage() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { branding, loading: brandingLoading } = useBranding();
  const { toast } = useToast();
  const router = useRouter();

  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (branding?.financial_statement_notes) {
      setNotes(branding.financial_statement_notes);
    }
  }, [branding]);

  const handleSave = async () => {
    const tenantId = currentUser?.currentCompanyId;
    if (!firestore || !tenantId) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات أو تحديد المنشأة.' });
      return;
    }
    
    setIsSaving(true);
    try {
      // 🛡️ توحيد المسار السيادي مع الهوية البصرية
      const settingsPath = getTenantPath('settings/branding', tenantId);
      const settingsRef = doc(firestore, settingsPath);
      
      await setDoc(settingsRef, cleanFirestoreData({ financial_statement_notes: notes }), { merge: true });
      toast({ title: 'نجاح الحفظ', description: 'تم تحديث الإيضاحات المتممة بنجاح.' });
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: 'فشل ترحيل التعديلات.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (brandingLoading) {
      return (
        <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
            <Skeleton className="h-32 w-full rounded-[2.5rem]" />
            <Skeleton className="h-96 w-full rounded-[2.5rem]" />
        </div>
      );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6" dir="rtl">
        <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-blue-50">
            <CardHeader className="pb-8 px-8 border-b">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-600 shadow-inner">
                            <FileText className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black">الإيضاحات المتممة (Financial Notes)</CardTitle>
                            <CardDescription className="text-base font-medium">تحرير السياسات المحاسبية والشروحات التي تظهر في نهاية القوائم المالية الرسمية.</CardDescription>
                        </div>
                    </div>
                    <Button onClick={() => router.back()} variant="ghost" className="rounded-xl font-bold gap-2">
                        <ArrowRight className="h-4 w-4" /> العودة
                    </Button>
                </div>
            </CardHeader>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
            <CardContent className="p-10">
                <div className="p-6 bg-muted/20 rounded-[2rem] border-2 border-dashed border-primary/10 shadow-inner">
                    <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={18}
                        className="rounded-3xl border-none shadow-none bg-transparent text-lg leading-loose font-medium focus-visible:ring-0 placeholder:italic"
                        placeholder="ابدأ بكتابة إيضاحاتك هنا... مثل السياسات المحاسبية المتبعة، طريقة تقييم المخزون، والالتزامات الطارئة."
                    />
                </div>
            </CardContent>
            <CardFooter className="p-10 border-t bg-muted/10 flex justify-end">
                <Button onClick={handleSave} disabled={isSaving} className="h-14 px-20 rounded-[2.5rem] font-black text-xl shadow-xl shadow-primary/30 min-w-[280px] gap-3">
                    {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                    {isSaving ? 'جاري ترحيل البيانات...' : 'حفظ ونشر الإيضاحات'}
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}
