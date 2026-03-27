'use client';

import React, { useRef, useState } from 'react';
import { PrintHeader } from './print-header';
import { PrintFooter } from './print-footer';
import { usePrintSettings } from '@/hooks/use-print-settings';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { FileDown, Loader2, Printer, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PrintLayoutProps {
  children: React.ReactNode;
  documentName?: string;
  className?: string;
}

/**
 * مكون غلاف الطباعة (Universal Print Layout):
 * يلف أي محتوى ويحقن الهيدر والفوتر السياديين مع معالجة التصدير لـ PDF.
 */
export function PrintLayout({ 
  children, 
  documentName = "Document",
  className 
}: PrintLayoutProps) {
  const { branding, loading } = usePrintSettings();
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      
      const opt = {
        margin: [5, 5, 5, 5], 
        filename: `${documentName}_${new Date().getTime()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          scrollY: 0,
          windowWidth: 800 
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().from(printRef.current).set(opt).save();
    } catch (error) {
      console.error("PDF Export Error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleNativePrint = () => {
    window.print();
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-[500px] w-full rounded-2xl" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* شريط أدوات الطباعة - يختفي عند الطباعة الفعلية */}
      <div className="no-print sticky top-4 z-50 flex justify-between items-center bg-white/80 backdrop-blur-xl p-4 rounded-3xl border shadow-2xl max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Printer className="h-5 w-5" />
            </div>
            <div>
                <p className="font-black text-sm text-[#1e1b4b]">مركز الوثائق الرسمي</p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Print & PDF Engine</p>
            </div>
        </div>
        
        <div className="flex gap-2">
            <Button 
                variant="outline" 
                onClick={handleNativePrint}
                className="rounded-xl font-bold h-10 gap-2 border-2"
            >
                <Eye className="h-4 w-4" /> معاينة المتصفح
            </Button>
            <Button 
                onClick={handleExportPDF} 
                disabled={isExporting}
                className="rounded-xl font-black h-10 px-8 gap-2 shadow-lg shadow-primary/20"
            >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                حفظ كـ PDF
            </Button>
        </div>
      </div>

      {/* منطقة الطباعة الفعلية (A4 Canvas) */}
      <div className={cn("max-w-[210mm] mx-auto overflow-hidden", className)}>
        <div 
          ref={printRef}
          className="bg-white text-black shadow-2xl print:shadow-none min-h-[297mm] flex flex-col"
          style={{
            width: '210mm',
            padding: '10mm',
            boxSizing: 'border-box'
          }}
        >
          <PrintHeader branding={branding} />
          
          <div className="flex-grow py-4" dir="rtl">
            {children}
          </div>

          <PrintFooter branding={branding} />
        </div>
      </div>
    </div>
  );
}
