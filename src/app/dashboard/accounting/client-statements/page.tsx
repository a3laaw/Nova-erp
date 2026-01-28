'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
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
import { FileText, Search } from 'lucide-react';
import { collection, query, orderBy, type DocumentData } from 'firebase/firestore';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import type { Client } from '@/lib/types';
import { Input } from '@/components/ui/input';


export default function ClientStatementsPage() {
  const { language } = useLanguage();
  const firestore = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');

  const clientsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'clients'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const [snapshot, loading, error] = useCollection(clientsQuery);
  
  const clients = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
  }, [snapshot]);

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const lowercasedQuery = searchQuery.toLowerCase();
    return clients.filter(client => 
        (client.nameAr && client.nameAr.toLowerCase().includes(lowercasedQuery)) ||
        (client.fileId && client.fileId.includes(lowercasedQuery)) ||
        (client.mobile && client.mobile.includes(lowercasedQuery))
    );
  }, [clients, searchQuery]);
  
  const t = {
    ar: {
      title: 'كشوفات حسابات العملاء',
      description: 'عرض وطباعة كشف حساب تفصيلي لكل عميل.',
      clientName: 'اسم العميل',
      fileNumber: 'رقم الملف',
      mobile: 'رقم الجوال',
      viewStatement: 'عرض كشف الحساب',
      loading: 'جاري تحميل العملاء...',
      error: 'حدث خطأ أثناء جلب البيانات.',
      noClients: 'لا يوجد عملاء لعرضهم حالياً.',
      noResults: 'لا توجد نتائج مطابقة للبحث.',
      searchPlaceholder: 'ابحث بالاسم، رقم الملف، أو الجوال...'
    },
    en: {
      title: 'Client Statements',
      description: 'View and print a detailed statement of account for each client.',
      clientName: 'Client Name',
      fileNumber: 'File Number',
      mobile: 'Mobile',
      viewStatement: 'View Statement',
      loading: 'Loading clients...',
      error: 'An error occurred while fetching data.',
      noClients: 'No clients to display at the moment.',
      noResults: 'No results match your search.',
      searchPlaceholder: 'Search by name, file no., or mobile...'
    }
  }
  const currentText = t[language];

  return (
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
          <div>
            <CardTitle>{currentText.title}</CardTitle>
            <CardDescription>{currentText.description}</CardDescription>
          </div>
      </CardHeader>
      <CardContent>
         <div className="mb-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rtl:right-3 rtl:left-auto" />
                <Input
                    placeholder={currentText.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rtl:pr-10"
                />
            </div>
        </div>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{currentText.clientName}</TableHead>
                <TableHead>{currentText.fileNumber}</TableHead>
                <TableHead>{currentText.mobile}</TableHead>
                <TableHead className="text-center">{currentText.viewStatement}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-8 w-32 mx-auto" /></TableCell>
                  </TableRow>
              ))}
              {error && <TableRow><TableCell colSpan={4} className="text-center text-destructive">{currentText.error}</TableCell></TableRow>}
              {!loading && clients.length > 0 && filteredClients.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center h-24">{currentText.noResults}</TableCell></TableRow>
              )}
              {!loading && clients.length === 0 && (
                 <TableRow><TableCell colSpan={4} className="text-center h-24">{currentText.noClients}</TableCell></TableRow>
              )}
              {filteredClients.map((client) => {
                return (
                    <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.nameAr}</TableCell>
                        <TableCell className="font-mono">{client.fileId}</TableCell>
                        <TableCell>{client.mobile}</TableCell>
                        <TableCell className="text-center">
                            <Button asChild variant="outline" size="sm">
                                <Link href={`/dashboard/clients/${client.id}/statement`}>
                                    <FileText className="ml-2 h-4 w-4" />
                                    {currentText.viewStatement}
                                </Link>
                            </Button>
                        </TableCell>
                    </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
