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
import { Loader2, Save, Clock } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

const defaultWorkHours = {
    morning_start_time: '08:00',
    morning_end_time: '12:00',
    evening_start_time: '13:00',
    evening_end_time: '17:00',
    appointment_slot_duration: 30,
};

export function WorkHoursManager() {
    const { firestore } = useFirebase();
    const { branding, loading } = useBranding();
    const { toast } = useToast();
    
    const [formData, setFormData] = useState(defaultWorkHours);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (branding?.work_hours) {
            setFormData({ ...defaultWorkHours, ...branding.work_hours });
        }
    }, [branding]);

    const handleFieldChange = (field: keyof typeof formData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };
    
    const handleSave = async () => {
        if (!firestore) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بالخدمات السحابية.'});
            return;
        }

        setIsSaving(true);
        
        try {
            const dataToSave = {
                work_hours: {
                    ...formData,
                    appointment_slot_duration: Number(formData.appointment_slot_duration) || 30,
                }
            };

            const settingsRef = doc(firestore, 'company_settings', 'main');
            await setDoc(settingsRef, dataToSave, { merge: true });
            
            toast({ title: 'نجاح', description: 'تم حفظ إعدادات الدوام والمواعيد بنجاح.' });

        } catch (error: any) {
            console.error("Error saving work hours settings:", error);
            const errorMessage = error.code ? `رمز الخطأ: ${error.code}` : error.message;
            toast({ 
                variant: 'destructive', 
                title: 'فشل الحفظ', 
                description: `حدث خطأ أثناء حفظ البيانات. ${errorMessage}`
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64 mt-2" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
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
                    حدد أوقات العمل الرسمية ومدة المواعيد لتحديث جداول الحجوزات في النظام.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                     <div className="grid gap-2">
                        <Label htmlFor="morning_start_time">بداية الفترة الصباحية</Label>
                        <Input id="morning_start_time" type="time" value={formData.morning_start_time} onChange={(e) => handleFieldChange('morning_start_time', e.target.value)} />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="morning_end_time">نهاية الفترة الصباحية</Label>
                        <Input id="morning_end_time" type="time" value={formData.morning_end_time} onChange={(e) => handleFieldChange('morning_end_time', e.target.value)} />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="evening_start_time">بداية الفترة المسائية</Label>
                        <Input id="evening_start_time" type="time" value={formData.evening_start_time} onChange={(e) => handleFieldChange('evening_start_time', e.target.value)} />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="evening_end_time">نهاية الفترة المسائية</Label>
                        <Input id="evening_end_time" type="time" value={formData.evening_end_time} onChange={(e) => handleFieldChange('evening_end_time', e.target.value)} />
                    </div>
                 </div>
                 <div className="grid gap-2 max-w-xs">
                    <Label htmlFor="appointment_slot_duration">مدة الموعد (بالدقائق)</Label>
                    <Input id="appointment_slot_duration" type="number" min="15" step="5" value={formData.appointment_slot_duration} onChange={(e) => handleFieldChange('appointment_slot_duration', e.target.value)} />
                </div>
            </CardContent>
            <CardFooter className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
                    {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </Button>
            </CardFooter>
        </Card>
    );
}