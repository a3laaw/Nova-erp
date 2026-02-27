'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, addDoc, updateDoc, collection } from 'firebase/firestore';
import { Loader2, Save, Table as TableIcon, History } from 'lucide-react';
import type { Vendor, RequestForQuotation, SupplierQuotation } from '@/lib/types';
import { DateInput } from '../ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cleanFirestoreData } from '@/lib/utils';

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

export function SupplierQuotationForm({ isOpen, onClose, rfq, vendor, existingQuote = null }: SupplierQuotationFormProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  // Form State
  const [reference, setReference] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [deliveryTime, setDeliveryTime] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (existingQuote) {
      setReference(existingQuote.quotationReference || '');
      setDate(toFirestoreDate(existingQuote.date) || new Date());
      setDeliveryTime(String(existingQuote.deliveryTimeDays || ''));
      setPaymentTerms(existingQuote.paymentTerms || '');
      const initialItems = rfq.items.map((rfqItem) => {
        const existingItem = existingQuote.items.find((qi) => qi.rfqItemId === rfqItem.id);
        return { 
          rfqItemId: rfqItem.id!, 
          itemName: rfqItem.itemName, 
          unitPrice: existingItem?.unitPrice ?? '' 
        };
      });
      setItems(initialItems);
    } else {
      setReference('');
      setDate(new Date());
      setDeliveryTime('');
      setPaymentTerms('');
      setItems(rfq.items.map((item) => ({ rfqItemId: item.id!, itemName: item.itemName, unitPrice: '' })));
    }
  }, [isOpen, rfq, existingQuote]);

  const handleItemPriceChange = (rfqItemId: string, price: string) => {
    setItems((prev) => prev.map((item) => (item.rfqItemId === rfqItemId ? { ...item, unitPrice: price } : item)));
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
          unitPrice: Number(item.unitPrice) 
        }));

      if (processedItems.length === 0) throw new Error('الرجاء إدخال سعر صنف واحد على الأقل.');

      const dataToSave = { 
        rfqId: rfq.id!, 
        vendorId: vendor.id!, 
        quotationReference: reference, 
        date: date, 
        deliveryTimeDays: Number(deliveryTime) || null, 
        paymentTerms: paymentTerms, 
        items: processedItems 
      };

      if (existingQuote) { 
        await updateDoc(doc(firestore, 'supplierQuotations', existingQuote.id!), cleanFirestoreData(dataToSave)); 
      } else { 
        await addDoc(collection(firestore, 'supplierQuotations'), cleanFirestoreData(dataToSave)); 
      }
      
      onClose();
      toast({ title: 'نجاح', description: 'تم حفظ عرض السعر بنجاح.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: error.message });
    } finally { 
      setIsSaving(false); 
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl shadow-2xl border-none bg-background" dir="rtl">
        {/* Fixed Header */}
        <DialogHeader className="p-6 bg-muted/20 border-b flex-shrink-0">
          <div>
            <DialogTitle className="text-2xl font-black text-foreground">إدخال عرض السعر: {vendor.name}</DialogTitle>
            <DialogDescription className="text-sm font-medium">طلب تسعير رقم: {rfq.rfqNumber}</DialogDescription>
          </div>
        </DialogHeader>
        
        {/* Scrollable Content Area */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-muted/30 p-5 rounded-2xl border border-primary/5">
              <div className="grid gap-2">
                <Label className="font-bold text-xs pr-2 text-muted-foreground uppercase tracking-widest">مرجع المورد</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="رقم عرض المورد..." className="rounded-xl h-10 border-2 bg-background" />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-xs pr-2 text-muted-foreground uppercase tracking-widest">تاريخ العرض</Label>
                <DateInput value={date} onChange={setDate} className="h-10 rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-xs pr-2 text-muted-foreground uppercase tracking-widest">مدة التوريد (أيام)</Label>
                <Input type="number" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} placeholder="0" className="rounded-xl h-10 border-2 bg-background" />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-xs pr-2 text-muted-foreground uppercase tracking-widest">شروط الدفع</Label>
                <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="مثال: نقداً..." className="rounded-xl h-10 border-2 bg-background" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <TableIcon className="h-5 w-5 text-primary" />
                <Label className="text-xl font-black text-foreground">قائمة الأسعار المقدمة</Label>
              </div>
              <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm bg-card">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="h-14 border-b-2">
                      <TableHead className="px-8 font-black text-base text-right">اسم الصنف المطلوب</TableHead>
                      <TableHead className="w-56 text-center font-black text-base px-6">سعر الوحدة (د.ك)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.rfqItemId} className="h-16 hover:bg-muted/5 transition-colors border-b last:border-0 group">
                        <TableCell className="px-8 font-bold text-foreground/80">{item.itemName}</TableCell>
                        <TableCell className="px-6">
                          <Input 
                            type="number" 
                            step="0.001" 
                            value={item.unitPrice} 
                            onChange={(e) => handleItemPriceChange(item.rfqItemId, e.target.value)} 
                            className="h-11 text-center font-black font-mono text-xl text-primary border-2 border-transparent group-hover:border-primary/20 transition-all bg-primary/5 rounded-xl shadow-inner focus-visible:ring-primary/30" 
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

        {/* Fixed Footer */}
        <DialogFooter className="p-6 border-t bg-muted/10 flex-shrink-0">
          <div className="flex justify-end gap-4 w-full">
            <Button variant="ghost" onClick={onClose} disabled={isSaving} className="font-bold h-12 px-8 rounded-xl hover:bg-background">إلغاء</Button>
            <Button onClick={handleSubmit} disabled={isSaving || items.every((i) => !i.unitPrice)} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all min-w-[240px]">
              {isSaving ? <Loader2 className="animate-spin h-5 w-5 ml-3" /> : <Save className="h-5 w-5 ml-3" />}
              {isSaving ? 'جاري الحفظ...' : 'حفظ عرض السعر'}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </Dialog>
  );
}