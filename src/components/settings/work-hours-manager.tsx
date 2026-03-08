'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBranding, type BrandingSettings } from '@/context/branding-context';
import { useFirebase, useSubscription } from '@/firebase';
import { doc, setDoc, collection, addDoc, serverTimestamp, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Clock, PlusCircle, Pencil, Trash2, RotateCcw, ArrowRight } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { DateInput } from '@/components/ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { WorkShift } from '@/lib/types';
import { useRouter } from 'next/navigation';

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
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4 p-6 border-2 border-dashed rounded-3xl bg-muted/5">
                    <h4 className="font-black text-sm text-primary uppercase tracking-widest flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" /> الفترة الصباحية
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label className="text-xs font-bold text-muted-foreground mr-1">من الساعة</Label>
                            <Input type="time" value={schedule.morning_start_time} onChange={(e) => setSchedule((p:any) => ({ ...p, morning_start_time: e.target.value }))} className="rounded-xl h-11 border-2 font-mono font-bold"/>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs font-bold text-muted-foreground mr-1">إلى الساعة</Label>
                            <Input type="time" value={schedule.morning_end_time} onChange={(e) => setSchedule((p:any) => ({ ...p, morning_end_time: e.target.value }))} className={cn("rounded-xl h-11 border-2 font-mono font-bold", morningInvalid && "border-red-500 bg-red-50")}/>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 p-6 border-2 border-dashed rounded-3xl bg-muted/5">
                    <h4 className="font-black text-sm text-primary uppercase tracking-widest flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" /> الفترة المسائية
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label className="text-xs font-bold text-muted-foreground mr-1">من الساعة</Label>
                            <Input type="time" value={schedule.evening_start_time} onChange={(e) => setSchedule((p:any) => ({ ...p, evening_start_time: e.target.value }))} className="rounded-xl h-11 border-2 font-mono font-bold"/>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs font-bold text-muted-foreground mr-1">إلى الساعة</Label>
                            <Input type="time" value={schedule.evening_end_time} onChange={(e) => setSchedule((p:any) => ({ ...p, evening_end_time: e.target.value }))} className={cn("rounded-xl h-11 border-2 font-mono font-bold", eveningInvalid && "border-red-500 bg-red-50")}/>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                <div className="grid gap-2">
                    <Label className="font-bold mr-1">مدة الخانة الزمنية (بالدقائق) *</Label>
                    <Input type="number" min="15" step="5" value={schedule.appointment_slot_duration} onChange={(e) => setSchedule((p:any) => ({ ...p, appointment_slot_duration: e.target.value }))} className="rounded-xl h-11 border-2 font-black text-primary text-center"/>
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold mr-1">فترة الراحة بين المواعيد (Buffer)</Label>
                    <Input type="number" min="0" step="5" value={schedule.appointment_buffer_time} onChange={(e) => setSchedule((p:any) => ({ ...p, appointment_buffer_time: e.target.value }))} className="rounded-xl h-11 border-2 font-black text-primary text-center"/>
                </div>
            </div>
        </div>
    );
};

