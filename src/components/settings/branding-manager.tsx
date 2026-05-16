'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useBranding, type BrandingSettings } from '@/context/branding-context';
import { useFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, ImageIcon, Palette, ArrowRight, Activity, Sparkles } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '../ui/separator';
import Image from 'next/image';
import { cleanFirestoreData, cn, getTenantPath } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/auth-context';

function ImageUploadField({
  id,
  label,
  currentUrl,
  onUrlChange,
  onFileChange,
  disabled = false
}: {
  id: string;
  label: string;
  currentUrl?: string;
  onUrlChange: (url: string) => void;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
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
                        fill
                        className="object-contain p-2" 
                        unoptimized
                    />
                ) : (
                    <ImageIcon className="h-10 w-10 text-muted-foreground opacity-20" />
                )}
            </div>
            <div className="flex-grow w-full space-y-3">
                <div className="grid gap-1.5">
                    <Label className="text-[10px] font-black text-muted-foreground">رفع ملف من الجهاز</Label>
                    <Input
                        type="file"
                        id={id + '-file'}
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        disabled={disabled}
                        className="h-10 text-xs cursor-pointer rounded-xl"
                    />
                </div>
                <div className="grid gap-1.5">
                    <Label className="text-[10px] font-black text-muted-foreground">أو رابط مباشر</Label>
                    <Input
                        id={id + '-url'}
                        type="text"
                        value={currentUrl || ''}
                        onChange={handleUrlChange}
                        disabled={disabled}
                        placeholder="https://..."
                        dir="ltr"
                        className="h-10 font-mono text-[10px] rounded-xl"
                    />
                </div>
            </div>
        </div>
    </div>
  );
}

