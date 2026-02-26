
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
            <Card>
                <CardHeader className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-black flex items-center gap-3 text-foreground">
                            <Building2 className="text-primary h-7 w-7" />
                            إدارة المستودعات والأفرع
                        </CardTitle>
                        <CardDescription>تعريف أماكن التخزين الرئيسية، الأفرع، ومخازن المواقع التابعة للمشاريع.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => router.back()}>
                            <ArrowRight className="ml-2 h-4 w-4" /> العودة
                        </Button>
                        <Button onClick={handleAdd} className="font-bold gap-2">
                            <PlusCircle className="h-4 w-4" /> إضافة مستودع/فرع
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
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
