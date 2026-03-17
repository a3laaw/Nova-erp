'use client';
import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, getDocs, where } from 'firebase/firestore';
import type { Boq, ConstructionProject } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle, Search, MoreHorizontal, Eye, Pencil, Trash2, Loader2, Copy, Building2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import Fuse from 'fuse.js';
import { formatCurrency, cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export function BoqLibrary() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [itemToDelete, setItemToDelete] = useState<Boq | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const boqsQuery = useMemo(() => {
        if (!firestore) return null;
        return [orderBy('createdAt', 'desc')];
    }, [firestore]);

    const { data: boqs, loading: boqsLoading } = useSubscription<Boq>(firestore, 'boqs', boqsQuery || []);
    
    // Fetch all projects to map them by ID for display in the library
    const { data: projects } = useSubscription<ConstructionProject>(firestore, 'projects');
    const projectsMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

    const fuse = useMemo(() => new Fuse(boqs, {
        keys: ['name', 'boqNumber', 'clientName'],
        threshold: 0.3,
        minMatchCharLength: 2,
    }), [boqs]);
    
    const filteredBoqs = useMemo(() => {
        if (!searchQuery) return boqs;
        return fuse.search(searchQuery).map(result => result.item);
    }, [boqs, searchQuery, fuse]);


    const formatDate = (date: any) => toFirestoreDate(date) ? format(toFirestoreDate(date)!, 'dd/MM/yyyy') : '-';
    
    const handleDelete = async () => {
        if (!itemToDelete || !firestore) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'boqs', itemToDelete.id!));
            toast({ title: 'نجاح', description: `تم حذف جدول الكميات: ${itemToDelete.name}` });
        } catch (error) {
            console.error("Error deleting BOQ:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف جدول الكميات.' });
        } finally {
            setIsDeleting(false);
            setItemToDelete(null);
        }
    };
    
    const handleCopy = async (boqToCopy: Boq) => {
        if (!firestore) return;
        toast({ title: 'جاري استنساخ جدول الكميات...' });
        
        try {
            // Get all items for the source BOQ
            const itemsQuery = query(collection(firestore, `boqs/${boqToCopy.id}/items`));
            const itemsSnap = await getDocs(itemsQuery);
            
            const items = itemsSnap.docs.map(d => {
                const data = d.data();
                return { ...data, uid: d.id }; 
            });

            // Create copied data - NOTICE: We explicitly clear projectId and transactionId
            // and reset status to 'تقديري' to ensure the copy is a fresh standalone template.
            const copiedData = {
                name: `${boqToCopy.name} (نسخة)`,
                clientName: boqToCopy.clientName || '',
                status: 'تقديري', // Reset to draft/estimate status
                items: items,
                projectId: null, // Clear project link
                transactionId: null, // Clear transaction link
            };

            sessionStorage.setItem('copiedBoqData', JSON.stringify(copiedData));
            router.push('/dashboard/construction/boq/new');
            
        } catch (error) {
            console.error("Error copying BOQ:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل استنساخ جدول الكميات.' });
        }
    };


    return (
        <>
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="ابحث باسم الـ BOQ, العميل, أو الرقم..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 rtl:pr-10"
                        />
                    </div>
                    <Button asChild>
                        <Link href="/dashboard/construction/boq/new">
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إنشاء جدول كميات جديد
                        </Link>
                    </Button>
                </div>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>اسم/رقم الـ BOQ</TableHead>
                                <TableHead>الارتباط</TableHead>
                                <TableHead>العميل (المحتمل)</TableHead>
                                <TableHead>تاريخ الإنشاء</TableHead>
                                <TableHead>الحالة</TableHead>
                                <TableHead className="text-left">القيمة الإجمالية</TableHead>
                                <TableHead><span className="sr-only">الإجراءات</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {boqsLoading && Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell>
                                </TableRow>
                            ))}
                            {!boqsLoading && filteredBoqs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        لا توجد جداول كميات لعرضها.
                                    </TableCell>
                                </TableRow>
                            )}
                            {!boqsLoading && filteredBoqs.map(boq => {
                                const linkedProject = boq.projectId ? projectsMap.get(boq.projectId) : null;
                                
                                return (
                                 <TableRow key={boq.id}>
                                    <TableCell className="font-medium">
                                        <Link href={`/dashboard/construction/boq/${boq.id}`} className="hover:underline text-primary">
                                            {boq.name}
                                        </Link>
                                        <p className="text-xs text-muted-foreground font-mono">{boq.boqNumber}</p>
                                    </TableCell>
                                    <TableCell>
                                        {linkedProject ? (
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1 w-fit max-w-[150px]">
                                                <Building2 className="h-3 w-3 shrink-0" />
                                                <span className="truncate">{linkedProject.projectName}</span>
                                            </Badge>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">غير مرتبط بمشروع</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{boq.clientName || '-'}</TableCell>
                                    <TableCell>{formatDate(boq.createdAt)}</TableCell>
                                    <TableCell>
                                        <Badge 
                                            variant="outline" 
                                            className={cn(
                                                boq.status === 'تعاقدي' ? 'bg-green-50 text-green-700 border-green-200' : 
                                                boq.status === 'منفذ' ? 'bg-purple-50 text-purple-700 border-purple-200' : ''
                                            )}
                                        >
                                            {boq.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-left font-mono font-semibold">{formatCurrency(boq.totalValue || 0)}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">فتح القائمة</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" dir="rtl">
                                                <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/construction/boq/${boq.id}`}>
                                                        <Eye className="ml-2 h-4 w-4" /> عرض
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/construction/boq/${boq.id}/edit`}>
                                                        <Pencil className="ml-2 h-4 w-4" /> تعديل
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleCopy(boq)}>
                                                    <Copy className="ml-2 h-4 w-4" /> استنساخ (نسخ)
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => setItemToDelete(boq)} className="text-destructive focus:text-destructive">
                                                    <Trash2 className="ml-2 h-4 w-4" /> حذف
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
                <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl glass-effect">
                    <AlertDialogHeader>
                        <div className="p-4 bg-red-100/20 rounded-3xl w-fit mb-4 border border-red-500/30 shadow-inner">
                            <AlertTriangle className="h-10 w-10 text-red-600" />
                        </div>
                        <AlertDialogTitle className="text-2xl font-black text-red-700 tracking-tight">تأكيد الحذف النهائي؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2 text-foreground/80">
                            سيتم حذف جدول الكميات <strong className="text-foreground">"{itemToDelete?.name}"</strong> وكافة بنوده الفنية والقياسات المرتبطة به نهائياً.
                            <br /><br />
                            <span className="text-red-600/70 font-black italic underline decoration-2 underline-offset-4">تنبيه: لا يمكن استعادة هذه البيانات بعد الحذف.</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-10 gap-3">
                        <AlertDialogCancel disabled={isDeleting} className="rounded-2xl font-bold h-12 px-8 border-2">إلغاء</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDelete} 
                            disabled={isDeleting} 
                            className="bg-destructive hover:bg-destructive/90 rounded-2xl font-black h-12 px-12 shadow-xl shadow-red-200 min-w-[180px]"
                        >
                            {isDeleting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'نعم، حذف نهائي'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
