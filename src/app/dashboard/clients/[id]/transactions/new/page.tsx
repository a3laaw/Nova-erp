'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, serverTimestamp, doc, getDoc, orderBy, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Client, TransactionType, WorkStage, SubService } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Layers, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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

export default function NewTransactionPage() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const clientId = Array.isArray(params.id) ? params.id[0] : params.id;

    const [client, setClient] = useState<Client | null>(null);
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
        if (!firestore || !tenantId || !clientId) return;

        let isMounted = true;

        const fetchInitialData = async () => {
            setTypesLoading(true);
            setEngineersLoading(true);
            setError(null);
            try {
                const clientRefPath = getTenantPath(`clients/${clientId}`, tenantId);
                const empPath = getTenantPath('employees', tenantId);
                const typesPath = getTenantPath('transactionTypes', tenantId);

                const [clientSnap, engSnap, typesSnap] = await Promise.all([
                    getDoc(doc(firestore, clientRefPath!)),
                    getDocs(query(collection(firestore, empPath!), where('status', '==', 'active'))),
                    getDocs(query(collection(firestore, typesPath!), orderBy('order')))
                ]);

                if (!isMounted) return;

                if (clientSnap.exists()) {
                    setClient({ id: clientSnap.id, ...clientSnap.data() } as Client);
                } else {
                    throw new Error('Client not found');
                }
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

    }, [firestore, tenantId, clientId]);

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
        if (!firestore || !currentUser || !selectedTypeId || !tenantId || !client) return;

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

                const existingSnap = await getDocs(query(collection(firestore, txsPath!), where('clientId', '==', clientId), where('transactionType', '==', transactionTypeName)));
                const sameTypeCount = existingSnap.docs.length;

                const finalTypeName = sameTypeCount > 0 
                    ? `${transactionTypeName} - ${String(sameTypeCount + 1).padStart(3, '0')}`
                    : transactionTypeName;

                let initialStages: any[] = [];
                if (selectedSubServiceId) {
                    const stagesPath = getTenantPath(`transactionTypes/${selectedTypeId}/subServices/${selectedSubServiceId}/workStages`, tenantId);
                    const stagesSnap = await getDocs(query(collection(firestore, stagesPath!), orderBy('order')));
                    initialStages = stagesSnap.docs.map(d => {
                        const data = d.data() as WorkStage;
                        return { stageId: d.id, name: data.name, status: 'pending' as const, order: data.order || 0 };
                    });
                }

                const newCounter = (clientData.transactionCounter || 0) + 1;
                const transactionNumber = `CL${clientData.fileNumber}-TX${String(newCounter).padStart(2, '0')}`;
                const newTransactionRef = doc(collection(firestore, txsPath!));

                transaction.update(clientRef, { transactionCounter: newCounter });

                transaction.set(newTransactionRef, cleanFirestoreData({
                    transactionNumber, 
                    clientId, 
                    transactionType: finalTypeName,
                    subServiceName: selectedSub?.name || null,
                    description, 
                    status: 'new', 
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(), 
                    stages: initialStages,
                    assignedEngineerId: assignedEngineerId || clientData.assignedEngineer || null,
                    companyId: tenantId
                }));

                const timelineRef = doc(collection(newTransactionRef, 'timelineEvents'));
                transaction.set(timelineRef, {
                    type: 'log', 
                    content: `تم فتح المسار الفني للمعاملة: "${finalTypeName}".`,
                    userId: currentUser.id, 
                    userName: currentUser.fullName, 
                    createdAt: serverTimestamp(),
                    companyId: tenantId
                });
            });

            toast({ title: '✅ تم فتح المسار الفني بنجاح' });
            router.push(`/dashboard/clients/${clientId}`);
            router.refresh();

        } catch (err: any) {
            console.error(err);
            toast({ variant: 'destructive', title: 'حدث خطأ فادح', description: err.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8" dir="rtl">
            <div className="flex items-center gap-4 mb-8">
                <Button asChild variant="outline" size="icon">
                    <Link href={`/dashboard/clients/${clientId}`}><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <h1 className="text-2xl font-black">فتح معاملة جديدة للعميل: {client?.nameAr || '...'}</h1>
            </div>

            <form onSubmit={handleSubmit}>
                <Card className="rounded-[2rem] shadow-lg border-2">
                    <CardHeader>
                        <CardTitle>تفاصيل المعاملة</CardTitle>
                        <CardDescription>اختر نوع الخدمة وقدم التفاصيل اللازمة لبدء المسار الفني.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
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
                    </CardContent>
                </Card>
                <div className="mt-8 flex justify-end gap-3">
                    <Button type="button" variant="outline" asChild>
                        <Link href={`/dashboard/clients/${clientId}`}>إلغاء</Link>
                    </Button>
                    <Button type="submit" disabled={isSaving || !selectedTypeId || error} className="font-black px-10 rounded-xl min-w-[120px]">
                        {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : 'حفظ وبدء المسار'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
