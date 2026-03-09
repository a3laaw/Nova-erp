'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X, Loader2, Users, Clock, Banknote, Briefcase, User, ShieldCheck, Phone, Globe, Camera, Sparkles } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import type { Employee, Department, Job } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DateInput } from '../ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';
import { Checkbox } from '../ui/checkbox';
import { useBranding } from '@/context/branding-context';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { analyzeEmployeeDocument } from '@/ai/flows/analyze-employee-doc';

interface EmployeeFormProps {
    onSave: (data: Partial<Employee>) => Promise<void>;
    onClose: () => void;
    initialData?: Partial<Employee> | null;
    isSaving?: boolean;
    employeeNumber?: string | null;
}

const commonNationalities = [
  "كويتي", "سعودي", "إماراتي", "بحريني", "قطري", "عماني",
  "مصري", "سوري", "لبناني", "أردني", "فلسطيني", "يمني",
  "هندي", "باكستاني", "فلبيني", "بنغلاديشي", "نيبالي", "إيراني",
  "بريطاني", "أمريكي"
].sort((a,b) => a.localeCompare(b, 'ar'));

const nationalityOptions = commonNationalities.map(n => ({ value: n, label: n }));

export function EmployeeForm({ onSave, onClose, initialData = null, isSaving = false, employeeNumber = null }: EmployeeFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { branding } = useBranding();
    const aiFileInputRef = useRef<HTMLInputElement>(null);
    
    // جلب البيانات اللحظية
    const { data: departments, loading: deptsLoading } = useSubscription<Department>(firestore, 'departments', [orderBy('order')]);
    const { data: jobs, loading: jobsLoading } = useSubscription<Job>(firestore, 'jobs', [], true);

    const [formData, setFormData] = useState<Partial<Employee>>({
        fullName: '',
        nameEn: '',
        civilId: '',
        mobile: '',
        hireDate: new Date(),
        department: '',
        jobTitle: '',
        contractType: 'permanent',
        basicSalary: 0,
        housingAllowance: 0,
        transportAllowance: 0,
        salaryPaymentType: 'cash',
        bankName: '',
        accountNumber: '',
        iban: '',
        contractPercentage: 0,
        gender: 'male',
        dob: undefined,
        nationality: '',
        residencyExpiry: undefined,
        workStartTime: null,
        workEndTime: null,
        pieceRateMode: 'salary_with_target',
        targetDescription: 0,
        pieceRate: 0,
        dailyRate: 0,
    });

    const [showHousingAllowance, setShowHousingAllowance] = useState(false);
    const [showTransportAllowance, setShowTransportAllowance] = useState(false);
    const [isCustomHours, setIsCustomHours] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialData,
                fullName: initialData.fullName || (initialData as any).nameAr || '',
                nameEn: initialData.nameEn || (initialData as any).nameEn || '',
                hireDate: toFirestoreDate(initialData.hireDate) || new Date(),
                dob: toFirestoreDate(initialData.dob) || undefined,
                residencyExpiry: toFirestoreDate(initialData.residencyExpiry) || undefined,
                basicSalary: Number(initialData.basicSalary || 0),
                housingAllowance: Number(initialData.housingAllowance || 0),
                transportAllowance: Number(initialData.transportAllowance || 0),
                dailyRate: Number(initialData.dailyRate || 0),
                contractPercentage: Number(initialData.contractPercentage || 0),
                salaryPaymentType: initialData.salaryPaymentType || 'cash',
                nationality: initialData.nationality || '',
                workStartTime: initialData.workStartTime || null,
                workEndTime: initialData.workEndTime || null,
            });
            setShowHousingAllowance(Number(initialData.housingAllowance) > 0);
            setShowTransportAllowance(Number(initialData.transportAllowance) > 0);
            setIsCustomHours(!!initialData.workStartTime);
        }
    }, [initialData]);

    const handleAiAnalysis = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (aiFileInputRef.current) aiFileInputRef.current.value = '';
        setIsAnalyzing(true);
        try {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const dataUri = evt.target?.result as string;
                    const result = await analyzeEmployeeDocument({ fileDataUri: dataUri });
                    if (result) {
                        setFormData(prev => ({
                            ...prev,
                            fullName: result.fullName || prev.fullName,
                            nameEn: result.nameEn || prev.nameEn,
                            civilId: result.civilId || prev.civilId,
                            nationality: result.nationality || prev.nationality,
                            dob: result.dob ? new Date(result.dob) : prev.dob,
                            residencyExpiry: result.residencyExpiry ? new Date(result.residencyExpiry) : prev.residencyExpiry,
                            gender: result.gender || prev.gender,
                        }));
                        toast({ title: 'نجاح المسح', description: result.summary || 'تم استخراج بيانات الوثيقة آلياً.' });
                    }
                } catch (err: any) {
                    toast({ variant: 'destructive', title: 'خطأ في التحليل', description: err.message });
                } finally { setIsAnalyzing(false); }
            };
            reader.readAsDataURL(file);
        } catch (error) { setIsAnalyzing(false); }
    };

    const handleCustomHoursToggle = (checked: boolean) => {
        setIsCustomHours(checked);
        if (checked) {
            setFormData(prev => ({ ...prev, workStartTime: '08:00', workEndTime: '17:00' }));
        } else {
            setFormData(prev => ({ ...prev, workStartTime: null, workEndTime: null }));
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        let finalVal: any = value;
        if (['basicSalary', 'housingAllowance', 'transportAllowance', 'dailyRate', 'contractPercentage'].includes(id)) {
            finalVal = parseFloat(value) || 0;
        }
        setFormData(prev => ({ ...prev, [id]: finalVal }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.fullName || !formData.mobile || !formData.nationality) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء تعبئة الاسم والجوال والجنسية.' });
            return;
        }
        await onSave(formData);
    };

    const departmentOptions = useMemo(() => 
        departments.map(d => ({ value: d.name, label: d.name }))
    , [departments]);

    // ✨ التعديل الجوهري: فلترة الوظائف بناءً على الـ parentId الذي وفره useSubscription
    const filteredJobOptions = useMemo(() => {
        if (!formData.department) return [];
        const selectedDept = departments.find(d => d.name === formData.department);
        if (!selectedDept) return [];
        
        return jobs
            .filter(j => (j as any).parentId === selectedDept.id)
            .map(j => ({ value: j.name, label: j.name }));
    }, [departments, jobs, formData.department]);

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="py-4 px-1 space-y-8 max-h-[75vh] overflow-y-auto scrollbar-none">
                
                <div className="flex justify-center px-4">
                    <input type="file" ref={aiFileInputRef} className="hidden" accept="image/*, .pdf" onChange={handleAiAnalysis} />
                    <Button 
                        type="button"
                        variant="outline" 
                        className="w-full h-16 rounded-[2rem] border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 transition-all gap-3 group"
                        onClick={() => aiFileInputRef.current?.click()}
                        disabled={isAnalyzing || isSaving}
                    >
                        {isAnalyzing ? (
                            <>
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="text-lg font-black text-primary animate-pulse">جاري تحليل الوثيقة...</span>
                            </>
                        ) : (
                            <>
                                <div className="p-2 bg-primary/10 rounded-xl text-primary group-hover:scale-110 transition-transform">
                                    <Sparkles className="h-6 w-6" />
                                </div>
                                <div className="text-right">
                                    <p className="text-base font-black text-primary">مسح وثيقة الهوية (AI Scan)</p>
                                    <p className="text-[10px] text-muted-foreground font-bold">ارفع صورة البطاقة المدنية أو الجواز لتعبئة البيانات آلياً</p>
                                </div>
                            </>
                        )}
                    </Button>
                </div>

                <section className="space-y-6 p-6 border rounded-[2rem] bg-card shadow-sm">
                    <h3 className="font-black text-lg flex items-center gap-2"><User className="h-5 w-5 text-primary"/> المعلومات الشخصية والأساسية</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">الاسم الكامل بالعربية *</Label>
                            <Input id="fullName" value={formData.fullName || ''} onChange={handleInputChange} required className="h-11 rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">الاسم بالإنجليزية</Label>
                            <Input id="nameEn" value={formData.nameEn || ''} onChange={handleInputChange} dir="ltr" className="h-11 rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">رقم الجوال *</Label>
                            <div className="relative">
                                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input id="mobile" value={formData.mobile || ''} onChange={handleInputChange} dir="ltr" required className="pr-10 h-11 rounded-xl" />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">الرقم المدني</Label>
                            <Input id="civilId" value={formData.civilId || ''} onChange={handleInputChange} dir="ltr" maxLength={12} className="h-11 rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">الجنسية *</Label>
                            <InlineSearchList 
                                value={formData.nationality || ''} 
                                onSelect={v => setFormData(p => ({...p, nationality: v}))} 
                                options={nationalityOptions} 
                                placeholder="اختر الجنسية..." 
                                className="h-11" 
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">تاريخ الميلاد</Label>
                            <DateInput value={formData.dob} onChange={d => setFormData(p => ({...p, dob: d}))} />
                        </div>
                    </div>
                </section>

                <section className="space-y-6 p-6 border rounded-[2rem] bg-muted/10">
                    <h3 className="font-black text-lg flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary"/> التعيين والدوام</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">القسم *</Label>
                            <InlineSearchList 
                                value={formData.department || ''} 
                                onSelect={v => setFormData(p => ({...p, department: v, jobTitle: ''}))} 
                                options={departmentOptions} 
                                placeholder={deptsLoading ? "جاري التحميل..." : "اختر القسم..."} 
                                disabled={deptsLoading}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">المسمى الوظيفي *</Label>
                            <InlineSearchList 
                                value={formData.jobTitle || ''} 
                                onSelect={v => setFormData(p => ({...p, jobTitle: v}))} 
                                options={filteredJobOptions} 
                                placeholder={!formData.department ? "اختر القسم أولاً" : jobsLoading ? "تحميل..." : "اختر المسمى..."} 
                                disabled={!formData.department || jobsLoading}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">نوع التعاقد *</Label>
                            <Select value={formData.contractType} onValueChange={(v: any) => setFormData(p => ({...p, contractType: v}))}>
                                <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="permanent">دائم</SelectItem>
                                    <SelectItem value="temporary">مؤقت</SelectItem>
                                    <SelectItem value="day_laborer">عامل باليومية</SelectItem>
                                    <SelectItem value="percentage">نسبة من العقود</SelectItem>
                                    <SelectItem value="special">دوام خاص</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">تاريخ المباشرة</Label>
                            <DateInput value={formData.hireDate} onChange={d => setFormData(p => ({...p, hireDate: d}))} />
                        </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border shadow-sm">
                            <Checkbox id="custom-h" checked={isCustomHours} onCheckedChange={(c) => handleCustomHoursToggle(!!c)} />
                            <div className="space-y-0.5">
                                <Label htmlFor="custom-h" className="cursor-pointer font-black text-sm">تخصيص ساعات دوام لهذا الموظف</Label>
                                <p className="text-[10px] text-muted-foreground font-bold">إذا لم يتم التفعيل، سيتبع الموظف الدوام الرسمي للمكتب.</p>
                            </div>
                        </div>
                        
                        {isCustomHours && (
                            <div className="grid grid-cols-2 gap-6 animate-in slide-in-from-top-2 p-4 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20">
                                <div className="grid gap-1.5">
                                    <Label className="text-[10px] uppercase font-black mr-1 text-primary">يبدأ الدوام الساعة</Label>
                                    <Input type="time" value={formData.workStartTime || '08:00'} onChange={e => setFormData(p => ({...p, workStartTime: e.target.value}))} className="h-11 rounded-xl border-2 font-black text-lg text-center" />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label className="text-[10px] uppercase font-black mr-1 text-primary">ينتهي الدوام الساعة</Label>
                                    <Input type="time" value={formData.workEndTime || '17:00'} onChange={e => setFormData(p => ({...p, workEndTime: e.target.value}))} className="h-11 rounded-xl border-2 font-black text-xl text-center" />
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                <section className="space-y-6 p-6 border rounded-[2.5rem] bg-emerald-50/20 border-emerald-100 shadow-sm">
                    <h3 className="font-black text-lg flex items-center gap-2 text-emerald-800"><Banknote className="h-5 w-5" /> المعلومات المالية والرواتب</h3>
                    
                    {formData.contractType === 'day_laborer' ? (
                        <div className="grid gap-2 max-w-xs animate-in zoom-in-95">
                            <Label className="font-black text-emerald-900">أجرة اليومية (د.ك) *</Label>
                            <Input id="dailyRate" type="number" step="0.001" value={formData.dailyRate} onChange={handleInputChange} className="h-12 text-2xl font-black text-center font-mono border-2 border-emerald-200 bg-white rounded-2xl" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="grid gap-2">
                                    <Label className="font-bold text-emerald-900">الراتب الأساسي (د.ك) *</Label>
                                    <Input id="basicSalary" type="number" step="0.001" value={formData.basicSalary} onChange={handleInputChange} className="h-11 font-mono font-bold bg-white" />
                                </div>
                                <div className="grid gap-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Checkbox id="h-allow" checked={showHousingAllowance} onCheckedChange={c => setShowHousingAllowance(!!c)} />
                                        <Label htmlFor="h-allow" className="text-xs font-bold cursor-pointer">إضافة بدل سكن</Label>
                                    </div>
                                    <Input id="housingAllowance" type="number" step="0.001" value={formData.housingAllowance} onChange={handleInputChange} disabled={!showHousingAllowance} className="h-11 font-mono bg-white" />
                                </div>
                                <div className="grid gap-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Checkbox id="t-allow" checked={showTransportAllowance} onCheckedChange={c => setShowTransportAllowance(!!c)} />
                                        <Label htmlFor="t-allow" className="text-xs font-bold cursor-pointer">إضافة بدل مواصلات</Label>
                                    </div>
                                    <Input id="transportAllowance" type="number" step="0.001" value={formData.transportAllowance} onChange={handleInputChange} disabled={!showTransportAllowance} className="h-11 font-mono bg-white" />
                                </div>
                            </div>
                            {formData.contractType === 'percentage' && (
                                <div className="grid gap-2 max-w-xs animate-in slide-in-from-right-2">
                                    <Label className="font-bold text-emerald-900">نسبة العمولات من العقود (%)</Label>
                                    <Input id="contractPercentage" type="number" step="0.1" value={formData.contractPercentage} onChange={handleInputChange} className="h-11 font-mono font-black text-center bg-white" />
                                </div>
                            )}
                        </div>
                    )}

                    <Separator className="bg-emerald-100" />

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                        <div className="grid gap-2">
                            <Label className="font-bold text-xs text-muted-foreground mr-1">طريقة دفع الراتب</Label>
                            <Select value={formData.salaryPaymentType || 'cash'} onValueChange={v => setFormData(p => ({...p, salaryPaymentType: v as any}))}>
                                <SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="cash">نقداً (كاش)</SelectItem>
                                    <SelectItem value="transfer">تحويل بنكي</SelectItem>
                                    <SelectItem value="cheque">شيك</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {formData.salaryPaymentType === 'transfer' && (
                            <>
                                <div className="grid gap-2"><Label className="font-bold text-xs mr-1">اسم البنك</Label><Input id="bankName" value={formData.bankName || ''} onChange={handleInputChange} className="h-10 bg-white" /></div>
                                <div className="grid gap-2"><Label className="font-bold text-xs mr-1">رقم الحساب</Label><Input id="accountNumber" value={formData.accountNumber || ''} onChange={handleInputChange} dir="ltr" className="h-10 bg-white font-mono" /></div>
                                <div className="grid gap-2"><Label className="font-bold text-xs mr-1">IBAN</Label><Input id="iban" value={formData.iban || ''} onChange={handleInputChange} dir="ltr" className="h-10 bg-white font-mono" /></div>
                            </>
                        )}
                    </div>
                </section>
            </div>

            <DialogFooter className="mt-6 pt-6 border-t bg-muted/10 rounded-b-[2rem] p-6">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
                <Button type="submit" disabled={isSaving || isAnalyzing} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/20 gap-2">
                    {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                    حفظ الملف الوظيفي
                </Button>
            </DialogFooter>
        </form>
    );
}