export function BrandingManager() {
    const { firestore, storage } = useFirebase();
    const { user: currentUser, refreshToken } = useAuth();
    const { branding, loading } = useBranding();
    const { toast } = useToast();
    const router = useRouter();
    
    const [formData, setFormData] = useState<Partial<BrandingSettings>>({});
    const [filesToUpload, setFilesToUpload] = useState<Record<string, File | null>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (branding) {
            // 🛡️ التطهير من المعرفات الافتراضية لمنع التضارب
            const { id, ...cleanData } = branding;
            setFormData(cleanData);
        }
    }, [branding]);

    const handleFieldChange = (field: string, value: any) => {
        setFormData(prev => ({...prev, [field]: value}));
    };
    
    const handleFileChange = (field: string, file: File | null) => {
        setFilesToUpload(prev => ({ ...prev, [field]: file }));
    };

    const handleSave = async () => {
        const tenantId = currentUser?.currentCompanyId;
        if (!firestore || !tenantId) {
            toast({ variant: 'destructive', title: 'خطأ في الهوية', description: 'لم نتمكن من تحديد المنشأة. يرجى إعادة تسجيل الدخول.' });
            return;
        }
        
        if (!formData.company_name) {
            toast({ variant: 'destructive', title: 'بيان ناقص', description: 'اسم المنشأة حقل إلزامي.'});
            return;
        }

        setIsSaving(true);
        try {
            // 1. ⚡ محاولة تجديد التوكن لضمان الصلاحيات
            await refreshToken();

            const dataToSave = { ...formData };
            delete (dataToSave as any).id;

            // 2. معالجة الصور
            if (storage) {
                for (const key in filesToUpload) {
                    const file = filesToUpload[key];
                    if (file) {
                        try {
                            const storageRef = ref(storage, `companies/${tenantId}/branding/${key}_${Date.now()}`);
                            const uploadResult = await uploadBytes(storageRef, file);
                            const downloadURL = await getDownloadURL(uploadResult.ref);
                            (dataToSave as any)[key] = downloadURL;
                        } catch (stErr) {
                            console.error(`Storage error for ${key}:`, stErr);
                        }
                    }
                }
            }
            
            // 3. الحفظ المباشر في المسار السيادي المعزول
            const settingsPath = getTenantPath('settings/branding', tenantId);
            const settingsRef = doc(firestore, settingsPath);
            
            await setDoc(settingsRef, cleanFirestoreData(dataToSave), { merge: true });
            
            toast({ title: '✅ تم الحفظ بنجاح', description: 'تم تحديث الهوية البصرية والمزامنة السحابية.' });
            setFilesToUpload({});

        } catch (error: any) {
            console.error("Branding save error:", error);
            toast({ 
                variant: 'destructive', 
                title: 'فشل ترحيل البيانات', 
                description: error.code === 'permission-denied' 
                    ? 'تم رفض الوصول من خادم الحماية. يرجى تجربة إعادة تسجيل الدخول لتفعيل الصلاحيات الجديدة.' 
                    : error.message 
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="space-y-6"><Skeleton className="h-20 w-full rounded-2xl"/><Skeleton className="h-96 w-full rounded-2xl"/></div>;

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-purple-50">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-600/10 rounded-2xl text-purple-600 shadow-inner">
                                <Palette className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black">إعدادات الهوية البصرية</CardTitle>
                                <CardDescription className="text-base font-medium">تخصيص شعار الشركة، المطبوعات الرسمية، وبيانات العقود.</CardDescription>
                            </div>
                        </div>
                        <Button onClick={() => router.back()} variant="ghost" className="rounded-xl font-bold gap-2">
                            <ArrowRight className="h-4 w-4" /> العودة
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-xl rounded-[3rem] overflow-hidden bg-white/60 backdrop-blur-xl">
                <CardContent className="pt-10 space-y-12 px-10">
                    <div className="space-y-8">
                        <h3 className="font-black text-xl text-primary border-r-8 border-primary pr-4 flex items-center gap-3">النشاط والبيانات الرسمية</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="grid gap-3">
                                <Label className="font-black text-[10px] uppercase pr-1">اسم المنشأة الرسمي *</Label>
                                <Input value={formData.company_name || ''} onChange={(e) => handleFieldChange('company_name', e.target.value)} className="h-12 rounded-2xl border-2 font-bold" />
                            </div>
                            <div className="grid gap-3">
                                <Label className="font-black text-[10px] uppercase pr-1">نوع النشاط</Label>
                                <Select value={formData.activity_type} onValueChange={(v: any) => handleFieldChange('activity_type', v)}>
                                    <SelectTrigger className="h-12 rounded-2xl border-2 font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="general">تجارة عامة</SelectItem>
                                        <SelectItem value="construction">مقاولات وبناء</SelectItem>
                                        <SelectItem value="consulting">استشارات هندسية</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <Separator className="opacity-20" />

                    <div className="space-y-8">
                        <h3 className="font-black text-xl text-primary border-r-8 border-primary pr-4">صور المطبوعات والهوية</h3>
                        <div className="grid md:grid-cols-2 gap-8">
                            <ImageUploadField id="logo_url" label="شعار المنشأة (مربع)" currentUrl={formData.logo_url || undefined} onUrlChange={(url) => handleFieldChange('logo_url', url)} onFileChange={(file) => handleFileChange('logo_url', file)} disabled={isSaving} />
                            <ImageUploadField id="header_image_url" label="ترويسة المكاتبات (Header)" currentUrl={formData.header_image_url || undefined} onUrlChange={(url) => handleFieldChange('header_image_url', url)} onFileChange={(file) => handleFileChange('header_image_url', file)} disabled={isSaving} />
                        </div>
                        <div className="grid md:grid-cols-2 gap-8">
                            <ImageUploadField id="footer_image_url" label="تذييل المكاتبات (Footer)" currentUrl={formData.footer_image_url || undefined} onUrlChange={(url) => handleFieldChange('footer_image_url', url)} onFileChange={(file) => handleFileChange('footer_image_url', file)} disabled={isSaving} />
                            <div className="grid gap-3">
                                <Label className="font-black text-[10px] uppercase pr-1">العنوان المعتمد في العقود</Label>
                                <Textarea value={formData.address || ''} onChange={(e) => handleFieldChange('address', e.target.value)} rows={5} className="rounded-[2rem] p-6 border-2" placeholder="أدخل العنوان التفصيلي..." />
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-10 border-t bg-muted/10 flex justify-end">
                    <Button onClick={handleSave} disabled={isSaving} className="h-14 px-20 rounded-[2.5rem] font-black text-xl shadow-xl shadow-primary/30 min-w-[320px] gap-4">
                        {isSaving ? (
                            <>
                                <Loader2 className="animate-spin h-7 w-7" />
                                <span>جاري ترحيل البيانات...</span>
                            </>
                        ) : (
                            <>
                                <Save className="h-7 w-7" />
                                <span>اعتماد وحفظ التغييرات</span>
                            </>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}