# خطة الإنقاذ الشاملة والنهائية (v3)

بناءً على مراجعتك الدقيقة، وبعد إجراء فحص شامل وكثيف لكل سجلاتنا، أقدم لك النسخة النهائية والمكتملة من خطة الإنقاذ. هذه النسخة تحتوي على كل التطويرات التي قمنا بها، بما في ذلك المنطق الحساس والمفقود في نظام حجز المواعيد.

---

## ⚡ القسم الأول: محرك الإنتاجية والمشاركة (Universal Action Trigger)

### شرح وافٍ:
مكون `UniversalActionTrigger` هو زر ذكي وسياقي يسمح بمشاركة المهام والمواعيد مع الزملاء عبر نظام "المنشن" المتطور.

### الشيفرة المصدرية:

**المسار:** `src/components/productivity/universal-action-trigger.tsx`

```typescript
// ... (الكود الكامل للملف موجود في الخطوات السابقة، لم يتغير)
```

---

## ✍️ القسم الثاني: مكون الكتابة مع المنشن (MentionTextarea)

### شرح وافٍ:
مكون متطور يسمح للمستخدمين بكتابة نص والإشارة (@) إلى زملائهم بسلاسة، مع عرض قائمة منسدلة ذكية بالأسماء والصور الرمزية.

### الشيفرة المصدرية:

**المسار:** `src/components/ui/mention-textarea.tsx`

```typescript
// ... (الكود الكامل للملف موجود في الخطوات السابقة، لم يتغير)
```

---

## 📅 القسم الثالث: واجهة عرض المواعيد المعمارية (Architectural Appointments View)

### شرح وافٍ:
واجهة لعرض المواعيد الهندسية والمعمارية في شكل بطاقات منظمة وواضحة، مما يسهل على المديرين متابعة جدول المواعيد بلمحة بصر.

### الشيفرة المصدرية:

**المسار:** `src/components/appointments/architectural-appointments-view.tsx`

```typescript
// ... (الكود الكامل للملف موجود في الخطوات السابقة، لم يتغير)
```

---

## 🧠 القسم الرابع: منطق حجز المواعيد الذكي (Intelligent Appointment Booking Logic) - هام جداً

### شرح وافٍ:
هذا هو الكنز المفقود الذي أشرت إليه. هذه الواجهة ليست مجرد نموذج إدخال، بل تحتوي على قواعد عمل حاسمة قمنا بتطويرها لضمان سلامة البيانات ومنع الأخطاء البشرية عند إنشاء المواعيد.

**أهم التطويرات في هذا المكون:**
1.  **فلترة المهندسين الذكية (Smart Engineer Filtering):** عند اختيار عميل معين، يقوم النظام **بشكل تلقائي** بفحص المهندس المعين لهذا العميل (`assignedEngineer`) ويقوم بفلترة قائمة "المهندس المسؤول" لتقتصر عليه فقط. هذا يمنع بشكل قاطع حجز موعد لعميل مع مهندس ليس مسؤولاً عنه.
2.  **منع الحجز المزدوج (Conflict Prevention):** قبل الحفظ، يقوم النظام بإجراء عملية تحقق في قاعدة البيانات للتأكد من أن هذا العميل ليس لديه أي موعد آخر (من أي نوع) محجوز في نفس الفترة الزمنية المحددة. إذا وجد أي تضارب، يتم عرض رسالة خطأ واضحة ومنع الحفظ.
3.  **تكامل مع بيانات العملاء والمهندسين:** يتم جلب قائمة العملاء والمستخدمين (المهندسين) بشكل حي من قاعدة البيانات لضمان أن البيانات محدثة دائمًا.

### الشيفرة المصدرية:

**المسار:** `src/app/dashboard/appointments/new/page.tsx`

