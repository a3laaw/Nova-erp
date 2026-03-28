'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFirebase, useStorage } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { 
    Loader2, Save, ImageIcon, Palette, 
    FileText, Smartphone, LayoutGrid, 
    Printer, ShieldCheck, Sparkles, Building2,
    Plus, Trash2, Globe, Mail, MapPin, Hash,
    UploadCloud, Info, AlertCircle
} from 'lucide-react';
import { PrintLayout } from '@/components/print/print-layout';
import { cn, cleanFirestoreData } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

const brandingSchema = z.object({
  useCustomImage: z.boolean().default(false),
  headerImageUrl: z.string().optional(),
  footerImageUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  headerColor: z.string().default('#7209B7'),
  companyName: z.string().min(3, 'اسم الشركة يجب أن لا يقل عن 3 أحرف'),
  footerData: z.object({
    address: z.string().optional(),
    phones: z.array(z.string()).default([]),
    email: z.string().email('بريد إلكتروني غير صالح').optional().or(z.literal('')),
    taxNumber: z.string().optional(),
    crNumber: z.string().optional(),
    extraText: z.string().optional(),
  })
});

type BrandingFormValues = z.infer<typeof brandingSchema>;

function ImageUploadField({
  id,
  label,
  currentUrl,
  onUrlChange,
  onFileChange,
  isSaving
}: {
  id: string;
  label: string;
  currentUrl?: string;
  onUrlChange: (url: string) => void;
  onFileChange: (file: File | null) => void;
  isSaving: boolean;
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

  return (
    <div className="space-y-4">
        <Label className="font-black text-primary flex items-center gap-2">
            <ImageIcon className="h-4 w-4" /> {label}
        </Label>
        <div 
            onClick={() => !isSaving && fileInputRef.current?.click()}
            className={cn(
                "aspect-[4/1] w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-all overflow-hidden bg-muted/20 relative group",
                isSaving && "opacity-50 cursor-not-allowed"
            )}
        >
            {preview || currentUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview || currentUrl} className="w-full h-full object-contain p-2" alt="Preview" />
            ) : (
                <>
                    <UploadCloud className="h-10 w-10 text-muted-foreground opacity-30 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">اضغط لرفع الصورة</span>
                </>
            )}
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} disabled={isSaving} />
    </div>
  );
}

