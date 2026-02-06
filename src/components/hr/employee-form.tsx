'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X, Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, collectionGroup } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import type { Employee, Department, Job } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DateInput } from '@/components/ui/date-input';

interface EmployeeFormProps {
    onSave: (data: Partial<Employee>) => Promise<void>;
    onClose: () => void;
    initialData?: Partial<Employee> | null;
    isSaving?: boolean;
}

export function EmployeeForm({ onSave, onClose, initialData = null, isSaving = false }: EmployeeFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [formData, setFormData] = useState<{
        fullName: string; nameEn: string; civilId: string; mobile: string;
        hireDate: string; department: string; jobTitle: string;
        contractType: Employee['contractType']; basicSalary: string;
    }>({
        fullName: '', nameEn: '', civilId: '', mobile: '',
        hireDate: new Date().toISOString().split('T')[0], department: '', jobTitle: '',
        contractType: 'permanent', basicSalary: ''
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
                hireDate: initialData.hireDate ? new Date(initialData.hireDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                department: initialData.department || '',
                jobTitle: initialData.jobTitle || '',
                contractType: initialData.contractType || 'permanent',
                basicSalary: String(initialData.basicSalary || ''),
            });
        }
    }, [initialData]);

    useEffect(() => {
        if (!firestore) return;
        const fetchReferenceData = async () => {
            setRefDataLoading(true);
            try {
                const deptsQuery = query(collection(firestore, 'departments'));
                const jobsQuery = query(collectionGroup(firestore, 'jobs'));
                
                const [deptsSnapshot, jobsSnapshot] = await Promise.all([
                    getDocs(deptsQuery),
                    getDocs(jobsQuery)
                ]);

                setDepartments(deptsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
                
                const uniqueJobs = new Map<string, Job>();
                jobsSnapshot.forEach(doc => {
                    const jobData = doc.data() as Job;
                    if (!uniqueJobs.has(jobData.name)) {
                        uniqueJobs.set(jobData.name, { id: doc.id, ...jobData });
                    }
                });
                setJobs(Array.from(uniqueJobs.values()));

            } catch (error) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب الأقسام والوظائف.' });
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
    
    const handleSelectChange = (id: keyof typeof formData, value: string) => {
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
            hireDate: new Date(formData.hireDate),
            department: formData.department,
            jobTitle: formData.jobTitle,
            contractType: formData.contractType,
            basicSalary: parseFloat(formData.basicSalary),
        };
        
        await onSave(dataToSave);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-6 py-4 px-1 max-h-[70vh] overflow-y-auto">
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
                        <DateInput value={formData.hireDate} onChange={(date) => handleSelectChange('hireDate', date)} />
                    </div>
                     <div className="grid gap-1.5">
                        <Label htmlFor="contractType">نوع العقد <span className="text-destructive">*</span></Label>
                        <Select value={formData.contractType || ''} onValueChange={(v) => handleSelectChange('contractType', v)} dir="rtl">
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="permanent">دائم</SelectItem>
                                <SelectItem value="temporary">مؤقت</SelectItem>
                                <SelectItem value="subcontractor">مقاول باطن</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <Separator />
                <div className="grid gap-1.5">
                    <Label htmlFor="basicSalary">الراتب الأساسي (د.ك) <span className="text-destructive">*</span></Label>
                    <Input id="basicSalary" type="number" step="0.01" value={formData.basicSalary} onChange={handleInputChange} dir="ltr" required />
                </div>
            </div>
            <DialogFooter className="mt-6 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                    {isSaving ? 'جاري الحفظ...' : 'حفظ الموظف'}
                </Button>
            </DialogFooter>
        </form>
    );
}
