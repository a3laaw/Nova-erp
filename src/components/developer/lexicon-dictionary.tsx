'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    Languages, 
    Save, 
    Loader2, 
    Search, 
    PlusCircle, 
    Trash2, 
    DownloadCloud,
    BookOpen,
    AlertCircle,
    MousePointer2,
    FileText,
    Pencil,
    RefreshCw,
    RotateCcw
} from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { cn, cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const NAMESPACES = [
    { id: 'actions', name: 'عناصر الأفعال (Buttons)', color: 'bg-blue-100 text-blue-700', icon: MousePointer2 },
    { id: 'fields', name: 'مسميات الحقول (Labels)', color: 'bg-purple-100 text-purple-700', icon: FileText },
    { id: 'alerts', name: 'التنبيهات (System Messages)', color: 'bg-red-100 text-red-700', icon: AlertCircle },
    { id: 'ui_prose', name: 'النصوص الثابتة (Static UI)', color: 'bg-orange-100 text-orange-700', icon: Languages },
];

export function LexiconDictionary() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [activeNamespace, setActiveNamespace] = useState('all');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);

    const [formData, setFormData] = useState({
        key: '',
        namespace: 'actions',
        valueAr: '',
        valueEn: '',
        description: '',
        module: 'General'
    });

    const tenantId = user?.currentCompanyId;
    
    const { data: lexicon, loading } = useSubscription<any>(
        firestore, 
        tenantId ? `companies/${tenantId}/system_lexicon` : null, 
        [orderBy('namespace'), orderBy('key')]
    );

    const filteredLexicon = useMemo(() => {
        let results = lexicon || [];
        if (activeNamespace !== 'all') {
            results = results.filter(item => item.namespace === activeNamespace);
        }
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            results = results.filter(item => 
                item.key.toLowerCase().includes(lower) || 
                item.valueAr.includes(searchQuery) ||
                item.valueEn.toLowerCase().includes(lower)
            );
        }
        return results;
    }, [lexicon, activeNamespace, searchQuery]);

    const handleSaveEntry = async () => {
        if (!firestore || !tenantId || !formData.key || !formData.valueAr) return;
        setIsSaving(true);
        try {
            const lexiconPath = `companies/${tenantId}/system_lexicon`;
            const payload = cleanFirestoreData({
                ...formData,
                updatedAt: serverTimestamp(),
                companyId: tenantId
            });

            if (editingItem) {
                await updateDoc(doc(firestore, lexiconPath, editingItem.id), payload);
                toast({ title: '✅ تم تحديث المصطلح' });
            } else {
                await addDoc(collection(firestore, lexiconPath), { ...payload, createdAt: serverTimestamp() });
                toast({ title: '✅ تم إضافة المصطلح' });
            }
            setIsFormOpen(false);
            setEditingItem(null);
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        } finally { setIsSaving(true); }
    };

    /**
     * محرك تحديث المنظومة (Publish & Refresh):
     * يقوم بتحديث الطابع الزمني للإعدادات لإجبار كافة واجهات الموظفين على المزامنة.
     */
    const handleUpdateSystem = async () => {
        if (!firestore || !tenantId) return;
        setIsUpdating(true);
        try {
            const configPath = `companies/${tenantId}/settings/system_config`;
            await updateDoc(doc(firestore, configPath), {
                lastLexiconUpdate: serverTimestamp(),
                updatedBy: user?.id
            });
            toast({ title: '✅ تم تحديث المنظومة', description: 'تم نشر كافة التعديلات اللغوية لكافة الموظفين فوراً.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في التحديث' });
        } finally { setIsUpdating(false); }
    };

    const handleImportDefaults = async () => {
        if (!firestore || !tenantId) return;
        setIsImporting(true);
        try {
            const batch = writeBatch(firestore);
            const lexiconPath = `companies/${tenantId}/system_lexicon`;
            
            const defaults = [
                { key: 'btn_save', namespace: 'actions', valueAr: 'حفظ التعديلات', valueEn: 'Save Changes' },
                { key: 'btn_cancel', namespace: 'actions', valueAr: 'إلغاء', valueEn: 'Cancel' },
                { key: 'btn_add', namespace: 'actions', valueAr: 'إضافة جديد', valueEn: 'Add New' },
                { key: 'btn_edit', namespace: 'actions', valueAr: 'تعديل', valueEn: 'Edit' },
                { key: 'btn_delete', namespace: 'actions', valueAr: 'حذف نهائي', valueEn: 'Delete' },
                { key: 'btn_print', namespace: 'actions', valueAr: 'طباعة المستند', valueEn: 'Print' },
                { key: 'btn_back', namespace: 'actions', valueAr: 'عودة', valueEn: 'Back' },
                { key: 'lbl_name', namespace: 'fields', valueAr: 'الاسم الكامل', valueEn: 'Full Name' },
                { key: 'lbl_phone', namespace: 'fields', valueAr: 'رقم الهاتف', valueEn: 'Phone Number' },
                { key: 'lbl_date', namespace: 'fields', valueAr: 'التاريخ', valueEn: 'Date' },
                { key: 'lbl_amount', namespace: 'fields', valueAr: 'المبلغ', valueEn: 'Amount' },
                { key: 'lbl_status', namespace: 'fields', valueAr: 'الحالة', valueEn: 'Status' },
                { key: 'msg_save_success', namespace: 'alerts', valueAr: 'تم حفظ المستند بنجاح', valueEn: 'Document saved successfully' },
                { key: 'ui_loading', namespace: 'ui_prose', valueAr: 'جاري تهيئة النظام...', valueEn: 'Initializing System...' },
                { key: 'ui_search_placeholder', namespace: 'ui_prose', valueAr: 'ابحث عن أي شيء هنا...', valueEn: 'Search anything...' },
            ];

            const existingKeys = new Set((lexicon || []).map((item: any) => item.key));
            let addedCount = 0;

            for (const item of defaults) {
                if (!existingKeys.has(item.key)) {
                    const newRef = doc(collection(firestore, lexiconPath));
                    batch.set(newRef, { ...item, companyId: tenantId, createdAt: serverTimestamp() });
                    addedCount++;
                }
            }

            if (addedCount > 0) {
                await batch.commit();
                toast({ title: '✅ تم استيراد الأساسيات', description: `تمت إضافة ${addedCount} مصطلحاً جديداً للقاموس.` });
            } else {
                toast({ title: 'القاموس مكتمل', description: 'كافة المصطلحات الأساسية موجودة بالفعل.' });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'فشل الاستيراد' });
        } finally { setIsImporting(false); }
    };

    return (
        <div className="space-y-8">
            <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl border border-white/40">
                <CardHeader className="bg-indigo-600/5 p-10 border-b">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-indigo-600 rounded-3xl shadow-xl border-4 border-white text-white">
                                <BookOpen className="h-8 w-8" />
                            </div>
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-[#1e1b4b]">قاموس المصطلحات (Lexicon)</CardTitle>
                                <CardDescription className="text-slate-500 font-bold">المصدر الوحيد للحقيقة لكافة النصوص والرسائل الظاهرة في النظام.</CardDescription>
                            </div>
                        </div>
                        <div className="flex gap-4 no-print">
                            {/* زر تحديث المنظومة - لؤلؤي */}
                            <Button 
                                variant="ghost" 
                                onClick={handleUpdateSystem} 
                                disabled={isUpdating || loading} 
                                className="h-12 px-6 rounded-2xl font-black gap-2 text-indigo-600 hover:bg-indigo-50 border-none transition-all"
                            >
                                {isUpdating ? <Loader2 className="animate-spin h-4 w-4"/> : <RotateCcw className="h-4 w-4" />} تحديث المنظومة
                            </Button>

                            {/* زر الاستيراد - مخطط */}
                            <Button 
                                variant="outline" 
                                onClick={handleImportDefaults} 
                                disabled={isImporting || loading} 
                                className="h-12 px-10 rounded-2xl font-black gap-2 border-2 border-dashed border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-all shadow-sm"
                            >
                                {isImporting ? <Loader2 className="animate-spin h-4 w-4"/> : <DownloadCloud className="h-4 w-4" />} استيراد الأساسيات
                            </Button>
                            
                            {/* زر الإضافة - برتقالي بارز */}
                            <Button 
                                onClick={() => { 
                                    setEditingItem(null); 
                                    setFormData({ key: '', namespace: 'actions', valueAr: '', valueEn: '', description: '', module: 'General' }); 
                                    setIsFormOpen(true); 
                                }} 
                                className="h-12 px-10 rounded-2xl font-black gap-2 shadow-2xl bg-[#FF7A00] hover:bg-[#E66D00] text-white border-none transition-all active:scale-95 group"
                            >
                                <PlusCircle className="h-6 w-6 group-hover:rotate-90 transition-transform" /> إضافة مصطلح
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-10 space-y-8">
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-6 no-print">
                        <Tabs value={activeNamespace} onValueChange={setActiveNamespace} className="w-full lg:w-auto">
                            <TabsList className="bg-slate-100/50 p-1.5 rounded-2xl h-14 border shadow-inner">
                                <TabsTrigger value="all" className="rounded-xl px-8 font-black text-xs h-full">الكل</TabsTrigger>
                                {NAMESPACES.map(ns => (
                                    <TabsTrigger key={ns.id} value={ns.id} className="rounded-xl px-6 font-black text-xs h-full gap-2">
                                        <ns.icon className="h-3 w-3" /> {ns.name.split(' (')[0]}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                        
                        <div className="relative w-full lg:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="ابحث بالكود أو النص..." 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)} 
                                className="pl-10 h-12 rounded-2xl border-2 font-bold shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="border-2 rounded-[2.5rem] overflow-hidden shadow-sm bg-white">
                        <Table>
                            <TableHeader className="bg-slate-50 border-b">
                                <TableRow className="h-14">
                                    <TableHead className="px-8 font-black text-slate-900 border-l w-[300px]">(KEY) المعرف البرمجي</TableHead>
                                    <TableHead className="font-black text-slate-900 border-l text-right">النص العربي</TableHead>
                                    <TableHead className="font-black text-slate-900 border-l text-left px-8">ENGLISH VALUE</TableHead>
                                    <TableHead className="font-black text-slate-900 text-center w-48">التصنيف</TableHead>
                                    <TableHead className="w-20"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}><TableCell colSpan={5} className="p-8"><Skeleton className="h-10 w-full rounded-2xl" /></TableCell></TableRow>
                                    ))
                                ) : filteredLexicon.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-64 text-center opacity-20 italic font-black text-xl">لا توجد سجلات مطابقة.</TableCell></TableRow>
                                ) : (
                                    filteredLexicon.map(item => (
                                        <TableRow key={item.id} className="h-16 hover:bg-indigo-50/20 border-b last:border-0 transition-colors group">
                                            <TableCell className="px-8 border-l bg-slate-50/30">
                                                <code className="text-[11px] font-black text-indigo-700 bg-white px-3 py-1 rounded-lg border shadow-sm">{item.key}</code>
                                            </TableCell>
                                            <TableCell className="font-black text-black text-base text-right">{item.valueAr}</TableCell>
                                            <TableCell className="font-bold text-slate-600 font-mono text-left text-sm border-l px-8">{item.valueEn}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className={cn("px-4 py-1 rounded-full font-black text-[9px] uppercase tracking-widest border-2", NAMESPACES.find(n => n.id === item.namespace)?.color)}>
                                                    {NAMESPACES.find(n => n.id === item.namespace)?.name.split(' (')[0]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center pr-4">
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditingItem(item); setFormData(item); setIsFormOpen(true); }}>
                                                    <Pencil className="h-4 w-4 text-primary" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/10 p-6 flex justify-center border-t border-indigo-50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Nova ERP — Comprehensive Lexicon Engine v1.0</p>
                </CardFooter>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent dir="rtl" className="max-w-lg rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
                    <DialogHeader className="p-8 bg-indigo-600 text-white text-right shrink-0">
                        <DialogTitle className="text-2xl font-black">{editingItem ? 'تعديل مصطلح' : 'إضافة مصطلح جديد'}</DialogTitle>
                        <DialogDescription className="text-indigo-100 font-bold mt-1">تعديل النصوص يؤثر فوراً على كافة واجهات المستخدم.</DialogDescription>
                    </DialogHeader>
                    <div className="p-8 space-y-6">
                        <div className="grid gap-2">
                            <Label className="font-black text-slate-400 text-[10px] uppercase tracking-widest pr-1">المعرف البرمجي (Unique Key) *</Label>
                            <Input value={formData.key} onChange={e => setFormData({...formData, key: e.target.value.toLowerCase().replace(/\s/g, '_')})} disabled={!!editingItem} placeholder="e.g. btn_confirm_save" className="h-12 rounded-xl font-mono border-2" />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="grid gap-2">
                                <Label className="font-black text-slate-700 pr-1">التصنيف</Label>
                                <Select value={formData.namespace} onValueChange={v => setFormData({...formData, namespace: v as any})}>
                                    <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue /></SelectTrigger>
                                    <SelectContent dir="rtl">
                                        {NAMESPACES.map(ns => <SelectItem key={ns.id} value={ns.id}>{ns.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label className="font-black text-slate-700 pr-1">الموديول</Label>
                                <Select value={formData.module} onValueChange={v => setFormData({...formData, module: v as any})}>
                                    <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue /></SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="General">عام (General)</SelectItem>
                                        <SelectItem value="Accounting">المالية</SelectItem>
                                        <SelectItem value="Construction">المقاولات</SelectItem>
                                        <SelectItem value="HR">الموارد البشرية</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label className="font-black text-slate-700 pr-1">القيمة بالعربية *</Label>
                                <Input value={formData.valueAr} onChange={e => setFormData({...formData, valueAr: e.target.value})} className="h-12 rounded-xl border-2 font-black text-lg" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="font-black text-slate-700 pr-1">English Value</Label>
                                <Input value={formData.valueEn} onChange={e => setFormData({...formData, valueEn: e.target.value})} dir="ltr" className="h-12 rounded-xl border-2 font-bold" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-8 bg-slate-50 border-t flex gap-3">
                        <Button variant="ghost" onClick={() => setIsFormOpen(false)} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                        <Button onClick={handleSaveEntry} disabled={isSaving || !formData.key || !formData.valueAr} className="flex-1 h-12 rounded-xl font-black text-lg shadow-xl shadow-indigo-100">
                            {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />} اعتماد المصطلح
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
