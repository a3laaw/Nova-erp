'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from './stat-card';
import { 
    HardHat, MapPin, ClipboardList, Construction, 
    ArrowRight, Box, Target, Clock, Activity, Users, PlusCircle, ShoppingCart
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * لوحة تحكم المهندس (Site View):
 * تم تحصين العرض لضمان دقة الأرقام وبساطة المسميات.
 */
export function SiteDashboard({ data, user }: any) {
    return (
        <div className="space-y-10 animate-in fade-in duration-1000">
            <div className="grid gap-6 md:grid-cols-3">
                <StatCard 
                    title="المشاريع قيد التنفيذ" 
                    value={(data.projects || []).length} 
                    icon={<Construction className="h-5 w-5" />} 
                    colorClass="bg-blue-100 text-blue-700" 
                    isCurrency={false}
                />
                <StatCard 
                    title="زيارات الموقع اليوم" 
                    value={(data.appointments || []).filter((a:any) => a.type === 'room').length} 
                    icon={<MapPin className="h-5 w-5" />} 
                    colorClass="bg-orange-100 text-[#FF7A00]" 
                    isCurrency={false}
                />
                <StatCard 
                    title="طلبات شراء معلقة" 
                    value={(data.rfqs || []).filter((r:any) => r.status === 'sent').length} 
                    icon={<ShoppingCart className="h-5 w-5" />} 
                    colorClass="bg-purple-100 text-purple-700" 
                    isCurrency={false}
                />
            </div>

            <div className="grid gap-8 lg:grid-cols-12">
                <div className="lg:col-span-8">
                    <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white h-full">
                        <CardHeader className="bg-muted/10 border-b p-8 px-10 flex flex-row justify-between items-center">
                            <div>
                                <CardTitle className="text-xl font-black text-[#1e1b4b]">يوميات المواقع الحالية</CardTitle>
                                <CardDescription>تتبع إنجاز المهندسين في المواقع الإنشائية.</CardDescription>
                            </div>
                            <Button asChild className="rounded-xl h-10 px-6 font-black gap-2 shadow-lg shadow-primary/20">
                                <Link href="/dashboard/construction/field-visits/new">
                                    <PlusCircle className="h-4 w-4" /> جدولة زيارة
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow className="h-12 border-none">
                                        <TableHead className="px-10">المشروع</TableHead>
                                        <TableHead>المرحلة الحالية</TableHead>
                                        <TableHead className="text-center">الإنجاز</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(data.projects || []).slice(0, 6).map((p: any) => (
                                        <TableRow key={p.id} className="h-16 group hover:bg-muted/30">
                                            <TableCell className="px-10 font-black text-slate-800">{p.projectName}</TableCell>
                                            <TableCell className="font-bold text-xs text-muted-foreground">{p.status}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge className="bg-primary/10 text-primary border-none font-mono font-black">{p.progressPercentage}%</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
                
                <div className="lg:col-span-4 space-y-6">
                    <Card className="rounded-[2.5rem] bg-slate-900 text-white p-8 space-y-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-10 -mt-10 blur-2xl" />
                        <div className="space-y-1 relative z-10">
                            <h4 className="text-2xl font-black tracking-tight">مخزون الموقع</h4>
                            <p className="text-xs text-white/50 font-bold">حالة المواد الأساسية في المستودعات.</p>
                        </div>
                        <div className="space-y-4 relative z-10">
                            <InventoryLiteItem label="حديد كويتي" qty="40 طن" status="كافٍ" color="text-green-400" />
                            <InventoryLiteItem label="أسمنت بورتلاند" qty="1200 كيس" status="طلب جديد" color="text-orange-400" />
                        </div>
                        <Button asChild variant="outline" className="w-full h-11 rounded-xl bg-white/10 text-white border-white/20 hover:bg-white/20 font-black text-xs">
                            <Link href="/dashboard/warehouse/items">عرض المستودع الكامل</Link>
                        </Button>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function InventoryLiteItem({ label, qty, status, color }: any) {
    return (
        <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/10">
            <div>
                <p className="font-black text-xs">{label}</p>
                <p className="text-[10px] font-bold text-white/40">{qty}</p>
            </div>
            <span className={cn("text-[10px] font-black uppercase tracking-widest", color)}>{status}</span>
        </div>
    );
}