'use client';
import { useState } from 'react';
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
import { Package, LayoutGrid } from 'lucide-react';

export default function ItemsPage() {
    const { firestore } = useFirebase();
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    const { data: categories, loading: categoriesLoading } = useSubscription<ItemCategory>(firestore, 'itemCategories');

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-blue-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-600 shadow-inner">
                            <Package className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black">دليل الأصناف والخدمات</CardTitle>
                            <CardDescription className="text-base font-medium">إدارة قائمة المواد المخزنية والخدمات الفنية وتصنيفاتها.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="pt-8">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        <div className="lg:col-span-1 space-y-4">
                            <div className="flex items-center gap-2 px-2">
                                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                                <h3 className="font-black text-sm">شجرة التصنيفات</h3>
                            </div>
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
        </div>
    )
}
