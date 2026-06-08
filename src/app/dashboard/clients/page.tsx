'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { RegisteredClientsList } from '@/components/clients/registered-clients-list';
import { ProspectiveClientsList } from '@/components/clients/prospective-clients-list';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Users, UserSearch } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader, PageHeaderTitle, PageHeaderDescription } from '@/components/page-header';

function ClientsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('view') === 'potential' ? 'potential' : 'registered';
    const [activeTab, setActiveTab] = useState(initialTab);

    const handleAddNew = () => {
        // This will always navigate to the page for adding a new LEAD.
        router.push('/dashboard/clients/new');
    };

    return (
        <div className="space-y-6" dir="rtl">
            <PageHeader>
                <div className='flex-1'>
                    <PageHeaderTitle>
                        <Users className="h-8 w-8" />
                        <span>إدارة ملفات العملاء (CRM)</span>
                    </PageHeaderTitle>
                    <PageHeaderDescription>
                        مركز التحكم في بيانات العملاء وتتبع زوار المكتب الجدد.
                    </PageHeaderDescription>
                </div>
                <Button onClick={handleAddNew} className="h-12 text-base px-6 rounded-lg">
                    <PlusCircle className="ml-2 h-5 w-5" />
                    إضافة عميل جديد
                </Button>
            </PageHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-lg mx-auto h-12">
                    <TabsTrigger value="registered" className="gap-2 text-base font-semibold">
                        <Users className="h-5 w-5" />
                        الملفات المسجلة
                    </TabsTrigger>
                    <TabsTrigger value="potential" className="gap-2 text-base font-semibold">
                        <UserSearch className="h-5 w-5" />
                        المحتملون
                    </TabsTrigger>
                </TabsList>

                <Card className="mt-6 shadow-lg rounded-2xl">
                    <CardContent className="pt-6">
                        <TabsContent value="registered" className="mt-0">
                            <RegisteredClientsList />
                        </TabsContent>
                        <TabsContent value="potential" className="mt-0">
                            <ProspectiveClientsList />
                        </TabsContent>
                    </CardContent>
                </Card>
            </Tabs>
        </div>
    );
}

export default function ClientsPage() {
    return (
        <Suspense fallback={<div className="p-20 flex justify-center items-center w-full h-full"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>}>
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                 <ClientsContent />
            </div>
        </Suspense>
    );
}
