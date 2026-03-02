
/**
 * @fileOverview القاموس البرمجي الشامل لنظام Nova ERP المطور.
 * تم تحديثه ليشمل ميزة دعم مواد البناء (السكن الخاص الكويتي).
 */

import { Timestamp } from 'firebase/firestore';

export interface BaseEntity {
  id?: string;
  companyId?: string;           
  createdAt: Timestamp | any;
  createdBy: string;
  updatedAt?: Timestamp | any;
}

export type ProjectCategory = 'Private (Subsidized)' | 'Private (Non-Subsidized)' | 'Commercial' | 'Government';

export interface SubsidyQuota {
    itemId: string;
    itemName: string;
    allocatedQuantity: number;
    receivedQuantity: number;
    consumedQuantity: number;
    unitPrice: number; // سعر السوق للتقييم المحاسبي
}

export interface ConstructionProject extends BaseEntity {
    projectId: string;          
    projectName: string;
    clientId: string;
    clientName?: string;
    projectType: 'استشاري' | 'تنفيذي' | 'مختلط';
    projectCategory: ProjectCategory;
    contractValue: number;
    startDate: Timestamp | any;
    endDate: Timestamp | any;
    status: 'مخطط' | 'قيد التنفيذ' | 'مكتمل' | 'معلق' | 'ملغى';
    mainEngineerId: string;
    mainEngineerName?: string;
    progressPercentage: number;
    boqId?: string;             
    linkedTransactionId?: string; 
    constructionTypeName?: string;
    subcontractorId?: string;    
    subcontractorName?: string;
    numFloors?: string; 
    // ميزات الدعم
    subsidyQuotas?: SubsidyQuota[];
}

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
    isSubsidyEntry?: boolean; // وسم القيود الخاصة بالدعم
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
}

export interface FieldVisit extends BaseEntity { 
    projectId: string;          
    projectName: string;
    clientId: string;
    clientName: string; 
    scheduledDate: Timestamp | any; 
    status: 'planned' | 'confirmed' | 'cancelled'; 
    plannedStageId: string;     
    plannedStageName: string;   
    phaseEndDate?: Timestamp | any; 
    numFloors?: string;         
    engineerId?: string | null;
    engineerName?: string | null; 
    details?: string;           
    requiredPayment?: string;   
    teamIds: string[];          
    teamNames: string[];        
    confirmationData?: {
        confirmedAt: Timestamp | any;
        notes: string;
        location?: { latitude: number, longitude: number, accuracy: number };
        isCompleted: boolean;
        progressAchieved: number; 
    };
}

export interface PaymentApplication extends BaseEntity { 
    applicationNumber: string; 
    date: Timestamp | any; 
    projectId: string; 
    clientId: string; 
    clientName: string; 
    projectName: string; 
    totalAmount: number; 
    subsidizedMaterialsValue: number; // قيمة المواد المدعومة المخصومة
    netDueAmount: number; // الصافي المستحق للشركة
    status: 'draft' | 'submitted' | 'approved' | 'paid' | 'cancelled'; 
    items: any[]; 
    journalEntryId?: string; 
}

