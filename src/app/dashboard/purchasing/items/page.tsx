'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ItemsList } from '@/components/purchasing/items-list';

export default function ItemsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>إدارة الأصناف</CardTitle>
                <CardDescription>
                    إضافة وتعديل جميع أصناف المنتجات والخدمات والمواد الخام في النظام.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ItemsList />
            </CardContent>
        </Card>
    )
}
