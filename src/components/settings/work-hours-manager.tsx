'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBranding, type BrandingSettings } from '@/context/branding-context';
import { useFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Switch } from '../ui/switch';
import { DateInput } from '../ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';

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

// الترتيب المتوافق مع getDay() (0 = الأحد)
const weekDays = [
    { id: 'Sunday', label: 'الأحد' },
    { id: 'Monday', label: 'الاثنين' },
    { id: 'Tuesday', label: 'الثلاثاء' },
    { id: 'Wednesday', label: 'الأربعاء' },
    { id: 'Thursday', label: 'الخميس' },
    { id: 'Friday', label: 'الجمعة' },
    { id: 'Saturday', label: 'السبت' },
];

const ScheduleForm = ({ schedule, setSchedule }: { schedule: typeof defaultSchedule, setSchedule: any }) => (
    <div className="space-y-6">
        <div>
            <h4 className="font-medium text-muted-foreground mb-4">الفترة الصباحية</h4>
            <div className="grid grid-cols-2 gap-4">
                 <div className="grid gap-2">
                    <Label>من الساعة</Label>
                    <Input type="time" value={schedule.morning_start_time} onChange={(e) => setSchedule((p:any) => ({ ...p, morning_start_time: e.target.value }))} className="rounded-xl"/>
                </div>
                <div className="grid gap-2">
                    <Label>إلى الساعة</Label>
                    <Input type="time" value={schedule.morning_end_time} onChange={(e) => setSchedule((p:any) => ({ ...p, morning_end_time: e.target.value }))} className="rounded-xl"/>
                </div>
            </div>
        </div>
        <div>
            <h4 className="font-medium text-muted-foreground mb-4">الفترة المسائية</h4>
            <div className="grid grid-cols-2 gap-4">
                 <div className="grid gap-2">
                    <Label>من الساعة</Label>
                    <Input type="time" value={schedule.evening_start_time} onChange={(e) => setSchedule((p:any) => ({ ...p, evening_start_time: e.target.value }))} className="rounded-xl"/>
                </div>
                <div className="grid gap-2">
                    <Label>إلى الساعة</Label>
                    <Input type="time" value={schedule.evening_end_time} onChange={(e) => setSchedule((p:any) => ({ ...p, evening_end_time: e.target.value }))} className="rounded-xl"/>
                </div>
            </div>
        </div>
        <Separator/>
        <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
                <Label>مدة كل موعد (بالدقائق)</Label>
                <Input type="number" min="15" step="5" value={schedule.appointment_slot_duration} onChange={(e) => setSchedule((p:any) => ({ ...p, appointment_slot_duration: e.target.value }))} className="rounded-xl"/>
            </div>
             <div className="grid gap-2">
                <Label>فترة الراحة بين المواعيد (بالدقائق)</Label>
                <Input type="number" min="0" step="5" value={schedule.appointment_buffer_time} onChange={(e) => setSchedule((p:any) => ({ ...p, appointment_buffer_time: e.target.value }))} className="rounded-xl"/>
            </div>
        </div>
    </div>
);

