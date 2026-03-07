'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X, Loader2, Users } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
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

const getDeptPrefix = (deptName: string) => {
    if (!deptName) return 'G';
    const name = deptName.toLowerCase();
    if (name.includes('كهرباء')) return 'E';
    if (name.includes('صحي') || name.includes('ميكانيك')) return 'M';
    if (name.includes('إنشائي') || name.includes('هيكل') || name.includes('بناء')) return 'C';
    if (name.includes('معماري')) return 'A';
    if (name.includes('خارجية')) return 'L';
    return 'G';
};

export function EmployeeForm({ onSave, onClose, initialData = null, isSaving = false, employeeNumber = null }: EmployeeFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { branding } = useBranding();
    
    const [formData, setFormData] = useState({
        fullName: '', nameEn: '', civilId: '', mobile: '',
        hireDate: new Date(), department: '', jobTitle: '',
        workTeam: '', 
        contractType: 'permanent' as Employee['contractType'], basicSalary: '',
        housingAllowance: '', transportAllowance: '',
        salaryPaymentType: 'cash' as Employee['salaryPaymentType'],
        bankName: '',
        accountNumber: '',
        iban: '',
        contractPercentage: '',
        gender: 'male' as Employee['gender'],
        dob: undefined as Date | undefined,
        nationality: '',
        residencyExpiry: undefined as Date | undefined,
        workStartTime: '08:00',
        workEndTime: '17:00',
        pieceRateMode: 'salary_with_target' as 'salary_with_target' | 'per_piece',
        targetDescription: '',
        pieceRate: '',
        dailyRate: '',
    });

    const [showHousingAllowance, setShowHousingAllowance] = useState(false);
    const [showTransportAllowance, setShowTransportAllowance] = useState(false);
    
    const [departments, setDepartments] = useState<Department[]>([]);
    const [jobs, setJobs] = useState<(Job & { departmentId: string })[]>([]);
    const [refDataLoading, setRefDataLoading] = useState(true);
    
    const isDayLaborer = formData.contractType === 'day_laborer';
    const isSimpleLayout = isDayLaborer;

    const showTeamSelection = useMemo(() => {
        return formData.jobTitle === 'عامل' || formData.contractType === 'day_laborer';
    }, [formData.jobTitle, formData.contractType]);

    const teamOptions = useMemo(() => {
        const deptPrefix = getDeptPrefix(formData.department);
        const finalPrefix = formData.contractType === 'day_laborer' ? `L${deptPrefix}` : deptPrefix;
        
        return Array.from({ length: 10 }, (_, i) => {
            const code = `${finalPrefix}${i + 1}`;
            return { value: code, label: code };
        });
    }, [formData.department, formData.contractType]);

    const showStandardSalary = useMemo(() => {
        if (formData.contractType === 'percentage' || 
            formData.contractType === 'day_laborer') {
            return false;
        }
        if (formData.contractType === 'piece-rate' && formData.pieceRateMode === 'per_piece') {
            return false;
        }
        return true;
    }, [formData.contractType, formData.pieceRateMode]);

    useEffect(() => {
        const generalHours = branding?.work_hours?.general;
        const defaultStartTime = generalHours?.morning_start_time || '08:00';
        const defaultEndTime = generalHours?.evening_end_time || '17:00';

        if (initialData) {
            setFormData({
                fullName: initialData.fullName || (initialData as any).nameAr || '',
                nameEn: initialData.nameEn || (initialData as any).nameEn || '',
                civilId: initialData.civilId || '',
                mobile: initialData.mobile || '',
                hireDate: toFirestoreDate(initialData.hireDate) || new Date(),
                department: initialData.department || '',
                jobTitle: initialData.jobTitle || '',
                workTeam: (initialData as any).workTeam || '',
                contractType: initialData.contractType || 'permanent',
                basicSalary: String(initialData.basicSalary || ''),
                housingAllowance: String(initialData.housingAllowance || ''),
                transportAllowance: String(initialData.transportAllowance || ''),
                salaryPaymentType: initialData.salaryPaymentType || 'cash',
                bankName: initialData.bankName || '',
                accountNumber: initialData.accountNumber || '',
                iban: initialData.iban || '',
                contractPercentage: String(initialData.contractPercentage || ''),
                gender: initialData.gender || 'male',
                dob: toFirestoreDate(initialData.dob) || undefined,
                nationality: initialData.nationality || '',
                residencyExpiry: toFirestoreDate(initialData.residencyExpiry) || undefined,
                workStartTime: initialData.workStartTime || defaultStartTime,
                workEndTime: initialData.workEndTime || defaultEndTime,
                pieceRateMode: initialData.pieceRateMode || 'salary_with_target',
                targetDescription: String(initialData.targetDescription || ''),
                pieceRate: String(initialData.pieceRate || ''),
                dailyRate: String(initialData.dailyRate || ''),
            });
            setShowHousingAllowance(!!initialData.housingAllowance && initialData.housingAllowance > 0);
            setShowTransportAllowance(!!initialData.transportAllowance && initialData.transportAllowance > 0);
        } else if (branding) {
            setFormData(prev => ({
                ...prev,
                workStartTime: defaultStartTime,
                workEndTime: defaultEndTime,
            }));
            setShowHousingAllowance(false);
            setShowTransportAllowance(false);
        }
    }, [initialData?.id, branding]);

    useEffect(() => {
        if (initialData?.id) return;
        const noSalaryContractTypes = ['percentage', 'day_laborer'];
        const workTimeShouldBeHidden = ['permanent', 'percentage', 'piece-rate', 'day_laborer'].includes(formData.contractType);

        if (noSalaryContractTypes.includes(formData.contractType) || (formData.contractType === 'piece-rate' && formData.pieceRateMode === 'per_piece')) {
            setFormData(prev => ({
                ...prev,
                basicSalary: '0',
                housingAllowance: '0',
                transportAllowance: '0',
            }));
            setShowHousingAllowance(false);
            setShowTransportAllowance(false);
        }
        
        if (workTimeShouldBeHidden && branding?.work_hours?.general) {
             setFormData(prev => ({
                ...prev,
                workStartTime: branding.work_hours.general.morning_start_time || '08:00',
                workEndTime: branding.work_hours.general.evening_end_time || '17:00',
            }));
        }
    }, [formData.contractType, formData.pieceRateMode, branding, initialData?.id]);


    useEffect(() => {
        if (!firestore) return;
        const fetchReferenceData = async () => {
            setRefDataLoading(true);
            try {
                const engQuery = query(collection(firestore, 'employees'), where('status', '==', 'active'));
                const govQuery = query(collection(firestore, 'governorates'), orderBy('name'));
                
                const [engSnapshot, govSnapshot] = await Promise.all([getDocs(engQuery), getDocs(govQuery)]);

                const fetchedDepartments = [
                    { name: 'القسم المعماري', order: 1 },
                    { name: 'القسم الإنشائي', order: 2 },
                    { name: 'قسم الكهرباء', order: 3 },
                    { name: 'قسم الميكانيك', order: 4 },
                    { name: 'قسم المبيعات', order: 5 },
                    { name: 'الإدارة', order: 6 },
                    { name: 'المحاسبة', order: 7 },
                    { name: 'الموارد البشرية', order: 8 },
                    { name: 'سكرتارية', order: 9 },
                    { name: 'خارجية', order: 10 }
                ] as Department[];
                setDepartments(fetchedDepartments);

                const fetchedJobs = [
                    { name: 'مهندس معماري', order: 1 },
                    { name: 'مهندس مدني', order: 2 },
                    { name: 'مهندس كهرباء', order: 3 },
                    { name: 'مهندس ميكانيك', order: 4 },
                    { name: 'محاسب', order: 5 },
                    { name: 'سكرتير', order: 6 },
                    { name: 'عامل', order: 7 }
                ] as any[];
                setJobs(fetchedJobs);

            } catch (error) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات المرجعية.' });
            } finally {
                setRefDataLoading(false);
            }
        };

        fetchReferenceData();
    }, [firestore, toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        let sanitizedValue = value;
        if (id === 'fullName') {
            sanitizedValue = value.replace(/[^ \u0600-\u06FF]/g, ''); 
        } else if (id === 'nameEn') {
            sanitizedValue = value.replace(/[^ a-zA-Z]/g, '');
        }
        setFormData(prev => ({ ...prev, [id]: sanitizedValue }));
    };
    
    const handleSelectChange = (id: keyof typeof formData, value: any) => {
        const newFormData = { ...formData, [id]: value };
        if (id === 'department') {
            newFormData.jobTitle = ''; 
            newFormData.workTeam = ''; 
        }
        setFormData(newFormData);
    };
    
    const departmentOptions = useMemo(() => departments.map(d => ({ value: d.name, label: d.name })), [departments]);

    const filteredJobOptions = useMemo(() => {
        return jobs.map(j => ({ value: j.name, label: j.name }));
    }, [jobs]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (formData.mobile && formData.mobile.replace(/\D/g, '').length !== 8) {
            toast({ variant: 'destructive', title: 'خطأ في البيانات', description: 'رقم الهاتف يجب أن يكون 8 أرقام بالضبط.' });
            return;
        }
        if (!isSimpleLayout && formData.civilId && formData.civilId.replace(/\D/g, '').length !== 12) {
            toast({ variant: 'destructive', title: 'خطأ في البيانات', description: 'الرقم المدني يجب أن يكون 12 رقماً بالضبط.' });
            return;
        }

        if (!formData.fullName || !formData.mobile) {
            toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'الرجاء تعبئة اسم الموظف بالعربية ورقم الجوال.' });
            return;
        }
        if (!initialData && !isSimpleLayout && !formData.department) {
             toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'الرجاء اختيار قسم للموظف.' });
            return;
        }
        
        const dataToSave: Partial<Employee> = {
            fullName: formData.fullName,
            mobile: formData.mobile,
            contractType: formData.contractType,
        };

        if (showTeamSelection) {
            (dataToSave as any).workTeam = formData.workTeam;
        }

        if (isSimpleLayout) {
            dataToSave.department = formData.department || 'عمالة خارجية';
            dataToSave.jobTitle = 'عامل يومية';
            dataToSave.civilId = formData.civilId || ''; 
            dataToSave.hireDate = formData.hireDate;
            dataToSave.basicSalary = 0;

            if (isDayLaborer) {
                if (!formData.dailyRate || parseFloat(formData.dailyRate) <= 0) {
                    toast({ variant: 'destructive', title: 'حقل مطلوب', description: 'يجب إدخال اليومية وتكون أكبر من صفر.' });
                    return;
                }
                dataToSave.dailyRate = parseFloat(formData.dailyRate);
            }
        } else {
            if (!formData.civilId || !formData.hireDate || !formData.department || !formData.jobTitle) {
                toast({ variant: 'destructive', title: 'حقول مطلوبة', description: 'الرجاء تعبئة جميع الحقول الإلزامية (*).' });
                return;
            }
            const isSalaryRequired = formData.contractType !== 'percentage' && (formData.contractType !== 'piece-rate' || formData.pieceRateMode === 'salary_with_target');
            if (isSalaryRequired && !formData.basicSalary) {
                 toast({ variant: 'destructive', title: 'حقول مطلوبة', description: 'الرجاء إدخال الراتب الأساسي.' });
                return;
            }
            
            Object.assign(dataToSave, {
                nameEn: formData.nameEn,
                civilId: formData.civilId,
                hireDate: formData.hireDate,
                department: formData.department,
                jobTitle: formData.jobTitle,
                salaryPaymentType: formData.salaryPaymentType,
                bankName: formData.salaryPaymentType === 'transfer' ? formData.bankName : '',
                accountNumber: formData.salaryPaymentType === 'transfer' ? formData.accountNumber : '',
                iban: formData.salaryPaymentType === 'transfer' ? formData.iban : '',
                gender: formData.gender,
                dob: formData.dob,
                nationality: formData.nationality,
                workStartTime: formData.workStartTime,
                workEndTime: formData.workEndTime,
            });

            if (formData.contractType === 'piece-rate') {
                dataToSave.pieceRateMode = formData.pieceRateMode;
                if (formData.pieceRateMode === 'salary_with_target') {
                    dataToSave.basicSalary = parseFloat(formData.basicSalary) || 0;
                    dataToSave.targetDescription = parseFloat(formData.targetDescription) || 0;
                    dataToSave.pieceRate = 0;
                } else { // per_piece
                    dataToSave.basicSalary = 0; dataToSave.housingAllowance = 0; dataToSave.transportAllowance = 0;
                    dataToSave.targetDescription = 0;
                    dataToSave.pieceRate = parseFloat(formData.pieceRate) || 0;
                }
            } else {
                 dataToSave.basicSalary = parseFloat(formData.basicSalary) || 0;
                 dataToSave.housingAllowance = showHousingAllowance ? (parseFloat(formData.housingAllowance) || 0) : 0;
                 dataToSave.transportAllowance = showTransportAllowance ? (parseFloat(formData.transportAllowance) || 0) : 0;
            }

            if (formData.nationality && formData.nationality.trim() !== 'كويتي' && formData.residencyExpiry) {
                dataToSave.residencyExpiry = formData.residencyExpiry;
            }
            if (['percentage', 'special'].includes(formData.contractType)) {
                dataToSave.contractPercentage = parseFloat(formData.contractPercentage) || 0;
            }
        }
        
        await onSave(dataToSave);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-6 py-4 px-1 max-h-[70vh] overflow-y-auto">
                <section className="space-y-4 p-4 border rounded-lg">
                     <h3 className="font-semibold text-lg">المعلومات الأساسية</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="fullName">الاسم الكامل <span className="text-destructive">*</span></Label>
                            <Input id="fullName" value={formData.fullName} onChange={handleInputChange} required />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="mobile">رقم الجوال <span className="text-destructive">*</span></Label>
                            <Input id="mobile" value={formData.mobile} onChange={handleInputChange} dir="ltr" required />
                        </div>
                    </div>
                     <div className="grid gap-1.5 pt-4">
                        <Label htmlFor="contractType">نوع العقد <span className="text-destructive">*</span></Label>
                        <Select value={formData.contractType || ''} onValueChange={(v) => handleSelectChange('contractType', v as Employee['contractType'])} dir="rtl">
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="permanent">دائم</SelectItem>
                                <SelectItem value="temporary">مؤقت</SelectItem>
                                <SelectItem value="piece-rate">بالقطعة / بالإنجاز</SelectItem>
                                <SelectItem value="percentage">نسبة من العقود</SelectItem>
                                <SelectItem value="part-time">دوام جزئي</SelectItem>
                                <SelectItem value="special">دوام خاص</SelectItem>
                                <SelectItem value="day_laborer">عامل باليومية</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </section>

                {isSimpleLayout && (
                    <section className="space-y-4 p-4 border rounded-lg bg-muted/30">
                        <h3 className="font-semibold text-lg">بيانات عامل اليومية</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="department-dl">القسم (التخصص)</Label>
                                <InlineSearchList value={formData.department} onSelect={(v) => handleSelectChange('department', v)} options={departmentOptions} placeholder="اختر قسم اليومية..." />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="civilId-dl">الرقم المدني (اختياري)</Label>
                                <Input id="civilId" value={formData.civilId} onChange={handleInputChange} dir="ltr" placeholder="أدخل الرقم المدني إن وجد" />
                            </div>
                            {isDayLaborer && (
                                <div className="grid gap-1.5">
                                    <Label htmlFor="dailyRate">اليومية (د.ك) <span className="text-destructive">*</span></Label>
                                    <Input id="dailyRate" type="number" step="0.001" value={formData.dailyRate} onChange={handleInputChange} dir="ltr" required />
                                </div>
                            )}
                        </div>
                    </section>
                )}
                
                {!isSimpleLayout && (
                    <section className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-semibold text-lg">المعلومات الوظيفية</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="department">القسم <span className="text-destructive">*</span></Label>
                                <InlineSearchList value={formData.department} onSelect={(v) => handleSelectChange('department', v)} options={departmentOptions} placeholder={refDataLoading ? "تحميل..." : "اختر قسمًا..."} disabled={refDataLoading} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="jobTitle">المسمى الوظيفي <span className="text-destructive">*</span></Label>
                                <InlineSearchList 
                                    value={formData.jobTitle} 
                                    onSelect={(v) => handleSelectChange('jobTitle', v)} 
                                    options={filteredJobOptions} 
                                    placeholder={!formData.department ? "اختر قسمًا أولاً" : refDataLoading ? "تحميل..." : "اختر مسمى وظيفي..."} 
                                    disabled={refDataLoading || !formData.department}
                                />
                            </div>
                        </div>
                    </section>
                )}

                {showTeamSelection && (
                    <section className="space-y-4 p-4 border rounded-lg bg-primary/5 animate-in fade-in slide-in-from-top-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="workTeam" className="font-bold text-primary flex items-center gap-2">
                                <Users className="h-4 w-4" /> توزيع فريق العمل (ترميز ثنائي ذكي)
                            </Label>
                            <Select value={formData.workTeam} onValueChange={(v) => handleSelectChange('workTeam', v)} dir="rtl">
                                <SelectTrigger id="workTeam" className="border-primary/20 bg-white">
                                    <SelectValue placeholder={!formData.department ? "حدد القسم أولاً لتوليد الرموز" : "اختر الرمز..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {teamOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="font-mono bg-white">{opt.value}</Badge>
                                                <span>
                                                    {formData.contractType === 'day_laborer' ? 'يومية ' : 'فريق '}
                                                    {formData.department} {opt.value.replace(/\D/g, '')}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground mt-1 pr-1 font-bold">
                                الترميز: (L=يومية، E=كهرباء، M=صحي، C=إنشائي). مثال: <span className="text-primary">LM1</span> = يومية ميكانيك/صحي فريق 1
                            </p>
                        </div>
                    </section>
                )}

                {!isSimpleLayout && (
                    <>
                        <section className="space-y-4 p-4 border rounded-lg">
                            <h3 className="font-semibold text-lg">تفاصيل التعيين</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="grid gap-1.5">
                                    <Label>الرقم الوظيفي</Label>
                                    <Input value={employeeNumber || ''} disabled readOnly />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="hireDate">تاريخ التعيين <span className="text-destructive">*</span></Label>
                                    <DateInput value={formData.hireDate} onChange={(date) => handleSelectChange('hireDate', date!)} />
                                </div>
                            </div>
                            {formData.contractType === 'special' && (
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-4">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="workStartTime">يبدأ الدوام الساعة</Label>
                                        <Input id="workStartTime" type="time" value={formData.workStartTime} onChange={handleInputChange} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="workEndTime">ينتهي الدوام الساعة</Label>
                                        <Input id="workEndTime" type="time" value={formData.workEndTime} onChange={handleInputChange} />
                                    </div>
                                </div>
                            )}
                        </section>
                        
                        <section className="space-y-4 p-4 border rounded-lg">
                            <h3 className="font-semibold text-lg">المعلومات المالية</h3>
                             {formData.contractType === 'piece-rate' && (
                                <div className="p-4 border rounded-md bg-muted/50 space-y-4">
                                   <RadioGroup
                                        value={formData.pieceRateMode}
                                        onValueChange={(value: "salary_with_target" | "per_piece") => handleSelectChange('pieceRateMode', value)}
                                        className="flex items-center space-x-4 rtl:space-x-reverse"
                                    >
                                        <div className="flex items-center space-x-2 rtl:space-x-reverse"><RadioGroupItem value="salary_with_target" id="r-salary" /><Label htmlFor="r-salary">راتب مع تارجت</Label></div>
                                        <div className="flex items-center space-x-2 rtl:space-x-reverse"><RadioGroupItem value="per_piece" id="r-piece" /><Label htmlFor="r-piece">بالقطعة فقط</Label></div>
                                    </RadioGroup>
                                     {formData.pieceRateMode === 'salary_with_target' && (<div className="grid gap-1.5 max-w-sm"><Label htmlFor="targetDescription">التارجت الشهري</Label><Input id="targetDescription" type="number" value={formData.targetDescription} onChange={handleInputChange} /></div>)}
                                     {formData.pieceRateMode === 'per_piece' && (<div className="grid gap-1.5 max-w-sm"><Label htmlFor="pieceRate">سعر القطعة (د.ك)</Label><Input id="pieceRate" type="number" step="any" value={formData.pieceRate} onChange={handleInputChange} /></div>)}
                                </div>
                            )}
                            {showStandardSalary && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start pt-2">
                                    <div className="grid gap-1.5"><Label htmlFor="basicSalary">الراتب الأساسي (د.ك) <span className="text-destructive">*</span></Label><Input id="basicSalary" type="number" step="0.001" value={formData.basicSalary} onChange={handleInputChange} dir="ltr" required /></div>
                                    <div className="grid gap-1.5"><div className="flex items-center gap-2 mb-2"><Checkbox id="show-housing" checked={showHousingAllowance} onCheckedChange={(c) => setShowHousingAllowance(!!c)}/><Label htmlFor="show-housing">إضافة بدل سكن</Label></div>{showHousingAllowance && <Input id="housingAllowance" type="number" step="0.001" value={formData.housingAllowance} onChange={handleInputChange} dir="ltr" />}</div>
                                    <div className="grid gap-1.5"><div className="flex items-center gap-2 mb-2"><Checkbox id="show-transport" checked={showTransportAllowance} onCheckedChange={(c) => setShowTransportAllowance(!!c)}/><Label htmlFor="show-transport">إضافة بدل مواصلات</Label></div>{showTransportAllowance && <Input id="transportAllowance" type="number" step="0.001" value={formData.transportAllowance} onChange={handleInputChange} dir="ltr" />}</div>
                                </div>
                            )}
                            {(formData.contractType === 'percentage' || formData.contractType === 'special') && (<div className="grid gap-1.5 max-w-sm"><Label htmlFor="contractPercentage">نسبة العقد (%)</Label><Input id="contractPercentage" type="number" step="0.1" value={formData.contractPercentage} onChange={handleInputChange} dir="ltr" /></div>)}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t mt-4">
                                <div className="grid gap-1.5"><Label htmlFor="salaryPaymentType">طريقة دفع الراتب</Label><Select value={formData.salaryPaymentType} onValueChange={(v) => handleSelectChange('salaryPaymentType', v as Employee['salaryPaymentType'])} dir="rtl"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">كاش</SelectItem><SelectItem value="cheque">شيك</SelectItem><SelectItem value="transfer">تحويل بنكي</SelectItem></SelectContent></Select></div>
                                {formData.salaryPaymentType === 'transfer' && (<><div className="grid gap-1.5"><Label htmlFor="bankName">اسم البنك</Label><Input id="bankName" value={formData.bankName} onChange={handleInputChange} /></div><div className="grid gap-1.5"><Label htmlFor="accountNumber">رقم الحساب</Label><Input id="accountNumber" value={formData.accountNumber} onChange={handleInputChange} dir="ltr"/></div></>)}
                            </div>
                        </section>

                        <section className="space-y-4 p-4 border rounded-lg">
                            <h3 className="font-semibold text-lg">معلومات شخصية إضافية</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="grid gap-1.5"><Label htmlFor="nameEn">الاسم (بالإنجليزية)</Label><Input id="nameEn" dir="ltr" value={formData.nameEn} onChange={handleInputChange} /></div>
                                <div className="grid gap-1.5"><Label htmlFor="civilId">الرقم المدني <span className="text-destructive">*</span></Label><Input id="civilId" value={formData.civilId} onChange={handleInputChange} dir="ltr" required /></div>
                                <div className="grid gap-1.5"><Label htmlFor="dob">تاريخ الميلاد</Label><DateInput value={formData.dob} onChange={(date) => handleSelectChange('dob', date)} /></div>
                                <div className="grid gap-1.5"><Label htmlFor="gender">الجنس</Label><Select value={formData.gender} onValueChange={(v) => handleSelectChange('gender', v as Employee['gender'])} dir="rtl"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="male">ذكر</SelectItem><SelectItem value="female">أنثى</SelectItem></SelectContent></Select></div>
                                <div className="grid gap-1.5"><Label htmlFor="nationality">الجنسية</Label><InlineSearchList value={formData.nationality} onSelect={(value) => handleSelectChange('nationality', value)} options={nationalityOptions} placeholder="اختر الجنسية..." /></div>
                                {formData.nationality && formData.nationality.trim() !== 'كويتي' && (<div className="grid gap-1.5"><Label htmlFor="residencyExpiry">تاريخ انتهاء الإقامة</Label><DateInput value={formData.residencyExpiry} onChange={(date) => handleSelectChange('residencyExpiry', date)} /></div>)}
                            </div>
                        </section>
                    </>
                )}
            </div>
            <DialogFooter className="mt-6 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                    {isSaving ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
            </DialogFooter>
        </form>
    );
}
