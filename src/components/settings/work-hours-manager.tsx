
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBranding, type BrandingSettings } from '@/context/branding-context';
import { useFirebase, useSubscription } from '@/firebase';
import { doc, setDoc, collection, addDoc, serverTimestamp, query, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Clock, CalendarDays, PlusCircle, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Switch } from '../ui/switch';
import { DateInput } from '../ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { WorkShift } from '@/lib/types';

const defaultSchedule = {
    morning_start_time: '08:00',
    morning_end_time: '12:00',
    evening_start_time: '13:00',
    evening_end_time: '17:00',
    appointment_slot_duration: 30,
    appointment_buffer_time: 0,
};

const defaultHalfDay = {
    day: '',
    type: 'morning_only' as 'morning_only' | 'custom_end_time',
    end_time: '13:00',
};

const defaultRamadanSchedule = {
    is_enabled: false,
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined,
    start_time: '09:30',
    end_time: '15:30',
    appointment_slot_duration: 30,
    appointment_buffer_time: 15,
};

const weekDays = [
    { id: 'Sunday', label: 'الأحد' },
    { id: 'Monday', label: 'الاثنين' },
    { id: 'Tuesday', label: 'الثلاثاء' },
    { id: 'Wednesday', label: 'الأربعاء' },
    { id: 'Thursday', label: 'الخميس' },
    { id: 'Friday', label: 'الجمعة' },
    { id: 'Saturday', label: 'السبت' },
];

const ScheduleForm = ({ schedule, setSchedule }: { schedule: typeof defaultSchedule, setSchedule: any }) => {
    const morningInvalid = schedule.morning_start_time >= schedule.morning_end_time && schedule.morning_end_time !== '';
    const eveningInvalid = schedule.evening_start_time >= schedule.evening_end_time && schedule.evening_end_time !== '';

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <h4 className="font-bold text-sm text-primary">الفترة الصباحية</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label className="text-xs">من الساعة</Label>
                        <Input type="time" value={schedule.morning_start_time} onChange={(e) => setSchedule((p:any) => ({ ...p, morning_start_time: e.target.value }))} className="rounded-xl"/>
                    </div>
                    <div className="grid gap-2">
                        <Label className="text-xs">إلى الساعة</Label>
                        <Input type="time" value={schedule.morning_end_time} onChange={(e) => setSchedule((p:any) => ({ ...p, morning_end_time: e.target.value }))} className={cn("rounded-xl", morningInvalid && "border-red-500 bg-red-50")}/>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="font-bold text-sm text-primary">الفترة المسائية</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label className="text-xs">من الساعة</Label>
                        <Input type="time" value={schedule.evening_start_time} onChange={(e) => setSchedule((p:any) => ({ ...p, evening_start_time: e.target.value }))} className="rounded-xl"/>
                    </div>
                    <div className="grid gap-2">
                        <Label className="text-xs">إلى الساعة</Label>
                        <Input type="time" value={schedule.evening_end_time} onChange={(e) => setSchedule((p:any) => ({ ...p, evening_end_time: e.target.value }))} className={cn("rounded-xl", eveningInvalid && "border-red-500 bg-red-50")}/>
                    </div>
                </div>
            </div>

            <Separator/>
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label className="text-xs">مدة كل موعد (بالدقائق)</Label>
                    <Input type="number" min="15" step="5" value={schedule.appointment_slot_duration} onChange={(e) => setSchedule((p:any) => ({ ...p, appointment_slot_duration: e.target.value }))} className="rounded-xl"/>
                </div>
                <div className="grid gap-2">
                    <Label className="text-xs">فترة الراحة (بالدقائق)</Label>
                    <Input type="number" min="0" step="5" value={schedule.appointment_buffer_time} onChange={(e) => setSchedule((p:any) => ({ ...p, appointment_buffer_time: e.target.value }))} className="rounded-xl"/>
                </div>
            </div>
        </div>
    );
};

