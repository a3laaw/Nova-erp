'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, addDoc, updateDoc, collection } from 'firebase/firestore';
import { Loader2, Save, Sparkles, FileUp } from 'lucide-react';
import type { Vendor, RequestForQuotation, SupplierQuotation } from '@/lib/types';
import { DateInput } from '../ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';

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
            setSelectedFile(null);
        }
    }, [isOpen, rfq, existingQuote]);

    const handleItemPriceChange = (rfqItemId: string, price: string) => {
        setItems(prev => prev.map(item => item.rfqItemId === rfqItemId ? { ...item, unitPrice: price } : item));
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setSelectedFile(file);
        } else if (file) {
            toast({ variant: 'destructive', title: 'ملف غير صالح', description: 'الرجاء اختيار ملف PDF فقط.' });
            setSelectedFile(null);
        }
    };

    const handleAnalyzePdf = async () => {
        if (!selectedFile) return;
        setIsAnalyzing(true);
        setTimeout(() => {
            toast({
                title: 'ميزة ذكية قيد التنفيذ',
                description: 'جاري العمل على تفعيل الذكاء الاصطناعي لقراءة الأسعار من ملفات PDF مباشرة.',
            });
            setIsAnalyzing(false);
        }, 1500);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !date) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'البيانات غير مكتملة.' });
            return;
        }

        setIsSaving(true);
        try {
            const processedItems = items
              .filter(item => item.unitPrice !== '' && !isNaN(Number(item.unitPrice)))
              .map(item => ({...item, unitPrice: Number(item.unitPrice)}));

            if (processedItems.length === 0) throw new Error("الرجاء إدخال أسعار الأصناف.");

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
                toast({ title: 'نجاح', description: 'تم تحديث عرض السعر بنجاح.' });
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
            <DialogContent 
                className="max-w-2xl max-h-[90vh] flex flex-col" 
                dir="rtl"
                onInteractOutside={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('[role="dialog"]') || target.closest('.react-select__menu-portal') || target.closest('[data-radix-popper-content-wrapper]')) {
                        e.preventDefault();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle className="text-xl font-black flex items-center gap-2">
                        <Save className="h-5 w-5 text-primary"/>
                        {existingQuote ? 'تعديل' : 'إدخال'} عرض سعر: {vendor.name}
                    </DialogTitle>
                    <DialogDescription>أدخل بيانات الأسعار والشروط من مستند المورد الرسمي.</DialogDescription>
                </DialogHeader>
                
                <ScrollArea className="flex-1 px-2">
                    <div className="py-4 space-y-6">
                        <div className="bg-primary/5 border-2 border-dashed border-primary/20 p-6 rounded-2xl space-y-4">
                            <div className="flex items-center gap-3">
                                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                                <h4 className="font-bold text-primary">المساعد الذكي (قيد التطوير)</h4>
                            </div>
                            <div className="flex items-end gap-4">
                                <div className="grid gap-2 flex-grow">
                                    <Label className="text-xs font-bold text-muted-foreground">رفع مستند المورد (PDF)</Label>
                                    <Input type="file" accept="application/pdf" onChange={handleFileChange} className="bg-background rounded-xl border-primary/10 h-11" />
                                </div>
                                <Button type="button" onClick={handleAnalyzePdf} disabled={!selectedFile || isAnalyzing} variant="secondary" className="h-11 px-6 rounded-xl font-bold">
                                    {isAnalyzing ? <Loader2 className="animate-spin h-4 w-4"/> : <FileUp className="h-4 w-4 ml-2"/>}
                                    تحليل العرض
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border rounded-2xl bg-muted/30">
                            <div className="grid gap-2">
                                <Label className="font-bold">مرجع العرض (رقم فاتورة المورد)</Label>
                                <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="مثال: QT-10203" className="rounded-xl h-11" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="font-bold">تاريخ العرض <span className="text-destructive">*</span></Label>
                                <DateInput value={date} onChange={setDate} className="rounded-xl h-11" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="font-bold">مدة التوريد (أيام)</Label>
                                <Input type="number" value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} placeholder="مثال: 3" className="rounded-xl h-11" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="font-bold">شروط الدفع</Label>
                                <Input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="مثال: دفع كاش" className="rounded-xl h-11" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Label className="text-lg font-black text-primary">قائمة الأسعار للأصناف المطلوبة</Label>
                                <Badge variant="outline">{rfq.items.length} صنف</Badge>
                            </div>
                            <div className="space-y-3">
                                {rfq.items.map(rfqItem => {
                                    const quoteItem = items.find(i => i.rfqItemId === rfqItem.id);
                                    return (
                                        <div key={rfqItem.id} className="grid grid-cols-12 gap-4 items-center p-4 bg-background border-2 border-transparent hover:border-primary/20 rounded-2xl shadow-sm transition-all group">
                                            <div className="col-span-6 flex flex-col gap-1">
                                                <Label className="font-black group-hover:text-primary transition-colors">{rfqItem.itemName}</Label>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">الكمية المطلوبة: {rfqItem.quantity}</span>
                                            </div>
                                            <div className="col-span-6">
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">د.ك</span>
                                                    <Input
                                                        type="number"
                                                        step="0.001"
                                                        placeholder="سعر الوحدة"
                                                        value={quoteItem?.unitPrice || ''}
                                                        onChange={(e) => handleItemPriceChange(rfqItem.id!, e.target.value)}
                                                        className="h-11 pl-10 dir-ltr text-left font-black text-lg rounded-xl border-2 focus:border-primary"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
                
                <DialogFooter className="p-6 border-t bg-muted/10">
                    <Button variant="outline" onClick={onClose} disabled={isSaving} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
                    <Button onClick={handleSubmit} disabled={isSaving} className="h-12 px-12 rounded-xl font-black text-lg shadow-lg shadow-primary/20">
                        {isSaving ? <Loader2 className="animate-spin ml-3 h-5 w-5" /> : <Save className="ml-3 h-5 w-5"/>}
                        {existingQuote ? 'تحديث عرض السعر' : 'حفظ عرض السعر'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
