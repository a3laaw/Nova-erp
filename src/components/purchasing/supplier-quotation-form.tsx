'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, addDoc, updateDoc, collection } from 'firebase/firestore';
import { Loader2, Save, Table as TableIcon, Sparkles, CheckCircle2, AlertCircle, ImageIcon } from 'lucide-react';
import type { Vendor, RequestForQuotation, SupplierQuotation } from '@/lib/types';
import { DateInput } from '../ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cleanFirestoreData } from '@/lib/utils';
import { analyzeSupplierQuote } from '@/ai/flows/analyze-supplier-quote';

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

type AnalysisStatus = 'idle' | 'reading' | 'analyzing' | 'done' | 'error';

export function SupplierQuotationForm({ isOpen, onClose, rfq, vendor, existingQuote = null }: SupplierQuotationFormProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [reference, setReference] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [deliveryTime, setDeliveryTime] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle');

  useEffect(() => {
    if (!isOpen) return;
    setAnalysisStatus('idle');
    if (existingQuote) {
      setReference(existingQuote.quotationReference || '');
      setDate(toFirestoreDate(existingQuote.date) || new Date());
      setDeliveryTime(String(existingQuote.deliveryTimeDays || ''));
      setPaymentTerms(existingQuote.paymentTerms || '');
      const initialItems = rfq.items.map((rfqItem) => {
        const existingItem = existingQuote.items.find((qi) => qi.rfqItemId === rfqItem.id);
        return { rfqItemId: rfqItem.id!, itemName: rfqItem.itemName, unitPrice: existingItem?.unitPrice ?? '' };
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

  const handleAutoAnalyze = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'الملف كبير جداً', description: 'الحد الأقصى 10 ميجابايت.' });
      return;
    }
    setIsAnalyzing(true);
    setAnalysisStatus('reading');
    const reader = new FileReader();
    reader.onerror = () => {
      setIsAnalyzing(false);
      setAnalysisStatus('error');
      toast({ variant: 'destructive', title: 'خطأ في قراءة الملف', description: 'جرب صورة أخرى.' });
    };
    reader.onload = async (e) => {
      try {
        const dataUri = e.target?.result as string;
        if (!dataUri || !dataUri.startsWith('data:')) throw new Error('فشل في تحويل الصورة.');
        setAnalysisStatus('analyzing');
        const result = await analyzeSupplierQuote({
          quoteFileDataUri: dataUri,
          rfqItems: rfq.items.map((i) => ({ id: i.id!, name: i.itemName })),
        });
        if (result) {
          let pricesUpdated = 0;
          if (result.extractedPrices && Array.isArray(result.extractedPrices)) {
            setItems((prev) => prev.map((item) => {
              const extracted = result.extractedPrices.find((ep: any) => ep.rfqItemId === item.rfqItemId);
              if (extracted && extracted.unitPrice > 0) { pricesUpdated++; return { ...item, unitPrice: extracted.unitPrice }; }
              return item;
            }));
          }
          if (result.date) { try { const d = new Date(result.date); if (!isNaN(d.getTime())) setDate(d); } catch {} }
          if (result.vendorName && !reference) setReference(result.vendorName);
          setAnalysisStatus('done');
          toast({ title: 'اكتمل التحليل الذكي', description: pricesUpdated > 0 ? 'تم استخراج أسعار ' + pricesUpdated + ' صنف. راجع الجدول قبل الحفظ.' : 'لم يتم العثور على أسعار مطابقة. تأكد من وضوح الصورة.' });
        } else { throw new Error('لم يتم استخراج بيانات.'); }
      } catch (err: any) {
        setAnalysisStatus('error');
        toast({ variant: 'destructive', title: 'خطأ في التحليل', description: err.message || 'فشل استخراج البيانات.' });
      } finally {
        setIsAnalyzing(false);
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !date) return;
    setIsSaving(true);
    try {
      const processedItems = items.filter((item) => item.unitPrice !== '' && !isNaN(Number(item.unitPrice))).map((item) => ({ rfqItemId: item.rfqItemId, unitPrice: Number(item.unitPrice) }));
      if (processedItems.length === 0) throw new Error('الرجاء إدخال سعر صنف واحد على الأقل.');
      const dataToSave = { rfqId: rfq.id!, vendorId: vendor.id!, quotationReference: reference, date: date, deliveryTimeDays: Number(deliveryTime) || null, paymentTerms: paymentTerms, items: processedItems };
      if (existingQuote) { await updateDoc(doc(firestore, 'supplierQuotations', existingQuote.id!), cleanFirestoreData(dataToSave)); }
      else { await addDoc(collection(firestore, 'supplierQuotations'), cleanFirestoreData(dataToSave)); }
      onClose();
      toast({ title: 'نجاح', description: 'تم حفظ عرض السعر بنجاح.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: error.message });
    } finally { setIsSaving(false); }
  };

  const getStatusInfo = () => {
    switch (analysisStatus) {
      case 'reading': return { icon: <Loader2 className="h-4 w-4 animate-spin" />, text: 'جاري قراءة الصورة...', color: 'text-blue-600' };
      case 'analyzing': return { icon: <Loader2 className="h-4 w-4 animate-spin" />, text: 'جاري التحليل بالذكاء الاصطناعي...', color: 'text-purple-600' };
      case 'done': return { icon: <CheckCircle2 className="h-4 w-4" />, text: 'تم التحليل بنجاح', color: 'text-green-600' };
      case 'error': return { icon: <AlertCircle className="h-4 w-4" />, text: 'فشل التحليل - جرب صورة أوضح', color: 'text-red-600' };
      default: return null;
    }
  };
  const statusInfo = getStatusInfo();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl shadow-2xl border-none" dir="rtl">
        <DialogHeader className="p-6 bg-muted/20 border-b">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl font-black text-foreground">إدخال عرض السعر: {vendor.name}</DialogTitle>
              <DialogDescription className="text-sm font-medium">طلب تسعير رقم: {rfq.rfqNumber}</DialogDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button variant="outline" className="gap-2 border-primary/50 text-primary hover:bg-primary/5 h-11 rounded-xl shadow-sm" asChild disabled={isAnalyzing}>
                <label className="cursor-pointer">
                  {isAnalyzing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5 fill-primary/20" />}
                  {isAnalyzing ? 'جاري التحليل...' : 'بدء التحليل التلقائي للصورة'}
                  <input type="file" className="sr-only" onChange={handleAutoAnalyze} accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf" disabled={isAnalyzing} />
                </label>
              </Button>
              {statusInfo ? (
                <div className={cn('flex items-center gap-1.5 text-xs font-bold ', statusInfo.color)}>
                  {statusInfo.icon}
                  <span>{statusInfo.text}</span>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground font-bold italic flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" />
                  ارفع صورة عرض السعر لاستخراج الأسعار آلياً بواسطة AI
                </p>
              )}
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-muted/30 p-5 rounded-2xl border border-primary/5">
              <div className="grid gap-2">
                <Label className="font-bold text-xs pr-2 text-muted-foreground uppercase tracking-widest">مرجع المورد</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="رقم عرض المورد..." className="rounded-xl h-10 border-2" />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-xs pr-2 text-muted-foreground uppercase tracking-widest">تاريخ العرض</Label>
                <DateInput value={date} onChange={setDate} className="h-10 rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-xs pr-2 text-muted-foreground uppercase tracking-widest">مدة التوريد (أيام)</Label>
                <Input type="number" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} placeholder="0" className="h-10 rounded-xl border-2" />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-xs pr-2 text-muted-foreground uppercase tracking-widest">شروط الدفع</Label>
                <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="مثال: نقداً..." className="h-10 rounded-xl border-2" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <TableIcon className="h-5 w-5 text-primary" />
                <Label className="text-xl font-black text-foreground">قائمة الأسعار المقدمة</Label>
              </div>
              <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-card">
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
                          <Input type="number" step="0.001" value={item.unitPrice} onChange={(e) => handleItemPriceChange(item.rfqItemId, e.target.value)} className="h-11 text-center font-black font-mono text-xl text-primary border-2 border-transparent group-hover:border-primary/20 transition-all bg-primary/5 rounded-xl shadow-inner focus-visible:ring-primary/30" placeholder="0.000" />
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
          <Button variant="ghost" onClick={onClose} disabled={isSaving} className="font-bold h-12 px-8 rounded-xl">إلغاء</Button>
          <Button onClick={handleSubmit} disabled={isSaving || items.every((i) => !i.unitPrice)} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all min-w-[240px]">
            {isSaving ? <Loader2 className="animate-spin h-5 w-5 ml-3" /> : <Save className="h-5 w-5 ml-3" />}
            {isSaving ? 'جاري الحفظ...' : 'اعتماد وحفظ عرض السعر'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}