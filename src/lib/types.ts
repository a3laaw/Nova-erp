
/**
 * @fileOverview القاموس البرمجي الشامل لنظام Nova ERP المطور.
 * تم تحديثه لربط الزيارات الميدانية حصرياً بالمشاريع الإنشائية ودعم الفرق الديناميكية.
 */

import { Timestamp } from 'firebase/firestore';

/**
 * الكيان الأساسي (BaseEntity): يضمن وجود معرف الشركة في كل مستند.
 */
export interface BaseEntity {
  id?: string;
  companyId: string;           
  createdAt: Timestamp | any;
  createdBy: string;
  updatedAt?: Timestamp | any;
}

/**
 * العميل (Client): يمثل الملف الرئيسي للعميل.
 */
export interface Client extends BaseEntity {
  fileId: string;               
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
  status: 'new' | 'contracted' | 'cancelled' | 'reContracted';
  assignedEngineer?: string;    
  transactionCounter?: number;  
  isActive: boolean;            
}

/**
 * المعاملة (Transaction): تمثل خدمة أو مشروع للعميل.
 */
export interface ClientTransaction extends BaseEntity {
    transactionNumber?: string; 
    clientId: string;           
    transactionType: string;    
    assignedEngineerId?: string;
    departmentId?: string;
    transactionTypeId?: string;
    status: string;             
    contract?: {                
        totalAmount: number;
        financialsType: 'fixed' | 'percentage';
        clauses: ContractClause[];
        scopeOfWork?: ContractScopeItem[];
        termsAndConditions?: ContractTerm[];
        openClauses?: ContractTerm[];
    };
    stages?: TransactionStage[]; 
    boqId?: string;             
}

/**
 * مشروع مقاولات (ConstructionProject): يمثل الموقع التنفيذي الفعلي.
 */
export interface ConstructionProject extends BaseEntity {
    projectId: string;          
    projectName: string;
    clientId: string;
    clientName?: string;
    projectType: 'استشاري' | 'تنفيذي' | 'مختلط';
    contractValue: number;
    startDate: Timestamp | any;
    endDate: Timestamp | any;
    status: 'مخطط' | 'قيد التنفيذ' | 'مكتمل' | 'معلق' | 'ملغى';
    mainEngineerId: string;
    mainEngineerName?: string;
    progressPercentage: number;
    boqId?: string;             
    linkedTransactionId?: string; 
    constructionTypeId?: string; // ربط بنوع المقاولات (هيكل أسود، صحي، الخ)
    subcontractorId?: string;    // في حال كان مسنداً لمقاول باطن
    subcontractorName?: string;
}

/**
 * القيد المحاسبي (Journal Entry).
 */
export interface JournalEntry extends BaseEntity { 
    entryNumber: string;        
    date: Timestamp | any;            
    narration: string;          
    totalDebit: number;         
    totalCredit: number;        
    status: 'draft' | 'posted'; 
    lines: JournalEntryLine[];  
    transactionId?: string;     
    clientId?: string;          
    linkedReceiptId?: string;   
    reconciliationStatus?: 'unreconciled' | 'reconciled';
    reconciliationInfo?: any;
    isBypassed?: boolean;
}

export interface JournalEntryLine {
    accountId: string;          
    accountName: string;        
    debit: number;              
    credit: number;             
    auto_profit_center?: string;
    auto_resource_id?: string;  
    auto_dept_id?: string;      
}

/**
 * الموظف (Employee).
 */
export interface Employee extends BaseEntity {
    employeeNumber: string;     
    fullName: string;           
    nameEn?: string;
    civilId: string;
    mobile: string;
    basicSalary: number;        
    housingAllowance?: number;  
    transportAllowance?: number;
    contractType: string;
    status: 'active' | 'terminated' | 'on-leave';
    hireDate: Timestamp | any;        
    terminationDate?: Timestamp | any; 
    terminationReason?: 'resignation' | 'termination';
    residencyExpiry?: Timestamp | any; 
    department?: string;
    jobTitle?: string;
    profilePicture?: string;
    contractPercentage?: number;
    annualLeaveUsed?: number;
    annualLeaveAccrued?: number;
    carriedLeaveDays?: number;
    sickLeaveUsed?: number;
    emergencyLeaveUsed?: number;
    workStartTime?: string;
    workEndTime?: string;
    teamId?: string; // الفريق الحالي للموظف
    pieceRateMode?: 'salary_with_target' | 'per_piece';
    targetDescription?: number;
    pieceRate?: number;
    dailyRate?: number;
}

export interface ContractClause {
    id: string;
    name: string;
    amount: number;
    status: 'مدفوعة' | 'مستحقة' | 'غير مستحقة';
    condition?: string;         
    percentage?: number;        
}

