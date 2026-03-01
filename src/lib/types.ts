/**
 * @fileOverview تعريف كافة الأنماط (Interfaces) والكيانات في النظام.
 * هذا الملف هو "القاموس" الذي يحدد شكل البيانات في Firestore.
 */

import { Timestamp } from 'firebase/firestore';

// 1. واجهة العميل: مركز العمليات
// يرتبط بـ: ClientTransaction (علاقة 1 لـ متعدد)
export interface Client {
  id: string;                   // المعرف الفريد - يتولد تلقائياً من Firebase
  nameAr: string;               // الاسم بالعربية - أساس البحث والتقارير
  nameEn?: string;              // الاسم بالإنجليزية - اختياري للمراسلات
  mobile: string;               // رقم التواصل - فريد لمنع تكرار الملفات
  civilId?: string;             // الرقم المدني - للتحقق القانوني
  address?: {                   // العنوان التفصيلي للمشروع
    governorate: string;
    area: string;
    block: string;
    street: string;
    houseNumber: string;
  };
  fileId: string;               // رقم الملف الرسمي (مثال: 1/2024)
  status: 'new' | 'contracted' | 'cancelled' | 'reContracted'; // دورة حياة العميل
  assignedEngineer?: string;    // المهندس المسؤول عن العميل (Reference to Employee ID)
  transactionCounter?: number;  // عداد لتوليد أرقام المعاملات التسلسلية (TX01, TX02)
  createdAt: Timestamp;         // تاريخ إنشاء الملف
  isActive: boolean;            // حالة الملف (نشط/مجمد)
}

// 2. واجهة المعاملة: تمثل خدمة أو مشروع معين للعميل
export interface ClientTransaction {
    id?: string;
    transactionNumber?: string; // رقم المعاملة (CL1-TX01)
    clientId: string;           // ربط بالعميل (Foreign Key)
    transactionType: string;    // نوع الخدمة (تصميم بلدية، إشراف، إلخ)
    transactionTypeId?: string; // ربط بقالب نوع المعاملة
    departmentId?: string;      // القسم المسؤول حالياً عن المعاملة
    assignedEngineerId?: string;// المهندس المباشر المتابع للعمل
    status: string;             // حالة سير العمل (جديدة، قيد التنفيذ، منتهية)
    contract?: {                // العقد المالي المرتبط بالمعاملة (إن وجد)
        totalAmount: number;    // إجمالي قيمة المعاملة
        financialsType: 'fixed' | 'percentage'; // نوع الحسبة (مبلغ ثابت أم نسبة)
        clauses: ContractClause[]; // دفعات العقد وشروط استحقاقها
        scopeOfWork?: any[];    // نطاق العمل المعتمد
        termsAndConditions?: any[]; // الشروط القانونية
        openClauses?: any[];    // بنود إضافية
    };
    stages?: TransactionStage[];// مراحل العمل الفعلية (WBS)
    boqId?: string;             // ربط بجدول الكميات المعتمد لهذه المعاملة
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// 3. واجهة القيد المحاسبي: العصب المالي للنظام
export interface JournalEntry { 
    id?: string; 
    entryNumber: string;        // رقم القيد التسلسلي (JV-2024-001)
    date: Timestamp;            // تاريخ الاستحقاق المحاسبي
    narration: string;          // البيان/الوصف الشامل للقيد
    totalDebit: number;         // إجمالي المدين (يجب أن يتساوى مع الدائن)
    totalCredit: number;        // إجمالي الدائن
    status: 'draft' | 'posted'; // حالة القيد (مسودة لا تؤثر في التقارير / مرحل يؤثر)
    lines: JournalEntryLine[];  // أسطر القيد التفصيلية
    transactionId?: string;     // ربط بالمشروع (مركز ربحية لتقرير P&L)
    clientId?: string;          // ربط بالعميل (لمتابعة المديونية)
    linkedReceiptId?: string;   // ربط بسند القبض المنشئ لهذا القيد
    createdAt: Timestamp;
    createdBy: string;
}

export interface JournalEntryLine {
    accountId: string;          // الحساب المتأثر من شجرة الحسابات
    accountName: string;        // اسم الحساب وقت إنشاء القيد
    debit: number;              // المبلغ المدين
    credit: number;             // المبلغ الدائن
    notes?: string;             // ملاحظات على السطر
    auto_profit_center?: string;// وسم المشروع للتقارير التحليلية
    auto_resource_id?: string;  // وسم المهندس لقياس إنتاجية الموظف
    auto_dept_id?: string;      // وسم القسم لتحليل أداء الأقسام
}

// 4. واجهة الموظف: لإدارة الموارد البشرية والرواتب
export interface Employee {
    id?: string;
    employeeNumber: string;     // الرقم الوظيفي الفريد
    fullName: string;           // الاسم الرباعي بالعربي
    nameEn?: string;            // الاسم بالإنجليزي
    civilId: string;            // الرقم المدني
    mobile: string;             // رقم التواصل
    department: string;         // القسم الحالي
    jobTitle: string;           // المسمى الوظيفي
    basicSalary: number;        // الراتب الأساسي
    housingAllowance?: number;  // بدل السكن
    transportAllowance?: number;// بدل المواصلات
    status: 'active' | 'terminated' | 'on-leave';
    hireDate: Timestamp;        // تاريخ التعيين (أساس حساب نهاية الخدمة)
    contractType: 'permanent' | 'temporary' | 'piece-rate' | 'percentage';
    terminationDate?: Timestamp;// تاريخ إنهاء الخدمة
    terminationReason?: 'resignation' | 'termination'; // سبب ترك العمل
    annualLeaveUsed?: number;   // إجمالي الإجازات المستهلكة
    carriedLeaveDays?: number;  // الرصيد المرحل من سنوات سابقة
}

export interface ContractClause {
    id: string;
    name: string;               // وصف الدفعة (مثال: الدفعة الأولى)
    amount: number;             // قيمة الدفعة بالدينار
    percentage?: number;        // النسبة المئوية من العقد (إن وجدت)
    status: 'مدفوعة' | 'مستحقة' | 'غير مستحقة';
    condition?: string;         // مرحلة العمل التي تفعل هذه الدفعة
}

export interface TransactionStage {
    stageId: string;
    name: string;               // اسم المرحلة (مثال: تسليم المخططات)
    status: 'pending' | 'in-progress' | 'completed' | 'skipped';
    startDate?: Timestamp;      // تاريخ بدء العمل بالمرحلة
    endDate?: Timestamp;        // تاريخ الإنجاز الفعلي
    expectedEndDate?: Timestamp;// تاريخ التسليم المخطط
    completedCount?: number;    // عدد مرات الإكمال (للمراحل التكرارية)
}