export function WorkHoursManager() {
    const { firestore } = useFirebase();
    const { branding, loading } = useBranding();
    const { toast } = useToast();
    const router = useRouter();
    
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
            toast({ title: 'نجاح الحفظ', description: 'تم تحديث أوقات الدوام وقواعد المواعيد بنجاح.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        } finally {
            setIsSaving(false);
        }
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

    if (loading) return <div className="space-y-6"><Skeleton className="h-20 w-full rounded-[2.5rem]"/><Skeleton className="h-96 w-full rounded-[3rem]"/></div>;

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-orange-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-orange-600/10 rounded-2xl text-orange-600 shadow-inner">
                                <Clock className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black text-orange-900">إدارة أوقات الدوام والورديات</CardTitle>
                                <CardDescription className="text-base font-medium">تحديد القواعد الزمنية لتقويم المواعيد وساعات العمل للموظفين.</CardDescription>
                            </div>
                        </div>
                        <Button onClick={() => router.back()} variant="ghost" className="rounded-xl font-bold gap-2 text-orange-700 hover:bg-orange-50">
                            <ArrowRight className="h-4 w-4" /> العودة
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Tabs defaultValue="booking" className="space-y-8">
                <div className="flex justify-center">
                    <TabsList className="grid w-full md:w-[500px] grid-cols-2 h-auto p-1.5 bg-muted/50 rounded-2xl shadow-inner">
                        <TabsTrigger value="booking" className="py-3.5 rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg">
                            قواعد المواعيد والتقويم
                        </TabsTrigger>
                        <TabsTrigger value="shifts" className="py-3.5 rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg">
                            ورديات الموظفين (Shifts)
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="booking" className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card className="rounded-[2.5rem] border-none shadow-lg overflow-hidden bg-white">
                            <CardHeader className="bg-muted/10 border-b p-8"><CardTitle className="text-xl font-black flex items-center gap-3">الدوام العام (حجز القاعات)</CardTitle></CardHeader>
                            <CardContent className="p-8"><ScheduleForm schedule={generalSchedule} setSchedule={setGeneralSchedule} /></CardContent>
                        </Card>
                        <Card className="rounded-[2.5rem] border-none shadow-lg overflow-hidden bg-white border-primary/10">
                            <CardHeader className="bg-primary/5 border-b p-8"><CardTitle className="text-xl font-black text-primary">دوام القسم المعماري</CardTitle></CardHeader>
                            <CardContent className="p-8"><ScheduleForm schedule={architecturalSchedule} setSchedule={setArchitecturalSchedule} /></CardContent>
                        </Card>
                    </div>

                    <Card className="rounded-[2.5rem] border-none shadow-lg overflow-hidden bg-white">
                        <CardHeader className="bg-muted/10 border-b p-8">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <CardTitle className="text-xl font-black">أوقات دوام شهر رمضان المبارك</CardTitle>
                                    <CardDescription className="text-sm font-medium">تفعيل قواعد استثنائية للمواعيد خلال الشهر الكريم.</CardDescription>
                                </div>
                                <Switch checked={ramadanSchedule.is_enabled} onCheckedChange={(checked) => setRamadanSchedule(p => ({ ...p, is_enabled: checked }))} />
                            </div>
                        </CardHeader>
                        {ramadanSchedule.is_enabled && (
                            <CardContent className="p-8 space-y-8 animate-in slide-in-from-top-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="grid gap-3"><Label className="font-bold mr-1">تاريخ بداية رمضان</Label><DateInput value={ramadanSchedule.start_date} onChange={(d) => setRamadanSchedule(p => ({ ...p, start_date: d }))} /></div>
                                    <div className="grid gap-3"><Label className="font-bold mr-1">تاريخ نهاية رمضان</Label><DateInput value={ramadanSchedule.end_date} onChange={(d) => setRamadanSchedule(p => ({ ...p, end_date: d }))} /></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="grid gap-3"><Label className="font-bold mr-1">يبدأ الدوام الساعة</Label><Input type="time" value={ramadanSchedule.start_time} onChange={(e) => setRamadanSchedule(p => ({ ...p, start_time: e.target.value }))} className="h-11 rounded-xl border-2 font-bold font-mono"/></div>
                                    <div className="grid gap-3"><Label className="font-bold mr-1">ينتهي الدوام الساعة</Label><Input type="time" value={ramadanSchedule.end_time} onChange={(e) => setRamadanSchedule(p => ({ ...p, end_time: e.target.value }))} className="h-11 rounded-xl border-2 font-bold font-mono"/></div>
                                </div>
                            </CardContent>
                        )}
                    </Card>

                    <Card className="rounded-[2.5rem] border-none shadow-lg overflow-hidden bg-white p-10">
                        <div className="grid md:grid-cols-2 gap-12">
                            <div className="space-y-6">
                                <Label className="font-black text-xl text-primary flex items-center gap-2 border-r-4 border-primary pr-3">أيام العطلة الأسبوعية (OFF)</Label>
                                <div className="flex flex-wrap gap-6">
                                    {weekDays.map(day => (
                                        <div key={day.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-xl transition-colors">
                                            <Checkbox id={`h-${day.id}`} checked={holidays.includes(day.id)} onCheckedChange={(c) => setHolidays(prev => c ? [...prev, day.id] : prev.filter(h => h !== day.id))} className="h-5 w-5" />
                                            <Label htmlFor={`h-${day.id}`} className="font-bold text-gray-700 cursor-pointer">{day.label}</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-6">
                                <Label className="font-black text-xl text-primary flex items-center gap-2 border-r-4 border-primary pr-3">يوم نصف الدوام (Half Day)</Label>
                                <div className="space-y-4">
                                    <Select value={halfDay.day || '_NONE_'} onValueChange={(d) => setHalfDay(p => ({...p, day: d === '_NONE_' ? '' : d}))}>
                                        <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="اختر اليوم..." /></SelectTrigger>
                                        <SelectContent dir="rtl">
                                            <SelectItem value="_NONE_">لا يوجد يوم نصف دوام</SelectItem>
                                            {weekDays.filter(d => !holidays.includes(d.id)).map(day => <SelectItem key={day.id} value={day.id}>{day.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    {halfDay.day && (
                                        <div className="animate-in fade-in zoom-in-95 p-4 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20 space-y-4">
                                            <Label className="text-[10px] font-black uppercase text-primary">طريقة معالجة نصف الدوام:</Label>
                                            <RadioGroup value={halfDay.type} onValueChange={(v: any) => setHalfDay(p => ({...p, type: v}))} className="grid grid-cols-2 gap-4">
                                                <div className="flex items-center gap-2 bg-white p-3 rounded-xl border shadow-sm cursor-pointer">
                                                    <RadioGroupItem value="morning_only" id="m-only" /><Label htmlFor="m-only" className="text-xs font-bold cursor-pointer">صباحي فقط</Label>
                                                </div>
                                                <div className="flex items-center gap-2 bg-white p-3 rounded-xl border shadow-sm cursor-pointer">
                                                    <RadioGroupItem value="custom_end_time" id="c-end" /><Label htmlFor="c-end" className="text-xs font-bold cursor-pointer">وقت محدد</Label>
                                                </div>
                                            </RadioGroup>
                                            {halfDay.type === 'custom_end_time' && (
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-xs font-bold">ينتهي العمل الساعة:</Label>
                                                    <Input type="time" value={halfDay.end_time} onChange={e => setHalfDay(p => ({...p, end_time: e.target.value}))} className="w-32 rounded-lg font-mono font-bold" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>

                    <div className="flex justify-end">
                        <Button onClick={handleSaveGlobal} disabled={isSaving} className="h-14 px-16 rounded-2xl font-black text-xl gap-3 shadow-2xl shadow-primary/30 transition-all">
                            {isSaving ? <Loader2 className="animate-spin h-6 w-6"/> : <Save className="h-6 w-6" />}
                            حفظ إعدادات التقويم المركزية
                        </Button>
                    </div>
                </TabsContent>

                <TabsContent value="shifts" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-sm border gap-6">
                        <div className="space-y-1 text-center md:text-right">
                            <h3 className="text-2xl font-black text-gray-800">سجل ورديات الموظفين</h3>
                            <p className="text-base font-medium text-muted-foreground">تستخدم هذه المسميات لحساب التأخير والغياب في مسيرات الرواتب.</p>
                        </div>
                        <Button onClick={() => openShiftDialog()} className="h-12 px-8 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-primary/20">
                            <PlusCircle className="h-6 w-6" /> إضافة وردية جديدة
                        </Button>
                    </div>

                    <div className="border-2 rounded-[3rem] overflow-hidden shadow-xl bg-white">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="border-none">
                                    <TableHead className="px-10 py-6 font-black text-primary text-base">اسم الوردية</TableHead>
                                    <TableHead className="font-black text-primary text-base">وقت البداية (التأخير)</TableHead>
                                    <TableHead className="font-black text-primary text-base">وقت نهاية الدوام</TableHead>
                                    <TableHead className="text-center font-black text-primary text-base">الإجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {shiftsLoading ? <TableRow><TableCell colSpan={4} className="text-center p-12"><Loader2 className="animate-spin mx-auto text-primary h-8 w-8"/></TableCell></TableRow> :
                                shifts.length === 0 ? <TableRow><TableCell colSpan={4} className="h-64 text-center text-muted-foreground italic font-bold">لا توجد ورديات معرفة حالياً.</TableCell></TableRow> :
                                shifts.map(shift => (
                                    <TableRow key={shift.id} className="hover:bg-primary/5 transition-colors h-20 border-b last:border-0">
                                        <TableCell className="px-10 font-black text-lg text-gray-800">{shift.name}</TableCell>
                                        <TableCell className="font-mono font-black text-2xl text-primary">{shift.startTime}</TableCell>
                                        <TableCell className="font-mono font-black text-2xl">{shift.endTime}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex justify-center gap-3">
                                                <Button variant="ghost" size="icon" onClick={() => openShiftDialog(shift)} className="h-11 w-11 rounded-2xl border shadow-sm hover:bg-white"><Pencil className="h-5 w-5"/></Button>
                                                <Button variant="ghost" size="icon" onClick={async () => { if(confirm('حذف الوردية؟')) await deleteDoc(doc(firestore!, 'work_shifts', shift.id!)) }} className="h-11 w-11 rounded-2xl border shadow-sm text-destructive hover:bg-red-50"><Trash2 className="h-5 w-5"/></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Shift Dialog */}
            <Dialog open={isShiftDialogOpen} onOpenChange={setIsShiftDialogOpen}>
                <DialogContent dir="rtl" className="max-w-md rounded-[2.5rem] shadow-2xl p-8 border-none">
                    <form onSubmit={(e) => { e.preventDefault(); handleSaveShift(); }}>
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl text-primary"><Clock className="h-6 w-6"/></div>
                                {editingShift ? 'تعديل الوردية' : 'إضافة وردية دوام'}
                            </DialogTitle>
                            <DialogDescription className="font-medium">حدد مسمى الوردية وساعات العمل لحساب الالتزام بالدوام.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-8 py-8">
                            <div className="grid gap-2">
                                <Label className="font-black text-gray-700 pr-1">مسمى الوردية (مثال: الفترة الصباحية) *</Label>
                                <Input value={shiftFormData.name} onChange={e => setShiftFormData(p => ({...p, name: e.target.value}))} required className="h-12 rounded-2xl border-2 font-bold text-lg shadow-inner" />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="grid gap-2">
                                    <Label className="font-black text-gray-700 pr-1">يبدأ العمل الساعة *</Label>
                                    <Input type="time" value={shiftFormData.startTime} onChange={e => setShiftFormData(p => ({...p, startTime: e.target.value}))} required className="h-12 rounded-2xl border-2 font-black text-xl shadow-inner text-primary" />
                                </div>
                                <div className="grid gap-2">
                                    <Label className="font-black text-gray-700 pr-1">ينتهي العمل الساعة *</Label>
                                    <Input type="time" value={shiftFormData.endTime} onChange={e => setShiftFormData(p => ({...p, endTime: e.target.value}))} required className="h-12 rounded-2xl border-2 font-black text-xl shadow-inner" />
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="gap-3 pt-4 border-t">
                            <Button type="button" variant="ghost" onClick={() => setIsShiftDialogOpen(false)} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
                            <Button type="submit" disabled={isSaving} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/20">
                                {isSaving ? <Loader2 className="animate-spin h-5 w-5"/> : <Save className="h-5 w-5" />}
                                حفظ الوردية
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
