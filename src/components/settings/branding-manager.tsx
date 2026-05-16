
'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useBranding, type BrandingSettings } from '@/context/branding-context';
import { useFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, ImageIcon, Palette, ArrowRight, Activity, Sparkles, AlertCircle } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '../ui/separator';
import Image from 'next/image';
import { cleanFirestoreData, cn } from '@/lib/utils';
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
      // We don't clear the URL yet, just mark that we have a new file
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
    <div className="space-y-3 p-6 border-2 border-dashed rounded-[2rem] bg-muted/5 group hover:border-primary/30 transition-all">
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
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">رفع ملف جديد</Label>
                    <Input
                        type="file"
                        id={id}
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        disabled={disabled}
                        className="h-10 text-xs cursor-pointer rounded-xl bg-white/50"
                    />
                </div>
                <div className="grid gap-1.5">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">أو رابط مباشر</Label>
                    <Input
                        id={id + '-url'}
                        type="text"
                        value={currentUrl || ''}
                        onChange={handleUrlChange}
                        disabled={disabled}
                        placeholder="https://..."
                        dir="ltr"
                        className="h-10 font-mono text-[10px] rounded-xl bg-white/50"
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
    const isInitializedRef = useRef(false);

    // 🛡️ صمام أمان التحرير: التعبئة مرة واحدة فقط عند التحميل لمنع مسح مدخلات المستخدم
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

    const handleSave = async () => {
        // تحديد الهوية السيادية بدقة
        const tenantId = currentUser?.currentCompanyId;
        if (!firestore || !tenantId) {
            toast({ variant: 'destructive', title: 'عائق هويّة', description: 'لم نتمكن من تحديد المنشأة المستهدفة للحفظ.' });
            return;
        }

        setIsSaving(true);
        try {
            // ⚡ تجديد التوكن قسرياً لضمان سريان الصلاحيات في جوجل
            await refreshToken();

            const dataToSave = { ...formData };
            delete (dataToSave as any).id; // تطهير من أي معرفات مؤقتة

            // 🚀 محرك الرفع المستقل (Non-Blocking Upload Engine)
            if (storage) {
                const uploadResults = await Promise.all(
                    Object.entries(filesToUpload).map(async ([key, file]) => {
                        if (!file) return null;
                        try {
                            const storageRef = ref(storage, `companies/${tenantId}/branding/${key}_${Date.now()}`);
                            const uploadResult = await uploadBytes(storageRef, file);
                            const url = await getDownloadURL(uploadResult.ref);
                            return { key, url };
                        } catch (err) {
                            console.error(`Failed to upload ${key}:`, err);
                            return null;
                        }
                    })
                );

                uploadResults.forEach(res => {
                    if (res) (dataToSave as any)[res.key] = res.url;
                });
            }
            
            // 🏰 مسار الحفظ السيادي الموحد
            const settingsRef = doc(firestore, `companies/${tenantId}/settings/branding`);
            
            await setDoc(settingsRef, {
                ...cleanFirestoreData(dataToSave),
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            toast({ title: '✅ تم الحفظ والاعتماد', description: 'تم ترحيل الهوية البصرية الجديدة للمنشأة بنجاح.' });
            setFilesToUpload({}); // تصفير المرفقات بعد النجاح

        } catch (error: any) {
            console.error("Critical Save Error:", error);
            toast({ 
                variant: 'destructive', 
                title: 'فشل ترحيل البيانات', 
                description: error.message?.includes('permission') 
                    ? 'عذراً، قواعد الأمان تمنع الحفظ حالياً. يرجى محاولة تسجيل الدخول مرة أخرى.' 
                    : 'حدث خطأ تقني أثناء محاولة الحفظ السحابي.'
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return (
        <div className="space-y-6" dir="rtl">
            <Skeleton className="h-32 w-full rounded-[2.5rem]" />
            <Skeleton className="h-96 w-full rounded-[3rem]" />
        </div>
    );

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
                                <CardTitle className="text-2xl font-black">مركز إدارة الهوية البصرية</CardTitle>
                                <CardDescription className="text-base font-medium">تخصيص شعار المنشأة والمطبوعات الرسمية (العقود، السندات، التقارير).</CardDescription>
                            </div>
                        </div>
                        <Button onClick={() => router.back()} variant="ghost" className="rounded-xl font-bold gap-2 hover:bg-white/40">
                            <ArrowRight className="h-4 w-4" /> العودة
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/70 backdrop-blur-xl">
                <CardContent className="pt-10 space-y-12 px-10">
                    {/* قسم البيانات النصية */}
                    <div className="space-y-8">
                        <h3 className="font-black text-xl text-primary border-r-8 border-primary pr-4 flex items-center gap-3">
                            <Activity className="h-6 w-6 text-primary" /> البيانات الرسمية للمنشأة
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="grid gap-3">
                                <Label className="font-black text-[10px] uppercase pr-1 text-muted-foreground">اسم المنشأة بالعربية (يظهر في الترويسة) *</Label>
                                <Input 
                                    value={formData.company_name || ''} 
                                    onChange={(e) => handleFieldChange('company_name', e.target.value)} 
                                    className="h-12 rounded-2xl border-2 font-black text-lg bg-white/50 focus:bg-white transition-all" 
                                />
                            </div>
                            <div className="grid gap-3">
                                <Label className="font-black text-[10px] uppercase pr-1 text-muted-foreground">نوع النشاط التجاري</Label>
                                <Select value={formData.activity_type} onValueChange={(v: any) => handleFieldChange('activity_type', v)}>
                                    <SelectTrigger className="h-12 rounded-2xl border-2 font-black bg-white/50">
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

                    {/* قسم المطبوعات */}
                    <div className="space-y-8">
                        <h3 className="font-black text-xl text-primary border-r-8 border-primary pr-4">مصفوفة الصور والمطبوعات</h3>
                        <div className="grid md:grid-cols-2 gap-10">
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
                        <div className="grid md:grid-cols-2 gap-10">
                            <ImageUploadField 
                                id="footer_image_url" 
                                label="تذييل المكاتبات (Footer)" 
                                currentUrl={formData.footer_image_url || undefined} 
                                onUrlChange={(url) => handleFieldChange('footer_image_url', url)} 
                                onFileChange={(file) => handleFileChange('footer_image_url', file)} 
                                disabled={isSaving} 
                            />
                            <div className="grid gap-3">
                                <Label className="font-black text-[10px] uppercase pr-1 text-muted-foreground flex items-center gap-2">
                                    <Sparkles className="h-3 w-3 text-primary" /> العنوان المعتمد في العقود والتقارير
                                </Label>
                                <Textarea 
                                    value={formData.address || ''} 
                                    onChange={(e) => handleFieldChange('address', e.target.value)} 
                                    rows={5} 
                                    className="rounded-[2rem] p-6 border-2 bg-white/50 focus:bg-white text-base font-medium leading-loose" 
                                    placeholder="أدخل العنوان التفصيلي وأرقام الهواتف الرسمية..." 
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-10 border-t bg-muted/10 flex justify-end gap-6 items-center">
                    <div className="hidden lg:flex items-center gap-3 text-muted-foreground animate-pulse">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-[10px] font-bold uppercase tracking-wider">سيتم تحديث كافة المطبوعات فور الحفظ</p>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving} className="h-16 px-20 rounded-[2.5rem] font-black text-2xl shadow-2xl shadow-primary/30 min-w-[380px] gap-4">
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
