'use client';

import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy } from 'firebase/firestore';
import type { Vendor } from '@/lib/types';
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

  const { data: vendors, loading } = useSubscription<Vendor>(firestore, 'vendors', [orderBy('name')]);
  
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
    <div className="space-y-6" dir="rtl">
        <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-indigo-50 dark:from-card dark:to-card">
            <CardHeader className="pb-8 px-8 border-b">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600/10 rounded-2xl text-indigo-600 shadow-inner">
                            <Truck className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black">كشوفات حسابات الموردين</CardTitle>
                            <CardDescription className="text-base font-medium">عرض وطباعة كشف حساب تفصيلي لكل مورد لمتابعة المشتريات والمدفوعات.</CardDescription>
                        </div>
                    </div>
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="ابحث باسم المورد، الهاتف..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-11 rounded-xl shadow-inner bg-background border-2"
                        />
                    </div>
                </div>
            </CardHeader>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardContent className="pt-8">
                <div className="border rounded-2xl overflow-hidden shadow-sm">
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
                                    <TableRow key={vendor.id} className="hover:bg-muted/30 transition-colors">
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
    </div>
  );
}