
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc, updateDoc, serverTimestamp, writeBatch, collection, getDoc, getDocs } from 'firebase/firestore';
import type { FieldVisit, ConstructionProject, BoqItem } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
    MapPin, 
    Loader2, 
    CheckCircle2, 
    XCircle, 
    Save, 
    ArrowRight, 
    Navigation, 
    ShieldCheck, 
    Clock, 
    ClipboardCheck, 
    Building2, 
    HardHat,
    AlertTriangle,
    History,
    TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * صفحة تفاصيل الزيارة الميدانية المطورة:
 * - تدعم نظام (تم / لم يتم) المباشر.
 * - تربط الإنجاز الفعلي ببنود المقايسة وتاريخ الجدولة.
 * - تقوم بتحديث نسبة إنجاز المشروع الإجمالية تلقائياً.
 */
export default function FieldVisitDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const [isSaving, setIsSaving] = useState(false);
    const [isCapturingLocation, setIsCapturingLocation] = useState(false);
    
    const [notes, setNotes] = useState('');
    const [progressAchieved, setProgressAchieved] = useState([0]); // Percentage
    const [cancellationReason, setCancellationReason] = useState('');
    const [location, setLocation] = useState<{ latitude: number, longitude: number, accuracy: number } | null>(null);
    
    const [isNotDoneAlertOpen, setIsNotDoneAlertOpen] = useState(false);

    const visitRef = useMemo(() => (firestore && id ? doc(firestore, 'field_visits', id) : null), [firestore, id]);
    const { data: visit, loading } = useDocument<FieldVisit>(firestore, visitRef?.path || null);

    useEffect(() => {
        if (visit?.confirmationData) {
            setNotes(visit.confirmationData.notes);
            setLocation(visit.confirmationData.location || null);
            setProgressAchieved([visit.confirmationData.progressAchieved || 0]);
        }
        if (visit?.cancellationReason) {
            setCancellationReason(visit.cancellationReason);
        }
    }, [visit]);

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            toast({ variant: 'destructive', title: 'غير مدعوم', description: 'متصفحك لا يدعم خاصية تحديد الموقع.' });
            return;
        }

        setIsCapturingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                });
                setIsCapturingLocation(false);
                toast({ title: 'تم التقاط الموقع', description: 'تم تحديد إحداثياتك الحالية بنجاح.' });
            },
            (error) => {
                console.error(error);
                setIsCapturingLocation(false);
                toast({ variant: 'destructive', title: 'فشل تحديد الموقع', description: 'يرجى تفعيل الـ GPS وإعطاء الصلاحية للمتصفح.' });
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleConfirmDone = async () => {
        if (!firestore || !visit || !currentUser) return;
        if (!notes.trim()) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى كتابة التقرير الفني قبل التأكيد.' });
            return;
        }

        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            
            // 1. تحديث سجل الزيارة
            batch.update(visitRef!, {
                status: 'confirmed',
                confirmationData: {
                    confirmedAt: serverTimestamp(),
                    notes,
                    location,
                    isCompleted: true,
                    progressAchieved: progressAchieved[0]
                }
            });

            // 2. تحديث بند المقايسة المرتبط (WBS)
            const projectRef = doc(firestore, 'projects', visit.projectId);
            const projectSnap = await getDoc(projectRef);
            
            if (projectSnap.exists() && visit.plannedStageId) {
                const projectData = projectSnap.data() as ConstructionProject;
                if (projectData.boqId) {
                    const boqItemRef = doc(firestore, `boqs/${projectData.boqId}/items`, visit.plannedStageId);
                    batch.update(boqItemRef, { progressPercentage: progressAchieved[0], updatedAt: serverTimestamp() });

                    // 3. إعادة حساب نسبة إنجاز المشروع الإجمالية
                    // ملاحظة: نقوم بهذا برمجياً كلقطة حالية لضمان الدقة
                    const allBoqItemsSnap = await getDocs(collection(firestore, `boqs/${projectData.boqId}/items`));
                    const leafItems = allBoqItemsSnap.docs
                        .map(d => d.data() as BoqItem)
                        .filter(i => !i.isHeader);
                    
                    const totalWeight = leafItems.reduce((sum, i) => sum + (i.quantity * i.sellingUnitPrice), 0);
                    const completedWeight = leafItems.reduce((sum, i) => {
                        const progress = i.id === visit.plannedStageId ? progressAchieved[0] : (i.progressPercentage || 0);
                        return sum + ((progress / 100) * (i.quantity * i.sellingUnitPrice));
                    }, 0);

                    const newTotalProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
                    batch.update(projectRef, { progressPercentage: newTotalProgress, updatedAt: serverTimestamp() });
                }
            }

            // 4. توثيق الحدث في تايم لاين المشروع
            const timelineRef = collection(projectRef, 'timelineEvents');
            batch.set(doc(timelineRef), {
                type: 'Visit',
                title: `إنجاز موقع: ${visit.plannedStageName}`,
                description: `${notes}\nنسبة الإنجاز المحققة لهذا البند: ${progressAchieved[0]}%`,
                date: serverTimestamp(),
                engineerName: visit.engineerName,
                location: location,
                createdAt: serverTimestamp()
            });

            await batch.commit();
            toast({ title: 'تم التوثيق', description: 'تم تحديث نسب الإنجاز الميدانية والمحاسبية بنجاح.' });
            router.push('/dashboard/construction/field-visits');
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ التوثيق.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleMarkNotDone = async () => {
        if (!firestore || !visit || !currentUser || !cancellationReason.trim()) return;

        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            batch.update(visitRef!, {
                status: 'cancelled',
                cancellationReason,
                cancelledAt: serverTimestamp(),
                cancelledBy: currentUser.id
            });

            const projectRef = doc(firestore, 'projects', visit.projectId);
            const timelineRef = collection(projectRef, 'timelineEvents');
            batch.set(doc(timelineRef), {
                type: 'log',
                title: 'زيارة غير مكتملة',
                description: `تعثر العمل المخطط لمرحلة (${visit.plannedStageName}). السبب: ${cancellationReason}`,
                date: serverTimestamp(),
                engineerName: visit.engineerName,
                createdAt: serverTimestamp()
            });

            await batch.commit();
            toast({ title: 'تم الإلغاء', description: 'تم أرشفة الزيارة كزيارة غير منفذة بنجاح.' });
            router.push('/dashboard/construction/field-visits');
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل معالجة الطلب.' });
        } finally {
            setIsSaving(false);
            setIsNotDoneAlertOpen(false);
        }
    };

    if (loading) return <div className="p-8 max-w-2xl mx-auto space-y-6"><Skeleton className="h-48 w-full rounded-3xl" /><Skeleton className="h-64 w-full rounded-3xl" /></div>;
    if (!visit) return <div className="text-center p-20">الزيارة غير موجودة.</div>;

    const scheduledDate = toFirestoreDate(visit.scheduledDate);
    const phaseEndDate = toFirestoreDate(visit.phaseEndDate);
    const isProcessed = visit.status !== 'planned';
    
    // التحقق من الانحراف الزمني (هل الزيارة بعد تاريخ انتهاء المرحلة المخطط؟)
    const isDelayed = scheduledDate && phaseEndDate && scheduledDate > phaseEndDate;

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20" dir="rtl">
            <div className="flex items-center justify-between px-2">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                    <ArrowRight className="h-4 w-4" /> العودة للخطة
                </Button>
                <div className="flex gap-2">
                    {isDelayed && !isProcessed && (
                        <Badge className="bg-red-100 text-red-700 border-red-200 font-black animate-pulse">
                            <AlertTriangle className="h-3 w-3 ml-1" /> تأخير عن الموعد المخطط
                        </Badge>
                    )}
                    {visit.status === 'confirmed' ? (
                        <Badge className="bg-green-600 font-black px-4 py-1 rounded-full gap-2 text-white">
                            <CheckCircle2 className="h-4 w-4" /> زيارة تمت بنجاح
                        </Badge>
                    ) : visit.status === 'cancelled' ? (
                        <Badge className="bg-red-600 font-black px-4 py-1 rounded-full gap-2 text-white">
                            <XCircle className="h-4 w-4" /> زيارة لم تتم (ملغاة)
                        </Badge>
                    ) : null}
                </div>
            </div>

            <Card className="rounded-[2.5rem] shadow-lg border-none overflow-hidden bg-card">
                <CardHeader className="bg-muted/30 pb-8 px-8 border-b">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black">{visit.clientName}</CardTitle>
                            <CardDescription className="font-bold text-primary flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                مشروع: {visit.projectName}
                            </CardDescription>
                        </div>
                        <div className="p-3 bg-background rounded-2xl border shadow-inner text-muted-foreground">
                            <Clock className="h-6 w-6" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">تاريخ الموعد</Label>
                            <p className="font-bold">{scheduledDate ? format(scheduledDate, 'eeee, dd MMMM', { locale: ar }) : '-'}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">المرحلة المستهدفة</Label>
                            <p className="font-black text-primary">{visit.plannedStageName}</p>
                        </div>
                    </div>

                    {!isProcessed ? (
                        <>
                            <Separator />
                            
                            {/* --- محرك الإنجاز الجديد --- */}
                            <div className="space-y-6 p-6 bg-primary/5 rounded-[2rem] border-2 border-primary/10 shadow-inner">
                                <div className="flex justify-between items-center">
                                    <Label className="font-black text-lg text-primary flex items-center gap-2">
                                        <TrendingUp className="h-5 w-5" />
                                        تحديث نسبة إنجاز البند
                                    </Label>
                                    <span className="text-2xl font-black text-primary font-mono">{progressAchieved[0]}%</span>
                                </div>
                                <Slider 
                                    value={progressAchieved} 
                                    onValueChange={setProgressAchieved} 
                                    max={100} 
                                    step={5} 
                                    className="py-4"
                                />
                                <p className="text-[10px] text-muted-foreground text-center italic">اسحب المؤشر لتحديد نسبة الإنجاز الفعلية الموثقة في الموقع لهذا البند.</p>
                            </div>

                            <div className="space-y-4">
                                <Label className="font-black text-lg flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-primary" />
                                    إثبات التواجد (GPS)
                                </Label>
                                <div className={cn(
                                    "p-6 rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-all",
                                    location ? "bg-green-50 border-green-200" : "bg-muted/10 border-muted-foreground/20"
                                )}>
                                    {location ? (
                                        <div className="text-center space-y-2">
                                            <div className="p-3 bg-green-600 text-white rounded-full inline-block">
                                                <ShieldCheck className="h-8 w-8" />
                                            </div>
                                            <p className="font-black text-green-800">تم التقاط الموقع بنجاح</p>
                                            <Button variant="link" size="sm" asChild className="text-blue-600">
                                                <a href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noopener noreferrer">
                                                    فتح في خرائط جوجل <Navigation className="ml-1 h-3 w-3" />
                                                </a>
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm text-muted-foreground text-center">يرجى التقاط الموقع لتوثيق الحضور الفعلي في الموقع.</p>
                                            <Button onClick={handleGetLocation} disabled={isCapturingLocation} className="rounded-xl h-12 px-8 font-bold gap-2">
                                                {isCapturingLocation ? <Loader2 className="animate-spin h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                                                تأكيد الموقع الحالي
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Label className="font-black text-lg flex items-center gap-2">
                                    <ClipboardCheck className="h-5 w-5 text-primary" />
                                    التقرير الفني للإنجاز
                                </Label>
                                <Textarea 
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="اشرح الأعمال التي تم تنفيذها أو أي ملاحظات فنية هامة..."
                                    rows={4}
                                    className="rounded-3xl border-2 p-4 text-base"
                                />
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6">
                            <Separator />
                            {visit.status === 'confirmed' ? (
                                <div className="space-y-6">
                                    <div className="p-6 bg-green-50/50 border border-green-100 rounded-3xl flex items-center justify-between">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-black uppercase text-green-700">التقدم الموثق:</Label>
                                            <p className="text-3xl font-black text-green-800 font-mono">{visit.confirmationData?.progressAchieved}%</p>
                                        </div>
                                        <div className="p-4 bg-green-600 text-white rounded-2xl shadow-lg">
                                            <TrendingUp className="h-8 w-8" />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <Label className="font-black text-lg flex items-center gap-2 text-green-700">
                                            <History className="h-5 w-5" /> التقرير الفني المعتمد
                                        </Label>
                                        <div className="p-6 bg-white border-2 border-green-50 rounded-3xl italic text-slate-700">
                                            {visit.confirmationData?.notes}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <Label className="font-black text-lg flex items-center gap-2 text-red-700">
                                        <AlertTriangle className="h-5 w-5" /> مبررات تعثر الإنجاز
                                    </Label>
                                    <div className="p-6 bg-red-50/50 border border-red-100 rounded-3xl shadow-inner">
                                        <p className="text-sm font-bold text-red-800 leading-relaxed">{visit.cancellationReason}</p>
                                        <p className="text-[10px] mt-4 italic text-red-600 flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            تم تسجيل الإلغاء بتاريخ: {toFirestoreDate(visit.cancelledAt) ? format(toFirestoreDate(visit.cancelledAt)!, 'PPp', { locale: ar }) : '-'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
                
                {!isProcessed && (
                    <CardFooter className="p-8 bg-muted/10 border-t flex flex-col sm:flex-row gap-4">
                        <Button 
                            onClick={handleConfirmDone} 
                            disabled={isSaving || !notes.trim()} 
                            className="flex-1 h-14 rounded-2xl font-black text-xl shadow-lg gap-2"
                        >
                            {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
                            تم الإنجاز
                        </Button>
                        <Button 
                            variant="outline"
                            onClick={() => setIsNotDoneAlertOpen(true)} 
                            disabled={isSaving} 
                            className="flex-1 h-14 rounded-2xl font-black text-xl border-red-200 text-red-600 hover:bg-red-50 gap-2"
                        >
                            لم يتم الإنجاز
                        </Button>
                    </CardFooter>
                )}
            </Card>

            <AlertDialog open={isNotDoneAlertOpen} onOpenChange={setIsNotDoneAlertOpen}>
                <AlertDialogContent dir="rtl" className="rounded-[2rem]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black text-red-700">توثيق عدم الإنجاز</AlertDialogTitle>
                        <AlertDialogDescription className="text-base">
                            سيتم استبعاد هذه الزيارة من قائمة الأعمال النشطة. يرجى ذكر سبب تعثر الإنجاز للتدقيق الإداري وتصحيح الجدول الزمني.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Label className="font-bold mb-2 block">مبررات التعثر / معوقات الموقع *</Label>
                        <Textarea 
                            value={cancellationReason}
                            onChange={e => setCancellationReason(e.target.value)}
                            placeholder="مثال: نقص في توريد الأسمنت، عطل في مضخة الخرسانة، تعليمات من المالك بالإيقاف..."
                            className="rounded-xl border-2"
                            rows={3}
                        />
                    </div>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel disabled={isSaving}>تراجع</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleMarkNotDone} 
                            disabled={isSaving || !cancellationReason.trim()}
                            className="bg-red-600 hover:bg-red-700 font-bold"
                        >
                            {isSaving ? <Loader2 className="animate-spin ml-2 h-4 w-4" /> : <XCircle className="ml-2 h-4 w-4" />}
                            تأكيد الإلغاء
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
