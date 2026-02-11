'use client';
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, addDoc, updateDoc, serverTimestamp, collection } from 'firebase/firestore';
import { Loader2, Save } from 'lucide-react';
import type { Vendor, RequestForQuotation, SupplierQuotation, RfqItem } from '@/lib/types';
import { DateInput } from '../ui/date-input';
import { Textarea } from '../ui/textarea';
import { toFirestoreDate } from '@/services/date-converter';

interface SupplierQuotationFormProps {
    isOpen: boolean;
    onClose: () => void;
    rfq: RequestForQuotation;
    vendor: Vendor;
    existingQuote?: SupplierQuotation | null;
}

interface QuoteItem {
    rfqItemId: string;
    unitPrice: number | string;
}

export function SupplierQuotationForm({ isOpen, onClose, rfq, vendor, existingQuote = null }: SupplierQuotationFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const [reference, setReference] = useState('');
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [deliveryTime, setDeliveryTime] = useState('');
    const [paymentTerms, setPaymentTerms] = useState('');
    const [items, setItems] = useState<QuoteItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (existingQuote) {
                setReference(existingQuote.quotationReference || '');
                setDate(toFirestoreDate(existingQuote.date) || new Date());
                setDeliveryTime(String(existingQuote.deliveryTimeDays || ''));
                setPaymentTerms(existingQuote.paymentTerms || '');
                
                const initialItems = rfq.items.map(rfqItem => {
                    const existingItem = existingQuote.items.find(qi => qi.rfqItemId === rfqItem.id);
                    return {
                        rfqItemId: rfqItem.id!,
                        unitPrice: existingItem?.unitPrice ?? '',
                    }
                });
                setItems(initialItems);

            } else {
                setReference('');
                setDate(new Date());
                setDeliveryTime('');
                setPaymentTerms('');
                setItems(rfq.items.map(item => ({ rfqItemId: item.id!, unitPrice: '' })));
            }
        }
    }, [isOpen, rfq, existingQuote]);

    const handleItemPriceChange = (rfqItemId: string, price: string) => {
        setItems(prev => prev.map(item => item.rfqItemId === rfqItemId ? { ...item, unitPrice: price } : item));
    };

    const handleSubmit = async () => {
        if (!firestore || !date) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'بيانات غير كافية.' });
            return;
        }

        setIsSaving(true);
        try {
            const processedItems = items
              .filter(item => item.unitPrice !== '' && !isNaN(Number(item.unitPrice)))
              .map(item => ({...item, unitPrice: Number(item.unitPrice)}));

            if (processedItems.length !== rfq.items.length) {
                throw new Error("الرجاء إدخال أسعار لجميع الأصناف المطلوبة.");
            }

            const dataToSave = {
                rfqId: rfq.id!,
                vendorId: vendor.id!,
                quotationReference: reference,
                date: date,
                deliveryTimeDays: Number(deliveryTime) || null,
                paymentTerms: paymentTerms,
                items: processedItems,
            };

            if (existingQuote) {
                const quoteRef = doc(firestore, 'supplierQuotations', existingQuote.id!);
                await updateDoc(quoteRef, dataToSave);
                toast({ title: 'نجاح', description: 'تم تحديث عرض سعر المورد.' });
            } else {
                await addDoc(collection(firestore, 'supplierQuotations'), dataToSave);
                toast({ title: 'نجاح', description: 'تم حفظ عرض سعر المورد.' });
            }

            onClose();
        } catch (error) {
            const message = error instanceof Error ? error.message : "فشل حفظ عرض السعر.";
            toast({ variant: 'destructive', title: 'خطأ', description: message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle>
                        {existingQuote ? 'تعديل' : 'إضافة'} عرض سعر للمورد: {vendor.name}
                    </DialogTitle>
                    <DialogDescription>
                        أدخل البيانات من عرض السعر الذي استلمته من المورد.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>مرجع المورد (رقم الفاتورة)</Label>
                            <Input value={reference} onChange={e => setReference(e.target.value)} />
                        </div>
                         <div className="grid gap-2">
                            <Label>تاريخ العرض</Label>
                            <DateInput value={date} onChange={setDate} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div className="grid gap-2">
                            <Label>مدة التوريد (بالأيام)</Label>
                            <Input type="number" value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} />
                        </div>
                         <div className="grid gap-2">
                            <Label>شروط الدفع</Label>
                            <Input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-2 pt-4">
                         <Label className="font-semibold">أسعار الأصناف</Label>
                        {rfq.items.map(rfqItem => {
                             const quoteItem = items.find(i => i.rfqItemId === rfqItem.id);
                             return (
                                <div key={rfqItem.id} className="grid grid-cols-5 gap-2 items-center">
                                    <Label className="col-span-3">{rfqItem.itemName}</Label>
                                    <span className="text-sm text-muted-foreground text-center">الكمية: {rfqItem.quantity}</span>
                                    <Input
                                        type="number"
                                        step="0.001"
                                        placeholder="سعر الوحدة"
                                        value={quoteItem?.unitPrice || ''}
                                        onChange={(e) => handleItemPriceChange(rfqItem.id!, e.target.value)}
                                        className="dir-ltr text-left"
                                    />
                                </div>
                             )
                        })}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>إلغاء</Button>
                    <Button onClick={handleSubmit} disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin ml-2" /> : <Save className="ml-2"/>}
                        حفظ عرض السعر
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
