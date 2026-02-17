
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, getDocs, query, collectionGroup, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Save, X, PlusCircle, Trash2, ArrowUp, ArrowDown, ClipboardCheck } from 'lucide-react';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import type { Boq, BoqItem, BoqReferenceItem, TransactionType, CompanyActivityType, SubcontractorType } from '@/lib/types';
import { InlineSearchList, type SearchOption } from '@/components/ui/inline-search-list';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const generateId = () => Math.random().toString(36).substring(2, 9);

const itemSchema = z.object({
  id: z.string(),
  itemNumber: z.string(),
  description: z.string().min(1, "الوصف مطلوب."),
  unit: z.string(),
  quantity: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  sellingUnitPrice: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  notes: z.string().optional(),
  parentId: z.string().nullable(),
  level: z.number(),
  isHeader: z.boolean(),
  itemId: z.string().optional(),
});

export const boqFormSchema = z.object({
  name: z.string().min(1, "اسم جدول الكميات مطلوب."),
  clientName: z.string().optional(),
  status: z.enum(['تقديري', 'تعاقدي', 'منفذ']),
  items: z.array(itemSchema).min(1, 'يجب إضافة بند واحد على الأقل.'),
});

export type BoqFormValues = z.infer<typeof boqFormSchema>;

interface BoqFormProps {
    onSave: (data: BoqFormValues) => Promise<void>;
    onClose: () => void;
    initialData?: Partial<BoqFormValues> | null;
    isSaving?: boolean;
}