export function WorkHoursManager() {
    const { firestore } = useFirebase();
    const { branding, loading } = useBranding();
    const { toast } = useToast();
    
    // Global Booking Schedules
    const [generalSchedule, setGeneralSchedule] = useState(defaultSchedule);
    const [architecturalSchedule, setArchitecturalSchedule] = useState(defaultSchedule);
    const [holidays, setHolidays] = useState<string[]>([]);
    const [halfDay, setHalfDay] = useState(defaultHalfDay);
    const [ramadanSchedule, setRamadanSchedule] = useState(defaultRamadanSchedule);

    // Employee Shifts Management
    const { data: shifts = [], loading: shiftsLoading } = useSubscription<WorkShift>(firestore, 'work_shifts', [orderBy('name')]);
    const [isShiftDialogOpen, setIsShiftDialogOpen] = useState(false);
    const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
    const [shiftFormData, setShiftFormData] = useState({ name: '', startTime: '08:00', endTime: '17:00' });

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (branding?.work_hours) {
            const wh = branding.work_hours;
            if (wh.general) setGeneralSchedule({ ...defaultSchedule, ...wh.general });
            if (wh.architectural) setArchitecturalSchedule({ ...defaultSchedule, ...wh.architectural });
            setHolidays(wh.holidays || []);
            if (wh.half_day) setHalfDay({ ...defaultHalfDay, ...wh.half_day });
            if (wh.ramadan) {
                setRamadanSchedule({
                    ...defaultRamadanSchedule,
                    ...wh.ramadan,
                    start_date: toFirestoreDate(wh.ramadan.start_date) || undefined,
                    end_date: toFirestoreDate(wh.ramadan.end_date) || undefined,
                });
            }
        }
    }, [branding]);
    
    const handleSaveGlobal = async () => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            const dataToSave = {
                work_hours: {
                    general: { ...generalSchedule, appointment_slot_duration: Number(generalSchedule.appointment_slot_duration), appointment_buffer_time: Number(generalSchedule.appointment_buffer_time) },
                    architectural: { ...architecturalSchedule, appointment_slot_duration: Number(architecturalSchedule.appointment_slot_duration), appointment_buffer_time: Number(architecturalSchedule.appointment_buffer_time) },
                    holidays,
                    half_day: halfDay,
                    ramadan: {
                        ...ramadanSchedule,
                        start_date: ramadanSchedule.start_date || null,
                        end_date: ramadanSchedule.end_date || null,
                        appointment_slot_duration: Number(ramadanSchedule.appointment_slot_duration),
                        appointment_buffer_time: Number(ramadanSchedule.appointment_buffer_time),
                    }
                }
            };
            await setDoc(doc(firestore, 'company_settings', 'main'), dataToSave, { merge: true });
            toast({ title: 'نجاح', description: 'تم حفظ إعدادات الدوام العامة.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ' });
        } finally {
            setIsSaving(false);
        }
    };

    const openShiftDialog = (shift: WorkShift | null = null) => {
        setEditingShift(shift);
        setShiftFormData({
            name: shift?.name || '',
            startTime: shift?.startTime || '08:00',
            endTime: shift?.endTime || '17:00',
        });
        setIsShiftDialogOpen(true);
    };

    const handleSaveShift = async () => {
        if (!firestore || !shiftFormData.name) return;
        setIsSaving(true);
        try {
            if (editingShift) {
                await updateDoc(doc(firestore, 'work_shifts', editingShift.id!), { ...shiftFormData, updatedAt: serverTimestamp() });
            } else {
                await addDoc(collection(firestore, 'work_shifts'), { ...shiftFormData, createdAt: serverTimestamp() });
            }
            setIsShiftDialogOpen(false);
            toast({ title: 'تم الحفظ', description: 'تم تحديث وردية الموظف بنجاح.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ' });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <Skeleton className="h-96 w-full rounded-3xl" />;

    return (
        <Tabs defaultValue="booking" dir="rtl" className="space-y-6">
            <div className="flex justify-between items-center bg-muted/30 p-2 rounded-2xl border">
                <TabsList className="bg-transparent gap-2">
                    <TabsTrigger value="booking" className="rounded-xl font-bold px-8 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        إعدادات المواعيد (التقويم)
                    </TabsTrigger>
                    <TabsTrigger value="shifts" className="rounded-xl font-bold px-8 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        ورديات الموظفين (الحضور)
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="booking" className="space-y-8 animate-in fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="rounded-2xl border-2">
                        <CardHeader><CardTitle className="text-lg">الدوام العام (للقاعات)</CardTitle></CardHeader>
                        <CardContent><ScheduleForm schedule={generalSchedule} setSchedule={setGeneralSchedule} /></CardContent>
                    </Card>
                    <Card className="rounded-2xl border-2 border-primary/10 bg-primary/5">
                        <CardHeader><CardTitle className="text-lg text-primary">دوام القسم المعماري</CardTitle></CardHeader>
                        <CardContent><ScheduleForm schedule={architecturalSchedule} setSchedule={setArchitecturalSchedule} /></CardContent>
                    </Card>
                </div>

                <Card className="rounded-2xl border-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-lg">أوقات دوام شهر رمضان</CardTitle>
                                <CardDescription>تفعيل استثناءات المواعيد لشهر رمضان.</CardDescription>
                            </div>
                            <Switch checked={ramadanSchedule.is_enabled} onCheckedChange={(checked) => setRamadanSchedule(p => ({ ...p, is_enabled: checked }))} />
                        </div>
                    </CardHeader>
                    {ramadanSchedule.is_enabled && (
                        <CardContent className="space-y-6 pt-4 animate-in slide-in-from-top-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DateInput value={ramadanSchedule.start_date} onChange={(d) => setRamadanSchedule(p => ({ ...p, start_date: d }))} placeholder="بداية رمضان"/>
                                <DateInput value={ramadanSchedule.end_date} onChange={(d) => setRamadanSchedule(p => ({ ...p, end_date: d }))} placeholder="نهاية رمضان"/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2"><Label>من الساعة</Label><Input type="time" value={ramadanSchedule.start_time} onChange={(e) => setRamadanSchedule(p => ({ ...p, start_time: e.target.value }))} className="rounded-xl"/></div>
                                <div className="grid gap-2"><Label>إلى الساعة</Label><Input type="time" value={ramadanSchedule.end_time} onChange={(e) => setRamadanSchedule(p => ({ ...p, end_time: e.target.value }))} className="rounded-xl"/></div>
                            </div>
                        </CardContent>
                    )}
                </Card>

                <Card className="rounded-2xl border-2 p-6 space-y-6">
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <Label className="font-black text-primary">أيام العطلة الأسبوعية</Label>
                            <div className="flex flex-wrap gap-4">
                                {weekDays.map(day => (
                                    <div key={day.id} className="flex items-center gap-2">
                                        <Checkbox id={`h-${day.id}`} checked={holidays.includes(day.id)} onCheckedChange={(c) => setHolidays(prev => c ? [...prev, day.id] : prev.filter(h => h !== day.id))} />
                                        <Label htmlFor={`h-${day.id}`} className="text-xs cursor-pointer">{day.label}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <Label className="font-black text-primary">يوم نصف الدوام</Label>
                            <Select value={halfDay.day || '_NONE_'} onValueChange={(d) => setHalfDay(p => ({...p, day: d === '_NONE_' ? '' : d}))}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="اختر اليوم..." /></SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="_NONE_">لا يوجد</SelectItem>
                                    {weekDays.filter(d => !holidays.includes(d.id)).map(day => <SelectItem key={day.id} value={day.id}>{day.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </Card>

                <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveGlobal} disabled={isSaving} className="h-12 px-12 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-primary/20">
                        {isSaving ? <Loader2 className="animate-spin h-5 w-5"/> : <Save className="h-5 w-5" />}
                        حفظ إعدادات المواعيد
                    </Button>
                </div>
            </TabsContent>

            <TabsContent value="shifts" className="space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-xl font-black">ورديات الموظفين (Shifts)</h3>
                        <p className="text-sm text-muted-foreground">تستخدم هذه الورديات لحساب التأخير والغياب في مسير الرواتب آلياً.</p>
                    </div>
                    <Button onClick={() => openShiftDialog()} className="rounded-xl font-bold gap-2">
                        <PlusCircle className="h-4 w-4" /> إضافة وردية
                    </Button>
                </div>

                <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm bg-white">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="px-8 py-4 font-bold">اسم الوردية</TableHead>
                                <TableHead className="font-bold">وقت البداية (التأخير)</TableHead>
                                <TableHead className="font-bold">وقت النهاية</TableHead>
                                <TableHead className="text-center font-bold">إجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {shiftsLoading ? <TableRow><TableCell colSpan={4} className="text-center p-8"><Loader2 className="animate-spin mx-auto text-primary"/></TableCell></TableRow> :
                            shifts.length === 0 ? <TableRow><TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic font-bold">لا توجد ورديات معرفة حالياً.</TableCell></TableRow> :
                            shifts.map(shift => (
                                <TableRow key={shift.id} className="hover:bg-muted/30">
                                    <TableCell className="px-8 font-black text-gray-800">{shift.name}</TableCell>
                                    <TableCell className="font-mono font-bold text-primary">{shift.startTime}</TableCell>
                                    <TableCell className="font-mono font-bold">{shift.endTime}</TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex justify-center gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openShiftDialog(shift)} className="h-8 w-8 rounded-full"><Pencil className="h-4 w-4"/></Button>
                                            <Button variant="ghost" size="icon" onClick={async () => { if(confirm('حذف الوردية؟')) await deleteDoc(doc(firestore!, 'work_shifts', shift.id!)) }} className="h-8 w-8 text-destructive rounded-full"><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </TabsContent>

            <Dialog open={isShiftDialogOpen} onOpenChange={setIsShiftDialogOpen}>
                <DialogContent dir="rtl" className="max-w-md rounded-3xl">
                    <form onSubmit={(e) => { e.preventDefault(); handleSaveShift(); }}>
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black flex items-center gap-2">
                                <Clock className="text-primary h-6 w-6"/>
                                {editingShift ? 'تعديل وردية' : 'إضافة وردية جديدة'}
                            </DialogTitle>
                            <DialogDescription>أدخل مسمى الوردية وأوقاتها ليتم ربطها بالموظفين.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-6 py-6">
                            <div className="grid gap-2">
                                <Label className="font-bold">اسم الوردية (مثال: دوام صباحي) *</Label>
                                <Input value={shiftFormData.name} onChange={e => setShiftFormData(p => ({...p, name: e.target.value}))} required className="rounded-xl border-2" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label className="font-bold">يبدأ الدوام *</Label>
                                    <Input type="time" value={shiftFormData.startTime} onChange={e => setShiftFormData(p => ({...p, startTime: e.target.value}))} required className="rounded-xl" />
                                </div>
                                <div className="grid gap-2">
                                    <Label className="font-bold">ينتهي الدوام *</Label>
                                    <Input type="time" value={shiftFormData.endTime} onChange={e => setShiftFormData(p => ({...p, endTime: e.target.value}))} required className="rounded-xl" />
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsShiftDialogOpen(false)} className="rounded-xl">إلغاء</Button>
                            <Button type="submit" disabled={isSaving} className="rounded-xl font-black px-10">
                                {isSaving ? <Loader2 className="animate-spin h-4 w-4"/> : <Save className="ml-2 h-4 w-4" />}
                                حفظ الوردية
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Tabs>
    );
}
