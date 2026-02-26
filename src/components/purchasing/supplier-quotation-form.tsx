'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Loader2, Save, Sparkles, FileUp, Calendar, Clock, CreditCard, Hash } from 'lucide-react';
import type { Vendor, RequestForQuotation, SupplierQuotation } from '@/lib/types';
import { DateInput } from '../ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { cn, formatCurrency } from '@/lib/utils';

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

export function SupplierQuotationForm({
  isOpen,
  onClose,
  rfq,
  vendor,
  existingQuote = null,
}: SupplierQuotationFormProps) {
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
        const parsedDate = toFirestoreDate(existingQuote.date);
        setDate(parsedDate || new Date());
        setDeliveryTime(String(existingQuote.deliveryTimeDays || ''));
        setPaymentTerms(existingQuote.paymentTerms || '');

        const initialItems = rfq.items.map((rfqItem) => {
          const existingItem = existingQuote.items.find((qi) => qi.rfqItemId === rfqItem.id);
          return {
            rfqItemId: rfqItem.id!,
            unitPrice: existingItem?.unitPrice ?? '',
          };
        });
        setItems(initialItems);
      } else {
        setReference('');
        setDate(new Date());
        setDeliveryTime('');
        setPaymentTerms('');
        setItems(rfq.items.map((item) => ({ rfqItemId: item.id!, unitPrice: '' })));
      }
      setSelectedFile(null);
    }
  }, [isOpen, rfq, existingQuote]);

  const handleItemPriceChange = useCallback((rfqItemId: string, price: string) => {
    setItems((prev) =>
      prev.map((item) => (item.rfqItemId === rfqItemId ? { ...item, unitPrice: price } : item))
    );
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && file.type === 'application/pdf') {
        setSelectedFile(file);
      } else if (file) {
        toast({
          variant: 'destructive',
          title: 'ملف غير صالح',
          description: 'الرجاء اختيار ملف PDF فقط.',
        });
        setSelectedFile(null);
      }
    },
    [toast]
  );

  const handleAnalyzePdf = useCallback(async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    // Mocking AI analysis delay
    setTimeout(() => {
      toast({
        title: 'ميزة ذكية قيد التنفيذ',
        description: 'سيتم قريباً تفعيل الذكاء الاصطناعي لقراءة الأسعار من ملفات PDF المرفوعة.',
      });
      setIsAnalyzing(false);
    }, 1500);
  }, [selectedFile, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !date) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'البيانات غير مكتملة.' });
      return;
    }

    setIsSaving(true);
    try {
      const processedItems = items
        .filter((item) => item.unitPrice !== '' && !isNaN(Number(item.unitPrice)))
        .map((item) => ({ ...item, unitPrice: Number(item.unitPrice) }));

      if (processedItems.length === 0) throw new Error('الرجاء إدخال أسعار الأصناف على الأقل.');

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
      const message = error instanceof Error ? error.message : 'فشل حفظ عرض السعر.';
      toast({ variant: 'destructive', title: 'خطأ', description: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl"
        dir="rtl"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (
            target.closest('[role="dialog"]') ||
            target.closest('.react-select__menu-portal') ||
            target.closest('[data-radix-popper-content-wrapper]') ||
            target.closest('[data-inline-search-list-options]')
          ) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="p-6 bg-muted/20 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <FileUp className="h-6 w-6" />
            </div>
            <div>
                <DialogTitle className="text-xl font-black">{existingQuote ? 'تعديل' : 'إدخال'} عرض سعر من مورد</DialogTitle>
                <DialogDescription>عرض السعر لشركة: <span className="font-bold text-foreground">{vendor.name}</span></DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-8">
            {/* Smart AI Section */}
            <div className="bg-blue-50/50 border-2 border-dashed border-blue-200 p-6 rounded-[2rem] space-y-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-blue-600 animate-pulse" />
                <h4 className="font-black text-blue-700">المساعد الذكي لقراءة العروض</h4>
              </div>
              <div className="flex items-end gap-4">
                <div className="grid gap-2 flex-grow">
                  <Label className="text-[10px] uppercase font-black text-blue-600/70 pr-1">ارفع ملف المورد (PDF)</Label>
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="bg-background rounded-xl border-blue-100 h-11 focus-visible:ring-blue-400"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleAnalyzePdf}
                  disabled={!selectedFile || isAnalyzing}
                  className="h-11 px-6 rounded-xl font-black bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"
                >
                  {isAnalyzing ? (
                    <Loader2 className="animate-spin h-4 w-4" />
                  ) : (
                    "تحليل العرض"
                  )}
                </Button>
              </div>
            </div>

            {/* Basic Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border rounded-[2rem] bg-card shadow-sm">
              <div className="grid gap-2">
                <Label className="font-bold text-sm flex items-center gap-2 text-muted-foreground"><Hash className="h-3 w-3"/> مرجع العرض (رقم الفاتورة)</Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="QT-0000"
                  className="rounded-xl h-11 border-2 font-mono"
                />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-sm flex items-center gap-2 text-muted-foreground"><Calendar className="h-3 w-3"/> تاريخ العرض *</Label>
                <DateInput value={date} onChange={setDate} className="rounded-xl h-11 border-2" />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-sm flex items-center gap-2 text-muted-foreground"><Clock className="h-3 w-3"/> مدة التوريد (أيام)</Label>
                <Input
                  type="number"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  placeholder="مثال: 3"
                  className="rounded-xl h-11 border-2 font-mono"
                />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-sm flex items-center gap-2 text-muted-foreground"><CreditCard className="h-3 w-3"/> شروط الدفع</Label>
                <Input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="مثال: دفع كاش"
                  className="rounded-xl h-11 border-2"
                />
              </div>
            </div>

            {/* Pricing Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <Label className="text-lg font-black text-foreground">قائمة أسعار الأصناف المطلوبة</Label>
                <Badge variant="outline" className="bg-muted font-bold">{rfq.items.length} صنف</Badge>
              </div>
              <div className="space-y-3">
                {rfq.items.map((rfqItem) => {
                  const quoteItem = items.find((i) => i.rfqItemId === rfqItem.id);
                  return (
                    <div
                      key={rfqItem.id}
                      className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-background border-2 border-muted hover:border-primary/20 rounded-2xl transition-all group"
                    >
                      <div className="flex-grow w-full space-y-1">
                        <Label className="font-black text-base group-hover:text-primary transition-colors">
                          {rfqItem.itemName}
                        </Label>
                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest bg-muted/50 w-fit px-2 py-0.5 rounded">
                          الكمية المطلوبة: {rfqItem.quantity}
                        </div>
                      </div>
                      <div className="w-full sm:w-48 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground">د.ك</span>
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="سعر الوحدة"
                          value={quoteItem?.unitPrice || ''}
                          onChange={(e) => handleItemPriceChange(rfqItem.id!, e.target.value)}
                          className="h-11 pl-10 dir-ltr text-left font-black text-lg rounded-xl border-2 focus:border-primary bg-muted/5"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-muted/30">
          <Button variant="ghost" onClick={onClose} disabled={isSaving} className="h-12 px-8 rounded-xl font-bold">
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving}
            className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/20"
          >
            {isSaving ? (
              <Loader2 className="animate-spin ml-3 h-5 w-5" />
            ) : (
              <Save className="ml-3 h-5 w-5" />
            )}
            {existingQuote ? 'تحديث عرض السعر' : 'حفظ عرض السعر'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
