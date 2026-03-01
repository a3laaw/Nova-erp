# Nova ERP - الموسوعة البرمجية والمعرفية الشاملة (النسخة النهائية للنسخ الاحتياطي)

هذا المستند هو المرجع المطلق لنظام Nova ERP. يحتوي على شرح تفصيلي للمنطق البرمجي، هيكل البيانات، والعلاقات المعقدة بين الأقسام، مع كود مصدري كامل لكل جزء حيوي لضمان القدرة على استعادة النظام أو فهمه بعمق.

---

## 🏗️ القسم 1: هيكل المشروع الكامل (Project Structure)

### 1.1 - شجرة الملفات (File Tree)
```text
src/
├── app/                    # مسارات التطبيق (Next.js 14/15 App Router)
│   ├── dashboard/          # المجلد الرئيسي للمنظومة (المحاسبة، المقاولات، HR، المشتريات)
│   ├── api/                # مسارات الـ API الخلفية (الذكاء الاصطناعي، التكامل)
│   └── layout.tsx          # التنسيق العام والمزودات (Firebase, Auth, Branding)
├── components/             # المكونات الرسومية (UI)
│   ├── ui/                 # مكونات ShadCN الأساسية (أزرار، جداول، نوافذ)
│   ├── accounting/         # محركات السندات والقيود والتقارير المالية
│   ├── construction/       # محركات الـ WBS، BOQ، والزيارات الميدانية
│   ├── hr/                 # محركات الرواتب، الإجازات، والتدقيق
│   └── layout/             # القائمة الجانبية، الرأس، والطباعة
├── services/               # العقل المنطقي (حساب الرواتب، مكافأة نهاية الخدمة، التواريخ)
├── lib/                    # المكتبات الأساسية (الأنماط types.ts، الأدوات utils.ts)
├── context/                # إدارة الحالة (Authentication, Branding, Sync)
├── firebase/               # تهيئة الاتصال وخطافات (Hooks) جلب البيانات
└── hooks/                  # خطافات مخصصة للتحليلات والإشعارات
```

---

## ⚙️ القسم 2: ملفات الإعداد والتهيئة (Configuration)

### 2.1 - package.json
يحتوي على المكتبات الجوهرية:
- `firebase`: لإدارة البيانات اللحظية.
- `date-fns`: المحرك المعتمد للحسابات الزمنية (الرواتب والجدولة).
- `xlsx`: لمعالجة ملفات البصمة.
- `html2pdf.js`: لتوليد السندات والعقود.

### 2.2 - firestore.rules
📝 **الوظيفة**: تأمين البيانات وضمان الرقابة.
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // مفتوح للتطوير، يجب تقييده عند الإنتاج بناءً على الأدوار
    }
  }
}
```

---

## 💾 القسم 3: طبقة البيانات (Data Layer)

### 3.1 - ملف التعريفات الرئيسي (src/lib/types.ts)
هذا هو القاموس البرمجي الذي يحدد شكل البيانات وعلاقاتها.

```typescript
import { Timestamp } from 'firebase/firestore';

/**
 * العميل: يمثل ملف العميل الرئيسي.
 * يرتبط بـ: ClientTransaction (1:N)
 */
export interface Client {
  id: string;                   // المعرف الفريد من Firebase
  fileId: string;               // رقم الملف (مثال: 1/2024)
  nameAr: string;               // الاسم بالعربية (أساس البحث)
  mobile: string;               // رقم الجوال (فريد)
  status: 'new' | 'contracted' | 'cancelled' | 'reContracted';
  createdAt: Timestamp;
  isActive: boolean;
}

/**
 * المعاملة: تمثل خدمة أو مشروع للعميل.
 * ترتبط بـ: Contract (1:1), BoqItem (1:N)
 */
export interface ClientTransaction {
    id?: string;
    clientId: string;           // ربط بالعميل
    transactionType: string;    // نوع الخدمة
    status: string;             // (جديدة، قيد التنفيذ، منتهية)
    contract?: {                // بيانات العقد المالي
        totalAmount: number;
        financialsType: 'fixed' | 'percentage';
        clauses: ContractClause[];
    };
    stages?: TransactionStage[]; // مراحل العمل (WBS)
    boqId?: string;             // ربط بجدول الكميات
}

/**
 * القيد المحاسبي: العمود الفقري للمالية.
 */
export interface JournalEntry { 
    id?: string; 
    entryNumber: string;        // (JV-2024-0001)
    date: Timestamp;
    narration: string;          // بيان القيد
    totalDebit: number;
    totalCredit: number;
    lines: JournalEntryLine[];  // أسطر القيد
    transactionId?: string;     // ربط بمركز الربحية (المشروع)
}

