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
import { Loader2, Save, Sparkles, FileUp, ImageIcon, FileText as FileTextIcon, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Vendor, RequestForQuotation, SupplierQuotation } from '@/lib/types';
import { DateInput } from '../ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { cn, formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { analyzeSupplierQuote, type AnalyzeQuoteOutput } from '@/ai/flows/analyze-supplier-quote';

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

  // AI states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeQuoteOutput | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

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
      setFilePreview(null);
      setAnalysisResult(null);
      setAnalysisError(null);
    }
  }, [isOpen, rfq, existingQuote]);

  const handleItemPriceChange = useCallback((rfqItemId: string, price: string) => {
    setItems((prev) =>
      prev.map((item) => (item.rfqItemId === rfqItemId ? { ...item, unitPrice: price } : item))
    );
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        toast({ variant: 'destructive', title: 'ملف غير مدعوم', description: 'الأنواع المدعومة: PDF, JPG, PNG, WebP' });
        setSelectedFile(null);
        return;
    }
    
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setFilePreview(e.target?.result as string);
        reader.readAsDataURL(file);
    } else {
        setFilePreview(null);
    }
  };

  const handleAnalyzePdf = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);
    
    try {
        const reader = new FileReader();
        const dataUri = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedFile);
        });
        
        const rfqItemsForAI = rfq.items.map(item => ({
            id: item.id!,
            name: item.itemName || '',
        }));
        
        const result = await analyzeSupplierQuote({
            quoteFileDataUri: dataUri,
            rfqItems: rfqItemsForAI,
        });
        
        setAnalysisResult(result);
        
        if (result.extractedPrices && result.extractedPrices.length > 0) {
            result.extractedPrices.forEach(extracted => {
                if (extracted.unitPrice > 0) {
                    handleItemPriceChange(extracted.rfqItemId, String(extracted.unitPrice));
                }
            });
            toast({ title: '✅ تم التحليل', description: `تم استخراج ${result.extractedPrices.length} سعر بنجاح.` });
        }
    } catch (error: any) {
        setAnalysisError(error?.message || 'فشل تحليل المستند');
    } finally {
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
        .map((item) => ({ ...item, unitPrice: Number(item.unitPrice) }));

      if (processedItems.length === 0) throw new Error('الرجاء إدخال أسعار الأصناف.');

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
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl" dir="rtl">
        <DialogHeader className="p-6 bg-muted/20 border-b">
          <DialogTitle className="text-xl font-black">{existingQuote ? 'تعديل' : 'إدخال'} عرض سعر المورد</DialogTitle>
          <DialogDescription>المورد: {vendor.name}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-6">
            {/* AI Analysis UI */}
            <div className="bg-primary/5 border-2 border-dashed border-primary/20 p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h4 className="font-bold">المساعد الذكي لاستخراج الأسعار</h4>
                </div>

                {!selectedFile ? (
                    <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer hover:bg-primary/5 transition-colors">
                        <FileUp className="h-8 w-8 mb-2 text-muted-foreground" />
                        <p className="text-sm font-bold">ارفع عرض السعر (PDF أو صورة)</p>
                        <input type="file" accept="application/pdf,image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-background rounded-xl border">
                            <div className="flex items-center gap-3">
                                {filePreview ? <img src={filePreview} className="h-10 w-10 object-cover rounded" /> : <FileTextIcon className="h-8 w-8 text-primary" />}
                                <span className="text-sm font-bold truncate max-w-[200px]">{selectedFile.name}</span>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedFile(null)}><X className="h-4 w-4" /></Button>
                        </div>
                        <Button type="button" onClick={handleAnalyzePdf} disabled={isAnalyzing} className="w-full gap-2">
                            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            تحليل واستخراج الأسعار تلقائياً
                        </Button>
                    </div>
                )}

                {analysisResult && (
                    <Alert className="bg-green-50 border-green-200">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertTitle>تم استخراج البيانات</AlertTitle>
                        <AlertDescription className="text-xs">يرجى مراجعة الأسعار في الجدول أدناه قبل الحفظ.</AlertDescription>
                    </Alert>
                )}
                {analysisError && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>فشل التحليل</AlertTitle>
                        <AlertDescription className="text-xs">{analysisError}</AlertDescription>
                    </Alert>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>مرجع العرض</Label><Input value={reference} onChange={e => setReference(e.target.value)} /></div>
              <div className="grid gap-2"><Label>تاريخ العرض</Label><DateInput value={date} onChange={setDate} /></div>
            </div>

            <div className="space-y-4">
              <Label className="text-lg font-bold">الأصناف والأسعار</Label>
              {rfq.items.map((rfqItem) => {
                const item = items.find(i => i.rfqItemId === rfqItem.id);
                return (
                  <div key={rfqItem.id} className="flex items-center gap-4 p-4 border rounded-2xl bg-card">
                    <div className="flex-grow">
                      <p className="font-bold">{rfqItem.itemName}</p>
                      <p className="text-xs text-muted-foreground">الكمية المطلوبة: {rfqItem.quantity}</p>
                    </div>
                    <div className="w-32">
                      <Input type="number" step="0.001" placeholder="السعر" value={item?.unitPrice || ''} onChange={e => handleItemPriceChange(rfqItem.id!, e.target.value)} className="text-left font-bold" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-muted/10">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin ml-2" /> : <Save className="ml-2" />} حفظ العرض</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}