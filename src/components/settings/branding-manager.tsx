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
import { Separator } from '../ui/separator';

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

    const uploadFile = (file: File, type: 'logo' | 'letterhead'): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!storage) {
                return reject(new Error("Firebase Storage is not available."));
            }
            const setProgress = type === 'logo' ? setLogoUploadProgress : setLetterheadUploadProgress;
            setProgress(0);
            const timestamp = Date.now();
            const storageRef = ref(storage, `company_assets/${type}_${timestamp}_${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setProgress(progress);
                },
                (error) => {
                    console.error(`${type} upload failed:`, error);
                    setProgress(null);
                    reject(error);
                },
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        setProgress(null);
                        resolve(downloadURL);
                    } catch (e) {
                         reject(e);
                    }
                }
            );
        });
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
        setLogoUploadError(null);
        setLetterheadUploadError(null);
        
        try {
            const uploadPromises: Promise<{type: 'logo' | 'letterhead', url: string}>[] = [];

            if (logoFile) {
                uploadPromises.push(
                    uploadFile(logoFile, 'logo').then(url => ({ type: 'logo' as const, url }))
                );
            }
            if (letterheadFile) {
                uploadPromises.push(
                    uploadFile(letterheadFile, 'letterhead').then(url => ({ type: 'letterhead' as const, url }))
                );
            }

            const uploadedFiles = await Promise.all(uploadPromises);

            const updates: Partial<BrandingSettings> = { ...formData };
            uploadedFiles.forEach(file => {
                if (file.type === 'logo') {
                    updates.logo_url = file.url;
                } else if (file.type === 'letterhead') {
                    updates.letterhead_image_url = file.url;
                }
            });

            const settingsRef = doc(firestore, 'company_settings', 'main');
            await setDoc(settingsRef, updates, { merge: true });
            
            if (logoFile) setLogoFile(null);
            if (letterheadFile) setLetterheadFile(null);

            toast({ title: 'نجاح', description: 'تم حفظ إعدادات العلامة التجارية بنجاح.' });

        } catch (error: any) {
            console.error("Error saving branding settings:", error);
            const errorMessage = error.code ? `رمز الخطأ: ${error.code}` : error.message;
            toast({ 
                variant: 'destructive', 
                title: 'فشل الحفظ', 
                description: `حدث خطأ أثناء رفع الملفات أو حفظ البيانات. ${errorMessage}`
            });
            if (error.message.includes('logo')) setLogoUploadError(error.message);
            if (error.message.includes('letterhead')) setLetterheadUploadError(error.message);

        } finally {
            setIsSaving(false);
            setLogoUploadProgress(null);
            setLetterheadUploadProgress(null);
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
                    {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </Button>
            </CardFooter>
        </Card>
    );
}
