
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X, Loader2, User, Phone, MapPin, CheckCircle2, ArrowRight, ChevronDown } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import type { Employee, Governorate, Area, Client } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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

    // التحقق من صحة رقم الجوال (افتراضياً 8 أرقام أو أكثر)
    const isMobileValid = useMemo(() => formData.mobile.length >= 8, [formData.mobile]);

    const handleGovernorateChange = useCallback(async (govId: string, preselectArea?: string) => {
        setFormData(prev => ({ ...prev, governorateId: govId, area: '' }));
        setAreas([]);
        if (govId && firestore) {
            setIsAreaLoading(true);
            try {
                const areasQuery = query(collection(firestore, `governorates/${govId}/areas`), orderBy('name'));
                const areasSnapshot = await getDocs(areasQuery);
                const fetchedAreas = areasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Area));
                setAreas(fetchedAreas);
                if(preselectArea && fetchedAreas.some(a => a.name === preselectArea)) {
                    setFormData(prev => ({...prev, area: preselectArea}));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsAreaLoading(false);
            }
        }
    }, [firestore]);
    
    useEffect(() => {
        if (initialData && governorates.length > 0) {
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

                const fetchedEngineers: Employee[] = engSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee))
                    .filter(e => e.department?.includes('المعماري'));
                
                setEngineers(fetchedEngineers);
                setGovernorates(govSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Governorate)));

            } catch (error) {
                console.error(error);
            } finally {
                setRefDataLoading(false);
            }
        };

        fetchReferenceData();
    }, [firestore]);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nameAr || !formData.mobile || !assignedEngineerId) {
            toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'يرجى تعبئة الحقول الإلزامية المميزة بالنجمة.' });
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
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8 scrollbar-hide">
                <p className="text-[11px] text-muted-foreground font-medium">الحقول المميزة بالنجمة (<span className="text-destructive">*</span>) إلزامية</p>

                {/* Section 1: Basic Information */}
                <section className="bg-muted/30 p-6 rounded-[1.5rem] border border-border/50 space-y-6">
                    <div className="grid gap-2">
                        <Label htmlFor="nameAr" className="font-bold text-gray-700">اسم العميل (بالعربية) <span className="text-destructive italic">*</span></Label>
                        <div className="relative group">
                            <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input 
                                id="nameAr" 
                                value={formData.nameAr} 
                                onChange={handleInputChange} 
                                required 
                                placeholder="مثال: محمد عبدالله العتيبي"
                                className="pr-10 h-12 bg-white rounded-xl shadow-sm focus:ring-primary/20 border-gray-200 transition-all"
                                title="ادخل الاسم ثلاثياً"
                            />
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="nameEn" className="font-bold text-gray-700">اسم العميل (بالإنجليزية)</Label>
                            <Input 
                                id="nameEn" 
                                dir="ltr" 
                                value={formData.nameEn} 
                                onChange={handleInputChange} 
                                placeholder="e.g. Mohammed Abdullah"
                                className="h-12 bg-white rounded-xl shadow-sm focus:ring-primary/20 border-gray-200"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="mobile" className="font-bold text-gray-700">رقم الجوال <span className="text-destructive">*</span></Label>
                            <div className="relative group">
                                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
                                <Input 
                                    id="mobile" 
                                    dir="ltr" 
                                    value={formData.mobile} 
                                    onChange={handleInputChange} 
                                    required 
                                    placeholder="XXXXXXXXX05"
                                    className="pr-10 h-12 bg-white rounded-xl shadow-sm focus:ring-primary/20 border-gray-200"
                                />
                                {isMobileValid && (
                                    <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500 animate-in fade-in zoom-in" />
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 2: System Assignment */}
                <section className="space-y-4">
                    <div className="grid gap-2">
                        <Label className="font-bold text-gray-700">المهندس المسؤول <span className="text-destructive">*</span></Label>
                        <InlineSearchList 
                            value={assignedEngineerId}
                            onSelect={setAssignedEngineerId}
                            options={engineers.map(e => ({value: e.id!, label: e.fullName}))}
                            placeholder="اختر مهندساً أو ابحث..."
                            disabled={refDataLoading}
                            className="h-12 bg-white rounded-xl shadow-sm border-gray-200"
                        />
                    </div>
                </section>

                {/* Section 3: Address Section */}
                <section className="bg-primary/[0.03] p-6 rounded-[1.5rem] border border-primary/10 space-y-6">
                    <Label className="font-black text-primary flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> عنوان العميل
                    </Label>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label className="font-bold text-gray-600 text-xs">المحافظة</Label>
                            <InlineSearchList 
                                value={formData.governorateId} 
                                onSelect={(v) => handleGovernorateChange(v)} 
                                options={governorates.map(g => ({value: g.id, label: g.name}))} 
                                placeholder="...اختر محافظة" 
                                className="h-11 bg-white rounded-xl shadow-sm"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold text-gray-600 text-xs">المنطقة</Label>
                            <InlineSearchList 
                                value={formData.area} 
                                onSelect={(v) => setFormData(p => ({...p, area: v}))} 
                                options={areas.map(a => ({value: a.name, label: a.name}))} 
                                placeholder={!formData.governorateId ? "اختر محافظة أولاً" : isAreaLoading ? "تحميل..." : "اختر المنطقة"} 
                                disabled={!formData.governorateId || isAreaLoading}
                                className="h-11 bg-white rounded-xl shadow-sm"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="grid gap-1.5"><Label className="text-[10px] font-bold text-muted-foreground">القطعة</Label><Input id="block" value={formData.block} onChange={handleInputChange} className="h-10 bg-white rounded-lg shadow-sm" /></div>
                        <div className="grid gap-1.5"><Label className="text-[10px] font-bold text-muted-foreground">الشارع</Label><Input id="street" value={formData.street} onChange={handleInputChange} className="h-10 bg-white rounded-lg shadow-sm" /></div>
                        <div className="grid gap-1.5"><Label className="text-[10px] font-bold text-muted-foreground">رقم المنزل</Label><Input id="houseNumber" value={formData.houseNumber} onChange={handleInputChange} className="h-10 bg-white rounded-lg shadow-sm" /></div>
                    </div>
                </section>
            </div>

            <div className="p-6 bg-gray-50 border-t flex justify-end gap-3 rounded-b-[2rem]">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="text-primary bg-primary/5 hover:bg-primary/10 rounded-xl px-6 h-12 font-bold gap-2">
                    <ArrowRight className="h-4 w-4" /> إلغاء
                </Button>
                <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90 text-white rounded-xl px-10 h-12 font-black shadow-lg shadow-primary/20 gap-2">
                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    حفظ
                </Button>
            </div>
        </form>
    );
}