export function WorkHoursManager() {
    const { firestore } = useFirebase();
    const { branding, loading } = useBranding();
    const { toast } = useToast();
    
    const [generalSchedule, setGeneralSchedule] = useState(defaultSchedule);
    const [architecturalSchedule, setArchitecturalSchedule] = useState(defaultSchedule);
    const [holidays, setHolidays] = useState<string[]>([]);
    const [halfDay, setHalfDay] = useState(defaultHalfDay);
    const [ramadanSchedule, setRamadanSchedule] = useState(defaultRamadanSchedule);

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (branding?.work_hours) {
            const wh = branding.work_hours;
            setGeneralSchedule({ ...defaultSchedule, ...wh.general });
            setArchitecturalSchedule({ ...defaultSchedule, ...wh.architectural });
            setHolidays(wh.holidays || []);
            setHalfDay({ ...defaultHalfDay, ...wh.half_day });
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
    
    const handleSave = async () => {
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
            toast({ title: 'نجاح', description: 'تم حفظ إعدادات الدوام والمواعيد.' });
        } catch (error) {
            console.error("Error saving work hours:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الإعدادات.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <Card className="rounded-3xl shadow-sm border-none">
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64 mt-2" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-32" />
                </CardContent>
                <CardFooter className="flex justify-end">
                    <Skeleton className="h-10 w-28" />
                </CardFooter>
            </Card>
        )
    }

    return (
        <Card className="rounded-3xl shadow-sm border-none">
            <CardHeader>
                <CardTitle>إعدادات الدوام والمواعيد</CardTitle>
                <CardDescription>
                    حدد أوقات العمل الرسمية وأيام العطل لتحديث جداول الحجوزات في النظام.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="rounded-2xl border-2">
                        <CardHeader>
                            <CardTitle className="text-lg">الدوام العام (للقاعات)</CardTitle>
                            <CardDescription>تطبق على حجز قاعات الاجتماعات والأقسام العامة.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScheduleForm schedule={generalSchedule} setSchedule={setGeneralSchedule} />
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-2 border-primary/10 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">دوام القسم المعماري</CardTitle>
                            <CardDescription>أوقات مخصصة لزيارات العملاء مع المهندسين المعماريين.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScheduleForm schedule={architecturalSchedule} setSchedule={setArchitecturalSchedule} />
                        </CardContent>
                    </Card>
                 </div>
                 
                 <Card className="rounded-2xl border-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-lg">أوقات دوام شهر رمضان</CardTitle>
                                <CardDescription>تفعيل وتخصيص أوقات العمل والمواعيد خلال شهر رمضان.</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Label htmlFor="ramadan-enabled" className="text-xs font-bold">تعطيل/تفعيل</Label>
                                <Switch
                                    id="ramadan-enabled"
                                    checked={ramadanSchedule.is_enabled}
                                    onCheckedChange={(checked) => setRamadanSchedule(p => ({ ...p, is_enabled: checked }))}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    {ramadanSchedule.is_enabled && (
                        <CardContent className="space-y-6 pt-4 animate-in slide-in-from-top-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>تاريخ بداية رمضان</Label>
                                    <DateInput value={ramadanSchedule.start_date} onChange={(date) => setRamadanSchedule(p => ({ ...p, start_date: date }))} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>تاريخ نهاية رمضان</Label>
                                    <DateInput value={ramadanSchedule.end_date} onChange={(date) => setRamadanSchedule(p => ({ ...p, end_date: date }))} />
                                </div>
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>من الساعة</Label>
                                    <Input type="time" value={ramadanSchedule.start_time} onChange={(e) => setRamadanSchedule(p => ({ ...p, start_time: e.target.value }))} className="rounded-xl"/>
                                </div>
                                <div className="grid gap-2">
                                    <Label>إلى الساعة</Label>
                                    <Input type="time" value={ramadanSchedule.end_time} onChange={(e) => setRamadanSchedule(p => ({ ...p, end_time: e.target.value }))} className="rounded-xl"/>
                                </div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>مدة كل موعد (بالدقائق)</Label>
                                    <Input type="number" min="15" step="5" value={ramadanSchedule.appointment_slot_duration} onChange={(e) => setRamadanSchedule(p => ({ ...p, appointment_slot_duration: Number(e.target.value) }))} className="rounded-xl"/>
                                </div>
                                <div className="grid gap-2">
                                    <Label>فترة الراحة بين المواعيد (بالدقائق)</Label>
                                    <Input type="number" min="0" step="5" value={ramadanSchedule.appointment_buffer_time} onChange={(e) => setRamadanSchedule(p => ({ ...p, appointment_buffer_time: Number(e.target.value) }))} className="rounded-xl"/>
                                </div>
                            </div>
                        </CardContent>
                    )}
                </Card>

                <div className="space-y-4 pt-6 border-t">
                    <h3 className="font-semibold text-lg">إعدادات أيام الأسبوع</h3>
                    <div className="p-6 border-2 rounded-2xl space-y-4">
                        <Label className="font-bold">أيام العطلة الأسبوعية</Label>
                         <div className="flex flex-wrap gap-x-8 gap-y-4 pt-2">
                            {weekDays.map(day => (
                                <div key={day.id} className="flex items-center space-x-2 rtl:space-x-reverse">
                                    <Checkbox
                                        id={`holiday-${day.id}`}
                                        checked={holidays.includes(day.id)}
                                        onCheckedChange={(checked) => {
                                            setHolidays(prev => 
                                                checked ? [...prev, day.id] : prev.filter(h => h !== day.id)
                                            );
                                        }}
                                    />
                                    <Label htmlFor={`holiday-${day.id}`} className="cursor-pointer font-medium">{day.label}</Label>
                                </div>
                            ))}
                        </div>
                    </div>

                     <div className="p-6 border-2 rounded-2xl space-y-4">
                        <Label className="font-bold">يوم نصف الدوام (اختياري)</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            <div className="grid gap-2">
                                <Label className="text-xs text-muted-foreground">اختر اليوم:</Label>
                                <Select 
                                    value={halfDay.day || '_NONE_'} 
                                    onValueChange={(d) => setHalfDay(p => ({...p, day: d === '_NONE_' ? '' : d}))}
                                >
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="اختر اليوم..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_NONE_">لا يوجد</SelectItem>
                                        {weekDays.filter(d => !holidays.includes(d.id)).map(day => (
                                            <SelectItem key={day.id} value={day.id}>{day.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <RadioGroup
                                value={halfDay.type}
                                onValueChange={(value: "morning_only" | "custom_end_time") => setHalfDay(p => ({...p, type: value}))}
                                disabled={!halfDay.day}
                                className="flex items-center space-x-6 rtl:space-x-reverse pt-6"
                            >
                                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                    <RadioGroupItem value="morning_only" id="r1" />
                                    <Label htmlFor="r1" className="cursor-pointer">دوام صباحي فقط</Label>
                                </div>
                                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                    <RadioGroupItem value="custom_end_time" id="r2" />
                                    <Label htmlFor="r2" className="cursor-pointer">وقت انتهاء مخصص</Label>
                                </div>
                            </RadioGroup>
                        </div>
                        {halfDay.day && halfDay.type === 'custom_end_time' && (
                            <div className="grid gap-2 max-w-xs animate-in slide-in-from-top-2">
                                <Label htmlFor="half-day-end-time" className="text-xs text-muted-foreground">وقت انتهاء الدوام</Label>
                                <Input 
                                    id="half-day-end-time"
                                    type="time"
                                    value={halfDay.end_time}
                                    onChange={(e) => setHalfDay(p => ({...p, end_time: e.target.value}))}
                                    className="rounded-xl"
                                />
                            </div>
                        )}
                    </div>
                </div>

            </CardContent>
            <CardFooter className="flex justify-end pt-6 border-t bg-muted/10 p-6">
                <Button onClick={handleSave} disabled={isSaving} className="rounded-xl h-12 px-10 font-bold gap-2 shadow-lg">
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
                    حفظ إعدادات المواعيد
                </Button>
            </CardFooter>
        </Card>
    );
}
