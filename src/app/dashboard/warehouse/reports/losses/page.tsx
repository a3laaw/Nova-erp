'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy, where } from 'firebase/firestore';
import type { InventoryAdjustment, Warehouse, Employee } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Trash2, Search, Warehouse as HouseIcon, UserCheck, ShieldAlert, Ban } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

/**
 * تقرير التوالف والخسائر المطور (v2.0):
 * - تحليل الأسباب (تلف، فقد، سرقة).
 * - ربط الخسارة بالموظف المسؤول.
 * - توزيع الخسائر حسب الموقع.
 */
export default function InventoryLossReportPage() {
    const { firestore } = useFirebase();
    const [searchQuery, setSearchQuery] = useState('');

    const lossQuery = useMemo(() => [
        where('type', 'in', ['damage', 'theft', 'other']),
        orderBy('date', 'desc')
    ], []);
    
    const { data: adjustments = [], loading } = useSubscription<InventoryAdjustment>(firestore, 'inventoryAdjustments', lossQuery);
    const { data: warehouses = [] } = useSubscription<Warehouse>(firestore, 'warehouses');
    const { data: employees = [] } = useSubscription<Employee>(firestore, 'employees');
    
    const warehouseMap = useMemo(() => new Map(warehouses.map(w => [w.id, w.name])), [warehouses]);
    const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, e.fullName])), [employees]);

    const reportData = useMemo(() => {
        const queryLower = searchQuery.toLowerCase();
        return adjustments.filter(adj => 
            adj.adjustmentNumber.toLowerCase().includes(queryLower) ||
            adj.notes?.toLowerCase().includes(queryLower)
        ).map(adj => {
            const adjTotal = adj.items?.reduce((s, i) => s + (i.totalCost || 0), 0) || 0;
            return { ...adj, adjTotal };
        });
    }, [adjustments, searchQuery]);

    const causeStats = useMemo(() => {
        const stats = { damage: 0, theft: 0, other: 0 };
        reportData.forEach(adj => {
            if (adj.type === 'damage') stats.damage += adj.adjTotal;
            else if (adj.type === 'theft') stats.theft += adj.adjTotal;
            else stats.other += adj.adjTotal;
        });
        return [
            { name: 'تلف مواد', value: stats.damage, color: '#f97316' },
            { name: 'فقد / سرقة', value: stats.theft, color: '#ef4444' },
            { name: 'أسباب أخرى', value: stats.other, color: '#64748b' }
        ].filter(d => d.value > 0);
    }, [reportData]);

    const totals = useMemo(() => {
        const totalValue = reportData.reduce((sum, adj) => sum + adj.adjTotal, 0);
        return { totalValue, count: reportData.length };
    }, [reportData]);

    if (loading) return <div className="p-8 space-y-4"><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-96 w-full rounded-2xl" /></div>;

    return (
        <div className="space-y-6" dir="rtl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-2xl border-none shadow-sm bg-red-50 p-6 flex flex-col justify-between">
                    <div>
                        <Label className="text-[10px] font-black text-red-700 uppercase mb-1 block">إجمالي قيمة الخسائر</Label>
                        <p className="text-3xl font-black text-red-800 font-mono">{formatCurrency(totals.totalValue)}</p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-300 self-end" />
                </Card>

                <Card className="md:col-span-2 rounded-2xl border-none shadow-sm bg-white p-4 flex items-center justify-between">
                    <div className="flex-1 h-32">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={causeStats} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={5} dataKey="value">
                                    {causeStats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                </Pie>
                                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-2 pr-4 border-r">
                        {causeStats.map(s => (
                            <div key={s.name} className="flex items-center gap-2 text-[10px] font-bold">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                                <span>{s.name}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card className="rounded-2xl border-none shadow-sm p-6 flex flex-col justify-between items-end">
                    <div className="relative w-full">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="بحث برقم الإذن..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 rounded-xl border-2 h-10" />
                    </div>
                    <Badge variant="outline" className="mt-2 font-black text-red-600 bg-red-50">تحليل العجز والمسؤولية</Badge>
                </Card>
            </div>

            <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-card">
                <CardHeader className="bg-red-500/5 border-b pb-6 px-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-xl text-red-600 shadow-inner">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-black text-red-900">سجل التوالف والمسؤولية الإدارية</CardTitle>
                            <CardDescription>كشف تفصيلي يربط كل خسارة مخزنية بالمسؤول عنها وسبب حدوثها.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="h-14">
                                <TableHead className="px-8 font-black text-slate-900">رقم الإذن والمسؤول</TableHead>
                                <TableHead className="font-black text-slate-900">التاريخ</TableHead>
                                <TableHead className="font-black text-slate-900">الموقع / المستودع</TableHead>
                                <TableHead className="font-black text-slate-900">تصنيف السبب</TableHead>
                                <TableHead className="text-left px-8 font-black text-slate-900">قيمة الهالك</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic font-bold">لا توجد سجلات خسارة مسجلة.</TableCell></TableRow>
                            ) : (
                                reportData.map((adj) => (
                                    <TableRow key={adj.id} className="h-20 hover:bg-red-50/20 transition-colors border-b last:border-0 group">
                                        <TableCell className="px-8">
                                            <p className="font-mono font-black text-red-700">{adj.adjustmentNumber}</p>
                                            <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold text-slate-600">
                                                <UserCheck className="h-3 w-3 opacity-40" />
                                                <span>بواسطة: {employeeMap.get(adj.createdBy!) || 'النظام'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold text-muted-foreground">
                                            {toFirestoreDate(adj.date) ? format(toFirestoreDate(adj.date)!, 'dd/MM/yyyy') : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                                    <HouseIcon className="h-3 w-3 text-muted-foreground" />
                                                    {warehouseMap.get(adj.warehouseId!) || 'غير معروف'}
                                                </div>
                                                {adj.projectId && <Badge variant="outline" className="text-[8px] h-4 py-0 w-fit">موقع مشروع</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn(
                                                "font-black px-4 py-1 rounded-full border-2",
                                                adj.type === 'theft' ? "bg-red-600 text-white border-none" : "bg-orange-50 text-orange-700 border-orange-200"
                                            )}>
                                                {typeTranslations[adj.type] || adj.type}
                                            </Badge>
                                            <p className="text-[10px] mt-2 italic text-muted-foreground truncate max-w-[200px]">{adj.notes}</p>
                                        </TableCell>
                                        <TableCell className="text-left font-mono font-black text-2xl px-8 text-red-600">
                                            {formatCurrency(adj.adjTotal)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        <TableFooter className="bg-red-50/50 h-24">
                            <TableRow className="border-t-4 border-red-200">
                                <TableCell colSpan={4} className="text-right px-12 font-black text-2xl text-red-900">إجمالي الهدر المالي الموثق:</TableCell>
                                <TableCell className="text-left font-mono text-3xl font-black text-red-700 px-8">
                                    {formatCurrency(totals.totalValue)}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
