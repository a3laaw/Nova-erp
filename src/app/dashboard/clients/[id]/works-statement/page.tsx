'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy, collectionGroup } from 'firebase/firestore';
import type { Client, ClientTransaction, Appointment, FieldVisit, Employee } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { useBranding } from '@/context/branding-context';
import { Logo } from '@/components/layout/logo';
import { Printer, ArrowRight, History, MapPin, Workflow, User, CalendarDays, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PrintableDocument } from '@/components/layout/printable-document';

interface LogEntry {
    id: string;
    date: Date;
    type: 'history' | 'visit' | 'stage' | 'appointment';
    action: string;
    details: string;
    entityName: string;
    responsible: string;
}

export default function ClientWorksStatementPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const [client, setClient] = useState<Client | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !id) return;

        const fetchFullHistory = async () => {
            setLoading(true);
            try {
                // 1. جلب بيانات العميل
                const clientSnap = await getDoc(doc(firestore, 'clients', id));
                if (!clientSnap.exists()) throw new Error('Client not found');
                const clientData = { id: clientSnap.id, ...clientSnap.data() } as Client;
                setClient(clientData);

                const allLogs: LogEntry[] = [];

                // 2. جلب سجل التغييرات العام (History)
                const historySnap = await getDocs(query(collection(firestore, `clients/${id}/history`), orderBy('createdAt', 'desc')));
                historySnap.forEach(d => {
                    const data = d.data();
                    allLogs.push({
                        id: d.id,
                        date: toFirestoreDate(data.createdAt) || new Date(),
                        type: 'history',
                        action: 'إجراء إداري',
                        details: data.content,
                        entityName: 'ملف العميل',
                        responsible: data.userName || 'النظام'
                    });
                });

                // 3. جلب المواعيد
                const apptsSnap = await getDocs(query(collection(firestore, 'appointments'), where('clientId', '==', id)));
                apptsSnap.forEach(d => {
                    const data = d.data() as Appointment;
                    allLogs.push({
                        id: d.id,
                        date: toFirestoreDate(data.appointmentDate) || new Date(),
                        type: 'appointment',
                        action: 'موعد / مقابلة',
                        details: `${data.title} - الحالة: ${data.status === 'confirmed' ? 'تم الحضور' : 'مجدول'}`,
                        entityName: data.meetingRoom || 'مكتب المهندس',
                        responsible: data.engineerId || '---'
                    });
                });

                // 4. جلب الزيارات الميدانية
                const visitsSnap = await getDocs(query(collection(firestore, 'field_visits'), where('clientId', '==', id), where('status', '==', 'confirmed')));
                visitsSnap.forEach(d => {
                    const data = d.data() as FieldVisit;
                    allLogs.push({
                        id: d.id,
                        date: toFirestoreDate(data.scheduledDate) || new Date(),
                        type: 'visit',
                        action: 'زيارة ميدانية',
                        details: `إنجاز مرحلة: ${data.plannedStageName}. ملاحظات: ${data.confirmationData?.notes || ''}`,
                        entityName: data.projectName,
                        responsible: data.engineerName || 'مهندس الموقع'
                    });
                });

                // 5. جلب المعاملات وتحديثات المراحل (Timeline Events)
                const txsSnap = await getDocs(query(collection(firestore, `clients/${id}/transactions`)));
                for (const txDoc of txsSnap.docs) {
                    const tx = txDoc.data() as ClientTransaction;
                    const timelineSnap = await getDocs(query(collection(firestore, `clients/${id}/transactions/${txDoc.id}/timelineEvents`), orderBy('createdAt', 'desc')));
                    timelineSnap.forEach(td => {
                        const tData = td.data();
                        allLogs.push({
                            id: td.id,
                            date: toFirestoreDate(tData.createdAt) || new Date(),
                            type: 'stage',
                            action: tData.type === 'comment' ? 'تعليق فني' : 'تحديث مسار',
                            details: tData.content,
                            entityName: tx.transactionType,
                            responsible: tData.userName || 'المهندس المسؤول'
                        });
                    });
                }

                // ترتيب زمني (الأحدث أولاً)
                allLogs.sort((a, b) => b.date.getTime() - a.date.getTime());
                setLogs(allLogs);

            } catch (error) {
                console.error("Error fetching works statement:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchFullHistory();
    }, [firestore, id]);

    const handlePrint = () => window.print();

    if (loading || brandingLoading) {
        return (
            <div className="p-8 max-w-5xl mx-auto space-y-8" dir="rtl">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
        );
    }

    if (!client) return <div className="text-center p-20">لم يتم العثور على العميل.</div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6" dir="rtl">
            <div className="flex justify-between items-center no-print bg-background/80 backdrop-blur-sm sticky top-0 z-10 py-4 border-b">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                    <ArrowRight className="h-4 w-4"/> العودة للملف
                </Button>
                <Button onClick={handlePrint} className="gap-2 shadow-lg shadow-primary/20 rounded-xl font-bold bg-primary text-white">
                    <Printer className="h-4 w-4"/> طباعة كشف الأعمال الفني
                </Button>
            </div>

            <PrintableDocument>
                <div className="space-y-10">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b-4 border-primary pb-6">
                        <div className="flex items-center gap-4">
                            <Logo className="h-20 w-20 !p-3 border bg-white shadow-inner" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                            <div>
                                <h1 className="text-2xl font-black">{branding?.company_name || 'Nova ERP'}</h1>
                                <p className="text-xs text-muted-foreground mt-1 max-w-xs">{branding?.address}</p>
                            </div>
                        </div>
                        <div className="text-left space-y-1">
                            <h2 className="text-3xl font-black text-primary tracking-tighter">كشف الأعمال والإنجاز</h2>
                            <p className="text-lg font-bold text-gray-400 tracking-widest font-mono uppercase">Statement of Works & Progress</p>
                            <p className="text-xs text-muted-foreground mt-2">تاريخ التقرير: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ar })}</p>
                        </div>
                    </div>

                    {/* Client Info */}
                    <div className="grid grid-cols-2 gap-8 p-8 bg-muted/20 rounded-[2.5rem] border-2 border-dashed">
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">اسم العميل / Client:</p>
                                <p className="text-2xl font-black text-slate-900">{client.nameAr}</p>
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                                <p><span className="font-bold text-muted-foreground">رقم الملف:</span> <Badge variant="secondary" className="font-mono px-3">{client.fileId}</Badge></p>
                                <p><span className="font-bold text-muted-foreground">الجوال:</span> <span className="font-mono" dir="ltr">{client.mobile}</span></p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end justify-center text-left">
                            <p className="text-[10px] uppercase font-black text-primary mb-1">إجمالي الحركات الموثقة</p>
                            <p className="text-4xl font-black font-mono text-primary">{logs.length}</p>
                        </div>
                    </div>

                    {/* Table of Actions */}
                    <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-slate-900 text-white">
                                <TableRow className="h-14 border-none">
                                    <TableHead className="w-32 text-center text-white border-l border-slate-700 font-black">التاريخ</TableHead>
                                    <TableHead className="w-40 text-right text-white border-l border-slate-700 font-black">نوع الإجراء</TableHead>
                                    <TableHead className="px-6 text-white border-l border-slate-700 font-black text-right">تفاصيل الإنجاز / العمل المنفذ</TableHead>
                                    <TableHead className="w-48 text-right text-white border-l border-slate-700 font-black">المعاملة / المشروع</TableHead>
                                    <TableHead className="w-40 text-left px-8 text-white font-black">المسؤول</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.map((log) => (
                                    <TableRow key={log.id} className="h-auto hover:bg-muted/5 transition-colors border-b last:border-0 group">
                                        <TableCell className="text-center py-6">
                                            <div className="flex flex-col items-center">
                                                <span className="font-black text-sm">{format(log.date, 'dd/MM/yyyy')}</span>
                                                <span className="text-[10px] font-mono text-muted-foreground mt-1 opacity-60">{format(log.date, 'HH:mm')}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn(
                                                "font-black text-[9px] px-3 py-0.5 rounded-full border-2",
                                                log.type === 'visit' ? "bg-green-50 text-green-700 border-green-200" :
                                                log.type === 'stage' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                log.type === 'appointment' ? "bg-orange-50 text-orange-700 border-orange-200" :
                                                "bg-slate-50 text-slate-700 border-slate-200"
                                            )}>
                                                {log.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-6 py-6">
                                            <p className="text-sm font-medium leading-loose text-slate-800 whitespace-pre-wrap">{log.details}</p>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-xs font-bold text-primary">
                                                {log.type === 'visit' ? <MapPin className="h-3 w-3" /> : <Workflow className="h-3 w-3" />}
                                                {log.entityName}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-left px-8">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="text-[10px] font-black text-muted-foreground truncate">{log.responsible}</span>
                                                <div className="p-1.5 bg-muted rounded-full"><User className="h-3 w-3 opacity-40"/></div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {logs.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic font-bold">لا توجد حركات موثقة بعد لهذا العميل.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <footer className="pt-20 grid grid-cols-2 gap-20 text-center text-[10px] font-black uppercase text-muted-foreground">
                        <div className="space-y-16">
                            <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">إعداد ومراجعة</p>
                            <div className="pt-2 border-t border-dashed">قسم العمليات والميدان</div>
                        </div>
                        <div className="space-y-16">
                            <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">اعتماد الإدارة</p>
                            <div className="pt-2 border-t border-dashed">الختم الرسمي</div>
                        </div>
                    </footer>
                </div>
            </PrintableDocument>
        </div>
    );
}

