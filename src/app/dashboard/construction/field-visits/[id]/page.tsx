'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc, updateDoc, serverTimestamp, writeBatch, collection, getDoc, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import type { FieldVisit, ConstructionProject, BoqItem } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
    AlertTriangle,
    TrendingUp,
    Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/auth-context';
import { cn, formatCurrency, cleanFirestoreData } from '@/lib/utils';
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
import { InlineSearchList } from '@/components/ui/inline-search-list';

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
    const [progressAchieved, setProgressAchieved] = useState([0]); 
    const [cancellationReason, setCancellationReason] = useState('');
    const [location, setLocation] = useState<{ latitude: number, longitude: number, accuracy: number } | null>(null);
    const [isNotDoneAlertOpen, setIsNotDoneAlertOpen] = useState(false);

    const [boqItems, setBoqItems] = useState<{id: string, name: string}[]>([]);
    const [selectedStageId, setSelectedStageId] = useState('');
    const [isLoadingStages, setIsLoadingStages] = useState(false);

    const visitRef = useMemo(() => (firestore && id ? doc(firestore, 'field_visits', id) : null), [firestore, id]);
    const { data: visit, loading } = useDocument<FieldVisit>(firestore, visitRef?.path || null);

    // ✨ محرك جلب بنود المقايسة للتأكيد (مطابق للجدولة السريعة)
    useEffect(() => {
        const fetchStages = async () => {
            if (!visit || !firestore) return;
            setIsLoadingStages(true);
            try {
                const projectSnap = await getDoc(doc(firestore, 'projects', visit.projectId));
                if (projectSnap.exists()) {
                    const projectData = projectSnap.data() as ConstructionProject;
                    if (projectData.boqId) {
                        const q = query(collection(firestore, `boqs/${projectData.boqId}/items`), orderBy('itemNumber'));
                        const snap = await getDocs(q);
                        const stages = snap.docs.map(d => {
                            const data = d.data();
                            return { 
                                id: d.id, 
                                name: `${data.itemNumber} - ${data.description}`,
                                isHeader: data.isHeader || false
                            }
                        }).filter(i => !i.isHeader && !i.name.includes('undefined'));
                        setBoqItems(stages);
                        
                        if (visit.plannedStageId) {
                            setSelectedStageId(visit.plannedStageId);
                        }
                    }
                }
            } catch (e) {
                console.error("Error fetching BOQ stages:", e);
            } finally {
                setIsLoadingStages(false);
            }
        };

        fetchStages();
    }, [visit, firestore]);

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
        if (!navigator.geolocation) return;
        setIsCapturingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
                setIsCapturingLocation(false);
            },
            () => setIsCapturingLocation(false),
            { enableHighAccuracy: true }
        );
    };

    const handleConfirmDone = async () => {
        if (!firestore || !visit || !currentUser || !notes.trim()) return;

        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const actualStage = boqItems.find(s => s.id === selectedStageId);
            
            batch.update(visitRef!, {
                status: 'confirmed',
                plannedStageId: selectedStageId,
                plannedStageName: actualStage?.name || visit.plannedStageName,
                confirmationData: {
                    confirmedAt: serverTimestamp(),
                    notes,
                    location,
                    isCompleted: true,
                    progressAchieved: progressAchieved[0]
                }
            });

            await batch.commit();
            toast({ title: 'تم التوثيق', description: 'تم تحديث الإنجاز الميداني بنجاح.' });
            router.push('/dashboard/construction/field-visits');
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ' });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="p-8 max-w-2xl mx-auto space-y-6"><Skeleton className="h-48 w-full rounded-3xl" /><Skeleton className="h-64 w-full rounded-3xl" /></div>;
    if (!visit) return <div className="text-center p-20">الزيارة غير موجودة.</div>;

    const scheduledDate = toFirestoreDate(visit.scheduledDate);
    const isProcessed = visit.status !== 'planned';

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20" dir="rtl">
            <div className="flex items-center justify-between px-2">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                    <ArrowRight className="h-4 w-4" /> العودة للخطة
                </Button>
            </div>

            <Card className="rounded-[2.5rem] shadow-xl border-none overflow-hidden bg-card">
                <CardHeader className="bg-muted/30 pb-8 px-8 border-b">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black">{visit.clientName}</CardTitle>
                            <CardDescription className="font-bold text-primary flex items-center gap-2">
                                <Building2 className="h-4 w-4" /> مشروع: {visit.projectName}
                            </CardDescription>
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
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">المرحلة المنفذة</Label>
                            {isProcessed ? (
                                <p className="font-black text-primary">{visit.plannedStageName}</p>
                            ) : (
                                <InlineSearchList 
                                    value={selectedStageId}
                                    onSelect={setSelectedStageId}
                                    options={boqItems.map(i => ({ value: i.id, label: i.name }))}
                                    placeholder={isLoadingStages ? "جاري التحميل..." : "اختر المرحلة..."}
                                    disabled={isLoadingStages}
                                    className="mt-1"
                                />
                            )}
                        </div>
                    </div>

                    <Separator />
                    
                    <div className="space-y-6 p-6 bg-primary/5 rounded-[2rem] border-2 border-primary/10 shadow-inner">
                        <div className="flex justify-between items-center">
                            <Label className="font-black text-lg text-primary flex items-center gap-2">
                                <TrendingUp className="h-5 w-5" /> نسبة الإنجاز
                            </Label>
                            <span className="text-2xl font-black text-primary font-mono">{progressAchieved[0]}%</span>
                        </div>
                        {!isProcessed && <Slider value={progressAchieved} onValueChange={setProgressAchieved} max={100} step={5} className="py-4" />}
                    </div>

                    <div className="space-y-4">
                        <Label className="font-black text-lg flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-primary" /> إثبات الحضور (GPS)
                        </Label>
                        <div className={cn("p-6 rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center gap-4", location ? "bg-green-50 border-green-200" : "bg-muted/10 border-muted-foreground/20")}>
                            {location ? (
                                <div className="text-center">
                                    <ShieldCheck className="h-8 w-8 text-green-600 mx-auto mb-2" />
                                    <p className="font-black text-green-800">تم توثيق الموقع الجغرافي</p>
                                </div>
                            ) : !isProcessed && (
                                <Button onClick={handleGetLocation} disabled={isCapturingLocation} className="rounded-xl h-12 font-bold gap-2">
                                    {isCapturingLocation ? <Loader2 className="animate-spin h-5 w-5" /> : <MapPin className="h-5 w-5" />} تأكيد موقعي الآن
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="font-black text-lg flex items-center gap-2">
                            <ClipboardCheck className="h-5 w-5 text-primary" /> التقرير الفني للإنجاز
                        </Label>
                        <Textarea 
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            readOnly={isProcessed}
                            placeholder="اشرح الأعمال التي تم تنفيذها اليوم..."
                            rows={4}
                            className="rounded-3xl border-2"
                        />
                    </div>
                </CardContent>
                
                {!isProcessed && (
                    <CardFooter className="p-8 bg-muted/10 border-t flex gap-4">
                        <Button onClick={handleConfirmDone} disabled={isSaving || !notes.trim()} className="flex-1 h-14 rounded-2xl font-black text-xl shadow-lg gap-2">
                            {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="h-6 w-6" />} تم الإنجاز
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
