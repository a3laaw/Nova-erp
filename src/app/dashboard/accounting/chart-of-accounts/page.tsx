'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Account {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  level: number;
}

const chartOfAccounts: Account[] = [
  { code: '1', name: 'الأصول', type: 'asset', level: 0 },
  { code: '11', name: 'الأصول المتداولة', type: 'asset', level: 1 },
  { code: '1101', name: 'النقدية وما يعادلها', type: 'asset', level: 2 },
  { code: '110101', name: 'الصندوق', type: 'asset', level: 3 },
  { code: '110102', name: 'البنوك', type: 'asset', level: 3 },
  { code: '12', name: 'الأصول غير المتداولة', type: 'asset', level: 1 },
  { code: '1201', name: 'الأصول الثابتة', type: 'asset', level: 2 },
  { code: '120101', name: 'الأراضي', type: 'asset', level: 3 },
  { code: '2', name: 'الخصوم', type: 'liability', level: 0 },
  { code: '21', name: 'الخصوم المتداولة', type: 'liability', level: 1 },
  { code: '2101', name: 'الموردون', type: 'liability', level: 2 },
  { code: '3', name: 'حقوق الملكية', type: 'equity', level: 0 },
  { code: '31', name: 'رأس المال', type: 'equity', level: 1 },
  { code: '4', name: 'الإيرادات', type: 'income', level: 0 },
  { code: '41', name: 'إيرادات النشاط الرئيسي', type: 'income', level: 1 },
  { code: '5', name: 'المصروفات', type: 'expense', level: 0 },
  { code: '51', name: 'مصروفات عمومية وإدارية', type: 'expense', level: 1 },
  { code: '5101', name: 'الرواتب والأجور', type: 'expense', level: 2 },
];


const accountTypeTranslations: Record<Account['type'], string> = {
    asset: 'أصل',
    liability: 'خصم',
    equity: 'حقوق ملكية',
    income: 'إيراد',
    expense: 'مصروف',
};

const accountTypeColors: Record<Account['type'], string> = {
    asset: 'bg-blue-100 text-blue-800',
    liability: 'bg-red-100 text-red-800',
    equity: 'bg-purple-100 text-purple-800',
    income: 'bg-green-100 text-green-800',
    expense: 'bg-orange-100 text-orange-800',
};


export default function ChartOfAccountsPage() {
    const router = useRouter();

    return (
        <div className="space-y-6" dir="rtl">
            <Button variant="outline" onClick={() => router.push('/dashboard/accounting')}>
                <ArrowRight className="ml-2 h-4 w-4" />
                العودة إلى المحاسبة
            </Button>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>شجرة الحسابات</CardTitle>
                            <CardDescription>
                            عرض وإدارة دليل الحسابات الخاص بالشركة.
                            </CardDescription>
                        </div>
                        <Button>
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إضافة حساب جديد
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-1/4">رقم الحساب</TableHead>
                                    <TableHead className="w-1/2">اسم الحساب</TableHead>
                                    <TableHead>نوع الحساب</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {chartOfAccounts.map((account) => (
                                    <TableRow key={account.code} className={account.level === 0 ? 'bg-muted/50' : ''}>
                                        <TableCell className="font-mono" style={{ paddingRight: `${account.level * 1.5 + 1}rem` }}>
                                            {account.code}
                                        </TableCell>
                                        <TableCell className="font-medium" style={{ paddingRight: `${account.level * 1.5 + 1}rem` }}>
                                            {account.name}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={accountTypeColors[account.type]}>
                                                {accountTypeTranslations[account.type]}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
