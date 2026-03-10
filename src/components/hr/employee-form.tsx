
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X, Loader2, User, Phone, Briefcase, Banknote, Sparkles, Camera, ShieldCheck, Globe, Clock, Calendar, FileCheck, Landmark, FileText } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
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
import { analyzeEmployeeDocument } from '@/ai/flows/analyze-employee-doc';
import { cn } from '@/lib/utils';

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
    
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const { data: departments, loading: deptsLoading } = useSubscription<Department>(firestore, 'departments', [orderBy('order')]);
    const { data: jobs, loading: jobsLoading } = useSubscription<Job>(firestore, 'jobs', [], true);

    const [formData, setFormData] = useState<Partial<Employee>>({
        fullName: '', nameEn: '', civilId: '', mobile: '',
        hireDate: new Date(), department: '', jobTitle: '',
        contractType: 'permanent', basicSalary: 0,
        housingAllowance: 0, transportAllowance: 0,
        salaryPaymentType: 'cash',
        bankName: '', accountNumber: '', iban: '',
        contractPercentage: 0,
        gender: 'male',
        dob: undefined,
        nationality: '',
        residencyExpiry: undefined,
        passportExpiry: undefined,
        drivingLicenseExpiry: undefined,
        healthCardExpiry: undefined,
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

    const isFoodActivity = useMemo(() => branding?.activityType === 'food_delivery', [branding]);

    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialData,
                fullName: initialData.fullName || (initialData as any).nameAr || '',
                nameEn: initialData.nameEn || '',
                hireDate: toFirestoreDate(initialData.hireDate) || new Date(),
                dob: toFirestoreDate(initialData.dob) || undefined,
                residencyExpiry: toFirestoreDate(initialData.residencyExpiry) || undefined,
                passportExpiry: toFirestoreDate(initialData.passportExpiry) || undefined,
                drivingLicenseExpiry: toFirestoreDate(initialData.drivingLicenseExpiry) || undefined,
                healthCardExpiry: toFirestoreDate(initialData.healthCardExpiry) || undefined,
                basicSalary: Number(initialData.basicSalary || 0),
                housingAllowance: Number(initialData.housingAllowance || 0),
                transportAllowance: Number(initialData.transportAllowance || 0),
                dailyRate: Number(initialData.dailyRate || 0),
                contractPercentage: Number(initialData.contractPercentage || 0),
            });
            setShowHousingAllowance(Number(initialData.housingAllowance) > 0);
            setShowTransportAllowance(Number(initialData.transportAllowance) > 0);
            setIsCustomHours(!!initialData.workStartTime);
        }
    }, [initialData]);

    const handleAiAnalysis = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
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
                        toast({ title: 'نجاح المسح', description: 'تم استخراج البيانات من الوثيقة آلياً.' });
                    }
                } catch (err: any) {
                    toast({ variant: 'destructive', title: 'خطأ في التحليل', description: err.message });
                } finally { setIsAnalyzing(false); }
            };
            reader.readAsDataURL(file);
        } catch (error) { setIsAnalyzing(false); }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        let finalVal: any = value;
        if (['basicSalary', 'housingAllowance', 'transportAllowance', 'dailyRate', 'contractPercentage'].includes(id)) {
            finalVal = parseFloat(value) || 0;
        }
        setFormData(prev => ({ ...prev, [id]: finalVal }));
    };

    const handleSelectChange = (id: keyof Employee, value: any) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const departmentOptions = useMemo(() => departments.map(d => ({ value: d.name, label: d.name })), [departments]);
    const filteredJobOptions = useMemo(() => {
        if (!formData.department) return [];
        const selectedDept = departments.find(d => d.name === formData.department);
        if (!selectedDept) return [];
        return jobs.filter(j => (j as any).parentId === selectedDept.id).map(j => ({ value: j.name, label: j.name }));
    }, [departments, jobs, formData.department]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.fullName || !formData.mobile) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تعبئة الاسم والجوال.' });
            return;
        }
        await onSave(formData);
    };

    const showResidencyExpiry = formData.nationality && formData.nationality.trim() !== 'كويتي';

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-8 py-4 px-1 max-h-[75vh] overflow-y-auto scrollbar-none">
                
                <div className="px-4">
                    <input type="file" ref={aiFileInputRef} className="hidden" accept="image/*, .pdf" onChange={handleAiAnalysis} />
                    <Button 
                        type="button"
                        variant="outline" 
                        className="w-full h-16 rounded-3xl border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 transition-all gap-3 group"
                        onClick={() => aiFileInputRef.current?.click()}
                        disabled={isAnalyzing || isSaving}
                    >
                        {isAnalyzing ? (
                            <>
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="font-black text-primary">جاري تحليل الوثيقة ذكياً...</span>
                            </>
                        ) : (
                            <>
                                <div className="p-2 bg-primary/10 rounded-xl text-primary group-hover:scale-110 transition-transform">
                                    <Sparkles className="h-6 w-6" />
                                </div>
                                <div className="text-right">
                                    <p className="text-base font-black text-primary">المسح الذكي للهوية (AI Scan)</p>
                                    <p className="text-[10px] text-muted-foreground font-bold">ارفع صورة البطاقة المدنية لتعبئة البيانات تلقائياً</p>
                                </div>
                            </>
                        )}
                    </Button>
                </div>

                <section className="space-y-6 p-6 border rounded-[2rem] bg-card shadow-sm">
                    <h3 className="font-black text-lg flex items-center gap-2 text-primary">
                        <User className="h-5 w-5" /> المعلومات الشخصية
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">الاسم الكامل بالعربية *</Label>
                            <Input id="fullName" value={formData.fullName || ''} onChange={handleInputChange} required className="h-11 rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">رقم الجوال *</Label>
                            <Input id="mobile" value={formData.mobile || ''} onChange={handleInputChange} dir="ltr" required className="h-11 rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">الجنسية *</Label>
                            <InlineSearchList 
                                value={formData.nationality || ''} 
                                onSelect={v => handleSelectChange('nationality', v)} 
                                options={nationalityOptions} 
                                placeholder="اختر الجنسية..." 
                            />
                        </div>
                        {showResidencyExpiry && (
                            <div className="grid gap-2 animate-in slide-in-from-top-2">
                                <Label className="font-black text-primary mr-1">تاريخ انتهاء الإقامة *</Label>
                                <DateInput 
                                    value={formData.residencyExpiry} 
                                    onChange={d => handleSelectChange('residencyExpiry', d)} 
                                    className="h-11 rounded-xl border-primary/20 bg-primary/5"
                                />
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">الرقم المدني</Label>
                            <Input id="civilId" value={formData.civilId || ''} onChange={handleInputChange} dir="ltr" maxLength={12} className="h-11 rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">تاريخ الميلاد</Label>
                            <DateInput value={formData.dob} onChange={d => handleSelectChange('dob', d)} />
                        </div>
                    </div>
                </section>

                {isFoodActivity && (
                    <section className="space-y-6 p-6 border-2 border-dashed border-indigo-200 bg-indigo-50/10 rounded-[2rem] animate-in zoom-in-95">
                        <h3 className="font-black text-lg flex items-center gap-2 text-indigo-800">
                            <FileCheck className="h-5 w-5" /> تراخيص ووثائق إضافية (نشاط غذائي)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="grid gap-2">
                                <Label className="font-bold text-indigo-900 mr-1 flex items-center gap-1"><FileText className="h-3 w-3" /> انتهاء الجواز</Label>
                                <DateInput value={formData.passportExpiry} onChange={d => handleSelectChange('passportExpiry', d)} className="bg-white" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="font-bold text-indigo-900 mr-1 flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> انتهاء كارت الصحة</Label>
                                <DateInput value={formData.healthCardExpiry} onChange={d => handleSelectChange('healthCardExpiry', d)} className="bg-white" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="font-bold text-indigo-900 mr-1 flex items-center gap-1"><Landmark className="h-3 w-3" /> انتهاء رخصة القيادة</Label>
                                <DateInput value={formData.drivingLicenseExpiry} onChange={d => handleSelectChange('drivingLicenseExpiry', d)} className="bg-white" />
                            </div>
                        </div>
                    </section>
                )}

                <section className="space-y-6 p-6 border rounded-[2rem] bg-muted/10">
                    <h3 className="font-black text-lg flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-primary" /> التعيين والدوام
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">القسم *</Label>
                            <InlineSearchList value={formData.department || ''} onSelect={v => { handleSelectChange('department', v); handleSelectChange('jobTitle', ''); }} options={departmentOptions} placeholder="اختر القسم..." />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">المسمى الوظيفي *</Label>
                            <InlineSearchList value={formData.jobTitle || ''} onSelect={v => handleSelectChange('jobTitle', v)} options={filteredJobOptions} placeholder="اختر المسمى..." disabled={!formData.department} />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">تاريخ المباشرة</Label>
                            <DateInput value={formData.hireDate} onChange={d => handleSelectChange('hireDate', d)} />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">نوع العقد</Label>
                            <Select value={formData.contractType} onValueChange={v => handleSelectChange('contractType', v)}>
                                <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="permanent">دائم</SelectItem>
                                    <SelectItem value="temporary">مؤقت</SelectItem>
                                    <SelectItem value="day_laborer">عامل يومية</SelectItem>
                                    <SelectItem value="percentage">نسبة من العقود</SelectItem>
                                    <SelectItem value="special">دوام خاص</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border shadow-sm">
                        <Checkbox id="custom-h" checked={isCustomHours} onCheckedChange={(c) => { setIsCustomHours(!!c); if(!c) { handleSelectChange('workStartTime', null); handleSelectChange('workEndTime', null); } }} />
                        <div className="space-y-0.5">
                            <Label htmlFor="custom-h" className="cursor-pointer font-black text-sm">تخصيص ساعات دوام لهذا الموظف</Label>
                            <p className="text-[10px] text-muted-foreground font-bold">إذا تم التفعيل، لن يتبع الموظف الدوام الرسمي للمكتب.</p>
                        </div>
                    </div>
                    
                    {isCustomHours && (
                        <div className="grid grid-cols-2 gap-6 animate-in slide-in-from-top-4 p-4 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20">
                            <div className="grid gap-1.5 text-center">
                                <Label className="text-[10px] uppercase font-black text-primary">بداية الدوام</Label>
                                <Input type="time" value={formData.workStartTime || '08:00'} onChange={e => handleSelectChange('workStartTime', e.target.value)} className="h-11 rounded-xl border-2 font-black text-lg text-center" />
                            </div>
                            <div className="grid gap-1.5 text-center">
                                <Label className="text-[10px] uppercase font-black text-primary">نهاية الدوام</Label>
                                <Input type="time" value={formData.workEndTime || '17:00'} onChange={e => handleSelectChange('workEndTime', e.target.value)} className="h-11 rounded-xl border-2 font-black text-lg text-center" />
                            </div>
                        </div>
                    )}
                </section>

                <section className="space-y-6 p-6 border rounded-[2rem] bg-emerald-50/20 border-emerald-100">
                    <h3 className="font-black text-lg flex items-center gap-2 text-emerald-800">
                        <Banknote className="h-5 w-5" /> الرواتب والبدلات
                    </h3>
                    
                    {formData.contractType === 'day_laborer' ? (
                        <div className="grid gap-2 max-w-xs animate-in zoom-in-95">
                            <Label className="font-black text-emerald-900">أجرة اليومية (د.ك) *</Label>
                            <Input id="dailyRate" type="number" step="0.001" value={formData.dailyRate} onChange={handleInputChange} className="h-12 text-2xl font-black text-center border-2 border-emerald-200 bg-white rounded-2xl" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="grid gap-2">
                                <Label className="font-bold text-emerald-900">الراتب الأساسي *</Label>
                                <Input id="basicSalary" type="number" step="0.001" value={formData.basicSalary} onChange={handleInputChange} className="h-11 font-mono font-bold bg-white" />
                            </div>
                            <div className="grid gap-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <Checkbox id="h-allow" checked={showHousingAllowance} onCheckedChange={c => setShowHousingAllowance(!!c)} />
                                    <Label htmlFor="h-allow" className="text-xs font-bold">بدل سكن</Label>
                                </div>
                                <Input id="housingAllowance" type="number" step="0.001" value={formData.housingAllowance} onChange={handleInputChange} disabled={!showHousingAllowance} className="h-11 bg-white" />
                            </div>
                            <div className="grid gap-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <Checkbox id="t-allow" checked={showTransportAllowance} onCheckedChange={c => setShowTransportAllowance(!!c)} />
                                    <Label htmlFor="t-allow" className="text-xs font-bold">بدل مواصلات</Label>
                                </div>
                                <Input id="transportAllowance" type="number" step="0.001" value={formData.transportAllowance} onChange={handleInputChange} disabled={!showTransportAllowance} className="h-11 bg-white" />
                            </div>
                        </div>
                    )}
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
