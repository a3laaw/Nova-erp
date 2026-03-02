
'use client';

import * as React from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, getDocs, writeBatch, serverTimestamp, doc, getDoc, orderBy, where, Timestamp } from 'firebase/firestore';
import type { ConstructionProject, Employee, FieldVisit, BoqItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Save, PlusCircle, Trash2, Table as TableIcon, Target, Users, HardHat } from 'lucide-react';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DateInput } from '@/components/ui/date-input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cleanFirestoreData, generateStableId } from '@/lib/utils';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { format } from 'date-fns';

const rowSchema = z.object({
  uid: z.string(),
  projectId: z.string().min(1, "المشروع مطلوب"),
  engineerId: z.string().min(1, "المهندس مطلوب"),
  plannedStageId: z.string().optional(),
  details: z.string().optional(),
  team1: z.string().optional(),
  team2: z.string().optional(),
  team3: z.string().optional(),
  subcontractorName: z.string().optional(),
  requiredPayment: z.string().optional(),
});

const spreadsheetSchema = z.object({
  date: z.date({ required_error: 'تاريخ الخطة مطلوب.' }),
  rows: z.array(rowSchema).min(1, 'يجب إضافة سطر واحد على الأقل.'),
});

type SpreadsheetValues = z.infer<typeof spreadsheetSchema>;

/**
 * محرك الإدخال الشبكي للزيارات (حصري للمشاريع الإنشائية):
 * تم تعديل جلب البيانات ليعتمد على كولكشن "projects" بدلاً من المعاملات العامة.
 */
