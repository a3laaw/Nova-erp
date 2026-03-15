'use client';
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, getDocs, orderBy } from 'firebase/firestore';
import { Loader2, Save, HardHat, Building2, Phone, Mail, MapPin, Landmark, ShieldCheck, Ban } from 'lucide-react';
import type { Subcontractor, SubcontractorType, SubcontractorSpecialization } from '@/lib/types';
import { cleanFirestoreData } from '@/lib/utils';
import { Switch } from '../ui/switch';
import { InlineSearchList } from '../ui/inline-search-list';
import { useAppTheme } from '@/context/theme-context';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';

interface SubcontractorFormProps {
    isOpen: boolean;
    onClose: () => void;
    subcontractor: Subcontractor | null;
}

export function SubcontractorForm({ isOpen, onClose, subcontractor }: SubcontractorFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { theme } = useAppTheme();
    const isGlass = theme === 'glass';
    
    const [isSaving, setIsSaving] = useState(false);
    const isEditing = !!subcontractor;

    const [formData, setFormData] = useState({
        name: '',
        type: '',
        specialization: '',
        contactPerson: '',
        phone: '',
        mobile: '',
        email: '',
        address: '',
        bankName: '',
        accountNumber: '',
        iban: '',
        isActive: true,
        blacklisted: false,
        blacklistedReason: '',
    });

    const { data: subcontractorTypes, loading: typesLoading } = useSubscription<SubcontractorType>(firestore, 'subcontractorTypes', useMemo(() => [orderBy('name')], []));
    const [specializations, setSpecializations] = useState<SubcontractorSpecialization[]>([]);
    const [specializationsLoading, setSpecializationsLoading] = useState(false);
    
    const selectedType = useMemo(() => subcontractorTypes.find(t => t.name === formData.type), [subcontractorTypes, formData.type]);
    
    useEffect(() => {
        if (selectedType) {
            setSpecializationsLoading(true);
            const q = query(collection(firestore!, `subcontractorTypes/${selectedType.id}/specializations`), orderBy('name'));
            getDocs(q).then(snap => {
                setSpecializations(snap.docs.map(d => ({id: d.id, ...d.data()}) as SubcontractorSpecialization));
            }).finally(() => setSpecializationsLoading(false));
        } else {
            setSpecializations([]);
        }
    }, [selectedType, firestore]);

    useEffect(() => {
        if (subcontractor) {
            setFormData({
                name: subcontractor.name,
                type: subcontractor.type,
                specialization: subcontractor.specialization || '',
                contactPerson: subcontractor.contactPerson || '',
                phone: subcontractor.phone || '',
                mobile: subcontractor.mobile || '',
                email: subcontractor.email || '',
                address: subcontractor.address || '',
                bankName: subcontractor.bankAccount?.bankName || '',
                accountNumber: subcontractor.bankAccount?.accountNumber || '',
                iban: subcontractor.bankAccount?.iban || '',
                isActive: subcontractor.isActive ?? true,
                blacklisted: subcontractor.blacklisted ?? false,
                blacklistedReason: subcontractor.blacklistedReason || '',
            });
        } else {
            setFormData({
                name: '', type: '', specialization: '', contactPerson: '', phone: '',
                mobile: '', email: '', address: '',
                bankName: '', accountNumber: '', iban: '',
                isActive: true, blacklisted: false, blacklistedReason: '',
            });
        }
    }, [subcontractor, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
    };
    
    const handleSelectChange = (id: string, value: string) => {
        const newFormData = { ...formData, [id]: value };
        if (id === 'type') {
            newFormData.specialization = '';
        }
        setFormData(newFormData);
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !formData.name) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'اسم المقاول مطلوب.' });
            return;
        }
        setIsSaving(true);
        try {
            const dataToSave = {
                ...formData,
                bankAccount: {
                    bankName: formData.bankName,
                    accountNumber: formData.accountNumber,
                    iban: formData.iban,
                }
            };
            
            if (isEditing) {
                await updateDoc(doc(firestore, 'subcontractors', subcontractor!.id!), cleanFirestoreData(dataToSave));
                toast({ title: 'نجاح', description: 'تم تحديث بيانات المقاول.' });
            } else {
                await addDoc(collection(firestore, 'subcontractors'), cleanFirestoreData({ ...dataToSave, rating: 3, createdAt: serverTimestamp() }));
                toast({ title: 'نجاح', description: 'تمت إضافة المقاول بنجاح.' });
            }
            onClose();
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ بيانات المقاول.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const typeOptions = useMemo(() => subcontractorTypes.map(t => ({value: t.name, label: t.name})), [subcontractorTypes]);
    const specializationOptions = useMemo(() => specializations.map(s => ({value: s.name, label: s.name})), [specializations]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className={cn("max-w-2xl rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden", isGlass && "glass-effect")} dir="rtl">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <DialogHeader className="p-8 bg-primary/5 border-b">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                                <HardHat className="h-8 w-8" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black">{isEditing ? 'تعديل بيانات المقاول' : 'إضافة مقاول باطن جديد'}</DialogTitle>
                                <DialogDescription className="text-base font-medium">سجل بيانات التعاقد والمعلومات البنكية للمقاول.</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <ScrollArea className="flex-1 max-h-[60vh]">
                        <div className="p-8 space-y-8">
                            <section className="space-y-6">
                                <h3 className="font-black text-primary border-r-4 border-primary pr-3">المعلومات الأساسية</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="col-span-2 grid gap-2">
                                        <Label htmlFor="name" className="font-bold mr-1">اسم المقاول / الشركة <span className="text-destructive">*</span></Label>
                                        <div className="relative">
                                            <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input id="name" value={formData.name} onChange={handleChange} required className="pr-10 h-12 rounded-xl" placeholder="أدخل الاسم الرسمي..." />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="font-bold mr-1">التصنيف الرئيسي</Label>
                                        <InlineSearchList 
                                            value={formData.type}
                                            onSelect={(v) => handleSelectChange('type', v)}
                                            options={typeOptions}
                                            placeholder={typesLoading ? "تحميل..." : "اختر نوعًا..."}
                                            disabled={typesLoading}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="font-bold mr-1">التخصص الدقيق</Label>
                                        <InlineSearchList 
                                            value={formData.specialization}
                                            onSelect={(v) => handleSelectChange('specialization', v)}
                                            options={specializationOptions}
                                            placeholder={!selectedType ? "اختر النوع أولاً" : specializationsLoading ? "تحميل..." : "اختر تخصصًا..."}
                                            disabled={!selectedType || specializationsLoading}
                                        />
                                    </div>
                                </div>
                            </section>

                            <Separator />

                            <section className="space-y-6">
                                <h3 className="font-black text-primary border-r-4 border-primary pr-3">بيانات التواصل</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="grid gap-2">
                                        <Label htmlFor="contactPerson" className="font-bold mr-1">المسؤول عن التواصل</Label>
                                        <Input id="contactPerson" value={formData.contactPerson} onChange={handleChange} className="h-11 rounded-xl" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="mobile" className="font-bold mr-1">رقم الجوال <span className="text-destructive">*</span></Label>
                                        <div className="relative">
                                            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input id="mobile" value={formData.mobile} onChange={handleChange} dir="ltr" className="pr-10 h-11 rounded-xl" />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="email" className="font-bold mr-1">البريد الإلكتروني</Label>
                                        <div className="relative">
                                            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input id="email" type="email" value={formData.email} onChange={handleChange} dir="ltr" className="pr-10 h-11 rounded-xl" />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="address" className="font-bold mr-1">العنوان</Label>
                                        <div className="relative">
                                            <MapPin className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Textarea id="address" value={formData.address} onChange={handleChange} rows={1} className="pr-10 rounded-xl resize-none" />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <Separator />

                            <section className="space-y-6 bg-muted/20 p-6 rounded-3xl border-2 border-dashed">
                                <h3 className="font-black text-primary flex items-center gap-2">
                                    <Landmark className="h-5 w-5" /> المعلومات البنكية والتحويل
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="bankName" className="text-xs font-bold text-gray-600 mr-1">اسم البنك</Label>
                                        <Input id="bankName" value={formData.bankName} onChange={handleChange} className="bg-white rounded-xl h-10 border-2" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="accountNumber" className="text-xs font-bold text-gray-600 mr-1">رقم الحساب</Label>
                                        <Input id="accountNumber" value={formData.accountNumber} onChange={handleChange} dir="ltr" className="bg-white rounded-xl h-10 border-2" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="iban" className="text-xs font-bold text-gray-600 mr-1">IBAN</Label>
                                        <Input id="iban" value={formData.iban} onChange={handleChange} dir="ltr" className="bg-white rounded-xl h-10 border-2" />
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4 pt-4">
                                <div className="flex items-center justify-between p-4 bg-white rounded-2xl border shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <ShieldCheck className="h-5 w-5 text-green-600" />
                                        <div><Label htmlFor="isActive" className="font-black cursor-pointer">حالة المقاول نشطة</Label></div>
                                    </div>
                                    <Switch id="isActive" checked={formData.isActive} onCheckedChange={(c) => setFormData(p => ({...p, isActive: c}))} />
                                </div>
                                
                                <div className={cn("p-4 rounded-2xl border transition-all", formData.blacklisted ? "bg-red-50 border-red-300" : "bg-white")}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Ban className={cn("h-5 w-5", formData.blacklisted ? "text-red-600" : "text-muted-foreground")} />
                                            <div><Label htmlFor="blacklisted" className="font-black cursor-pointer">إضافة إلى القائمة السوداء</Label></div>
                                        </div>
                                        <Switch id="blacklisted" checked={formData.blacklisted} onCheckedChange={(c) => setFormData(p => ({...p, blacklisted: c}))} />
                                    </div>
                                    {formData.blacklisted && (
                                        <div className="mt-4 animate-in slide-in-from-top-2">
                                            <Label htmlFor="blacklistedReason" className="text-xs font-bold text-red-800 mr-1 mb-1 block">سبب الحظر أو الاستبعاد:</Label>
                                            <Textarea id="blacklistedReason" value={formData.blacklistedReason} onChange={handleChange} rows={2} className="rounded-xl border-red-200 bg-white" placeholder="يرجى ذكر السبب..." />
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="p-8 bg-muted/10 border-t flex-shrink-0">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="h-12 px-8 font-bold rounded-xl">إلغاء</Button>
                        <Button type="submit" disabled={isSaving} className="h-12 px-16 rounded-xl font-black text-lg gap-2 shadow-xl shadow-primary/30">
                            {isSaving ? <Loader2 className="animate-spin h-5 w-5"/> : <Save className="h-5 w-5" />}
                            حفظ البيانات
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
