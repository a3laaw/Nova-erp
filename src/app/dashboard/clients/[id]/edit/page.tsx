'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { Save, X } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { doc, getDoc, query, where, getDocs, collection, writeBatch, serverTimestamp, orderBy, limit, updateDoc, deleteField } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import type { Employee, Client } from '@/lib/types';
import { cleanFirestoreData } from '@/lib/utils';
import { ClientForm } from '@/components/clients/client-form';
import { Separator } from '@/components/ui/separator';

export default function EditClientPage() {
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [client, setClient] = useState<Client | null>(null);
    const [isFetching, setIsFetching] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Fetch Client Data
    useEffect(() => {
        if (!id || !firestore) {
            if(!id) router.push('/dashboard/clients');
            return;
        }

        const fetchClient = async () => {
            setIsFetching(true);
            try {
                const clientDoc = doc(firestore, 'clients', id);
                const clientSnap = await getDoc(clientDoc);

                if (clientSnap.exists()) {
                    setClient({ id: clientSnap.id, ...clientSnap.data() } as Client);
                } else {
                    toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم العثور على العميل.' });
                    router.push('/dashboard/clients');
                }
            } catch (error) {
                 toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب بيانات العميل.' });
                 console.error(error);
            } finally {
                setIsFetching(false);
            }
        };
        
        fetchClient();
    }, [id, firestore, router, toast]);

    const handleUpdate = async (updatedData: Partial<Client>) => {
        if (!firestore || !id || !currentUser || !client) return;
        setIsSaving(true);
        
        const changes: string[] = [];
        const updatePayload: Record<string, any> = {};
        
        const fieldMappings: { key: keyof Client; label: string }[] = [
            { key: 'nameAr', label: 'الاسم بالعربية' },
            { key: 'nameEn', label: 'الاسم بالإنجليزية' },
            { key: 'mobile', label: 'رقم الجوال' },
            { key: 'assignedEngineer', label: 'المهندس المسؤول' },
        ];
        
        fieldMappings.forEach(({ key, label }) => {
            if (updatedData[key] !== client[key]) {
                updatePayload[key] = updatedData[key];
                changes.push(`قام بتحديث "${label}" من "${client[key] || '-'}" إلى "${updatedData[key] || '-'}"`);
            }
        });

        if (JSON.stringify(updatedData.address || {}) !== JSON.stringify(client.address || {})) {
            updatePayload.address = updatedData.address;
            changes.push('قام بتحديث العنوان.');
        }

        if (Object.keys(updatePayload).length === 0) {
            toast({ title: 'لا توجد تغييرات', description: 'لم يتم إجراء أي تعديلات للحفظ.' });
            setIsSaving(false);
            return;
        }
        
        try {
            // --- NEW VALIDATION ---
            if (updatePayload.mobile) {
                const mobileQuery = query(collection(firestore, 'clients'), where('mobile', '==', updatePayload.mobile));
                const mobileSnapshot = await getDocs(mobileQuery);
                if (!mobileSnapshot.empty && mobileSnapshot.docs[0].id !== id) {
                    throw new Error('رقم الجوال هذا مسجل لعميل آخر.');
                }
            }
            // --- END VALIDATION ---

            const batch = writeBatch(firestore);
            const clientRef = doc(firestore, 'clients', id);
            batch.update(clientRef, cleanFirestoreData(updatePayload));
            
            const historyCollectionRef = collection(firestore, `clients/${id}/history`);
            changes.forEach(logText => {
                batch.set(doc(historyCollectionRef), {
                    type: 'log', content: logText, userId: currentUser.id, userName: currentUser.fullName, userAvatar: currentUser.avatarUrl, createdAt: serverTimestamp(),
                });
            });

            await batch.commit();

            if (updatePayload.mobile) {
                const appointmentsRef = collection(firestore, 'appointments');
                const q = query(appointmentsRef, where('clientMobile', '==', updatePayload.mobile));
                const appointmentsToUpdateSnap = await getDocs(q);

                if (!appointmentsToUpdateSnap.empty) {
                    const linkBatch = writeBatch(firestore);
                    appointmentsToUpdateSnap.forEach(apptDoc => {
                        const apptRef = doc(firestore, 'appointments', apptDoc.id);
                        linkBatch.update(apptRef, {
                            clientId: id, // the id of the client being edited
                            clientName: deleteField(),
                            clientMobile: deleteField()
                        });
                    });
                    await linkBatch.commit();
                    toast({ title: 'تحديث تلقائي', description: `تم ربط ${appointmentsToUpdateSnap.size} مواعيد محتملة بهذا العميل بعد تعديل رقم الهاتف.` });
                }
            }

            toast({ title: 'نجاح', description: 'تم تحديث بيانات العميل بنجاح.' });
            router.push(`/dashboard/clients/${id}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'لم يتم حفظ التغييرات.';
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: errorMessage });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (isFetching) {
        return (
             <Card className="max-w-2xl mx-auto" dir="rtl">
                <CardHeader>
                     <Skeleton className="h-8 w-48" />
                     <Skeleton className="h-4 w-64 mt-2" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Separator />
                    <Skeleton className="h-4 w-24" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-28" />
                </CardFooter>
            </Card>
        )
    }

    return (
        <Card className="max-w-2xl mx-auto" dir="rtl">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>تعديل بيانات العميل</CardTitle>
                        <CardDescription>قم بتحديث بيانات العميل حسب الحاجة.</CardDescription>
                    </div>
                    <div className="text-right">
                        <Label>رقم الملف</Label>
                        <div className="font-mono text-lg font-semibold h-7">
                            {client?.fileId}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <ClientForm 
                    initialData={client}
                    onSave={handleUpdate}
                    onClose={() => router.back()}
                    isSaving={isSaving}
                />
            </CardContent>
        </Card>
    );
}
