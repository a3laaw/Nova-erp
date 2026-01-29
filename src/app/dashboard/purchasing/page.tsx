'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, ShoppingCart } from 'lucide-react';
import Link from 'next/link';

export default function PurchasingPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>إدارة المشتريات</CardTitle>
                        <CardDescription>إنشاء وتتبع أوامر الشراء للموردين.</CardDescription>
                    </div>
                    <Button asChild size="sm">
                        <Link href="/dashboard/purchasing/new">
                            <PlusCircle className="ml-2 h-4 w-4" />
                            أمر شراء جديد
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">لا توجد أوامر شراء بعد</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        انقر على "أمر شراء جديد" للبدء.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
