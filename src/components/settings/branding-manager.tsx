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
import { Loader2, Save, ImageIcon, X, Palette } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '../ui/separator';
import Image from 'next/image';
import { cleanFirestoreData } from '@/lib/utils';

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
    <div className="space-y-3 p-4 border rounded-2xl bg-background shadow-sm">
        <Label htmlFor={id} className="font-bold text-gray-700">{label}</Label>
        <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-32 h-32 rounded-2xl border-2 border-dashed flex items-center justify-center bg-muted/30 flex-shrink-0 relative overflow-hidden group">
                {displayUrl ? (
                    <Image 
                        src={displayUrl} 
                        alt={label} 
                        width={128} 
                        height={128} 
                        className="object-contain w-full h-full transition-transform group-hover:scale-110" 
                    />
                ) : (
                    <ImageIcon className="h-10 w-10 text-muted-foreground opacity-20" />
                )}
            </div>
            <div className="flex-grow w-full space-y-3">
                <div className="grid gap-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">رفع ملف من الجهاز</Label>
                    <Input
                        type="file"
                        id={id + '-file'}
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/png, image/jpeg, image/gif, image/svg+xml"
                        className="h-9 text-xs cursor-pointer file:font-bold file:text-primary"
                    />
                </div>
                <div className="grid gap-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">أو رابط خارجي مباشر</Label>
                    <Input
                        id={id + '-url'}
                        type="text"
                        value={currentUrl || ''}
                        onChange={handleUrlChange}
                        placeholder="https://example.com/logo.png"
                        dir="ltr"
                        className="h-9 font-mono text-[10px]"
                    />
                </div>
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
            toast({ variant: 'destructive', title: 'خطأ اتصال', description: 'لا يمكن الاتصال بخدمات التخزين السحابية حالياً.'});
            return;
        }
        if (!formData.company_name) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يجب إدخال اسم الشركة.'});
            return;
        }

        setIsSaving(true);
        
        try {
            const dataToSave = { ...formData };

            // التنفيذ الفعلي لعملية الرفع وقراءة الروابط (The "Upload and Read" Solution)
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
            // استخدام cleanFirestoreData لضمان عدم وجود undefined قبل الحفظ
            await setDoc(settingsRef, cleanFirestoreData(dataToSave), { merge: true });
            
            setFilesToUpload({}); 
            toast({ title: 'نجاح التحديث', description: 'تم حفظ وتطبيق التغييرات البصرية للعلامة التجارية.' });

        } catch (error: any) {
            console.error("Branding save error:", error);
            toast({ 
                variant: 'destructive', 
                title: 'فشل الحفظ', 
                description: 'تعذر حفظ الإعدادات. يرجى التحقق من اتصال الإنترنت.'
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="space-y-6"><Skeleton className="h-20 w-full rounded-[2.5rem]"/><Skeleton className="h-96 w-full rounded-3xl"/></div>;

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-purple-50">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-600/10 rounded-2xl text-purple-600 shadow-inner">
                            <Palette className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black">إعدادات العلامة التجارية</CardTitle>
                            <CardDescription className="text-base font-medium">تخصيص هوية النظام والشعار المعتمد في المطبوعات الرسمية.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="pt-8 space-y-10">
                    <div className="space-y-6">
                        <h3 className="font-black text-lg text-primary border-r-4 border-primary pr-3">الهوية البصرية (الصور)</h3>
                        <div className="grid md:grid-cols-2 gap-6">
                            <ImageUploadField id="logo_url" label="شعار الشركة الرسمي" currentUrl={formData.logo_url} onUrlChange={(url) => handleFieldChange('logo_url', url)} onFileChange={(file) => handleFileChange('logo_url', file)} />
                            <ImageUploadField id="system_background_url" label="خلفية شاشات النظام" currentUrl={formData.system_background_url} onUrlChange={(url) => handleFieldChange('system_background_url', url)} onFileChange={(file) => handleFileChange('system_background_url', file)} />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="font-black text-lg text-primary border-r-4 border-primary pr-3">قوالب الطباعة (Header & Footer)</h3>
                        <div className="grid md:grid-cols-2 gap-6">
                            <ImageUploadField id="letterhead_image_url" label="ترويسة المطبوعات (Header)" currentUrl={formData.letterhead_image_url} onUrlChange={(url) => handleFieldChange('letterhead_image_url', url)} onFileChange={(file) => handleFileChange('letterhead_image_url', file)} />
                            <ImageUploadField id="footer_image_url" label="تذييل المطبوعات (Footer)" currentUrl={formData.footer_image_url} onUrlChange={(url) => handleFieldChange('footer_image_url', url)} onFileChange={(file) => handleFileChange('footer_image_url', file)} />
                        </div>
                        <ImageUploadField id="watermark_image_url" label="العلامة المائية للوثائق (Watermark)" currentUrl={formData.watermark_image_url} onUrlChange={(url) => handleFieldChange('watermark_image_url', url)} onFileChange={(file) => handleFileChange('watermark_image_url', file)} />
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-6">
                        <h3 className="font-black text-lg text-primary border-r-4 border-primary pr-3">البيانات النصية القانونية</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="company_name" className="font-bold">اسم المنشأة *</Label>
                                <Input id="company_name" value={formData.company_name || ''} onChange={(e) => handleFieldChange('company_name', e.target.value)} required className="h-11 rounded-xl" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="tax_number" className="font-bold">الرقم الضريبي / السجل</Label>
                                <Input id="tax_number" value={formData.tax_number || ''} onChange={(e) => handleFieldChange('tax_number', e.target.value)} className="h-11 rounded-xl font-mono" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="phone" className="font-bold">رقم التواصل</Label>
                                <Input id="phone" value={formData.phone || ''} onChange={(e) => handleFieldChange('phone', e.target.value)} dir="ltr" className="h-11 rounded-xl font-mono" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="email" className="font-bold">البريد الرسمي</Label>
                                <Input id="email" type="email" value={formData.email || ''} onChange={(e) => handleFieldChange('email', e.target.value)} dir="ltr" className="h-11 rounded-xl font-mono" />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="address" className="font-bold">العنوان التفصيلي</Label>
                            <Textarea id="address" value={formData.address || ''} onChange={(e) => handleFieldChange('address', e.target.value)} rows={3} className="rounded-2xl" />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-8 border-t bg-muted/10 flex justify-end">
                    <Button onClick={handleSave} disabled={isSaving} className="h-12 px-12 rounded-xl font-black text-lg gap-2 shadow-xl shadow-primary/20">
                        {isSaving ? <Loader2 className="animate-spin h-5 w-5"/> : <Save className="h-5 w-5" />}
                        {isSaving ? 'جاري المزامنة...' : 'حفظ الهوية البصرية'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