export interface Warehouse extends BaseEntity { name: string; location?: string; isDefault?: boolean; projectId?: string | null; companyId?: string | null; }
export interface Item extends BaseEntity { name: string; sku: string; categoryId: string; unitOfMeasure: string; costPrice?: number; sellingPrice?: number; inventoryTracked?: boolean; isSubsidyEligible?: boolean; warrantyYears?: number; }
export interface RequestForQuotation extends BaseEntity { rfqNumber: string; date: Timestamp | any; status: 'draft' | 'sent' | 'closed' | 'cancelled'; vendorIds: string[]; items: any[]; awardedVendorId?: string; awardedPoIds?: string[]; awardedItems?: Record<string, string>; isBypassed?: boolean; prospectiveVendors?: {id: string, name: string}[]; }
export interface PurchaseOrder extends BaseEntity { poNumber: string; orderDate: Timestamp | any; vendorId: string; vendorName: string; totalAmount: number; discountAmount?: number; deliveryFees?: number; status: 'draft' | 'approved' | 'received' | 'partially_received' | 'cancelled'; items: any[]; rfqId?: string; supplierQuotationId?: string; type?: 'standard' | 'direct_invoice'; isBypassed?: boolean; projectId?: string | null; paymentTerms?: string; notes?: string; }
export interface Vendor extends BaseEntity { name: string; phone: string; contactPerson?: string; address?: string; email?: string; }
export interface Account extends BaseEntity { code: string; name: string; type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'; level: number; parentCode: string | null; isPayable: boolean; statement: 'Balance Sheet' | 'Income Statement'; balanceType: 'Debit' | 'Credit'; }
export interface Department extends BaseEntity { name: string; order?: number; activityTypes?: string[]; }
export interface Job extends BaseEntity { name: string; order?: number; }
export interface TransactionType extends BaseEntity { name: string; order?: number; departmentIds?: string[]; activityType?: string; }
export interface WorkStage extends BaseEntity { name: string; order?: number; stageType: 'sequential' | 'parallel'; trackingType: 'duration' | 'occurrence' | 'none'; allowedRoles?: string[]; expectedDurationDays?: number | null; maxOccurrences?: number | null; allowManualCompletion?: boolean; enableModificationTracking?: boolean; nextStageIds?: string[]; allowedDuringStages?: string[]; }
export interface ItemCategory extends BaseEntity { name: string; order?: number; parentCategoryId: string | null; activityTypeIds?: string[]; boqReferenceItemIds?: string[]; }
export interface Boq extends BaseEntity { boqNumber: string; name: string; status: 'تقديري' | 'تعاقدي' | 'منفذ'; totalValue: number; itemCount: number; clientId?: string | null; transactionId?: string | null; projectId?: string | null; updatedAt?: any; }
export interface BoqItem extends BaseEntity { itemNumber: string; description: string; quantity: number; sellingUnitPrice: number; level: number; isHeader: boolean; parentId: string | null; startDate?: Timestamp | any; endDate?: Timestamp | any; itemId?: string; notes?: string; progressPercentage?: number; }
export interface Notification extends BaseEntity { userId: string; title: string; body: string; link?: string; isRead: boolean; }
export interface UserProfile { id?: string; uid: string; username: string; email: string; role: 'Admin' | 'Engineer' | 'Accountant' | 'Secretary' | 'HR'; employeeId: string; companyId: string; isActive: boolean; createdAt: Timestamp | any; activatedAt?: any; fullName?: string; avatarUrl?: string; jobTitle?: string; passwordHash: string; }
export interface Company extends BaseEntity { name: string; nameEn?: string; crNumber?: string; phone?: string; email?: string; address?: string; activityType?: string; parentCompanyId?: string; }
export interface RecurringObligation extends BaseEntity { title: string; type: 'rent' | 'installment' | 'vendor_debt' | 'daily_labor'; amount: number; frequency: 'weekly' | 'monthly'; dueDate: any; lastGeneratedDate?: any; status: 'active' | 'paused'; debitAccountId: string; debitAccountName: string; creditAccountId: string; creditAccountName: string; }
export interface MonthlyAttendance extends BaseEntity { employeeId: string; year: number; month: number; records: any[]; summary: { presentDays: number; absentDays: number; lateDays: number; leaveDays: number; totalDays: number; }; }
export interface Payslip extends BaseEntity { employeeId: string; employeeName: string; year: number; month: number; type: 'Monthly' | 'Leave'; earnings: { basicSalary: number; housingAllowance: number; transportAllowance: number; commission: number; }; deductions: { absenceDeduction: number; otherDeductions: number; }; netSalary: number; status: 'draft' | 'paid'; notes?: string; paidAt?: any; attendanceId?: string; leaveRequestId?: string; salaryPaymentType?: string; }
export interface LeaveRequest extends BaseEntity { employeeId: string; employeeName: string; leaveType: 'Annual' | 'Sick' | 'Emergency' | 'Unpaid'; startDate: any; endDate: any; days: number; workingDays: number; status: 'pending' | 'approved' | 'rejected'; notes?: string; rejectionReason?: string | null; isSalaryPaid?: boolean; passportReceived?: boolean; approvedBy?: string; approvedAt?: any; }
export interface PermissionRequest extends BaseEntity { employeeId: string; employeeName: string; type: 'late_arrival' | 'early_departure'; date: any; reason: string; status: 'pending' | 'approved' | 'rejected'; approvedBy?: string; approvedAt?: any; }
export interface Holiday extends BaseEntity { name: string; date: any; type: 'public' | 'company'; }
export interface BoqReferenceItem extends BaseEntity { name: string; unit?: string; isHeader?: boolean; parentBoqReferenceItemId?: string | null; }
export interface Subcontractor extends BaseEntity { name: string; type: string; specialization?: string; contactPerson?: string; phone?: string; mobile?: string; email?: string; address?: string; bankAccount?: { bankName: string; accountNumber: string; iban: string; }; isActive: boolean; blacklisted: boolean; blacklistedReason?: string; performanceRating?: number; }
export interface SubcontractorType extends BaseEntity { name: string; order?: number; }
export interface SubcontractorSpecialization extends BaseEntity { name: string; order?: number; }
export interface SubcontractorCertificate extends BaseEntity { certificateNumber: string; date: any; subcontractorId: string; subcontractorName: string; projectId: string; projectName: string; amount: number; description: string; status: 'draft' | 'approved' | 'cancelled'; journalEntryId?: string; }
export interface WorkTeam extends BaseEntity { name: string; leaderId?: string; leaderName?: string; }
export interface InventoryAdjustment extends BaseEntity { adjustmentNumber: string; date: any; type: 'damage' | 'theft' | 'opening_balance' | 'transfer' | 'material_issue' | 'purchase_return' | 'sales_return' | 'other'; warehouseId?: string; fromWarehouseId?: string; toWarehouseId?: string; notes?: string; items: any[]; journalEntryId?: string; projectId?: string | null; projectName?: string | null; clientId?: string | null; clientName?: string | null; issueType?: 'project_site' | 'direct_sale'; recoveredDiscount?: number; isDirectReturn?: boolean; isBypassed?: boolean; }
export interface GoodsReceiptNote extends BaseEntity { grnNumber: string; purchaseOrderId: string; vendorId: string; vendorName: string; warehouseId: string; date: any; itemsReceived: any[]; totalValue: number; discountAmount: number; deliveryFees: number; journalEntryId: string; projectId?: string | null; isBypassed?: boolean; }
export interface ConstructionWorkStage extends BaseEntity { name: string; order: number; parentId: string | null; }
export interface ConstructionType extends BaseEntity { name: string; }
export interface AuditLog extends BaseEntity { changeType: 'SalaryChange' | 'JobChange' | 'StatusChange' | 'ResidencyUpdate' | 'DataUpdate'; field: string; oldValue: any; newValue: any; effectiveDate: any; changedBy: string; notes?: string; }
