'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X, Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import type { Employee, Governorate, Area, Client } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DialogFooter } from '@/components/ui/dialog';


interface ClientFormProps {
    onSave: (data: Partial<Client>) => Promise<void>;
    onClose: () => void;
    initialData?: Partial<Client> | null;
    isSaving?: boolean;
}

export function ClientForm({ onSave, onClose, initialData = null, isSaving = false }: ClientFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [formData, setFormData] = useState({
        nameAr: '', nameEn: '', mobile: '', governorateId: '', area: '',
        block: '', street: '', houseNumber: '',
    });
    const [assignedEngineerId, setAssignedEngineerId] = useState('');
    
    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [governorates, setGovernorates] = useState<Governorate[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [refDataLoading, setRefDataLoading] = useState(true);
    const [isAreaLoading, setIsAreaLoading] = useState(false);

    const handleGovernorateChange = useCallback(async (govId: string, preselectArea?: string) => {
        setFormData(prev => ({ ...prev, governorateId: govId, area: '' }));
        setAreas([]);
        if (govId && firestore) {
            setIsAreaLoading(true);
            const areasQuery = query(collection(firestore, `governorates/${govId}/areas`), orderBy('name'));
            const areasSnapshot = await getDocs(areasQuery);
            const fetchedAreas = areasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Area));
            setAreas(fetchedAreas);
            if(preselectArea && fetchedAreas.some(a => a.name === preselectArea)) {
                setFormData(prev => ({...prev, area: preselectArea}));
            }
            setIsAreaLoading(false);
        }
    }, [firestore]);
    
    useEffect(() => {
        if (initialData) {
            const initialGov = governorates.find(g => g.name === initialData.address?.governorate);
            setFormData({
                nameAr: initialData.nameAr || '',
                nameEn: initialData.nameEn || '',
                mobile: initialData.mobile || '',
                governorateId: initialGov?.id || '',
                area: initialData.address?.area || '',
                block: initialData.address?.block || '',
                street: initialData.address?.street || '',
                houseNumber: initialData.address?.houseNumber || '',
            });
            setAssignedEngineerId(initialData.assignedEngineer || '');
            if(initialGov?.id) {
                handleGovernorateChange(initialGov.id, initialData.address?.area);
            }
        }
    }, [initialData, governorates, handleGovernorateChange]);


    useEffect(() => {
        if (!firestore) return;
        const fetchReferenceData = async () => {
            setRefDataLoading(true);
            try {
                const engQuery = query(collection(firestore, 'employees'), where('status', '==', 'active'));
                const govQuery = query(collection(firestore, 'governorates'), orderBy('name'));
                
                const [engSnapshot, govSnapshot] = await Promise.all([getDocs(engQuery), getDocs(govQuery)]);

                const fetchedEngineers: Employee[] = [];
                engSnapshot.forEach(doc => {
                    const employee = { id: doc.id, ...doc.data() } as Employee;
                    if ((employee.jobTitle?.includes('مهندس') || employee.jobTitle?.toLowerCase().includes('architect')) && employee.department?.includes('المعماري')) {
                        fetchedEngineers.push(employee);
                    }
                });
                setEngineers(fetchedEngineers);
                setGovernorates(govSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Governorate)));

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
    
    const engineerOptions = useMemo(() => engineers.map(e => ({value: e.id!, label: e.fullName})), [engineers]);
    const governorateOptions = useMemo(() => governorates.map(g => ({value: g.id, label: g.name})), [governorates]);
    const areaOptions = useMemo(() => areas.map(a => ({value: a.name, label: a.name})), [areas]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.nameAr || !formData.mobile) {
            toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'الرجاء تعبئة اسم العميل بالعربية ورقم الجوال.' });
            return;
        }
        if (!initialData && !assignedEngineerId) {
             toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'الرجاء اختيار المهندس المسؤول.' });
            return;
        }
        
        const selectedGov = governorates.find(g => g.id === formData.governorateId);

        const dataToSave = {
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
            assignedEngineer: assignedEngineerId,
        };
        
        await onSave(dataToSave);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-6 py-4 px-1 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="nameAr">اسم العميل (بالعربية) <span className="text-destructive">*</span></Label>
                        <Input id="nameAr" value={formData.nameAr} onChange={handleInputChange} required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="nameEn">اسم العميل (بالإنجليزية)</Label>
                        <Input id="nameEn" dir="ltr" value={formData.nameEn} onChange={handleInputChange} />
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="mobile">رقم الجوال <span className="text-destructive">*</span></Label>
                    <Input id="mobile" dir="ltr" value={formData.mobile} onChange={handleInputChange} required />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="assignedEngineerId">المهندس المسؤول <span className="text-destructive">*</span></Label>
                     <InlineSearchList 
                        value={assignedEngineerId}
                        onSelect={setAssignedEngineerId}
                        options={engineerOptions}
                        placeholder={refDataLoading ? "تحميل..." : "اختر مهندسًا..."}
                        disabled={refDataLoading}
                     />
                </div>
                <Separator />
                <div className="space-y-4">
                    <Label className="font-semibold">عنوان العميل</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="grid gap-2">
                            <Label htmlFor="governorate">المحافظة</Label>
                            <InlineSearchList value={formData.governorateId} onSelect={(v) => handleGovernorateChange(v)} options={governorateOptions} placeholder={refDataLoading ? "تحميل..." : "اختر محافظة..."} disabled={refDataLoading}/>
                        </div>
                         <div className="grid gap-2">
                            <Label htmlFor="area">المنطقة</Label>
                            <InlineSearchList value={formData.area} onSelect={(v) => handleSelectChange('area', v)} options={areaOptions} placeholder={!formData.governorateId ? "اختر محافظة أولاً" : isAreaLoading ? "تحميل..." : "اختر منطقة..."} disabled={!formData.governorateId || isAreaLoading}/>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="block">القطعة</Label>
                            <Input id="block" value={formData.block} onChange={handleInputChange} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="street">الشارع</Label>
                            <Input id="street" value={formData.street} onChange={handleInputChange} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="houseNumber">رقم المنزل / القسيمة</Label>
                            <Input id="houseNumber" value={formData.houseNumber} onChange={handleInputChange} />
                        </div>
                    </div>
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
