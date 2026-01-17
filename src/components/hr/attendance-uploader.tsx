'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, File, Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { processAttendanceData } from '@/services/attendance-processor';

interface ExcelRow {
  'الرقم المدني': string;
  'التاريخ (YYYY-MM-DD)': string;
  'وقت الدخول (HH:MM)': string;
  'وقت الخروج (HH:MM)': string;
}

export function AttendanceUploader() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedData, setParsedData] = useState<ExcelRow[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (
        selectedFile.type === 'application/vnd.ms-excel' ||
        selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        setFile(selectedFile);
        handleParseFile(selectedFile);
      } else {
        toast({
          variant: 'destructive',
          title: 'ملف غير صالح',
          description: 'الرجاء رفع ملف Excel بصيغة .xls أو .xlsx',
        });
      }
    }
  };

  const handleParseFile = (fileToParse: File) => {
    setIsParsing(true);
    setParsedData([]);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);
        
        // Validate headers
        const headers = Object.keys(json[0] || {});
        const requiredHeaders = ['الرقم المدني', 'التاريخ (YYYY-MM-DD)', 'وقت الدخول (HH:MM)', 'وقت الخروج (HH:MM)'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
            toast({
                variant: 'destructive',
                title: 'أعمدة ناقصة',
                description: `الملف لا يحتوي على الأعمدة المطلوبة: ${missingHeaders.join(', ')}`,
            });
            setFile(null);
            return;
        }

        setParsedData(json);
        toast({ title: 'نجاح', description: `تمت قراءة ${json.length} سجل بنجاح.` });
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'خطأ في القراءة', description: 'لم نتمكن من قراءة ملف Excel. تأكد من سلامته.' });
        setFile(null);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsBinaryString(fileToParse);
  };
  
  const handleSave = async () => {
    if (parsedData.length === 0) {
        toast({ variant: 'destructive', title: 'لا توجد بيانات', description: 'لا توجد بيانات للحفظ. الرجاء رفع ملف أولاً.' });
        return;
    }
    setIsSaving(true);
    try {
        const result = await processAttendanceData(parsedData);
        toast({
            title: 'تم الحفظ بنجاح',
            description: `تمت معالجة وحفظ ${result.processedRecords} سجل لـ ${result.affectedEmployees} موظف.`
        });
        // Reset state after successful save
        setFile(null);
        setParsedData([]);
    } catch(error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع.';
        toast({ variant: 'destructive', title: 'فشل الحفظ', description: errorMessage });
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>رفع سجلات الحضور</CardTitle>
        <CardDescription>
          ارفع ملف Excel يحتوي على سجلات الحضور والانصراف اليومية للموظفين.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
          <File className="mx-auto h-12 w-12 text-muted-foreground" />
          <Label htmlFor="attendance-file" className="block text-sm font-medium text-primary cursor-pointer hover:underline">
            {isParsing ? 'جاري قراءة الملف...' : (file ? `الملف المحدد: ${file.name}` : 'اختر ملف Excel (.xlsx, .xls)')}
          </Label>
          <Input id="attendance-file" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx, .xls" disabled={isParsing || isSaving} />
          <p className="text-xs text-muted-foreground">تأكد من أن الملف يحتوي على الأعمدة: الرقم المدني، التاريخ، وقت الدخول، وقت الخروج.</p>
        </div>

        {parsedData.length > 0 && (
          <div className='space-y-4'>
             <h3 className="font-semibold">معاينة البيانات (أول 5 صفوف)</h3>
             <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {Object.keys(parsedData[0]).map(key => <TableHead key={key}>{key}</TableHead>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {parsedData.slice(0, 5).map((row, i) => (
                            <TableRow key={i}>
                                {Object.values(row).map((val, j) => <TableCell key={j}>{String(val)}</TableCell>)}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </div>
             <p className='text-sm text-muted-foreground text-center'>... و {Math.max(0, parsedData.length - 5)} صفوف أخرى.</p>

             <div className='flex justify-end'>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    <Save className="ml-2 h-4 w-4" />
                    حفظ البيانات في قاعدة البيانات
                </Button>
             </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
