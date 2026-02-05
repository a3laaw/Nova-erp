'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, collectionGroup } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import type { Employee, Department, Job, UserProfile, UserRole } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Info } from 'lucide-react';
import { Save, Loader2 } from 'lucide-react';

interface EmployeeFormProps {
  onSave: (employeeData: Partial<Employee>, userData: Partial<UserProfile>) => Promise<void>;
  onClose: () => void;
  initialData?: Partial<Employee> & { user?: Partial<UserProfile> } | null;
  isSaving?: boolean;
}

const roleOptions: { value: UserProfile['role']; label: string }[] = [
    { value: 'Admin', label: 'مدير' },
    { value: 'Engineer', label: 'مهندس' },
    { value: 'Accountant', label: 'محاسب' },
    { value: 'Secretary', label: 'سكرتارية' },
    { value: 'HR', label: 'موارد بشرية' },
];

const initialFormData: Partial<Employee> = {
    status: 'active',
    contractType: 'permanent',
};

const initialUserData: Partial<UserProfile> = {
    role: 'Engineer',
};


export function EmployeeForm({ onSave, onClose, initialData = null, isSaving = false }: EmployeeFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const isEditing = !!initialData?.id;

    // Form state
    const [formData, setFormData] = useState<Partial<Employee>>(initialFormData);
    const [userData, setUserData] = useState<Partial<UserProfile>>(initialUserData);
    const [password, setPassword] = useState('');

    // Reference Data
    const [departments, setDepartments] = useState<Department[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [refDataLoading, setRefDataLoading] = useState(true);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };
    
    const handleUserInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        if(id === 'username') {
            const sanitized = value.toLowerCase().replace(/[^a-z0-9._]/g, '');
            setUserData(prev => ({...prev, [id]: sanitized }));
        } else {
            setUserData(prev => ({ ...prev, [id]: value }));
        }
    };
    
    const handleSelectChange = (id: keyof Employee | keyof UserProfile, value: string) => {
        if (id in initialFormData || id === 'department' || id === 'jobTitle' || id === 'contractType' || id === 'hireDate') {
             setFormData(prev => ({ ...prev, [id as keyof Employee]: value }));
        } else {
            setUserData(prev => ({...prev, [id as keyof UserProfile]: value as UserRole}));
        }
    }


    useEffect(() => {
        if (initialData) {
            const { user, ...employeeData } = initialData;
            setFormData(employeeData);
            setUserData(user || {});
        } else {
            setFormData({
                ...initialFormData,
                hireDate: new Date().toISOString().split('T')[0],
            });
            setUserData(initialUserData);
        }
    }, [initialData]);

    useEffect(() => {
        if (!firestore) return;
        const fetchRefs = async () => {
            setRefDataLoading(true);
            try {
                const [deptsSnap, jobsSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'departments'), orderBy('order'))),
                    getDocs(query(collectionGroup(firestore, 'jobs'), orderBy('order'))),
                ]);
                setDepartments(deptsSnap.docs.map(d => ({id: d.id, ...d.data()} as Department)));
                
                const uniqueJobs = new Map<string, Job>();
                 jobsSnap.forEach(doc => {
                    const job = { id: doc.id, ...doc.data() } as Job;
                    if (!uniqueJobs.has(job.name)) {
                        uniqueJobs.set(job.name, job);
                    }
                });
                setJobs(Array.from(uniqueJobs.values()));

            } catch (e) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب الأقسام والوظائف.' });
            } finally {
                setRefDataLoading(false);
            }
        };
        fetchRefs();
    }, [firestore, toast]);
    
    const departmentOptions = useMemo(() => departments.map(d => ({ value: d.name, label: d.name })), [departments]);
    const jobOptions = useMemo(() => jobs.map(j => ({ value: j.name, label: j.name })), [jobs]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!isEditing && (!userData.username || !password)) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'اسم المستخدم وكلمة المرور مطلوبان عند إنشاء موظف جديد.'});
            return;
        }

        const dataToSave = { ...formData };
        const userToSave = { ...userData };
        if (password) {
            userToSave.passwordHash = password;
        }

        onSave(dataToSave, userToSave);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <section>
                    <h3 className="font-semibold text-lg mb-2">المعلومات الأساسية</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="fullName">الاسم الكامل (بالعربية) <span className="text-destructive">*</span></Label>
                            <Input id="fullName" value={formData.fullName || ''} onChange={handleInputChange} required />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="nameEn">الاسم الكامل (بالإنجليزية)</Label>
                            <Input id="nameEn" dir="ltr" value={formData.nameEn || ''} onChange={handleInputChange} />
                        </div>
                         <div className="grid gap-1.5">
                            <Label htmlFor="civilId">الرقم المدني <span className="text-destructive">*</span></Label>
                            <Input id="civilId" value={formData.civilId || ''} onChange={handleInputChange} required dir="ltr" />
                        </div>
                         <div className="grid gap-1.5">
                            <Label htmlFor="mobile">رقم الجوال <span className="text-destructive">*</span></Label>
                            <Input id="mobile" value={formData.mobile || ''} onChange={handleInputChange} required dir="ltr" />
                        </div>
                    </div>
                </section>
                
                <Separator />
                
                 <section>
                    <h3 className="font-semibold text-lg mb-2">معلومات التوظيف</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="department">القسم <span className="text-destructive">*</span></Label>
                            <InlineSearchList value={formData.department || ''} onSelect={(v) => handleSelectChange('department', v)} options={departmentOptions} placeholder="اختر قسم..." disabled={refDataLoading} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="jobTitle">المسمى الوظيفي <span className="text-destructive">*</span></Label>
                             <InlineSearchList value={formData.jobTitle || ''} onSelect={(v) => handleSelectChange('jobTitle', v)} options={jobOptions} placeholder="اختر مسمى وظيفي..." disabled={refDataLoading} />
                        </div>
                        <div className="grid gap-1.5">
                             <Label htmlFor="hireDate">تاريخ التعيين <span className="text-destructive">*</span></Label>
                             <Input id="hireDate" type="date" value={formData.hireDate || ''} onChange={e => handleSelectChange('hireDate', e.target.value)} required />
                        </div>
                         <div className="grid gap-1.5">
                            <Label htmlFor="contractType">نوع العقد <span className="text-destructive">*</span></Label>
                            <Select value={formData.contractType || ''} onValueChange={(v) => handleSelectChange('contractType', v)} dir="rtl">
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="permanent">دائم</SelectItem>
                                    <SelectItem value="temporary">مؤقت</SelectItem>
                                    <SelectItem value="subcontractor">مقاول من الباطن</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="grid gap-1.5">
                            <Label htmlFor="basicSalary">الراتب الأساسي <span className="text-destructive">*</span></Label>
                            <Input id="basicSalary" type="number" value={formData.basicSalary || ''} onChange={handleInputChange} required dir="ltr" />
                        </div>
                    </div>
                </section>
                
                <Separator />

                <section>
                    <h3 className="font-semibold text-lg mb-2">حساب المستخدم</h3>
                    {!isEditing && (
                        <Alert variant="default" className="mb-4 bg-blue-50 border-blue-200">
                             <Info className="h-4 w-4 text-blue-600"/>
                            <AlertTitle>ملاحظة</AlertTitle>
                            <AlertDescription>
                                سيتم إنشاء حساب دخول للموظف ليكون قادرًا على استخدام النظام. الحساب سيكون غير نشط بشكل افتراضي.
                            </AlertDescription>
                        </Alert>
                    )}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="username">اسم المستخدم <span className="text-destructive">*</span></Label>
                            <Input id="username" value={userData.username || ''} onChange={handleUserInputChange} dir="ltr" disabled={isEditing} />
                            <p className="text-xs text-muted-foreground">سيتم إنشاء بريد إلكتروني: <span dir="ltr">{userData.username || '...'}@scoop.local</span></p>
                        </div>
                        <div className="grid gap-1.5">
                             <Label htmlFor="password">{isEditing ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'} <span className={!isEditing ? "text-destructive" : ""}>*</span></Label>
                            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" placeholder={isEditing ? 'اتركه فارغاً لعدم التغيير' : '8 أحرف على الأقل'} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="role">الدور / الصلاحية <span className="text-destructive">*</span></Label>
                             <InlineSearchList
                                value={userData.role || ''}
                                onSelect={(v) => handleSelectChange('role', v)}
                                options={roleOptions}
                                placeholder="اختر دور..."
                            />
                        </div>
                     </div>
                </section>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                    حفظ
                </Button>
            </div>
        </form>
    );
}