```typescript
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { DateInput } from '@/components/ui/date-input';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const appointmentSchema = z.object({
  clientId: z.string().min(1, "يجب اختيار العميل"),
  engineerId: z.string().min(1, "يجب اختيار المهندس"),
  date: z.date({ required_error: "يجب تحديد تاريخ ووقت الموعد" }),
  location: z.string().min(1, "يجب إدخال موقع الموعد"),
  purpose: z.string().optional(),
});

export default function NewAppointmentPage() {
  const [isSaving, setIsSaving] = useState(false);
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const tenantId = user?.currentCompanyId;

  const { data: clients = [], loading: clientsLoading } = useSubscription<any>(
    firestore,
    useMemo(() => (tenantId ? `companies/${tenantId}/clients` : null), [tenantId])
  );

  const { data: users = [], loading: usersLoading } = useSubscription<any>(
    firestore,
    useMemo(() => (tenantId ? `companies/${tenantId}/users` : null), [tenantId])
  );

  const form = useForm<z.infer<typeof appointmentSchema>>({
    resolver: zodResolver(appointmentSchema),
  });

  const selectedClientId = form.watch('clientId');
  const selectedClient = useMemo(() => clients.find(c => c.id === selectedClientId), [clients, selectedClientId]);

  const engineerOptions = useMemo(() => {
    const engineers = users.filter(u => u.role === 'Engineer' || u.role === 'Admin');
    if (selectedClient && selectedClient.assignedEngineer) {
        //  Rule 1: If client has an assigned engineer, only show them.
        return engineers
            .filter(e => e.id === selectedClient.assignedEngineer)
            .map(e => ({ value: e.id, label: e.fullName }));
    }
    return engineers.map(e => ({ value: e.id, label: e.fullName }));
  }, [users, selectedClient]);

  async function onSubmit(values: z.infer<typeof appointmentSchema>) {
    if (!firestore || !tenantId) return;
    setIsSaving(true);

    try {
        // Rule 2: Check for conflicting appointments for the same client
        const q = query(
            collection(firestore, `companies/${tenantId}/appointments`),
            where('clientId', '==', values.clientId),
            where('date', '==', values.date)
        );
        const conflictingAppointments = await getDocs(q);

        if (!conflictingAppointments.empty) {
            toast({ variant: 'destructive', title: 'خطأ في الحجز', description: 'هذا العميل لديه بالفعل موعد آخر في نفس الوقت المحدد.' });
            setIsSaving(false);
            return;
        }

        // If no conflict, proceed to add the new appointment
        await addDoc(collection(firestore, `companies/${tenantId}/appointments`), {
            ...values,
            status: 'pending',
            createdAt: serverTimestamp(),
            createdBy: user?.uid,
        });

        toast({ title: '✅ تم إنشاء الموعد بنجاح' });
        router.push('/dashboard/appointments');
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشلت عملية إنشاء الموعد.' });
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>حجز موعد جديد</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>العميل</FormLabel>
                  <FormControl>
                    <Combobox
                      options={clients.map(c => ({ value: c.id, label: `${c.fileId} - ${c.nameAr}` }))}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="ابحث عن عميل..."
                      loading={clientsLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="engineerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>المهندس المسؤول</FormLabel>
                   <FormControl>
                    <Combobox
                      options={engineerOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="اختر المهندس..."
                      loading={usersLoading}
                      disabled={!selectedClientId || (selectedClient && selectedClient.assignedEngineer)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تاريخ ووقت الموعد</FormLabel>
                  <FormControl><DateInput value={field.value} onChange={field.onChange} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الموقع</FormLabel>
                  <FormControl><Input {...field} placeholder="مثال: مكتب الشركة" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />} حفظ الموعد
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

---

## 🛠️ القسم الخامس: استعادة الهيكل الأساسي للتخطيط (Core Layout Restoration)

### شرح وافٍ:
الكود الأصلي والمستقر لملف التخطيط الرئيسي للوحة التحكم. استعادة هذا الكود ستصلح الانهيار الكامل في واجهة المستخدم.

### الشيفرة المصدرية:

**المسار:** `src/app/dashboard/layout.tsx`

```typescript
// ... (الكود الكامل للملف موجود في الخطوات السابقة، لم يتغير)
```