function BoqItemsRenderer({ control, register, errors, level, parentId, parentNumber, itemIndex, onAddItem, onMasterItemSelect, masterItems, masterItemsLoading }: any) {
    const { remove, update } = useFieldArray({ control, name: 'items' });
    const watchedItems = useWatch({ control, name: 'items' });
    
    const currentItem = watchedItems[itemIndex];
    if (!currentItem) return null;

    const childItems = useMemo(() => {
        return watchedItems
            .map((field: any, index: number) => ({ field, index }))
            .filter(({ field }: any) => field.parentId === currentItem.id);
    }, [watchedItems, currentItem.id]);
    
    const isLumpSum = currentItem.unit === 'مقطوعية';
    const total = isLumpSum ? (currentItem.sellingUnitPrice || 0) : (currentItem.quantity || 0) * (currentItem.sellingUnitPrice || 0);

    const masterItemOptions = useMemo(() => {
        const parentMasterId = parentId ? watchedItems.find((i: BoqItem) => i.id === parentId)?.itemId : null;
        return (masterItems || [])
            .filter((item: BoqReferenceItem) => item.parentBoqReferenceItemId === (parentMasterId || null))
            .map((i: BoqReferenceItem) => ({ value: i.id!, label: i.name }));
    }, [masterItems, parentId, watchedItems]);

    return (
        <Card key={currentItem.id} className="bg-muted/30 p-4 space-y-4">
           <div className="flex items-start gap-4">
               <div className="font-bold text-lg pt-2">{parentNumber ? `${parentNumber}.${itemIndex + 1}` : itemIndex + 1}</div>
               <div className="flex-grow space-y-2">
                    <Controller
                        name={`items.${itemIndex}.itemId`}
                        control={control}
                        render={({ field }) => (
                            <InlineSearchList 
                                value={field.value || ''}
                                onSelect={(value) => {
                                    field.onChange(value);
                                    onMasterItemSelect(itemIndex, value);
                                }}
                                options={masterItemOptions}
                                placeholder={masterItemsLoading ? "جاري التحميل... (يمكنك الكتابة)" : "اختر بندًا أو اكتب..."}
                            />
                        )}
                    />
                    <Textarea {...register(`items.${itemIndex}.description`)} className="bg-background font-semibold text-base" />
                    {!currentItem.isHeader && <Textarea {...register(`items.${itemIndex}.notes`)} placeholder="ملاحظات على البند..." rows={1} className="bg-background text-sm" />}
               </div>
               <Button type="button" variant="ghost" size="icon" onClick={() => remove(itemIndex)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
           </div>
           
           {!currentItem.isHeader && (
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center pr-8">
               <div className="grid gap-1">
                 <Label>الوحدة</Label>
                 <Input {...register(`items.${itemIndex}.unit`)} />
               </div>
               <div className="grid gap-1">
                 <Label>الكمية</Label>
                 <Input type="number" step="any" {...register(`items.${itemIndex}.quantity`)} disabled={isLumpSum} className="dir-ltr"/>
               </div>
               <div className="grid gap-1">
                 <Label>سعر الوحدة</Label>
                 <Input type="number" step="0.001" {...register(`items.${itemIndex}.sellingUnitPrice`)} className="dir-ltr"/>
               </div>
               <div className="grid gap-1 text-left">
                 <Label className="text-right">الإجمالي</Label>
                 <div className="h-10 px-3 py-2 font-mono">{formatCurrency(total)}</div>
               </div>
             </div>
           )}
           {currentItem.isHeader && (
              <div className="pr-8 space-y-2">
                {childItems.map(({ field, index: childIndex }: any) => (
                     <BoqItemsRenderer 
                        key={field.id}
                        control={control}
                        register={register}
                        errors={errors}
                        level={level + 1}
                        parentId={currentItem.id}
                        parentNumber={currentItem.itemNumber}
                        itemIndex={childIndex}
                        onAddItem={onAddItem}
                        onMasterItemSelect={onMasterItemSelect}
                        masterItems={masterItems}
                        masterItemsLoading={masterItemsLoading}
                     />
                ))}
                 <Button type="button" variant="ghost" size="sm" onClick={() => onAddItem(currentItem.id, false)} className="mt-2 text-primary"><PlusCircle className="ml-2 h-4"/> إضافة بند عمل</Button>
             </div>
           )}
        </Card>
    );
}


export function BoqForm({ onSave, onClose, initialData, isSaving = false }: BoqFormProps) {
    const isEditing = !!initialData;
    const { firestore } = useFirebase();
    const { data: masterItems, loading: masterItemsLoading } = useSubscription<BoqReferenceItem>(firestore, 'boqReferenceItems', [orderBy('name')]);

    const methods = useForm<BoqFormValues>({
        resolver: zodResolver(boqFormSchema),
        defaultValues: initialData || {
            name: '',
            clientName: '',
            status: 'تقديري',
            items: []
        }
    });

    const { control, handleSubmit, watch, setValue, reset, getValues, register, formState: { errors } } = methods;

    const { fields, append, remove, update, insert } = useFieldArray({ control, name: "items" });

    const watchedItems = watch('items');

    useEffect(() => {
        if (initialData) {
            reset(initialData);
        }
    }, [initialData, reset]);

    const handleAddItem = useCallback((parentId: string | null, isHeader: boolean) => {
        const currentItems = getValues('items');
        let newIndex = 0;
        let lastSiblingIndex = -1;

        if (parentId) {
            for(let i = currentItems.length - 1; i >= 0; i--) {
                if (currentItems[i].id === parentId) {
                    lastSiblingIndex = i;
                    break;
                }
            }
             for(let i = currentItems.length - 1; i > lastSiblingIndex; i--) {
                if (currentItems[i].parentId === parentId) {
                    lastSiblingIndex = i;
                    break;
                }
            }
        } else {
            for(let i = currentItems.length - 1; i >= 0; i--) {
                if (currentItems[i].parentId === null) {
                    lastSiblingIndex = i;
                    break;
                }
            }
        }
        
        newIndex = lastSiblingIndex !== -1 ? lastSiblingIndex + 1 : currentItems.length;
        
        const parentItem = parentId ? currentItems.find(item => item.id === parentId) : null;
        const level = parentItem ? parentItem.level + 1 : 0;
        
        const newItem: any = {
            id: generateId(),
            itemNumber: 'TEMP',
            description: '',
            unit: isHeader ? '' : 'مقطوعية',
            quantity: isHeader ? 0 : 1,
            sellingUnitPrice: 0,
            notes: '',
            parentId: parentId,
            level: level,
            isHeader: isHeader,
        };
        
        insert(newIndex, newItem as any);
    
    }, [insert, getValues]);


    const handleMasterItemSelect = useCallback((index: number, masterItemId: string) => {
        const masterItem = masterItems.find(i => i.id === masterItemId);
        if (masterItem) {
            const currentItem = getValues(`items.${index}`);
            update(index, {
                ...currentItem,
                itemId: masterItem.id,
                description: masterItem.name,
                unit: masterItem.unit || (masterItem.isHeader ? '' : 'مقطوعية'),
                isHeader: masterItem.isHeader || false,
            });
        }
    }, [masterItems, getValues, update]);
    
    const totalValue = useMemo(() => {
        return (watchedItems || []).reduce((sum, item) => {
            if (item.isHeader) return sum;
            const isLumpSum = item.unit === 'مقطوعية';
            const quantity = isLumpSum ? 1 : (item.quantity || 0);
            return sum + (quantity * (item.sellingUnitPrice || 0));
        }, 0);
    }, [watchedItems]);

    const onSubmit = (data: BoqFormValues) => {
        onSave(data);
    };
    
    const rootItems = useMemo(() => {
        return fields.map((field, index) => ({ field, index })).filter(({ field }) => field.parentId === null);
    }, [fields]);
    

    return (
        <Card dir="rtl">
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>{isEditing ? 'تعديل جدول الكميات' : 'إنشاء جدول كميات جديد'}</CardTitle>
                    <CardDescription>
                        {isEditing ? `تعديل جدول: ${initialData?.name}` : 'أدخل تفاصيل جدول الكميات لإنشاءه.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="grid gap-2"><Label>اسم/مرجع جدول الكميات *</Label><Input {...register('name')} /></div>
                            <div className="grid gap-2"><Label>اسم العميل (المحتمل)</Label><Input {...register('clientName')} /></div>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label>الحالة</Label>
                                <Controller
                                    name="status"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <SelectTrigger><SelectValue placeholder="اختر الحالة..." /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="تقديري">تقديري</SelectItem>
                                                <SelectItem value="تعاقدي">تعاقدي</SelectItem>
                                                <SelectItem value="منفذ">منفذ</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                        </div>
                        
                        <Separator />
                        <h3 className="font-semibold text-lg">بنود جدول الكميات</h3>

                        <div className="space-y-4">
                            {rootItems.map(({ field, index }) => (
                                <BoqItemsRenderer 
                                    key={field.id}
                                    control={control}
                                    register={register}
                                    errors={errors}
                                    level={0}
                                    parentId={null}
                                    parentNumber=""
                                    itemIndex={index}
                                    onAddItem={handleAddItem}
                                    onMasterItemSelect={handleMasterItemSelect}
                                    masterItems={masterItems}
                                    masterItemsLoading={masterItemsLoading}
                                />
                            ))}
                        </div>

                         {errors.items && <p className="text-destructive text-sm mt-2">{errors.items.root?.message || errors.items.message}</p>}
                        <div className="flex justify-center mt-4">
                           <Button type="button" variant="secondary" onClick={() => handleAddItem(null, true)}>
                                <PlusCircle className="ml-2 h-4 w-4"/> إضافة قسم رئيسي
                            </Button>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col items-end gap-4 pt-6 border-t">
                    <div className="text-2xl font-bold">
                        <span>الإجمالي العام: </span>
                        <span className="font-mono">{formatCurrency(totalValue)}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                            {isEditing ? 'حفظ التعديلات' : 'حفظ'}
                        </Button>
                    </div>
                </CardFooter>
            </form>
        </Card>
    );
}

```
- src/components/ui/separator.tsx:
```tsx
"use client"

import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"

import { cn } from "@/lib/utils"

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }

```
- src/lib/hooks/use-smart-cache.ts:
```ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import localforage from 'localforage';

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

/**
 * A hook that provides a smart caching layer for asynchronous data fetching.
 * It fetches data, caches it in IndexedDB using localforage, and returns
 * the cached data first while revalidating in the background if the cache is stale.
 * 
 * @param key Unique key to identify the cached data.
 * @param fetcher The asynchronous function that fetches the data.
 * @param ttl Time-to-live for the cache in milliseconds.
 */
export function useSmartCache<T>(key: string, fetcher: () => Promise<T>, ttl: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // A ref to ensure the fetcher is only called once on mount or when key/ttl changes,
  // preventing multiple background fetches on re-renders.
  const isFetching = useRef(false);

  const fetchData = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    setLoading(true);

    try {
      const cachedItem = await localforage.getItem<CacheItem<T>>(key);
      const now = Date.now();

      // If we have fresh, valid cached data, use it immediately.
      if (cachedItem && (now - cachedItem.timestamp < ttl)) {
        setData(cachedItem.data);
        setLoading(false); // We have data, so we're not "loading" from the user's perspective.
      } else if(cachedItem) {
        // If we have stale data, show it first, then revalidate in the background.
        setData(cachedItem.data);
        setLoading(false);
      } else {
        // No data at all, so we must show the loading state.
        setLoading(true);
      }

      // Revalidate data from the network
      const freshData = await fetcher();
      await localforage.setItem(key, { data: freshData, timestamp: Date.now() });
      setData(freshData);
    } catch (e) {
      console.error(`Failed to fetch or cache data for key "${key}":`, e);
      setError(e as Error);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [key, fetcher, ttl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error };
}

```
- src/lib/hooks/use-subscription.tsx:
```tsx

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  type Firestore,
  query,
  collection,
  onSnapshot,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';

const EMPTY_CONSTRAINTS: QueryConstraint[] = [];

/**
 * A simplified, stable hook for real-time Firestore collection subscriptions.
 * It uses a memoized query key to prevent re-subscriptions on every render.
 */
export function useSubscription<T extends { id?: string }>(
  firestore: Firestore | null,
  collectionPath: string | null, 
  constraints: QueryConstraint[] = EMPTY_CONSTRAINTS
): { data: T[], setData: React.Dispatch<React.SetStateAction<T[]>>, loading: boolean, error: Error | null } {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    
    // Create a stable key from the path and constraints to use in the useEffect dependency array.
    // This prevents re-subscriptions on every render if the constraints array is a new instance but has the same values.
    const queryKey = useMemo(() => {
        if (!collectionPath) return null;
        try {
            // A simple string representation for the dependency array.
            return `${collectionPath}|${JSON.stringify(constraints)}`;
        } catch (e) {
            // Fallback for non-serializable constraints, though this should be avoided.
            return `${collectionPath}|${Date.now()}`;
        }
    }, [collectionPath, constraints]);


    useEffect(() => {
        if (!firestore || !collectionPath || !queryKey) {
            setLoading(false);
            setData([]); // Ensure data is cleared if there's no query
            return;
        }

        setLoading(true);

        const q = query(collection(firestore, collectionPath), ...constraints);

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
                setData(newData);
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error(`Error listening to ${collectionPath}:`, err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    // The key here includes the stringified constraints, so the effect only re-runs when the query truly changes.
    }, [firestore, queryKey, collectionPath]); // 'constraints' is removed to rely on the stable queryKey

    return { data, setData, loading, error };
}

```
- src/lib/placeholder-images.ts:
```ts
import data from './placeholder-images.json';

export type ImagePlaceholder = {
  id: string;
  description: string;
  imageUrl: string;
  imageHint: string;
};

export const PlaceHolderImages: ImagePlaceholder[] = data.placeholderImages;

```
- tailwind.config.ts:
```ts
import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        body: ["var(--font-body)", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config

```
- tsconfig.json:
```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}

```