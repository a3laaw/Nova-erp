
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
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, addDoc, updateDoc, collection } from 'firebase/firestore';
import { Loader2, Save, Table as TableIcon, FileSpreadsheet, Sparkles, Truck, Tag, CreditCard } from 'lucide-react';
import type { Vendor, RequestForQuotation, SupplierQuotation, Item } from '@/lib/types';
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
import * as XLSX from 'xlsx';
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

const PRICE_KEYWORDS = ['سعر', 'السعر', 'وحده', 'الوحدة', 'قيمة', 'القيمة', 'اجمالي', 'الإجمالي', 'price', 'unit price', 'rate', 'unit', 'cost', 'amt', 'amount', 'total'];
const ITEM_KEYWORDS = ['بند', 'البند', 'بيان', 'البيان', 'اسم', 'الاسم', 'صنف', 'الصنف', 'وصف', 'الوصف', 'item', 'description', 'name', 'service', 'product'];
const CODE_KEYWORDS = ['كود', 'الكود', 'رمز', 'الرمز', 'رقم', 'الرقم', 'مسلسل', 'م', 'code', 'sku', 'part number', 'id', 'ref', 'reference', 'no'];

export function SupplierQuotationForm({
  isOpen,
  onClose,
  rfq,
  vendor,
  existingQuote = null,
}: SupplierQuotationFormProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  const [reference, setReference] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [deliveryTime, setDeliveryTime] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [deliveryFees, setDeliveryFees] = useState('0');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: allItems = [] } = useSubscription<Item>(firestore, 'items');

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

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (data.length < 1) throw new Error('الملف فارغ.');

        let colIdx = { code: -1, name: -1, price: -1 };
        let headerRowIdx = -1;

        for (let i = 0; i < Math.min(data.length, 20); i++) {
          const row = data[i]?.map(c => String(c || '').toLowerCase().trim()) || [];
          if (colIdx.name === -1) colIdx.name = row.findIndex(c => ITEM_KEYWORDS.some(k => c.includes(k)));
          if (colIdx.price === -1) colIdx.price = row.findIndex(c => PRICE_KEYWORDS.some(k => c.includes(k)));
          if (colIdx.code === -1) colIdx.code = row.findIndex(c => CODE_KEYWORDS.some(k => c.includes(k)));
          if (colIdx.name !== -1 && colIdx.price !== -1) {
            headerRowIdx = i;
            break;
          }
        }

        let matchCount = 0;
        const newItems = [...items];
        const startIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
        
        for (let i = startIdx; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;
          let excelName = colIdx.name !== -1 ? String(row[colIdx.name] || '').trim().toLowerCase() : '';
          let excelPrice = colIdx.price !== -1 ? parseFloat(String(row[colIdx.price] || '0').replace(/[^0-9.]/g, '')) : 0;
          
          if (excelName && excelPrice > 0) {
              const matchedIdx = newItems.findIndex(ni => ni.itemName.toLowerCase().includes(excelName) || excelName.includes(ni.itemName.toLowerCase()));
              if (matchedIdx !== -1) {
                  newItems[matchedIdx].unitPrice = excelPrice;
                  matchCount++;
              }
          }
        }
        setItems(newItems);
        toast({ title: 'اكتمل الاستيراد', description: `تمت مطابقة (${matchCount}) أصناف بنجاح.` });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'فشل الاستيراد', description: error.message });
      } finally {
        setIsImporting(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
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

                if (result && result.items) {
                    const newItems = [...items];
                    result.items.forEach((aiItem: any) => {
                        const idx = newItems.findIndex(ni => ni.rfqItemId === aiItem.rfqItemId);
                        if (idx !== -1 && aiItem.unitPrice) newItems[idx].unitPrice = aiItem.unitPrice;
                    });
                    setItems(newItems);
                    toast({ title: 'اكتمل التحليل بالذكاء الاصطناعي', description: result.summary || `تم استخراج الأسعار بنجاح.` });
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

      if (processedItems.length === 0) throw new Error('الرجاء إدخال سعر صنف واحد على الأقل.');

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
      toast({ title: 'نجاح', description: 'تم حفظ عرض السعر بنجاح.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl shadow-2xl" dir="rtl">
        <DialogHeader className="p-6 bg-muted/20 border-b flex-shrink-0">
          <div className="flex justify-between items-center w-full">
            <div>
              <DialogTitle className="text-2xl font-black">عرض السعر: {vendor.name}</DialogTitle>
              <DialogDescription>إدخال الأسعار والشروط لطلب التسعير: {rfq.rfqNumber}</DialogDescription>
            </div>
            <div className="flex gap-2">
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} />
              <input type="file" ref={aiFileInputRef} className="hidden" accept="image/*, .pdf" onChange={handleAiAnalysis} />
              
              <Button variant="outline" className="gap-2 h-11 rounded-xl" onClick={() => fileInputRef.current?.click()} disabled={isImporting || isAnalyzing}>
                {isImporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSpreadsheet className="h-5 w-5" />}
                استيراد Excel
              </Button>

              <Button variant="default" className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white h-11 rounded-xl" onClick={() => aiFileInputRef.current?.click()} disabled={isImporting || isAnalyzing}>
                {isAnalyzing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                تحليل ذكي
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label className="font-bold text-xs">مرجع المورد</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="رقم عرض المورد..." />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-xs">تاريخ العرض</Label>
                <DateInput value={date} onChange={setDate} />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-xs flex items-center gap-1"><Truck className="h-3 w-3"/> مدة التوريد (أيام)</Label>
                <Input type="number" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} placeholder="0" />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-2">
                    <Label className="font-bold text-xs flex items-center gap-1 text-green-600"><Tag className="h-3 w-3"/> خصم إجمالي (مبلغ)</Label>
                    <Input type="number" step="0.001" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className="border-green-200" />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold text-xs flex items-center gap-1 text-red-600"><Truck className="h-3 w-3"/> رسوم التوصيل</Label>
                    <Input type="number" step="0.001" value={deliveryFees} onChange={(e) => setDeliveryFees(e.target.value)} className="border-red-200" />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold text-xs flex items-center gap-1"><CreditCard className="h-3 w-3"/> طريقة الدفع (تفصيل)</Label>
                    <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="مثال: 50% نقدي و 50% آجل" />
                </div>
            </div>

            <div className="space-y-4">
              <Label className="text-lg font-black flex items-center gap-2"><TableIcon className="h-5 w-5 text-primary" /> أسعار البنود</Label>
              <div className="border rounded-2xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow><TableHead className="px-6">اسم الصنف المطلوب</TableHead><TableHead className="w-48 text-center">سعر الوحدة (د.ك)</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.rfqItemId} className="h-14">
                        <TableCell className="px-6 font-bold">{item.itemName}</TableCell>
                        <TableCell>
                          <Input type="number" step="0.001" value={item.unitPrice} onChange={(e) => handleItemPriceChange(item.rfqItemId, e.target.value)} className="text-center font-black font-mono text-lg text-primary" placeholder="0.000" />
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
          <Button onClick={handleSubmit} disabled={isSaving || isAnalyzing} className="h-12 px-12 rounded-xl font-black text-lg">
            {isSaving ? <Loader2 className="animate-spin ml-3" /> : <Save className="ml-3" />}
            اعتماد وحفظ العرض
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
