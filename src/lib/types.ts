/**
 * @fileOverview القاموس البرمجي لنظام Nova ERP.
 * يحتوي على كافة الواجهات (Interfaces) التي تحدد شكل البيانات في Firestore.
 */

import { Timestamp } from 'firebase/firestore';

/**
 * العميل: يمثل ملف العميل الرئيسي.
 * العلاقات: 1:N مع ClientTransaction.
 * استخدامات: صفحة العملاء، العقود، السندات المالية.
 */
export interface Client {
  id: string;                   // المعرف الفريد من Firebase
  fileId: string;               // رقم الملف الرسمي (1/2024)
  nameAr: string;               // الاسم بالعربي - أساس البحث
  nameEn?: string;              // الاسم بالإنجليزي
  mobile: string;               // رقم الجوال - فريد
  civilId?: string;             // الرقم المدني
  address?: {
    governorate: string;
    area: string;
    block: string;
    street: string;
    houseNumber: string;
  };
  status: 'new' | 'contracted' | 'cancelled' | 'reContracted';
  assignedEngineer?: string;    // ID الموظف المسؤول
  transactionCounter?: number;  // لتوليد أرقام المعاملات
  createdAt: Timestamp;
  isActive: boolean;
}

/**
 * المعاملة: تمثل خدمة هندسية معينة للعميل.
 * العلاقات: 1:1 مع العقد (Contract).
 */
export interface ClientTransaction {
    id?: string;
    transactionNumber?: string; // CL1-TX01
    clientId: string;
    transactionType: string;    // نوع الخدمة (صحي، كهرباء...)
    transactionTypeId?: string;
    departmentId?: string;
    assignedEngineerId?: string;
    status: string;             // جديدة، قيد التنفيذ، منتهية
    contract?: {
        totalAmount: number;
        financialsType: 'fixed' | 'percentage';
        clauses: ContractClause[];
        scopeOfWork?: any[];
        termsAndConditions?: any[];
        openClauses?: any[];
    };
    stages?: TransactionStage[]; // مراحل العمل الفنية
    boqId?: string;             // ربط بجدول الكميات
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

/**
 * القيد المحاسبي: العمود الفقري للمحاسبة.
 * يضمن توازن المدين والدائن.
 */
export interface JournalEntry { 
    id?: string; 
    entryNumber: string;        // JV-2024-001
    date: Timestamp;
    narration: string;          // بيان القيد
    totalDebit: number;
    totalCredit: number;
    status: 'draft' | 'posted';
    lines: JournalEntryLine[];  // أسطر القيد
    transactionId?: string;     // ربط بمركز الربحية (المشروع)
    clientId?: string;          // ربط بالعميل (المديونية)
    createdAt: Timestamp;
    createdBy: string;
}

export interface JournalEntryLine {
    accountId: string;
    accountName: string;
    debit: number;
    credit: number;
    auto_profit_center?: string; // معرف المشروع للتقارير
    auto_resource_id?: string;  // معرف المهندس للإنتاجية
}

/**
 * الموظف: لادارة الموارد البشرية والرواتب.
 */
export interface Employee {
    id?: string;
    employeeNumber: string;
    fullName: string;
    basicSalary: number;
    status: 'active' | 'terminated' | 'on-leave';
    hireDate: Timestamp;        // أساس حساب مكافأة نهاية الخدمة
    contractType: 'permanent' | 'temporary' | 'piece-rate' | 'percentage';
}

export interface ContractClause {
    id: string;
    name: string;
    amount: number;
    status: 'مدفوعة' | 'مستحقة' | 'غير مستحقة';
    condition?: string;         // المرحلة التي تفعل الدفعة
}

export interface TransactionStage {
    stageId: string;
    name: string;
    status: 'pending' | 'in-progress' | 'completed';
    startDate?: Timestamp;
    endDate?: Timestamp;
}
