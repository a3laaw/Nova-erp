/**
 * @fileOverview القاموس البرمجي الشامل لنظام Nova ERP المطور.
 * تم تحديثه لدعم نظام تعدد الشركات (Multi-Tenancy).
 */

import { Timestamp } from 'firebase/firestore';

/**
 * الكيان الأساسي (BaseEntity): يضمن وجود معرف الشركة في كل مستند.
 */
export interface BaseEntity {
  id?: string;
  companyId: string;           // المعرف الفريد للشركة المالكة للبيان
  createdAt: Timestamp | any;
  createdBy: string;
  updatedAt?: Timestamp | any;
}

/**
 * العميل (Client): يمثل الملف الرئيسي للعميل.
 */
export interface Client extends BaseEntity {
  fileId: string;               // رقم الملف (مثال: 1/2024)
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
  companyId: string;            // الشركة التي ينتمي إليها المستخدم
  isActive: boolean;
  createdAt: Timestamp | any;
  activatedAt?: Timestamp | any;
  createdBy: string;
  fullName?: string;
  avatarUrl?: string;
  jobTitle?: string;
}

// ساير الكيانات (Warehouses, Items, etc) تتبع نفس نمط BaseEntity
export interface Warehouse extends BaseEntity { name: string; location?: string; isDefault?: boolean; projectId?: string | null; }
export interface Item extends BaseEntity { name: string; sku: string; categoryId: string; unitOfMeasure: string; costPrice?: number; sellingPrice?: number; inventoryTracked?: boolean; }
export interface RequestForQuotation extends BaseEntity { rfqNumber: string; date: Timestamp | any; status: string; vendorIds: string[]; items: any[]; }
export interface PurchaseOrder extends BaseEntity { poNumber: string; orderDate: Timestamp | any; vendorId: string; vendorName: string; totalAmount: number; status: string; items: any[]; }
export interface PaymentApplication extends BaseEntity { applicationNumber: string; date: Timestamp | any; projectId: string; totalAmount: number; status: string; items: any[]; }
export interface FieldVisit extends BaseEntity { clientName: string; transactionType: string; scheduledDate: Timestamp | any; status: string; plannedStageName: string; engineerName: string; }
export interface Vendor extends BaseEntity { name: string; phone: string; contactPerson?: string; }
export interface Account extends BaseEntity { code: string; name: string; type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'; level: number; parentCode: string | null; isPayable: boolean; statement: 'Balance Sheet' | 'Income Statement'; balanceType: 'Debit' | 'Credit'; }
export interface Department extends BaseEntity { name: string; order?: number; activityTypes?: string[]; }
export interface Job extends BaseEntity { name: string; order?: number; }
export interface Governorate extends BaseEntity { name: string; order?: number; }
export interface Area extends BaseEntity { name: string; order?: number; governorateId: string; }
export interface TransactionType extends BaseEntity { name: string; order?: number; departmentIds?: string[]; activityType?: string; }
export interface WorkStage extends BaseEntity { name: string; order?: number; stageType: 'sequential' | 'parallel'; trackingType: 'duration' | 'occurrence' | 'none'; allowedRoles?: string[]; }
export interface ItemCategory extends BaseEntity { name: string; order?: number; parentCategoryId: string | null; activityTypeIds?: string[]; boqReferenceItemIds?: string[]; }
export interface CompanyActivityType extends BaseEntity { name: string; }
export interface Boq extends BaseEntity { boqNumber: string; name: string; status: string; totalValue: number; itemCount: number; clientId?: string | null; transactionId?: string | null; }
export interface BoqItem extends BaseEntity { itemNumber: string; description: string; quantity: number; sellingUnitPrice: number; level: number; isHeader: boolean; parentId: string | null; startDate?: Timestamp | any; endDate?: Timestamp | any; }
export interface BoqReferenceItem extends BaseEntity { name: string; unit?: string; isHeader?: boolean; parentBoqReferenceItemId?: string | null; }
export interface Subcontractor extends BaseEntity { name: string; type: string; specialization?: string; phone: string; isActive: boolean; performanceRating?: number; }
export interface SubcontractorCertificate extends BaseEntity { certificateNumber: string; date: Timestamp | any; subcontractorId: string; subcontractorName: string; amount: number; status: string; description: string; journalEntryId?: string; }
export interface Payslip extends BaseEntity { employeeId: string; employeeName: string; month: number; year: number; netSalary: number; status: 'draft' | 'processed' | 'paid'; type: 'Monthly' | 'Leave'; earnings: any; deductions: any; notes?: string; }
export interface MonthlyAttendance extends BaseEntity { employeeId: string; month: number; year: number; records: any[]; summary: any; }
export interface Notification extends BaseEntity { userId: string; title: string; body: string; link?: string; isRead: boolean; }
export interface AuditLog extends BaseEntity { changeType: 'SalaryChange' | 'JobChange' | 'DataUpdate' | 'ResidencyUpdate'; field: string; oldValue: any; newValue: any; effectiveDate: Timestamp | any; changedBy: string; notes?: string; }
export interface LetterOfCredit extends BaseEntity { lcNumber: string; issuingBank: string; vendorId: string; vendorName: string; amount: number; currency: string; expiryDate: Timestamp | any; status: string; }
export interface InventoryAdjustment extends BaseEntity { adjustmentNumber: string; date: Timestamp | any; type: string; warehouseId: string; items: any[]; journalEntryId?: string; notes?: string; }
export interface Holiday extends BaseEntity { name: string; date: Timestamp | any; }
export interface SubcontractorType extends BaseEntity { name: string; }
export interface SubcontractorSpecialization extends BaseEntity { name: string; subcontractorTypeId: string; }
