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
import { Loader2, Save, Table as TableIcon, FileSpreadsheet, Info, CheckCircle2, Sparkles, Image as ImageIcon } from 'lucide-react';
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

// الكلمات الدلالية الموسعة للبحث الذكي في ملفات Excel
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
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // جلب كافة الأصناف لمطابقة الـ SKU إذا وجد
  const { data: allItems = [] } = useSubscription<Item>(firestore, 'items');

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
          unitPrice: existingItem?.unitPrice ?? '',
        };
      });
      setItems(initialItems);
    } else {
      setReference('');
      setDate(new Date());
      setDeliveryTime('');
      setPaymentTerms('');
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

  const cleanText = (text: string) => {
    if (!text) return '';
    return text.toString().trim().toLowerCase()
      .replace(/[0-9]/g, '') // إزالة الأرقام
      .replace(/^(توريد|تركيب|م|رقم|بند|صنف)\s+/g, '') // إزالة الكلمات الزائدة من البداية
      .trim();
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

        // البحث الذكي عن الهيدر
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

        let codeMatchCount = 0;
        let nameMatchCount = 0;
        const newItems = [...items];

        const systemItemMap = new Map();
        rfq.items.forEach(ri => {
            const fullItem = allItems.find(i => i.id === ri.internalItemId);
            systemItemMap.set(ri.id, { ...ri, sku: fullItem?.sku?.toLowerCase() });
        });

        const startIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
        for (let i = startIdx; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          let excelCode = colIdx.code !== -1 ? String(row[colIdx.code] || '').trim().toLowerCase() : '';
          let excelName = colIdx.name !== -1 ? String(row[colIdx.name] || '').trim() : '';
          let excelPrice = -1;

          if (colIdx.price !== -1) {
              excelPrice = parseFloat(String(row[colIdx.price] || '0').replace(/[^0-9.]/g, ''));
          }

          if (isNaN(excelPrice) || excelPrice <= 0) continue;

          let matchedIdx = -1;
          if (excelCode) {
              matchedIdx = newItems.findIndex(ni => {
                  const sys = systemItemMap.get(ni.rfqItemId);
                  return sys?.sku === excelCode || ni.rfqItemId === excelCode;
              });
              if (matchedIdx !== -1) {
                  newItems[matchedIdx].unitPrice = excelPrice;
                  codeMatchCount++;
                  continue;
              }
          }

          const cleanedExcelName = cleanText(excelName);
          if (cleanedExcelName) {
              matchedIdx = newItems.findIndex(ni => {
                  const cleanedSystemName = cleanText(ni.itemName);
                  return cleanedSystemName === cleanedExcelName || cleanedSystemName.includes(cleanedExcelName) || cleanedExcelName.includes(cleanedSystemName);
              });
              if (matchedIdx !== -1) {
                  newItems[matchedIdx].unitPrice = excelPrice;
                  nameMatchCount++;
              }
          }
        }

        setItems(newItems);
        toast({ title: 'اكتمل الاستيراد الذكي', description: `تمت مطابقة (${codeMatchCount}) أصناف بالكود، و (${nameMatchCount}) أصناف بالاسم.` });
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
                
                const result = await analyzeSupplierQuote({
                    quoteFileDataUri: dataUri,
                    rfqItems
                });

                if (result && result.items) {
                    const newItems = [...items];
                    let matchCount = 0;
                    result.items.forEach((aiItem: any) => {
                        const idx = newItems.findIndex(ni => ni.rfqItemId === aiItem.rfqItemId);
                        if (idx !== -1 && aiItem.unitPrice) {
                            newItems[idx].unitPrice = aiItem.unitPrice;
                            matchCount++;
                        }
                    });
                    setItems(newItems);
                    toast({ 
                        title: 'اكتمل التحليل بالذكاء الاصطناعي', 
                        description: result.summary || `تم استخراج أسعار (${matchCount}) أصناف بنجاح من المستند.` 
                    });
                }
            } catch (innerError: any) {
                toast({ variant: 'destructive', title: 'خطأ في معالجة الملف', description: innerError.message });
            } finally {
                setIsAnalyzing(false);
            }
        };
        reader.readAsDataURL(file);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'خطأ في التحليل', description: error.message });
        setIsAnalyzing(false);
    } finally {
        if (e.target) e.target.value = '';
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
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl shadow-2xl border-none bg-background" dir="rtl">
        <DialogHeader className="p-6 bg-muted/20 border-b flex-shrink-0">
          <div className="flex justify-between items-center w-full">
            <div>
              <DialogTitle className="text-2xl font-black text-foreground">عرض السعر: {vendor.name}</DialogTitle>
              <DialogDescription className="text-sm font-medium">إدخال الأسعار لطلب التسعير: {rfq.rfqNumber}</DialogDescription>
            </div>
            <div className="flex gap-2">
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} />
              <input type="file" ref={aiFileInputRef} className="hidden" accept="image/*, .pdf" onChange={handleAiAnalysis} />
              
              <Button
                variant="outline"
                className="gap-2 border-primary/50 text-primary hover:bg-primary/5 h-11 rounded-xl shadow-sm font-bold"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting || isAnalyzing}
              >
                {isImporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSpreadsheet className="h-5 w-5" />}
                استيراد من Excel
              </Button>

              <Button
                variant="default"
                className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white h-11 rounded-xl shadow-md font-bold border-none"
                onClick={() => aiFileInputRef.current?.click()}
                disabled={isImporting || isAnalyzing}
              >
                {isAnalyzing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                تحليل ذكي (صورة/PDF)
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-muted/30 p-5 rounded-2xl border border-primary/5">
              <div className="grid gap-2">
                <Label className="font-bold text-xs pr-2 text-muted-foreground">مرجع المورد</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="رقم عرض المورد..." className="rounded-xl h-10 border-2" />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-xs pr-2 text-muted-foreground">تاريخ العرض</Label>
                <DateInput value={date} onChange={setDate} className="h-10 rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-xs pr-2 text-muted-foreground">مدة التوريد (أيام)</Label>
                <Input type="number" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} placeholder="0" className="h-10 rounded-xl border-2" />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-xs pr-2 text-muted-foreground">شروط الدفع</Label>
                <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="مثال: نقداً..." className="h-10 rounded-xl border-2" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <TableIcon className="h-5 w-5 text-primary" />
                  <Label className="text-xl font-black text-foreground">قائمة الأسعار المستخرجة</Label>
                </div>
                {isAnalyzing && (
                    <div className="flex items-center gap-2 text-primary font-bold animate-pulse">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        جاري تحليل المستند بالذكاء الاصطناعي...
                    </div>
                )}
              </div>
              <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-card">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="h-14 border-b-2">
                      <TableHead className="px-8 font-black text-base">اسم الصنف المطلوب</TableHead>
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

        <DialogFooter className="p-6 border-t bg-muted/10 flex-shrink-0">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isSaving || isAnalyzing} className="font-bold h-12 px-8 rounded-xl">إلغاء</Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || isAnalyzing || items.every((i) => !i.unitPrice)}
            className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all min-w-[240px]"
          >
            {isSaving ? <Loader2 className="animate-spin h-5 w-5 ml-3" /> : <Save className="h-5 w-5 ml-3" />}
            {isSaving ? 'جاري الحفظ...' : 'اعتماد وحفظ عرض السعر'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
