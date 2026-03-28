'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
    Building2, UploadCloud, Info, AlertCircle,
    Plus, Trash2, MapPin, Mail, Printer, Sparkles,
    LayoutGrid
} from 'lucide-react';
import { PrintLayout } from '@/components/print/print-layout';
import { cn, cleanFirestoreData } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

const brandingSchema = z.object({
  useCustomImage: z.boolean().default(false),
  headerImageUrl: z.string().optional().nullable(),
  footerImageUrl: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  headerColor: z.string().default('#7209B7'),
  companyName: z.string().min(1, 'اسم المنشأة مطلوب'),
  footerData: z.object({
    address: z.string().optional().nullable(),
    phones: z.array(z.string()).default(['']),
    email: z.string().optional().nullable(),
    taxNumber: z.string().optional().nullable(),
    crNumber: z.string().optional().nullable(),
    extraText: z.string().optional().nullable(),
  }).optional()
});

type BrandingFormValues = z.infer<typeof brandingSchema>;

function ImageUploadField({
  label,
  currentUrl,
  onFileChange,
  onUrlChange,
  isSaving
}: {
  label: string;
  currentUrl?: string | null;
  onFileChange: (file: File | null) => void;
  onUrlChange: (url: string) => void;
  isSaving: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      onFileChange(file);
    }
  };

  return (
    <div className="space-y-4">
        <Label className="font-black text-[#1e1b4b] flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" /> {label}
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
                <img src={preview || currentUrl || ''} className="w-full h-full object-contain p-2" alt="Preview" />
            ) : (
                <>
                    <UploadCloud className="h-10 w-10 text-muted-foreground opacity-30 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">اضغط لرفع الصورة</span>
                </>
            )}
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} disabled={isSaving} />
        <Input 
            value={currentUrl || ''} 
            onChange={(e) => { setPreview(null); onUrlChange(e.target.value); }}
            placeholder="أو ضع رابطاً مباشراً..." 
            className="h-8 text-[10px] rounded-lg bg-white/50 border-dashed"
            disabled={isSaving}
        />
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
    name: "footerData.phones"
  });

  useEffect(() => {
    if (!firestore || !user?.currentCompanyId) return;

    const fetchSettings = async () => {
      setLoading(true);
      try {
        const brandingRef = doc(firestore, `companies/${user.currentCompanyId}/settings/branding`);
        const snap = await getDoc(brandingRef);
        if (snap.exists()) {
          const data = snap.data();
          form.reset({
              ...data,
              footerData: {
                  ...data.footerData,
                  phones: data.footerData?.phones || ['']
              }
          } as any);
        }
      } catch (e) {
        console.error("Fetch Settings Error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [firestore, user?.currentCompanyId, form]);

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    if (!storage || !user?.currentCompanyId) return '';
    const storageRef = ref(storage, `companies/${user.currentCompanyId}/branding/${folder}/${Date.now()}_${file.name}`);
    const uploadResult = await uploadBytes(storageRef, file);
    return await getDownloadURL(uploadResult.ref);
  };

  const onSubmit = async (data: BrandingFormValues) => {
    if (!firestore || !user?.currentCompanyId) {
        toast({ variant: 'destructive', title: 'خطأ في الهوية', description: 'لم يتم التعرف على منشأتك.' });
        return;
    }

    setIsSaving(true);
    try {
      const finalData = { ...data };

      if (headerFile) finalData.headerImageUrl = await uploadFile(headerFile, 'header');
      if (footerFile) finalData.footerImageUrl = await uploadFile(footerFile, 'footer');
      if (logoFile) finalData.logoUrl = await uploadFile(logoFile, 'logo');

      const brandingRef = doc(firestore, `companies/${user.currentCompanyId}/settings/branding`);
      const payload = cleanFirestoreData({
        ...finalData,
        updatedAt: serverTimestamp()
      });

      await setDoc(brandingRef, payload, { merge: true });
      toast({ title: 'نجاح الحفظ اللحظي', description: 'تم تحديث هوية المنشأة والورق الرسمي بنجاح.' });
      
      setHeaderFile(null);
      setFooterFile(null);
      setLogoFile(null);
    } catch (e: any) {
      toast({ 
        variant: 'destructive', 
        title: 'فشل الحفظ', 
        description: e.message || "حدث خطأ أثناء الاتصال بالخادم." 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const onValidationError = (errors: any) => {
      const firstError = Object.values(errors)[0] as any;
      toast({
          variant: 'destructive',
          title: 'بيانات ناقصة',
          description: firstError?.message || 'يرجى مراجعة الحقول المطلوبة والتأكد من إدخال اسم المنشأة.'
      });
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
                <CardTitle className="text-3xl font-black text-[#1e1b4b]">إدارة الهوية والورق الرسمي</CardTitle>
                <CardDescription className="text-base font-medium text-[#1e1b4b]/70">تخصيص الهوية البصرية والمراسلات الرسمية للمنظومة.</CardDescription>
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
                    onClick={form.handleSubmit(onSubmit, onValidationError)} 
                    disabled={isSaving}
                    className="h-11 px-10 rounded-xl font-black gap-2 shadow-lg shadow-primary/20 bg-primary text-white"
                >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    اعتماد وحفظ الهوية
                </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <form className="space-y-8">
          <Card className="rounded-[2rem] border-none shadow-md glass-effect overflow-hidden border-2 border-primary/10">
              <CardContent className="p-8">
                  <div className="grid gap-3 max-w-xl">
                      <Label className="font-black text-[#1e1b4b] text-lg flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-primary" /> اسم المنشأة الرسمي المعمد *
                      </Label>
                      <Input 
                        {...form.register('companyName')} 
                        placeholder="سيظهر هذا الاسم في ترويسة كافة المستندات..." 
                        className="h-12 rounded-xl text-xl font-black border-white/40 bg-white/30 shadow-inner focus:bg-white/60 transition-all" 
                      />
                  </div>
              </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className={cn("space-y-8", previewOpen ? "lg:col-span-6" : "lg:col-span-12")}>
              <Tabs defaultValue={form.getValues('useCustomImage') ? "image-mode" : "custom-mode"} onValueChange={(val) => form.setValue('useCustomImage', val === 'image-mode')}>
                <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-white/40 backdrop-blur-md p-1 h-14 border border-white/60">
                  <TabsTrigger value="image-mode" className="rounded-xl font-bold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md">
                    <ImageIcon className="h-4 w-4" /> قالب مصمم جاهز
                  </TabsTrigger>
                  <TabsTrigger value="custom-mode" className="rounded-xl font-bold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md">
                    <Sparkles className="h-4 w-4" /> بناء تصميم يدوي
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="image-mode" className="mt-6 space-y-6">
                  <Card className="rounded-3xl border-2 border-dashed glass-effect shadow-inner">
                    <CardContent className="p-8 space-y-8">
                      <div className="grid gap-8 md:grid-cols-2">
                        <ImageUploadField 
                            label="صورة الترويسة (Header)" 
                            currentUrl={form.watch('headerImageUrl')} 
                            onUrlChange={(url) => form.setValue('headerImageUrl', url)}
                            onFileChange={setHeaderFile}
                            isSaving={isSaving}
                        />
                        <ImageUploadField 
                            label="صورة التذييل (Footer)" 
                            currentUrl={form.watch('footerImageUrl')} 
                            onUrlChange={(url) => form.setValue('footerImageUrl', url)}
                            onFileChange={setFooterFile}
                            isSaving={isSaving}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="custom-mode" className="mt-6 space-y-6">
                  <Card className="rounded-3xl border-none shadow-md overflow-hidden glass-effect border-2 border-white/40">
                    <CardHeader className="bg-white/20 border-b border-white/20">
                        <CardTitle className="text-lg font-black flex items-center gap-2 text-[#1e1b4b]">
                            <LayoutGrid className="h-5 w-5 text-primary" /> المكونات اليدوية
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-10">
                        <div className="grid md:grid-cols-3 gap-8 items-start">
                            <div className="space-y-4">
                                <Label className="font-black text-[#1e1b4b] pr-1 uppercase text-[10px] tracking-widest">شعار المنشأة (Logo)</Label>
                                <div 
                                    className="w-32 h-32 border-2 border-dashed rounded-3xl flex items-center justify-center cursor-pointer hover:bg-white/50 bg-white/30 shadow-inner overflow-hidden border-white/60 group transition-all"
                                    onClick={() => !isSaving && (document.getElementById('logo-file-input') as HTMLInputElement)?.click()}
                                >
                                    {logoFile || form.watch('logoUrl') ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={logoFile ? URL.createObjectURL(logoFile) : form.watch('logoUrl') || ''} className="w-full h-full object-contain p-2" alt="Logo" />
                                    ) : <Plus className="h-8 w-8 text-[#1e1b4b] opacity-20 group-hover:scale-110 transition-transform" />}
                                </div>
                                <input id="logo-file-input" type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && setLogoFile(e.target.files[0])} />
                            </div>

                            <div className="md:col-span-2 space-y-6">
                                <div className="grid gap-2">
                                    <Label className="font-bold text-[#1e1b4b] pr-1">لون السمة الرسمي</Label>
                                    <div className="flex gap-4 items-center bg-white/20 p-2 rounded-2xl border border-white/40 shadow-inner">
                                        <Input type="color" {...form.register('headerColor')} className="w-20 h-12 p-1 rounded-xl cursor-pointer bg-white/30 border-none" />
                                        <Input {...form.register('headerColor')} className="h-12 rounded-xl font-mono font-black text-center w-32 bg-white/30 border-white/40 text-primary" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator className="bg-white/20" />

                        <div className="space-y-8">
                            <Label className="text-xl font-black text-[#1e1b4b] flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-primary" /> بيانات التذييل
                            </Label>
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="grid gap-2"><Label className="font-bold pr-1">العنوان</Label><Input {...form.register('footerData.address')} className="rounded-xl bg-white/30 border-white/40 h-11" /></div>
                                <div className="grid gap-2"><Label className="font-bold pr-1">البريد الإلكتروني</Label><Input {...form.register('footerData.email')} dir="ltr" className="rounded-xl bg-white/30 border-white/40 h-11" /></div>
                            </div>
                            
                            <div className="space-y-4">
                                <Label className="font-bold pr-1">هواتف التواصل</Label>
                                <div className="grid gap-3">
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="flex gap-2 animate-in slide-in-from-right-2">
                                            <Input {...form.register(`footerData.phones.${index}` as any)} className="rounded-xl bg-white/30 border-white/40 h-11 font-mono" dir="ltr" />
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-500 hover:bg-red-50 rounded-xl h-11 w-11"><Trash2 className="h-5 w-5" /></Button>
                                        </div>
                                    ))}
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => append('')} className="rounded-xl bg-white/20 border-primary/20 text-primary font-black"><Plus className="h-4 w-4 ml-2" /> إضافة هاتف</Button>
                            </div>
                        </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {previewOpen && (
                <div className="lg:col-span-6 sticky top-24 h-fit animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="border-4 border-white rounded-[2.5rem] shadow-2xl overflow-hidden glass-effect scale-[0.85] origin-top">
                        <div className="p-4 flex justify-center overflow-auto max-h-[800px] scrollbar-none">
                            <PrintLayout documentName="Preview_Branding">
                                <div className="py-20 space-y-10 opacity-40">
                                    <div className="h-10 w-1/2 bg-slate-200 rounded-2xl" />
                                    <div className="h-64 w-full border-4 border-dashed border-slate-200 rounded-[3rem] flex items-center justify-center">
                                        <p className="font-black text-slate-300 text-4xl italic uppercase tracking-tighter">معاينة الورق الرسمي</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="h-4 w-full bg-slate-100 rounded-full" />
                                        <div className="h-4 w-5/6 bg-slate-100 rounded-full" />
                                    </div>
                                </div>
                            </PrintLayout>
                        </div>
                    </div>
                </div>
            )}
          </div>
      </form>
    </div>
  );
}
