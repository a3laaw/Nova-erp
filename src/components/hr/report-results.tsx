
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import type { StandardReportData } from '@/services/report-generator';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';


const statusColors: Record<string, string> = {
    'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'approved': 'bg-green-100 text-green-800 border-green-200',
    'rejected': 'bg-red-100 text-red-800 border-red-200',
    'active': 'bg-green-100 text-green-800 border-green-200',
    'on-leave': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'terminated': 'bg-red-100 text-red-800 border-red-200',
};

const statusTranslations: Record<string, string> = {
    'pending': 'معلقة',
    'approved': 'مقبولة',
    'rejected': 'مرفوضة',
    'Annual': 'سنوية',
    'Sick': 'مرضية',
    'Emergency': 'طارئة',
    'Unpaid': 'بدون راتب',
    'active': 'نشط',
    'on-leave': 'في إجازة',
    'terminated': 'منتهية خدمته',
};


const formatValue = (value: any, type?: 'date' | 'currency' | 'number' | 'component'): string | React.ReactNode => {    
    if (value === null || value === undefined || value === '') return '-';

    if (type === 'date') {
        try {
            const d = value.toDate ? value.toDate() : new Date(value);
            if (isNaN(d.getTime())) return String(value) || '-';
            return new Intl.DateTimeFormat('ar-KW', { day: '2-digit', month: '2-digit', year: 'numeric', numberingSystem: 'latn' }).format(d);
        } catch (e) {
            return String(value) || '-';
        }
    }
    if (type === 'currency') {
        return formatCurrency(Number(value) || 0);
    }

    if(statusTranslations[value]) {
         return <Badge variant="outline" className={cn(statusColors[value] || 'bg-gray-100')}>{statusTranslations[value]}</Badge>;
    }
    
    return String(value);
};


export function ReportResults({ reportData }: { reportData: StandardReportData }) {

    const handlePrint = () => {
        window.print();
    };
    
    return (
        <div className="border rounded-lg" id="report-content">
            <div className='p-4 flex justify-between items-center print:p-0 print:mb-4'>
                <div>
                    <h3 className='font-bold text-lg'>{reportData.title}</h3>
                    <p className='text-sm text-muted-foreground' dir='ltr'>{reportData.subtitle}</p>
                </div>
                <Button variant="outline" onClick={handlePrint} className="print:hidden">
                    <Printer className="ml-2 h-4 w-4" />
                    طباعة
                </Button>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        {reportData.headers.map((header) => (
                            <TableHead key={header.key}>{header.label}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {reportData.rows.map((row, rowIndex) => (
                        <TableRow key={rowIndex} className={row.alerts ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                            {reportData.headers.map((header) => (
                                <TableCell key={`${rowIndex}-${header.key}`} className="font-medium">
                                    {formatValue(row[header.key], header.type)}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
                 {reportData.footer && (
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={reportData.footer.colSpan} className="font-bold">
                                {reportData.footer.label}
                            </TableCell>
                            <TableCell className="font-bold text-left" colSpan={reportData.headers.length - reportData.footer.colSpan}>
                                {formatValue(reportData.footer.value, reportData.footer.type)}
                            </TableCell>
                        </TableRow>
                    </TableFooter>
                )}
            </Table>
            {reportData.rows.length === 0 && (
                 <div className="text-center p-12 text-muted-foreground">
                    لا توجد بيانات لعرضها في هذا التقرير.
                </div>
            )}
        </div>
    );
};

    