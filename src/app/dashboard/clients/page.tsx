'use client';
import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { collection, doc, updateDoc, serverTimestamp, addDoc, query, orderBy, type DocumentData } from 'firebase/firestore';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';


type ClientStatus = 'new' | 'received' | 'completed' | 'rejected';

interface Client extends DocumentData {
  id: string;
  fullName: string;
  mobile: string;
  civilId: string;
  status: ClientStatus;
}

const statusTranslations: Record<ClientStatus, string> = {
  new: 'جديد',
  received: 'تم استلامها',
  completed: 'تم إنجازها',
  rejected: 'مرفوضة',
};

const statusColors: Record<ClientStatus, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  received: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-lime-100 text-lime-800 border-lime-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

export default function ClientsPage() {
  const { language } = useLanguage();
  const firestore = useFirestore();

  const clientsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'clients'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const [snapshot, loading, error] = useCollection(clientsQuery);
  const clients = useMemo(() => snapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)) || [], [snapshot]);

  const handleStatusChange = async (clientId: string, newStatus: ClientStatus) => {
    if (!firestore) return;
    const clientDoc = doc(firestore, 'clients', clientId);
    try {
      await updateDoc(clientDoc, { status: newStatus });
    } catch (e) {
      console.error("Error updating status: ", e);
      // You can add a toast notification here to inform the user
    }
  };
  
  // This is a temporary function to add sample data.
  const addSampleClient = async () => {
    if (!firestore) return;
    try {
      await addDoc(collection(firestore, 'clients'), {
        fullName: 'نموذج عميل',
        mobile: '0501234567',
        civilId: '784-1234-567890-1',
        status: 'new',
        createdAt: serverTimestamp(),
        isActive: true,
      });
    } catch (error) {
      console.error("Error adding sample client: ", error);
    }
  };

  const t = {
    ar: {
      title: 'إدارة العملاء',
      description: 'عرض وتحديث حالات ملفات العملاء.',
      addClient: 'إضافة عميل',
      fileNumber: 'رقم الملف',
      fullName: 'الاسم الكامل',
      mobile: 'رقم الجوال',
      status: 'الحالة',
      loading: 'جاري تحميل البيانات...',
      error: 'حدث خطأ أثناء جلب البيانات.',
      noClients: 'لا يوجد عملاء لعرضهم حالياً.'
    },
    en: {
      title: 'Client Management',
      description: 'View and update client file statuses.',
      addClient: 'Add Client',
      fileNumber: 'File Number',
      fullName: 'Full Name',
      mobile: 'Mobile',
      status: 'Status',
      loading: 'Loading data...',
      error: 'An error occurred while fetching data.',
      noClients: 'No clients to display at the moment.'
    }
  }
  const currentText = t[language];


  return (
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{currentText.title}</CardTitle>
            <CardDescription>{currentText.description}</CardDescription>
          </div>
          <div className="flex gap-2">
             <Button onClick={addSampleClient} size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                {currentText.addClient} (عينة)
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{currentText.fileNumber}</TableHead>
                <TableHead>{currentText.fullName}</TableHead>
                <TableHead>{currentText.mobile}</TableHead>
                <TableHead>{currentText.status}</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center">{currentText.loading}</TableCell></TableRow>}
              {error && <TableRow><TableCell colSpan={5} className="text-center text-destructive">{currentText.error}</TableCell></TableRow>}
              {!loading && clients.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">{currentText.noClients}</TableCell></TableRow>}
              {clients.map((client, index) => (
                <TableRow key={client.id}>
                  <TableCell className="font-mono">{client.id.substring(0, 8)}</TableCell>
                  <TableCell className="font-medium">{client.fullName}</TableCell>
                  <TableCell>{client.mobile}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={statusColors[client.status]}>
                            {statusTranslations[client.status]}
                        </Badge>
                         <Select
                            value={client.status}
                            onValueChange={(value) => handleStatusChange(client.id, value as ClientStatus)}
                            dir="rtl"
                          >
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(statusTranslations).map(key => (
                                <SelectItem key={key} value={key}>{statusTranslations[key as ClientStatus]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button aria-haspopup="true" size="icon" variant="ghost">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Toggle menu</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
