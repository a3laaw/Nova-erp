'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { addDoc, collection, serverTimestamp, query, where, getDocs, runTransaction, doc, orderBy, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { Skeleton } from '@/components/ui/skeleton';

export default function NewClientPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { language } = useLanguage();
    
    const [formData, setFormData] = useState({
        fullName: '',
        mobile: '',
        civilId: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [fileId, setFileId] = useState('جاري التوليد...');
    const [isGeneratingId, setIsGeneratingId] = useState(true);

    useEffect(() => {
        if (!firestore) return;

        const generateFileId = async () => {
            setIsGeneratingId(true);
            try {
                const currentYear = new Date().getFullYear();
                const clientsRef = collection(firestore, 'clients');
                const q = query(clientsRef, where('fileYear', '==', currentYear), orderBy('fileNumber', 'desc'), limit(1));
                
                const querySnapshot = await getDocs(q);
                let nextNumber = 1;

                if (!querySnapshot.empty) {
                    const lastClient = querySnapshot.docs[0].data();
                    nextNumber = (lastClient.fileNumber || 0) + 1;
                }

                setFileId(`${nextNumber}/${currentYear}`);
            } catch (error) {
                console.error("Error generating file ID:", error);
                setFileId('خطأ في التوليد');
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل توليد رقم ملف تلقائي.' });
            } finally {
                setIsGeneratingId(false);
            }
        };

        generateFileId();
    }, [firestore, toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات.' });
            return;
        }

        if (isGeneratingId) {
            toast({ variant: 'destructive', title: 'الرجاء الانتظار', description: 'جاري توليد رقم الملف، يرجى المحاولة بعد لحظات.' });
            return;
        }

        if (!formData.fullName || !formData.mobile || !formData.civilId) {
            toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'الرجاء تعبئة جميع الحقول.' });
            return;
        }

        setIsLoading(true);

        try {
            // --- Uniqueness Check for Civil ID and Mobile ---
            const civilIdQuery = query(collection(firestore, 'clients'), where('civilId', '==', formData.civilId));
            const civilIdSnapshot = await getDocs(civilIdQuery);
            if (!civilIdSnapshot.empty) {
                toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'الرقم المدني هذا مسجل لعميل آخر.' });
                setIsLoading(false);
                return;
            }

            const mobileQuery = query(collection(firestore, 'clients'), where('mobile', '==', formData.mobile));
            const mobileSnapshot = await getDocs(mobileQuery);
            if (!mobileSnapshot.empty) {
                toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'رقم الجوال هذا مسجل لعميل آخر.' });
                setIsLoading(false);
                return;
            }

            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const clientsRef = collection(firestore, 'clients');
                
                const q = query(clientsRef, where('fileYear', '==', currentYear), orderBy('fileNumber', 'desc'), limit(1));
                const querySnapshot = await transaction.get(q);
                
                let nextNumber = 1;
                if (!querySnapshot.empty) {
                    const lastClient = querySnapshot.docs[0].data();
                    nextNumber = (lastClient.fileNumber || 0) + 1;
                }

                const newFileId = `${nextNumber}/${currentYear}`;
                
                const clientData = {
                    ...formData,
                    fileId: newFileId,
                    fileNumber: nextNumber,
                    fileYear: currentYear,
                    status: 'new' as const,
                    createdAt: serverTimestamp(),
                    isActive: true,
                };

                const newClientRef = doc(clientsRef); // Creates a ref with a new auto-generated ID
                transaction.set(newClientRef, clientData);
            });


            toast({ title: 'نجاح', description: 'تمت إضافة العميل الجديد بنجاح.' });
            router.push('/dashboard/clients');

        } catch (error) {
            console.error("Error saving client:", error);
            const errorMessage = error instanceof Error ? error.message : 'لم يتم حفظ العميل. يرجى المحاولة مرة أخرى.';
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };
    
    const t = language === 'ar' ? {
        title: 'إضافة عميل جديد',
        description: 'قم بتعبئة بيانات العميل الجديد لإنشاء ملف له في النظام.',
        fileIdLabel: 'رقم الملف',
        fullName: 'الاسم الكامل',
        fullNamePlaceholder: 'مثال: جاسم محمد',
        mobile: 'رقم الجوال',
        mobilePlaceholder: '+965 1234 5678',
        civilId: 'الرقم المدني',
        civilIdPlaceholder: '12-digit number',
        cancel: 'إلغاء',
        save: 'حفظ العميل',
        saving: 'جاري الحفظ...'
    } : {
        title: 'Add New Client',
        description: 'Fill in the new client\'s details to create their file in the system.',
        fileIdLabel: 'File No.',
        fullName: 'Full Name',
        fullNamePlaceholder: 'e.g., Jassim Mohammed',
        mobile: 'Mobile Number',
        mobilePlaceholder: '+965 1234 5678',
        civilId: 'Civil ID',
        civilIdPlaceholder: '12-digit number',
        cancel: 'Cancel',
        save: 'Save Client',
        saving: 'Saving...'
    };

    return (
        <Card className="max-w-2xl mx-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <form onSubmit={handleSubmit}>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>{t.title}</CardTitle>
                            <CardDescription>{t.description}</CardDescription>
                        </div>
                        <div className="text-right">
                            <Label>{t.fileIdLabel}</Label>
                            <div className="font-mono text-lg font-semibold h-7">
                                {isGeneratingId ? <Skeleton className="h-6 w-24" /> : fileId}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-2">
                        <Label htmlFor="fullName">{t.fullName} <span className="text-destructive">*</span></Label>
                        <Input id="fullName" value={formData.fullName} onChange={handleInputChange} placeholder={t.fullNamePlaceholder} required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="grid gap-2">
                            <Label htmlFor="mobile">{t.mobile} <span className="text-destructive">*</span></Label>
                            <Input id="mobile" dir="ltr" value={formData.mobile} onChange={handleInputChange} placeholder={t.mobilePlaceholder} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="civilId">{t.civilId} <span className="text-destructive">*</span></Label>
                            <Input id="civilId" dir="ltr" value={formData.civilId} onChange={handleInputChange} placeholder={t.civilIdPlaceholder} maxLength={12} required />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()}>
                        <X className="ml-2 h-4 w-4" />
                        {t.cancel}
                    </Button>
                    <Button type="submit" disabled={isLoading || isGeneratingId}>
                        <Save className="ml-2 h-4 w-4" />
                        {isLoading ? t.saving : t.save}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
