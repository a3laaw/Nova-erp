'use client';

import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, Timestamp } from 'firebase/firestore';
import type { Appointment, Client, UserProfile, AppointmentAuditLog } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DateInput } from '@/components/ui/date-input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    History, Search, Printer, Loader2, Calendar, 
    User, ShieldCheck, ArrowRight, Eye, MoreHorizontal,
    FileSearch, Activity, Sparkles, Clock
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';
import { getTenantPath } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * تقرير رادار تدقيق المواعيد التاريخي:
 * يتيح للإدارة مراجعة "المسيرة التاريخية" لكل موعد، ومعرفة من قام بالحجز ومن عدل الأوقات.
 */
export function AppointmentsAuditReport() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const tenantId = currentUser?.currentCompanyId;

    const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date()));
    const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));
    const [selectedClientId, setSelectedClientId] = useState('all');
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [reportResults, setReportResults] = useState<Appointment[] | null>(null);
    const [selectedApptLogs, setSelectedApptLogs] = useState<AppointmentAuditLog[]>([]);
    const [isLogsLoading, setIsLogsLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const { data: clients = [] } = useSubscription<Client>(firestore, 'clients', [orderBy('nameAr')]);

    const clientOptions = useMemo(() => [
        { value: 'all', label: 'جميع العملاء' },
        ...clients.map(c => ({ value: c.id!, label: c.nameAr }))
    ], [clients]);

    const handleGenerate = async () => {
        if (!firestore || !dateFrom || !dateTo || !tenantId) return;
        setIsGenerating(true);
        try {
            const start = startOfDay(dateFrom);
            const end = endOfDay(dateTo);
            const apptsPath = getTenantPath('appointments', tenantId);

            let q = query(
                collection(firestore, apptsPath),
                where('appointmentDate', '>=', Timestamp.fromDate(start)),
                where('appointmentDate', '<=', Timestamp.fromDate(end)),
                orderBy('appointmentDate', 'desc')
            );

            if (selectedClientId !== 'all') {
                q = query(q, where('clientId', '==', selectedClientId));
            }

            const snap = await getDocs(q);
            const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
            setReportResults(results);
        } finally { setIsGenerating(false); }
    };

    const viewAuditLogs = async (apptId: string) => {
        if (!firestore || !tenantId) return;
        setIsLogsLoading(true);
        setIsDialogOpen(true);
        try {
            const auditPath = getTenantPath(`appointments/${apptId}/auditLogs`, tenantId);
            const snap = await getDocs(query(collection(firestore, auditPath), orderBy('createdAt', 'desc')));
            setSelectedApptLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppointmentAuditLog)));
        } finally { setIsLogsLoading(false); }
    };

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="no-print rounded-[2rem] border-none shadow-sm bg-gradient-to-l from-white to-orange-50">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><History className="h-8 w-8" /></div>
                        <div>
                            <CardTitle className="text-2xl font-black text-[#1e1b4b]">رادار تدقيق المواعيد التاريخي</CardTitle>
                            <CardDescription className="text-base font-bold text-slate-500">مراجعة المسيرة الزمنية لكل موعد؛ من قام بالحجز، من عدل الساعات، ومن أتمَّ الزيارة.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 pt-0 flex flex-wrap gap-4 items-end">
                    <div className="grid gap-2 w-64"><Label className="font-bold">تصفية حسب العميل</Label><InlineSearchList value={selectedClientId} onSelect={setSelectedClientId} options={clientOptions} placeholder="اختر..." /></div>
                    <div className="grid gap-2 w-48"><Label className="font-bold">من تاريخ</Label><DateInput value={dateFrom} onChange={setDateFrom} /></div>
                    <div className="grid gap-2 w-48"><Label className="font-bold">إلى تاريخ</Label><DateInput value={dateTo} onChange={setDateTo} /></div>
                    <Button onClick={handleGenerate} disabled={isGenerating} className="h-11 rounded-xl font-black gap-2 shadow-xl shadow-primary/20">
                        {isGenerating ? <Loader2 className="animate-spin h-5 w-5" /> : <FileSearch className="h-5 w-5" />} تحديث السجل
                    </Button>
                </CardContent>
            </Card>

            {reportResults ? (
                <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white animate-in fade-in duration-500">
                    <Table>
                        <TableHeader className="bg-slate-900 text-white">
                            <TableRow className="h-14 border-none">
                                <TableHead className="px-8 font-black text-white text-right">العميل والموعد</TableHead>
                                <TableHead className="font-black text-white text-center">التاريخ والوقت</TableHead>
                                <TableHead className="font-black text-white text-center">عدد الزيارات</TableHead>
                                <TableHead className="font-black text-white text-center">الحالة الإجرائية</TableHead>
                                <TableHead className="text-left px-12 font-black text-white">المسؤول</TableHead>
                                <TableHead className="w-20"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportResults.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic font-black">لا توجد مواعيد في هذه الفترة.</TableCell></TableRow>
                            ) : (
                                reportResults.map(appt => {
                                    const apptDate = toFirestoreDate(appt.appointmentDate);
                                    return (
                                        <TableRow key={appt.id} className="h-20 hover:bg-muted/5 border-b group">
                                            <TableCell className="px-8">
                                                <p className="font-black text-slate-900 text-lg">{appt.clientName || 'عميل محمول'}</p>
                                                <p className="text-[10px] font-bold text-primary flex items-center gap-1"><Activity className="h-3 w-3"/> {appt.title}</p>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <p className="font-black text-sm">{apptDate ? format(apptDate, 'dd/MM/yyyy') : '-'}</p>
                                                <p className="font-mono text-[10px] text-muted-foreground">{apptDate ? format(apptDate, 'HH:mm') : '-'}</p>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className="bg-primary/5 text-primary font-black px-3">الزيارة {appt.visitCount || 1}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className={cn("px-4 py-1 rounded-full font-black text-[10px]", appt.workStageUpdated ? "bg-green-600" : "bg-blue-600")}>
                                                    {appt.workStageUpdated ? 'تم الإنجاز' : 'مجدول'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-left px-12">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-bold text-sm">{appt.engineerName || 'إشراف عام'}</span>
                                                    <span className="text-[9px] font-mono opacity-40">BY: {appt.createdBy?.substring(0,8)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center pr-4">
                                                <Button onClick={() => viewAuditLogs(appt.id!)} variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-slate-50 border group-hover:bg-white transition-all shadow-sm">
                                                    <History className="h-5 w-5 text-primary" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </Card>
            ) : (
                <div className="h-96 flex flex-col items-center justify-center border-4 border-dashed rounded-[3.5rem] opacity-30">
                    <Activity className="h-20 w-20 text-muted-foreground mb-4" />
                    <p className="text-xl font-bold">بانتظار تحديد نطاق التدقيق</p>
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent dir="rtl" className="max-w-xl rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
                    <DialogHeader className="p-8 bg-slate-900 text-white text-right shrink-0">
                        <DialogTitle className="text-2xl font-black">المسيرة التاريخية للموعد</DialogTitle>
                        <DialogDescription className="text-indigo-200">سجل يوثق كل من تفاعل مع هذا الحجز بالثانية.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] p-8">
                        {isLogsLoading ? (
                            <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>
                        ) : selectedApptLogs.length === 0 ? (
                            <p className="text-center p-10 opacity-30 italic font-bold">لا يوجد سجل حركات مفصل لهذا الموعد.</p>
                        ) : (
                            <div className="relative pr-6 border-r-2 border-slate-100 space-y-8">
                                {selectedApptLogs.map((log) => (
                                    <div key={log.id} className="relative flex items-start gap-4">
                                        <div className="absolute -right-[1.85rem] top-1 p-1 bg-white rounded-full border-2 shadow-sm"><div className="h-3 w-3 rounded-full bg-primary" /></div>
                                        <div className="flex-1 bg-slate-50 p-4 rounded-2xl border shadow-inner">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6 border-2 border-white"><AvatarImage src={log.userAvatar}/><AvatarFallback className="text-[8px] bg-primary/10 text-primary">{log.userName?.charAt(0)}</AvatarFallback></Avatar>
                                                    <span className="font-black text-sm text-[#1e1b4b]">{log.userName}</span>
                                                </div>
                                                <span className="text-[10px] font-mono font-bold text-slate-400">{toFirestoreDate(log.createdAt) ? format(toFirestoreDate(log.createdAt)!, 'dd/MM HH:mm:ss') : ''}</span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-600 leading-relaxed">{log.details}</p>
                                            <Badge variant="ghost" className="mt-2 text-[8px] font-black uppercase tracking-widest bg-white/50">{log.action}</Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                    <DialogFooter className="p-6 bg-slate-50 border-t"><Button onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold h-11 w-full">إغلاق النافذة</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
