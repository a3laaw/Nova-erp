
'use client';
import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ItemsList } from '@/components/warehouse/items-list';
import { useFirebase, useSubscription } from '@/firebase';
import type { ItemCategory } from '@/lib/types';
import { ItemCategoryTree } from '@/components/warehouse/item-category-tree';


export default function ItemsPage() {
    const { firestore } = useFirebase();
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    const { data: categories, loading: categoriesLoading } = useSubscription<ItemCategory>(firestore, 'itemCategories');

    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>إدارة الأصناف</CardTitle>
                <CardDescription>
                    تصفح الأصناف حسب الفئة، أو أضف وعدّل الأصناف الموجودة.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-1">
                        <h3 className="font-semibold mb-2">الفئات</h3>
                        <ItemCategoryTree 
                            categories={categories || []}
                            loading={categoriesLoading}
                            selectedCategoryId={selectedCategoryId}
                            onSelectCategory={setSelectedCategoryId}
                        />
                    </div>
                    <div className="lg:col-span-3">
                         <ItemsList selectedCategoryId={selectedCategoryId} />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
