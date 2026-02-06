
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBranding, type BrandingSettings } from '@/context/branding-context';
import { useFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '../ui/separator';

export function BrandingManager() {
    const { firestore } = useFirebase();
    const { branding, loading } = useBranding();
    const { toast } = useToast();
    
    const [formData, setFormData] = useState<Partial<BrandingSettings>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (branding) {
            setFormData(branding);
        }
    }, [branding]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({...prev, [id]: value}));
    };
    
    const handleSave = async () => {
        if (!firestore) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بالخدمات السحابية.'});
            return;
        }
        if (!formData.company_name) {
            toast({ variant: 'destructive', title: 'حقل مطلوب', description: 'اسم الشركة مطلوب.'});
            return;
        }

        setIsSaving(true);
        
        try {
            const settingsRef = doc(firestore, 'company_settings', 'main');
            await setDoc(settingsRef, formData, { merge: true });
            
            toast({ title: 'نجاح', description: 'تم حفظ إعدادات العلامة التجارية بنجاح.' });

        } catch (error: any) {
            console.error("Error saving branding settings:", error);
            const errorMessage = error.code ? `رمز الخطأ: ${error.code}` : error.message;
            toast({ 
                variant: 'destructive', 
                title: 'فشل الحفظ', 
                description: `حدث خطأ أثناء حفظ البيانات. ${errorMessage}`
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64 mt-2" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-24" />
                </CardContent>
                <CardFooter className="flex justify-end">
                    <Skeleton className="h-10 w-28" />
                </CardFooter>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>إعدادات العلامة التجارية</CardTitle>
                <CardDescription>
                    قم بتخصيص هوية النظام لتناسب شركتك. ستظهر هذه البيانات في التقارير والفواتير.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                 <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold text-base">صور الهوية البصرية</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="logo_url">شعار الشركة (اللوجو)</Label>
                            <Input id="logo_url" value={formData.logo_url || ''} onChange={handleInputChange} dir="ltr" placeholder="https://.../logo.png" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="system_background_url">خلفية صفحات النظام</Label>
                            <Input id="system_background_url" value={formData.system_background_url || ''} onChange={handleInputChange} dir="ltr" placeholder="https://.../background.jpg" />
                        </div>
                    </div>
                </div>

                <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold text-base">عناصر الطباعة</h3>
                    <div className="grid gap-2">
                        <Label htmlFor="letterhead_image_url">صورة الترويسة (Header)</Label>
                        <Input id="letterhead_image_url" value={formData.letterhead_image_url || ''} onChange={handleInputChange} dir="ltr" placeholder="https://.../header.png" />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="footer_image_url">صورة التذييل (Footer)</Label>
                        <Input id="footer_image_url" value={formData.footer_image_url || ''} onChange={handleInputChange} dir="ltr" placeholder="https://.../footer.png" />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="watermark_image_url">صورة العلامة المائية (Watermark)</Label>
                        <Input id="watermark_image_url" value={formData.watermark_image_url || ''} onChange={handleInputChange} dir="ltr" placeholder="https://.../watermark.png" />
                    </div>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="company_name">اسم الشركة <span className="text-destructive">*</span></Label>
                        <Input id="company_name" value={formData.company_name || ''} onChange={handleInputChange} required />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="tax_number">الرقم الضريبي (إن وجد)</Label>
                        <Input id="tax_number" value={formData.tax_number || ''} onChange={handleInputChange} />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="phone">رقم الهاتف</Label>
                        <Input id="phone" value={formData.phone || ''} onChange={handleInputChange} dir="ltr" />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="email">البريد الإلكتروني</Label>
                        <Input id="email" type="email" value={formData.email || ''} onChange={handleInputChange} dir="ltr" />
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="address">العنوان</Label>
                    <Textarea id="address" value={formData.address || ''} onChange={handleInputChange} rows={3} />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="letterhead_text">نص إضافي في الترويسة (اختياري)</Label>
                    <Input id="letterhead_text" value={formData.letterhead_text || ''} onChange={handleInputChange} placeholder="مثال: سجل تجاري رقم..." />
                </div>
            </CardContent>
            <CardFooter className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
                    {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </Button>
            </CardFooter>
        </Card>
    );
}

    