'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useBranding, type BrandingSettings } from '@/context/branding-context';
import { useFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, ImageIcon, Palette, ArrowRight, Activity, Sparkles, AlertCircle, Link2, CloudUpload } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '../ui/separator';
import Image from 'next/image';
import { cleanFirestoreData, cn, getTenantPath } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/auth-context';

/**
 * حقل رفع الصور المطور (Sovereign Image Field):
 * يدعم الرفع المباشر والروابط الخارجية مع معاينة ذكية.
 */
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
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onUrlChange(val);
    if (!val) setPreview(null);
  };
  
  const displayUrl = preview || currentUrl;

  return (
    <div className="space-y-4 p-6 border-2 border-dashed rounded-[2.5rem] bg-white/50 dark:bg-slate-900/20 group hover:border-primary/40 transition-all shadow-sm">
        <div className="flex justify-between items-center">
            <Label htmlFor={id} className="font-black text-[#1e1b4b] flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" /> {label}
            </Label>
            {preview && <Badge className="bg-green-600 text-white text-[8px] animate-pulse">ملف جديد بانتظار الرفع</Badge>}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-32 h-32 rounded-[2rem] border-4 border-white shadow-xl flex items-center justify-center bg-muted/20 flex-shrink-0 relative overflow-hidden group-hover:scale-105 transition-transform">
                {displayUrl ? (
                    <Image 
                        src={displayUrl} 
                        alt={label} 
                        fill
                        className="object-contain p-2" 
                        unoptimized
                    />
                ) : (
                    <div className="flex flex-col items-center gap-1 opacity-20">
                        <CloudUpload className="h-8 w-8" />
                        <span className="text-[8px] font-black">بلا صورة</span>
                    </div>
                )}
            </div>
            
            <div className="flex-grow w-full space-y-4">
                <div className="grid gap-1.5">
                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <CloudUpload className="h-3 w-3" /> رفع ملف رسمي من الجهاز
                    </Label>
                    <Input
                        type="file"
                        id={id}
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        disabled={disabled}
                        className="h-10 text-[10px] cursor-pointer rounded-xl bg-white border-2 border-slate-100"
                    />
                </div>
                
                <div className="grid gap-1.5">
                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Link2 className="h-3 w-3" /> أو استخدم رابطاً خارجياً مباشرًا
                    </Label>
                    <Input
                        id={id + '-url'}
                        type="text"
                        value={currentUrl || ''}
                        onChange={handleUrlChange}
                        disabled={disabled}
                        placeholder="https://i.postimg.cc/..."
                        dir="ltr"
                        className="h-10 font-mono text-[10px] rounded-xl bg-white border-2 border-slate-100"
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
    const [saveProgress, setSaveProgress] = useState(0);

    const isInitializedRef = useRef(false);

    // 🛡️ تهيئة البيانات مرة واحدة لضمان عدم حدوث حلقات تكرار
    useEffect(() => {
        if (branding && !isInitializedRef.current && !loading) {
            const { id, ...cleanData } = branding;
            setFormData(cleanData);
            isInitializedRef.current = true;
        }
    }, [branding, loading]);

    const handleFieldChange = (field: string, value: any) => {
        setFormData(prev => ({...prev, [field]: value}));
    };
    
    const handleFileChange = (field: string, file: File | null) => {
        setFilesToUpload(prev => ({ ...prev, [field]: file }));
    };

    /**
     * محرك الحفظ السيادي المطور:
     * - يعالج كل صورة بشكل مستقل لمنع تجمد العملية.
     * - يحفظ البيانات النصية أولاً كصمام أمان.
     * - يفرض تحديث الصلاحيات قبل الحفظ.
     */
    const handleSave = async () => {
        const tenantId = currentUser?.currentCompanyId;
        if (!firestore || !tenantId) {
            toast({ variant: 'destructive', title: 'عائق هويّة', description: 'يرجى تسجيل الدخول مجدداً لتحديد المنشأة.' });
            return;
        }

        setIsSaving(true);
        setSaveProgress(10);
        
        try {
            // 1. ⚡ تجديد الهوية لضمان سريان قواعد الأمان
            await refreshToken();
            setSaveProgress(30);

            const finalData = { ...formData };
            
            // 2. 🚀 رفع الصور بشكل مستقل (Non-blocking individual uploads)
            if (storage) {
                for (const [key, file] of Object.entries(filesToUpload)) {
                    if (file) {
                        try {
                            const storageRef = ref(storage, `companies/${tenantId}/branding/${key}_${Date.now()}`);
                            const uploadResult = await uploadBytes(storageRef, file);
                            const url = await getDownloadURL(uploadResult.ref);
                            (finalData as any)[key] = url;
                            setSaveProgress(prev => prev + 15);
                        } catch (err) {
                            console.error(`Failed to upload ${key}, continuing with text...`, err);
                            toast({ variant: 'destructive', title: `خطأ في رفع ${key}`, description: 'سيتم حفظ بقية البيانات والروابط النصية.' });
                        }
                    }
                }
            }

            // 3. 🏰 الحفظ النهائي في الوثيقة السيادية
            const settingsPath = `companies/${tenantId}/settings/branding`;
            const settingsRef = doc(firestore, settingsPath);
            
            // تطهير البيانات من أي تلوث برمجي
            const cleanData = cleanFirestoreData(finalData);
            delete cleanData.id;

            await setDoc(settingsRef, {
                ...cleanData,
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            setSaveProgress(100);
            toast({ title: '✅ تم الحفظ بنجاح', description: 'تم تحديث الهوية البصرية والمطبوعات للمنشأة.' });
            setFilesToUpload({});

        } catch (error: any) {
            console.error("Critical Branding Save Failure:", error);
            toast({ 
                variant: 'destructive', 
                title: 'فشل ترحيل البيانات', 
                description: error.message?.includes('permission') 
                    ? 'عذراً، جوجل ترفض الكتابة حالياً. حاول إعادة تحميل الصفحة.' 
                    : 'حدث خطأ تقني في قاعدة البيانات.'
            });
        } finally {
            setIsSaving(false);
            setTimeout(() => setSaveProgress(0), 1000);
        }
    };

    if (loading) return (
        <div className="max-w-5xl mx-auto space-y-6" dir="rtl">
            <Skeleton className="h-32 w-full rounded-[2.5rem]" />
            <Skeleton className="h-96 w-full rounded-[3rem]" />
        </div>
    );

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20" dir="rtl">
            {/* Header Frame */}
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-purple-50 dark:from-slate-900/60">
                <CardHeader className="pb-8 px-8 border-b border-purple-100/20">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-600/10 rounded-2xl text-purple-600 shadow-inner">
                                <Palette className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black text-[#1e1b4b]">تخصيص الهوية والمطبوعات</CardTitle>
                                <CardDescription className="text-base font-bold text-slate-500">تحكم في ظهور منشأتك في التقارير، السندات، والواجهة الرئيسية.</CardDescription>
                            </div>
                        </div>
                        <Button onClick={() => router.back()} variant="ghost" className="rounded-xl font-bold gap-2 text-slate-500 hover:bg-white no-print">
                            <ArrowRight className="h-4 w-4" /> العودة للإعدادات
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/70 backdrop-blur-xl">
                <CardContent className="pt-10 space-y-12 px-10">
                    {/* Official Data Section */}
                    <div className="space-y-8">
                        <h3 className="font-black text-xl text-primary border-r-8 border-primary pr-4 flex items-center gap-3">
                            <Activity className="h-6 w-6 text-primary" /> البيانات الرسمية لترويسة المستندات
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="grid gap-3">
                                <Label className="font-black text-[10px] uppercase pr-1 text-muted-foreground tracking-widest">اسم المنشأة الرسمي (بالعربية) *</Label>
                                <Input 
                                    value={formData.company_name || ''} 
                                    onChange={(e) => handleFieldChange('company_name', e.target.value)} 
                                    className="h-12 rounded-2xl border-2 font-black text-lg bg-white/60 focus:bg-white transition-all shadow-inner" 
                                    placeholder="أدخل اسم الشركة..."
                                />
                            </div>
                            <div className="grid gap-3">
                                <Label className="font-black text-[10px] uppercase pr-1 text-muted-foreground tracking-widest">نوع النشاط (لمواءمة التقارير)</Label>
                                <Select value={formData.activity_type} onValueChange={(v: any) => handleFieldChange('activity_type', v)}>
                                    <SelectTrigger className="h-12 rounded-2xl border-2 font-black bg-white/60">
                                        <SelectValue placeholder="حدد النشاط..." />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="general">تجارة عامة ومقاولات</SelectItem>
                                        <SelectItem value="construction">شركات البناء والترميم</SelectItem>
                                        <SelectItem value="consulting">مكاتب الاستشارات الهندسية</SelectItem>
                                        <SelectItem value="food_delivery">خدمات التوصيل والأغذية</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <Separator className="opacity-10" />

                    {/* Graphics Matrix Section */}
                    <div className="space-y-8">
                        <h3 className="font-black text-xl text-primary border-r-8 border-primary pr-4 flex items-center gap-3">
                            <ImageIcon className="h-6 w-6 text-primary" /> مصفوفة الصور والمطبوعات
                        </h3>
                        
                        <div className="grid md:grid-cols-2 gap-8">
                            <ImageUploadField 
                                id="logo_url" 
                                label="شعار المنشأة (لوجو مربع)" 
                                currentUrl={formData.logo_url || undefined} 
                                onUrlChange={(url) => handleFieldChange('logo_url', url)} 
                                onFileChange={(file) => handleFileChange('logo_url', file)} 
                                disabled={isSaving} 
                            />
                            <ImageUploadField 
                                id="header_image_url" 
                                label="ترويسة المكاتبات الرسمية (Header)" 
                                currentUrl={formData.header_image_url || undefined} 
                                onUrlChange={(url) => handleFieldChange('header_image_url', url)} 
                                onFileChange={(file) => handleFileChange('header_image_url', file)} 
                                disabled={isSaving} 
                            />
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-8">
                            <ImageUploadField 
                                id="footer_image_url" 
                                label="تذييل المكاتبات (Footer)" 
                                currentUrl={formData.footer_image_url || undefined} 
                                onUrlChange={(url) => handleFieldChange('footer_image_url', url)} 
                                onFileChange={(file) => handleFileChange('footer_image_url', file)} 
                                disabled={isSaving} 
                            />
                            <div className="grid gap-3">
                                <Label className="font-black text-[10px] uppercase pr-1 text-muted-foreground flex items-center gap-2 tracking-widest">
                                    <Sparkles className="h-3 w-3 text-primary" /> العنوان المعتمد في أسفل المستندات
                                </Label>
                                <Textarea 
                                    value={formData.address || ''} 
                                    onChange={(e) => handleFieldChange('address', e.target.value)} 
                                    rows={5} 
                                    className="rounded-[2rem] p-6 border-2 bg-white/60 focus:bg-white text-base font-medium leading-loose shadow-inner" 
                                    placeholder="أدخل العنوان التفصيلي وأرقام الهواتف الرسمية التي ستظهر في الفوتر..." 
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="p-10 border-t bg-muted/10 flex justify-between items-center">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3 text-muted-foreground">
                            <AlertCircle className="h-4 w-4" />
                            <p className="text-[10px] font-black uppercase tracking-wider">سيتم تحديث كافة المطبوعات فور الحفظ</p>
                        </div>
                        {isSaving && saveProgress > 0 && (
                            <div className="w-64 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                                <div 
                                    className="h-full bg-primary transition-all duration-300" 
                                    style={{ width: `${saveProgress}%` }}
                                />
                            </div>
                        )}
                    </div>

                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving} 
                        className="h-16 px-20 rounded-[2.5rem] font-black text-2xl shadow-2xl shadow-primary/30 min-w-[380px] gap-4 transition-all active:scale-95"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="animate-spin h-8 w-8" />
                                <span>جاري الحفظ والترحيل...</span>
                            </>
                        ) : (
                            <>
                                <Save className="h-8 w-8" />
                                <span>اعتماد الهوية البصرية</span>
                            </>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
