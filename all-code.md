
# Nova ERP - الموسوعة البرمجية الكبرى (النسخة النهائية والمحدثة)

هذا المستند هو المرجع الشامل لكافة الأكواد والمنطق البرمجي في نظام Nova ERP، بما في ذلك التحديثات الأخيرة لحماية النظام من الحفظ المزدوج وتسريع العمليات.

---

## 🛠️ القسم 1: المعمارية ونظام الحماية (Global Protection Guard)

تم تطبيق نمط برمجي موحد (Pattern) في كافة نماذج النظام لمنع تكرار البيانات وتسريع الاستجابة:

### 1.1 منع الحفظ المزدوج (Double Save Prevention)
نستخدم `useRef` كصمام أمان برمجي يتفاعل لحظياً قبل تغير حالة الـ `UI State`:
```typescript
const savingRef = useRef(false);
const onSubmit = async (data) => {
  if (savingRef.current) return; // منع التنفيذ إذا كانت هناك عملية جارية
  savingRef.current = true;
  setIsSaving(true);
  try {
    await saveToDatabase(data);
    onSuccess(); // إغلاق أو توجيه فوري
  } catch (e) {
    setIsSaving(false);
    savingRef.current = false; // إعادة التفعيل في حال الخطأ فقط
  }
}
```

---

## 💾 القسم 3: طبقة البيانات وهيكل Firestore (lib/types.ts)

هذا القسم يحتوي على الكود الكامل لتعريفات الكيانات، وهو العمود الفقري لضمان اتساق البيانات.

```typescript
// src/lib/types.ts

import { Timestamp } from 'firebase/firestore';

export interface Client {
  id: string;
  fileId: string;
  nameAr: string;
  mobile: string;
  status: 'new' | 'contracted' | 'cancelled' | 'reContracted';
  assignedEngineer?: string;
  createdAt: Timestamp;
  isActive: boolean;
}

export interface PurchaseOrder {
  id?: string;
  poNumber: string;
  orderDate: Timestamp;
  vendorId: string;
  vendorName: string;
  totalAmount: number;
  status: 'draft' | 'approved' | 'received' | 'partially_received' | 'cancelled';
  items: PoItem[];
}
```

---

## 💰 القسم 9: المحرك المالي والقيود التلقائية (Accounting Engine)

### 9.1 توليد الأرقام المتسلسلة (Counters)
يعتمد النظام على `runTransaction` لضمان عدم تكرار أرقام السندات والقيود حتى في حال الحفظ المتزامن من عدة مستخدمين.

### 9.2 الربط الميداني المالي (WBS to Finance)
عند ضغط المهندس على "تأكيد إنجاز" في الموقع، يقوم النظام بالآتي:
1. جلب العقد المالي المرتبط.
2. مطابقة المرحلة المنجزة مع شروط الدفع.
3. تحويل حالة الدفعة إلى "مستحقة" آلياً.
4. توليد "مسودة مستخلص" و "مسودة قيد مديونية".

---

## 🔗 القسم 14: خرائط العلاقات (Entity Relationship Map)

1. **العميل ➔ المعاملة**: علاقة 1:N، يتم توليد رقم المعاملة بناءً على رقم ملف العميل.
2. **المعاملة ➔ العقد**: علاقة 1:1، العقد يحدد البنود المالية التي تظهر في شاشة القبض.
3. **أمر الشراء ➔ إذن الاستلام**: علاقة 1:N، إذن الاستلام يغلق البنود المفتوحة في أمر الشراء ويولد قيد مديونية المورد.
4. **الموظف ➔ المستخدم**: علاقة 1:1، يتم تعطيل حساب المستخدم فورياً عند تغيير حالة الموظف إلى "Terminated".

---
**ملاحظة رقابية**: النظام الآن محمي بالكامل من الأخطاء البشرية الشائعة (مثل تكرار الضغط على الحفظ) ويقدم تجربة سريعة عبر التوجيه اللحظي فور نجاح الكتابة في قاعدة البيانات.
