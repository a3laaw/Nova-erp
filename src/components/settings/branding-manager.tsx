
'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useBranding, type BrandingSettings } from '@/context/branding-context';
import { useFirebase, useStorage } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, ImageIcon, Palette, ArrowRight, Activity, ShieldCheck } from 'lucide-react';
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
  id: keyof BrandingSettings;
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
                        disabled={disabled}
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
                        disabled={disabled}
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
    const { storage } = useFirebase();
    const { user: currentUser } = useAuth();
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
        const tenantId = currentUser?.currentCompanyId;
        
        // 🛡️ فك حصار العبور: السماح بالحفظ حتى لو لم يتوفر الـ Storage (سيستخدم الروابط المباشرة)
        if (!firestore) return;
        
        if (!formData.company_name) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يجب إدخال اسم الشركة.'});
            return;
        }

        if (!tenantId && currentUser?.role !== 'Developer') {
            toast({ variant: 'destructive', title: 'خطأ في المنشأة', description: 'لا يمكن تحديد هوية الشركة الحالية.'});
            return;
        }

        setIsSaving(true);
        try {
            const dataToSave = { ...formData };
            
            // 🛡️ تطهير الحقول التقنية لمنع تضارب الـ IDs
            delete (dataToSave as any).id;

            // معالجة الملفات المرفوعة إن وجدت
            if (storage) {
                for (const key in filesToUpload) {
                    const file = filesToUpload[key as keyof typeof filesToUpload];
                    if (file) {
                        const storageRef = ref(storage, `companies/${tenantId || 'master'}/branding/${key}_${Date.now()}_${file.name}`);
                        const uploadResult = await uploadBytes(storageRef, file);
                        const downloadURL = await getDownloadURL(uploadResult.ref);
                        dataToSave[key as keyof BrandingSettings] = downloadURL;
                    }
                }
            }
            
            const settingsPath = getTenantPath('settings/branding', tenantId);
            const settingsRef = doc(firestore, settingsPath);
            
            await setDoc(settingsRef, cleanFirestoreData(dataToSave), { merge: true });
            
            setFilesToUpload({}); 
            toast({ title: 'نجاح التحديث', description: 'تم حفظ الهوية البصرية بنجاح.' });
            
            // التوجيه الفوري لضمان ثبات الواجهة
            setTimeout(() => {
                router.push('/dashboard/settings');
            }, 1000);

        } catch (error: any) {
            console.error("Branding save error:", error);
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: error.message || 'فشل الاتصال بالخادم.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="space-y-6" dir="rtl"><Skeleton className="h-20 w-full rounded-[2.5rem]"/><Skeleton className="h-96 w-full rounded-[2.5rem]"/></div>;

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-purple-50 dark:from-slate-900/60 dark:to-purple-950/20">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-600/10 rounded-2xl text-purple-600 shadow-inner">
                                <Palette className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black text-foreground">إعدادات الهوية البصرية</CardTitle>
                                <CardDescription className="text-base font-medium text-muted-foreground">تخصيص شعار المنشأة، ألوان المطبوعات، ومعايير المراسلات الرسمية.</CardDescription>
                            </div>
                        </div>
                        <Button onClick={() => router.back()} variant="ghost" className="rounded-xl font-bold gap-2 text-foreground hover:bg-white/10 no-print" disabled={isSaving}>
                            <ArrowRight className="h-4 w-4" /> العودة
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-xl rounded-[3rem] overflow-hidden bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl">
                <CardContent className="pt-10 space-y-12 px-10">
                    
                    <div className="space-y-8">
                        <h3 className="font-black text-xl text-primary border-r-8 border-primary pr-4 flex items-center gap-3">النشاط والتصنيف</h3>
                        <div className="p-6 bg-primary/5 rounded-[2rem] border-2 border-dashed border-primary/20 shadow-inner">
                            <div className="grid gap-3 max-w-md">
                                <Label className="font-black text-primary flex items-center gap-2">
                                    <Activity className="h-4 w-4" /> تصنيف نشاط الشركة المعتمد
                                </Label>
                                <Select value={formData.activityType} onValueChange={(v: any) => handleFieldChange('activityType', v)} disabled={isSaving}>
                                    <SelectTrigger className="h-12 rounded-2xl border-2 bg-background shadow-sm font-bold">
                                        <SelectValue placeholder="اختر النشاط..." />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="general">نشاط عام (تجاري/مكتب)</SelectItem>
                                        <SelectItem value="food_delivery">مطاعم وتوصيل أغذية</SelectItem>
                                        <SelectItem value="construction">مقاولات وبناء</SelectItem>
                                        <SelectItem value="consulting">استشارات هندسية</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <Separator className="opacity-20" />

                    <div className="space-y-8">
                        <h3 className="font-black text-xl text-primary border-r-8 border-primary pr-4">الشعار والخلفية</h3>
                        <div className="grid md:grid-cols-2 gap-8">
                            <ImageUploadField id="logo_url" label="شعار المنشأة (للتقارير)" currentUrl={formData.logo_url || undefined} onUrlChange={(url) => handleFieldChange('logo_url', url)} onFileChange={(file) => handleFileChange('logo_url', file)} disabled={isSaving} />
                            <ImageUploadField id="system_background_url" label="خلفية شاشات النظام" currentUrl={formData.system_background_url || undefined} onUrlChange={(url) => handleFieldChange('system_background_url', url)} onFileChange={(file) => handleFileChange('system_background_url', file)} disabled={isSaving} />
                        </div>
                    </div>

                    <div className="space-y-8">
                        <h3 className="font-black text-xl text-primary border-r-8 border-primary pr-4">قوالب المطبوعات الرسمية (A4)</h3>
                        <div className="grid md:grid-cols-2 gap-8">
                            <ImageUploadField id="letterhead_image_url" label="ترويسة المكاتبات (Header)" currentUrl={formData.letterhead_image_url || undefined} onUrlChange={(url) => handleFieldChange('letterhead_image_url', url)} onFileChange={(file) => handleFileChange('letterhead_image_url', file)} disabled={isSaving} />
                            <ImageUploadField id="footer_image_url" label="تذييل المكاتبات (Footer)" currentUrl={formData.footer_image_url || undefined} onUrlChange={(url) => handleFieldChange('footer_image_url', url)} onFileChange={(file) => handleFileChange('footer_image_url', file)} disabled={isSaving} />
                        </div>
                    </div>
                    
                    <Separator className="opacity-20" />
                    
                    <div className="space-y-8 pb-10">
                        <h3 className="font-black text-xl text-primary border-r-8 border-primary pr-4">البيانات الرسمية والعناوين</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="grid gap-3">
                                <Label className="font-black text-foreground px-1 uppercase text-[10px]">اسم المنشأة الرسمي *</Label>
                                <Input value={formData.company_name || ''} onChange={(e) => handleFieldChange('company_name', e.target.value)} required disabled={isSaving} className="h-12 rounded-2xl text-lg font-bold shadow-inner bg-background" />
                            </div>
                            <div className="grid gap-3">
                                <Label className="font-black text-foreground px-1 uppercase text-[10px]">رقم السجل التجاري / الضريبي</Label>
                                <Input value={formData.tax_number || ''} onChange={(e) => handleFieldChange('tax_number', e.target.value)} disabled={isSaving} className="h-12 rounded-2xl font-mono shadow-inner bg-background" />
                            </div>
                        </div>
                        <div className="grid gap-3">
                            <Label className="font-black text-foreground px-1 uppercase text-[10px]">العنوان التفصيلي المعتمد في العقود</Label>
                            <Textarea value={formData.address || ''} onChange={(e) => handleFieldChange('address', e.target.value)} disabled={isSaving} rows={3} className="rounded-[2rem] p-6 text-base font-medium shadow-inner border-2 bg-background" />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-10 border-t bg-muted/10 flex justify-end">
                    <Button onClick={handleSave} disabled={isSaving} className="h-14 px-20 rounded-[2.5rem] font-black text-xl shadow-xl shadow-primary/30 min-w-[320px] gap-4 transition-all active:translate-y-1">
                        {isSaving ? <Loader2 className="animate-spin h-7 w-7"/> : <Save className="h-7 w-7" />}
                        اعتماد وحفظ التغييرات
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
