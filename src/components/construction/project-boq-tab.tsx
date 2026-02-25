'use client';

import * as React from 'react';
import { useFirebase, useSubscription, useDocument } from '@/firebase';
import { doc, writeBatch, serverTimestamp, orderBy } from 'firebase/firestore';
import type { ConstructionProject, Boq, Client } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { 
  ClipboardList, 
  PlusCircle, 
  ExternalLink, 
  Link2, 
  Loader2, 
  AlertCircle,
  Search,
  User,
  Info,
  Building2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ProjectBoqTabProps {
  project: ConstructionProject;
  client?: Client;
}

export function ProjectBoqTab({ project, client }: ProjectBoqTabProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isSelectionDialogOpen, setIsSelectionDialogOpen] = React.useState(false);
  const [isLinking, setIsLinking] = React.useState(false);
  const [searchTerm, setSearchQuery] = React.useState('');

  // 1. Fetch the linked BOQ if it exists
  const boqRef = React.useMemo(() => 
    firestore && project.boqId ? doc(firestore, 'boqs', project.boqId) : null, 
  [firestore, project.boqId]);
  
  const { data: linkedBoq, loading: boqLoading } = useDocument<Boq>(firestore, boqRef?.path || null);

  // 2. Fetch available BOQs from library
  const libraryQuery = React.useMemo(() => [
    orderBy('createdAt', 'desc')
  ], []);
  
  const { data: libraryBoqs, loading: libraryLoading } = useSubscription<Boq>(
    firestore, 
    isSelectionDialogOpen ? 'boqs' : null, 
    libraryQuery
  );

  const availableBoqs = React.useMemo(() => {
    return (libraryBoqs || []).filter(boq => 
      !boq.projectId || boq.projectId === project.id
    );
  }, [libraryBoqs, project.id]);

  const filteredBoqs = React.useMemo(() => {
    if (!searchTerm) return availableBoqs;
    const lower = searchTerm.toLowerCase();
    return availableBoqs.filter(b => 
      b.name.toLowerCase().includes(lower) || 
      b.boqNumber.toLowerCase().includes(lower) ||
      b.clientName?.toLowerCase().includes(lower)
    );
  }, [availableBoqs, searchTerm]);

  const handleLinkBoq = async (boq: Boq) => {
    if (!firestore || !project.id) return;
    setIsLinking(true);
    try {
      const batch = writeBatch(firestore);
      
      const projectDocRef = doc(firestore, 'projects', project.id);
      batch.update(projectDocRef, { boqId: boq.id });

      const boqDocRef = doc(firestore, 'boqs', boq.id!);
      batch.update(boqDocRef, {
        name: `جدول مشروع: ${project.projectName}`,
        clientName: client?.nameAr || boq.clientName,
        projectId: project.id,
        status: 'تعاقدي',
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      toast({ title: 'نجاح الربط', description: 'تم ربط جدول الكميات وتحديث بياناته في المكتبة.' });
      setIsSelectionDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل ربط جدول الكميات.' });
    } finally {
      setIsLinking(false);
    }
  };

  if (boqLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-6">
      {linkedBoq ? (
        <Card className="overflow-hidden border-2 border-primary/10 shadow-lg rounded-2xl">
          <CardHeader className="bg-primary/5 pb-8">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary"/>
                  <CardTitle className="text-xl font-bold">{linkedBoq.name}</CardTitle>
                </div>
                <CardDescription className="font-mono">{linkedBoq.boqNumber}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Dialog open={isSelectionDialogOpen} onOpenChange={setIsSelectionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Link2 className="h-4 w-4"/> تغيير الجدول
                    </Button>
                  </DialogTrigger>
                  <SelectionDialogContent 
                    loading={libraryLoading}
                    boqs={filteredBoqs}
                    onSelect={handleLinkBoq}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchQuery}
                    isLinking={isLinking}
                  />
                </Dialog>
                <Button asChild size="sm" className="gap-2 shadow-md">
                  <Link href={`/dashboard/construction/boq/${linkedBoq.id}`}>
                    <ExternalLink className="h-4 w-4"/> فتح الجدول التفصيلي
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="-mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-card border p-4 rounded-xl shadow-sm space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">إجمالي قيمة الجدول</Label>
                <p className="text-2xl font-black text-primary font-mono">{formatCurrency(linkedBoq.totalValue)}</p>
              </div>
              <div className="bg-card border p-4 rounded-xl shadow-sm space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">عدد البنود</Label>
                <p className="text-2xl font-bold font-mono">{linkedBoq.itemCount}</p>
              </div>
              <div className="bg-card border p-4 rounded-xl shadow-sm space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">حالة الجدول</Label>
                <div><Badge variant="secondary" className="text-sm font-bold">{linkedBoq.status}</Badge></div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-dashed rounded-3xl p-12 text-center bg-muted/10">
          <div className="max-w-md mx-auto space-y-6">
            <div className="p-4 bg-muted rounded-full w-20 h-20 mx-auto flex items-center justify-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black">لا يوجد جدول كميات مرتبط</h3>
              <p className="text-muted-foreground">
                يرجى اختيار جدول كميات من المكتبة لربطه بهذا المشروع للبدء في تتبع التكاليف والإنجاز.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Dialog open={isSelectionDialogOpen} onOpenChange={setIsSelectionDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="h-12 px-8 rounded-xl font-bold gap-2 text-lg">
                    <PlusCircle className="h-5 w-5" />
                    إضافة من المكتبة
                  </Button>
                </DialogTrigger>
                <SelectionDialogContent 
                  loading={libraryLoading}
                  boqs={filteredBoqs}
                  onSelect={handleLinkBoq}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchQuery}
                  isLinking={isLinking}
                />
              </Dialog>
              <Button variant="outline" className="h-12 px-8 rounded-xl font-bold" asChild>
                <Link href={`/dashboard/construction/boq/new?projectId=${project.id}&projectName=${encodeURIComponent(project.projectName)}`}>
                  إنشاء جدول جديد
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function SelectionDialogContent({ 
  loading, 
  boqs, 
  onSelect, 
  searchTerm, 
  setSearchTerm,
  isLinking
}: { 
  loading: boolean, 
  boqs: Boq[], 
  onSelect: (boq: Boq) => void,
  searchTerm: string,
  setSearchTerm: (val: string) => void,
  isLinking: boolean
}) {
  return (
    <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" dir="rtl">
      <DialogHeader>
        <DialogTitle className="text-xl font-black flex items-center gap-2">
          <Search className="h-5 w-5 text-primary"/>
          اختر من مكتبة جداول الكميات
        </DialogTitle>
        <DialogDescription>
          اختر الجدول المناسب لربطه بهذا المشروع. سيتم تحديث اسم الجدول تلقائياً.
        </DialogDescription>
      </DialogHeader>
      
      <div className="py-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            className="pr-10" 
            placeholder="ابحث عن جدول باسم العميل أو رقم الجدول..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 border rounded-xl bg-muted/20">
        <div className="p-4 space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
          ) : boqs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <AlertCircle className="h-8 w-8 mx-auto opacity-20" />
              <p>لا توجد جداول متاحة للربط.</p>
            </div>
          ) : (
            boqs.map((boq) => (
              <button
                key={boq.id}
                onClick={() => onSelect(boq)}
                disabled={isLinking}
                className="w-full group text-right p-4 border-2 border-transparent bg-background rounded-xl hover:border-primary/50 hover:shadow-md transition-all flex justify-between items-center"
              >
                <div className="space-y-1">
                  <p className="font-black text-foreground group-hover:text-primary transition-colors">{boq.name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">{boq.boqNumber}</span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3"/> {boq.clientName || '---'}
                    </span>
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-black text-primary font-mono">{formatCurrency(boq.totalValue)}</p>
                  <p className="text-[10px] text-muted-foreground">{boq.itemCount} بند</p>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>

      <DialogFooter className="pt-4 border-t">
        <p className="text-xs text-muted-foreground italic flex items-center gap-2">
          <Info className="h-3 w-3" />
          سيتم تغيير حالة الجدول إلى "تعاقدي" بمجرد ربطه بالمشروع.
        </p>
      </DialogFooter>
      {isLinking && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center rounded-lg z-50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="font-bold text-lg">جاري ربط البيانات...</p>
          </div>
        </div>
      )}
    </DialogContent>
  );
}
