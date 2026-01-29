'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBranding, type BrandingSettings } from '@/context/branding-context';
import { useFirebase, useStorage } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Progress } from '../ui/progress';
import Image from 'next/image';

export function BrandingManager() {
    const { firestore } = useFirebase();
    const storage = useStorage();
    const { branding, loading } = useBranding();
    const { toast } = useToast();
    
    const [formData, setFormData] = useState<Partial<BrandingSettings>>({});
    const [isSaving, setIsSaving] = useState(false);
    
    // File upload state
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if (branding) {
            setFormData(branding);
            if (branding.logo_url) {
                setPreviewUrl(branding.logo_url);
            }
        }
    }, [branding]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({...prev, [id]: value}));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            setUploadError('نوع الملف غير صالح. الرجاء رفع صورة (jpg, png).');
            return;
        }
        if (file.size > 500 * 1024) { // 500KB
            setUploadError('حجم الصورة كبير جدًا. الحد الأقصى 500KB.');
            return;
        }

        setUploadError(null);
        setLogoFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const handleSave = async () => {
        if (!firestore) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات.'});
            return;
        }
        if (!formData.company_name) {
            toast({ variant: 'destructive', title: 'حقل مطلوب', description: 'اسم الشركة مطلوب.'});
            return;
        }

        setIsSaving(true);
        let finalLogoUrl = formData.logo_url || '';

        // If a new file is selected, upload it first
        if (logoFile && storage) {
            const timestamp = Date.now();
            const storageRef = ref(storage, `company_logos/main/logo_${timestamp}_${logoFile.name}`);
            const uploadTask = uploadBytesResumable(storageRef, logoFile);

            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setUploadProgress(progress);
                    },
                    (error) => {
                        console.error("Upload failed:", error);
                        setUploadError('فشل رفع الشعار. الرجاء المحاولة مرة أخرى.');
                        reject(error);
                    },
                    async () => {
                        try {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            console.log("تم رفع اللوجو:", downloadURL);
                            finalLogoUrl = downloadURL;
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    }
                );
            }).catch(error => {
                 toast({ variant: 'destructive', title: 'خطأ في الرفع', description: 'فشل الحصول على رابط الشعار بعد الرفع.' });
                 setIsSaving(false);
                 setUploadProgress(null);
                 return; // Stop execution
            });
        }
        
        // Now save all data to Firestore
        try {
            const settingsRef = doc(firestore, 'company_settings', 'main');
            const dataToSave = { ...formData, logo_url: finalLogoUrl };
            await setDoc(settingsRef, dataToSave, { merge: true });
            toast({ title: 'نجاح', description: 'تم حفظ إعدادات العلامة التجارية.' });
            setLogoFile(null); // Clear file after successful save
            setUploadProgress(null); // Clear progress
        } catch (error) {
            console.error("Error saving branding settings:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الإعدادات في قاعدة البيانات.' });
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
            <CardContent className="space-y-6">
                <div className="grid gap-2">
                    <Label htmlFor="logo-upload">شعار الشركة (اللوجو)</Label>
                    <div className="flex items-center gap-4">
                        {previewUrl && <Image src={previewUrl} alt="Logo Preview" width={64} height={64} className="rounded-md border object-contain p-1" />}
                         <div className="flex-1">
                            <Input id="logo-upload" type="file" onChange={handleFileChange} accept="image/png, image/jpeg, image/jpg" />
                             <p className="text-xs text-muted-foreground mt-2">.jpg, .png | الحد الأقصى 500KB</p>
                        </div>
                    </div>
                    {uploadProgress !== null && <Progress value={uploadProgress} className="w-full h-2" />}
                    {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
                </div>
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
                    حفظ الإعدادات
                </Button>
            </CardFooter>
        </Card>
    );
}
