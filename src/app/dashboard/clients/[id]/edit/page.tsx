'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { doc, getDoc, updateDoc, query, where, getDocs, collection, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/auth-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Employee } from '@/lib/types';
import { kuwaitGovernorates } from '@/lib/reference-data';

export default function EditClientPage() {
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const { language } = useLanguage();
    
    const [originalData, setOriginalData] = useState<any>(null);
    const [formData, setFormData] = useState({
        nameAr: '',
        nameEn: '',
        mobile: '',
        governorate: '',
        area: '',
        block: '',
        street: '',
        houseNumber: '',
        assignedEngineerId: '',
    });
    const [fileId, setFileId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());
    const [engineersLoading, setEngineersLoading] = useState(true);
    const [areas, setAreas] = useState<string[]>([]);

    useEffect(() => {
        if (!firestore) return;
        const fetchAllEmployees = async () => {
            setEngineersLoading(true);
            try {
                const q = query(collection(firestore, 'employees'), where('status', '==', 'active'));
                const querySnapshot = await getDocs(q);
                const fetchedEmployees: Employee[] = [];
                const newMap = new Map<string, string>();
                querySnapshot.forEach(doc => {
                    const emp = { id: doc.id, ...doc.data() } as Employee;
                    fetchedEmployees.push(emp);
                    newMap.set(doc.id, emp.fullName);
                });
                setEmployeesMap(newMap);
                const archEngineers = fetchedEmployees.filter(emp => (emp.jobTitle?.includes('مهندس') || emp.jobTitle?.toLowerCase().includes('architect')));
                setEngineers(archEngineers);
            } catch (error) {
                console.error("Error fetching employees:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب قائمة الموظفين.' });
            } finally {
                setEngineersLoading(false);
            }
        };
        fetchAllEmployees();
    }, [firestore, toast]);

    useEffect(() => {
        if (!id || !firestore) {
            if(!id) router.push('/dashboard/clients');
            return;
        }

        const fetchClient = async () => {
            setIsFetching(true);
            try {
                const clientDoc = doc(firestore, 'clients', id);
                const clientSnap = await getDoc(clientDoc);

                if (clientSnap.exists()) {
                    const data = clientSnap.data();
                    setOriginalData(data);
                    setFormData({
                        nameAr: data.nameAr || '',
                        nameEn: data.nameEn || '',
                        mobile: data.mobile || '',
                        governorate: data.address?.governorate || '',
                        area: data.address?.area || '',
                        block: data.address?.block || '',
                        street: data.address?.street || '',
                        houseNumber: data.address?.houseNumber || '',
                        assignedEngineerId: data.assignedEngineer || '',
                    });
                    setFileId(data.fileId || 'N/A');
                    if (data.address?.governorate) {
                        const gov = kuwaitGovernorates.find(g => g.name === data.address.governorate);
                        if (gov) {
                            setAreas(gov.areas);
                        }
                    }
                } else {
                    toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم العثور على العميل.' });
                    router.push('/dashboard/clients');
                }
            } catch (error) {
                 toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب بيانات العميل.' });
                 console.error(error);
            } finally {
                setIsFetching(false);
            }
        };

        fetchClient();
    }, [id, firestore, router, toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLSelectElement>) => {
        const { id, value } = e.target;
        let sanitizedValue = value;
        if (id === 'nameAr') {
            sanitizedValue = value.replace(/[^ \u0600-\u06FF]/g, '');
        } else if (id === 'nameEn') {
            sanitizedValue = value.replace(/[^ a-zA-Z]/g, '');
        }
        setFormData(prev => ({ ...prev, [id]: sanitizedValue }));
    };

    const handleSelectChange = (id: string, value: string) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleGovernorateChange = (value: string) => {
        setFormData(prev => ({ ...prev, governorate: value, area: '' })); // Reset area
        const gov = kuwaitGovernorates.find(g => g.name === value);
        setAreas(gov ? gov.areas : []);
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !id || !currentUser || !originalData) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات أو تحديد المستخدم.' });
            return;
        }

        if (!formData.nameAr || !formData.mobile) {
            toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'الرجاء تعبئة اسم العميل بالعربية ورقم الجوال.' });
            return;
        }

        setIsLoading(true);

        try {
            const mobileQuery = query(collection(firestore, 'clients'), where('mobile', '==', formData.mobile));
            const mobileSnapshot = await getDocs(mobileQuery);
            if (!mobileSnapshot.empty && mobileSnapshot.docs[0].id !== id) {
                toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'رقم الجوال هذا مسجل لعميل آخر.' });
                setIsLoading(false);
                return;
            }

            const batch = writeBatch(firestore);
            const clientRef = doc(firestore, 'clients', id);
            const historyCollectionRef = collection(firestore, `clients/${id}/history`);
            
            const updatedClientData: Record<string, any> = {};

            const fieldMappings: { key: keyof typeof formData; label: string }[] = [
                { key: 'nameAr', label: 'الاسم بالعربية' },
                { key: 'nameEn', label: 'الاسم بالإنجليزية' },
                { key: 'mobile', label: 'رقم الجوال' },
            ];

            fieldMappings.forEach(({ key, label }) => {
                if (formData[key] !== originalData[key]) {
                    updatedClientData[key] = formData[key];
                    const logContent = `قام بتحديث "${label}" من "${originalData[key] || '-'}" إلى "${formData[key]}"`;
                    batch.set(doc(historyCollectionRef), {
                        type: 'log',
                        content: logContent,
                        userId: currentUser.id,
                        userName: currentUser.fullName,
                        userAvatar: currentUser.avatarUrl,
                        createdAt: serverTimestamp(),
                    });
                }
            });
            
            const originalAddress = originalData.address || {};
            const newAddress = {
                governorate: formData.governorate,
                area: formData.area,
                block: formData.block,
                street: formData.street,
                houseNumber: formData.houseNumber,
            };

            if (JSON.stringify(originalAddress) !== JSON.stringify(newAddress)) {
                updatedClientData.address = newAddress;
                const logContent = `قام بتحديث العنوان.`; // Simplified log for address
                batch.set(doc(historyCollectionRef), {
                    type: 'log',
                    content: logContent,
                    userId: currentUser.id,
                    userName: currentUser.fullName,
                    userAvatar: currentUser.avatarUrl,
                    createdAt: serverTimestamp(),
                });
            }

            const originalEngineerId = originalData.assignedEngineer || '';
            if (formData.assignedEngineerId !== originalEngineerId) {
                updatedClientData.assignedEngineer = formData.assignedEngineerId || null;
                const oldEngineerName = originalEngineerId ? employeesMap.get(originalEngineerId) || 'غير معروف' : 'غير مسند';
                const newEngineerName = formData.assignedEngineerId ? employeesMap.get(formData.assignedEngineerId) || 'غير معروف' : 'غير مسند';
                const logContent = `قام بتغيير المهندس المسؤول من "${oldEngineerName}" إلى "${newEngineerName}".`;
                batch.set(doc(historyCollectionRef), {
                    type: 'log',
                    content: logContent,
                    userId: currentUser.id,
                    userName: currentUser.fullName,
                    userAvatar: currentUser.avatarUrl,
                    createdAt: serverTimestamp(),
                });
            }


            if (Object.keys(updatedClientData).length > 0) {
                batch.update(clientRef, updatedClientData);
                await batch.commit();
                toast({ title: 'نجاح', description: 'تم تحديث بيانات العميل بنجاح.' });
            } else {
                toast({ title: 'لا توجد تغييرات', description: 'لم يتم إجراء أي تعديلات للحفظ.' });
            }
            
            router.push(`/dashboard/clients/${id}`);

        } catch (error) {
            console.error("Error updating client:", error);
            const errorMessage = error instanceof Error ? error.message : 'لم يتم حفظ التغييرات. يرجى المحاولة مرة أخرى.';
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };
    
    const t = language === 'ar' ? {
        title: 'تعديل بيانات العميل',
        description: 'قم بتحديث بيانات العميل حسب الحاجة.',
        fileIdLabel: 'رقم الملف',
        nameAr: 'اسم العميل (بالعربية)',
        nameEn: 'اسم العميل (بالإنجليزية)',
        mobile: 'رقم الجوال',
        engineer: 'المهندس المسؤول',
        address: 'عنوان العميل',
        governorate: 'المحافظة',
        area: 'المنطقة',
        block: 'القطعة',
        street: 'الشارع',
        houseNumber: 'رقم المنزل / القسيمة',
        cancel: 'إلغاء',
        save: 'حفظ التعديلات',
        saving: 'جاري الحفظ...'
    } : {
        title: 'Edit Client',
        description: 'Update the client\'s details as needed.',
        fileIdLabel: 'File No.',
        nameAr: 'Client Name (Arabic)',
        nameEn: 'Client Name (English)',
        mobile: 'Mobile Number',
        engineer: 'Assigned Engineer',
        address: 'Client Address',
        governorate: 'Governorate',
        area: 'Area',
        block: 'Block',
        street: 'Street',
        houseNumber: 'House / Plot No.',
        cancel: 'Cancel',
        save: 'Save Changes',
        saving: 'Saving...'
    };

    if (isFetching) {
        return (
             <Card className="max-w-2xl mx-auto" dir="rtl">
                <CardHeader>
                     <div className="flex justify-between items-start">
                        <div>
                            <Skeleton className="h-8 w-48" />
                            <Skeleton className="h-4 w-64 mt-2" />
                        </div>
                        <div className="text-right">
                           <Skeleton className="h-4 w-16" />
                           <Skeleton className="h-7 w-24 mt-1" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Separator />
                    <Skeleton className="h-4 w-24" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-28" />
                </CardFooter>
            </Card>
        )
    }

    return (
        <Card className="max-w-2xl mx-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <form onSubmit={handleSubmit}>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>{t.title}</CardTitle>
                            <CardDescription>{t.description}</CardDescription>
                        </div>
                        <div className="text-right">
                            <Label>{t.fileIdLabel}</Label>
                            <div className="font-mono text-lg font-semibold h-7">
                                {fileId}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="nameAr">{t.nameAr} <span className="text-destructive">*</span></Label>
                            <Input id="nameAr" value={formData.nameAr} onChange={handleInputChange} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="nameEn">{t.nameEn}</Label>
                            <Input id="nameEn" dir="ltr" value={formData.nameEn} onChange={handleInputChange} />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="mobile">{t.mobile} <span className="text-destructive">*</span></Label>
                        <Input id="mobile" dir="ltr" value={formData.mobile} onChange={handleInputChange} required />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="assignedEngineerId">{t.engineer}</Label>
                        <Select dir="rtl" value={formData.assignedEngineerId} onValueChange={(v) => handleSelectChange('assignedEngineerId', v)} disabled={engineersLoading}>
                            <SelectTrigger id="assignedEngineerId">
                                <SelectValue placeholder={engineersLoading ? "تحميل..." : "اختر مهندسًا..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {engineers.map(eng => (
                                    <SelectItem key={eng.id} value={eng.id!}>{eng.fullName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Separator className="my-6" />
                    
                    <div className="space-y-4">
                        <Label className="font-semibold">{t.address}</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="governorate">{t.governorate}</Label>
                                <Select dir="rtl" value={formData.governorate} onValueChange={handleGovernorateChange}>
                                    <SelectTrigger id="governorate">
                                        <SelectValue placeholder="اختر محافظة..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {kuwaitGovernorates.map(gov => (
                                            <SelectItem key={gov.name} value={gov.name}>{gov.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="area">{t.area}</Label>
                                 <Select dir="rtl" value={formData.area} onValueChange={(v) => handleSelectChange('area', v)} disabled={!formData.governorate}>
                                    <SelectTrigger id="area">
                                        <SelectValue placeholder="اختر منطقة..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {areas.map(area => (
                                            <SelectItem key={area} value={area}>{area}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="block">{t.block}</Label>
                                <Input id="block" value={formData.block} onChange={handleInputChange} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="street">{t.street}</Label>
                                <Input id="street" value={formData.street} onChange={handleInputChange} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="houseNumber">{t.houseNumber}</Label>
                                <Input id="houseNumber" value={formData.houseNumber} onChange={handleInputChange} />
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()}>
                        <X className="ml-2 h-4 w-4" />
                        {t.cancel}
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                        <Save className="ml-2 h-4 w-4" />
                        {isLoading ? t.saving : t.save}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
