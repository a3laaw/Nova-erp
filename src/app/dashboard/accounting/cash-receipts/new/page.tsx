'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Printer, Save, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, runTransaction, serverTimestamp, Timestamp, getDoc, updateDoc, orderBy, writeBatch, limit, collectionGroup, addDoc } from 'firebase/firestore';
import type { Client, Company, ClientTransaction, Account, Employee, Department, TransactionStage, WorkStage } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { numberToArabicWords, formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { DateInput } from '@/components/ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';

const getTotalPaidForProject = async (projectId: string, db: any, excludeReceiptId?: string) => {
    let total = 0;
    if (!projectId || !db) return total;
    const receiptsQuery = query(collection(db, 'cashReceipts'), where('projectId', '==', projectId));
    const receiptsSnap = await getDocs(receiptsQuery);
    receiptsSnap.forEach(doc => {
        if (doc.id !== excludeReceiptId) {
            total += doc.data().amount || 0;
        }
    });
    return total;
};


export default function NewCashReceiptPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  
  const [clientProjects, setClientProjects] = useState<ClientTransaction[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Form state
  const [isSaving, setIsSaving] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [amount, setAmount] = useState('');
  const [amountInWords, setAmountInWords] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [reference, setReference] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('');

  const [voucherNumber, setVoucherNumber] = useState('جاري التوليد...');
  const [isGeneratingVoucher, setIsGeneratingVoucher] = useState(true);

  useEffect(() => {
    if (!firestore) return;

    const generateVoucherNumber = async () => {
        setIsGeneratingVoucher(true);
        try {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'cashReceipts');
            const counterDoc = await getDoc(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            setVoucherNumber(`CRV-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
        } catch (error) {
            console.error("Error generating voucher number:", error);
            setVoucherNumber('خطأ');
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل توليد رقم سند تلقائي.' });
        } finally {
            setIsGeneratingVoucher(false);
        }
    };

    generateVoucherNumber();
  }, [firestore, toast]);

  useEffect(() => {
    if (amount && !isNaN(parseFloat(amount))) {
        setAmountInWords(numberToArabicWords(amount));
    } else {
        setAmountInWords('');
    }
  }, [amount]);


  // Effect to fetch initial company, client, and accounts data
  useEffect(() => {
    if (!firestore) return;

    const fetchInitialData = async () => {
        setClientsLoading(true);
        setAccountsLoading(true);
        try {
            const [clientsSnap, accountsSnap, empSnap, deptSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'clients'), where('isActive', '==', true))),
                getDocs(query(collection(firestore, 'chartOfAccounts'), orderBy('code'))),
                getDocs(query(collection(firestore, 'employees'))),
                getDocs(query(collection(firestore, 'departments')))
            ]);

            const fetchedClients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)).filter(c => c && c.nameAr);
            fetchedClients.sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));
            setClients(fetchedClients);
            
            setAccounts(accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
            setEmployees(empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
            setDepartments(deptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));

        } catch (error) {
            console.error("Error fetching initial data:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات الأساسية.' });
        } finally {
            setClientsLoading(false);
            setAccountsLoading(false);
        }
    };
    fetchInitialData();
  }, [firestore, toast]);
  
  // Effect to set default receiving account based on payment method
  useEffect(() => {
    if (accounts.length > 0 && paymentMethod) {
      if (paymentMethod === 'Cash') {
        const cashAccount = accounts.find(acc => acc.isPayable && acc.type === 'asset' && acc.name.includes('صندوق'));
        setDebitAccountId(cashAccount?.id || ''); // Set to first cash account or clear
      } else { // Cheque, Bank Transfer, K-Net
        const bankAccount = accounts.find(acc => acc.isPayable && acc.type === 'asset' && acc.name.includes('بنك'));
        setDebitAccountId(bankAccount?.id || ''); // Set to first bank account or clear
      }
    } else if (!paymentMethod) {
        setDebitAccountId(''); // Clear if no payment method
    }
  }, [accounts, paymentMethod]);


  // Effect to fetch client's projects (transactions) when a client is selected
  useEffect(() => {
    if (!firestore || !selectedClientId) {
        setClientProjects([]);
        setSelectedProjectId('');
        return;
    }
    
    const fetchClientProjects = async () => {
        setProjectsLoading(true);
        try {
            const projectsQuery = query(collection(firestore, `clients/${selectedClientId}/transactions`));
            const snapshot = await getDocs(projectsQuery);
            // Only show projects that have a contract
            const fetchedProjects = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as ClientTransaction))
                .filter(tx => !!tx.contract);

            setClientProjects(fetchedProjects);
        } catch (error) {
            console.error("Error fetching client projects:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب معاملات العميل.' });
        } finally {
            setProjectsLoading(false);
        }
    };

    fetchClientProjects();
  }, [firestore, selectedClientId, toast]);
  
  // Effect for automatic description generation
  useEffect(() => {
    const generateDescription = async () => {
        if (!selectedProjectId || !amount || parseFloat(amount) <= 0 || !firestore) {
            setDescription('');
            return;
        }

        const project = clientProjects.find(p => p.id === selectedProjectId);
        if (!project || !project.contract?.clauses) {
            setDescription(''); // Reset description if no contract or clauses
            return;
        }

        // 1. Fetch all existing payments for this project
        let totalAlreadyPaid = 0;
        try {
            totalAlreadyPaid = await getTotalPaidForProject(selectedProjectId, firestore);
        } catch (e) {
            console.error("Could not fetch previous payments for description generation:", e);
        }

        let remainingAmountFromCurrentPayment = parseFloat(amount);
        const descriptionParts: string[] = [];
        let allocatedPaid = 0;

        // Iterate over a copy of clauses to avoid state issues
        for (const clause of [...project.contract.clauses]) {
            if (remainingAmountFromCurrentPayment <= 0) break;
            
            const clauseAmount = clause.amount;
            const paidOnThisClausePreviously = Math.max(0, Math.min(clauseAmount, totalAlreadyPaid - allocatedPaid));
            const remainingOnClause = clauseAmount - paidOnThisClausePreviously;

            if (remainingOnClause > 0) {
                const paymentForThisClause = Math.min(remainingAmountFromCurrentPayment, remainingOnClause);
                
                if (paymentForThisClause >= remainingOnClause) {
                    descriptionParts.push(`سداد كامل للدفعة "${clause.name}" بقيمة ${formatCurrency(remainingOnClause)}`);
                } else {
                    descriptionParts.push(`سداد جزئي من الدفعة "${clause.name}" بقيمة ${formatCurrency(paymentForThisClause)}`);
                    const newRemaining = remainingOnClause - paymentForThisClause;
                    descriptionParts.push(`(المتبقي من هذه الدفعة: ${formatCurrency(newRemaining)})`);
                }
                remainingAmountFromCurrentPayment -= paymentForThisClause;
            }
            allocatedPaid += clauseAmount;
        }

        if (remainingAmountFromCurrentPayment > 0) {
            descriptionParts.push(`مبلغ إضافي قدره ${formatCurrency(remainingAmountFromCurrentPayment)} كدفعة مقدمة على الحساب.`);
        }
        
        setDescription(descriptionParts.join('\n'));
    };

    generateDescription();
  }, [amount, selectedProjectId, clientProjects, firestore]);


  const clientOptions = useMemo(() => clients.map(c => ({
      value: c.id,
      label: c.nameAr,
      searchKey: c.mobile,
  })), [clients]);

  const projectOptions = useMemo(() => clientProjects.map(p => {
    const date = toFirestoreDate(p.createdAt);
    const dateString = date ? format(date, 'dd/MM/yyyy') : '';
    return {
        value: p.id!,
        label: dateString ? `${p.transactionType} (${dateString})` : p.transactionType,
    }
  }), [clientProjects]);
  
  const debitAccountOptions = useMemo(() => {
    if (!paymentMethod) return [];
    
    if (paymentMethod === 'Cash') {
        return accounts
            .filter(acc => acc.type === 'asset' && acc.isPayable && acc.name.includes('صندوق'))
            .map(acc => ({ value: acc.id!, label: `${acc.name} (${acc.code})`, searchKey: acc.code }));
    } else { // Cheque, Bank Transfer, K-Net
        return accounts
            .filter(acc => acc.type === 'asset' && acc.isPayable && acc.name.includes('بنك'))
            .map(acc => ({ value: acc.id!, label: `${acc.name} (${acc.code})`, searchKey: acc.code }));
    }
  }, [accounts, paymentMethod]);


  const handleSave = async () => {
    if (!firestore || !currentUser) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'Firebase غير متاح أو المستخدم غير مسجل.' });
        return;
    }
    
    if (!selectedClientId || !amount || !date || !paymentMethod || !debitAccountId) {
        toast({
            variant: 'destructive',
            title: 'حقول ناقصة',
            description: 'الرجاء تعبئة جميع الحقول الإلزامية (*).',
        });
        return;
    }

    if (isGeneratingVoucher) {
        toast({ variant: 'destructive', title: 'الرجاء الانتظار', description: 'جاري توليد رقم السند.' });
        return;
    }

    setIsSaving(true);
    let newReceiptId = '';
    let newVoucherNumberForCommission = '';
    
    // --- PRE-TRANSACTION READS AND LOGIC ---
    let isFirstReceiptForProject = false;
    let transactionDataForCheck: ClientTransaction | null = null;
    let transactionRefForUpdate: any = null;
    let workStages: WorkStage[] = [];

    try {
        if (selectedProjectId) {
            const receiptsForProjectQuery = query(collection(firestore, 'cashReceipts'), where('projectId', '==', selectedProjectId), limit(1));
            transactionRefForUpdate = doc(firestore, 'clients', selectedClientId, 'transactions', selectedProjectId);
            
            const [receiptsSnap, txSnap] = await Promise.all([
                getDocs(receiptsForProjectQuery),
                getDoc(transactionRefForUpdate)
            ]);
            
            isFirstReceiptForProject = receiptsSnap.empty;
            if (txSnap.exists()) {
                transactionDataForCheck = { id: txSnap.id, ...txSnap.data() } as ClientTransaction;
                if (transactionDataForCheck?.departmentId) {
                    const stagesQuery = query(collection(firestore, `departments/${transactionDataForCheck.departmentId}/workStages`), orderBy('order', 'asc'));
                    const stagesSnap = await getDocs(stagesQuery);
                    workStages = stagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as WorkStage));
                }
            }
        }
    } catch(err) {
        console.error("Pre-transaction read failed:", err);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في التحقق من بيانات المشروع. يرجى المحاولة مرة أخرى.' });
        setIsSaving(false);
        return;
    }
    // --- END OF PRE-TRANSACTION READS ---
    
    try {
        await runTransaction(firestore, async (transaction_fs) => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'cashReceipts');
            
            // This is the only read inside the transaction, required for atomicity.
            const counterDoc = await transaction_fs.get(counterRef);
            
            // --- ALL LOGIC & WRITES LAST ---
            const selectedClient = clients.find(c => c.id === selectedClientId);
            if (!selectedClient) throw new Error("لم يتم العثور على العميل المختار.");
            
            const clientAccount = accounts.find(acc => acc.name === selectedClient.nameAr);
            if (!clientAccount) throw new Error(`لم يتم العثور على حساب محاسبي للعميل: ${selectedClient.nameAr}. تأكد من إنشاء عقد له أولاً.`);
            
            const debitAccount = accounts.find(acc => acc.id === debitAccountId);
            if (!debitAccount) throw new Error('حساب الاستلام المختار غير صالح.');
            
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            
            const newVoucherNumber = `CRV-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
            newVoucherNumberForCommission = newVoucherNumber;
            const newReceiptRef = doc(collection(firestore, 'cashReceipts'));
            newReceiptId = newReceiptRef.id;

            const selectedProject = clientProjects.find(p => p.id === selectedProjectId);
            
            let autoTags = {};
            if (selectedProjectId && selectedProject && selectedProject.assignedEngineerId) {
                const engineer = employees.find(e => e.id === selectedProject.assignedEngineerId);
                const department = departments.find(d => d.name === engineer?.department);
                
                autoTags = {
                    clientId: selectedClientId,
                    transactionId: selectedProjectId,
                    auto_profit_center: selectedProjectId,
                    auto_resource_id: selectedProject.assignedEngineerId,
                    ...(department && { auto_dept_id: department.id }),
                };
            }

            const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));

            const newReceiptData: any = { 
                voucherNumber: newVoucherNumber, voucherSequence: nextNumber, voucherYear: currentYear,
                clientId: selectedClientId, clientNameAr: selectedClient?.nameAr || '', clientNameEn: selectedClient?.nameEn || '',
                amount: parseFloat(amount), amountInWords: amountInWords, receiptDate: date,
                paymentMethod: paymentMethod, description: description, reference: reference, journalEntryId: newJournalEntryRef.id,
                createdAt: serverTimestamp(),
            };
            
            if (selectedProjectId && selectedProject) {
                newReceiptData.projectId = selectedProjectId;
                newReceiptData.projectNameAr = selectedProject.transactionType;
            }

            const journalEntryData = {
                entryNumber: `CRV-JE-${newVoucherNumber}`, date: newReceiptData.receiptDate,
                narration: `[إشعار مالي - دفعة جديدة] ${description}`,
                totalDebit: parseFloat(amount), totalCredit: parseFloat(amount), status: 'posted' as const,
                lines: [
                    { accountId: debitAccount.id!, accountName: debitAccount.name, debit: parseFloat(amount), credit: 0 },
                    { accountId: clientAccount.id!, accountName: clientAccount.name, debit: 0, credit: parseFloat(amount), ...autoTags }
                ],
                clientId: selectedClientId, transactionId: selectedProjectId || null,
                createdAt: serverTimestamp(), createdBy: currentUser.id,
            };

            // Now, perform all writes
            transaction_fs.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            transaction_fs.set(newReceiptRef, cleanFirestoreData(newReceiptData));
            transaction_fs.set(newJournalEntryRef, journalEntryData);

            if (selectedProjectId && isFirstReceiptForProject && transactionDataForCheck && transactionRefForUpdate) {
                const currentStages: TransactionStage[] = [...(transactionDataForCheck.stages || [])];
                let stagesHaveChanged = false;

                // Automatically complete "General Inquiries" stage
                const inquiriesStageIndex = currentStages.findIndex(s => s.name === 'استفسارات عامة');
                if (inquiriesStageIndex !== -1 && currentStages[inquiriesStageIndex].status !== 'completed') {
                    currentStages[inquiriesStageIndex].status = 'completed';
                    (currentStages[inquiriesStageIndex] as any).endDate = new Date();
                    stagesHaveChanged = true;
                }

                // Complete "Contract Signing" stage
                const contractStageIndex = currentStages.findIndex(s => s.name === 'توقيع العقد');
                if (contractStageIndex !== -1 && currentStages[contractStageIndex].status !== 'completed') {
                    currentStages[contractStageIndex].status = 'completed';
                    (currentStages[contractStageIndex] as any).endDate = new Date();
                    stagesHaveChanged = true;

                    const contractWorkStage = workStages.find(ws => ws.name === 'توقيع العقد');
                    if (contractWorkStage?.nextStageIds && contractWorkStage.nextStageIds.length > 0) {
                        for (const nextStageId of contractWorkStage.nextStageIds) {
                            const nextStageInTemplate = workStages.find(ws => ws.id === nextStageId);
                            
                            if (nextStageInTemplate && nextStageInTemplate.stageType !== 'parallel') {
                                const nextStageIndexInProg = currentStages.findIndex(s => s.stageId === nextStageInTemplate.id);
                                if (nextStageIndexInProg > -1) {
                                    if(currentStages[nextStageIndexInProg].status === 'pending') {
                                        currentStages[nextStageIndexInProg].status = 'in-progress';
                                        (currentStages[nextStageIndexInProg] as any).startDate = new Date();
                                    }
                                } else {
                                    currentStages.push({
                                        stageId: nextStageInTemplate.id,
                                        name: nextStageInTemplate.name,
                                        status: 'in-progress',
                                        startDate: new Date() as any,
                                        endDate: null,
                                        allowedRoles: nextStageInTemplate.allowedRoles || []
                                    });
                                }
                            }
                        }
                    }
                }
                
                if (stagesHaveChanged) {
                    transaction_fs.update(transactionRefForUpdate, { stages: currentStages });
                }
            }
        });
        
        toast({ title: 'نجاح', description: 'تم حفظ سند القبض والقيد المحاسبي بنجاح.' });
        
        // --- POST-TRANSACTION WRITES (Batch) ---
        // Commission Journal Entry
        if (selectedProjectId) {
            const selectedProject = clientProjects.find(p => p.id === selectedProjectId);
            if (selectedProject?.assignedEngineerId) {
                const engineer = employees.find(e => e.id === selectedProject.assignedEngineerId);
                if (engineer && engineer.contractPercentage && engineer.contractPercentage > 0) {
                    const commissionAmount = parseFloat(amount) * (engineer.contractPercentage / 100);
                    if (commissionAmount > 0) {
                        const salaryExpenseAccount = accounts.find(a => a.code === '5201'); // مصروف الرواتب والأجور
                        const accruedSalaryAccount = accounts.find(a => a.code === '210201'); // رواتب وأجور مستحقة
                        
                        if(salaryExpenseAccount && accruedSalaryAccount && date) {
                            const commissionBatch = writeBatch(firestore);
                            const jeCounterRef = doc(firestore, 'counters', 'journalEntries');
                            const jeCounterDoc = await getDoc(jeCounterRef);
                            let jeNextNumber = 1;
                            const currentYear = new Date().getFullYear();
                            if (jeCounterDoc.exists()) {
                                 const counts = jeCounterDoc.data()?.counts || {};
                                 jeNextNumber = (counts[currentYear] || 0) + 1;
                            }
                            const commissionJeNumber = `JV-${currentYear}-${String(jeNextNumber).padStart(4, '0')}`;
    
                            const commissionJeRef = doc(collection(firestore, 'journalEntries'));
                            commissionBatch.set(commissionJeRef, {
                                entryNumber: commissionJeNumber,
                                date: Timestamp.fromDate(date),
                                narration: `إثبات عمولة للمهندس ${engineer.fullName} عن سند قبض ${newVoucherNumberForCommission}`,
                                totalDebit: commissionAmount,
                                totalCredit: commissionAmount,
                                status: 'posted',
                                lines: [
                                    { accountId: salaryExpenseAccount.id, accountName: salaryExpenseAccount.name, debit: commissionAmount, credit: 0, auto_resource_id: engineer.id },
                                    { accountId: accruedSalaryAccount.id, accountName: accruedSalaryAccount.name, debit: 0, credit: commissionAmount, auto_resource_id: engineer.id }
                                ],
                                linkedReceiptId: newReceiptId,
                                createdAt: serverTimestamp(),
                                createdBy: 'system-auto-commission',
                            });
                            commissionBatch.set(jeCounterRef, { counts: { [currentYear]: jeNextNumber } }, { merge: true });
                            await commissionBatch.commit();
                            toast({ title: 'إشعار', description: `تم إنشاء قيد عمولة تلقائي للمهندس ${engineer.fullName}.` });
                        }
                    }
                }
            }
        }

        if (selectedProjectId && transactionDataForCheck) {
            const batch = writeBatch(firestore);
            
            // 1. Update contract clauses status
            if (transactionDataForCheck.contract?.clauses) {
                const totalPaid = await getTotalPaidForProject(selectedProjectId, firestore);
                let accumulatedAmount = 0;
                let dueClauseFound = false;
                
                const updatedClauses = transactionDataForCheck.contract.clauses.map((clause: any) => {
                    const newClause = { ...clause };
                    if (totalPaid >= accumulatedAmount + clause.amount) {
                        newClause.status = 'مدفوعة';
                    } else if (totalPaid > accumulatedAmount && !dueClauseFound) {
                        newClause.status = 'مستحقة';
                        dueClauseFound = true;
                    } else {
                        newClause.status = 'غير مستحقة';
                    }
                    accumulatedAmount += clause.amount;
                    return newClause;
                });
                batch.update(transactionRefForUpdate!, { 'contract.clauses': updatedClauses });
            }
            
            // 2. Add Timeline Comment & Log
            const timelineCollectionRef = collection(transactionRefForUpdate!, 'timelineEvents');
            const historyCollectionRef = collection(firestore, `clients/${selectedClientId}/history`);
            
            const commentContent = `**[إشعار مالي - دفعة جديدة]**\n${description}\n\n(سند قبض رقم: ${voucherNumber} بقيمة إجمالية ${formatCurrency(parseFloat(amount))})`;
            const commentData = { type: 'comment' as const, content: commentContent, userId: currentUser.id, userName: currentUser.fullName, userAvatar: currentUser.avatarUrl, createdAt: serverTimestamp() };
            batch.set(doc(timelineCollectionRef), commentData);
            
            const logContent = `سجل ${currentUser.fullName} دفعة بقيمة ${formatCurrency(parseFloat(amount))}.`;
            const logData = { type: 'log' as const, content: logContent, userId: currentUser.id, userName: currentUser.fullName, userAvatar: currentUser.avatarUrl, createdAt: serverTimestamp() };
            batch.set(doc(timelineCollectionRef), logData);

            // 3. Add concise log to Client History
            const historyLogContent = `[${transactionDataForCheck.transactionType}] قام ${currentUser.fullName} بتسجيل دفعة جديدة بقيمة ${formatCurrency(parseFloat(amount))}.`;
            batch.set(doc(historyCollectionRef), { type: 'log' as const, content: historyLogContent, userId: currentUser.id, userName: currentUser.fullName, userAvatar: currentUser.avatarUrl, createdAt: serverTimestamp() });

            await batch.commit();
        }
        
        // --- NOTIFICATION LOGIC ---
        if (selectedProjectId) {
            const selectedProject = clientProjects.find(p => p.id === selectedProjectId);
            if (selectedProject?.assignedEngineerId) {
                const targetUserId = await findUserIdByEmployeeId(firestore, selectedProject.assignedEngineerId);
                if (targetUserId && targetUserId !== currentUser.id) {
                     await createNotification(firestore, {
                        userId: targetUserId,
                        title: `دفعة جديدة لمعاملة`,
                        body: `قام ${currentUser.fullName} بتسجيل دفعة جديدة بقيمة ${formatCurrency(parseFloat(amount))} لمعاملة "${selectedProject.transactionType}" للعميل ${clients.find(c => c.id === selectedClientId)?.nameAr}.`,
                        link: `/dashboard/clients/${selectedClientId}/transactions/${selectedProjectId}`
                    });
                }
            }
        }

        router.push(`/dashboard/accounting/cash-receipts/${newReceiptId}`);

    } catch (error) {
        console.error("Error saving cash receipt:", error);
        toast({
            variant: 'destructive',
            title: 'خطأ في الحفظ',
            description: error instanceof Error ? error.message : 'لم يتم حفظ السند، الرجاء المحاولة مرة أخرى.',
        });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedProjectId('');
    setClientProjects([]);
    setDescription('');
  };

  return (
    <Card className="max-w-4xl mx-auto" dir="rtl">
        <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle>سـنـد قـبـض / Cash Receipt Voucher</CardTitle>
                    <CardDescription>{isGeneratingVoucher ? <Skeleton className="h-4 w-32" /> : voucherNumber} : رقم السند</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="md:col-span-2 grid gap-2">
                <Label htmlFor="receivedFrom">استلمنا من السيد/السادة <span className="text-destructive">*</span></Label>
                <InlineSearchList 
                    value={selectedClientId}
                    onSelect={handleClientChange}
                    options={clientOptions}
                    placeholder={clientsLoading ? 'جاري التحميل...' : 'ابحث عن عميل بالاسم أو الجوال...'}
                    disabled={clientsLoading || isSaving}
                />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="date">التاريخ <span className="text-destructive">*</span></Label>
                    <DateInput value={date} onChange={setDate} disabled={isSaving}/>
                </div>
            </div>
            
            <div className="grid gap-2">
                <Label htmlFor="project">ربط بعقد/مشروع</Label>
                <InlineSearchList 
                    value={selectedProjectId}
                    onSelect={setSelectedProjectId}
                    options={projectOptions}
                    placeholder={!selectedClientId ? 'اختر عميلاً أولاً' : projectsLoading ? 'جاري جلب المشاريع...' : 'اختر المشروع (اختياري)...'}
                    disabled={!selectedClientId || projectsLoading || isSaving}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="grid gap-2">
                    <Label htmlFor="amount">المبلغ <span className="text-destructive">*</span></Label>
                    <Input id="amount" type="number" step="0.001" placeholder="0.000" className='text-left dir-ltr' value={amount} onChange={e => setAmount(e.target.value)} disabled={isSaving}/>
                </div>
                <div className="md:col-span-2 grid gap-2">
                <Label htmlFor="amountInWords">مبلغ وقدره (كتابة)</Label>
                <div className='p-2 text-sm text-muted-foreground border rounded-md min-h-[40px] bg-muted/50'>
                    {amountInWords || '(سيتم ملؤه تلقائياً)'}
                </div>
                </div>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="description">وذلك عن</Label>
                <Textarea id="description" placeholder="وصف عملية الدفع (سيتم توليده تلقائياً عند اختيار مشروع)..." value={description} onChange={e => setDescription(e.target.value)} disabled={isSaving}/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="grid gap-2">
                    <Label htmlFor="paymentMethod">طريقة الدفع <span className="text-destructive">*</span></Label>
                    <Select dir='rtl' value={paymentMethod} onValueChange={setPaymentMethod} disabled={isSaving}>
                        <SelectTrigger id="paymentMethod">
                            <SelectValue placeholder="اختر طريقة الدفع" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Cash">نقداً</SelectItem>
                            <SelectItem value="Cheque">شيك</SelectItem>
                            <SelectItem value="Bank Transfer">تحويل بنكي</SelectItem>
                            <SelectItem value="K-Net">كي-نت</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="debitAccountId">حساب الاستلام <span className="text-destructive">*</span></Label>
                    <InlineSearchList 
                        value={debitAccountId}
                        onSelect={setDebitAccountId}
                        options={debitAccountOptions}
                        placeholder={accountsLoading ? 'تحميل...' : !paymentMethod ? 'اختر طريقة الدفع أولاً' : 'اختر حساب...'}
                        disabled={accountsLoading || isSaving || !paymentMethod}
                    />
                </div>
                <div className="grid gap-2">
                <Label htmlFor="reference">رقم الشيك/المرجع</Label>
                <Input id="reference" placeholder="رقم المرجع..." value={reference} onChange={e => setReference(e.target.value)} disabled={isSaving}/>
                </div>
            </div>
        </CardContent>
      <CardFooter className="flex justify-end gap-2 no-print">
        <Button type="button" variant="outline" onClick={() => router.push('/dashboard/accounting')} disabled={isSaving}>
            <X className="ml-2 h-4 w-4" />
            إلغاء
        </Button>
        <Button onClick={handleSave} disabled={isSaving || isGeneratingVoucher}>
            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
            {isSaving ? 'جاري الحفظ...' : 'حفظ وإنشاء السند'}
        </Button>
      </CardFooter>
    </Card>
  );
}