export function FieldVisitsSpreadsheet({ onSaveSuccess }: { onSaveSuccess: () => void }) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  // جلب المشاريع والمهندسين
  const { data: projects = [], loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, 'projects', [where('status', '==', 'قيد التنفيذ')]);
  const { data: employees = [], loading: engLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
  
  const [boqItemsMap, setBoqItemsMap] = React.useState<Map<string, {id: string, name: string}[]>>(new Map());

  const { control, register, handleSubmit, formState: { errors }, watch, setValue } = useForm<SpreadsheetValues>({
    resolver: zodResolver(spreadsheetSchema),
    defaultValues: {
      date: new Date(),
      rows: [{ uid: generateStableId(), projectId: '', engineerId: '', details: '', team1: '', team2: '', team3: '', subcontractorName: '', requiredPayment: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'rows' });
  const watchedRows = useWatch({ control, name: 'rows' });

  // جلب بنود الـ BOQ لكل مشروع يتم اختياره في الجدول
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

  const handleSaveAll = async (data: SpreadsheetValues) => {
    if (!firestore || !currentUser) return;
    setIsSaving(true);
    try {
        const batch = writeBatch(firestore);
        const notificationsToCreate: any[] = [];

        for (const row of data.rows) {
            const project = projects.find(p => p.id === row.projectId)!;
            const engineer = employees.find(e => e.id === row.engineerId)!;
            const projectStages = boqItemsMap.get(row.projectId) || [];
            const stage = projectStages.find(s => s.id === row.plannedStageId);

            const visitData: Omit<FieldVisit, 'id'> = {
                projectId: row.projectId,
                projectName: project.projectName,
                clientId: project.clientId,
                clientName: project.clientName || 'غير معروف',
                transactionId: project.linkedTransactionId || '',
                transactionType: project.projectType || 'مقاولات',
                engineerId: row.engineerId,
                engineerName: engineer.fullName,
                scheduledDate: Timestamp.fromDate(data.date),
                plannedStageId: row.plannedStageId || '',
                plannedStageName: stage?.name || 'زيارة متابعة',
                details: row.details || '',
                team1: row.team1 || '',
                team2: row.team2 || '',
                team3: row.team3 || '',
                subcontractorName: row.subcontractorName || '',
                requiredPayment: row.requiredPayment || '',
                status: 'planned',
                createdAt: serverTimestamp(),
                createdBy: currentUser.id,
                companyId: currentUser.companyId
            };

            const newVisitRef = doc(collection(firestore, 'field_visits'));
            batch.set(newVisitRef, cleanFirestoreData(visitData));

            notificationsToCreate.push({
                engineerId: row.engineerId,
                title: 'زيارة موقع مجدولة',
                body: `تم تكليفك بزيارة مشروع ${project.projectName} يوم ${format(data.date, 'dd/MM/yyyy')}.`,
                link: `/dashboard/construction/field-visits/${newVisitRef.id}`
            });
        }

        await batch.commit();

        for (const n of notificationsToCreate) {
            const userId = await findUserIdByEmployeeId(firestore, n.engineerId);
            if (userId) createNotification(firestore, { ...n, userId, link: n.link });
        }

        toast({ title: 'نجاح التخطيط', description: `تمت جدولة ${data.rows.length} موقع بنجاح.` });
        onSaveSuccess();
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الخطة الميدانية.' });
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
                        جدولة يومية لمشاريع المقاولات
                    </CardTitle>
                    <CardDescription>أدخل خطة المواقع والفرق الفنية والمقاولين في سطر واحد لكل مشروع.</CardDescription>
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
                    <TableHead className="w-80 font-black text-right border-l"><Target className="h-4 w-4 inline ml-1 text-primary"/> مشروع المقاولات</TableHead>
                    <TableHead className="w-64 font-black text-right border-l"><Users className="h-4 w-4 inline ml-1 text-primary"/> المهندس الزائر</TableHead>
                    <TableHead className="w-64 font-black text-right border-l">بند المقايسة (BOQ)</TableHead>
                    <TableHead className="w-32 font-black text-center border-l">فريق 1</TableHead>
                    <TableHead className="w-32 font-black text-center border-l">فريق 2</TableHead>
                    <TableHead className="w-32 font-black text-center border-l">فريق 3</TableHead>
                    <TableHead className="w-56 font-black text-right border-l"><HardHat className="h-4 w-4 inline ml-1 text-primary"/> المقاول المنفذ</TableHead>
                    <TableHead className="w-full font-black text-right border-l">تعليمات العمل المطلوبة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const row = watchedRows[index];
                    const projectStages = boqItemsMap.get(row.projectId) || [];

                    return (
                      <TableRow key={field.id} className="h-16 hover:bg-muted/5 transition-colors border-b last:border-0 group">
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
                                            }
                                        }}
                                        options={projectOptions}
                                        placeholder="اختر مشروع مقاولات..."
                                        className="border-none shadow-none focus-visible:ring-0 font-black text-primary bg-transparent h-12"
                                    />
                                )}
                            />
                        </TableCell>

                        <TableCell className="border-l p-1">
                            <Controller
                                control={control}
                                name={`rows.${index}.engineerId`}
                                render={({ field: f }) => (
                                    <InlineSearchList
                                        value={f.value}
                                        onSelect={f.onChange}
                                        options={engineerOptions}
                                        placeholder="اختر مهندس..."
                                        className="border-none shadow-none focus-visible:ring-0 font-bold bg-transparent h-12"
                                    />
                                )}
                            />
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
                                        className="border-none shadow-none focus-visible:ring-0 text-[10px] font-bold bg-transparent h-12"
                                    />
                                )}
                            />
                        </TableCell>

                        <TableCell className="border-l p-1"><Input {...register(`rows.${index}.team1`)} className="border-none shadow-none text-center font-bold h-12" placeholder="---"/></TableCell>
                        <TableCell className="border-l p-1"><Input {...register(`rows.${index}.team2`)} className="border-none shadow-none text-center font-bold h-12" placeholder="---"/></TableCell>
                        <TableCell className="border-l p-1"><Input {...register(`rows.${index}.team3`)} className="border-none shadow-none text-center font-bold h-12" placeholder="---"/></TableCell>
                        
                        <TableCell className="border-l p-1"><Input {...register(`rows.${index}.subcontractorName`)} className="border-none shadow-none font-bold h-12" placeholder="اسم المقاول..."/></TableCell>
                        
                        <TableCell className="border-l p-1">
                            <Input {...register(`rows.${index}.details`)} className="border-none shadow-none text-right text-xs italic h-12" placeholder="مثال: استلام حديد الميدة، صب النظافة..."/>
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
            <Button type="button" variant="outline" onClick={() => append({ uid: generateStableId(), projectId: '', engineerId: '', details: '', team1: '', team2: '', team3: '', subcontractorName: '', requiredPayment: '' })} className="h-12 px-10 rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 text-lg font-bold gap-2">
                <PlusCircle className="h-5 w-5 text-primary" />
                إضافة سطر مشروع جديد
            </Button>
          </div>
        </CardContent>

        <CardFooter className="bg-muted/30 p-8 border-t flex justify-end gap-4">
            <Button type="button" variant="ghost" onClick={onSaveSuccess} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
            <Button type="submit" disabled={isSaving || projectsLoading} className="h-14 px-16 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 gap-3 min-w-[300px]">
                {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                حفظ خطة المواقع
            </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
