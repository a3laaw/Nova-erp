/**
 * @fileOverview تعريف كافة الأنماط (Interfaces) والكيانات في النظام.
 * هذا الملف هو المرجع الأساسي لهيكل البيانات في Firestore.
 */

export interface FieldVisit {
  id?: string;
  clientId: string;
  clientName: string;
  transactionId: string;
  transactionType: string;
  engineerId: string;
  engineerName: string;
  scheduledDate: any; // Firestore Timestamp
  plannedStageId: string;
  plannedStageName: string;
  status: 'planned' | 'confirmed' | 'cancelled';
  confirmationData?: {
    confirmedAt: any;
    notes: string;
    location?: {
      latitude: number;
      longitude: number;
      accuracy: number;
    };
    isCompleted: boolean;
  };
  createdAt: any;
}

export interface BoqItem {
  id?: string;
  itemId?: string; // المرجع للصنف في دليل المواد
  itemNumber: string; // الترقيم الشجري (1.1, 1.1.1)
  description: string;
  unit: string;
  quantity: number;
  sellingUnitPrice: number; // السعر للعميل
  costUnitPrice?: number; // التكلفة الفعلية (من المشتريات)
  isHeader: boolean; // هل هو عنوان قسم أم بند عمل
  parentId: string | null;
  level: number;
  notes?: string;
  margin?: number;
  executedQuantity?: number;
  actualCost?: number;
  deviation?: number;
  startDate?: any;
  endDate?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface InventoryAdjustment {
    id?: string;
    adjustmentNumber: string;
    date: any;
    type: 'opening_balance' | 'damage' | 'theft' | 'material_issue' | 'purchase_return' | 'sales_return' | 'transfer' | 'other';
    issueType?: 'project_site' | 'direct_sale';
    journalEntryId?: string;
    items: any[];
    projectId?: string;
    projectName?: string;
    clientId?: string;
    clientName?: string;
    warehouseId?: string;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    notes?: string;
    createdAt?: any;
    createdBy?: string;
}

export interface ConstructionProject {
  id?: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName?: string;
  projectType: 'استشاري' | 'تنفيذي' | 'مختلط';
  constructionTypeId?: string; // المرجع لنوع المقاولات (هيكل أسود، إلخ)
  constructionTypeName?: string;
  contractValue: number;
  startDate: any; 
  endDate: any;
  status: 'مخطط' | 'قيد التنفيذ' | 'مكتمل' | 'معلق' | 'ملغى';
  mainEngineerId: string;
  mainEngineerName?: string;
  progressPercentage: number;
  boqId?: string; 
  createdAt?: any;
  createdBy?: string;
}

export type UserRole = 'Admin' | 'Engineer' | 'Accountant' | 'Secretary' | 'HR';

export interface UserProfile {
  id?: string;
  uid?: string; 
  username: string;
  email: string;
  passwordHash: string;
  employeeId: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: any; 
  activatedAt?: any;
  createdBy?: string;
  avatarUrl?: string;
  fullName?:string;
  jobTitle?: string;
}

export interface Client {
  id: string;
  nameAr: string;
  nameEn?: string;
  mobile: string;
  civilId?: string;
  address?: {
    governorate: string;
    area: string;
    block: string;
    street: string;
    houseNumber: string;
  };
  fileId: string; // الترقيم الرسمي (sequence/year)
  fileNumber: number;
  fileYear: number;
  status: 'new' | 'contracted' | 'cancelled' | 'reContracted';
  assignedEngineer?: string;
  createdAt: any;
  isActive: boolean;
  transactionCounter?: number;
}

export interface ClientTransaction {
    id?: string;
    transactionNumber?: string;
    clientId: string;
    transactionType: string;
    departmentId?: string;
    assignedEngineerId?: string;
    status: 'new' | 'in-progress' | 'completed' | 'submitted' | 'on-hold';
    createdAt: any;
    updatedAt?: any;
    boqId?: string; 
    boqItemCount?: number;
    boqTotalValue?: number;
    contract?: {
        clauses: any[];
        totalAmount: number;
        financialsType?: 'fixed' | 'percentage';
        scopeOfWork?: any[];
        termsAndConditions?: any[];
        openClauses?: any[];
    };
    stages?: any[];
}

export interface Account {
    id?: string;
    code: string; // كود الحساب المحاسبي (مثال: 110101)
    name: string;
    type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    statement: 'Balance Sheet' | 'Income Statement';
    balanceType: 'Debit' | 'Credit';
    level: number;
    parentCode: string | null;
    isPayable?: boolean;
}

export interface JournalEntry { 
    id?: string; 
    entryNumber: string; 
    date: any; 
    narration: string; 
    totalDebit: number; 
    totalCredit: number; 
    status: string; // draft | posted
    lines: JournalEntryLine[]; 
    createdAt: any; 
    transactionId?: string; 
    clientId?: string; 
}

export interface JournalEntryLine {
    accountId: string;
    accountName: string;
    debit: number;
    credit: number;
    notes?: string;
    auto_profit_center?: string; // لربط المصروف بالمشروع
    auto_resource_id?: string;   // لربط المصروف بالمهندس
    auto_dept_id?: string;       // لربط المصروف بالقسم
}

export interface ContractTemplate {
    id?: string;
    title: string;
    description?: string;
    templateType?: 'Consulting' | 'Execution';
    constructionTypeId?: string;
    transactionTypes?: string[];
    scopeOfWork?: ContractScopeItem[];
    termsAndConditions?: ContractTerm[];
    financials?: {
        type: 'fixed' | 'percentage';
        totalAmount: number;
        discount: number;
        milestones: ContractFinancialMilestone[];
    };
    openClauses?: ContractTerm[];
    createdAt: any;
    createdBy: string;
}

export interface ContractFinancialMilestone {
    id: string;
    name: string;
    condition: string; // المرحلة التي يجب إنجازها لاستحقاق الدفعة
    value: number; // مبلغ أو نسبة
}

export interface ContractTerm { id: string; text: string; }
export interface ContractScopeItem { id: string; title: string; description: string; }

export interface Vendor { id?: string; name: string; contactPerson?: string; phone?: string; email?: string; address?: string; createdAt?: any; }

export interface PurchaseOrder {
    id?: string;
    poNumber: string;
    orderDate: any;
    vendorId: string;
    vendorName: string;
    projectId?: string;
    rfqId?: string;
    items: any[];
    totalAmount: number;
    status: string; // draft | approved | received
    createdAt: any;
}

export interface Employee {
    id?: string;
    employeeNumber: string;
    fullName: string;
    mobile: string;
    civilId: string;
    department: string;
    jobTitle: string;
    basicSalary: number;
    housingAllowance?: number;
    transportAllowance?: number;
    status: 'active' | 'on-leave' | 'terminated';
    hireDate: any;
    terminationDate?: any;
    terminationReason?: 'resignation' | 'termination';
    contractType: 'permanent' | 'temporary' | 'piece-rate' | 'percentage' | 'part-time' | 'special' | 'day_laborer';
    annualLeaveUsed?: number;
    carriedLeaveDays?: number;
    annualLeaveAccrued?: number;
}