export default function BrandingSettingsPage() {
  const { firestore } = useFirebase();
  const storage = useStorage();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [footerFile, setFooterFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const form = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      useCustomImage: false,
      headerColor: '#7209B7',
      companyName: '',
      footerData: { phones: [''], address: '', email: '', crNumber: '', taxNumber: '', extraText: '' }
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "footerData.phones" as any
  });

  const { errors } = form.formState;

  // فحص الأخطاء وعرضها للمستخدم في حال فشل الـ Submit
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
        const firstError = Object.values(errors)[0];
        const errorMessage = (firstError as any)?.message || "يرجى التحقق من كافة الحقول المطلوبة.";
        toast({
            variant: 'destructive',
            title: 'خطأ في البيانات',
            description: errorMessage
        });
    }
  }, [errors, toast]);

  useEffect(() => {
    if (!firestore || !user?.currentCompanyId) return;

    const fetchSettings = async () => {
      setLoading(true);
      try {
        const brandingRef = doc(firestore, `companies/${user.currentCompanyId}/settings/branding`);
        const snap = await getDoc(brandingRef);
        if (snap.exists()) {
          form.reset(snap.data() as BrandingFormValues);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [firestore, user?.currentCompanyId, form]);

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    if (!storage || !user?.currentCompanyId) return '';
    const storageRef = ref(storage, `companies/${user.currentCompanyId}/print-templates/${folder}/${Date.now()}_${file.name}`);
    const uploadResult = await uploadBytes(storageRef, file);
    return await getDownloadURL(uploadResult.ref);
  };

  const onSubmit = async (data: BrandingFormValues) => {
    if (!firestore || !user?.currentCompanyId) return;

    setIsSaving(true);
    try {
      const finalData = { ...data };

      if (headerFile) finalData.headerImageUrl = await uploadFile(headerFile, 'header');
      if (footerFile) finalData.footerImageUrl = await uploadFile(footerFile, 'footer');
      if (logoFile) finalData.logoUrl = await uploadFile(logoFile, 'logo');

      const brandingRef = doc(firestore, `companies/${user.currentCompanyId}/settings/branding`);
      await setDoc(brandingRef, cleanFirestoreData({
        ...finalData,
        updatedAt: serverTimestamp()
      }), { merge: true });

      toast({ title: 'نجاح الحفظ', description: 'تم تحديث هوية المنشأة والورق الرسمي بنجاح.' });
      
      setHeaderFile(null);
      setFooterFile(null);
      setLogoFile(null);
    } catch (e: any) {
      console.error("Save Error:", e);
      toast({ variant: 'destructive', title: 'فشل الحفظ', description: e.message || "حدث خطأ غير متوقع." });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6" dir="rtl">
        <Skeleton className="h-20 w-full rounded-[2rem]" />
        <Skeleton className="h-[500px] w-full rounded-[3rem]" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-6xl mx-auto pb-24" dir="rtl">
      <Card className="rounded-[2.5rem] border-none shadow-sm glass-effect overflow-hidden">
        <CardHeader className="pb-8 px-8 border-b border-white/20">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                <Palette className="h-8 w-8" />
              </div>
              <div>
                <CardTitle className="text-3xl font-black text-[#1e1b4b]">إدارة العلامة التجارية</CardTitle>
                <CardDescription className="text-base font-medium text-[#1e1b4b]/70">تخصيص الهوية البصرية للتقارير والمراسلات الرسمية.</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
                <Button 
                    type="button"
                    variant="outline" 
                    className="rounded-xl font-bold h-11 border-white/60 bg-white/20"
                    onClick={() => setPreviewOpen(!previewOpen)}
                >
                    <Printer className="ml-2 h-4 w-4" /> 
                    {previewOpen ? 'إخفاء المعاينة' : 'معاينة الطباعة'}
                </Button>
                <Button 
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        form.handleSubmit(onSubmit)();
                    }} 
                    disabled={isSaving}
                    className="h-11 px-8 rounded-xl font-black gap-2 shadow-lg shadow-primary/20 bg-primary text-white"
                >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    حفظ كافة الإعدادات
                </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* القسم الرئيسي: اسم الشركة دائم الظهور لضمان التحقق */}
      <Card className="rounded-[2rem] border-none shadow-md glass-effect overflow-hidden border-2 border-primary/10">
          <CardContent className="p-8">
              <div className="grid gap-3 max-w-xl">
                  <Label className="font-black text-[#1e1b4b] text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" /> اسم المنشأة الرسمي (بالعربية) *
                  </Label>
                  <Input 
                    {...form.register('companyName')} 
                    placeholder="أدخل اسم المنشأة الذي سيظهر في العقود والسندات..." 
                    className={cn("h-12 rounded-xl text-xl font-black border-white/40 bg-white/30 shadow-inner focus:bg-white/60 transition-all", errors.companyName && "border-red-500")} 
                  />
                  {errors.companyName && <p className="text-xs text-red-600 font-bold pr-1">{errors.companyName.message}</p>}
              </div>
          </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className={cn("space-y-8", previewOpen ? "lg:col-span-6" : "lg:col-span-12")}>
          <Tabs defaultValue={form.getValues('useCustomImage') ? "image-mode" : "custom-mode"} onValueChange={(val) => form.setValue('useCustomImage', val === 'image-mode')}>
            <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-white/40 backdrop-blur-md p-1 h-14 border border-white/60">
              <TabsTrigger value="image-mode" className="rounded-xl font-bold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md">
                <ImageIcon className="h-4 w-4" /> صورة قالب جاهز
              </TabsTrigger>
              <TabsTrigger value="custom-mode" className="rounded-xl font-bold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md">
                <Sparkles className="h-4 w-4" /> تصميم يدوي
              </TabsTrigger>
            </TabsList>

            <TabsContent value="image-mode" className="mt-6 space-y-6">
              <Card className="rounded-3xl border-2 border-dashed glass-effect">
                <CardContent className="p-8 space-y-8">
                  <div className="grid gap-6 md:grid-cols-2">
                    <ImageUploadField 
                        id="headerImageUrl" 
                        label="صورة الترويسة (Header)" 
                        currentUrl={form.watch('headerImageUrl')} 
                        onUrlChange={(url) => form.setValue('headerImageUrl', url)}
                        onFileChange={setHeaderFile}
                        isSaving={isSaving}
                    />
                    <ImageUploadField 
                        id="footerImageUrl" 
                        label="صورة التذييل (Footer)" 
                        currentUrl={form.watch('footerImageUrl')} 
                        onUrlChange={(url) => form.setValue('footerImageUrl', url)}
                        onFileChange={setFooterFile}
                        isSaving={isSaving}
                    />
                  </div>
                  
                  <Alert className="bg-primary/5 border-primary/20 rounded-2xl">
                    <Info className="h-4 w-4" />
                    <AlertTitle className="font-black text-primary uppercase">نصيحة المطور</AlertTitle>
                    <AlertDescription className="text-[11px] font-bold text-[#1e1b4b] leading-relaxed">
                        استخدام صور جاهزة يعطي نتائج مطابقة 100% لتصميمك الفني. تأكد أن العرض هو 210mm (عرض ورقة A4). يفضل استخدام صيغة JPG عالية الجودة.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="custom-mode" className="mt-6 space-y-6">
              <Card className="rounded-3xl border-none shadow-md overflow-hidden glass-effect">
                <CardHeader className="bg-white/20 border-b border-white/20">
                    <CardTitle className="text-lg font-black flex items-center gap-2 text-[#1e1b4b]">
                        <LayoutGrid className="h-5 w-5 text-primary" /> مكونات الترويسة
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                    <div className="grid md:grid-cols-3 gap-8 items-start">
                        <div className="space-y-4">
                            <Label className="font-black text-[#1e1b4b]">شعار الشركة (Logo)</Label>
                            <div className="relative">
                                <div 
                                    className="w-32 h-32 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/50 transition-all overflow-hidden bg-white/30 shadow-inner border-white/60 group"
                                    onClick={() => !isSaving && (document.getElementById('logo-file-input') as HTMLInputElement)?.click()}
                                >
                                    {logoFile || form.watch('logoUrl') ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={logoFile ? URL.createObjectURL(logoFile) : form.watch('logoUrl')} className="w-full h-full object-contain p-2" alt="Logo" />
                                    ) : <Plus className="h-8 w-8 text-[#1e1b4b] opacity-20 group-hover:opacity-40 transition-opacity" />}
                                </div>
                                <input 
                                    id="logo-file-input"
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) setLogoFile(file);
                                    }} 
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-6">
                            <div className="grid gap-2">
                                <Label className="font-bold text-[#1e1b4b]">لون الهوية البصرية (Header Color)</Label>
                                <div className="flex gap-4 items-center">
                                    <Input 
                                        type="color" 
                                        {...form.register('headerColor')} 
                                        className="w-20 h-12 p-1 rounded-xl cursor-pointer bg-white/30 border-white/40" 
                                    />
                                    <Input 
                                        {...form.register('headerColor')} 
                                        className="h-12 rounded-xl font-mono text-center w-32 bg-white/30 border-white/40" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-white/20" />

                    <div className="space-y-6">
                        <Label className="text-lg font-black flex items-center gap-2 text-[#1e1b4b]">
                            <Smartphone className="h-5 w-5 text-primary" /> بيانات تذييل الصفحة (Footer)
                        </Label>
                        
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2 font-bold text-[#1e1b4b]/70"><MapPin className="h-3 w-3" /> العنوان</Label>
                                <Input {...form.register('footerData.address')} placeholder="الكويت - حولي - شارع..." className="h-11 rounded-xl bg-white/30 border-white/40" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2 font-bold text-[#1e1b4b]/70"><Mail className="h-3 w-3" /> البريد الإلكتروني</Label>
                                <Input {...form.register('footerData.email')} placeholder="info@company.com" className="h-11 rounded-xl dir-ltr text-right bg-white/30 border-white/40" />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2 font-bold text-[#1e1b4b]/70"><Hash className="h-3 w-3" /> السجل التجاري (C.R)</Label>
                                <Input {...form.register('footerData.crNumber')} className="h-11 rounded-xl bg-white/30 border-white/40" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2 font-bold text-[#1e1b4b]/70"><ShieldCheck className="h-3 w-3" /> الرقم الضريبي</Label>
                                <Input {...form.register('footerData.taxNumber')} className="h-11 rounded-xl bg-white/30 border-white/40" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="flex items-center gap-2 font-bold text-[#1e1b4b]/70">أرقام الهواتف</Label>
                            <div className="space-y-2">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="flex gap-2 animate-in slide-in-from-right-2">
                                        <Input {...form.register(`footerData.phones.${index}` as any)} className="h-10 rounded-lg font-mono bg-white/30 border-white/40" dir="ltr" />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-500 hover:bg-red-50">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => append('')} className="rounded-lg h-8 gap-1 bg-white/20">
                                    <Plus className="h-3 w-3" /> إضافة هاتف
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label className="font-bold text-[#1e1b4b]/70">نص إضافي في الأسفل (الشروط أو الترحيب)</Label>
                            <Textarea {...form.register('footerData.extraText')} rows={2} placeholder="شكراً لثقتكم بنا..." className="rounded-2xl resize-none bg-white/30 border-white/40" />
                        </div>
                    </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {previewOpen && (
            <div className="lg:col-span-6 sticky top-24 h-fit animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="flex items-center justify-between px-4 mb-4">
                    <Label className="font-black text-lg flex items-center gap-2 text-[#1e1b4b]">
                        <Building2 className="h-5 w-5 text-primary" /> معاينة الورق الرسمي (A4)
                    </Label>
                    <Badge variant="secondary" className="bg-white/60 text-primary font-black uppercase tracking-tighter shadow-sm">Preview Only</Badge>
                </div>
                
                <div className="border-4 border-white/60 rounded-[2.5rem] shadow-2xl overflow-hidden glass-effect scale-[0.85] origin-top">
                    <div className="shadow-inner p-4 flex justify-center overflow-auto max-h-[800px] scrollbar-none">
                        <PrintLayout>
                            <div className="py-20 space-y-8 opacity-40">
                                <div className="h-8 w-1/3 bg-slate-200 rounded-full" />
                                <div className="space-y-3">
                                    <div className="h-4 w-full bg-slate-100 rounded-full" />
                                    <div className="h-4 w-full bg-slate-100 rounded-full" />
                                    <div className="h-4 w-3/4 bg-slate-100 rounded-full" />
                                </div>
                                <div className="h-48 w-full border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center">
                                    <p className="font-black text-slate-300 text-3xl italic uppercase">Sample Document</p>
                                </div>
                                <div className="flex justify-end pt-10">
                                    <div className="h-20 w-40 bg-slate-100 rounded-xl border border-dashed" />
                                </div>
                            </div>
                        </PrintLayout>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}