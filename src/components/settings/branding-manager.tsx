'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Loader2, Save, ImageIcon, Palette, ArrowRight } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '../ui/separator';
import Image from 'next/image';
import { cleanFirestoreData, cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

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
      onUrlChange(''); 
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUrlChange(e.target.value);
    setPreview(null); 
    if (fileInputRef.current) fileInputRef.current.value = '';
    onFileChange(null);
  };
  
  const displayUrl = preview || currentUrl;

  return (
    <div className="space-y-3 p-6 border-2 border-dashed rounded-[2rem] bg-muted/5 group hover:border-primary/30 transition-colors">
        <Label htmlFor={id} className="font-black text-foreground flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" /> {label}
        </Label>
        <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-32 h-32 rounded-3xl border-2 border-white shadow-md flex items-center justify-center bg-white flex-shrink-0 relative overflow-hidden">
                {displayUrl ? (
                    <Image 
                        src={displayUrl} 
                        alt={label} 
                        width={128} 
                        height={128} 
                        className="object-contain w-full h-full p-2" 
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
                        className="h-10 text-xs cursor-pointer file:font-bold file:text-primary rounded-xl"
                    />
                </div>
                <div className="grid gap-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">أو رابط خارجي مباشر</Label>
                    <Input
                        id={id + '-url'}
                        type="text"
                        value={currentUrl || ''}
                        onChange={handleUrlChange}
                        placeholder="https://example.com/image.png"
                        dir="ltr"
                        className="h-10 font-mono text-[10px] rounded-xl shadow-inner"
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
    const router = useRouter();
    
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
        if (!firestore || !storage) return;
        if (!formData.company_name) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يجب إدخال اسم الشركة.'});
            return;
        }

        setIsSaving(true);
        try {
            const dataToSave = { ...formData };
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
            await setDoc(settingsRef, cleanFirestoreData(dataToSave), { merge: true });
            setFilesToUpload({}); 
            toast({ title: 'نجاح التحديث', description: 'تم حفظ الهوية البصرية بنجاح.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="space-y-6"><Skeleton className="h-20 w-full rounded-[2.5rem]"/><Skeleton className="h-96 w-full rounded-[2.5rem]"/></div>;

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-purple-50">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-600/10 rounded-2xl text-purple-600 shadow-inner">
                                <Palette className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black text-purple-900">إعدادات العلامة التجارية</CardTitle>
                                <CardDescription className="text-base font-medium">تخصيص هوية النظام والشعارات المعتمدة في التقارير.</CardDescription>
                            </div>
                        </div>
                        <Button onClick={() => router.back()} variant="ghost" className="rounded-xl font-bold gap-2 text-purple-700 hover:bg-purple-50">
                            <ArrowRight className="h-4 w-4" /> العودة
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-xl rounded-[3rem] overflow-hidden bg-white">
                <CardContent className="pt-10 space-y-12 px-10">
                    <div className="space-y-8">
                        <h3 className="font-black text-xl text-primary border-r-8 border-primary pr-4">الهوية البصرية</h3>
                        <div className="grid md:grid-cols-2 gap-8">
                            <ImageUploadField id="logo_url" label="شعار الشركة (الرئيسي)" currentUrl={formData.logo_url} onUrlChange={(url) => handleFieldChange('logo_url', url)} onFileChange={(file) => handleFileChange('logo_url', file)} />
                            <ImageUploadField id="system_background_url" label="خلفية شاشات النظام" currentUrl={formData.system_background_url} onUrlChange={(url) => handleFieldChange('system_background_url', url)} onFileChange={(file) => handleFileChange('system_background_url', file)} />
                        </div>
                    </div>

                    <div className="space-y-8">
                        <h3 className="font-black text-xl text-primary border-r-8 border-primary pr-4">قوالب الطباعة (A4)</h3>
                        <div className="grid md:grid-cols-2 gap-8">
                            <ImageUploadField id="letterhead_image_url" label="ترويسة المطبوعات (Header)" currentUrl={formData.letterhead_image_url} onUrlChange={(url) => handleFieldChange('letterhead_image_url', url)} onFileChange={(file) => handleFileChange('letterhead_image_url', file)} />
                            <ImageUploadField id="footer_image_url" label="تذييل المطبوعات (Footer)" currentUrl={formData.footer_image_url} onUrlChange={(url) => handleFieldChange('footer_image_url', url)} onFileChange={(file) => handleFileChange('footer_image_url', file)} />
                        </div>
                        <ImageUploadField id="watermark_image_url" label="العلامة المائية للوثائق (Watermark)" currentUrl={formData.watermark_image_url} onUrlChange={(url) => handleFieldChange('watermark_image_url', url)} onFileChange={(file) => handleFileChange('watermark_image_url', file)} />
                    </div>
                    
                    <Separator className="my-10" />
                    
                    <div className="space-y-8 pb-10">
                        <h3 className="font-black text-xl text-primary border-r-8 border-primary pr-4">البيانات القانونية والعناوين</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="grid gap-3">
                                <Label className="font-black text-gray-700 px-1">اسم المنشأة الرسمي *</Label>
                                <Input value={formData.company_name || ''} onChange={(e) => handleFieldChange('company_name', e.target.value)} required className="h-12 rounded-2xl text-lg font-bold shadow-inner" />
                            </div>
                            <div className="grid gap-3">
                                <Label className="font-black text-gray-700 px-1">رقم السجل التجاري / الضريبي</Label>
                                <Input value={formData.tax_number || ''} onChange={(e) => handleFieldChange('tax_number', e.target.value)} className="h-12 rounded-2xl font-mono shadow-inner" />
                            </div>
                            <div className="grid gap-3">
                                <Label className="font-black text-gray-700 px-1">رقم الهاتف الرسمي</Label>
                                <Input value={formData.phone || ''} onChange={(e) => handleFieldChange('phone', e.target.value)} dir="ltr" className="h-12 rounded-2xl font-mono shadow-inner" />
                            </div>
                            <div className="grid gap-3">
                                <Label className="font-black text-gray-700 px-1">البريد الإلكتروني للشركة</Label>
                                <Input value={formData.email || ''} onChange={(e) => handleFieldChange('email', e.target.value)} dir="ltr" className="h-12 rounded-2xl font-mono shadow-inner" />
                            </div>
                        </div>
                        <div className="grid gap-3">
                            <Label className="font-black text-gray-700 px-1">العنوان التفصيلي المعتمد في العقود</Label>
                            <Textarea value={formData.address || ''} onChange={(e) => handleFieldChange('address', e.target.value)} rows={3} className="rounded-[2rem] p-6 text-base font-medium shadow-inner border-2" />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-10 border-t bg-muted/10 flex justify-end">
                    <Button onClick={handleSave} disabled={isSaving} className="h-14 px-16 rounded-2xl font-black text-xl shadow-xl shadow-primary/30 min-w-[280px] gap-3">
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6"/> : <Save className="h-6 w-6" />}
                        اعتماد وحفظ التغييرات
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