export interface TransactionStage {
    stageId: string;            
    name: string;               
    status: 'pending' | 'in-progress' | 'completed' | 'skipped';
    startDate?: Timestamp | any;      
    endDate?: Timestamp | any;        
    modificationCount?: number; 
}

export interface ContractScopeItem { id: string; title: string; description: string; }
export interface ContractTerm { id: string; text: string; }

/**
 * المستخدم (UserProfile).
 */
export interface UserProfile {
  id?: string;
  uid: string;
  username: string;
  email: string;
  role: 'Admin' | 'Engineer' | 'Accountant' | 'Secretary' | 'HR';
  employeeId: string;
  companyId: string;            
  isActive: boolean;
  createdAt: Timestamp | any;
  activatedAt?: Timestamp | any;
  createdBy: string;
  fullName?: string;
  avatarUrl?: string;
  jobTitle?: string;
}

/**
 * الزيارات الميدانية المحدثة (Field Visits - Construction Only).
 * تدعم الفرق الديناميكية وتعدد القوالب التنفيذية.
 */
export interface FieldVisit extends BaseEntity { 
    projectId: string;          
    projectName: string;
    clientId: string;
    clientName: string; 
    clientAddress?: string;     
    contractNumber?: string;    
    transactionId: string;
    transactionType: string; 
    scheduledDate: Timestamp | any; 
    status: string; 
    plannedStageId: string;     
    plannedStageName: string;   
    engineerId?: string | null;
    engineerName?: string | null; 
    details?: string;           
    requiredPayment?: string;   
    lastPayment?: string;       
    teamIds: string[];          // معرفات الفرق المختارة (ديناميكي)
    teamNames: string[];        // أسماء الفرق (Snapshot للتاريخ)
    subcontractorId?: string;
    subcontractorName?: string; 
    layoutType?: string;        // نوع التصميم (هيكل أسود، صحي، كهرباء)
    confirmationData?: {
        confirmedAt: Timestamp | any;
        notes: string;
        location?: { latitude: number, longitude: number, accuracy: number };
        isCompleted: boolean;
    };
    workStageUpdated?: boolean;
}

export interface WorkTeam extends BaseEntity {
    name: string;
    leaderId?: string;
    leaderName?: string;
    memberCount: number;
}

