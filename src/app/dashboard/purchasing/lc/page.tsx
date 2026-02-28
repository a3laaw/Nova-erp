
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Landmark, PlusCircle, History, BadgeInfo, Building2, Wallet } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function LcManagementPage() {
    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-3xl border-none shadow-sm bg-gradient-to-l from-white to-blue-50">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black flex items-center gap-3">
                                <Landmark className="text-blue-700 h-7 w-7" />
                                الاعتمادات المستندية (Letters of Credit)
                            </CardTitle>
                            <CardDescription>تتبع خطابات الاعتماد البنكية المفتوحة للمشتريات الخارجية والموردين الدوليين.</CardDescription>
                        </div>
                        <Button className="h-11 px-6 rounded-xl font-bold gap-2 bg-blue-700 hover:bg-blue-800 shadow-lg shadow-blue-100">
                            <PlusCircle className="h-5 w-5" /> فتح اعتماد جديد
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="rounded-2xl p-6 bg-white shadow-sm border-none">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground mb-2 block">إجمالي الاعتمادات المفتوحة</Label>
                    <p className="text-3xl font-black font-mono text-blue-700">0.000 <span className="text-xs">KD</span></p>
                </Card>
                <Card className="rounded-2xl p-6 bg-white shadow-sm border-none">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground mb-2 block">عدد العمليات النشطة</Label>
                    <p className="text-3xl font-black font-mono">0</p>
                </Card>
                <Card className="rounded-2xl p-6 bg-white shadow-sm border-none">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground mb-2 block">البنوك المصدرة</Label>
                    <p className="text-3xl font-black font-mono">0</p>
                </Card>
            </div>

            <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead>رقم الاعتماد</TableHead>
                            <TableHead>البنك المصدر</TableHead>
                            <TableHead>المورد</TableHead>
                            <TableHead>تاريخ الصلاحية</TableHead>
                            <TableHead className="text-left">القيمة</TableHead>
                            <TableHead>الحالة</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">
                                <div className="flex flex-col items-center gap-3 opacity-30">
                                    <History className="h-12 w-12" />
                                    <p className="text-lg font-bold">لا توجد اعتمادات مستندية نشطة حالياً.</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
