'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy, collectionGroup, writeBatch, serverTimestamp } from 'firebase/firestore';
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
import { Printer, ArrowRight, History, MapPin, Workflow, User, CalendarDays, CheckCircle2, FileSignature, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PrintableDocument } from '@/components/layout/printable-document';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SignaturePad } from '@/components/ui/signature-pad';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

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
    const { toast } = useToast();
    const { user: currentUser } = useAuth();
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const [client, setClient] = useState<Client | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);
    const [isSavingSign, setIsSavingSign] = useState(false);

    useEffect(() => {
        if (!firestore || !id) return;

        const fetchFullHistory = async () => {
            setLoading(true);
            try {
                const clientSnap = await getDoc(doc(firestore, 'clients', id));
                if (!clientSnap.exists()) throw new Error('Client not found');
                const clientData = { id: clientSnap.id, ...clientSnap.data() } as Client;
                setClient(clientData);

                const allLogs: LogEntry[] = [];

                // 1. جلب سجل الحركات الأساسي
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

                // 2. جلب المواعيد (الزيارات المكتبية)
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

                // 3. جلب الزيارات الميدانية الموثقة
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

                // 4. جلب تحديثات سير العمل من كافة المعاملات
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

                allLogs.sort((a, b) => b.date.getTime() - a.date.getTime());
                setLogs(allLogs);
            } catch (error) { console.error(error); } finally { setLoading(false); }
        };
        fetchFullHistory();
    }, [firestore, id]);

    const handleSaveSignature = async (dataUrl: string) => {
        if (!firestore || !client) return;
        setIsSavingSign(true);
        try {
            const batch = writeBatch(firestore);
            const reportRef = doc(collection(firestore, `clients/${id}/history`));
            
            batch.set(reportRef, {
                type: 'log',
                content: 'قام العميل بتوقيع كشف الأعمال الفني إلكترونياً (اعتماد نهائي للأعمال).',
                userId: currentUser?.id || 'client',
                userName: client.nameAr,
                signatureUrl: dataUrl,
                createdAt: serverTimestamp()
            });

            await batch.commit();
            toast({ title: 'تم الاعتماد', description: 'تم حفظ توقيع العميل على سجل الأعمال.' });
            setIsSignDialogOpen(false);
        } catch (e) { toast({ variant: 'destructive', title: 'خطأ' }); } finally { setIsSavingSign(false); }
    };

    if (loading || brandingLoading) return <div className="p-8"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6" dir="rtl">
            <div className="flex justify-between items-center no-print bg-background/80 backdrop-blur-sm sticky top-0 z-10 py-4 border-b">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-bold"><ArrowRight className="h-4 w-4"/> العودة</Button>
                <div className="flex gap-2">
                    <Button onClick={() => setIsSignDialogOpen(true)} variant="outline" className="border-primary text-primary font-black gap-2 rounded-xl">
                        <FileSignature className="h-4 w-4" /> توقيع المالك إلكترونياً
                    </Button>
                    <Button onClick={() => window.print()} className="gap-2 shadow-lg rounded-xl font-bold">
                        <Printer className="h-4 w-4"/> طباعة الكشف
                    </Button>
                </div>
            </div>

            <PrintableDocument>
                <div className="space-y-10">
                    <div className="flex justify-between items-start border-b-4 border-primary pb-6">
                        <div className="flex items-center gap-4">
                            <Logo className="h-20 w-20 !p-3 border shadow-inner" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
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

                    <div className="grid grid-cols-2 gap-8 p-8 bg-muted/20 rounded-[2.5rem] border-2 border-dashed">
                        <div className="space-y-4">
                            <div><p className="text-[10px] uppercase font-black text-muted-foreground mb-1">اسم العميل:</p><p className="text-2xl font-black text-slate-900">{client?.nameAr}</p></div>
                            <div className="flex items-center gap-6 text-sm">
                                <p><span className="font-bold text-muted-foreground">رقم الملف:</span> <Badge variant="secondary" className="font-mono">{client?.fileId}</Badge></p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end justify-center">
                            <p className="text-[10px] uppercase font-black text-primary mb-1">إجمالي الحركات الموثقة</p>
                            <p className="text-4xl font-black font-mono text-primary">{logs.length}</p>
                        </div>
                    </div>

                    <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-slate-900 text-white">
                                <TableRow className="h-14"><TableHead className="w-32 text-center text-white border-l border-slate-700 font-black">التاريخ</TableHead><TableHead className="w-40 text-right text-white border-l border-slate-700 font-black">نوع الإجراء</TableHead><TableHead className="px-6 text-white border-l border-slate-700 font-black text-right">الأعمال المنفذة</TableHead><TableHead className="w-40 text-left px-8 text-white font-black">المسؤول</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.map((log) => (
                                    <TableRow key={log.id} className="h-auto hover:bg-muted/5 transition-colors border-b last:border-0 group">
                                        <TableCell className="text-center py-6 font-black text-sm">{format(log.date, 'dd/MM/yyyy')}</TableCell>
                                        <TableCell><Badge variant="outline" className="font-black text-[9px] px-3 py-0.5 rounded-full border-2">{log.action}</Badge></TableCell>
                                        <TableCell className="px-6 py-6 text-sm font-medium leading-loose text-slate-800 whitespace-pre-wrap">{log.details}</TableCell>
                                        <TableCell className="text-left px-8 font-black text-[10px] text-muted-foreground">{log.responsible}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <footer className="pt-20 grid grid-cols-2 gap-20 text-center text-[10px] font-black uppercase text-muted-foreground">
                        <div className="space-y-16"><p className="text-foreground border-b-2 border-foreground pb-2 text-sm">اعتماد المهندس</p><div className="pt-2 border-t border-dashed">التوقيع</div></div>
                        <div className="space-y-16"><p className="text-foreground border-b-2 border-foreground pb-2 text-sm">اعتماد المالك</p><div className="pt-2 border-t border-dashed">التوقيع الإلكتروني</div></div>
                    </footer>
                </div>
            </PrintableDocument>

            <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
                <DialogContent className="max-w-lg rounded-3xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black flex items-center gap-2"><FileSignature className="text-primary" /> توقيع المالك (اعتماد نهائي)</DialogTitle>
                        <DialogDescription>توقيع المالك أدناه يعتبر إقراراً بصحة كافة الأعمال المذكورة في هذا الكشف.</DialogDescription>
                    </DialogHeader>
                    <div className="py-6">
                        <SignaturePad onSave={handleSaveSignature} />
                    </div>
                    {isSavingSign && <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center rounded-3xl"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>}
                </DialogContent>
            </Dialog>
        </div>
    );
}