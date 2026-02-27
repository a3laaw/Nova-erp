'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Save } from 'lucide-react';
import type { Vendor } from '@/lib/types';
import { cleanFirestoreData } from '@/lib/utils';

interface VendorFormProps {
    isOpen: boolean;
    onClose: () => void;
    vendor: Vendor | null;
}

export function VendorForm({ isOpen, onClose, vendor }: VendorFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const isEditing = !!vendor;

    const [formData, setFormData] = useState({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: ''
    });

    useEffect(() => {
        if (vendor) {
            setFormData({
                name: vendor.name,
                contactPerson: vendor.contactPerson || '',
                phone: vendor.phone || '',
                email: vendor.email || '',
                address: vendor.address || ''
            });
        } else {
            setFormData({ name: '', contactPerson: '', phone: '', email: '', address: '' });
        }
    }, [vendor, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore) return;
        
        if (!formData.name.trim()) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'اسم المورد مطلوب.' });
            return;
        }

        if (!formData.phone.trim()) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'رقم الهاتف مطلوب بشكل إلزامي لضمان عدم تكرار الموردين.' });
            return;
        }

        setIsSaving(true);
        try {
            if (isEditing) {
                await updateDoc(doc(firestore, 'vendors', vendor!.id!), cleanFirestoreData(formData));
                toast({ title: 'نجاح', description: 'تم تحديث بيانات المورد.' });
            } else {
                await addDoc(collection(firestore, 'vendors'), cleanFirestoreData({ ...formData, createdAt: serverTimestamp() }));
                toast({ title: 'نجاح', description: 'تمت إضافة المورد بنجاح.' });
            }
            onClose();
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ بيانات المورد.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">اسم المورد <span className="text-destructive">*</span></Label>
                            <Input id="name" value={formData.name} onChange={handleChange} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="contactPerson">جهة الاتصال</Label>
                            <Input id="contactPerson" value={formData.contactPerson} onChange={handleChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="phone">رقم الهاتف / الجوال <span className="text-destructive">*</span></Label>
                                <Input id="phone" value={formData.phone} onChange={handleChange} dir="ltr" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="email">البريد الإلكتروني</Label>
                                <Input id="email" type="email" value={formData.email} onChange={handleChange} dir="ltr" />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="address">العنوان</Label>
                            <Textarea id="address" value={formData.address} onChange={handleChange} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
                            حفظ البيانات
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
