/**
 * @fileOverview تعريف كافة الأنماط (Interfaces) والكيانات في النظام.
 * هذا الملف هو "القاموس" الذي يحدد شكل البيانات في Firestore.
 */

// 1. واجهة الزيارة الميدانية: تستخدم لتسجيل خروج المهندس للموقع
export interface FieldVisit {
  id?: string;                  // المعرف الفريد من Firebase
  clientId: string;             // ربط بالعميل
  clientName: string;           // اسم العميل (للسرعة في العرض)
  transactionId: string;        // ربط بالمعاملة/المشروع
  transactionType: string;      // نوع المعاملة
  engineerId: string;           // المهندس الذي قام بالزيارة
  engineerName: string;         // اسم المهندس
  scheduledDate: any;           // تاريخ الموعد (Timestamp)
  plannedStageId: string;       // المرحلة المستهدفة من الـ WBS
  plannedStageName: string;     // اسم المرحلة
  status: 'planned' | 'confirmed' | 'cancelled'; // حالة الزيارة
  confirmationData?: {          // بيانات التأكيد عند وصول المهندس
    confirmedAt: any;           // وقت التأكيد الفعلي
    notes: string;              // ملاحظات المهندس الميدانية
    location?: {                // إحداثيات الـ GPS لضمان المصداقية
      latitude: number;
      longitude: number;
      accuracy: number;
    };
    isCompleted: boolean;       // هل تم إنهاء المهمة
  };
  createdAt: any;               // تاريخ إنشاء السجل
}

// 2. واجهة بنود جداول الكميات (BOQ): تمثل شجرة التكاليف
export interface BoqItem {
  id?: string;                  // معرف البند
  itemId?: string;              // ربط بدليل المواد المرجعي
  itemNumber: string;           // رقم البند الشجري (مثل 1.2.1)
  description: string;          // وصف العمل
  unit: string;                 // الوحدة (م3، م2، مقطوعية)
  quantity: number;             // الكمية المتعاقد عليها
  sellingUnitPrice: number;     // سعر البيع للعميل
  costUnitPrice?: number;       // سعر التكلفة التقديري
  isHeader: boolean;            // هل هو عنوان قسم (لا يحسب) أم بند عمل
  parentId: string | null;      // المعرف للأب (لبناء الشجرة)
  level: number;                // مستوى العمق في الشجرة
  notes?: string;               // ملاحظات إضافية
  startDate?: any;              // تاريخ بدء التنفيذ المخطط
  endDate?: any;                // تاريخ الانتهاء المخطط
}

// 3. واجهة مشروع المقاولات: الكيان الرئيسي للتنفيذ
export interface ConstructionProject {
  id?: string;                  // معرف الوثيقة
  projectId: string;            // الرقم التسلسلي للمشروع (مثل PRJ-2024-001)
  projectName: string;          // اسم المشروع (فيلا السيد...)
  clientId: string;             // ربط بصاحب المشروع
  clientName?: string;          // اسم العميل
  projectType: 'استشاري' | 'تنفيذي' | 'مختلط';
  constructionTypeId?: string;  // ربط بنوع المقاولات (هيكل، ترميم)
  contractValue: number;        // القيمة الإجمالية للعقد
  startDate: any;               // تاريخ البدء الفعلي
  endDate: any;                 // تاريخ التسليم التعاقدي
  status: 'مخطط' | 'قيد التنفيذ' | 'مكتمل' | 'معلق' | 'ملغى';
  mainEngineerId: string;       // مدير المشروع
  progressPercentage: number;   // نسبة الإنجاز الإجمالية
  boqId?: string;               // ربط بجدول الكميات المعتمد
  createdAt?: any;
}

// 4. واجهة العميل: مركز العمليات
export interface Client {
  id: string;
  nameAr: string;               // الاسم بالعربية (أساسي للبحث)
  nameEn?: string;
  mobile: string;               // رقم التواصل (فريد)
  civilId?: string;             // الرقم المدني
  address?: {                   // العنوان التفصيلي
    governorate: string;
    area: string;
    block: string;
    street: string;
    houseNumber: string;
  };
  fileId: string;               // رقم الملف الرسمي (1/2024)
  status: 'new' | 'contracted' | 'cancelled' | 'reContracted';
  assignedEngineer?: string;    // المهندس المسؤول عن العميل
  transactionCounter?: number;  // عداد لتوليد أرقام المعاملات
}

// 5. واجهة المعاملة: تمثل خدمة معينة للعميل
export interface ClientTransaction {
    id?: string;
    transactionNumber?: string; // رقم المعاملة (CL1-TX01)
    clientId: string;           // ربط بالعميل
    transactionType: string;    // نوع الخدمة
    status: string;             // حالة سير العمل
    contract?: {                // العقد المالي المرتبط بالمعاملة
        clauses: any[];         // دفعات العقد
        totalAmount: number;    // إجمالي قيمة المعاملة
        financialsType?: 'fixed' | 'percentage';
    };
    stages?: any[];             // مراحل العمل الفعلية (WBS)
}

// 6. واجهة القيد المحاسبي: العصب المالي للنظام
export interface JournalEntry { 
    id?: string; 
    entryNumber: string;        // رقم القيد (JV-2024-001)
    date: any;                  // تاريخ الاستحقاق
    narration: string;          // البيان/الوصف
    totalDebit: number;         // إجمالي المدين
    totalCredit: number;        // إجمالي الدائن (يجب أن يتساوى مع المدين)
    status: string;             // draft (مسودة) | posted (مرحل)
    lines: JournalEntryLine[];  // أسطر القيد التفصيلية
    transactionId?: string;     // ربط بالمشروع (مركز ربحية)
    clientId?: string;          // ربط بالعميل
}

export interface JournalEntryLine {
    accountId: string;          // الحساب المتأثر من الشجرة
    accountName: string;        // اسم الحساب
    debit: number;              // المبلغ المدين
    credit: number;             // المبلغ الدائن
    auto_profit_center?: string;// وسم المشروع للتقارير التحليلية
    auto_resource_id?: string;  // وسم المهندس لقياس الإنتاجية
}

// 7. واجهة الموظف: لإدارة الموارد البشرية
export interface Employee {
    id?: string;
    employeeNumber: string;     // الرقم الوظيفي
    fullName: string;           // الاسم الرباعي
    basicSalary: number;        // الراتب الأساسي
    housingAllowance?: number;  // بدل السكن
    transportAllowance?: number;// بدل المواصلات
    status: 'active' | 'terminated';
    hireDate: any;              // تاريخ التعيين
    contractType: string;       // دائم، مؤقت، نسبة
}
