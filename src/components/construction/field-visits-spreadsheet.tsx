
'use client';

import * as React from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, getDocs, writeBatch, serverTimestamp, doc, getDoc, orderBy, where, Timestamp } from 'firebase/firestore';
import type { ConstructionProject, Employee, FieldVisit, BoqItem, WorkTeam } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Loader2, Save, PlusCircle, Trash2, Table as TableIcon, Target, Users, HardHat, Building2 } from 'lucide-react';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { MultiSelect } from '@/components/ui/multi-select';
import { DateInput } from '@/components/ui/date-input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cleanFirestoreData, generateStableId } from '@/lib/utils';

const rowSchema = z.object({
  uid: z.string(),
  projectId: z.string().min(1, "المشروع مطلوب"),
  engineerId: z.string().optional().nullable(),
  plannedStageId: z.string().optional(),
  details: z.string().optional(),
  teamIds: z.array(z.string()).default([]),
  numFloors: z.string().optional(),
  requiredPayment: z.string().optional(),
});

const spreadsheetSchema = z.object({
  date: z.date({ required_error: 'تاريخ الخطة مطلوب.' }),
  rows: z.array(rowSchema).min(1, 'يجب إضافة سطر واحد على الأقل.'),
});

type SpreadsheetValues = z.infer<typeof spreadsheetSchema>;

