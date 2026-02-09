
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBranding } from '@/context/branding-context';
import { useFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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
    end_time: '13:00',
};

const weekDays: { id: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday', label: string }[] = [
    { id: 'Saturday', label: 'السبت' },
    { id: 'Sunday', label: 'الأحد' },
    { id: 'Monday', label: 'الاثنين' },
    { id: 'Tuesday', label: 'الثلاثاء' },
    { id: 'Wednesday', label: 'الأربعاء' },
    { id: 'Thursday', label: 'الخميس' },
    { id: 'Friday', label: 'الجمعة' },
];

export function WorkHoursManager() {
    const { firestore } = useFirebase();
    const { branding, loading } = useBranding();
    const { toast } = useToast();
    
    const [generalSchedule, setGeneralSchedule] = useState(defaultSchedule);
    const [architecturalSchedule, setArchitecturalSchedule] = useState(defaultSchedule);
    const [holidays, setHolidays] = useState<string[]>([]);
    const [halfDay, setHalfDay] = useState(defaultHalfDay);

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (branding?.work_hours) {
            setGeneralSchedule({ ...defaultSchedule, ...branding.work_hours.general });
            setArchitecturalSchedule({ ...defaultSchedule, ...branding.work_hours.architectural });
            setHolidays(branding.work_hours.holidays || []);
            setHalfDay({ ...defaultHalfDay, ...branding.work_hours.half_day });
        }
    }, [branding]);
    
    const handleSave = async () => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            const dataToSave = {
                work_hours: {
                    general: { ...generalSchedule, appointment_slot_duration: Number(generalSchedule.appointment_slot_duration) },
                    architectural: { ...architecturalSchedule, appointment_slot_duration: Number(architecturalSchedule.appointment_slot_duration), appointment_buffer_time: Number(architecturalSchedule.appointment_buffer_time) },
                    holidays,
                    half_day: halfDay,
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
    
    const ScheduleForm = ({ schedule, setSchedule, showBuffer = false }: { schedule: typeof defaultSchedule, setSchedule: any, showBuffer?: boolean }) => (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="grid gap-2">
                    <Label>بداية الفترة الصباحية</Label>
                    <Input type="time" value={schedule.morning_start_time} onChange={(e) => setSchedule((p:any) => ({ ...p, morning_start_time: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                    <Label>نهاية الفترة الصباحية</Label>
                    <Input type="time" value={schedule.morning_end_time} onChange={(e) => setSchedule((p:any) => ({ ...p, morning_end_time: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                    <Label>بداية الفترة المسائية</Label>
                    <Input type="time" value={schedule.evening_start_time} onChange={(e) => setSchedule((p:any) => ({ ...p, evening_start_time: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                    <Label>نهاية الفترة المسائية</Label>
                    <Input type="time" value={schedule.evening_end_time} onChange={(e) => setSchedule((p:any) => ({ ...p, evening_end_time: e.target.value }))} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2 max-w-xs">
                    <Label>مدة الموعد (بالدقائق)</Label>
                    <Input type="number" min="15" step="5" value={schedule.appointment_slot_duration} onChange={(e) => setSchedule((p:any) => ({ ...p, appointment_slot_duration: e.target.value }))} />
                </div>
                {showBuffer && (
                     <div className="grid gap-2 max-w-xs">
                        <Label>فترة راحة بين المواعيد (بالدقائق)</Label>
                        <Input type="number" min="0" step="5" value={schedule.appointment_buffer_time} onChange={(e) => setSchedule((p:any) => ({ ...p, appointment_buffer_time: e.target.value }))} />
                    </div>
                )}
            </div>
        </div>
    );

    if (loading) {
        return (
            <Card>
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
        <Card>
            <CardHeader>
                <CardTitle>إعدادات الدوام والمواعيد</CardTitle>
                <CardDescription>
                    حدد أوقات العمل الرسمية وأيام العطل لتحديث جداول الحجوزات في النظام.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                 <Tabs defaultValue="general">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="general">الدوام العام (للقاعات)</TabsTrigger>
                        <TabsTrigger value="architectural">دوام القسم المعماري</TabsTrigger>
                    </TabsList>
                    <TabsContent value="general" className="mt-6">
                        <ScheduleForm schedule={generalSchedule} setSchedule={setGeneralSchedule} />
                    </TabsContent>
                    <TabsContent value="architectural" className="mt-6">
                        <ScheduleForm schedule={architecturalSchedule} setSchedule={setArchitecturalSchedule} showBuffer={true} />
                    </TabsContent>
                </Tabs>

                <div className="space-y-4 pt-6 border-t">
                    <h3 className="font-semibold text-lg">إعدادات أيام الأسبوع</h3>
                    <div className="p-4 border rounded-lg space-y-4">
                        <Label>أيام العطلة الأسبوعية</Label>
                         <div className="flex flex-wrap gap-x-6 gap-y-3">
                            {weekDays.map(day => (
                                <div key={day.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`holiday-${day.id}`}
                                        checked={holidays.includes(day.id)}
                                        onCheckedChange={(checked) => {
                                            setHolidays(prev => 
                                                checked ? [...prev, day.id] : prev.filter(h => h !== day.id)
                                            );
                                        }}
                                    />
                                    <Label htmlFor={`holiday-${day.id}`}>{day.label}</Label>
                                </div>
                            ))}
                        </div>
                    </div>

                     <div className="p-4 border rounded-lg space-y-4">
                        <Label>يوم نصف الدوام (اختياري)</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <Select value={halfDay.day} onValueChange={(d) => setHalfDay(p => ({...p, day: d}))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر اليوم..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">لا يوجد</SelectItem>
                                    {weekDays.filter(d => !holidays.includes(d.id)).map(day => (
                                        <SelectItem key={day.id} value={day.id}>{day.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input 
                                type="time"
                                value={halfDay.end_time}
                                onChange={(e) => setHalfDay(p => ({...p, end_time: e.target.value}))}
                                disabled={!halfDay.day}
                            />
                        </div>
                    </div>
                </div>

            </CardContent>
            <CardFooter className="flex justify-end pt-6 border-t">
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
                    {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </Button>
            </CardFooter>
        </Card>
    );
}


    