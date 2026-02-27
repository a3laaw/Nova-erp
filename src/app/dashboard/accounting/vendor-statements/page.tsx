
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import type { Vendor, JournalEntry, Account } from '@/lib/types';
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
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Search, Truck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function VendorStatementsPage() {
  const { firestore } = useFirebase();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: vendors, loading, error } = useSubscription<Vendor>(firestore, 'vendors', [orderBy('name')]);
  
  const filteredVendors = useMemo(() => {
    if (!searchQuery) return vendors;
    const lower = searchQuery.toLowerCase();
    return vendors.filter(v => 
        v.name.toLowerCase().includes(lower) ||
        v.phone?.includes(lower) ||
        v.contactPerson?.toLowerCase().includes(lower)
    );
  }, [vendors, searchQuery]);

  return (
    <Card dir="rtl">
      <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="text-primary h-6 w-6" />
            <CardTitle>كشوفات حسابات الموردين</CardTitle>
          </div>
          <CardDescription>عرض وطباعة كشف حساب تفصيلي لكل مورد لمتابعة المشتريات والمدفوعات.</CardDescription>
      </CardHeader>
      <CardContent>
         <div className="mb-6">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="ابحث باسم المورد، الشخص المسؤول، أو الهاتف..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>
        </div>
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>اسم المورد</TableHead>
                <TableHead>جهة الاتصال</TableHead>
                <TableHead>رقم الهاتف</TableHead>
                <TableHead className="text-center">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                          <TableCell className="text-center"><Skeleton className="h-8 w-32 mx-auto" /></TableCell>
                      </TableRow>
                  ))
              ) : filteredVendors.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">لا يوجد موردون يطابقون بحثك.</TableCell></TableRow>
              ) : (
                filteredVendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                        <TableCell className="font-bold">{vendor.name}</TableCell>
                        <TableCell>{vendor.contactPerson || '-'}</TableCell>
                        <TableCell dir="ltr" className="text-right">{vendor.phone}</TableCell>
                        <TableCell className="text-center">
                            <Button asChild variant="outline" size="sm" className="gap-2 rounded-lg">
                                <Link href={`/dashboard/purchasing/vendors/${vendor.id}/statement`}>
                                    <FileText className="h-4 w-4" />
                                    عرض كشف الحساب
                                </Link>
                            </Button>
                        </TableCell>
                    </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
