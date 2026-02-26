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
import { Loader2, Save, Sparkles, FileUp, Calendar, Clock, CreditCard, Hash, CheckCircle2, AlertTriangle, ImageIcon, FileText as FileTextIcon, X } from 'lucide-react';
import type { Vendor, RequestForQuotation, SupplierQuotation } from '@/lib/types';
import { DateInput } from '../ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { cn, formatCurrency } from '@/lib/utils';
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
    
    if (file.size > 10 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'ملف كبير جداً', description: 'الحد الأقصى 10 ميجابايت' });
        setSelectedFile(null);
        return;
    }
    
    setSelectedFile(file);
    setAnalysisResult(null);
    setAnalysisError(null);
    
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
        // تحويل الملف إلى Data URI
        const reader = new FileReader();
        const dataUri = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedFile);
        });
        
        // تجهيز أصناف الطلب للمطابقة
        const rfqItemsForAI = rfq.items.map(item => ({
            id: item.id!,
            name: item.itemName || '',
        }));
        
        // استدعاء Genkit AI
        const result = await analyzeSupplierQuote({
            quoteFileDataUri: dataUri,
            rfqItems: rfqItemsForAI,
        });
        
        setAnalysisResult(result);
        
        // ملء الأسعار تلقائياً
        if (result.extractedPrices && result.extractedPrices.length > 0) {
            let matchedCount = 0;
            result.extractedPrices.forEach(extracted => {
                const matchingItem = items.find(i => i.rfqItemId === extracted.rfqItemId);
                if (matchingItem && extracted.unitPrice > 0) {
                    handleItemPriceChange(extracted.rfqItemId, String(extracted.unitPrice));
                    matchedCount++;
                }
            });
            
            toast({
                title: '✅ تم التحليل بنجاح',
                description: `تم استخراج ومطابقة ${matchedCount} سعر من ${result.extractedPrices.length} صنف. راجع الأسعار قبل الحفظ.`,
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'لم يتم استخراج أسعار',
                description: result.notes || 'تأكد من وضوح المستند وأنه يحتوي على جدول أسعار.',
            });
        }
    } catch (error: any) {
        console.error('AI Analysis error:', error);
        const errorMessage = error?.message || 'فشل تحليل المستند';
        setAnalysisError(errorMessage);
        toast({
            variant: 'destructive',
            title: 'خطأ في التحليل',
            description: errorMessage,
        });
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setAnalysisResult(null);
    setAnalysisError(null);
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
            <div className="bg-gradient-to-br from-primary/5 to-violet-500/5 border-2 border-dashed border-primary/20 p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h4 className="font-bold text-primary">الاستخراج الذكي للأسعار</h4>
                            <p className="text-[11px] text-muted-foreground">حمّل صورة أو PDF وسيتم استخراج الأسعار تلقائياً</p>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <Badge variant="outline" className="text-[10px] gap-1"><ImageIcon className="h-3 w-3" /> صور</Badge>
                        <Badge variant="outline" className="text-[10px] gap-1"><FileTextIcon className="h-3 w-3" /> PDF</Badge>
                    </div>
                </div>

                <div className="space-y-3">
                    {!selectedFile ? (
                        <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-muted-foreground/20 rounded-xl cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all group">
                            <div className="p-3 bg-muted rounded-full group-hover:bg-primary/10 transition-colors">
                                <FileUp className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-sm">اضغط لاختيار ملف أو اسحبه هنا</p>
                                <p className="text-[11px] text-muted-foreground mt-1">PDF, JPG, PNG, WebP — حد أقصى 10 ميجا</p>
                            </div>
                            <Input type="file" accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
                        </label>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-background rounded-xl border">
                                <div className="flex items-center gap-3">
                                    {filePreview ? (
                                        <img src={filePreview} alt="معاينة" className="h-12 w-12 object-cover rounded-lg border" />
                                    ) : (
                                        <div className="h-12 w-12 bg-red-50 rounded-lg border flex items-center justify-center">
                                            <FileTextIcon className="h-6 w-6 text-red-500" />
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-bold text-sm truncate max-w-[200px]">{selectedFile.name}</p>
                                        <p className="text-[11px] text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                </div>
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={handleRemoveFile} disabled={isAnalyzing}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <Button type="button" onClick={handleAnalyzePdf} disabled={isAnalyzing}
                                className="w-full h-11 rounded-xl font-bold gap-2 bg-gradient-to-l from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90">
                                {isAnalyzing ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> جاري تحليل المستند بالذكاء الاصطناعي...</>
                                ) : (
                                    <><Sparkles className="h-4 w-4" /> تحليل واستخراج الأسعار تلقائياً</>
                                )}
                            </Button>
                        </div>
                    )}

                    {analysisResult && analysisResult.extractedPrices && analysisResult.extractedPrices.length > 0 && (
                        <div className="p-4 rounded-xl border-2 bg-green-50/50 border-green-200 dark:bg-green-950/20">
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                                <div className="flex-1">
                                    <p className="font-bold text-sm text-green-700">تم استخراج {analysisResult.extractedPrices.length} سعر بنجاح</p>
                                    {analysisResult.currency && <p className="text-xs text-muted-foreground">العملة المكتشفة: {analysisResult.currency}</p>}
                                    <div className="mt-2 space-y-1">
                                        {analysisResult.extractedPrices.map((item, idx) => {
                                            const rfqItem = rfq.items.find(i => i.id === item.rfqItemId);
                                            return (
                                                <div key={idx} className="flex justify-between text-xs bg-white/50 dark:bg-black/10 p-2 rounded-lg">
                                                    <span className="font-medium truncate max-w-[60%]">{rfqItem?.itemName || item.rfqItemId}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-green-700">{item.unitPrice.toFixed(3)}</span>
                                                        <Badge variant="outline" className="text-[9px]">{Math.round(item.confidence * 100)}%</Badge>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {analysisResult.notes && <p className="text-[11px] text-amber-600 mt-2">📝 {analysisResult.notes}</p>}
                                    <p className="text-[11px] text-muted-foreground mt-2 font-bold">⚠️ راجع الأسعار أدناه قبل الحفظ — التحليل قد لا يكون دقيقاً 100%</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {analysisError && (
                        <div className="p-4 rounded-xl border-2 bg-red-50/50 border-red-200 dark:bg-red-950/20">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-bold text-sm text-red-700">فشل التحليل</p>
                                    <p className="text-xs text-red-600 mt-1">{analysisError}</p>
                                </div>
                            </div>
                        </div>
                    )}
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
