
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import type { ConstructionProject, Employee, FieldVisit, BoqItem } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, X, Calendar, User, MapPin, HardHat, Building2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { cleanFirestoreData } from '@/lib/utils';

/**
 * نموذج جدولة زيارة ميدانية (حصري للمشاريع الإنشائية):
 * تم تعديله ليرتبط فقط بالمشاريع لضمان دقة الرقابة الميدانية.
 */
export function FieldVisitForm() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [isSaving, setIsSaving] = useState(false);
    
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedEngineerId, setSelectedEngineerId] = useState('');
    const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date());
    const [plannedStageId, setPlannedStageId] = useState('');

    // جلب المشاريع الإنشائية النشطة فقط
    const { data: activeProjects = [], loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, 'projects', [where('status', '==', 'قيد التنفيذ')]);
    const { data: engineers = [], loading: engineersLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
    
    const [boqItems, setBoqItems] = useState<BoqItem[]>([]);
    const [isLoadingBoq, setIsLoadingBoq] = useState(false);

    // اختيار المشروع يسحب معه بيانات العميل والمهندس آلياً
    const selectedProject = useMemo(() => activeProjects.find(p => p.id === selectedProjectId), [activeProjects, selectedProjectId]);

    useEffect(() => {
        if (selectedProject) {
            setSelectedEngineerId(selectedProject.mainEngineerId || '');
            
            // جلب بنود المقايسة للمشروع لتكون هي مراحل العمل المتاحة للزيارة
            if (selectedProject.boqId) {
                setIsLoadingBoq(true);
                const fetchBoq = async () => {
                    const q = query(collection(firestore!, `boqs/${selectedProject.boqId}/items`), orderBy('itemNumber'));
                    const snap = await getDocs(q);
                    setBoqItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as BoqItem)).filter(i => !i.isHeader));
                    setIsLoadingBoq(false);
                };
                fetchBoq();
            }
        } else {
            setSelectedEngineerId('');
            setBoqItems([]);
        }
    }, [selectedProject, firestore]);

    const projectOptions = useMemo(() => activeProjects.map(p => ({ 
        value: p.id!, 
        label: `${p.projectName} - ${p.clientName}` 
    })), [activeProjects]);

    const engineerOptions = useMemo(() => engineers.map(e => ({ value: e.id!, label: e.fullName })), [engineers]);
    const stageOptions = useMemo(() => boqItems.map(i => ({ value: i.id!, label: `${i.itemNumber} - ${i.description}` })), [boqItems]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser || !selectedProjectId || !selectedEngineerId || !scheduledDate) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء اختيار المشروع والمهندس والتاريخ.' });
            return;
        }

        setIsSaving(true);
        try {
            const eng = engineers.find(e => e.id === selectedEngineerId);
            const stage = boqItems.find(s => s.id === plannedStageId);

            const visitData: Omit<FieldVisit, 'id'> = {
                projectId: selectedProjectId,
                projectName: selectedProject?.projectName || '',
                clientId: selectedProject?.clientId || '',
                clientName: selectedProject?.clientName || 'غير معروف',
                transactionId: selectedProject?.linkedTransactionId || '', // الربط بالمعاملة المالية إن وجد
                transactionType: selectedProject?.projectType || 'مقاولات',
                engineerId: selectedEngineerId,
                engineerName: eng?.fullName || 'غير معروف',
                scheduledDate: scheduledDate,
                plannedStageId: plannedStageId,
                plannedStageName: stage?.description || 'زيارة متابعة عامة',
                status: 'planned',
                createdAt: serverTimestamp(),
                createdBy: currentUser.id,
                companyId: currentUser.companyId
            };

            await addDoc(collection(firestore, 'field_visits'), cleanFirestoreData(visitData));
            toast({ title: 'تمت الجدولة', description: 'تمت إضافة الزيارة لمشروع المقاولات بنجاح.' });
            router.push('/dashboard/construction/field-visits');
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الزيارة.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="max-w-2xl mx-auto rounded-3xl shadow-xl overflow-hidden border-none" dir="rtl">
            <form onSubmit={handleSubmit}>
                <CardHeader className="bg-primary/5 pb-8 border-b">
                    <CardTitle className="text-2xl font-black flex items-center gap-3">
                        <Building2 className="text-primary h-7 w-7" />
                        جدولة زيارة موقع (مشروع إنشائي)
                    </CardTitle>
                    <CardDescription>اربط الزيارة بمشروع مقاولات نشط لتتبع بنود التنفيذ والـ BOQ.</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className="grid gap-2">
                        <Label className="font-black text-primary">مشروع المقاولات المستهدف *</Label>
                        <InlineSearchList 
                            value={selectedProjectId}
                            onSelect={setSelectedProjectId}
                            options={projectOptions}
                            placeholder={projectsLoading ? "جاري تحميل المشاريع..." : "ابحث عن مشروع مقاولات..."}
                            disabled={projectsLoading || isSaving}
                        />
                    </div>

                    {selectedProject && (
                        <div className="p-4 bg-muted/30 rounded-2xl border-2 border-dashed space-y-3 animate-in fade-in zoom-in-95">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-muted-foreground">العميل:</span>
                                <span className="font-black">{selectedProject.clientName}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-muted-foreground">المهندس المسؤول:</span>
                                <span className="font-black text-primary">{selectedProject.mainEngineerName}</span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label className="font-bold">المرحلة المراد تنفيذها (من المقايسة)</Label>
                            <InlineSearchList 
                                value={plannedStageId}
                                onSelect={setPlannedStageId}
                                options={stageOptions}
                                placeholder={isLoadingBoq ? "جاري تحميل البنود..." : "اختر بنداً من الـ BOQ..."}
                                disabled={!selectedProjectId || isLoadingBoq}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold">تاريخ الزيارة المخطط *</Label>
                            <DateInput value={scheduledDate} onChange={setScheduledDate} />
                        </div>
                    </div>

                    <div className="grid gap-2 pt-4 border-t">
                        <Label className="font-bold flex items-center gap-2"><User className="h-4 w-4 text-primary"/> المهندس الزائر *</Label>
                        <InlineSearchList 
                            value={selectedEngineerId}
                            onSelect={setSelectedEngineerId}
                            options={engineerOptions}
                            placeholder="اختر المهندس..."
                            disabled={engineersLoading || isSaving}
                        />
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/30 p-8 flex justify-end gap-3 border-t">
                    <Button type="button" variant="ghost" onClick={() => router.back()}>إلغاء</Button>
                    <Button type="submit" disabled={isSaving || projectsLoading} className="h-12 px-10 rounded-2xl font-black text-lg gap-2 shadow-lg">
                        {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                        تأكيد الجدولة الميدانية
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
