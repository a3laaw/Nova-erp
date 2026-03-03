
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFirebase } from '@/firebase';
import { doc, runTransaction, collection, serverTimestamp, getDocs, query, orderBy, getDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import type { ConstructionProject, ContractTemplate, Client, Employee } from '@/lib/types';
import { ProjectForm } from '@/components/construction/project-form';
import { cleanFirestoreData, formatCurrency } from '@/lib/utils';

/**
 * صفحة إنشاء مشروع مقاولات جديد:
 * - تم تطويرها لتقوم باستنساخ بنود الدفعات والقيود المحاسبية آلياً من نموذج العقد المختار.
 */
export default function NewProjectPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    
    const handleSave = useCallback(async (newProjectData: any) => {
        if (!firestore || !currentUser) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات أو تحديد المستخدم.' });
            return;
        }

        setIsSaving(true);
        let newProjectId = '';

        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                
                // 1. توليد رقم المشروع التسلسلي
                const counterRef = doc(firestore, 'counters', 'constructionProjects');
                const counterDoc = await transaction.get(counterRef);
                let nextNumber = 1;
                if (counterDoc.exists()) {
                    const counts = counterDoc.data()?.counts || {};
                    nextNumber = (counts[currentYear] || 0) + 1;
                }
                
                const newId = `PRJ-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
                const newProjectRef = doc(collection(firestore, 'projects'));
                newProjectId = newProjectRef.id;

                // 2. معالجة نموذج العقد (Template Logic)
                let contractClauses: any[] = [];
                let contractMeta: any = null;

                if (newProjectData.contractTemplateId) {
                    const templateSnap = await transaction.get(doc(firestore, 'contractTemplates', newProjectData.contractTemplateId));
                    if (templateSnap.exists()) {
                        const template = templateSnap.data() as ContractTemplate;
                        contractMeta = {
                            type: template.financials?.type || 'fixed',
                            totalAmount: newProjectData.contractValue || template.financials?.totalAmount,
                            scopeOfWork: template.scopeOfWork || [],
                            termsAndConditions: template.termsAndConditions || [],
                            openClauses: template.openClauses || []
                        };

                        // تحويل Milestones إلى Clauses مبرمجة في العقد
                        contractClauses = (template.financials?.milestones || []).map(m => {
                            const amount = template.financials?.type === 'percentage'
                                ? (Number(m.value) / 100) * Number(contractMeta.totalAmount)
                                : Number(m.value);
                            return {
                                id: m.id || Math.random().toString(36).substring(7),
                                name: m.name,
                                condition: m.condition || '',
                                amount: amount,
                                status: 'غير مستحقة',
                                percentage: template.financials?.type === 'percentage' ? Number(m.value) : null
                            };
                        });
                    }
                }

                // 3. إنشاء المعاملة المرتبطة (Linked Transaction)
                // في Nova ERP، المشروع التنفيذي هو وجه فني لـ "معاملة" مالية
                const clientSnap = await transaction.get(doc(firestore, 'clients', newProjectData.clientId));
                const clientData = clientSnap.exists() ? clientSnap.data() as Client : null;
                const nextTxCount = (clientData?.transactionCounter || 0) + 1;
                const txNumber = `CL${clientData?.fileNumber}-TX${String(nextTxCount).padStart(2, '0')}`;

                const newTxRef = doc(collection(firestore, `clients/${newProjectData.clientId}/transactions`));
                const txData = {
                    transactionNumber: txNumber,
                    clientId: newProjectData.clientId,
                    transactionType: newProjectData.projectType === 'تنفيذي' ? 'مقاولات تنفيذية' : newProjectData.projectName,
                    status: 'in-progress',
                    assignedEngineerId: newProjectData.mainEngineerId,
                    createdAt: serverTimestamp(),
                    contract: contractMeta ? {
                        ...contractMeta,
                        clauses: contractClauses
                    } : null
                };
                transaction.set(newTxRef, txData);
                transaction.update(doc(firestore, 'clients', newProjectData.clientId), { transactionCounter: nextTxCount, status: 'contracted' });

                // 4. إنشاء القيد المحاسبي لإثبات المديونية (Accounts Receivable)
                if (newProjectData.contractValue > 0) {
                    const jeCounterRef = doc(firestore, 'counters', 'journalEntries');
                    const jeCounterDoc = await transaction.get(jeCounterRef);
                    const nextJeNum = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                    const jeNumber = `JV-PRJ-${currentYear}-${String(nextJeNum).padStart(4, '0')}`;

                    // جلب الحسابات (إيرادات مقاولات و حساب العميل)
                    const revenueAccSnap = await getDocs(query(collection(firestore, 'chartOfAccounts'), where('code', '==', '4101'), limit(1)));
                    const clientAccSnap = await getDocs(query(collection(firestore, 'chartOfAccounts'), where('name', '==', clientData?.nameAr), limit(1)));

                    if (!revenueAccSnap.empty && !clientAccSnap.empty) {
                        const jeRef = doc(collection(firestore, 'journalEntries'));
                        const jeData = {
                            entryNumber: jeNumber,
                            date: serverTimestamp(),
                            narration: `إثبات مديونية عقد مشروع: ${newProjectData.projectName}`,
                            status: 'posted',
                            totalDebit: newProjectData.contractValue,
                            totalCredit: newProjectData.contractValue,
                            lines: [
                                { accountId: clientAccSnap.docs[0].id, accountName: clientData?.nameAr, debit: newProjectData.contractValue, credit: 0, auto_profit_center: newProjectRef.id },
                                { accountId: revenueAccSnap.docs[0].id, accountName: revenueAccSnap.docs[0].data().name, debit: 0, credit: newProjectData.contractValue, auto_profit_center: newProjectRef.id }
                            ],
                            transactionId: newTxRef.id,
                            clientId: newProjectData.clientId,
                            createdAt: serverTimestamp(),
                            createdBy: currentUser.id
                        };
                        transaction.set(jeRef, jeData);
                        transaction.set(jeCounterRef, { counts: { [currentYear]: nextJeNum } }, { merge: true });
                    }
                }

                // 5. حفظ بيانات المشروع النهائية
                const finalProjectData = {
                    ...newProjectData,
                    projectId: newId,
                    linkedTransactionId: newTxRef.id,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                };
                
                transaction.set(newProjectRef, cleanFirestoreData(finalProjectData));
                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });

                // 6. استنساخ مراحل العمل الشجرية (WBS)
                if (newProjectData.constructionTypeId) {
                    const stagesRef = collection(firestore, `construction_types/${newProjectData.constructionTypeId}/stages`);
                    const stagesSnap = await getDocs(query(stagesRef, orderBy('order')));
                    
                    for (const stageDoc of stagesSnap.docs) {
                        const templateStage = stageDoc.data();
                        const projectStageRef = doc(collection(firestore, `projects/${newProjectId}/stages`));
                        transaction.set(projectStageRef, {
                            ...templateStage,
                            templateStageId: stageDoc.id,
                            status: 'pending',
                            progress: 0,
                            createdAt: serverTimestamp(),
                        });
                    }
                }
            });
            
            toast({ title: 'نجاح التأسيس المالي', description: 'تم إنشاء المشروع، ربط العقد، وتوليد القيد المحاسبي آلياً.' });
            router.push(`/dashboard/construction/projects/${newProjectId}`);
            
        } catch (error) {
            console.error("Error creating project:", error);
            const errorMessage = error instanceof Error ? error.message : 'فشل إنشاء المشروع.';
            toast({ title: "خطأ", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, currentUser, toast, router, employees, departments]);

    return (
        <Card className="max-w-4xl mx-auto rounded-3xl shadow-xl overflow-hidden border-none" dir="rtl">
            <CardHeader className="bg-primary/5 pb-8">
                <CardTitle className="text-3xl font-black">إنشاء مشروع مقاولات جديد</CardTitle>
                <CardDescription className="text-base font-medium">أدخل تفاصيل المشروع التنفيذي لربطه آلياً بنموذج العقد وبنك الائتمان والمحاسبة.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
                <ProjectForm
                    onSave={handleSave}
                    onClose={() => router.back()}
                    isSaving={isSaving}
                />
            </CardContent>
        </Card>
    );
}
