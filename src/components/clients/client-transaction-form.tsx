'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, serverTimestamp, doc, getDoc, orderBy, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Client, TransactionType, WorkStage, SubService } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { getTenantPath } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Layers, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from "@/components/ui/dialog"

const SafeSelect = ({ value, onSelect, options, placeholder, disabled }: any) => (
    <select
        value={value}
        onChange={(e) => onSelect(e.target.value)}
        disabled={disabled}
        className="w-full h-11 border border-gray-300 bg-white px-3 py-2 text-sm rounded-xl focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
    >
        <option value="">{placeholder}</option>
        {options.map((option: any) => (
            <option key={option.value} value={option.value}>
                {option.label}
            </option>
        ))}
    </select>
);

interface ClientTransactionFormProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    clientName: string;
}

export function ClientTransactionForm({ isOpen, onClose, clientId, clientName }: ClientTransactionFormProps) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [engineersLoading, setEngineersLoading] = useState(false);
    const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
    const [typesLoading, setTypesLoading] = useState(false);
    
    const [selectedTypeId, setSelectedTypeId] = useState('');
    const [selectedSubServiceId, setSelectedSubServiceId] = useState('');
    const [subServices, setSubServices] = useState<SubService[]>([]);
    const [subServicesLoading, setSubServicesLoading] = useState(false);

    const [description, setDescription] = useState('');
    const [assignedEngineerId, setAssignedEngineerId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const tenantId = currentUser?.currentCompanyId;

    const transactionTypeName = useMemo(() => 
        transactionTypes.find(t => t.id === selectedTypeId)?.name || ''
    , [selectedTypeId, transactionTypes]);

    useEffect(() => {
        if (!firestore || !tenantId) return;

        let isMounted = true;

        const fetchInitialData = async () => {
            setTypesLoading(true);
            setEngineersLoading(true);
            setError(null);
            try {
                const empPath = getTenantPath('employees', tenantId);
                const typesPath = getTenantPath('transactionTypes', tenantId);

                const [engSnap, typesSnap] = await Promise.all([
                    getDocs(query(collection(firestore, empPath!), where('status', '==', 'active'))),
                    getDocs(query(collection(firestore, typesPath!), orderBy('order')))
                ]);

                if (!isMounted) return;

                setEngineers(engSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
                setTransactionTypes(typesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionType)));

            } catch (err: any) {
                console.error("Error fetching initial data:", err);
                if (isMounted) setError('فشل تحميل البيانات الأساسية. لا يمكن إنشاء معاملة.');
            } finally {
                if (isMounted) {
                    setTypesLoading(false);
                    setEngineersLoading(false);
                }
            }
        };

        fetchInitialData();
        return () => { isMounted = false; };

    }, [firestore, tenantId]);

     useEffect(() => {
        if (!selectedTypeId || !firestore || !tenantId) {
            setSubServices([]);
            return;
        }
        let isMounted = true;

        const fetchSubServices = async () => {
            setSubServicesLoading(true);
            try {
                const subsPath = getTenantPath(`transactionTypes/${selectedTypeId}/subServices`, tenantId);
                const snap = await getDocs(query(collection(firestore, subsPath!), orderBy('order')));
                if (isMounted) {
                    setSubServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubService)));
                }
            } catch (err: any) {
                console.error("Error fetching sub-services:", err);
            } finally {
                if (isMounted) setSubServicesLoading(false);
            }
        };

        fetchSubServices();
        return () => { isMounted = false; };
    }, [selectedTypeId, firestore, tenantId]);

    const handleTypeChange = useCallback((typeId: string) => {
        setSelectedTypeId(typeId);
        setSelectedSubServiceId('');
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser || !selectedTypeId || !tenantId || !clientId) return;

        const selectedSub = subServices.find(s => s.id === selectedSubServiceId);
        if (subServices.length > 0 && !selectedSub) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تحديد الخدمة التفصيلية.' });
            return;
        }

        setIsSaving(true);
        try {
            const txsPath = getTenantPath(`transactions`, tenantId);
            const clientRef = doc(firestore, getTenantPath(`clients/${clientId}`, tenantId)!);
            
            await runTransaction(firestore, async (transaction) => {
                const clientDoc = await transaction.get(clientRef);
                if (!clientDoc.exists()) throw new Error("Client does not exist.");

                const clientData = clientDoc.data();

                const newCounter = (clientData.transactionCounter || 0) + 1;
                const transactionNumber = `CL${clientData.fileNumber}-TX${String(newCounter).padStart(2, '0')}`;
                const newTransactionRef = doc(collection(firestore, txsPath!));

                transaction.update(clientRef, { transactionCounter: newCounter });

                // **THE FIX**: Directly creating the object without the problematic cleaner function.
                const transactionData = {
                    transactionNumber, 
                    clientId: clientId, 
                    transactionType: transactionTypeName,
                    subServiceName: selectedSub?.name || null,
                    description, 
                    status: 'new', 
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(), 
                    stages: [],
                    assignedEngineerId: assignedEngineerId || clientData.assignedEngineer || null,
                    companyId: tenantId
                };

                transaction.set(newTransactionRef, transactionData);

                const timelineRef = doc(collection(newTransactionRef, 'timelineEvents'));
                transaction.set(timelineRef, {
                    type: 'log', 
                    content: `تم فتح المسار الفني للمعاملة: "${transactionTypeName}".`,
                    userId: currentUser.id, 
                    userName: currentUser.fullName, 
                    createdAt: serverTimestamp(),
                    companyId: tenantId
                });
            });

            toast({ title: '✅ تم فتح المسار الفني بنجاح' });
            onClose();

        } catch (err: any) {
            console.error(err);
            toast({ variant: 'destructive', title: 'حدث خطأ فادح', description: err.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
       <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>فتح معاملة جديدة للعميل: {clientName}</DialogTitle>
                    <DialogDescription>
                        اختر نوع الخدمة وقدم التفاصيل اللازمة لبدء المسار الفني.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    {error ? (
                        <div className="p-8 text-center text-red-600 font-bold bg-red-50 rounded-xl">{error}</div>
                    ) : (
                        <>
                            <div className="grid gap-2">
                                <Label className="font-black">نوع الخدمة الرئيسية *</Label>
                                <SafeSelect 
                                    value={selectedTypeId} 
                                    onSelect={handleTypeChange} 
                                    options={transactionTypes.map(t => ({ value: t.id!, label: t.name }))} 
                                    placeholder="اختر الخدمة..." 
                                    disabled={typesLoading || isSaving}
                                />
                            </div>
                            {(subServicesLoading || subServices.length > 0) && (
                                <div className="grid gap-2 animate-in slide-in-from-top-2">
                                    <Label className="font-black text-primary flex items-center gap-2"><Layers className="h-4 w-4" /> الخدمة التفصيلية *</Label>
                                    <SafeSelect 
                                        value={selectedSubServiceId} 
                                        onSelect={setSelectedSubServiceId} 
                                        options={subServices.map(s => ({ value: s.id!, label: s.name }))} 
                                        placeholder={subServicesLoading ? 'جاري التحميل...' : 'حدد النوع الفرعي...'}
                                        disabled={subServicesLoading || isSaving}
                                    />
                                </div>
                            )}
                            <div className="grid gap-2">
                                <Label className="font-black">إسناد إلى مهندس</Label>
                                <SafeSelect 
                                    value={assignedEngineerId} 
                                    onSelect={setAssignedEngineerId} 
                                    options={engineers.map(e => ({ value: e.id!, label: e.fullName }))} 
                                    placeholder={engineersLoading ? 'جاري التحميل...' : 'اختياري (تلقائيًا للمهندس المسؤول)'}
                                    disabled={engineersLoading || isSaving} 
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="font-black">ملاحظات إضافية</Label>
                                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="(اختياري) أدخل أي تفاصيل إضافية عن هذه المعاملة..." rows={3} className="rounded-2xl" />
                            </div>
                        </>
                    )}
                     <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving || !selectedTypeId || error} className="font-black px-10 rounded-xl min-w-[120px]">
                            {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : 'حفظ وبدء المسار'}
                        </Button>
                </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
