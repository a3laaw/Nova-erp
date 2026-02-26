
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp, orderBy } from 'firebase/firestore';
import { Loader2, Save, Building, Briefcase } from 'lucide-react';
import type { Warehouse, ConstructionProject, Company } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import { cleanFirestoreData } from '@/lib/utils';

interface WarehouseFormProps {
    isOpen: boolean;
    onClose: () => void;
    warehouse: Warehouse | null;
}

export function WarehouseForm({ isOpen, onClose, warehouse }: WarehouseFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const isEditing = !!warehouse;

    const [formData, setFormData] = useState<Partial<Warehouse>>({
        name: '',
        location: '',
        isDefault: false,
        projectId: null,
        companyId: null,
    });

    const { data: projects, loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, 'projects', [where('status', '==', 'قيد التنفيذ')]);
    const { data: companies, loading: companiesLoading } = useSubscription<Company>(firestore, 'companies', [orderBy('name')]);

    useEffect(() => {
        if (warehouse) {
            setFormData({
                name: warehouse.name,
                location: warehouse.location || '',
                isDefault: warehouse.isDefault || false,
                projectId: warehouse.projectId || null,
                companyId: warehouse.companyId || null,
            });
        } else {
            setFormData({ name: '', location: '', isDefault: false, projectId: null, companyId: null });
        }
    }, [warehouse, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !formData.name) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            
            // If setting as default, unset others
            if (formData.isDefault) {
                const othersQuery = query(collection(firestore, 'warehouses'), where('isDefault', '==', true));
                const snapshot = await getDocs(othersQuery);
                snapshot.forEach(doc => {
                    if (doc.id !== warehouse?.id) {
                        batch.update(doc.ref, { isDefault: false });
                    }
                });
            }

            const dataToSave = cleanFirestoreData(formData);
            
            if (isEditing) {
                batch.update(doc(firestore, 'warehouses', warehouse!.id!), dataToSave);
            } else {
                batch.set(doc(collection(firestore, 'warehouses')), { ...dataToSave, createdAt: serverTimestamp() });
            }

            await batch.commit();
            toast({ title: 'نجاح', description: 'تم حفظ بيانات المستودع.' });
            onClose();
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ البيانات.' });
        } finally {
            setIsSaving(false);
        }
    };

    const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: p.projectName })), [projects]);
    const companyOptions = useMemo(() => companies.map(c => ({ value: c.id!, label: c.name })), [companies]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl" className="max-w-lg">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'تعديل مستودع / فرع' : 'إضافة مستودع جديد'}</DialogTitle>
                        <DialogDescription>تعريف مستودع جديد لتخزين المواد، سواء كان مخزناً عاماً لشركة أو مخزناً خاصاً بموقع مشروع.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-6">
                        <div className="grid gap-2">
                            <Label htmlFor="name">اسم المستودع / الفرع *</Label>
                            <Input id="name" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required placeholder="مثال: المخزن الرئيسي، فرع المبيعات، موقع الرميثية..." />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2"><Building className="h-3 w-3" /> التابعية لشركة</Label>
                                <InlineSearchList 
                                    value={formData.companyId || ''}
                                    onSelect={(v) => setFormData(p => ({...p, companyId: v || null}))}
                                    options={companyOptions}
                                    placeholder={companiesLoading ? "تحميل..." : "اختر الشركة..."}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2"><Briefcase className="h-3 w-3" /> مرتبط بمشروع (اختياري)</Label>
                                <InlineSearchList 
                                    value={formData.projectId || ''}
                                    onSelect={(v) => setFormData(p => ({...p, projectId: v || null}))}
                                    options={projectOptions}
                                    placeholder={projectsLoading ? "تحميل..." : "ابحث عن مشروع..."}
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="location">الموقع الجغرافي / الوصف</Label>
                            <Input id="location" value={formData.location || ''} onChange={e => setFormData(p => ({...p, location: e.target.value}))} placeholder="العنوان أو وصف مكان المخزن..." />
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-2xl bg-muted/20">
                            <div className="space-y-0.5">
                                <Label htmlFor="isDefault">تعيين كمستودع افتراضي</Label>
                                <p className="text-[10px] text-muted-foreground">سيتم استخدامه تلقائياً في العمليات ما لم يتم اختيار غيره.</p>
                            </div>
                            <Switch 
                                id="isDefault" 
                                checked={formData.isDefault} 
                                onCheckedChange={(c) => setFormData(p => ({...p, isDefault: c}))} 
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="animate-spin ml-2 h-4 w-4" /> : <Save className="ml-2 h-4 w-4" />}
                            حفظ البيانات
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
