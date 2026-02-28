
'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy, where } from 'firebase/firestore';
import type { InventoryAdjustment, Client, ConstructionProject } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Search, Calendar, User, Target, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isPast, isFuture, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Input } from '@/components/ui/input';

export default function WarrantyReportPage() {
    const { firestore } = useFirebase();
    const [searchQuery, setSearchQuery] = useState('');

    // جلب كافة عمليات الصرف (مواقع ومبيعات) لأنها المصدر الرئيسي للكفالات
    const issueQuery = useMemo(() => [where('type', '==', 'material_issue')], []);
    const { data: issues = [], loading: issuesLoading } = useSubscription<InventoryAdjustment>(firestore, 'inventoryAdjustments', issueQuery);

    const reportData = useMemo(() => {
        if (issuesLoading) return [];

        const results: any[] = [];
        const now = new Date();

        issues.forEach(issue => {
            issue.items.forEach(line => {
                if (line.warrantyEndDate) {
                    const endDate = toFirestoreDate(line.warrantyEndDate);
                    if (endDate) {
                        results.push({
                            id: `${issue.id}-${line.itemId}`,
                            itemName: line.itemName,
                            clientName: issue.clientName || 'غير محدد',
                            projectName: issue.projectName || 'مبيعات معرض',
                            issueDate: toFirestoreDate(issue.date),
                            expiryDate: endDate,
                            status: isFuture(endDate) ? 'active' : 'expired',
                            daysLeft: differenceInDays(endDate, now),
                            reference: issue.adjustmentNumber
                        });
                    }
                }
            });
        });

        const queryLower = searchQuery.toLowerCase();
        return results.filter(r => 
            r.itemName.toLowerCase().includes(queryLower) || 
            r.clientName.toLowerCase().includes(queryLower) ||
            r.projectName.toLowerCase().includes(queryLower)
        ).sort((a, b) => b.expiryDate.getTime() - a.expiryDate.getTime());

    }, [issues, issuesLoading, searchQuery]);

    if (issuesLoading) return <div className="p-8 space-y-4"><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-96 w-full rounded-2xl" /></div>;

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card">
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black flex items-center gap-3 text-foreground">
                                <ShieldCheck className="text-primary h-7 w-7" />
                                سجل الكفالات النشطة
                            </CardTitle>
                            <CardDescription>متابعة فترات الضمان للأصناف المصروفة للمشاريع أو المباعة للعملاء.</CardDescription>
                        </div>
                        <div className="w-full max-w-md bg-white p-1 rounded-2xl border shadow-inner">
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="ابحث بالصنف، العميل، أو المشروع..." 
                                    value={searchQuery} 
                                    onChange={e => setSearchQuery(e.target.value)} 
                                    className="border-none shadow-none focus-visible:ring-0 text-sm pr-10"
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden bg-card">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="h-14">
                                <TableHead className="px-6 font-bold text-base">الصنف</TableHead>
                                <TableHead className="font-bold text-base">العميل / المشروع</TableHead>
                                <TableHead className="text-center font-bold">تاريخ البدء</TableHead>
                                <TableHead className="text-center font-bold">تاريخ الانتهاء</TableHead>
                                <TableHead className="text-center font-bold">الحالة</TableHead>
                                <TableHead className="text-center">المتبقي</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                        <Clock className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                        <p>لا توجد بيانات كفالات مسجلة حالياً.</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reportData.map((item) => (
                                    <TableRow key={item.id} className="h-16 hover:bg-muted/5 transition-colors border-b last:border-0">
                                        <TableCell className="px-6">
                                            <p className="font-black text-foreground">{item.itemName}</p>
                                            <p className="text-[10px] text-muted-foreground font-mono">مرجع: {item.reference}</p>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1.5 text-sm font-bold">
                                                    <User className="h-3 w-3 text-muted-foreground" /> {item.clientName}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                                                    <Target className="h-2.5 w-2.5" /> {item.projectName}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-mono text-xs opacity-70">
                                            {item.issueDate ? format(item.issueDate, 'dd/MM/yyyy') : '-'}
                                        </TableCell>
                                        <TableCell className="text-center font-black font-mono text-primary">
                                            {format(item.expiryDate, 'dd/MM/yyyy')}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={cn(
                                                "px-3 font-bold",
                                                item.status === 'active' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                                            )}>
                                                {item.status === 'active' ? 'سارية' : 'منتهية'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center font-bold">
                                            {item.status === 'active' ? (
                                                <span className="text-primary text-xs">{item.daysLeft} يوم</span>
                                            ) : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
