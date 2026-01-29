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
import { Loader2, Save, Upload } from 'lucide-react';
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
    
    // Logo state
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoUploadProgress, setLogoUploadProgress] = useState<number | null>(null);
    const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
    
    // Letterhead state
    const [letterheadFile, setLetterheadFile] = useState<File | null>(null);
    const [letterheadUploadProgress, setLetterheadUploadProgress] = useState<number | null>(null);
    const [letterheadUploadError, setLetterheadUploadError] = useState<string | null>(null);
    const [letterheadPreviewUrl, setLetterheadPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if (branding) {
            setFormData(branding);
            if (branding.logo_url) {
                setLogoPreviewUrl(branding.logo_url);
            }
             if (branding.letterhead_image_url) {
                setLetterheadPreviewUrl(branding.letterhead_image_url);
            }
        }
    }, [branding]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({...prev, [id]: value}));
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'letterhead') => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isLogo = type === 'logo';
        const setError = isLogo ? setLogoUploadError : setLetterheadUploadError;
        const setFile = isLogo ? setLogoFile : setLetterheadFile;
        const setPreview = isLogo ? setLogoPreviewUrl : setLetterheadPreviewUrl;
        
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            setError('نوع الملف غير صالح. الرجاء رفع صورة (jpg, png).');
            return;
        }
        if (file.size > 1024 * 1024) { // 1MB limit
            setError('حجم الصورة كبير جدًا. الحد الأقصى 1MB.');
            return;
        }
        
        setError(null);
        setFile(file);
        setPreview(URL.createObjectURL(file));
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
        let finalLetterheadUrl = formData.letterhead_image_url || '';
        
        const uploadPromises: Promise<any>[] = [];

        if (logoFile && storage) {
            const logoPromise = new Promise<void>((resolve, reject) => {
                const timestamp = Date.now();
                const storageRef = ref(storage, `company_assets/logo_${timestamp}_${logoFile.name}`);
                const uploadTask = uploadBytesResumable(storageRef, logoFile);
                uploadTask.on('state_changed',
                    (snapshot) => setLogoUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                    (error) => { console.error("Logo upload failed:", error); reject(error); },
                    async () => {
                        finalLogoUrl = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve();
                    }
                );
            });
            uploadPromises.push(logoPromise);
        }

        if (letterheadFile && storage) {
            const letterheadPromise = new Promise<void>((resolve, reject) => {
                const timestamp = Date.now();
                const storageRef = ref(storage, `company_assets/letterhead_${timestamp}_${letterheadFile.name}`);
                const uploadTask = uploadBytesResumable(storageRef, letterheadFile);
                 uploadTask.on('state_changed',
                    (snapshot) => setLetterheadUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                    (error) => { console.error("Letterhead upload failed:", error); reject(error); },
                    async () => {
                        finalLetterheadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve();
                    }
                );
            });
            uploadPromises.push(letterheadPromise);
        }
        
        try {
            await Promise.all(uploadPromises);
            
            const settingsRef = doc(firestore, 'company_settings', 'main');
            const dataToSave = { ...formData, logo_url: finalLogoUrl, letterhead_image_url: finalLetterheadUrl };
            await setDoc(settingsRef, dataToSave, { merge: true });
            
            toast({ title: 'نجاح', description: 'تم حفظ إعدادات العلامة التجارية.' });
            
            setLogoFile(null);
            setLetterheadFile(null);
            setLogoUploadProgress(null);
            setLetterheadUploadProgress(null);

        } catch (error) {
            console.error("Error during save process:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الإعدادات.' });
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
                    <h3 className="font-semibold text-base">شعار الشركة (اللوجو)</h3>
                     <div className="grid gap-2">
                        <div className="flex items-center gap-4">
                            {logoPreviewUrl && <Image src={logoPreviewUrl} alt="Logo Preview" width={64} height={64} className="rounded-md border object-contain p-1" />}
                             <div className="flex-1">
                                <Input id="logo-upload" type="file" onChange={(e) => handleFileChange(e, 'logo')} accept="image/png, image/jpeg, image/jpg" />
                                 <p className="text-xs text-muted-foreground mt-2">.jpg, .png | الحد الأقصى 1MB</p>
                            </div>
                        </div>
                        {logoUploadProgress !== null && <Progress value={logoUploadProgress} className="w-full h-2" />}
                        {logoUploadError && <p className="text-xs text-destructive">{logoUploadError}</p>}
                    </div>
                </div>

                <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold text-base">ترويسة الشركة (Letterhead)</h3>
                     <div className="grid gap-2">
                        <div className="flex items-center gap-4">
                            {letterheadPreviewUrl && <Image src={letterheadPreviewUrl} alt="Letterhead Preview" width={128} height={64} className="rounded-md border object-contain p-1" />}
                             <div className="flex-1">
                                <Input id="letterhead-upload" type="file" onChange={(e) => handleFileChange(e, 'letterhead')} accept="image/png, image/jpeg, image/jpg" />
                                 <p className="text-xs text-muted-foreground mt-2">.jpg, .png | الحد الأقصى 1MB. يفضل أن تكون الصورة أفقية (Landscape).</p>
                            </div>
                        </div>
                        {letterheadUploadProgress !== null && <Progress value={letterheadUploadProgress} className="w-full h-2" />}
                        {letterheadUploadError && <p className="text-xs text-destructive">{letterheadUploadError}</p>}
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
                    حفظ الإعدادات
                </Button>
            </CardFooter>
        </Card>
    );
}
