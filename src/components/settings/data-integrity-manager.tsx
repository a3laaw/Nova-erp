'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, writeBatch, doc, getDocs, limit, deleteDoc, collectionGroup } from 'firebase/firestore';
import type { Employee } from '@/lib/types';
import { Loader2, Trash2, ShieldAlert, AlertCircle, UserX, CheckCircle2, DatabaseZap, RotateCcw, X } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Input } from '../ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function TerminatedEmployeesManager() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [isWipeAllOpen, setIsWipeAllOpen] = useState(false);

  const terminatedEmployeesQuery = useMemo(() => {
    if (!firestore) return null;
    return [where('status', '==', 'terminated')];
  }, [firestore]);
  
  const { data: terminatedEmployees, loading } = useSubscription<Employee>(firestore, 'employees', terminatedEmployeesQuery || []);

  const handleDeleteClick = (employee: Employee) => {
    setEmployeeToDelete(employee);
  };
  
  const handleConfirmDelete = async () => {
    if (!firestore || !employeeToDelete) return;
    setIsProcessing(true);
    try {
        const batch = writeBatch(firestore);
        
        const employeeRef = doc(firestore, 'employees', employeeToDelete.id!);
        batch.delete(employeeRef);

        const usersQuery = query(collection(firestore, 'users'), where('employeeId', '==', employeeToDelete.id!), limit(1));
        const userSnap = await getDocs(usersQuery);
        if (!userSnap.empty) {
            const userDocRef = userSnap.docs[0].ref;
            batch.delete(userDocRef);
        }

        await batch.commit();
        toast({ title: 'نجاح', description: `تم حذف الموظف "${employeeToDelete.fullName}" وبياناته بشكل نهائي.` });

    } catch(e) {
        console.error(e);
        toast({variant: 'destructive', title: 'خطأ', description: 'فشل حذف الموظف بشكل نهائي.'});
    } finally {
        setIsProcessing(false);
        setEmployeeToDelete(null);
    }
  };

  const handleWipeAll = async () => {
    if (!firestore || terminatedEmployees.length === 0) return;
    setIsProcessing(true);
    try {
        const batch = writeBatch(firestore);
        
        terminatedEmployees.forEach(emp => {
            batch.delete(doc(firestore, 'employees', emp.id!));
        });

        const employeeIds = terminatedEmployees.map(e => e.id);
        const chunks = [];
        for (let i = 0; i < employeeIds.length; i += 30) {
            chunks.push(employeeIds.slice(i, i + 30));
        }

        for (const chunk of chunks) {
            const usersQuery = query(collection(firestore, 'users'), where('employeeId', 'in', chunk));
            const usersSnap = await getDocs(usersQuery);
            usersSnap.forEach(uDoc => batch.delete(uDoc.ref));
        }

        await batch.commit();
        toast({ title: 'تم التنظيف بنجاح', description: `تم مسح جميع الموظفين المنهي خدماتهم (${terminatedEmployees.length}) وحساباتهم.` });
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل المسح الجماعي.' });
    } finally {
        setIsProcessing(false);
        setIsWipeAllOpen(false);
    }
  };

  return (
    <div className="space-y-4">
        <div className="flex justify-between items-center">
            <h3 className="font-black text-lg flex items-center gap-2">
                <UserX className="text-red-600 h-5 w-5" />
                إدارة الموظفين المنتهية خدماتهم
            </h3>
            {terminatedEmployees.length > 0 && (
                <Button variant="destructive" size="sm" onClick={() => setIsWipeAllOpen(true)} disabled={isProcessing} className="font-bold gap-2">
                    <Trash2 className="h-4 w-4" />
                    مسح جميع المنهية خدماتهم ({terminatedEmployees.length})
                </Button>
            )}
        </div>
        <p className="text-sm text-muted-foreground">
            هذه القائمة تعرض الموظفين الذين تم إنهاء خدمتهم فقط. يمكنك حذف بياناتهم بشكل نهائي من النظام من هنا لتوفير المساحة وتصفية السجلات.
        </p>
        <div className="border rounded-2xl overflow-hidden shadow-sm">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead className="font-bold">الاسم</TableHead>
                        <TableHead className="font-bold">الرقم الوظيفي</TableHead>
                        <TableHead className="font-bold">تاريخ إنهاء الخدمة</TableHead>
                        <TableHead className="text-left"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading && <TableRow><TableCell colSpan={4} className="text-center p-4"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>}
                    {!loading && terminatedEmployees.length === 0 && <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground italic">لا يوجد موظفون منتهية خدماتهم حاليًا.</TableCell></TableRow>}
                    {!loading && terminatedEmployees.map(emp => (
                        <TableRow key={emp.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-bold">{emp.fullName || (emp as any).nameAr}</TableCell>
                            <TableCell className="font-mono text-xs">{emp.employeeNumber}</TableCell>
                            <TableCell className="text-xs">{emp.terminationDate ? format(toFirestoreDate(emp.terminationDate)!, 'dd/MM/yyyy') : '-'}</TableCell>
                            <TableCell className="text-left">
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(emp)} className="text-destructive hover:bg-red-50">
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>

        <AlertDialog open={!!employeeToDelete} onOpenChange={() => setEmployeeToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-3xl">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-black">تأكيد الحذف النهائي؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-base">
                        هل أنت متأكد من رغبتك في حذف بيانات الموظف "{employeeToDelete?.fullName}" بشكل نهائي؟ سيتم حذف ملفه وحسابه من النظام ولا يمكن التراجع عن هذا الإجراء.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold">
                        {isProcessing ? <><Loader2 className="ml-2 h-4 w-4 animate-spin"/> جاري الحذف...</> : 'نعم، قم بالحذف النهائي'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isWipeAllOpen} onOpenChange={setIsWipeAllOpen}>
            <AlertDialogContent dir="rtl" className="rounded-3xl">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-red-100 rounded-2xl text-red-600 shadow-inner">
                            <AlertCircle className="h-6 w-6" />
                        </div>
                        <AlertDialogTitle className="text-2xl font-black text-red-700">تحذير: مسح جماعي!</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="text-base font-medium leading-relaxed">
                        أنت على وشك حذف <strong>جميع الموظفين</strong> المنتهية خدماتهم في النظام (العدد: {terminatedEmployees.length}). 
                        <br/><br/>
                        سيتم مسح ملفاتهم وحسابات دخولهم وسجلاتهم بشكل دائم. <strong>لا يمكن استعادة هذه البيانات بعد الحذف.</strong>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-6 gap-2">
                    <AlertDialogCancel className="rounded-xl font-bold">تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={handleWipeAll} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90 rounded-xl font-black px-10">
                        {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، مسح الكل الآن'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

function SystemWipeManager() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [wipeType, setWipeType] = useState<'operational' | 'full'>('operational');
    
    const CONFIRMATION_PHRASE = 'مسح البيانات';

    const operationalCollections = [
        'clients', 'employees', 'leaveRequests', 'permissionRequests', 
        'attendance', 'payroll', 'notifications', 'appointments', 
        'journalEntries', 'paymentVouchers', 'cashReceipts', 'quotations', 
        'purchaseOrders', 'purchase_requests', 'grns', 'inventoryAdjustments', 
        'projects', 'field_visits', 'boqs', 'payment_applications', 
        'subcontractor_certificates', 'recurring_obligations', 'counters',
        'timelineEvents', 'history', 'auditLogs', 'daily_reports', 'items'
    ];

    const referenceCollections = [
        'company_settings', 'users', 'departments', 'governorates', 
        'transactionTypes', 'contractTemplates', 'chartOfAccounts', 
        'itemCategories', 'boqReferenceItems', 'construction_types',
        'subcontractorTypes', 'workTeams', 'vendors', 'subcontractors',
        'jobs', 'areas', 'workStages', 'specializations'
    ];
    
    const handleWipeData = async () => {
        if (!firestore) return;
        setIsProcessing(true);
        try {
            let deletedDocsCount = 0;
            const targetCollections = wipeType === 'full' 
                ? [...operationalCollections, ...referenceCollections]
                : operationalCollections;
            
            for (const collectionName of targetCollections) {
                let hasMore = true;
                while (hasMore) {
                    const q = query(collectionGroup(firestore, collectionName), limit(400));
                    const snapshot = await getDocs(q);
                    
                    if (snapshot.empty) {
                        hasMore = false;
                        continue;
                    }
                    
                    const batch = writeBatch(firestore);
                    snapshot.docs.forEach(docSnap => batch.delete(docSnap.ref));
                    await batch.commit();
                    
                    deletedDocsCount += snapshot.size;
                    if (snapshot.size < 400) hasMore = false;
                }
            }
            
            toast({ 
                title: 'تم التنظيف', 
                description: `تم مسح ${deletedDocsCount} سجلاً بنجاح. ${wipeType === 'operational' ? 'تم الحفاظ على القوائم المرجعية.' : 'تم مسح النظام بالكامل.'}` 
            });
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل مسح بعض البيانات.' });
        } finally {
            setIsProcessing(false);
            setIsConfirmOpen(false);
            setConfirmText('');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <DatabaseZap className="text-primary h-6 w-6" />
                <h3 className="font-black text-xl">تطهير وتصفير قاعدة البيانات</h3>
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
                اختر نوع المسح المطلوب. نوصي بمسح <strong>البيانات التشغيلية</strong> فقط إذا كنت ترغب في تنظيف النظام من حركات التجربة السابقة مع الحفاظ على إعدادات شركتك (الأقسام، الموظفين، أنواع المعاملات).
            </p>

            <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all rounded-3xl bg-muted/5 group">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary"><RotateCcw className="h-5 w-5"/></div>
                            <Badge variant="secondary" className="bg-primary/5 text-primary">آمن للتجربة</Badge>
                        </div>
                        <CardTitle className="text-lg font-black mt-4">مسح البيانات التشغيلية</CardTitle>
                        <CardDescription className="text-xs">حذف الحركات، العملاء، والمالية.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs space-y-2">
                        <p className="flex items-center gap-2 text-green-600 font-bold"><CheckCircle2 className="h-3 w-3"/> الحفاظ على الأقسام والوظائف</p>
                        <p className="flex items-center gap-2 text-green-600 font-bold"><CheckCircle2 className="h-3 w-3"/> الحفاظ على شجرة الحسابات والشركات</p>
                        <p className="flex items-center gap-2 text-red-600 font-bold"><X className="h-3 w-3"/> مسح كل العملاء والمشاريع والقيود</p>
                    </CardContent>
                    <CardFooter>
                        <Button 
                            className="w-full rounded-xl font-bold" 
                            onClick={() => { setWipeType('operational'); setIsConfirmOpen(true); }}
                        >
                            تطهير الحركات فقط
                        </Button>
                    </CardFooter>
                </Card>

                <Card className="border-2 border-red-100 hover:border-red-300 transition-all rounded-3xl bg-red-50/10 group">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div className="p-2 bg-red-100 rounded-xl text-red-600"><ShieldAlert className="h-5 w-5"/></div>
                            <Badge variant="destructive" className="font-black">خطير جداً</Badge>
                        </div>
                        <CardTitle className="text-lg font-black mt-4 text-red-900">مسح قاعدة البيانات بالكامل</CardTitle>
                        <CardDescription className="text-xs">حذف كل شيء والبدء من الصفر تماماً.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs space-y-2">
                        <p className="flex items-center gap-2 text-red-600 font-bold"><X className="h-3 w-3"/> مسح القوائم المرجعية والمواقع</p>
                        <p className="flex items-center gap-2 text-red-600 font-bold"><X className="h-3 w-3"/> مسح إعدادات العلامة التجارية</p>
                        <p className="flex items-center gap-2 text-red-600 font-bold"><X className="h-3 w-3"/> مسح حسابات المستخدمين والمديرين</p>
                    </CardContent>
                    <CardFooter>
                        <Button 
                            variant="destructive" 
                            className="w-full rounded-xl font-bold" 
                            onClick={() => { setWipeType('full'); setIsConfirmOpen(true); }}
                        >
                            مسح شامل (إخلاء المصنع)
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <AlertDialogContent dir="rtl" className="rounded-[2rem]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد عملية المسح</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4 pt-2">
                                <p className="text-base">
                                    {wipeType === 'full' 
                                        ? "أنت على وشك تصفير النظام بالكامل. سيتم مسح الإعدادات والقوائم المرجعية."
                                        : "سيتم مسح حركات العملاء والمشاريع والمالية، مع الحفاظ على هيكل النظام المرجعي."}
                                </p>
                                <p className="font-black text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 text-center uppercase tracking-widest">تحذير: لا يمكن التراجع</p>
                                <p className="font-bold">للتأكيد، يرجى كتابة العبارة التالية:</p>
                                <p className="font-mono font-black text-center bg-muted p-3 rounded-xl border-2 border-dashed">{CONFIRMATION_PHRASE}</p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="اكتب العبارة هنا..."
                        className="h-12 rounded-xl border-2 text-center text-lg font-black"
                    />
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel disabled={isProcessing} className="rounded-xl font-bold">إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleWipeData} disabled={confirmText !== CONFIRMATION_PHRASE || isProcessing} className="bg-destructive hover:bg-destructive/90 rounded-xl font-black h-12 px-10">
                            {isProcessing ? <><Loader2 className="ml-2 h-4 w-4 animate-spin"/> جاري المسح...</> : 'تأكيد المسح النهائي'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export function DataIntegrityManager() {
    return (
        <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 border-b pb-8 px-8">
                <CardTitle className="text-2xl font-black">أداة سلامة وتطهير البيانات</CardTitle>
                <CardDescription className="text-base font-medium">
                    أدوات متقدمة لفحص وتصحيح وحذف البيانات في النظام لضمان الدقة الكاملة. استخدمها بحذر.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-12">
                <TerminatedEmployeesManager />
                <Separator />
                <SystemWipeManager />
            </CardContent>
        </Card>
    );
}