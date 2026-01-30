'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, collectionGroup, getDocs, query, writeBatch, doc } from 'firebase/firestore';
import type { Employee, Job } from '@/lib/types';
import { Loader2, ShieldCheck, Microscope, AlertTriangle } from 'lucide-react';
import { InlineSearchList } from '../ui/inline-search-list';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

interface Discrepancy {
    nonStandardName: string;
    count: number;
    employeeIds: string[];
}

export function DataIntegrityManager() {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(false);
    const [analysisResults, setAnalysisResults] = useState<Discrepancy[] | null>(null);
    const [corrections, setCorrections] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    
    const [allJobsOptions, setAllJobsOptions] = useState<any[]>([]);
     useEffect(() => {
        if(!firestore) return;
        const allJobsQuery = query(collectionGroup(firestore, 'jobs'));
        getDocs(allJobsQuery).then(snap => {
            const jobs = new Set<string>();
            snap.forEach(doc => jobs.add(doc.data().name));
            setAllJobsOptions(Array.from(jobs).sort().map(j => ({value: j, label: j})));
        });
    }, [firestore]);


    const handleAnalyze = async () => {
        if (!firestore) return;
        setIsLoading(true);
        setAnalysisResults(null);
        setCorrections({});

        try {
            const canonicalJobsSnapshot = await getDocs(query(collectionGroup(firestore, 'jobs')));
            const canonicalJobNames = new Set(canonicalJobsSnapshot.docs.map(doc => doc.data().name as string));
            
            const employeesSnapshot = await getDocs(collection(firestore, 'employees'));
            
            const discrepanciesMap = new Map<string, Discrepancy>();

            employeesSnapshot.forEach(doc => {
                const employee = { id: doc.id, ...doc.data() } as Employee;
                const jobTitle = employee.jobTitle;

                if (jobTitle && !canonicalJobNames.has(jobTitle)) {
                    if (discrepanciesMap.has(jobTitle)) {
                        const existing = discrepanciesMap.get(jobTitle)!;
                        existing.count++;
                        existing.employeeIds.push(employee.id!);
                    } else {
                        discrepanciesMap.set(jobTitle, {
                            nonStandardName: jobTitle,
                            count: 1,
                            employeeIds: [employee.id!]
                        });
                    }
                }
            });

            const results = Array.from(discrepanciesMap.values());
            setAnalysisResults(results);
            if (results.length === 0) {
                toast({
                    title: 'فحص مكتمل',
                    description: 'لم يتم العثور على أي مسميات وظيفية غير قياسية في بيانات الموظفين.',
                });
            }

        } catch (error) {
            console.error("Error analyzing data:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل فحص البيانات.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCorrectionChange = (nonStandardName: string, correctValue: string) => {
        setCorrections(prev => ({ ...prev, [nonStandardName]: correctValue }));
    };

    const handleApplyCorrections = async () => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            let correctionsCount = 0;

            for (const nonStandardName in corrections) {
                const correctValue = corrections[nonStandardName];
                if (correctValue) {
                    const discrepancy = analysisResults?.find(r => r.nonStandardName === nonStandardName);
                    if (discrepancy) {
                        discrepancy.employeeIds.forEach(empId => {
                            const employeeRef = doc(firestore, 'employees', empId);
                            batch.update(employeeRef, { jobTitle: correctValue });
                            correctionsCount++;
                        });
                    }
                }
            }
            
            if(correctionsCount === 0) {
                 toast({ variant: 'default', title: 'لا توجد تعديلات', description: 'الرجاء اختيار قيم التصحيح أولاً.' });
                 setIsSaving(false);
                 setIsConfirmOpen(false);
                 return;
            }

            await batch.commit();
            toast({
                title: 'نجاح!',
                description: `تم تصحيح ${correctionsCount} سجل بنجاح. قم بإعادة الفحص للتأكيد.`
            });
            setAnalysisResults(null);
            setCorrections({});

        } catch (error) {
            console.error("Error applying corrections:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تطبيق التصحيحات.' });
        } finally {
            setIsSaving(false);
            setIsConfirmOpen(false);
        }
    }

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>أداة سلامة البيانات</CardTitle>
                <CardDescription>
                    فحص وتصحيح البيانات غير المتطابقة في النظام، مثل المسميات الوظيفية غير القياسية للموظفين.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Button onClick={handleAnalyze} disabled={isLoading}>
                    {isLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Microscope className="ml-2 h-4 w-4" />}
                    فحص المسميات الوظيفية للموظفين
                </Button>
                
                {isLoading && (
                    <div className="text-center p-8 text-muted-foreground">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                        <p className="mt-2">جاري فحص بيانات الموظفين...</p>
                    </div>
                )}
                
                {analysisResults && !isLoading && (
                    <div>
                        {analysisResults.length === 0 ? (
                            <div className="text-center p-8 text-green-600 bg-green-50 rounded-lg border border-green-200">
                                <ShieldCheck className="mx-auto h-12 w-12" />
                                <h3 className="mt-4 text-lg font-semibold">البيانات سليمة</h3>
                                <p className="mt-2 text-sm">لم يتم العثور على مسميات وظيفية غير قياسية.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <h3 className="font-semibold text-yellow-800 flex items-center gap-2">
                                        <AlertTriangle />
                                        تم العثور على {analysisResults.length} مسميات وظيفية غير متطابقة
                                    </h3>
                                </div>
                                <div className="space-y-2">
                                    {analysisResults.map(res => (
                                        <div key={res.nonStandardName} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-2 border-b">
                                            <div className="md:col-span-1">
                                                <p className="font-semibold text-destructive">{res.nonStandardName}</p>
                                                <p className="text-xs text-muted-foreground">{res.count} موظفين</p>
                                            </div>
                                            <div className="md:col-span-2">
                                                <InlineSearchList
                                                    placeholder="اختر المسمى الوظيفي الصحيح..."
                                                    options={allJobsOptions}
                                                    value={corrections[res.nonStandardName] || ''}
                                                    onSelect={(value) => handleCorrectionChange(res.nonStandardName, value)}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
            {analysisResults && analysisResults.length > 0 && (
                <CardFooter>
                    <Button onClick={() => setIsConfirmOpen(true)} disabled={Object.keys(corrections).length === 0}>
                        تطبيق التصحيحات المحددة
                    </Button>
                </CardFooter>
            )}
        </Card>
        <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>تأكيد تطبيق التصحيحات؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم تحديث المسميات الوظيفية للموظفين المتأثرين بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isSaving}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleApplyCorrections} disabled={isSaving}>
                        {isSaving ? <><Loader2 className="ml-2 h-4 w-4 animate-spin"/> جاري الحفظ...</> : 'نعم، قم بالتطبيق'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
