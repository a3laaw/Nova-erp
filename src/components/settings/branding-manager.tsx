'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBranding, type BrandingSettings } from '@/context/branding-context';
import { useFirebase, useStorage } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, ImageIcon, X } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '../ui/separator';
import Image from 'next/image';

// Reusable Image Upload Component
function ImageUploadField({
  id,
  label,
  currentUrl,
  onUrlChange,
  onFileChange,
}: {
  id: keyof BrandingSettings;
  label: string;
  currentUrl?: string;
  onUrlChange: (url: string) => void;
  onFileChange: (file: File | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      onFileChange(file);
      onUrlChange(''); // Clear URL if a file is chosen
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUrlChange(e.target.value);
    setPreview(null); // Clear file preview if URL is typed
    if (fileInputRef.current) fileInputRef.current.value = '';
    onFileChange(null);
  };
  
  const displayUrl = preview || currentUrl;

  return (
    <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-md border flex items-center justify-center bg-muted/50 flex-shrink-0">
                {displayUrl ? (
                    <Image src={displayUrl} alt={label} width={96} height={96} className="object-contain rounded-md" />
                ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
            </div>
            <div className="flex-grow space-y-2">
                <Input
                    type="file"
                    id={id + '-file'}
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/png, image/jpeg, image/gif, image/svg+xml"
                    className="text-xs"
                />
                 <Input
                    id={id + '-url'}
                    type="text"
                    value={currentUrl || ''}
                    onChange={handleUrlChange}
                    placeholder="أو الصق رابط صورة هنا..."
                    dir="ltr"
                />
            </div>
        </div>
    </div>
  );
}


export function BrandingManager() {
    const { firestore } = useFirebase();
    const storage = useStorage();
    const { branding, loading } = useBranding();
    const { toast } = useToast();
    
    const [formData, setFormData] = useState<Partial<BrandingSettings>>({});
    const [filesToUpload, setFilesToUpload] = useState<Record<string, File | null>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (branding) {
            setFormData(branding);
        }
    }, [branding]);

    const handleFieldChange = (field: keyof BrandingSettings, value: any) => {
        setFormData(prev => ({...prev, [field]: value}));
    };
    
    const handleFileChange = (field: keyof BrandingSettings, file: File | null) => {
        setFilesToUpload(prev => ({ ...prev, [field]: file }));
    };

    const handleSave = async () => {
        if (!firestore || !storage) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بالخدمات السحابية.'});
            return;
        }
        if (!formData.company_name) {
            toast({ variant: 'destructive', title: 'حقل مطلوب', description: 'اسم الشركة مطلوب.'});
            return;
        }

        setIsSaving(true);
        
        try {
            const dataToSave = { ...formData };

            // Upload files and get URLs
            for (const key in filesToUpload) {
                const file = filesToUpload[key as keyof typeof filesToUpload];
                if (file) {
                    const storageRef = ref(storage, `branding/${key}_${Date.now()}_${file.name}`);
                    const uploadResult = await uploadBytes(storageRef, file);
                    const downloadURL = await getDownloadURL(uploadResult.ref);
                    dataToSave[key as keyof BrandingSettings] = downloadURL;
                }
            }

            const settingsRef = doc(firestore, 'company_settings', 'main');
            await setDoc(settingsRef, dataToSave, { merge: true });
            
            setFilesToUpload({}); // Clear uploaded files
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
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
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
                 <div className="space-y-6 p-4 border rounded-lg">
                    <h3 className="font-semibold text-base">صور الهوية البصرية</h3>
                    <p className="text-sm text-muted-foreground">يمكنك إما لصق رابط صورة مباشرة أو رفع ملف من جهازك.</p>
                     <div className="grid md:grid-cols-2 gap-8">
                        <ImageUploadField id="logo_url" label="شعار الشركة (اللوجو)" currentUrl={formData.logo_url} onUrlChange={(url) => handleFieldChange('logo_url', url)} onFileChange={(file) => handleFileChange('logo_url', file)} />
                        <ImageUploadField id="system_background_url" label="خلفية صفحات النظام" currentUrl={formData.system_background_url} onUrlChange={(url) => handleFieldChange('system_background_url', url)} onFileChange={(file) => handleFileChange('system_background_url', file)} />
                    </div>
                </div>

                <div className="space-y-6 p-4 border rounded-lg">
                    <h3 className="font-semibold text-base">عناصر الطباعة</h3>
                     <div className="grid md:grid-cols-2 gap-8">
                        <ImageUploadField id="letterhead_image_url" label="صورة الترويسة (Header)" currentUrl={formData.letterhead_image_url} onUrlChange={(url) => handleFieldChange('letterhead_image_url', url)} onFileChange={(file) => handleFileChange('letterhead_image_url', file)} />
                        <ImageUploadField id="footer_image_url" label="صورة التذييل (Footer)" currentUrl={formData.footer_image_url} onUrlChange={(url) => handleFieldChange('footer_image_url', url)} onFileChange={(file) => handleFileChange('footer_image_url', file)} />
                     </div>
                     <ImageUploadField id="watermark_image_url" label="صورة العلامة المائية (Watermark)" currentUrl={formData.watermark_image_url} onUrlChange={(url) => handleFieldChange('watermark_image_url', url)} onFileChange={(file) => handleFileChange('watermark_image_url', file)} />
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="company_name">اسم الشركة <span className="text-destructive">*</span></Label>
                        <Input id="company_name" value={formData.company_name || ''} onChange={(e) => handleFieldChange('company_name', e.target.value)} required />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="tax_number">الرقم الضريبي (إن وجد)</Label>
                        <Input id="tax_number" value={formData.tax_number || ''} onChange={(e) => handleFieldChange('tax_number', e.target.value)} />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="phone">رقم الهاتف</Label>
                        <Input id="phone" value={formData.phone || ''} onChange={(e) => handleFieldChange('phone', e.target.value)} dir="ltr" />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="email">البريد الإلكتروني</Label>
                        <Input id="email" type="email" value={formData.email || ''} onChange={(e) => handleFieldChange('email', e.target.value)} dir="ltr" />
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="address">العنوان</Label>
                    <Textarea id="address" value={formData.address || ''} onChange={(e) => handleFieldChange('address', e.target.value)} rows={3} />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="letterhead_text">نص إضافي في الترويسة (اختياري)</Label>
                    <Input id="letterhead_text" value={formData.letterhead_text || ''} onChange={(e) => handleFieldChange('letterhead_text', e.target.value)} placeholder="مثال: سجل تجاري رقم..." />
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