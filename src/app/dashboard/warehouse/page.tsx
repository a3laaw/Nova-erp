
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { inventory } from '@/lib/data';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/context/language-context';

export default function WarehousePage() {
  const { language } = useLanguage();
  const t = (language === 'ar') ?
    { title: 'المستودع والمخزون', description: 'تتبع مستويات مخزون جميع مواد البناء.', add: 'إضافة مادة', material: 'المادة', supplier: 'المورد', stock: 'مستوى المخزون', quantity: 'الكمية', lowStock: 'مخزون منخفض' } :
    { title: 'Warehouse & Inventory', description: 'Track stock levels of all construction materials.', add: 'Add Material', material: 'Material', supplier: 'Supplier', stock: 'Stock Level', quantity: 'Quantity', lowStock: 'Low Stock' };

  return (
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>{t.title}</CardTitle>
                <CardDescription>
                    {t.description}
                </CardDescription>
            </div>
            <Button asChild size="sm" className="gap-1">
                <Link href="#">
                    <PlusCircle className="h-4 w-4" />
                    {t.add}
                </Link>
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.material}</TableHead>
              <TableHead>{t.supplier}</TableHead>
              <TableHead className="w-[300px]">{t.stock}</TableHead>
              <TableHead className="text-right">{t.quantity}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventory.map((item) => {
              const stockPercentage = (item.quantity / (item.lowStockThreshold * 2)) * 100;
              const isLowStock = item.quantity <= item.lowStockThreshold;

              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name[language]}</TableCell>
                  <TableCell>{item.supplier[language]}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        <Progress value={stockPercentage} className="h-2" />
                        {isLowStock && <Badge variant="destructive">{t.lowStock}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {item.quantity} {item.unit[language]}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
