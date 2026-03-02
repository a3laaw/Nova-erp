'use client';

import * as React from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, getDocs, writeBatch, serverTimestamp, doc, getDoc, collectionGroup, orderBy, where, Timestamp } from 'firebase/firestore';
import type { Client, ClientTransaction, Employee, FieldVisit, Warehouse } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Save, PlusCircle, Trash2, Table as TableIcon, Calendar, Users, Target, HardHat } from 'lucide-react';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DateInput } from '@/components/ui/date-input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cleanFirestoreData } from '@/lib/utils';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';

const generateStableId = () => Math.random().toString(36).substring(2, 9);

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

export function FieldVisitsSpreadsheet({ onSaveSuccess }: { onSaveSuccess: () => void }) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  // جلب البيانات المرجعية
  const { data: employees = [], loading: engLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
  const [allTransactions, setAllTransactions] = React.useState<(ClientTransaction & { clientName: string })[]>([]);
  const [loadingTxs, setLoadingTxs] = React.useState(true);

  const { control, register, handleSubmit, formState: { errors }, watch, setValue } = useForm<SpreadsheetValues>({
    resolver: zodResolver(spreadsheetSchema),
    defaultValues: {
      date: new Date(),
      rows: [{ uid: generateStableId(), projectId: '', engineerId: '', details: '', team1: '', team2: '', team3: '', subcontractorName: '', requiredPayment: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'rows' });
  const watchedRows = useWatch({ control, name: 'rows' });

  // جلب كافة المعاملات لربطها بالأسطر
  React.useEffect(() => {
    if (!firestore) return;
    const fetchTxs = async () => {
        setLoadingTxs(true);
        try {
            const [txSnap, clientSnap] = await Promise.all([
                getDocs(query(collectionGroup(firestore, 'transactions'), where('status', '==', 'in-progress'))),
                getDocs(collection(firestore, 'clients'))
            ]);
            const clientMap = new Map(clientSnap.docs.map(d => [d.id, d.data().nameAr]));
            const txs = txSnap.docs.map(d => ({ 
                id: d.id, 
                ...d.data(), 
                clientName: clientMap.get(d.data().clientId) || 'عميل غير معروف' 
            } as ClientTransaction & { clientName: string }));
            setAllTransactions(txs);
        } finally {
            setLoadingTxs(false);
        }
    };
    fetchTxs();
  }, [firestore]);

  const projectOptions = React.useMemo(() => allTransactions.map(t => ({ value: t.id!, label: `${t.clientName} - ${t.transactionType}` })), [allTransactions]);
  const engineerOptions = React.useMemo(() => employees.map(e => ({ value: e.id!, label: e.fullName })), [employees]);

  const handleSaveAll = async (data: SpreadsheetValues) => {
    if (!firestore || !currentUser) return;
    setIsSaving(true);
    try {
        const batch = writeBatch(firestore);
        const notificationsToCreate: any[] = [];

        for (const row of data.rows) {
            const project = allTransactions.find(t => t.id === row.projectId)!;
            const engineer = employees.find(e => e.id === row.engineerId)!;
            
            const stage = project.stages?.find(s => s.stageId === row.plannedStageId);

            const visitData: Omit<FieldVisit, 'id'> = {
                clientId: project.clientId,
                clientName: project.clientName,
                transactionId: row.projectId,
                transactionType: project.transactionType,
                engineerId: row.engineerId,
                engineerName: engineer.fullName,
                scheduledDate: Timestamp.fromDate(data.date),
                plannedStageId: row.plannedStageId || '',
                plannedStageName: stage?.name || 'زيارة متابعة عامة',
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
                title: 'زيارة ميدانية مجدولة',
                body: `لديك زيارة لموقع ${project.clientName} يوم ${format(data.date, 'dd/MM/yyyy')}.`,
                link: `/dashboard/construction/field-visits/${newVisitRef.id}`
            });
        }

        await batch.commit();

        // إرسال الإشعارات
        for (const n of notificationsToCreate) {
            const userId = await findUserIdByEmployeeId(firestore, n.engineerId);
            if (userId) createNotification(firestore, { ...n, userId });
        }

        toast({ title: 'تم حفظ الخطة', description: `تمت جدولة ${data.rows.length} زيارة ميدانية بنجاح.` });
        onSaveSuccess();
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ خطة الزيارات.' });
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
                    <CardTitle className="text-2xl font-black flex items-center gap-2">
                        <TableIcon className="text-primary h-6 w-6" />
                        إدخال خطة الزيارات الميدانية (Bulk Entry)
                    </CardTitle>
                    <CardDescription>جدولة جماعية لزيارات المواقع والفرق الفنية في سطر واحد لكل موقع.</CardDescription>
                </div>
                <div className="flex items-center gap-4 bg-background p-3 rounded-2xl border shadow-inner">
                    <Label className="font-bold text-xs">تاريخ الخطة المستهدف:</Label>
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
                    <TableHead className="w-72 font-black text-right border-l"><Target className="h-4 w-4 inline ml-1"/> المشروع / العميل</TableHead>
                    <TableHead className="w-64 font-black text-right border-l"><Users className="h-4 w-4 inline ml-1"/> المهندس المسؤول</TableHead>
                    <TableHead className="w-56 font-black text-right border-l">المرحلة المستهدفة</TableHead>
                    <TableHead className="w-32 font-black text-center border-l">فريق 1</TableHead>
                    <TableHead className="w-32 font-black text-center border-l">فريق 2</TableHead>
                    <TableHead className="w-32 font-black text-center border-l">فريق 3</TableHead>
                    <TableHead className="w-56 font-black text-right border-l"><HardHat className="h-4 w-4 inline ml-1"/> المقاول المنفذ</TableHead>
                    <TableHead className="w-32 font-black text-center border-l text-blue-700">الدفعة</TableHead>
                    <TableHead className="w-full font-black text-right border-l">تفاصيل العمل الفني المطلوب</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const row = watchedRows[index];
                    const selectedTx = allTransactions.find(t => t.id === row.projectId);
                    const stageOptions = selectedTx?.stages?.map(s => ({ value: s.stageId, label: s.name })) || [];

                    return (
                      <TableRow key={field.id} className="h-16 hover:bg-muted/5 transition-colors border-b last:border-0 group">
                        <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground bg-muted/5 border-l">{index + 1}</TableCell>
                        <TableCell className="text-center border-l">
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="text-destructive rounded-full hover:bg-red-50">
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
                                            const tx = allTransactions.find(t => t.id === v);
                                            if (tx?.assignedEngineerId) setValue(`rows.${index}.engineerId`, tx.assignedEngineerId);
                                        }}
                                        options={projectOptions}
                                        placeholder="ابحث عن مشروع..."
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
                                        placeholder="اختر المهندس..."
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
                                        options={stageOptions}
                                        placeholder="المرحلة..."
                                        disabled={!row.projectId}
                                        className="border-none shadow-none focus-visible:ring-0 text-xs font-bold bg-transparent h-12"
                                    />
                                )}
                            />
                        </TableCell>

                        <TableCell className="border-l p-1"><Input {...register(`rows.${index}.team1`)} className="border-none shadow-none text-center font-bold h-12" placeholder="---"/></TableCell>
                        <TableCell className="border-l p-1"><Input {...register(`rows.${index}.team2`)} className="border-none shadow-none text-center font-bold h-12" placeholder="---"/></TableCell>
                        <TableCell className="border-l p-1"><Input {...register(`rows.${index}.team3`)} className="border-none shadow-none text-center font-bold h-12" placeholder="---"/></TableCell>
                        
                        <TableCell className="border-l p-1"><Input {...register(`rows.${index}.subcontractorName`)} className="border-none shadow-none font-bold h-12" placeholder="اسم المقاول..."/></TableCell>
                        <TableCell className="border-l p-1"><Input {...register(`rows.${index}.requiredPayment`)} className="border-none shadow-none text-center font-black text-blue-700 h-12" placeholder="رقم الدفعة"/></TableCell>
                        
                        <TableCell className="border-l p-1">
                            <Input {...register(`rows.${index}.details`)} className="border-none shadow-none text-right text-xs italic h-12" placeholder="مثال: استلام حديد السقف، فحص التمديدات..."/>
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
                إضافة سطر زيارة جديد للجدول
            </Button>
          </div>
        </CardContent>

        <CardFooter className="bg-muted/30 p-8 border-t flex justify-end gap-4">
            <Button type="button" variant="ghost" onClick={onSaveSuccess} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
            <Button type="submit" disabled={isSaving} className="h-14 px-16 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 gap-3 min-w-[300px]">
                {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                حفظ خطة اليوم بالكامل
            </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
