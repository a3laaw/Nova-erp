'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useBranding, type BrandingSettings } from '@/context/branding-context';
import { useFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Clock, RotateCcw, ArrowRight, CalendarDays, Sparkles, Moon } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { DateInput } from '@/components/ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';
import { cn, cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/context/auth-context';

const defaultSchedule = {
    morning_start_time: '08:00',
    morning_end_time: '12:00',
    evening_start_time: '13:00',
    evening_end_time: '17:00',
    appointment_slot_duration: 30,
    appointment_buffer_time: 0,
};

const weekDays = [
    { id: 'Saturday', label: 'السبت' },
    { id: 'Sunday', label: 'الأحد' },
    { id: 'Monday', label: 'الاثنين' },
    { id: 'Tuesday', label: 'الثلاثاء' },
    { id: 'Wednesday', label: 'الأربعاء' },
    { id: 'Thursday', label: 'الخميس' },
    { id: 'Friday', label: 'الجمعة' },
];

const ScheduleSection = ({ title, schedule, setSchedule, icon: Icon }: any) => (
    <div className="space-y-6 p-6 border-2 border-dashed rounded-[2rem] bg-muted/5 group hover:border-primary/30 transition-all text-foreground">
        <h4 className="font-black text-sm text-primary uppercase tracking-widest flex items-center gap-2">
            <Icon className="h-4 w-4" /> {title}
        </h4>
        <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4 text-center">
                <p className="text-[10px] font-black text-muted-foreground uppercase">الفترة الصباحية</p>
                <div className="flex gap-2">
                    <Input type="time" value={schedule.morning_start_time} onChange={e => setSchedule({ ...schedule, morning_start_time: e.target.value })} className="h-10 rounded-xl border-2 text-center font-bold bg-background" />
                    <Input type="time" value={schedule.morning_end_time} onChange={e => setSchedule({ ...schedule, morning_end_time: e.target.value })} className="h-10 rounded-xl border-2 text-center font-bold bg-background" />
                </div>
            </div>
            <div className="space-y-4 text-center">
                <p className="text-[10px] font-black text-muted-foreground uppercase">الفترة المسائية</p>
                <div className="flex gap-2">
                    <Input type="time" value={schedule.evening_start_time} onChange={e => setSchedule({ ...schedule, evening_start_time: e.target.value })} className="h-10 rounded-xl border-2 text-center font-bold bg-background" />
                    <Input type="time" value={schedule.evening_end_time} onChange={e => setSchedule({ ...schedule, evening_end_time: e.target.value })} className="h-10 rounded-xl border-2 text-center font-bold bg-background" />
                </div>
            </div>
        </div>
        <div className="grid grid-cols-2 gap-6 pt-2">
            <div className="grid gap-1.5">
                <Label className="text-[10px] font-black mr-1 text-muted-foreground">مدة الموعد (دقيقة)</Label>
                <Input type="number" value={schedule.appointment_slot_duration} onChange={e => setSchedule({ ...schedule, appointment_slot_duration: parseInt(e.target.value) || 30 })} className="h-10 rounded-xl border-2 text-center font-black bg-background" />
            </div>
            <div className="grid gap-1.5">
                <Label className="text-[10px] font-black mr-1 text-muted-foreground">فترة الراحة (Buffer)</Label>
                <Input type="number" value={schedule.appointment_buffer_time} onChange={e => setSchedule({ ...schedule, appointment_buffer_time: parseInt(e.target.value) || 0 })} className="h-10 rounded-xl border-2 text-center font-black bg-background" />
            </div>
        </div>
    </div>
);

export function WorkHoursManager() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { branding, loading } = useBranding();
    const { toast } = useToast();
    const router = useRouter();
    
    const [generalSchedule, setGeneralSchedule] = useState(defaultSchedule);
    const [architecturalSchedule, setArchitecturalSchedule] = useState(defaultSchedule);
    const [holidays, setHolidays] = useState<string[]>([]);
    const [halfDay, setHalfDay] = useState({ day: '', type: 'morning_only', end_time: '13:00' });
    const [ramadan, setRamadan] = useState({ is_enabled: false, start_date: undefined as any, end_date: undefined as any, start_time: '09:00', end_time: '15:00' });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (branding?.work_hours) {
            const wh = branding.work_hours;
            if (wh.general) setGeneralSchedule(wh.general);
            if (wh.architectural) setArchitecturalSchedule(wh.architectural);
            if (wh.holidays) setHolidays(wh.holidays);
            if (wh.half_day) setHalfDay(wh.half_day);
            if (wh.ramadan) setRamadan({ ...wh.ramadan, start_date: toFirestoreDate(wh.ramadan.start_date) || undefined, end_date: toFirestoreDate(wh.ramadan.end_date) || undefined });
        }
    }, [branding]);

    const handleSave = async () => {
        if (!firestore || !currentUser?.currentCompanyId) return;
        setIsSaving(true);
        try {
            const tenantId = currentUser.currentCompanyId;
            // 🛡️ توجيه المسار إلى المجلد المعزول للمنشأة
            const settingsPath = getTenantPath('settings/branding', tenantId);
            const settingsRef = doc(firestore, settingsPath);

            const data = {
                work_hours: {
                    general: generalSchedule,
                    architectural: architecturalSchedule,
                    holidays,
                    half_day: halfDay,
                    ramadan: { ...ramadan, start_date: ramadan.start_date || null, end_date: ramadan.end_date || null }
                }
            };
            await setDoc(settingsRef, cleanFirestoreData(data), { merge: true });
            toast({ title: 'نجاح الحفظ', description: 'تم تحديث قواعد الدوام والمواعيد بنجاح.' });
        } catch (e: any) {
            console.error("Save failed:", e);
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: e.message || 'يرجى مراجعة الصلاحيات.' });
        } finally { setIsSaving(false); }
    };

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-orange-50 dark:from-slate-900/60 dark:to-orange-950/20">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-orange-600/10 rounded-2xl text-orange-600 shadow-inner"><Clock className="h-8 w-8" /></div>
                            <div>
                                <CardTitle className="text-2xl font-black text-foreground">إدارة أوقات الدوام الرسمية</CardTitle>
                                <CardDescription className="text-base font-medium text-muted-foreground">تخصيص ساعات العمل، العطل الأسبوعية، وبروتوكول شهر رمضان.</CardDescription>
                            </div>
                        </div>
                        <Button onClick={() => router.back()} variant="ghost" className="rounded-xl font-bold gap-2 text-foreground hover:bg-white/10 no-print">
                            <ArrowRight className="h-4 w-4" /> العودة
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl">
                    <CardHeader className="bg-muted/10 border-b p-8"><CardTitle className="text-xl font-black flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary"/> الدوام العام (القاعات)</CardTitle></CardHeader>
                    <CardContent className="p-8"><ScheduleSection title="مواعيد القاعات" schedule={generalSchedule} setSchedule={setGeneralSchedule} icon={Clock} /></CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl">
                    <CardHeader className="bg-primary/5 border-b p-8"><CardTitle className="text-xl font-black text-primary flex items-center gap-2"><Sparkles className="h-5 w-5"/> دوام القسم المعماري</CardTitle></CardHeader>
                    <CardContent className="p-8"><ScheduleSection title="مواعيد المهندسين" schedule={architecturalSchedule} setSchedule={setArchitecturalSchedule} icon={Clock} /></CardContent>
                </Card>
            </div>

            <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl">
                <CardHeader className="bg-indigo-900 text-white p-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-right">
                            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20"><Moon className="h-8 w-8 text-indigo-200" /></div>
                            <div>
                                <CardTitle className="text-2xl font-black">بروتوكول شهر رمضان المبارك</CardTitle>
                                <CardDescription className="text-indigo-200 font-bold">تفعيل قواعد المواعيد الاستثنائية خلال الشهر الكريم.</CardDescription>
                            </div>
                        </div>
                        <Switch checked={ramadan.is_enabled} onCheckedChange={v => setRamadan({...ramadan, is_enabled: v})} className="data-[state=checked]:bg-indigo-400" />
                    </div>
                </CardHeader>
                {ramadan.is_enabled && (
                    <CardContent className="p-10 space-y-8 animate-in slide-in-from-top-4">
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="grid gap-2"><Label className="font-black text-indigo-900 dark:text-indigo-200 pr-1">تاريخ البداية</Label><DateInput value={ramadan.start_date} onChange={d => setRamadan({...ramadan, start_date: d})} className="h-12 rounded-xl bg-background" /></div>
                            <div className="grid gap-2"><Label className="font-black text-indigo-900 dark:text-indigo-200 pr-1">تاريخ النهاية</Label><DateInput value={ramadan.end_date} onChange={d => setRamadan({...ramadan, end_date: d})} className="h-12 rounded-xl bg-background" /></div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-8 p-8 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-[2rem] border-2 border-dashed border-indigo-200">
                             <div className="grid gap-2 text-center">
                                <Label className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">يبدأ الدوام الساعة</Label>
                                <Input type="time" value={ramadan.start_time} onChange={e => setRamadan({...ramadan, start_time: e.target.value})} className="h-12 rounded-2xl border-2 text-2xl font-black text-center text-indigo-950 bg-background" />
                             </div>
                             <div className="grid gap-2 text-center">
                                <Label className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">ينتهي الدوام الساعة</Label>
                                <Input type="time" value={ramadan.end_time} onChange={e => setRamadan({...ramadan, end_time: e.target.value})} className="h-12 rounded-2xl border-2 text-2xl font-black text-center text-indigo-950 bg-background" />
                             </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-10">
                <div className="grid md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                        <h3 className="font-black text-xl border-r-8 border-primary pr-4 flex items-center gap-2 text-foreground">أيام العطلة الأسبوعية (OFF)</h3>
                        <div className="flex flex-wrap gap-4">
                            {weekDays.map(day => (
                                <div key={day.id} className="flex items-center gap-2 p-3 bg-muted/20 rounded-2xl border hover:bg-muted/40 transition-all cursor-pointer">
                                    <Checkbox id={`h-${day.id}`} checked={holidays.includes(day.id)} onCheckedChange={c => setHolidays(prev => c ? [...prev, day.id] : prev.filter(h => h !== day.id))} />
                                    <Label htmlFor={`h-${day.id}`} className="font-bold cursor-pointer text-foreground">{day.label}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-6">
                        <h3 className="font-black text-xl border-r-8 border-primary pr-4 flex items-center gap-2 text-primary">يوم نصف الدوام (Half Day)</h3>
                        <div className="space-y-4">
                            <Select value={halfDay.day || '_NONE_'} onValueChange={v => setHalfDay({...halfDay, day: v === '_NONE_' ? '' : v})}>
                                <SelectTrigger className="h-12 rounded-2xl border-2 font-bold bg-background"><SelectValue placeholder="اختر اليوم..." /></SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="_NONE_">لا يوجد يوم نصف دوام</SelectItem>
                                    {weekDays.filter(d => !holidays.includes(d.id)).map(day => <SelectItem key={day.id} value={day.id}>{day.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {halfDay.day && (
                                <div className="p-6 bg-primary/5 rounded-[2rem] border-2 border-dashed border-primary/20 animate-in zoom-in-95 space-y-4">
                                    <Label className="text-[10px] font-black uppercase text-primary">نوع المعالجة:</Label>
                                    <RadioGroup value={halfDay.type} onValueChange={v => setHalfDay({...halfDay, type: v})} className="grid grid-cols-2 gap-4">
                                        <div className="flex items-center gap-2 bg-background p-3 rounded-xl border shadow-sm"><RadioGroupItem value="morning_only" id="m-only" /><Label htmlFor="m-only" className="text-xs font-bold text-foreground">صباحي فقط</Label></div>
                                        <div className="flex items-center gap-2 bg-background p-3 rounded-xl border shadow-sm"><RadioGroupItem value="custom_end_time" id="c-end" /><Label htmlFor="c-end" className="text-xs font-bold text-foreground">وقت محدد</Label></div>
                                    </RadioGroup>
                                    {halfDay.type === 'custom_end_time' && <div className="flex items-center gap-2"><Label className="text-xs font-bold text-foreground">ينتهي الدوام:</Label><Input type="time" value={halfDay.end_time} onChange={e => setHalfDay({...halfDay, end_time: e.target.value})} className="w-32 h-10 rounded-xl font-black text-center bg-background" /></div>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            <div className="flex justify-end pb-20 no-print">
                <Button onClick={handleSave} disabled={isSaving} className="h-16 px-20 rounded-[2.5rem] font-black text-2xl shadow-xl shadow-primary/30 gap-4 transition-all active:translate-y-1">
                    {isSaving ? <Loader2 className="animate-spin h-6 w-6"/> : <Save className="h-6 w-6"/>} حفظ كافة قواعد المواعيد
                </Button>
            </div>
        </div>
    );
}

