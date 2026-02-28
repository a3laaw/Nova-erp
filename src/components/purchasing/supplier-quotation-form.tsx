'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
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
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, addDoc, updateDoc, collection } from 'firebase/firestore';
import { Loader2, Save, Table as TableIcon, Sparkles, Truck, Tag, CreditCard, Camera } from 'lucide-react';
import type { Vendor, RequestForQuotation, SupplierQuotation } from '@/lib/types';
import { DateInput } from '../ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';
import { ScrollArea } from '../ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cleanFirestoreData } from '@/lib/utils';
import { analyzeSupplierQuote } from '@/ai/flows/analyze-supplier-quote';
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
  itemName: string;
  unitPrice: number | string;
}

export function SupplierQuotationForm({
  isOpen,
  onClose,
  rfq,
  vendor,
  existingQuote = null,
}: SupplierQuotationFormProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  const [reference, setReference] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [deliveryTime, setDeliveryTime] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [deliveryFees, setDeliveryFees] = useState('0');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (existingQuote) {
      setReference(existingQuote.quotationReference || '');
      setDate(toFirestoreDate(existingQuote.date) || new Date());
      setDeliveryTime(String(existingQuote.deliveryTimeDays || ''));
      setPaymentTerms(existingQuote.paymentTerms || '');
      setDiscountAmount(String(existingQuote.discountAmount || '0'));
      setDeliveryFees(String(existingQuote.deliveryFees || '0'));

      const initialItems = rfq.items.map((rfqItem) => {
        const existingItem = existingQuote.items.find((qi) => qi.rfqItemId === rfqItem.id);
        return {
          rfqItemId: rfqItem.id!,
          itemName: rfqItem.itemName,
          unitPrice: existingItem?.unitPrice ?? '',
        };
      });
      setItems(initialItems);
    } else {
      setReference('');
      setDate(new Date());
      setDeliveryTime('');
      setPaymentTerms('');
      setDiscountAmount('0');
      setDeliveryFees('0');
      setItems(
        rfq.items.map((item) => ({
          rfqItemId: item.id!,
          itemName: item.itemName,
          unitPrice: '',
        }))
      );
    }
  }, [isOpen, rfq, existingQuote]);

  const handleItemPriceChange = (rfqItemId: string, price: string) => {
    setItems((prev) =>
      prev.map((item) => (item.rfqItemId === rfqItemId ? { ...item, unitPrice: price } : item))
    );
  };

  const handleAiAnalysis = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const dataUri = evt.target?.result as string;
                const rfqItems = rfq.items.map(i => ({ id: i.id!, name: i.itemName }));
                const result = await analyzeSupplierQuote({ quoteFileDataUri: dataUri, rfqItems });

                if (result) {
                    if (result.items) {
                        const newItems = [...items];
                        result.items.forEach((aiItem: any) => {
                            const idx = newItems.findIndex(ni => ni.rfqItemId === aiItem.rfqItemId);
                            if (idx !== -1 && aiItem.unitPrice) newItems[idx].unitPrice = aiItem.unitPrice;
                        });
                        setItems(newItems);
                    }

                    if (result.discountAmount) setDiscountAmount(String(result.discountAmount));
                    if (result.deliveryFees) setDeliveryFees(String(result.deliveryFees));
                    if (result.deliveryTimeDays) setDeliveryTime(String(result.deliveryTimeDays));
                    if (result.paymentTerms) setPaymentTerms(result.paymentTerms);

                    toast({ 
                        title: 'تم استخراج البيانات', 
                        description: result.summary || `نجح الذكاء الاصطناعي في تحليل المستند.` 
                    });
                }
            } catch (err: any) {
                toast({ variant: 'destructive', title: 'خطأ في التحليل', description: err.message });
            } finally {
                setIsAnalyzing(false);
            }
        };
        reader.readAsDataURL(file);
    } catch (error: any) {
        setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !date) return;

    setIsSaving(true);
    try {
      const processedItems = items
        .filter((item) => item.unitPrice !== '' && !isNaN(Number(item.unitPrice)))
        .map((item) => ({
          rfqItemId: item.rfqItemId,
          unitPrice: Number(item.unitPrice),
        }));

      const dataToSave = {
        rfqId: rfq.id!,
        vendorId: vendor.id!,
        quotationReference: reference,
        date: date,
        deliveryTimeDays: Number(deliveryTime) || null,
        paymentTerms: paymentTerms,
        discountAmount: Number(discountAmount) || 0,
        deliveryFees: Number(deliveryFees) || 0,
        items: processedItems,
      };

      if (existingQuote) {
        await updateDoc(doc(firestore, 'supplierQuotations', existingQuote.id!), cleanFirestoreData(dataToSave));
      } else {
        await addDoc(collection(firestore, 'supplierQuotations'), cleanFirestoreData(dataToSave));
      }

      onClose();
      toast({ title: 'نجاح', description: 'تم حفظ عرض السعر.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-[2rem] shadow-2xl" dir="rtl">
        <DialogHeader className="p-6 bg-muted/20 border-b flex-shrink-0">
          <div className="flex justify-between items-center w-full">
            <div>
              <DialogTitle className="text-2xl font-black">عرض السعر: {vendor.name}</DialogTitle>
              <DialogDescription>إدخال بيانات عرض المورد لطلب التسعير: {rfq.rfqNumber}</DialogDescription>
            </div>
            <div className="flex gap-2">
              <input type="file" ref={aiFileInputRef} className="hidden" accept="image/*, .pdf" onChange={handleAiAnalysis} />
              <Button 
                variant="default" 
                className="gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white h-11 px-6 rounded-xl font-bold shadow-lg shadow-indigo-100" 
                onClick={() => aiFileInputRef.current?.click()} 
                disabled={isAnalyzing || isSaving}
              >
                {isAnalyzing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                تحليل الصورة بالذكاء الاصطناعي
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label className="font-bold text-xs text-muted-foreground">مرجع المورد</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="رقم عرض المورد..." />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-xs text-muted-foreground">تاريخ العرض</Label>
                <DateInput value={date} onChange={setDate} />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-xs text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3"/> مدة التوريد (أيام)</Label>
                <Input type="number" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} placeholder="0" />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-2">
                    <Label className="font-bold text-xs flex items-center gap-1 text-green-600"><Tag className="h-3 w-3"/> خصم إجمالي (مبلغ)</Label>
                    <Input type="number" step="0.001" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className="border-green-200 focus:border-green-500" />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold text-xs flex items-center gap-1 text-red-600"><Truck className="h-3 w-3"/> رسوم التوصيل</Label>
                    <Input type="number" step="0.001" value={deliveryFees} onChange={(e) => setDeliveryFees(e.target.value)} className="border-red-200 focus:border-red-500" />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold text-xs flex items-center gap-1"><CreditCard className="h-3 w-3"/> طريقة الدفع</Label>
                    <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="مثال: 50% نقدي و 50% آجل" />
                </div>
            </div>

            <div className="space-y-4">
              <Label className="text-lg font-black flex items-center gap-2"><TableIcon className="h-5 w-5 text-primary" /> تسعير البنود</Label>
              <div className="border rounded-2xl overflow-hidden shadow-sm bg-muted/5">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow><TableHead className="px-6">الصنف المطلوب</TableHead><TableHead className="w-48 text-center">سعر الوحدة (د.ك)</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.rfqItemId} className="h-14">
                        <TableCell className="px-6 font-bold">{item.itemName}</TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            step="0.001" 
                            value={item.unitPrice} 
                            onChange={(e) => handleItemPriceChange(item.rfqItemId, e.target.value)} 
                            className="text-center font-black font-mono text-xl text-primary border-none shadow-none focus-visible:ring-0" 
                            placeholder="0.000" 
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-muted/10">
          <Button variant="ghost" onClick={onClose} disabled={isSaving || isAnalyzing}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={isSaving || isAnalyzing} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/20">
            {isSaving ? <Loader2 className="animate-spin ml-3" /> : <Save className="ml-3" />}
            اعتماد وحفظ العرض
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
