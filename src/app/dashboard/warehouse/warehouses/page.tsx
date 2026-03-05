
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Building2, ArrowRight } from 'lucide-react';
import { WarehouseList } from '@/components/warehouse/warehouse-list';
import { WarehouseForm } from '@/components/warehouse/warehouse-form';
import { useRouter } from 'next/navigation';

export default function WarehousesPage() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
    const router = useRouter();

    const handleEdit = (warehouse: any) => {
        setSelectedWarehouse(warehouse);
        setIsFormOpen(true);
    };

    const handleAdd = () => {
        setSelectedWarehouse(null);
        setIsFormOpen(true);
    };

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-indigo-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-600/10 rounded-2xl text-indigo-600 shadow-inner">
                                <Building2 className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black">إدارة المستودعات والأفرع</CardTitle>
                                <CardDescription className="text-base font-medium">تعريف أماكن التخزين، الأفرع، ومخازن المواقع التابعة للمشاريع.</CardDescription>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => router.back()} className="rounded-xl font-bold">
                                <ArrowRight className="ml-2 h-4 w-4" /> العودة
                            </Button>
                            <Button onClick={handleAdd} className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-indigo-100">
                                <PlusCircle className="h-5 w-5" /> إضافة مستودع جديد
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="pt-8">
                    <WarehouseList onEdit={handleEdit} />
                </CardContent>
            </Card>

            {isFormOpen && (
                <WarehouseForm 
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    warehouse={selectedWarehouse}
                />
            )}
        </div>
    );
}