export function FieldVisitsSpreadsheet({ onSaveSuccess }: { onSaveSuccess: () => void }) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  const { data: projects = [], loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, 'projects', [where('status', '==', 'قيد التنفيذ')]);
  const { data: employees = [], loading: engLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
  const { data: workTeams = [] } = useSubscription<WorkTeam>(firestore, 'workTeams', [orderBy('name')]);
  
  const [boqItemsMap, setBoqItemsMap] = React.useState<Map<string, {id: string, name: string}[]>>(new Map());

  const { control, register, handleSubmit, formState: { errors }, watch, setValue } = useForm<SpreadsheetValues>({
    resolver: zodResolver(spreadsheetSchema),
    defaultValues: {
      date: new Date(),
      rows: [{ uid: generateStableId(), projectId: '', engineerId: '', details: '', teamIds: [], numFloors: '', requiredPayment: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'rows' });
  const watchedRows = useWatch({ control, name: 'rows' });

  const fetchProjectStages = async (projectId: string, boqId: string) => {
    if (boqItemsMap.has(projectId)) return;
    try {
        const q = query(collection(firestore!, `boqs/${boqId}/items`), orderBy('itemNumber'));
        const snap = await getDocs(q);
        const stages = snap.docs.map(d => ({ id: d.id, name: `${d.data().itemNumber} - ${d.data().description}` })).filter(i => !i.name.includes('undefined'));
        setBoqItemsMap(prev => new Map(prev).set(projectId, stages));
    } catch (e) { console.error(e); }
  };

  const projectOptions = React.useMemo(() => projects.map(p => ({ value: p.id!, label: p.projectName })), [projects]);
  const engineerOptions = React.useMemo(() => employees.map(e => ({ value: e.id!, label: e.fullName })), [employees]);
  const teamOptions = React.useMemo(() => workTeams.map(t => ({ value: t.id!, label: t.name })), [workTeams]);

  const handleSaveAll = async (data: SpreadsheetValues) => {
    if (!firestore || !currentUser) return;
    setIsSaving(true);
    try {
        const batch = writeBatch(firestore);

        for (const row of data.rows) {
            const project = projects.find(p => p.id === row.projectId)!;
            const engineer = employees.find(e => e.id === row.engineerId);
            const projectStages = boqItemsMap.get(row.projectId) || [];
            const stage = projectStages.find(s => s.id === row.plannedStageId);
            const selectedTeams = workTeams.filter(t => row.teamIds.includes(t.id!));

            const visitData: Omit<FieldVisit, 'id'> = {
                projectId: row.projectId,
                projectName: project.projectName,
                clientId: project.clientId,
                clientName: project.clientName || 'غير معروف',
                transactionId: project.linkedTransactionId || '',
                transactionType: project.projectType || 'مقاولات',
                engineerId: row.engineerId || null,
                engineerName: engineer?.fullName || 'إشراف عام / فريق فني',
                scheduledDate: Timestamp.fromDate(data.date),
                plannedStageId: row.plannedStageId || '',
                plannedStageName: stage?.name || 'زيارة متابعة',
                mainStageName: stage?.name.split(' - ')[1] || 'إشراف عام',
                numFloors: row.numFloors || project.numFloors || 'سرداب + 3 أدوار',
                details: row.details || '',
                teamIds: row.teamIds,
                teamNames: selectedTeams.map(t => t.name),
                subcontractorId: project.subcontractorId || null,
                subcontractorName: project.subcontractorName || null,
                status: 'planned',
                createdAt: serverTimestamp(),
                createdBy: currentUser.id,
                companyId: currentUser.companyId
            };

            const newVisitRef = doc(collection(firestore, 'field_visits'));
            batch.set(newVisitRef, cleanFirestoreData(visitData));
        }

        await batch.commit();
        toast({ title: 'نجاح الجدولة الجماعية', description: `تمت جدولة ${data.rows.length} موقع بنجاح.` });
        onSaveSuccess();
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-card">
      <form onSubmit={handleSubmit(handleSaveAll)}>
        <CardHeader className="bg-primary/5 pb-8 border-b">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="space-y-1">
                    <CardTitle className="text-2xl font-black flex items-center gap-2 text-primary">
                        <TableIcon className="h-6 w-6" />
                        الجدولة الجماعية السريعة للمشاريع
                    </CardTitle>
                    <CardDescription>أدخل خطة المواقع والفرق الفنية والمقاولين دفعة واحدة.</CardDescription>
                </div>
                <div className="flex items-center gap-4 bg-background p-3 rounded-2xl border shadow-inner">
                    <Label className="font-bold text-xs">تاريخ الخطة:</Label>
                    <Controller
                        name="date"
                        control={control}
                        render={({ field }) => <DateInput value={field.value} onChange={field.onChange} className="h-9 w-48" />}
                    />
                </div>
            </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-[1800px]">
              <Table className="border-collapse table-fixed w-full">
                <TableHeader className="bg-muted/50 sticky top-0 z-20">
                  <TableRow className="h-14 border-b-2">
                    <TableHead className="w-12 text-center font-black">#</TableHead>
                    <TableHead className="w-16 text-center font-black">إجراء</TableHead>
                    <TableHead className="w-80 font-black text-right border-l"><Target className="h-4 w-4 inline ml-1 text-primary"/> المشروع</TableHead>
                    <TableHead className="w-48 font-black text-right border-l">بيانات العقار (أدوار)</TableHead>
                    <TableHead className="w-64 font-black text-right border-l">بند المقايسة (WBS)</TableHead>
                    <TableHead className="w-80 font-black text-right border-l">فرق العمل الميدانية</TableHead>
                    <TableHead className="w-64 font-black text-right border-l">المقاول المشرف</TableHead>
                    <TableHead className="w-64 font-black text-right border-l">المهندس المسؤول</TableHead>
                    <TableHead className="w-full font-black text-right border-l">الأعمال المطلوبة اليوم</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const row = watchedRows[index];
                    const projectStages = boqItemsMap.get(row.projectId) || [];
                    const project = projects.find(p => p.id === row.projectId);

                    return (
                      <TableRow key={field.uid} className="h-16 hover:bg-muted/5 transition-colors border-b last:border-0 group">
                        <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground bg-muted/5 border-l">{index + 1}</TableCell>
                        <TableCell className="text-center border-l">
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="text-destructive rounded-full">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </TableCell>
                        
                        <TableCell className="border-l p-1">
                            <Controller
                                control={control}
                                name={`rows.${index}.projectId`}
                                render={({ field: f }) => (
                                    <InlineSearchList
                                        value={f.value}
                                        onSelect={(v) => {
                                            f.onChange(v);
                                            const p = projects.find(it => it.id === v);
                                            if (p) {
                                                if (p.mainEngineerId) setValue(`rows.${index}.engineerId`, p.mainEngineerId);
                                                if (p.boqId) fetchProjectStages(v, p.boqId);
                                                if (p.numFloors) setValue(`rows.${index}.numFloors`, p.numFloors);
                                            }
                                        }}
                                        options={projectOptions}
                                        placeholder="اختر مشروع..."
                                        className="border-none shadow-none font-black text-primary bg-transparent h-12"
                                    />
                                )}
                            />
                        </TableCell>

                        <TableCell className="border-l p-1">
                            <Input {...register(`rows.${index}.numFloors`)} className="border-none shadow-none text-xs h-12 bg-transparent" placeholder="أدوار العقار..."/>
                        </TableCell>

                        <TableCell className="border-l p-1">
                            <Controller
                                control={control}
                                name={`rows.${index}.plannedStageId`}
                                render={({ field: f }) => (
                                    <InlineSearchList
                                        value={f.value || ''}
                                        onSelect={f.onChange}
                                        options={projectStages.map(s => ({ value: s.id, label: s.name }))}
                                        placeholder="بند الـ BOQ..."
                                        disabled={!row.projectId}
                                        className="border-none shadow-none text-[10px] font-bold bg-transparent h-12"
                                    />
                                )}
                            />
                        </TableCell>

                        <TableCell className="border-l p-1">
                            {!project?.subcontractorId ? (
                                <Controller
                                    control={control}
                                    name={`rows.${index}.teamIds`}
                                    render={({ field: f }) => (
                                        <MultiSelect 
                                            options={teamOptions}
                                            selected={f.value || []}
                                            onChange={f.onChange}
                                            placeholder="اختر الفرق..."
                                            className="border-none shadow-none bg-transparent"
                                        />
                                    )}
                                />
                            ) : (
                                <div className="text-xs text-orange-600 font-bold px-3 flex items-center gap-2 h-12">
                                    <HardHat className="h-3 w-3" />
                                    إسناد لمقاول باطن
                                </div>
                            )}
                        </TableCell>

                        <TableCell className="border-l p-1">
                            <Input value={project?.subcontractorName || '-'} className="border-none shadow-none font-bold h-12 bg-transparent" readOnly disabled/>
                        </TableCell>

                        <TableCell className="border-l p-1">
                            <Controller
                                control={control}
                                name={`rows.${index}.engineerId`}
                                render={({ field: f }) => (
                                    <InlineSearchList
                                        value={f.value || ''}
                                        onSelect={f.onChange}
                                        options={engineerOptions}
                                        placeholder="المهندس..."
                                        className="border-none shadow-none font-bold bg-transparent h-12"
                                    />
                                )}
                            />
                        </TableCell>
                        
                        <TableCell className="border-l p-1">
                            <Input {...register(`rows.${index}.details`)} className="border-none shadow-none text-right text-xs italic h-12 bg-transparent" placeholder="تفاصيل الأعمال..."/>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <div className="flex justify-center p-8 bg-muted/10 border-t">
            <Button type="button" variant="outline" onClick={() => append({ uid: generateStableId(), projectId: '', engineerId: '', details: '', teamIds: [], numFloors: '', requiredPayment: '' })} className="h-12 px-10 rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 text-lg font-bold gap-2">
                <PlusCircle className="h-5 w-5 text-primary" />
                إضافة سطر مشروع جديد
            </Button>
          </div>
        </CardContent>

        <CardFooter className="bg-muted/30 p-8 border-t flex justify-end gap-4">
            <Button type="button" variant="ghost" onClick={onSaveSuccess} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
            <Button type="submit" disabled={isSaving || projectsLoading} className="h-14 px-16 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 gap-3 min-w-[300px]">
                {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                حفظ خطة المواقع واللوجستيات
            </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
