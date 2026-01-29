
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { useFirebase, useCollection } from '@/firebase';
import { addDoc, collection, serverTimestamp, query, where, getDocs, runTransaction, doc, getDoc, orderBy, limit, deleteField } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Employee, Governorate, Area } from '@/lib/types';


export default function NewClientPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { language } = useLanguage();
    
    const [formData, setFormData] = useState({
        nameAr: '',
        nameEn: '',
        mobile: '',
        governorateId: '',
        area: '',
        block: '',
        street: '',
        houseNumber: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [fileId, setFileId] = useState('جاري التوليد...');
    const [isGeneratingId, setIsGeneratingId] = useState(true);
    const [assignedEngineerId, setAssignedEngineerId] = useState('');
    const [engineerIdFromUrl, setEngineerIdFromUrl] = useState<string | null>(null);
    const fromAppointmentId = searchParams.get('fromAppointmentId');
    
    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [engineersLoading, setEngineersLoading] = useState(true);
    
    const [governorates, setGovernorates] = useState<Governorate[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [locationsLoading, setLocationsLoading] = useState(true);

     // Effect to pre-fill from URL
    useEffect(() => {
        const nameFromUrl = searchParams.get('nameAr');
        const mobileFromUrl = searchParams.get('mobile');
        const engineerFromUrl = searchParams.get('engineerId');

        if (nameFromUrl) {
            setFormData(prev => ({...prev, nameAr: nameFromUrl}));
        }
        if (mobileFromUrl) {
            setFormData(prev => ({...prev, mobile: mobileFromUrl}));
        }
        if (engineerFromUrl) {
            setEngineerIdFromUrl(engineerFromUrl);
        }
    }, [searchParams]);

    // New effect to set the engineer ID after engineers have loaded
    useEffect(() => {
        if (engineerIdFromUrl && !engineersLoading) {
            const engineerExists = engineers.some(e => e.id === engineerIdFromUrl);
            if (engineerExists) {
                setAssignedEngineerId(engineerIdFromUrl);
            }
        }
    }, [engineerIdFromUrl, engineersLoading, engineers]);

    // Fetch File ID
    useEffect(() => {
        if (!firestore) return;

        const generateFileId = async () => {
            setIsGeneratingId(true);
            try {
                const currentYear = String(new Date().getFullYear());
                const counterRef = doc(firestore, 'counters', 'clientFiles');
                
                const counterDoc = await getDoc(counterRef);
                let nextNumber = 1;

                if (counterDoc.exists()) {
                    const counts = counterDoc.data()?.counts || {};
                    nextNumber = (counts[currentYear] || 0) + 1;
                }

                setFileId(`${nextNumber}/${currentYear}`);
            } catch (error) {
                console.error("Error generating file ID:", error);
                setFileId('خطأ في التوليد');
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل توليد رقم ملف تلقائي.' });
            } finally {
                setIsGeneratingId(false);
            }
        };

        generateFileId();
    }, [firestore, toast]);
    
    // Fetch Reference Data (Engineers, Governorates)
    useEffect(() => {
        if (!firestore) return;
    
        const fetchReferenceData = async () => {
            setEngineersLoading(true);
            setLocationsLoading(true);
            try {
                // Fetch engineers
                const engQuery = query(collection(firestore, 'employees'), where('status', '==', 'active'));
                const engSnapshot = await getDocs(engQuery);
                const fetchedEngineers: Employee[] = [];
                engSnapshot.forEach(doc => {
                    const employee = { id: doc.id, ...doc.data() } as Employee;
                    if (
                        (employee.jobTitle?.includes('مهندس') || employee.jobTitle?.toLowerCase().includes('architect')) &&
                        employee.department?.includes('المعماري')
                    ) {
                        fetchedEngineers.push(employee);
                    }
                });
                setEngineers(fetchedEngineers);
                setEngineersLoading(false);

                // Fetch Governorates
                const govQuery = query(collection(firestore, 'governorates'), orderBy('name'));
                const govSnapshot = await getDocs(govQuery);
                setGovernorates(govSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Governorate)));
                setLocationsLoading(false);

            } catch (error) {
                console.error("Failed to fetch reference data:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات المرجعية.' });
                setEngineersLoading(false);
                setLocationsLoading(false);
            }
        };
        fetchReferenceData();
    }, [firestore, toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const handleGovernorateChange = useCallback(async (govId: string) => {
        setFormData(prev => ({ ...prev, governorateId: govId, area: '' }));
        setAreas([]);
        if (govId && firestore) {
            const areasQuery = query(collection(firestore, `governorates/${govId}/areas`), orderBy('name'));
            const areasSnapshot = await getDocs(areasQuery);
            setAreas(areasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Area)));
        }
    }, [firestore]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات.' });
            return;
        }

        if (isGeneratingId) {
            toast({ variant: 'destructive', title: 'الرجاء الانتظار', description: 'جاري توليد رقم الملف، يرجى المحاولة بعد لحظات.' });
            return;
        }

        if (!formData.nameAr || !formData.mobile) {
            toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'الرجاء تعبئة اسم العميل بالعربية ورقم الجوال.' });
            return;
        }
        
        if (!assignedEngineerId) {
            toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'الرجاء اختيار المهندس المسؤول.' });
            return;
        }

        setIsLoading(true);

        try {
            const mobileQuery = query(collection(firestore, 'clients'), where('mobile', '==', formData.mobile));
            const mobileSnapshot = await getDocs(mobileQuery);
            if (!mobileSnapshot.empty) {
                toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'رقم الجوال هذا مسجل لعميل آخر.' });
                setIsLoading(false);
                return;
            }

            await runTransaction(firestore, async (transaction) => {
                // Client File ID Counter
                const currentYear = String(new Date().getFullYear());
                const clientFileCounterRef = doc(firestore, 'counters', 'clientFiles');
                const clientFileCounterDoc = await transaction.get(clientFileCounterRef);
                let nextFileNumber = 1;
                if (clientFileCounterDoc.exists()) {
                    const counts = clientFileCounterDoc.data()?.counts || {};
                    nextFileNumber = (counts[currentYear] || 0) + 1;
                }
                transaction.set(clientFileCounterRef, { counts: { [currentYear]: nextFileNumber } }, { merge: true });
                const newFileId = `${nextFileNumber}/${currentYear}`;

                // Create Client Document
                const selectedGov = governorates.find(g => g.id === formData.governorateId);
                const clientData = {
                    nameAr: formData.nameAr,
                    nameEn: formData.nameEn,
                    mobile: formData.mobile,
                    address: {
                        governorate: selectedGov?.name || '',
                        area: formData.area,
                        block: formData.block,
                        street: formData.street,
                        houseNumber: formData.houseNumber,
                    },
                    fileId: newFileId,
                    fileNumber: nextFileNumber,
                    fileYear: parseInt(currentYear, 10),
                    status: 'new' as const,
                    assignedEngineer: assignedEngineerId || null,
                    createdAt: serverTimestamp(),
                    isActive: true,
                };
                const newClientRef = doc(collection(firestore, 'clients'));
                transaction.set(newClientRef, clientData);

                // If coming from an appointment, update it with the new client ID
                if (fromAppointmentId) {
                    const appointmentRef = doc(firestore, 'appointments', fromAppointmentId);
                    transaction.update(appointmentRef, {
                        clientId: newClientRef.id,
                        clientName: deleteField(),
                        clientMobile: deleteField()
                    });
                }
            });


            toast({ title: 'نجاح', description: 'تمت إضافة العميل بنجاح.' });
            
            if (fromAppointmentId) {
                router.push(`/dashboard/appointments/${fromAppointmentId}`);
            } else {
                router.push('/dashboard/clients');
            }

        } catch (error) {
            console.error("Error saving client:", error);
            const errorMessage = error instanceof Error ? error.message : 'لم يتم حفظ العميل. يرجى المحاولة مرة أخرى.';
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };
    
    const t = language === 'ar' ? {
        title: 'إضافة عميل جديد',
        description: 'قم بتعبئة بيانات العميل الجديد لإنشاء ملف له في النظام.',
        fileIdLabel: 'رقم الملف',
        nameAr: 'اسم العميل (بالعربية)',
        nameArPlaceholder: 'مثال: جاسم محمد',
        nameEn: 'اسم العميل (بالإنجليزية)',
        nameEnPlaceholder: 'e.g., Jassim Mohammed',
        mobile: 'رقم الجوال',
        mobilePlaceholder: '+965 1234 5678',
        engineer: 'المهندس المسؤول',
        engineerPlaceholder: 'اختر مهندسًا...',
        address: 'عنوان العميل',
        governorate: 'المحافظة',
        governoratePlaceholder: 'اختر المحافظة...',
        area: 'المنطقة',
        areaPlaceholder: 'اختر المنطقة...',
        block: 'القطعة',
        blockPlaceholder: 'مثال: 5',
        street: 'الشارع',
        streetPlaceholder: 'مثال: شارع بغداد',
        houseNumber: 'رقم المنزل / القسيمة',
        houseNumberPlaceholder: 'مثال: 12',
        cancel: 'إلغاء',
        save: 'حفظ العميل',
        saving: 'جاري الحفظ...'
    } : {
        title: 'Add New Client',
        description: 'Fill in the new client\'s details to create their file in the system.',
        fileIdLabel: 'File No.',
        nameAr: 'Client Name (Arabic)',
        nameArPlaceholder: 'e.g., Jassim Mohammed',
        nameEn: 'Client Name (English)',
        nameEnPlaceholder: 'e.g., Jassim Mohammed',
        mobile: 'Mobile Number',
        mobilePlaceholder: '+965 1234 5678',
        engineer: 'Assigned Engineer',
        engineerPlaceholder: 'Select an engineer...',
        address: 'Client Address',
        governorate: 'Governorate',
        governoratePlaceholder: 'Select Governorate...',
        area: 'Area',
        areaPlaceholder: 'Select Area...',
        block: 'Block',
        blockPlaceholder: 'e.g., 5',
        street: 'Street',
        streetPlaceholder: 'e.g., Baghdad St.',
        houseNumber: 'House / Plot No.',
        houseNumberPlaceholder: 'e.g., 12',
        cancel: 'Cancel',
        save: 'Save Client',
        saving: 'Saving...'
    };

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
                                {isGeneratingId ? <Skeleton className="h-6 w-24" /> : fileId}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="nameAr">{t.nameAr} <span className="text-destructive">*</span></Label>
                            <Input id="nameAr" value={formData.nameAr} onChange={handleInputChange} placeholder={t.nameArPlaceholder} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="nameEn">{t.nameEn}</Label>
                            <Input id="nameEn" dir="ltr" value={formData.nameEn} onChange={handleInputChange} placeholder={t.nameEnPlaceholder} />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="mobile">{t.mobile} <span className="text-destructive">*</span></Label>
                        <Input id="mobile" dir="ltr" value={formData.mobile} onChange={handleInputChange} placeholder={t.mobilePlaceholder} required />
                    </div>

                     <div className="grid gap-2">
                        <Label htmlFor="assignedEngineerId">{t.engineer} <span className="text-destructive">*</span></Label>
                        <Select dir="rtl" value={assignedEngineerId} onValueChange={setAssignedEngineerId} disabled={engineersLoading} required>
                            <SelectTrigger>
                                <SelectValue placeholder={engineersLoading ? "تحميل..." : t.engineerPlaceholder} />
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
                                <Select dir="rtl" value={formData.governorateId} onValueChange={handleGovernorateChange} disabled={locationsLoading}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={locationsLoading ? "تحميل..." : t.governoratePlaceholder} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {governorates.map(gov => (
                                            <SelectItem key={gov.id} value={gov.id}>{gov.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="grid gap-2">
                                <Label htmlFor="area">{t.area}</Label>
                                <Select dir="rtl" value={formData.area} onValueChange={(v) => handleSelectChange('area', v)} disabled={!formData.governorateId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t.areaPlaceholder} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {areas.map(area => (
                                            <SelectItem key={area.id} value={area.name}>{area.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="block">{t.block}</Label>
                                <Input id="block" value={formData.block} onChange={handleInputChange} placeholder={t.blockPlaceholder} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="street">{t.street}</Label>
                                <Input id="street" value={formData.street} onChange={handleInputChange} placeholder={t.streetPlaceholder} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="houseNumber">{t.houseNumber}</Label>
                                <Input id="houseNumber" value={formData.houseNumber} onChange={handleInputChange} placeholder={t.houseNumberPlaceholder} />
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()}>
                        <X className="ml-2 h-4 w-4" />
                        {t.cancel}
                    </Button>
                    <Button type="submit" disabled={isLoading || isGeneratingId}>
                        <Save className="ml-2 h-4 w-4" />
                        {isLoading ? t.saving : t.save}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