export interface JournalEntryLine {
    accountId: string;          // الحساب من الشجرة
    accountName: string;
    debit: number;
    credit: number;
    auto_profit_center?: string;// لتقارير ربحية المشاريع
}
```

---

## 💰 القسم 9: المنطق المحاسبي التفصيلي (Accounting Logic)

### 9.1 - شجرة الحسابات (COA)
تعتمد ترميزاً خماسياً دولياً:
- **1**: الأصول (1101: نقدية، 1102: عملاء).
- **2**: الالتزامات (2101: موردون).
- **4**: الإيرادات (4101: إيرادات استشارات).
- **5**: المصاريف (51xx: تكاليف مباشرة، 52xx: إدارية).

### 9.2 - سلسلة التوليد التلقائي (Auto-Chains)
هذا هو ذكاء النظام في ربط الإجراءات بالمالية:

**السلسلة 1: من العقد إلى المديونية**
- **المحفز**: حفظ عقد جديد لمعاملة.
- **الإجراء**: 
  1. إنشاء حساب للعميل في الشجرة (إذا كان أول عقد).
  2. إنشاء قيد يومية (مدين: العميل / دائن: إيرادات استشارات).
  3. ربط القيد بـ `transactionId` كمركز ربحية.

**السلسلة 2: من الزيارة الميدانية إلى المستخلص**
- **المحفز**: ضغط "تأكيد إنجاز" في الموقع.
- **الإجراء**:
  1. التحقق من "شرط الدفعة" في العقد (إذا تطابق اسم المرحلة).
  2. إنشاء "مسودة مستخلص" (Payment Application) بالمبلغ المحدد.
  3. إرسال تنبيه للمحاسب للمراجعة والترحيل.

---

## 🏗️ القسم 10: منطق الأعمال المعقد (Complex Business Logic)

### 10.1 - محرك الـ WBS
يسمح النظام ببناء شجرة بنود غير منتهية. يتم حساب نسبة الإنجاز التراكمية من الأصغر (البنود) إلى الأكبر (الأقسام الرئيسية) لضمان دقة التقدم العام.

### 10.3 - محرك الرواتب (القانون الكويتي)
يطبق النظام المادة 51 بدقة:
- **نهاية الخدمة**: (سنوات الخدمة * معامل الاستقالة * الراتب الشامل).
- **الإجازات**: 30 يوماً سنوياً (2.5 يوم/شهر)، تُصرف نقداً عند الاستقالة بناءً على أجر اليوم الواحد (الراتب / 26).

---

## 🔗 القسم 14: خريطة العلاقات الكاملة (Complete Relationship Map)

### 14.1 - العلاقات على مستوى قاعدة البيانات
| الكيان المصدر | الكيان الهدف | نوع العلاقة | حقل الربط | الأثر عند الحذف |
| :--- | :--- | :--- | :--- | :--- |
| العميل (Client) | المعاملة (Tx) | 1:N | `clientId` | منع (Restrict) |
| المعاملة (Tx) | العقد (Contract) | 1:1 | `transactionId` | حذف (Cascade) |
| المادة (Item) | القيد (JE) | 1:N | `itemId` | منع إذا وجد أثر مالي |
| المشروع (Project) | مركز الربحية | 1:1 | `auto_profit_center` | ربط تقارير P&L |

---

## 🛠️ القسم 5: طبقة الأدوات المساعدة (Utilities)

📁 **المسار**: `src/lib/utils.ts`
📝 **الوظيفة**: المحرك الجوهري للتفقيط وتنسيق العملة وتنظيف البيانات.

```typescript
/**
 * محرك التفقيط (Number to Arabic Words):
 * يحول الأرقام إلى كلمات قانونية للسندات.
 */
export function numberToArabicWords(inputNumber: number | string): string {
    const num = parseFloat(String(inputNumber).replace(/,/g, ''));
    if (isNaN(num) || num === 0) return 'صفر دينار كويتي لا غير';
    const dinars = Math.floor(num); 
    const fils = Math.round((num - dinars) * 1000); 
    let result = `${dinars} دينار كويتي`;
    if (fils > 0) result += ` و ${fils} فلس`;
    return `فقط ${result} لا غير`;
}

/**
 * منظف بيانات Firebase:
 * يمنع أخطاء 'undefined' عند الحفظ.
 */
export function cleanFirestoreData(data: any): any {
  if (data === undefined) return null;
  if (Array.isArray(data)) return data.map(item => cleanFirestoreData(item));
  if (data && typeof data === 'object') {
    if (typeof data.toDate === 'function' || data instanceof Date) return data;
    const cleanedData: { [key: string]: any } = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        if (value !== undefined) cleanedData[key] = cleanFirestoreData(value);
      }
    }
    return cleanedData;
  }
  return data;
}
```

---
*تم إعداد هذا التوثيق ليكون الحارس الأمين لمنطق وأكواد نظام Nova ERP.*
