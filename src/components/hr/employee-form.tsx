'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X, Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
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
    
    const [formData, setFormData] = useState({
        fullName: '', nameEn: '', civilId: '', mobile: '',
        hireDate: new Date(), department: '', jobTitle: '',
        contractType: 'permanent' as Employee['contractType'], basicSalary: '',
        salaryPaymentType: 'cash' as Employee['salaryPaymentType'],
        bankName: '',
        accountNumber: '',
        iban: '',
        contractPercentage: '',
        gender: 'male' as Employee['gender'],
        dob: undefined as Date | undefined,
        nationality: '',
        residencyExpiry: undefined as Date | undefined,
    });
    
    const [departments, setDepartments] = useState<Department[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [refDataLoading, setRefDataLoading] = useState(true);

    useEffect(() => {
        if (initialData) {
            setFormData({
                fullName: initialData.fullName || '',
                nameEn: initialData.nameEn || '',
                civilId: initialData.civilId || '',
                mobile: initialData.mobile || '',
                hireDate: toFirestoreDate(initialData.hireDate) || new Date(),
                department: initialData.department || '',
                jobTitle: initialData.jobTitle || '',
                contractType: initialData.contractType || 'permanent',
                basicSalary: String(initialData.basicSalary || ''),
                salaryPaymentType: initialData.salaryPaymentType || 'cash',
                bankName: initialData.bankName || '',
                accountNumber: initialData.accountNumber || '',
                iban: initialData.iban || '',
                contractPercentage: String(initialData.contractPercentage || ''),
                gender: initialData.gender || 'male',
                dob: toFirestoreDate(initialData.dob) || undefined,
                nationality: initialData.nationality || '',
                residencyExpiry: toFirestoreDate(initialData.residencyExpiry) || undefined,
            });
        }
    }, [initialData]);


    useEffect(() => {
        if (!firestore) return;
        const fetchReferenceData = async () => {
            setRefDataLoading(true);
            // IMPROVED: Added try-catch for better error handling during data fetch.
            try {
                const deptsQuery = query(collection(firestore, 'departments'));
                const jobsQuery = query(collectionGroup(firestore, 'jobs'));
                
                const [deptsSnapshot, jobsSnapshot] = await Promise.all([getDocs(deptsQuery), getDocs(jobsQuery)]);

                // FIXED: Filter out any department or job that doesn't have a name to prevent crashes.
                const fetchedDepartments = deptsSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Department))
                    .filter(dept => dept && typeof dept.name === 'string' && dept.name.trim() !== '');

                fetchedDepartments.sort((a,b) => a.name.localeCompare(b.name, 'ar'));
                setDepartments(fetchedDepartments);

                const uniqueJobs = new Map<string, Job>();
                jobsSnapshot.forEach(doc => {
                    const jobData = doc.data() as Job;
                    if (jobData && typeof jobData.name === 'string' && jobData.name.trim() !== '' && !uniqueJobs.has(jobData.name)) {
                        uniqueJobs.set(jobData.name, { id: doc.id, ...jobData });
                    }
                });
                setJobs(Array.from(uniqueJobs.values()).sort((a,b) => a.name.localeCompare(b.name, 'ar')));

            } catch (error) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات المرجعية.' });
            } finally {
                setRefDataLoading(false);
            }
        };

        fetchReferenceData();
    }, [firestore, toast]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        let sanitizedValue = value;
        if (id === 'fullName') sanitizedValue = value.replace(/[^ \u0600-\u06FF]/g, '');
        else if (id === 'nameEn') sanitizedValue = value.replace(/[^ a-zA-Z]/g, '');
        setFormData(prev => ({ ...prev, [id]: sanitizedValue }));
    };
    
    const handleSelectChange = (id: keyof typeof formData, value: any) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };
    
    const departmentOptions = useMemo(() => departments.map(d => ({ value: d.name, label: d.name })), [departments]);
    const jobOptions = useMemo(() => jobs.map(j => ({ value: j.name, label: j.name })), [jobs]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.fullName || !formData.civilId || !formData.mobile || !formData.hireDate || !formData.department || !formData.jobTitle || !formData.basicSalary) {
            toast({ variant: 'destructive', title: 'حقول مطلوبة', description: 'الرجاء تعبئة جميع الحقول الإلزامية (*).' });
            return;
        }
        
        const dataToSave: Partial<Employee> = {
            fullName: formData.fullName,
            nameEn: formData.nameEn,
            civilId: formData.civilId,
            mobile: formData.mobile,
            hireDate: formData.hireDate,
            department: formData.department,
            jobTitle: formData.jobTitle,
            contractType: formData.contractType,
            basicSalary: parseFloat(formData.basicSalary),
            salaryPaymentType: formData.salaryPaymentType,
            bankName: formData.salaryPaymentType === 'transfer' ? formData.bankName : '',
            accountNumber: formData.salaryPaymentType === 'transfer' ? formData.accountNumber : '',
            iban: formData.salaryPaymentType === 'transfer' ? formData.iban : '',
            contractPercentage: formData.contractType === 'percentage' ? parseFloat(formData.contractPercentage) : undefined,
            gender: formData.gender,
            dob: formData.dob,
            nationality: formData.nationality,
            residencyExpiry: formData.nationality && formData.nationality.trim() !== 'كويتي' && formData.residencyExpiry ? formData.residencyExpiry : undefined,
        };
        
        await onSave(dataToSave);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-6 py-4 px-1 max-h-[70vh] overflow-y-auto">
                {(initialData?.employeeNumber || employeeNumber) && (
                    <div className="grid gap-1.5">
                        <Label htmlFor="employeeNumber">الرقم الوظيفي</Label>
                        <Input id="employeeNumber" value={initialData?.employeeNumber || employeeNumber || ''} disabled readOnly />
                    </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                        <Label htmlFor="fullName">الاسم الكامل <span className="text-destructive">*</span></Label>
                        <Input id="fullName" value={formData.fullName} onChange={handleInputChange} required />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="nameEn">الاسم (بالإنجليزية)</Label>
                        <Input id="nameEn" dir="ltr" value={formData.nameEn} onChange={handleInputChange} />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                        <Label htmlFor="civilId">الرقم المدني <span className="text-destructive">*</span></Label>
                        <Input id="civilId" value={formData.civilId} onChange={handleInputChange} dir="ltr" required />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="mobile">رقم الجوال <span className="text-destructive">*</span></Label>
                        <Input id="mobile" value={formData.mobile} onChange={handleInputChange} dir="ltr" required />
                    </div>
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                        <Label htmlFor="dob">تاريخ الميلاد</Label>
                        <DateInput value={formData.dob} onChange={(date) => handleSelectChange('dob', date)} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="gender">الجنس</Label>
                        <Select value={formData.gender} onValueChange={(v) => handleSelectChange('gender', v as Employee['gender'])} dir="rtl">
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="male">ذكر</SelectItem>
                                <SelectItem value="female">أنثى</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                        <Label htmlFor="nationality">الجنسية</Label>
                        <InlineSearchList
                            value={formData.nationality}
                            onSelect={(value) => handleSelectChange('nationality', value)}
                            options={nationalityOptions}
                            placeholder="اختر الجنسية..."
                        />
                    </div>
                    {formData.nationality && formData.nationality.trim() !== 'كويتي' && (
                        <div className="grid gap-1.5">
                            <Label htmlFor="residencyExpiry">تاريخ انتهاء الإقامة</Label>
                            <DateInput value={formData.residencyExpiry} onChange={(date) => handleSelectChange('residencyExpiry', date)} />
                        </div>
                    )}
                </div>
                 <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="grid gap-1.5">
                        <Label htmlFor="department">القسم <span className="text-destructive">*</span></Label>
                        <InlineSearchList value={formData.department} onSelect={(v) => handleSelectChange('department', v)} options={departmentOptions} placeholder={refDataLoading ? "تحميل..." : "اختر قسمًا..."} disabled={refDataLoading} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="jobTitle">المسمى الوظيفي <span className="text-destructive">*</span></Label>
                        <InlineSearchList value={formData.jobTitle} onSelect={(v) => handleSelectChange('jobTitle', v)} options={jobOptions} placeholder={refDataLoading ? "تحميل..." : "اختر مسمى وظيفي..."} disabled={refDataLoading}/>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="grid gap-1.5">
                        <Label htmlFor="hireDate">تاريخ التعيين <span className="text-destructive">*</span></Label>
                        <DateInput value={formData.hireDate} onChange={(date) => handleSelectChange('hireDate', date!)} />
                    </div>
                     <div className="grid gap-1.5">
                        <Label htmlFor="contractType">نوع العقد <span className="text-destructive">*</span></Label>
                        <Select value={formData.contractType || ''} onValueChange={(v) => handleSelectChange('contractType', v as Employee['contractType'])} dir="rtl">
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="permanent">دائم</SelectItem>
                                <SelectItem value="temporary">مؤقت</SelectItem>
                                <SelectItem value="subcontractor">مقاول باطن</SelectItem>
                                <SelectItem value="percentage">نسبة من العقود</SelectItem>
                                <SelectItem value="part-time">دوام جزئي</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                {formData.contractType === 'percentage' && (
                    <div className="grid gap-1.5">
                        <Label htmlFor="contractPercentage">نسبة العقد (%) <span className="text-destructive">*</span></Label>
                        <Input id="contractPercentage" type="number" step="0.01" value={formData.contractPercentage} onChange={handleInputChange} dir="ltr" required />
                    </div>
                )}
                <Separator />
                <div className="grid gap-4">
                    <div className="grid gap-1.5">
                        <Label htmlFor="basicSalary">الراتب الأساسي (د.ك) <span className="text-destructive">*</span></Label>
                        <Input id="basicSalary" type="number" step="0.01" value={formData.basicSalary} onChange={handleInputChange} dir="ltr" required />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="salaryPaymentType">طريقة دفع الراتب</Label>
                            <Select value={formData.salaryPaymentType || 'cash'} onValueChange={(v) => handleSelectChange('salaryPaymentType', v as Employee['salaryPaymentType'])} dir="rtl">
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">نقداً</SelectItem>
                                    <SelectItem value="cheque">شيك</SelectItem>
                                    <SelectItem value="transfer">تحويل بنكي</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    
                    {formData.salaryPaymentType === 'transfer' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-md bg-muted/50">
                            <div className="grid gap-1.5">
                                <Label htmlFor="bankName">اسم البنك</Label>
                                <Input id="bankName" value={formData.bankName} onChange={handleInputChange} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="accountNumber">رقم الحساب</Label>
                                <Input id="accountNumber" value={formData.accountNumber} onChange={handleInputChange} dir="ltr" />
                            </div>
                            <div className="grid gap-1.5 sm:col-span-2">
                                <Label htmlFor="iban">IBAN</Label>
                                <Input id="iban" value={formData.iban} onChange={handleInputChange} dir="ltr" />
                            </div>
                        </div>
                    )}
                </div>
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
