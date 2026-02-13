
'use client';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Save } from 'lucide-react';
import type { BoqItem } from '@/lib/types';
import { cleanFirestoreData } from '@/lib/utils';

const units = ["متر", "متر مربع", "متر مكعب", "كجم", "طن", "لتر", "وحدة", "يوم", "مقطوعية"];

const boqItemSchema = z.object({
  description: z.string().min(1, "الوصف مطلوب."),
  unit: z.string().min(1, "الوحدة مطلوبة."),
  plannedQuantity: z.preprocess(
    (a) => parseFloat(String(a).replace(/,/g, '')),
    z.number().positive("الكمية يجب أن تكون أكبر من صفر.")
  ),
  plannedUnitPrice: z.preprocess(
    (a) => parseFloat(String(a).replace(/,/g, '')),
    z.number().min(0, "السعر لا يمكن أن يكون سالبًا.")
  ),
});

type BoqFormValues = z.infer<typeof boqItemSchema>;

interface BoqItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  item: BoqItem | null;
}

export function BoqItemForm({ isOpen, onClose, transactionId, item }: BoqItemFormProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = !!item;

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<BoqFormValues>({
    resolver: zodResolver(boqItemSchema),
  });

  useEffect(() => {
    if (isOpen) {
      if (item) {
        reset({
          description: item.description,
          unit: item.unit,
          plannedQuantity: item.plannedQuantity,
          plannedUnitPrice: item.plannedUnitPrice,
        });
      } else {
        reset({
          description: '',
          unit: '',
          plannedQuantity: 1,
          plannedUnitPrice: 0,
        });
      }
    }
  }, [isOpen, item, reset]);

  const onSubmit = async (data: BoqFormValues) => {
    if (!firestore || !transactionId) return;
    setIsSaving(true);
    console.log("Submitting BOQ data:", data);

    try {
      const collectionPath = `clients/${transactionId.split('/')[0]}/transactions/${transactionId}/boq`;
      
      const dataToSave = {
        ...data,
        updatedAt: serverTimestamp(),
      };

      if (isEditing) {
        const itemRef = doc(firestore, collectionPath, item!.id!);
        await updateDoc(itemRef, cleanFirestoreData(dataToSave));
        toast({ title: "نجاح", description: "تم تحديث البند بنجاح." });
      } else {
        const fullData = {
            ...dataToSave,
            itemNumber: 'TEMP', // Placeholder
            executedQuantity: 0,
            createdAt: serverTimestamp(),
        };
        await addDoc(collection(collectionPath), cleanFirestoreData(fullData));
        toast({ title: "نجاح", description: "تمت إضافة البند بنجاح." });
      }
      onClose();
    } catch (error) {
      console.error("Error saving BOQ item:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل حفظ البند." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'تعديل بند في جدول الكميات' : 'إضافة بند جديد'}</DialogTitle>
          </DialogHeader>
          <div className="py-4 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="description">وصف البند</Label>
              <Textarea id="description" {...register('description')} />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="unit">الوحدة</Label>
                    <Controller
                        name="unit"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="اختر وحدة..." /></SelectTrigger>
                                <SelectContent>{units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                            </Select>
                        )}
                    />
                    {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="plannedQuantity">الكمية المخططة</Label>
                    <Input id="plannedQuantity" type="number" step="any" {...register('plannedQuantity')} />
                    {errors.plannedQuantity && <p className="text-xs text-destructive">{errors.plannedQuantity.message}</p>}
                </div>
            </div>
             <div className="grid gap-2">
                <Label htmlFor="plannedUnitPrice">سعر الوحدة المخطط (د.ك)</Label>
                <Input id="plannedUnitPrice" type="number" step="any" {...register('plannedUnitPrice')} />
                {errors.plannedUnitPrice && <p className="text-xs text-destructive">{errors.plannedUnitPrice.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin ml-2" /> : <Save className="ml-2" />}
              {isEditing ? 'حفظ التعديلات' : 'إضافة البند'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

    