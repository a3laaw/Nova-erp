'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Save } from 'lucide-react';
import type { Item, ItemCategory } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import { cleanFirestoreData } from '@/lib/utils';
import { Separator } from '../ui/separator';

interface ItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  categories: ItemCategory[];
}

export function ItemForm({ isOpen, onClose, item, categories }: ItemFormProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = !!item;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    categoryId: '',
    itemType: 'storable' as Item['itemType'],
    unitOfMeasure: '',
    costPrice: '',
    sellingPrice: '',
    reorderLevel: '',
    expiryTracked: false,
  });

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        description: item.description || '',
        sku: item.sku,
        categoryId: item.categoryId,
        itemType: item.itemType,
        unitOfMeasure: item.unitOfMeasure,
        costPrice: String(item.costPrice || ''),
        sellingPrice: String(item.sellingPrice || ''),
        reorderLevel: String(item.reorderLevel || ''),
        expiryTracked: item.expiryTracked || false,
      });
    } else {
        setFormData({
            name: '', description: '', sku: '', categoryId: '',
            itemType: 'storable', unitOfMeasure: '', costPrice: '',
            sellingPrice: '', reorderLevel: '', expiryTracked: false,
        });
    }
  }, [item, isOpen]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !formData.name || !formData.sku || !formData.categoryId || !formData.unitOfMeasure) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تعبئة جميع الحقول الإلزامية (*).' });
        return;
    }
    setIsSaving(true);
    try {
        const dataToSave = {
            ...formData,
            costPrice: Number(formData.costPrice) || 0,
            sellingPrice: Number(formData.sellingPrice) || 0,
            reorderLevel: Number(formData.reorderLevel) || 0,
            expiryTracked: formData.expiryTracked,
        };
        
        if (isEditing) {
            await updateDoc(doc(firestore, 'items', item!.id!), cleanFirestoreData(dataToSave));
            toast({ title: 'نجاح', description: 'تم تحديث الصنف.' });
        } else {
            await addDoc(collection(firestore, 'items'), cleanFirestoreData({ ...dataToSave, createdAt: serverTimestamp() }));
            toast({ title: 'نجاح', description: 'تم إنشاء الصنف بنجاح.' });
        }
        onClose();
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ بيانات الصنف.' });
    } finally {
        setIsSaving(false);
    }
  }

  const categoryOptions = categories.map(cat => ({ value: cat.id!, label: cat.name }));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? `تعديل الصنف: ${item?.name}` : 'إضافة صنف جديد'}</DialogTitle>
          </DialogHeader>
          <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto px-2">
            <div className="grid gap-2">
              <Label htmlFor="name">اسم الصنف <span className="text-destructive">*</span></Label>
              <Input id="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sku">الرمز (SKU) <span className="text-destructive">*</span></Label>
              <Input id="sku" value={formData.sku} onChange={handleChange} required dir="ltr" />
            </div>
            <div className="md:col-span-2 grid gap-2">
              <Label htmlFor="description">الوصف</Label>
              <Textarea id="description" value={formData.description} onChange={handleChange} rows={2} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="categoryId">فئة الصنف <span className="text-destructive">*</span></Label>
              <InlineSearchList
                value={formData.categoryId}
                onSelect={(v) => setFormData(p => ({ ...p, categoryId: v }))}
                options={categoryOptions}
                placeholder="اختر فئة..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="itemType">نوع الصنف <span className="text-destructive">*</span></Label>
              <Select value={formData.itemType} onValueChange={(v: Item['itemType']) => setFormData(p => ({ ...p, itemType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="storable">مخزني (يتم تتبع كميته)</SelectItem>
                  <SelectItem value="consumable">مستهلك (لا يتم تتبع كميته)</SelectItem>
                  <SelectItem value="service">خدمة (غير ملموس)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Separator className="md:col-span-2 my-4" />

            <div className="grid gap-2">
              <Label htmlFor="unitOfMeasure">وحدة القياس <span className="text-destructive">*</span></Label>
              <Input id="unitOfMeasure" value={formData.unitOfMeasure} onChange={handleChange} required placeholder="مثال: قطعة، كرتون، كيلو" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reorderLevel">حد إعادة الطلب</Label>
              <Input id="reorderLevel" type="number" value={formData.reorderLevel} onChange={handleChange} dir="ltr" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="costPrice">سعر التكلفة</Label>
              <Input id="costPrice" type="number" step="any" value={formData.costPrice} onChange={handleChange} dir="ltr" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sellingPrice">سعر البيع</Label>
              <Input id="sellingPrice" type="number" step="any" value={formData.sellingPrice} onChange={handleChange} dir="ltr" />
            </div>
            <div className="flex items-center space-x-2 rtl:space-x-reverse self-center pt-4">
              <Checkbox id="expiryTracked" checked={formData.expiryTracked} onCheckedChange={(c) => setFormData(p => ({ ...p, expiryTracked: !!c }))} />
              <Label htmlFor="expiryTracked">يتطلب تتبع تاريخ الصلاحية</Label>
            </div>
          </div>
          <DialogFooter className="mt-4 pt-4 border-t">
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
