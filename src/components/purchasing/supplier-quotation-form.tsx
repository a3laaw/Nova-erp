'use client';

import { useState, useEffect } from 'react';
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
import { Loader2, Save, Sparkles, FileUp, FileText as FileTextIcon, X, CheckCircle2, Table as TableIcon } from 'lucide-react';
import type { Vendor, RequestForQuotation, SupplierQuotation } from '@/lib/types';
import { DateInput } from '../ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { cn, formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { analyzeSupplierQuote, type AnalyzeQuoteOutput } from '@/ai/flows/analyze-supplier-quote';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

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
  confidence?: number;
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
  const [analysisResult, setAnalysisResult] = useState<AnalyzeQuoteOutput | null>(null);

  useEffect(() => {
    if (isOpen) {
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
        setItems(rfq.items.map((item) => ({ rfqItemId: item.id!, itemName: item.itemName, unitPrice: '' })));
      }
      setSelectedFile(null);
      setAnalysisResult(null);
    }
  }, [isOpen, rfq, existingQuote]);

  const handleItemPriceChange = (rfqItemId: string, price: string) => {
    setItems((prev) =>
      prev.map((item) => (item.rfqItemId === rfqItemId ? { ...item, unitPrice: price } : item))
    );
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        setSelectedFile(file);
        setAnalysisResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    
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
            setItems(prev => prev.map(item => {
                const extracted = result.extractedPrices.find(ep => ep.rfqItemId === item.rfqItemId);
                if (extracted) {
                    return { ...item, unitPrice: extracted.unitPrice, confidence: extracted.confidence };
                }
                return item;
            }));
            toast({ title: 'نجاح التحليل', description: `تم استخراج ${result.extractedPrices.length} سعر من المستند.` });
        } else {
            toast({ variant: 'default', title: 'تنبيه', description: 'لم يتم العثور على مبالغ واضحة في المستند.' });
        }
    } catch (error: any) {
        console.error(error);
        toast({ variant: 'destructive', title: 'فشل التحليل', description: error.message });
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
        .map((item) => ({ rfqItemId: item.rfqItemId, unitPrice: Number(item.unitPrice) }));

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
      toast({ title: 'نجاح', description: 'تم حفظ عرض السعر بنجاح.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl" dir="rtl">
        <DialogHeader className="p-6 bg-muted/20 border-b">
          <DialogTitle className="text-xl font-black">إدخال عرض سعر المورد: {vendor.name}</DialogTitle>
          <DialogDescription>طلب تسعير رقم: {rfq.rfqNumber}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-8">
            {/* AI OCR Section */}
            <div className="bg-primary/5 border-2 border-dashed border-primary/20 p-6 rounded-3xl space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary"><Sparkles className="h-5 w-5" /></div>
                    <h4 className="font-black text-lg">تحليل ذكي للمستند (OCR)</h4>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4">
                    {!selectedFile ? (
                        <label className="flex-grow flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-primary/10 transition-all">
                            <FileUp className="h-8 w-8 mb-2 text-muted-foreground" />
                            <p className="text-sm font-bold text-muted-foreground">ارفع عرض السعر (PDF أو صورة)</p>
                            <input type="file" accept="application/pdf,image/*" onChange={handleFileChange} className="hidden" />
                        </label>
                    ) : (
                        <div className="flex-grow flex items-center justify-between p-4 bg-background rounded-2xl border-2 border-primary/20 shadow-sm">
                            <div className="flex items-center gap-3">
                                <FileTextIcon className="h-8 w-8 text-primary" />
                                <div>
                                    <p className="text-sm font-black truncate max-w-[200px]">{selectedFile.name}</p>
                                    <p className="text-[10px] text-muted-foreground">جاهز للتحليل</p>
                                </div>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedFile(null)} className="rounded-full"><X className="h-4 w-4" /></Button>
                        </div>
                    )}
                    
                    <Button 
                        type="button" 
                        onClick={handleAnalyze} 
                        disabled={!selectedFile || isAnalyzing} 
                        className="h-14 px-8 rounded-2xl font-black gap-2 shadow-lg shadow-primary/20"
                    >
                        {isAnalyzing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                        {isAnalyzing ? 'جاري التحليل...' : 'بدء التحليل التلقائي'}
                    </Button>
                </div>
                
                {analysisResult && (
                    <Alert className="bg-green-50 border-green-200">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-green-800 font-bold">تم الاستخراج بنجاح</AlertTitle>
                        <AlertDescription className="text-green-700 text-xs">
                            تم العثور على {analysisResult.extractedPrices.length} صنف. يرجى مراجعة الأسعار في الجدول أدناه قبل الحفظ.
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            {/* Manual Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-2xl border">
              <div className="grid gap-2">
                <Label className="font-bold pr-2">مرجع المورد</Label>
                <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="رقم عرض المورد..." className="rounded-xl h-10" />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold pr-2">تاريخ العرض</Label>
                <DateInput value={date} onChange={setDate} className="h-10" />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold pr-2">مدة التوريد (أيام)</Label>
                <Input type="number" value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} placeholder="0" className="h-10" />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold pr-2">شروط الدفع</Label>
                <Input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="مثال: نقداً..." className="h-10" />
              </div>
            </div>

            {/* Prices Table */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TableIcon className="h-5 w-5 text-muted-foreground" />
                <Label className="text-lg font-black">جدول مراجعة الأسعار</Label>
              </div>
              
              <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm bg-card">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow className="h-14 border-b-2">
                            <TableHead className="px-6 font-bold text-base">اسم الصنف المطلوب</TableHead>
                            <TableHead className="w-48 text-center font-bold text-base">سعر الوحدة (د.ك)</TableHead>
                            <TableHead className="w-32 text-center font-bold text-base">دقة الذكاء</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item) => (
                            <TableRow key={item.rfqItemId} className="h-16 hover:bg-muted/5 transition-colors border-b last:border-0 group">
                                <TableCell className="px-6 font-bold text-foreground/80">{item.itemName}</TableCell>
                                <TableCell className="px-4">
                                    <Input 
                                        type="number" 
                                        step="0.001" 
                                        value={item.unitPrice} 
                                        onChange={e => handleItemPriceChange(item.rfqItemId, e.target.value)} 
                                        className="h-11 text-center font-black font-mono text-xl text-primary border-2 border-transparent group-hover:border-muted transition-all bg-muted/10 rounded-xl"
                                        placeholder="0.000"
                                    />
                                </TableCell>
                                <TableCell className="text-center">
                                    {item.confidence != null ? (
                                        <Badge variant={item.confidence > 0.8 ? 'default' : 'secondary'} className="font-mono text-[10px]">
                                            {(item.confidence * 100).toFixed(0)}%
                                        </Badge>
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground italic">-</span>
                                    )}
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
          <Button variant="ghost" onClick={onClose} disabled={isSaving} className="font-bold">إلغاء</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSaving || items.every(i => !i.unitPrice)}
            className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/20 min-w-[180px]"
          >
            {isSaving ? <Loader2 className="animate-spin h-5 w-5 ml-3" /> : <Save className="h-5 w-5 ml-3" />}
            {isSaving ? 'جاري الحفظ...' : 'اعتماد وحفظ العرض'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}