'use client';
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, addDoc, updateDoc, serverTimestamp, collection } from 'firebase/firestore';
import { Loader2, Save, Sparkles } from 'lucide-react';
import type { Vendor, RequestForQuotation, SupplierQuotation, RfqItem } from '@/lib/types';
import { DateInput } from '../ui/date-input';
import { Textarea } from '../ui/textarea';
import { toFirestoreDate } from '@/services/date-converter';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';

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
    
    // New states for file upload
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);


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
            setSelectedFile(null); // Reset file on open
        }
    }, [isOpen, rfq, existingQuote]);

    const handleItemPriceChange = (rfqItemId: string, price: string) => {
        setItems(prev => prev.map(item => item.rfqItemId === rfqItemId ? { ...item, unitPrice: price } : item));
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setSelectedFile(file);
        } else {
            toast({ variant: 'destructive', title: 'ملف غير صالح', description: 'الرجاء اختيار ملف PDF فقط.' });
            setSelectedFile(null);
        }
    };

    const handleAnalyzePdf = async () => {
        if (!selectedFile) return;
        // In the future, this will call a Genkit flow.
        // For now, it just shows a toast message as a placeholder for the functionality.
        toast({
            title: 'قيد التطوير',
            description: 'سيتم تفعيل ميزة تحليل عروض الأسعار من ملفات PDF قريبًا.',
        });
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
                <ScrollArea className="max-h-[70vh]">
                    <div className="py-4 space-y-4 px-2">
                        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                            <h4 className="font-semibold text-base">
                                أو، قم برفع عرض السعر مباشرة (PDF)
                            </h4>
                            <div className="flex items-end gap-4">
                                <div className="grid gap-2 flex-grow">
                                    <Label htmlFor="pdf-upload">اختر ملف PDF</Label>
                                    <Input
                                        id="pdf-upload"
                                        type="file"
                                        accept="application/pdf"
                                        onChange={handleFileChange}
                                        className="text-xs"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    onClick={handleAnalyzePdf}
                                    disabled={!selectedFile || isAnalyzing}
                                    variant="secondary"
                                >
                                    {isAnalyzing ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Sparkles className="ml-2 h-4 w-4"/>}
                                    تحليل العرض
                                </Button>
                            </div>
                             <p className="text-xs text-muted-foreground">
                                سيقوم الذكاء الاصطناعي بمحاولة قراءة البيانات من الملف وتعبئة الحقول أدناه تلقائيًا.
                            </p>
                        </div>

                        <div className="relative py-4">
                            <Separator />
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-sm text-muted-foreground">
                                أو أدخل البيانات يدويًا
                            </div>
                        </div>

                        <div className="space-y-4 px-2">
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
                    </div>
                </ScrollArea>
                <DialogFooter className="pt-4 border-t">
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
