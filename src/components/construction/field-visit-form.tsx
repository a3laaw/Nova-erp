'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import type { ConstructionProject, Employee, FieldVisit, WorkTeam } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { MultiSelect } from '@/components/ui/multi-select';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, X, Building2, Users, HardHat } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { cleanFirestoreData } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

    // البيانات المرجعية
    const { data: projects = [], loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, 'projects', [where('status', '==', 'قيد التنفيذ')]);
    const { data: engineers = [], loading: engineersLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
    const { data: allTeams = [], loading: teamsLoading } = useSubscription<WorkTeam>(firestore, 'workTeams', [orderBy('name')]);
    
    // الخطوة 1 — أضف state جديد
    const [boqItemsMap, setBoqItemsMap] = React.useState<Map<string, {id: string, name: string}[]>>(new Map());

    // الخطوة 2 — أضف دالة منفصلة للجلب (نفس الدالة في Spreadsheet)
    const fetchProjectStages = async (projectId: string, boqId: string) => {
        if (boqItemsMap.has(projectId)) return;
        try {
            const q = query(collection(firestore!, `boqs/${boqId}/items`), orderBy('itemNumber'));
            const snap = await getDocs(q);
            const stages = snap.docs.map(d => {
                const data = d.data();
                return { 
                    id: d.id, 
                    name: `${data.itemNumber || ''} - ${data.description || ''}`.trim(),
                    isHeader: data.isHeader || false
                }
            }).filter(i => !i.isHeader && i.name !== '-');
            setBoqItemsMap(prev => new Map(prev).set(projectId, stages));
        } catch (e) { console.error(e); }
    };

    // الخطوة 3 — تم حذف useEffect الخاص بجلب BOQ بالكامل

    const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
    const isSubcontracted = !!selectedProject?.subcontractorId;

    const projectOptions = useMemo(() => projects.map(p => ({ 
        value: p.id!, 
        label: [p.projectName, p.clientName].filter(Boolean).join(' - ')
    })), [projects]);

    const engineerOptions = useMemo(() => engineers.map(e => ({ value: e.id!, label: e.fullName })), [engineers]);
    
    // الخطوة 5 — غير stageOptions ليقرأ من boqItemsMap
    const stageOptions = useMemo(() => 
        boqItemsMap.get(selectedProjectId)?.map(i => ({ 
            value: i.id, 
            label: i.name 
        })) || []
    , [boqItemsMap, selectedProjectId]);

    const teamOptions = useMemo(() => allTeams.map(t => ({ value: t.id!, label: t.name })), [allTeams]);
    const selectedTeamsData = useMemo(() => allTeams.filter(t => selectedTeamIds.includes(t.id!)), [allTeams, selectedTeamIds]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser || !selectedProjectId) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء اختيار المشروع.' });
            return;
        }

        setIsSaving(true);
        try {
            const eng = engineers.find(e => e.id === selectedEngineerId);
            const projectStages = boqItemsMap.get(selectedProjectId) || [];
            const stage = projectStages.find(s => s.id === plannedStageId);

            const visitData: Omit<FieldVisit, 'id'> = {
                projectId: selectedProjectId,
                projectName: selectedProject?.projectName || '',
                clientId: selectedProject?.clientId || '',
                clientName: selectedProject?.clientName || '',
                transactionId: selectedProject?.linkedTransactionId || '',
                transactionType: selectedProject?.projectType || 'مقاولات',
                engineerId: selectedEngineerId || null,
                engineerName: eng?.fullName || 'إشراف عام',
                scheduledDate: scheduledDate || new Date(),
                plannedStageId: plannedStageId,
                plannedStageName: stage?.name || 'زيارة متابعة',
                phaseEndDate: null,
                teamIds: isSubcontracted ? [] : selectedTeamIds,
                teamNames: isSubcontracted ? [] : selectedTeamsData.map(t => t.name), 
                subcontractorId: selectedProject?.subcontractorId || null,
                subcontractorName: selectedProject?.subcontractorName || null,
                status: 'planned',
                createdAt: serverTimestamp(),
                createdBy: currentUser.id,
                companyId: currentUser.companyId || null
            };

            await addDoc(collection(firestore, 'field_visits'), cleanFirestoreData(visitData));
            toast({ title: 'نجاح', description: 'تمت جدولة الزيارة بنجاح.' });
            router.push('/dashboard/construction/field-visits');
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="max-w-4xl mx-auto rounded-3xl shadow-xl overflow-hidden border-none" dir="rtl">
            <form onSubmit={handleSubmit}>
                <CardHeader className="bg-primary/5 pb-8 border-b">
                    <CardTitle className="text-2xl font-black flex items-center gap-3">
                        <Building2 className="text-primary h-7 w-7" />
                        جدولة زيارة ميدانية جديدة
                    </CardTitle>
                    <CardDescription>قم باختيار المشروع والمرحلة التنفيذية وتحديد فرق العمل.</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                    <div className="grid gap-2">
                        <Label className="font-black text-primary">المشروع المستهدف *</Label>
                        <InlineSearchList 
                            value={selectedProjectId}
                            // الخطوة 4 — في InlineSearchList الخاص بالمشروع، غير onSelect ليستدعي الدالة مباشرة
                            onSelect={(v) => {
                                setSelectedProjectId(v);
                                const p = projects.find(it => it.id === v);
                                if (p) {
                                    if (p.mainEngineerId) setSelectedEngineerId(p.mainEngineerId);
                                    if (p.boqId) fetchProjectStages(v, p.boqId);
                                }
                            }}
                            options={projectOptions}
                            placeholder={projectsLoading ? "جاري التحميل..." : "ابحث عن مشروع..."}
                            disabled={projectsLoading || isSaving}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label className="font-bold">المرحلة التنفيذية (WBS) *</Label>
                            <InlineSearchList 
                                value={plannedStageId}
                                onSelect={setPlannedStageId}
                                options={stageOptions}
                                // الخطوة 6 — غير placeholder حقل المرحلة
                                placeholder={
                                    !selectedProjectId ? "اختر مشروعاً أولاً" :
                                    !boqItemsMap.has(selectedProjectId) ? "جاري تحميل البنود..." :
                                    stageOptions.length === 0 ? "لا يوجد بنود مقايسة" :
                                    "اختر بنداً من الـ BOQ..."
                                }
                                disabled={!selectedProjectId || !boqItemsMap.has(selectedProjectId)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold">تاريخ الزيارة المخطط *</Label>
                            <DateInput value={scheduledDate} onChange={setScheduledDate} />
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="font-black text-lg flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                إدارة الفرق المنفذة
                            </Label>
                            {isSubcontracted && (
                                <Badge className="bg-orange-100 text-orange-700 border-none font-black px-3">
                                    <HardHat className="h-3 w-3 ml-1" />
                                    إسناد لمقاول باطن
                                </Badge>
                            )}
                        </div>

                        {isSubcontracted ? (
                            <div className="p-6 border-2 border-dashed border-orange-200 bg-orange-50/20 rounded-2xl flex items-center gap-4">
                                <HardHat className="h-8 w-8 text-orange-400" />
                                <div>
                                    <p className="font-black text-orange-900">المقاول: {selectedProject?.subcontractorName || ''}</p>
                                    <p className="text-xs text-orange-700">هذا المشروع يدار بواسطة مقاول باطن.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid gap-2">
                                    <Label className="text-xs font-bold text-muted-foreground">اختر الفرق الفنية المشاركة:</Label>
                                    <MultiSelect 
                                        options={teamOptions}
                                        selected={selectedTeamIds}
                                        onChange={setSelectedTeamIds}
                                        placeholder={teamsLoading ? "تحميل الفرق..." : "اختر الفرق..."}
                                        disabled={!selectedProjectId || isSaving}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid gap-2 pt-4 border-t">
                        <Label className="font-bold flex items-center gap-2">المهندس المشرف</Label>
                        <InlineSearchList 
                            value={selectedEngineerId}
                            onSelect={setSelectedEngineerId}
                            options={engineerOptions}
                            placeholder="يمكن تركه فارغاً للإشراف العام..."
                            disabled={engineersLoading || isSaving}
                        />
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/30 p-8 flex justify-end gap-3 border-t">
                    <Button type="button" variant="outline" onClick={() => router.back()}>إلغاء</Button>
                    <Button type="submit" disabled={isSaving || projectsLoading} className="h-12 px-10 rounded-2xl font-black text-lg gap-2 shadow-lg">
                        {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                        حفظ الزيارة
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}