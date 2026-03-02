'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc, updateDoc, serverTimestamp, writeBatch, collection, getDoc } from 'firebase/firestore';
import type { FieldVisit, ConstructionProject } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Loader2, CheckCircle2, Save, ArrowRight, Navigation, ShieldCheck, Clock, ClipboardCheck, Sparkles, Building2, HardHat } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

/**
 * صفحة تفاصيل الزيارة الميدانية (ربط حصري بالمقاولات):
 * تقوم بتأكيد الإنجاز وتحديث مراحل المشروع التنفيذية (WBS) في سجل المشروع.
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
    const [location, setLocation] = useState<{ latitude: number, longitude: number, accuracy: number } | null>(null);

    const visitRef = useMemo(() => (firestore && id ? doc(firestore, 'field_visits', id) : null), [firestore, id]);
    const { data: visit, loading } = useDocument<FieldVisit>(firestore, visitRef?.path || null);

    useEffect(() => {
        if (visit?.confirmationData) {
            setNotes(visit.confirmationData.notes);
            setLocation(visit.confirmationData.location || null);
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

    const handleConfirm = async () => {
        if (!firestore || !visit || !currentUser) return;
        if (!notes.trim()) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى كتابة ملاحظاتك الميدانية قبل التأكيد.' });
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
                    isCompleted: true
                }
            });

            // 2. تحديث سجل المشروع (ConstructionProject)
            const projectRef = doc(firestore, 'projects', visit.projectId);
            const projectSnap = await getDoc(projectRef);
            
            if (projectSnap.exists()) {
                const projectData = projectSnap.data() as ConstructionProject;
                
                // تحديث الحدث في تايم لاين المشروع
                const timelineRef = collection(projectRef, 'timelineEvents');
                batch.set(doc(timelineRef), {
                    type: 'Visit',
                    title: `إنجاز ميداني: ${visit.plannedStageName}`,
                    description: notes,
                    date: serverTimestamp(),
                    engineerName: visit.engineerName,
                    location: location,
                    createdAt: serverTimestamp()
                });

                // إذا كان هناك معاملة مالية مرتبطة، يتم توثيق الإنجاز فيها أيضاً
                if (projectData.linkedTransactionId) {
                    const txRef = doc(firestore, `clients/${projectData.clientId}/transactions/${projectData.linkedTransactionId}`);
                    batch.set(doc(collection(txRef, 'timelineEvents')), {
                        type: 'log',
                        content: `[إنجاز موقع] أكد المهندس ${visit.engineerName} إنجاز المرحلة: ${visit.plannedStageName}.\nالملاحظات: ${notes}`,
                        userId: currentUser.id,
                        userName: currentUser.fullName,
                        createdAt: serverTimestamp(),
                    });
                }
            }

            await batch.commit();
            toast({ title: 'تم التأكيد', description: 'تم حفظ تفاصيل الإنجاز الميداني وتحديث سجلات المشروع.' });
            router.push('/dashboard/construction/field-visits');
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ التأكيد.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="p-8 max-w-2xl mx-auto space-y-6"><Skeleton className="h-48 w-full rounded-3xl" /><Skeleton className="h-64 w-full rounded-3xl" /></div>;
    if (!visit) return <div className="text-center p-20">الزيارة غير موجودة.</div>;

    const scheduledDate = toFirestoreDate(visit.scheduledDate);
    const confirmedAt = toFirestoreDate(visit.confirmationData?.confirmedAt);

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20" dir="rtl">
            <div className="flex items-center justify-between px-2">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                    <ArrowRight className="h-4 w-4" /> العودة للخطة
                </Button>
                {visit.status === 'confirmed' && (
                    <Badge className="bg-green-600 font-black px-4 py-1 rounded-full gap-2 text-white">
                        <CheckCircle2 className="h-4 w-4" /> زيارة مؤكدة
                    </Badge>
                )}
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
                        <div className="p-3 bg-background rounded-2xl border shadow-inner">
                            <Clock className="h-6 w-6 text-muted-foreground" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">تاريخ الموعد</Label>
                            <p className="font-bold">{scheduledDate ? format(scheduledDate, 'eeee, dd MMMM', { locale: ar }) : '-'}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">بند المقايسة المستهدف</Label>
                            <div className="flex items-center gap-2">
                                <p className="font-black text-primary">{visit.plannedStageName}</p>
                                <Sparkles className="h-3 w-3 text-blue-500 animate-pulse" />
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t">
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
                                    <p className="text-sm text-muted-foreground text-center">يرجى الضغط لإثبات الحضور في موقع المشروع الإنشائي.</p>
                                    <Button onClick={handleGetLocation} disabled={isCapturingLocation || visit.status === 'confirmed'} className="rounded-xl h-12 px-8 font-bold gap-2">
                                        {isCapturingLocation ? <Loader2 className="animate-spin h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                                        التقاط إحداثيات الموقع
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="font-black text-lg flex items-center gap-2">
                            <ClipboardCheck className="h-5 w-5 text-primary" />
                            تقرير الأعمال المنفذة
                        </Label>
                        <Textarea 
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="ما الذي تم إنجازه في بنود الـ BOQ اليوم؟"
                            rows={5}
                            className="rounded-3xl border-2 text-base p-4 resize-none"
                            disabled={visit.status === 'confirmed'}
                        />
                    </div>
                </CardContent>
                <CardFooter className="p-8 bg-muted/10 border-t flex justify-center">
                    {visit.status !== 'confirmed' ? (
                        <Button onClick={handleConfirm} disabled={isSaving || !notes.trim()} className="h-14 px-16 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 gap-3">
                            {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
                            تأكيد الإنجاز وتحديث سجل المشروع
                        </Button>
                    ) : (
                        <div className="text-center space-y-1">
                            <p className="font-bold text-muted-foreground">تم التوثيق بواسطة: {visit.engineerName}</p>
                            <p className="text-xs text-muted-foreground italic">بتاريخ: {confirmedAt ? format(confirmedAt, 'PPp', { locale: ar }) : '-'}</p>
                        </div>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
