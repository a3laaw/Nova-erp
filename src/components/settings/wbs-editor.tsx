'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useFirebase, useSubscription } from '@/firebase/index.tsx';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { cn, getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { Loader2, Save, Trash2, Workflow, Share2, Timer, Hash, GripVertical } from 'lucide-react';
import type { SubService, TransactionType, WbsItem } from '@/lib/types';
import { MultiSelect } from '../ui/multi-select';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


function SortableWbsItem({ item, index, active, onEdit, onDelete }: { item: WbsItem, index: number, active: boolean, onEdit: () => void, onDelete: () => void}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id! });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const wbsItems = useWbsItems(); // Custom hook to access items

    return (
        <div ref={setNodeRef} style={style}>
            <div 
                className={cn(
                    "group transition-all rounded-lg p-3 cursor-pointer border", 
                    active ? "bg-primary/10 border-primary/40 shadow-md" : "bg-white hover:bg-slate-100/50 border-transparent shadow-sm"
                )}
                onClick={onEdit}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                         <div {...attributes} {...listeners} className="cursor-grab p-1">
                            <GripVertical className="h-5 w-5 text-slate-400" />
                        </div>
                        <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => {e.stopPropagation(); onDelete()}}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {((item.nextStageIds && item.nextStageIds.length > 0) || item.controlType) && (
                    <div className="pt-2 pl-9 text-xs flex items-center justify-start gap-4 text-slate-600">
                        {item.controlType && (
                            <div className="flex items-center gap-2 font-semibold">
                                {item.controlType === 'Numeric' || item.controlType === 'Hybrid' ? <div className="flex items-center gap-1"><Hash className="h-3 w-3 text-gray-400" /><span>{item.controlValue.numeric}</span></div> : null}
                                {item.controlType === 'TimeBased' || item.controlType === 'Hybrid' ? <div className="flex items-center gap-1"><Timer className="h-3 w-3 text-gray-400" /><span>{item.controlValue.time}</span></div> : null}
                            </div>
                        )}
                        {item.nextStageIds && item.nextStageIds.length > 0 && (
                             <div className="flex items-center gap-1.5 text-blue-600 font-semibold">
                                <Share2 className="h-3 w-3" />
                                <span>يفتح: {item.nextStageIds.map(id => wbsItems.find(i=>i.id===id)?.name).join(', ')}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const WbsItemsContext = React.createContext<WbsItem[]>([]);
const useWbsItems = () => React.useContext(WbsItemsContext);

interface WbsEditorProps {
    isOpen: boolean;
    onClose: () => void;
    subService: SubService;
    transactionType: TransactionType;
}

export function WbsEditor({ isOpen, onClose, subService, transactionType }: WbsEditorProps) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const tenantId = currentUser?.currentCompanyId;

    const wbsCollectionPath = useMemo(() => 
        getTenantPath(`transactionTypes/${transactionType.id}/subServices/${subService.id}/wbs`, tenantId),
    [transactionType.id, subService.id, tenantId]);

    const { data: rawWbsItems, loading: loadingWbs } = useSubscription<WbsItem>(firestore, wbsCollectionPath);
    const sortedWbsItems = useMemo(() => rawWbsItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [rawWbsItems]);

    const [activeItems, setActiveItems] = useState<WbsItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [editingItem, setEditingItem] = useState<WbsItem | null>(null);
    
    const [name, setName] = useState('');
    const [isNumeric, setIsNumeric] = useState(false);
    const [numericValue, setNumericValue] = useState('');
    const [isTimeBased, setIsTimeBased] = useState(false);
    const [timeBasedValue, setTimeBasedValue] = useState('');
    const [isEditable, setIsEditable] = useState(true);
    const [nextStageIds, setNextStageIds] = useState<string[]>([]);

    useEffect(() => {
        setActiveItems(sortedWbsItems);
    }, [sortedWbsItems]);

    const wbsOptions = useMemo(() => 
        activeItems.map(item => ({ value: item.id!, label: item.name })), [activeItems]);

    useEffect(() => {
        if (editingItem) {
            setName(editingItem.name);
            const type = editingItem.controlType;
            const isNum = type === 'Numeric' || type === 'Hybrid';
            const isTime = type === 'TimeBased' || type === 'Hybrid';
            setIsNumeric(isNum);
            setIsTimeBased(isTime);
            setNumericValue(isNum ? String(editingItem.controlValue?.numeric || '') : '');
            setTimeBasedValue(isTime ? String(editingItem.controlValue?.time || '') : '');
            setIsEditable(editingItem.isEditable === false ? false : true);
            setNextStageIds(editingItem.nextStageIds || []);
        } else {
            resetForm();
        }
    }, [editingItem]);

    const resetForm = () => {
        setEditingItem(null);
        setName('');
        setIsNumeric(false);
        setNumericValue('');
        setIsTimeBased(false);
        setTimeBasedValue('');
        setIsEditable(true);
        setNextStageIds([]);
    }

    const handleSave = async () => {
        if (!firestore || !wbsCollectionPath || !name.trim()) return;
        
        setIsSaving(true);
        try {
            let controlType: WbsItem['controlType'] = null;
            if (isNumeric && isTimeBased) controlType = 'Hybrid';
            else if (isNumeric) controlType = 'Numeric';
            else if (isTimeBased) controlType = 'TimeBased';

            const payload: Omit<WbsItem, 'id' | 'requiredAction'> = {
                name,
                controlType,
                controlValue: {
                    ...(isNumeric && { numeric: Number(numericValue) }),
                    ...(isTimeBased && { time: timeBasedValue }),
                },
                isEditable,
                nextStageIds,
                order: editingItem ? editingItem.order : activeItems.length,
                companyId: tenantId!,
                createdAt: editingItem?.createdAt || serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            if (editingItem) {
                await updateDoc(doc(firestore, wbsCollectionPath, editingItem.id!), cleanFirestoreData(payload));
            } else {
                await addDoc(collection(firestore, wbsCollectionPath), payload);
            }
            
            toast({ title: "تم الحفظ بنجاح" });
            resetForm();
        } catch (error: any) {
            console.error("Failed to save WBS item: ", error);
            toast({ variant: 'destructive', title: "خطأ في الحفظ", description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (itemId: string) => {
        if (!firestore || !wbsCollectionPath) return;
        try {
            await deleteDoc(doc(firestore, wbsCollectionPath, itemId));
            toast({ title: "تم الحذف بنجاح" });
             if(editingItem?.id === itemId) resetForm();
        } catch (error: any) {
            toast({ variant: 'destructive', title: "خطأ في الحذف", description: error.message });
        }
    }

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = activeItems.findIndex((item) => item.id === active.id);
            const newIndex = activeItems.findIndex((item) => item.id === over.id);
            const newOrderedItems = arrayMove(activeItems, oldIndex, newIndex);
            setActiveItems(newOrderedItems);

            if (!firestore || !wbsCollectionPath) return;
            try {
                const batch = writeBatch(firestore);
                newOrderedItems.forEach((item, index) => {
                    const docRef = doc(firestore, wbsCollectionPath, item.id!);
                    batch.update(docRef, { order: index });
                });
                await batch.commit();
                toast({ title: "تم تحديث الترتيب" });
            } catch (error) {
                console.error("Error updating order: ", error);
                toast({ variant: 'destructive', title: "فشل تحديث الترتيب" });
                setActiveItems(sortedWbsItems); // Revert on failure
            }
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 bg-slate-50" dir="rtl">
                <DialogHeader className="p-6 pb-4 flex-shrink-0">
                    <DialogTitle className="flex items-center gap-3 text-2xl font-black">
                        <Workflow className="h-8 w-8 text-primary" />
                        <span>محرر هيكل تجزئة العمل (WBS)</span>
                    </DialogTitle>
                    <DialogDescription>
                        أنت الآن تقوم بتصميم المخطط التنفيذي لمرحلة: <span className="font-bold text-primary">{subService.name}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-12 gap-x-6 flex-1 overflow-hidden px-6 pb-6">
                    <Card className="col-span-5 flex flex-col shadow-lg h-full overflow-hidden">
                         <div className="p-4 flex-shrink-0">
                             <h3 className="text-md font-bold text-center">{editingItem ? 'تعديل بند' : 'إضافة بند جديد'}</h3>
                        </div>
                        <ScrollArea className="flex-1">
                             <div className="space-y-3 px-4 text-sm">
                                <div className="space-y-2">
                                    <Label htmlFor="wbs-name">اسم البند</Label>
                                    <Input id="wbs-name" placeholder="مثال: تقديم للترخيص" value={name} onChange={e => setName(e.target.value)} />
                                </div>
                                 <div className="space-y-3 rounded-lg border p-3 bg-white">
                                    <Label className='font-bold'>نوع التحكم في الإنجاز</Label>
                                    <div className="flex items-center gap-2">
                                        <Checkbox id="isNumeric" checked={isNumeric} onCheckedChange={(c) => setIsNumeric(Boolean(c))} />
                                        <Label htmlFor="isNumeric" className="flex-1 text-xs">عددي (مثل: عدد زيارات)</Label>
                                        {isNumeric && <Input type="number" placeholder="القيمة" className="w-20 h-8 text-xs" value={numericValue} onChange={e => setNumericValue(e.target.value)} />}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox id="isTimeBased" checked={isTimeBased} onCheckedChange={(c) => setIsTimeBased(Boolean(c))} />
                                        <Label htmlFor="isTimeBased" className="flex-1 text-xs">زمني (مثل: 30 يوم)</Label>
                                        {isTimeBased && <Input type="text" placeholder="المدة" className="w-20 h-8 text-xs" value={timeBasedValue} onChange={e => setTimeBasedValue(e.target.value)} />}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>المراحل التالية (المتوازية)</Label>
                                    <MultiSelect 
                                        options={wbsOptions.filter(opt => opt.value !== editingItem?.id)} 
                                        selected={nextStageIds}
                                        onChange={setNextStageIds}
                                        placeholder="اختر المراحل التي تبدأ بعد هذا البند"
                                    />
                                </div>
                                 <div className="flex items-center justify-between rounded-lg border p-3 bg-white">
                                    <Label htmlFor="is-editable" className="font-bold text-xs">قابل للتعديل بعد بدء المشروع</Label>
                                    <Switch id="is-editable" checked={isEditable} onCheckedChange={setIsEditable} />
                                </div>
                            </div>
                        </ScrollArea>
                        <div className="flex justify-end gap-2 border-t p-4 flex-shrink-0">
                            {editingItem && <Button variant="outline" size="sm" onClick={resetForm}>إلغاء التعديل</Button>}
                            <Button onClick={handleSave} disabled={isSaving} size="sm" className="flex-1">
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                                {editingItem ? 'حفظ التعديلات' : 'حفظ البند'}
                            </Button>
                        </div>
                    </Card>

                    <div className="col-span-7 h-full flex flex-col min-h-0">
                         <h3 className="text-md font-bold mb-4 text-center flex-shrink-0">بنود العمل المصممة</h3>
                         <ScrollArea className="flex-1 pr-2">
                             <WbsItemsContext.Provider value={activeItems}>
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={activeItems.map(i => i.id!)} strategy={verticalListSortingStrategy}>
                                        <div className="space-y-2 pb-10">
                                            {loadingWbs && Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />) }
                                            {!loadingWbs && activeItems.length === 0 && (
                                                <div className="text-center h-full pt-20 text-gray-400 flex flex-col items-center justify-center">
                                                    <Workflow className="h-10 w-10 mb-4" />
                                                    <h3 className="font-bold text-sm">لا توجد بنود بعد</h3>
                                                    <p className="text-xs">ابدأ بإضافة أول بند في هيكل العمل.</p>
                                                </div>
                                            )}
                                            {activeItems.map((item, index) => (
                                                <SortableWbsItem 
                                                    key={item.id}
                                                    item={item}
                                                    index={index}
                                                    active={editingItem?.id === item.id}
                                                    onEdit={() => setEditingItem(item)}
                                                    onDelete={() => handleDelete(item.id!)}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            </WbsItemsContext.Provider>
                         </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}