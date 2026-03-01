/**
 * @fileOverview القاموس البرمجي الشامل لنظام Nova ERP.
 * يحدد كافة الكيانات والعلاقات والحقول داخل قاعدة بيانات Firestore.
 */

import { Timestamp } from 'firebase/firestore';

/**
 * العميل (Client): يمثل الملف الرئيسي للعميل.
 * يرتبط بـ: ClientTransaction (1:N), CashReceipt (1:N).
 */
export interface Client {
  id: string;                   // المعرف الفريد من Firebase
  fileId: string;               // رقم الملف (مثال: 1/2024)
  nameAr: string;               // الاسم بالعربية (أساس البحث)
  nameEn?: string;              // الاسم بالإنجليزية
  mobile: string;               // رقم الجوال (فريد لمنع التكرار)
  civilId?: string;             // الرقم المدني (للتحقق والعقود)
  address?: {                   // العنوان التفصيلي
    governorate: string;
    area: string;
    block: string;
    street: string;
    houseNumber: string;
  };
  status: 'new' | 'contracted' | 'cancelled' | 'reContracted';
  assignedEngineer?: string;    // ID الموظف المسؤول عن الملف
  transactionCounter?: number;  // عداد لتوليد أرقام المعاملات المتسلسلة
  createdAt: Timestamp;         // تاريخ إنشاء الملف
  isActive: boolean;            // حالة الملف (نشط/مجمد)
}

/**
 * المعاملة (Transaction): تمثل خدمة أو مشروع للعميل.
 * ترتبط بـ: Contract (1:1), BoqItem (1:N), TimelineEvent (1:N).
 */
export interface ClientTransaction {
    id?: string;
    transactionNumber?: string; // رقم المعاملة (مثال: CL123-TX01)
    clientId: string;           // ربط بالعميل
    transactionType: string;    // نوع الخدمة (تصميم، إشراف...)
    assignedEngineerId?: string;// المهندس المسؤول عن التنفيذ
    status: string;             // حالة المعاملة (جديدة، قيد التنفيذ، منتهية)
    contract?: {                // بيانات العقد المالي المرتبط
        totalAmount: number;
        financialsType: 'fixed' | 'percentage';
        clauses: ContractClause[];
        scopeOfWork?: ContractScopeItem[];
        termsAndConditions?: ContractTerm[];
        openClauses?: ContractTerm[];
    };
    stages?: TransactionStage[]; // مراحل العمل الفنية (WBS)
    boqId?: string;             // ربط بجدول الكميات
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

/**
 * القيد المحاسبي (Journal Entry): العمود الفقري للمالية.
 * يضمن توازن الدفاتر المحاسبية.
 */
export interface JournalEntry { 
    id?: string; 
    entryNumber: string;        // رقم القيد (JV-2024-0001)
    date: Timestamp;            // تاريخ القيد المحاسبي
    narration: string;          // بيان القيد (شرح العملية)
    totalDebit: number;         // إجمالي المدين (يجب أن يساوي الدائن)
    totalCredit: number;        // إجمالي الدائن
    status: 'draft' | 'posted'; // حالة القيد (مسودة/مرحل)
    lines: JournalEntryLine[];  // أسطر القيد التفصيلية
    transactionId?: string;     // ربط بمركز الربحية (المشروع)
    clientId?: string;          // ربط بالعميل (المديونية)
    linkedReceiptId?: string;   // ربط بسند قبض (في حال العمولات)
    createdAt: Timestamp;
    createdBy: string;
}

export interface JournalEntryLine {
    accountId: string;          // ID الحساب من الشجرة
    accountName: string;        // اسم الحساب وقت القيد
    debit: number;              // المبلغ المدين
    credit: number;             // المبلغ الدائن
    auto_profit_center?: string;// معرف المشروع (لتقارير الربحية)
    auto_resource_id?: string;  // معرف المهندس (لتقارير الإنتاجية)
    auto_dept_id?: string;      // معرف القسم (للتحليل القطاعي)
}

/**
 * الموظف (Employee): لإدارة الموارد البشرية والرواتب.
 */
export interface Employee {
    id?: string;
    employeeNumber: string;     // الرقم الوظيفي
    fullName: string;           // الاسم الكامل بالعربية
    basicSalary: number;        // الراتب الأساسي
    housingAllowance?: number;  // بدل السكن
    transportAllowance?: number;// بدل المواصلات
    contractType: 'permanent' | 'temporary' | 'piece-rate' | 'percentage';
    status: 'active' | 'terminated' | 'on-leave';
    hireDate: Timestamp;        // تاريخ التعيين (أساس مكافأة نهاية الخدمة)
    terminationDate?: Timestamp; // تاريخ ترك العمل
    terminationReason?: 'resignation' | 'termination';
    residencyExpiry?: Timestamp; // تاريخ انتهاء الإقامة
}

export interface ContractClause {
    id: string;
    name: string;
    amount: number;
    status: 'مدفوعة' | 'مستحقة' | 'غير مستحقة';
    condition?: string;         // اسم المرحلة الفنية التي تفعل الاستحقاق
    percentage?: number;        // النسبة من إجمالي العقد (إن وجد)
}

export interface TransactionStage {
    stageId: string;            // ID المرحلة من القالب
    name: string;               // اسم المرحلة
    status: 'pending' | 'in-progress' | 'completed' | 'skipped';
    startDate?: Timestamp;      // تاريخ البدء الفعلي
    endDate?: Timestamp;        // تاريخ الإنجاز الفعلي
    modificationCount?: number; // عداد التعديلات المسجلة
}

export interface ContractScopeItem { id: string; title: string; description: string; }
export interface ContractTerm { id: string; text: string; }
