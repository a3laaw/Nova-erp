
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, doc, updateDoc, serverTimestamp, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { Loader2, Save } from 'lucide-react';
import type { Warehouse, ConstructionProject } from '@/lib/types';
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
    });

    const { data: projects, loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, 'projects', [where('status', '==', 'قيد التنفيذ')]);

    useEffect(() => {
        if (warehouse) {
            setFormData({
                name: warehouse.name,
                location: warehouse.location || '',
                isDefault: warehouse.isDefault || false,
                projectId: warehouse.projectId || null,
            });
        } else {
            setFormData({ name: '', location: '', isDefault: false, projectId: null });
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

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'تعديل مستودع' : 'إضافة مستودع جديد'}</DialogTitle>
                        <DialogDescription>تعريف مستودع جديد لتخزين المواد أو ربطه بمشروع تنفيذي.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-6">
                        <div className="grid gap-2">
                            <Label htmlFor="name">اسم المستودع *</Label>
                            <Input id="name" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required placeholder="مثال: المخزن الرئيسي، مخزن موقع الرميثية..." />
                        </div>
                        <div className="grid gap-2">
                            <Label>ربط بمشروع (لمخازن المواقع)</Label>
                            <InlineSearchList 
                                value={formData.projectId || ''}
                                onSelect={(v) => setFormData(p => ({...p, projectId: v || null}))}
                                options={projectOptions}
                                placeholder={projectsLoading ? "تحميل..." : "ابحث عن مشروع..."}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="location">الموقع الجغرافي / الوصف</Label>
                            <Input id="location" value={formData.location || ''} onChange={e => setFormData(p => ({...p, location: e.target.value}))} />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                            <div className="space-y-0.5">
                                <Label htmlFor="isDefault">تعيين كمستودع افتراضي</Label>
                                <p className="text-xs text-muted-foreground">سيتم استخدامه تلقائياً في عمليات الشراء والاستلام.</p>
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
