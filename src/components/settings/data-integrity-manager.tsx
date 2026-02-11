'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, collectionGroup, getDocs, query, writeBatch, doc } from 'firebase/firestore';
import type { Employee } from '@/lib/types';
import { Loader2, ShieldCheck, Microscope, AlertTriangle } from 'lucide-react';
import { InlineSearchList } from '../ui/inline-search-list';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Separator } from '../ui/separator';

interface Discrepancy {
    nonStandardName: string;
    count: number;
    docIds: string[];
}

// Reusable Analysis Section Component
function AnalysisSection({
    title,
    description,
    buttonText,
    onAnalyze,
    isLoading,
    analysisResults,
    correctionOptions,
    corrections,
    onCorrectionChange,
    onApplyCorrections,
    itemCountLabel,
}: {
    title: string;
    description: string;
    buttonText: string;
    onAnalyze: () => void;
    isLoading: boolean;
    analysisResults: Discrepancy[] | null;
    correctionOptions: { value: string; label: string }[];
    corrections: Record<string, string>;
    onCorrectionChange: (nonStandardName: string, correctValue: string) => void;
    onApplyCorrections: () => void;
    itemCountLabel: string;
}) {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleConfirmApply = async () => {
        setIsSaving(true);
        await onApplyCorrections();
        setIsSaving(false);
        setIsConfirmOpen(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <Button onClick={onAnalyze} disabled={isLoading} variant="outline" size="sm">
                    {isLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Microscope className="ml-2 h-4 w-4" />}
                    {buttonText}
                </Button>
            </div>
            
            {isLoading && (
                <div className="text-center p-8 text-muted-foreground">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                    <p className="mt-2">جاري الفحص...</p>
                </div>
            )}
            
            {analysisResults && !isLoading && (
                <div>
                    {analysisResults.length === 0 ? (
                        <div className="text-center p-8 text-green-600 bg-green-50 rounded-lg border border-green-200">
                            <ShieldCheck className="mx-auto h-12 w-12" />
                            <h3 className="mt-4 text-lg font-semibold">البيانات سليمة</h3>
                            <p className="mt-2 text-sm">لم يتم العثور على أي بيانات غير متطابقة.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <h3 className="font-semibold text-yellow-800 flex items-center gap-2">
                                    <AlertTriangle />
                                    تم العثور على {analysisResults.length} أسماء غير متطابقة
                                </h3>
                            </div>
                            <div className="space-y-2">
                                {analysisResults.map(res => (
                                    <div key={res.nonStandardName} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-2 border-b">
                                        <div className="md:col-span-1">
                                            <p className="font-semibold text-destructive">{res.nonStandardName}</p>
                                            <p className="text-xs text-muted-foreground">{res.count} {itemCountLabel}</p>
                                        </div>
                                        <div className="md:col-span-2">
                                            <InlineSearchList
                                                placeholder="اختر القيمة الصحيحة..."
                                                options={correctionOptions}
                                                value={corrections[res.nonStandardName] || ''}
                                                onSelect={(value) => onCorrectionChange(res.nonStandardName, value)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button onClick={() => setIsConfirmOpen(true)} disabled={Object.keys(corrections).length === 0}>
                                    تطبيق التصحيحات المحددة
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد تطبيق التصحيحات؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم تحديث البيانات للسجلات المتأثرة بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmApply} disabled={isSaving}>
                            {isSaving ? <><Loader2 className="ml-2 h-4 w-4 animate-spin"/> جاري الحفظ...</> : 'نعم، قم بالتطبيق'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// Main Component
export function DataIntegrityManager() {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    // State for Job Title Analysis
    const [isLoadingJobs, setIsLoadingJobs] = useState(false);
    const [jobAnalysisResults, setJobAnalysisResults] = useState<Discrepancy[] | null>(null);
    const [jobCorrections, setJobCorrections] = useState<Record<string, string>>({});
    const [allJobsOptions, setAllJobsOptions] = useState<any[]>([]);

    // State for Department Analysis
    const [isLoadingDepts, setIsLoadingDepts] = useState(false);
    const [deptAnalysisResults, setDeptAnalysisResults] = useState<Discrepancy[] | null>(null);
    const [deptCorrections, setDeptCorrections] = useState<Record<string, string>>({});
    const [allDeptsOptions, setAllDeptsOptions] = useState<any[]>([]);

    const handleAnalyzeGeneric = async (
        setIsLoading: (loading: boolean) => void,
        setResults: (results: Discrepancy[] | null) => void,
        setCorrections: (corrections: Record<string, string>) => void,
        canonicalCollectionPath: string,
        targetCollectionPath: string,
        targetFieldName: keyof Employee,
        isGroupQuery: boolean = false
    ) => {
        if (!firestore) return;
        setIsLoading(true);
        setResults(null);
        setCorrections({});

        try {
            const canonicalCollection = isGroupQuery ? collectionGroup(firestore, canonicalCollectionPath) : collection(firestore, canonicalCollectionPath);
            const canonicalSnapshot = await getDocs(query(canonicalCollection));
            const canonicalNames = new Set(canonicalSnapshot.docs.map(doc => doc.data().name as string));
            
            const targetSnapshot = await getDocs(collection(firestore, targetCollectionPath));
            
            const discrepanciesMap = new Map<string, Discrepancy>();

            targetSnapshot.forEach(doc => {
                const item = { id: doc.id, ...doc.data() } as Employee;
                const value = item[targetFieldName] as string;

                if (value && !canonicalNames.has(value)) {
                    if (discrepanciesMap.has(value)) {
                        const existing = discrepanciesMap.get(value)!;
                        existing.count++;
                        existing.docIds.push(item.id!);
                    } else {
                        discrepanciesMap.set(value, {
                            nonStandardName: value,
                            count: 1,
                            docIds: [item.id!]
                        });
                    }
                }
            });

            const results = Array.from(discrepanciesMap.values());
            setResults(results);
            if (results.length === 0) {
                toast({ title: 'فحص مكتمل', description: 'لم يتم العثور على أي بيانات غير قياسية.' });
            }

        } catch (error) {
            console.error("Error analyzing data:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل فحص البيانات.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyCorrectionsGeneric = async (
        corrections: Record<string, string>,
        analysisResults: Discrepancy[] | null,
        targetCollectionPath: string,
        targetFieldName: string
    ) => {
        if (!firestore || !analysisResults) return;

        const batch = writeBatch(firestore);
        let correctionsCount = 0;

        for (const nonStandardName in corrections) {
            const correctValue = corrections[nonStandardName];
            if (correctValue) {
                const discrepancy = analysisResults.find(r => r.nonStandardName === nonStandardName);
                if (discrepancy) {
                    discrepancy.docIds.forEach(docId => {
                        const docRef = doc(firestore, targetCollectionPath, docId);
                        batch.update(docRef, { [targetFieldName]: correctValue });
                        correctionsCount++;
                    });
                }
            }
        }
        
        if (correctionsCount === 0) {
            toast({ variant: 'default', title: 'لا توجد تعديلات', description: 'الرجاء اختيار قيم التصحيح أولاً.' });
            return;
        }

        await batch.commit();
        toast({ title: 'نجاح!', description: `تم تصحيح ${correctionsCount} سجل بنجاح. قم بإعادة الفحص للتأكيد.` });
        
        if(targetFieldName === 'jobTitle') {
             setJobAnalysisResults(null);
             setJobCorrections({});
        } else if (targetFieldName === 'department') {
            setDeptAnalysisResults(null);
            setDeptCorrections({});
        }
    };
    
    // --- Specific Handlers ---
    const handleAnalyzeJobTitles = () => handleAnalyzeGeneric(setIsLoadingJobs, setJobAnalysisResults, setJobCorrections, 'jobs', 'employees', 'jobTitle', true);
    const handleApplyJobCorrections = () => handleApplyCorrectionsGeneric(jobCorrections, jobAnalysisResults, 'employees', 'jobTitle');
    
    const handleAnalyzeDepartments = () => handleAnalyzeGeneric(setIsLoadingDepts, setDeptAnalysisResults, setDeptCorrections, 'departments', 'employees', 'department', false);
    const handleApplyDepartmentCorrections = () => handleApplyCorrectionsGeneric(deptCorrections, deptAnalysisResults, 'employees', 'department');
    
    // Fetch options for dropdowns
    useEffect(() => {
        if(!firestore) return;
        getDocs(query(collectionGroup(firestore, 'jobs'))).then(snap => {
            const jobs = new Set<string>();
            snap.forEach(doc => jobs.add(doc.data().name));
            setAllJobsOptions(Array.from(jobs).sort().map(j => ({value: j, label: j})));
        });

        getDocs(query(collection(firestore, 'departments'))).then(snap => {
            const depts = snap.docs.map(d => d.data().name as string).sort();
            setAllDeptsOptions(depts.map(d => ({value: d, label: d})));
        });
    }, [firestore]);


    return (
        <Card>
            <CardHeader>
                <CardTitle>أداة سلامة البيانات</CardTitle>
                <CardDescription>
                    فحص وتصحيح البيانات غير المتطابقة في النظام لضمان تناسق التقارير والعمليات.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <AnalysisSection
                    title="فحص المسميات الوظيفية للموظفين"
                    description="يفحص المسميات الوظيفية للموظفين ويقارنها بقائمة الوظائف المرجعية."
                    buttonText="فحص المسميات"
                    onAnalyze={handleAnalyzeJobTitles}
                    isLoading={isLoadingJobs}
                    analysisResults={jobAnalysisResults}
                    correctionOptions={allJobsOptions}
                    corrections={jobCorrections}
                    onCorrectionChange={(nonStandard, correct) => setJobCorrections(prev => ({ ...prev, [nonStandard]: correct }))}
                    onApplyCorrections={handleApplyJobCorrections}
                    itemCountLabel="موظفين"
                />
                
                <Separator />

                <AnalysisSection
                    title="فحص أقسام الموظفين"
                    description="يفحص أسماء الأقسام المسجلة للموظفين ويقارنها بقائمة الأقسام المرجعية."
                    buttonText="فحص الأقسام"
                    onAnalyze={handleAnalyzeDepartments}
                    isLoading={isLoadingDepts}
                    analysisResults={deptAnalysisResults}
                    correctionOptions={allDeptsOptions}
                    corrections={deptCorrections}
                    onCorrectionChange={(nonStandard, correct) => setDeptCorrections(prev => ({ ...prev, [nonStandard]: correct }))}
                    onApplyCorrections={handleApplyDepartmentCorrections}
                    itemCountLabel="موظفين"
                />

            </CardContent>
        </Card>
    );
}
