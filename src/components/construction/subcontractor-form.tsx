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
import { Loader2, Save } from 'lucide-react';
import type { Subcontractor, SubcontractorType, SubcontractorSpecialization } from '@/lib/types';
import { cleanFirestoreData } from '@/lib/utils';
import { Switch } from '../ui/switch';
import { InlineSearchList } from '../ui/inline-search-list';

interface SubcontractorFormProps {
    isOpen: boolean;
    onClose: () => void;
    subcontractor: Subcontractor | null;
}

export function SubcontractorForm({ isOpen, onClose, subcontractor }: SubcontractorFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
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
            const q = query(collection(firestore, `subcontractorTypes/${selectedType.id}/specializations`), orderBy('name'));
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
            <DialogContent className="max-w-2xl" dir="rtl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'تعديل بيانات المقاول' : 'إضافة مقاول باطن جديد'}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto px-2">
                        <div className="col-span-2 grid gap-2">
                            <Label htmlFor="name">اسم المقاول <span className="text-destructive">*</span></Label>
                            <Input id="name" value={formData.name} onChange={handleChange} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="type">النوع/التخصص الرئيسي</Label>
                            <InlineSearchList 
                                value={formData.type}
                                onSelect={(v) => handleSelectChange('type', v)}
                                options={typeOptions}
                                placeholder={typesLoading ? "تحميل..." : "اختر نوعًا..."}
                                disabled={typesLoading}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="specialization">التخصص الدقيق</Label>
                            <InlineSearchList 
                                value={formData.specialization}
                                onSelect={(v) => handleSelectChange('specialization', v)}
                                options={specializationOptions}
                                placeholder={!selectedType ? "اختر النوع أولاً" : specializationsLoading ? "تحميل..." : "اختر تخصصًا..."}
                                disabled={!selectedType || specializationsLoading}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="contactPerson">جهة الاتصال</Label>
                            <Input id="contactPerson" value={formData.contactPerson} onChange={handleChange} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="phone">الهاتف</Label>
                            <Input id="phone" value={formData.phone} onChange={handleChange} dir="ltr" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="mobile">الجوال</Label>
                            <Input id="mobile" value={formData.mobile} onChange={handleChange} dir="ltr" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">البريد الإلكتروني</Label>
                            <Input id="email" type="email" value={formData.email} onChange={handleChange} dir="ltr" />
                        </div>
                         <div className="col-span-2 grid gap-2">
                            <Label htmlFor="address">العنوان</Label>
                            <Textarea id="address" value={formData.address} onChange={handleChange} rows={2} />
                        </div>

                        <div className="col-span-2 border-t pt-4 space-y-4">
                             <Label className="font-semibold">المعلومات البنكية</Label>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="bankName">اسم البنك</Label>
                                    <Input id="bankName" value={formData.bankName} onChange={handleChange} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="accountNumber">رقم الحساب</Label>
                                    <Input id="accountNumber" value={formData.accountNumber} onChange={handleChange} dir="ltr"/>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="iban">IBAN</Label>
                                    <Input id="iban" value={formData.iban} onChange={handleChange} dir="ltr"/>
                                </div>
                            </div>
                        </div>

                         <div className="col-span-2 border-t pt-4 space-y-4">
                            <Label className="font-semibold">الحالة</Label>
                             <div className="flex items-center space-x-2 rtl:space-x-reverse">
                               <Switch id="isActive" checked={formData.isActive} onCheckedChange={(c) => setFormData(p => ({...p, isActive: c}))} />
                               <Label htmlFor="isActive">حالة المقاول نشطة</Label>
                            </div>
                             <div className="flex items-center space-x-2 rtl:space-x-reverse">
                               <Switch id="blacklisted" checked={formData.blacklisted} onCheckedChange={(c) => setFormData(p => ({...p, blacklisted: c}))} />
                               <Label htmlFor="blacklisted">إضافة إلى القائمة السوداء</Label>
                            </div>
                            {formData.blacklisted && (
                                 <div className="grid gap-2">
                                    <Label htmlFor="blacklistedReason">سبب الحظر</Label>
                                    <Textarea id="blacklistedReason" value={formData.blacklistedReason} onChange={handleChange} rows={2} />
                                </div>
                            )}
                         </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
                            حفظ
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

  