export interface Warehouse extends BaseEntity { name: string; location?: string; isDefault?: boolean; projectId?: string | null; companyId?: string | null; }
export interface Item extends BaseEntity { name: string; sku: string; categoryId: string; unitOfMeasure: string; costPrice?: number; sellingPrice?: number; inventoryTracked?: boolean; expiryTracked?: boolean; reorderLevel?: number; warrantyYears?: number; }
export interface RequestForQuotation extends BaseEntity { rfqNumber: string; date: Timestamp | any; status: 'draft' | 'sent' | 'closed' | 'cancelled'; vendorIds: string[]; prospectiveVendors?: any[]; items: any[]; awardedVendorId?: string; awardedPoIds?: string[]; awardedItems?: Record<string, string>; isBypassed?: boolean; }
export interface PurchaseOrder extends BaseEntity { poNumber: string; orderDate: Timestamp | any; vendorId: string; vendorName: string; totalAmount: number; status: 'draft' | 'approved' | 'received' | 'partially_received' | 'cancelled'; items: any[]; rfqId?: string; supplierQuotationId?: string; discountAmount?: number; deliveryFees?: number; paymentTerms?: string; notes?: string; type?: 'standard' | 'direct_invoice'; isBypassed?: boolean; }
export interface PaymentApplication extends BaseEntity { applicationNumber: string; date: Timestamp | any; projectId: string; clientId: string; clientName: string; projectName: string; totalAmount: number; status: 'draft' | 'submitted' | 'approved' | 'paid' | 'cancelled'; items: any[]; journalEntryId?: string; }
export interface Vendor extends BaseEntity { name: string; phone: string; contactPerson?: string; email?: string; address?: string; }
export interface Account extends BaseEntity { code: string; name: string; type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'; level: number; parentCode: string | null; isPayable: boolean; statement: 'Balance Sheet' | 'Income Statement'; balanceType: 'Debit' | 'Credit'; }
export interface Department extends BaseEntity { name: string; order?: number; activityTypes?: string[]; }
export interface Job extends BaseEntity { name: string; order?: number; }
export interface Governorate extends BaseEntity { name: string; order?: number; }
export interface Area extends BaseEntity { name: string; order?: number; governorateId: string; }
export interface TransactionType extends BaseEntity { name: string; order?: number; departmentIds?: string[]; activityType?: string; }
export interface WorkStage extends BaseEntity { name: string; order?: number; stageType: 'sequential' | 'parallel'; trackingType: 'duration' | 'occurrence' | 'none'; allowedRoles?: string[]; expectedDurationDays?: number | null; maxOccurrences?: number | null; allowManualCompletion?: boolean; enableModificationTracking?: boolean; nextStageIds?: string[]; allowedDuringStages?: string[]; }
export interface ItemCategory extends BaseEntity { name: string; order?: number; parentCategoryId: string | null; activityTypeIds?: string[]; boqReferenceItemIds?: string[]; }
export interface CompanyActivityType extends BaseEntity { name: string; }
export interface Boq extends BaseEntity { boqNumber: string; name: string; status: string; totalValue: number; itemCount: number; clientId?: string | null; transactionId?: string | null; projectId?: string | null; }
export interface BoqItem extends BaseEntity { itemNumber: string; description: string; quantity: number; sellingUnitPrice: number; level: number; isHeader: boolean; parentId: string | null; startDate?: Timestamp | any; endDate?: Timestamp | any; itemId?: string; notes?: string; }
export interface BoqReferenceItem extends BaseEntity { name: string; unit?: string; isHeader?: boolean; parentBoqReferenceItemId?: string | null; subcontractorTypeIds?: string[]; activityTypeIds?: string[]; transactionTypeIds?: string[]; }
export interface Subcontractor extends BaseEntity { name: string; type: string; specialization?: string; phone: string; mobile?: string; email?: string; address?: string; bankAccount?: any; isActive: boolean; blacklisted?: boolean; blacklistedReason?: string; performanceRating?: number; }
export interface SubcontractorCertificate extends BaseEntity { certificateNumber: string; date: Timestamp | any; subcontractorId: string; subcontractorName: string; projectId: string; projectName?: string; amount: number; status: 'draft' | 'approved' | 'cancelled'; description: string; journalEntryId?: string; }
export interface Payslip extends BaseEntity { employeeId: string; employeeName: string; month: number; year: number; netSalary: number; status: 'draft' | 'processed' | 'paid'; type: 'Monthly' | 'Leave'; earnings: any; deductions: any; notes?: string; leaveRequestId?: string; salaryPaymentType?: string; }
export interface MonthlyAttendance extends BaseEntity { employeeId: string; month: number; year: number; records: any[]; summary: any; }
export interface Notification extends BaseEntity { userId: string; title: string; body: string; link?: string; isRead: boolean; }
export interface AuditLog extends BaseEntity { changeType: 'SalaryChange' | 'JobChange' | 'DataUpdate' | 'ResidencyUpdate' | 'TeamChange'; field: string; oldValue: any; newValue: any; effectiveDate: Timestamp | any; changedBy: string; notes?: string; }
export interface LetterOfCredit extends BaseEntity { lcNumber: string; issuingBank: string; vendorId: string; vendorName: string; amount: number; currency: string; expiryDate: Timestamp | any; status: string; notes?: string; }
export interface InventoryAdjustment extends BaseEntity { adjustmentNumber: string; date: Timestamp | any; type: 'damage' | 'theft' | 'opening_balance' | 'purchase_return' | 'sales_return' | 'transfer' | 'material_issue'; warehouseId?: string; fromWarehouseId?: string; toWarehouseId?: string; items: any[]; journalEntryId?: string; notes?: string; projectId?: string | null; projectName?: string | null; clientId?: string | null; clientName?: string | null; vendorId?: string | null; issueType?: 'project_site' | 'direct_sale'; isDirectReturn?: boolean; isBypassed?: boolean; }
export interface Holiday extends BaseEntity { name: string; date: Timestamp | any; }
export interface SubcontractorType extends BaseEntity { name: string; }
export interface SubcontractorSpecialization extends BaseEntity { name: string; subcontractorTypeId: string; }
export interface ContractTemplate extends BaseEntity { title: string; description?: string; templateType: 'Consulting' | 'Execution'; constructionTypeId?: string | null; transactionTypes?: string[]; scopeOfWork?: ContractScopeItem[]; termsAndConditions?: ContractTerm[]; openClauses?: ContractTerm[]; financials?: { type: 'fixed' | 'percentage'; totalAmount: number; discount: number; milestones: ContractFinancialMilestone[]; }; }
export interface ContractFinancialMilestone { id: string; name: string; condition: string; value: number; }
export interface ConstructionType extends BaseEntity { name: string; }
export interface ConstructionWorkStage extends BaseEntity { name: string; order: number; parentId: string | null; level: number; }
export interface DailySiteReport extends BaseEntity { projectId: string; date: Timestamp | any; engineerId: string; engineerName: string; workCompleted: string; workersCount: number; encounteredIssues?: string; weatherStatus?: string; photoUrls: string[]; }
export interface Company extends BaseEntity { name: string; nameEn?: string; phone?: string; email?: string; address?: string; crNumber?: string; activityType?: string; parentCompanyId?: string; }
export interface PaymentMethod { id: string; name: string; type: 'fixed' | 'percentage'; value: number; expenseAccountId: string; expenseAccountName: string; }
