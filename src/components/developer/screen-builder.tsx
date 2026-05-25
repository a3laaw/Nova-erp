'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    PlusCircle, Trash2, LayoutGrid, Save, Loader2, 
    Layers, Workflow, Network
} from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { cleanFirestoreData } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function ScreenBuilder() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    const [screenNameAr, setScreenNameAr] = useState('');
    const [screenModule, setScreenModule] = useState<'Accounting' | 'Construction' | 'HR'>('Construction');
    const [fields, setFields] = useState<any[]>([]);

    const { data: dynamicScreens, loading } = useSubscription<any>(firestore, 'dynamic_screens', [orderBy('createdAt', 'desc')]);

    const addField = () => {
        setFields([...fields, { 
            id: Math.random().toString(36).substring(7),
            key: '', labelAr: '', type: 'text', isRequired: false, lookupCollection: '' 
        }]);
    };

    const removeField = (id: string) => {
        setFields(fields.filter(f => f.id !== id));
    };

    const handleSaveScreen = async () => {
        if (!firestore || !user?.currentCompanyId || !screenNameAr) return;
        setIsSaving(true);
        try {
            const screenRef = collection(firestore, `companies/${user.currentCompanyId}/dynamic_screens`);
            await addDoc(screenRef, cleanFirestoreData({
                nameAr: screenNameAr,
                module: screenModule,
                fields: fields,
                createdAt: serverTimestamp(),
                companyId: user.currentCompanyId
            }));
            toast({ title: '✅ تم إنشاء الشاشة الديناميكية' });
            setScreenNameAr('');
            setFields([]);
        } finally { setIsSaving(false); }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <Card className="lg:col-span-8 rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl border border-white/40">
                <CardHeader className="bg-primary/5 p-8 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><Workflow className="h-6 w-6" /></div>
                        <div>
                            <CardTitle className="text-xl font-black">محرر هياكل الشاشات (No-Code UI)</CardTitle>
                            <CardDescription>عرّف الحقول واربطها بالبيانات؛ ستظهر الشاشة آلياً في القائمة الجانبية.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-[2rem] border-2 border-dashed">
                        <div className="grid gap-2">
                            <Label className="font-black text-xs text-slate-500 mr-1">اسم الشاشة بالعربية *</Label>
                            <Input value={screenNameAr} onChange={e => setScreenNameAr(e.target.value)} placeholder="مثال: سجل فحص الخرسانة..." className="h-11 rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-black text-xs text-slate-500 mr-1">الموديول التابع له</Label>
                            <Select value={screenModule} onValueChange={(v: any) => setScreenModule(v)}>
                                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="Accounting">الحسابات والمالية</SelectItem>
                                    <SelectItem value="Construction">المقاولات واللوجستيات</SelectItem>
                                    <SelectItem value="HR">الموارد البشرية</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <Label className="font-black text-lg flex items-center gap-2"><Layers className="h-5 w-5 text-primary" /> مصفوفة الحقول والارتباطات</Label>
                            <Button onClick={addField} variant="outline" className="rounded-xl border-dashed border-2 h-9 px-4 text-xs font-bold gap-2">
                                <PlusCircle className="h-4 w-4" /> إضافة حقل +
                            </Button>
                        </div>
                        
                        <div className="border-2 rounded-[2rem] overflow-hidden shadow-inner bg-white">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow className="h-12">
                                        <TableHead className="w-12"></TableHead>
                                        <TableHead className="font-black">اسم الحقل</TableHead>
                                        <TableHead className="font-black">نوع البيانات</TableHead>
                                        <TableHead className="font-black">مصدر البيانات (Lookup)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((field, idx) => (
                                        <TableRow key={field.id} className="h-16 hover:bg-muted/5 border-b last:border-0">
                                            <TableCell className="text-center">
                                                <Button variant="ghost" size="icon" onClick={() => removeField(field.id)} className="text-red-300 hover:text-red-600"><Trash2 className="h-4 w-4"/></Button>
                                            </TableCell>
                                            <TableCell><Input value={field.labelAr} onChange={e => { const n = [...fields]; n[idx].labelAr = e.target.value; setFields(n); }} placeholder="مثال: تاريخ الصب..." className="h-9 rounded-lg border-none shadow-none focus-visible:ring-1" /></TableCell>
                                            <TableCell>
                                                <Select value={field.type} onValueChange={v => { const n = [...fields]; n[idx].type = v; setFields(n); }}>
                                                    <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                                                    <SelectContent dir="rtl">
                                                        <SelectItem value="text">نص (Text)</SelectItem>
                                                        <SelectItem value="number">رقم (Numeric)</SelectItem>
                                                        <SelectItem value="date">تاريخ (Date)</SelectItem>
                                                        <SelectItem value="attachment">مرفق (Secure File)</SelectItem>
                                                        <SelectItem value="relation">ارتباط (Relation)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                {field.type === 'relation' ? (
                                                    <Select value={field.lookupCollection} onValueChange={v => { const n = [...fields]; n[idx].lookupCollection = v; setFields(n); }}>
                                                        <SelectTrigger className="h-8 text-xs border-dashed"><SelectValue placeholder="اختر الجدول..."/></SelectTrigger>
                                                        <SelectContent dir="rtl">
                                                            <SelectItem value="projects">جدول المشاريع</SelectItem>
                                                            <SelectItem value="employees">جدول الموظفين</SelectItem>
                                                            <SelectItem value="clients">جدول العملاء</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                ) : <span className="text-[10px] text-slate-300 italic px-4">لا ينطبق</span>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {fields.length === 0 && <TableRow><TableCell colSpan={4} className="h-32 text-center opacity-20 italic">لم يتم إضافة حقول بعد.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-8 bg-muted/10 border-t flex justify-end">
                    <Button onClick={handleSaveScreen} disabled={isSaving || !screenNameAr} className="h-14 px-16 rounded-2xl font-black text-xl gap-3 shadow-xl">
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />} اعتماد هيكل الشاشة
                    </Button>
                </CardFooter>
            </Card>

            <Card className="lg:col-span-4 rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl border border-white/60 h-fit sticky top-24">
                <CardHeader className="bg-indigo-600 text-white p-8">
                    <CardTitle className="text-xl font-black flex items-center gap-2"><Network className="h-5 w-5" /> قائمة الشاشات الديناميكية</CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-4">
                    {loading ? <div className="space-y-4"><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-20 w-full rounded-2xl" /></div> : dynamicScreens.length === 0 ? <p className="text-center opacity-30 italic py-10">لا توجد شاشات مخصصة.</p> :
                     dynamicScreens.map((screen: any) => (
                        <div key={screen.id} className="p-4 bg-white rounded-2xl border-2 hover:border-primary/30 transition-all flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-xl group-hover:bg-primary/10 transition-colors"><LayoutGrid className="h-4 w-4 text-slate-500 group-hover:text-primary"/></div>
                                <div>
                                    <p className="font-black text-sm">{screen.nameAr}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{screen.module}</p>
                                </div>
                            </div>
                        </div>
                     ))}
                </CardContent>
            </Card>
        </div>
    );
}