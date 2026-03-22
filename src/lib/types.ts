/**
 * @fileOverview القاموس البرمجي الشامل لنظام Nova ERP المطور.
 * تم التحديث لدعم كافة الأنواع المفقودة والخصائص الناقصة بناءً على التدقيق الفني.
 */

import { Timestamp } from 'firebase/firestore';

export interface BaseEntity {
  id?: string;
  companyId?: string;           
  createdAt?: Timestamp | any; // جعلها اختيارية لدعم البيانات الافتراضية
  createdBy?: string;          // جعلها اختيارية لدعم البيانات الافتراضية
  updatedAt?: Timestamp | any;
}

export type ProjectCategory = 'Private (Subsidized)' | 'Private (Non-Subsidized)' | 'Commercial' | 'Government';
export type AreaRange = '100-199' | '200-299' | '300-400';
export type ClientStatus = 'prospective' | 'registered' | 'active' | 'completed' | 'archived' | 'new' | 'contracted' | 'cancelled' | 'reContracted';

export interface Client extends BaseEntity {
  fileId: string;
  fileNumber: number;
  fileYear: number;
  nameAr: string;
  nameEn?: string;
  civilId?: string;
  phone?: string;
  mobile: string;
  email?: string;
  address?: {
      governorate: string;
      area: string;
      block?: string;
      street?: string;
      houseNumber?: string;
  };
  status: ClientStatus;
  assignedEngineer?: string;
  assignedEngineerName?: string;
  notes?: string;
  source?: string;
  isActive?: boolean;
  transactionCounter?: number;
}

export interface Appointment extends BaseEntity {
  clientId?: string;
  clientName: string;
  clientMobile?: string;
  engineerId: string;
  engineerName?: string;
  appointmentDate: Timestamp | any;
  date?: Timestamp | any; // Alias for compatibility
  time?: string;
  duration?: number;
  type: 'architectural' | 'room' | string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  meetingRoom?: string;
  roomId?: string; // Alias
  color?: string;
  visitCount?: number;
  workStageUpdated?: boolean;
  transactionId?: string;
  department?: string;
}

export interface Boq extends BaseEntity {
  boqNumber: string;
  name: string;
  clientId?: string | null;
  clientName?: string | null;
  transactionId?: string | null;
  projectId?: string | null;
  items?: BoqItem[];
  totalValue: number;
  totalAmount?: number; // Alias
  itemCount: number;
  status: 'تقديري' | 'تعاقدي' | 'منفذ' | string;
}

export interface BoqItem {
  id?: string;
  itemId?: string;
  itemNumber: string;
  description: string;
  unit?: string;
  quantity: number;
  unitPrice?: number;
  sellingUnitPrice: number;
  totalPrice?: number;
  plannedQuantity?: number;
  plannedUnitPrice?: number;
  notes?: string;
  parentId?: string | null;
  level: number;
  isHeader: boolean;
  startDate?: Timestamp | any;
  endDate?: Timestamp | any;
}

export interface PaymentApplication extends BaseEntity {
  applicationNumber: string;
  projectId: string;
  date: Timestamp | any;
  clientId: string;
  clientName: string;
  projectName: string;
  items: {
    boqItemId: string;
    itemName?: string;
    description?: string;
    unit?: string;
    unitPrice?: number;
    currentQuantity: number;
    totalAmount: number;
    previousQuantity?: number;
    previousAmount?: number;
  }[];
  totalAmount: number;
  subsidizedMaterialsValue?: number;
  netDueAmount?: number;
  status: 'draft' | 'submitted' | 'approved' | 'paid' | 'cancelled';
  journalEntryId?: string;
}

export interface TransactionAssignment extends BaseEntity {
  transactionId: string;
  clientId: string;
  departmentId: string;
  departmentName: string;
  engineerId: string;
  engineerName?: string;
  notes?: string;
  status?: string;
}

export interface DailySiteReport extends BaseEntity {
  projectId: string;
  projectName: string;
  engineerId: string;
  engineerName: string;
  date: Timestamp | any;
  weatherStatus?: string;
  workCompleted: string;
  workersCount?: number;
  equipmentUsed?: string[];
  encounteredIssues?: string;
  photoUrls?: string[];
  status?: 'draft' | 'submitted';
}

export interface Project extends BaseEntity {
  name: string;
  clientId: string;
  clientName: string;
  status: string;
  startDate?: any;
  endDate?: any;
  disciplines?: EngineeringDiscipline[];
  timeline?: any[];
  files?: any[];
  contracts?: any[];
  reports?: any[];
}

export interface EngineeringDiscipline {
  id: string;
  name: { ar: string; en: string };
  stages: {
    id: string;
    name: { ar: string; en: string };
    status: 'Completed' | 'In Progress' | 'Pending';
  }[];
}

export interface UserProfile {
  id?: string;
  uid?: string;
  username: string;
  email: string;
  role: 'Admin' | 'HR' | 'Accountant' | 'Engineer' | 'Secretary' | 'User';
  isActive: boolean;
  employeeId?: string;
  companyId?: string;
  fullName?: string;
  jobTitle?: string;
  avatarUrl?: string;
  passwordHash?: string;
  activatedAt?: Timestamp | any;
  createdAt: Timestamp | any;
  createdBy: string;
}

export interface Job extends BaseEntity {
  name: string;
  department?: string;
  parentId?: string;
  order?: number;
}

export type SubcontractorType = {
    id?: string;
    name: string;
} | string;

export interface SubsidyQuota {
    itemId: string;
    itemName: string;
    allocatedAmount: number; 
    allocatedQuantity: number; 
    receivedQuantity: number;
    consumedQuantity: number;
    unitPrice: number; 
}

export interface TechnicalSpecifications {
    totalArea: number;
    basementType: 'none' | 'full' | 'half' | 'vault';
    floorsCount: number;
    roofExtension: 'none' | 'quarter' | 'half';
    workNature?: 'labor_only' | 'with_materials'; 
    hasBasement?: boolean;
    bathroomsCount?: number;
    kitchensCount?: number;
    laundryRoomsCount?: number;
    sanitaryMaterialsIncluded?: boolean;
    sanitaryExtensionType?: 'ordinary' | 'suspended';
    toiletType?: 'ordinary' | 'suspended';
    showerType?: 'ordinary' | 'hidden';
    suspendedExtensionCount?: number;
    ordinaryExtensionCount?: number;
    suspendedToiletCount?: number;
    ordinaryToiletCount?: number;
    hiddenShowerCount?: number;
    ordinaryShowerCount?: number;
    electricalPointsCount?: number;
    planReferenceNumber?: string;
}

export interface ConstructionProject extends BaseEntity, TechnicalSpecifications {
    projectId: string;          
    projectName: string;
    clientId: string;
    clientName?: string;
    projectCategory: ProjectCategory;
    projectType?: string;
    contractValue?: number;
    subcontractorId?: string | null;
    subcontractorName?: string | null;
    siteAddress: {
        governorate: string;
        area: string;
        block?: string;
        street?: string;
        houseNumber?: string;
    };
    startDate: Timestamp | any;
    status: 'مخطط' | 'قيد التنفيذ' | 'مكتمل' | 'معلق' | 'ملغى';
    mainEngineerId: string;
    progressPercentage: number;
    boqId?: string;             
    linkedTransactionId?: string; 
    subsidyQuotas?: SubsidyQuota[];
}

export interface ContractTemplate extends BaseEntity {
    title: string;
    description?: string;
    templateType: 'Consulting' | 'Execution';
    constructionTypeId?: string;
    transactionTypes?: string[];
    workNature: 'labor_only' | 'with_materials';
    scopeOfWork: ContractScopeItem[];
    termsAndConditions: ContractTerm[];
    financials: {
        type: 'fixed' | 'percentage';
        totalAmount: number;
        discount: number;
        milestones: ContractFinancialMilestone[];
    };
    openClauses?: ContractTerm[];
}

export interface ContractScopeItem { id: string; title: string; description: string; }
export interface ContractTerm { id: string; text: string; }
export interface ContractFinancialMilestone { id: string; name: string; value: number; condition?: string; }

export interface ContractClause {
    id: string;
    name: string;
    amount: number;
    status: 'غير مستحقة' | 'مستحقة' | 'مدفوعة';
    condition?: string; 
    percentage?: number;
}

export interface ClientTransaction extends BaseEntity {
    transactionNumber: string;
    clientId: string;
    transactionType: string;
    description?: string;
    status: 'new' | 'in-progress' | 'completed' | 'submitted' | 'on-hold' | 'cancelled';
    assignedEngineerId?: string | null;
    transactionTypeId?: string;
    departmentId?: string;
    stages?: any[];
    contract?: {
        clauses: ContractClause[];
        totalAmount: number;
        financialsType: 'fixed' | 'percentage';
        scopeOfWork?: any[];
        termsAndConditions?: any[];
        openClauses?: any[];
        specs?: TechnicalSpecifications; 
        signatureInfo?: {
            clientSignature?: string;
            signedAt?: Timestamp | any;
            signedByIP?: string;
        }
    };
    boqId?: string;
    projectId?: string;
}

export interface Employee extends BaseEntity {
    employeeNumber: string;     
    fullName: string;           
    civilId: string;
    mobile: string;
    status: 'active' | 'terminated' | 'on-leave';
    department?: string;
    jobTitle?: string;
    basicSalary: number;
    housingAllowance?: number;
    transportAllowance?: number;
    contractPercentage?: number;
    profilePicture?: string;
    hireDate: any;
    residencyExpiry?: any;
    passportExpiry?: any;
    drivingLicenseExpiry?: any;
    healthCardExpiry?: any;
    dob?: any;
    terminationDate?: any;
    terminationReason?: string;
    carriedLeaveDays?: number;
    annualLeaveAccrued?: number;
    annualLeaveUsed?: number;
    sickLeaveUsed?: number;
    emergencyLeaveUsed?: number;
    contractType?: 'permanent' | 'temporary' | 'piece-rate' | 'percentage' | 'part-time' | 'special' | 'day_laborer';
    nameEn?: string;
    gender?: 'male' | 'female';
    nationality?: string;
    salaryPaymentType?: 'cash' | 'cheque' | 'transfer';
    bankName?: string;
    accountNumber?: string;
    iban?: string;
    workStartTime?: string | null;      
    workEndTime?: string | null;        
    pieceRateMode?: 'salary_with_target' | 'per_piece';
    targetDescription?: number;
    pieceRate?: number;
    dailyRate?: number;
}

export interface CustodyReconciliation extends BaseEntity {
    reconciliationNumber: string;
    employeeId: string;
    employeeName: string;
    date: Timestamp | any;
    totalAmount: number;
    items: {
        description: string;
        amount: number;
        category?: string;
        categoryName?: string;
        projectId?: string;
        projectName?: string;
        clientId?: string;
        clientName?: string;
        attachmentUrls?: string[]; 
    }[];
    status: 'pending' | 'approved' | 'rejected';
    notes?: string;
    journalEntryId?: string;
}

export interface Warehouse extends BaseEntity { name: string; location?: string; isDefault?: boolean; projectId?: string | null; }
export interface ItemCategory extends BaseEntity { name: string; parentCategoryId: string | null; order?: number; boqReferenceItemIds?: string[]; }
export interface Item extends BaseEntity { name: string; sku: string; categoryId: string; unitOfMeasure: string; costPrice?: number; sellingPrice?: number; inventoryTracked?: boolean; isSubsidyEligible?: boolean; warrantyYears?: number; itemType?: 'product' | 'service'; description?: string; reorderLevel?: number; expiryTracked?: boolean; }
export interface Vendor extends BaseEntity { name: string; phone: string; contactPerson?: string; email?: string; address?: string; }
export interface Account extends BaseEntity { code: string; name: string; type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'; level: number; parentCode: string | null; isPayable: boolean; statement: 'Balance Sheet' | 'Income Statement'; balanceType: 'Debit' | 'Credit'; employeeId?: string | null; }
export interface Department extends BaseEntity { name: string; order?: number; activityTypes?: string[]; }
export interface Governorate extends BaseEntity { name: string; order?: number; }
export interface Area extends BaseEntity { name: string; order?: number; }
export interface TransactionType extends BaseEntity { name: string; order?: number; activityType?: string; departmentIds?: string[]; }
export interface Company extends BaseEntity { name: string; nameEn?: string; phone?: string; email?: string; crNumber?: string; parentCompanyId?: string | null; activityType?: string; address?: string; licenseExpiryDate?: any; adLicenseExpiryDate?: any; isActive?: boolean; }
export interface ConstructionType extends BaseEntity { name: string; }
export interface WorkStage extends BaseEntity { name: string; order?: number; stageType: 'sequential' | 'parallel'; trackingType: 'duration' | 'occurrence' | 'none'; expectedDurationDays?: number | null; maxOccurrences?: number | null; allowedRoles?: string[]; allowedDuringStages?: string[]; nextStageIds?: string[]; enableModificationTracking?: boolean; }
export interface Holiday extends BaseEntity { name: string; date: any; }

export interface AttendanceRecord {
    date: Timestamp | any;
    employeeId: string;
    checkIn1: string | null;
    checkOut1: string | null;
    checkIn2: string | null;
    checkOut2: string | null;
    allPunches: string[];
    status: 'present' | 'late' | 'half_day' | 'missing_punch' | 'absent';
    auditStatus?: 'pending' | 'verified' | 'waived';
    manualDeductionDays?: number; 
    anomalyDescription?: string;
}

export interface MonthlyAttendance extends BaseEntity { 
    employeeId: string; 
    year: number; 
    month: number; 
    records: AttendanceRecord[]; 
    summary: { presentDays: number; absentDays: number; lateDays: number; leaveDays: number; totalDays: number; }; 
}

export interface Payslip extends BaseEntity { 
    employeeId: string; 
    employeeName: string; 
    employeeNumber?: string;
    year: number; 
    month: number; 
    type: 'Monthly' | 'Leave'; 
    earnings: { basicSalary: number; housingAllowance: number; transportAllowance: number; commission: number; }; 
    deductions: { absenceDeduction: number; lateDeduction: number; otherDeductions: number; }; 
    netSalary: number; 
    status: 'draft' | 'processed' | 'paid'; 
    notes?: string; 
}

export interface LeaveRequest extends BaseEntity { employeeId: string; employeeName: string; leaveType: 'Annual' | 'Sick' | 'Emergency' | 'Unpaid'; startDate: any; endDate: any; days: number; workingDays: number; unpaidDays?: number; status: 'pending' | 'approved' | 'rejected' | 'on-leave' | 'returned'; passportReceived?: boolean; actualStartDate?: any; actualReturnDate?: any; }
export interface Notification extends BaseEntity { userId: string; title: string; body: string; link?: string; isRead: boolean; }
export interface RecurringObligation extends BaseEntity { title: string; type: 'rent' | 'installment' | 'vendor_debt' | 'daily_labor'; amount: number; frequency: 'weekly' | 'monthly'; dueDate: any; lastGeneratedDate?: any; debitAccountId: string; debitAccountName?: string; creditAccountId: string; creditAccountName?: string; status: 'active' | 'paused'; }
export interface FieldVisit extends BaseEntity { projectId: string; projectName: string; clientId: string; clientName: string; transactionId: string; transactionType: string; engineerId: string | null; engineerName: string; scheduledDate: any; plannedStageId: string; plannedStageName: string; phaseEndDate: any; teamIds: string[]; teamNames: string[]; subcontractorId?: string | null; subcontractorName?: string | null; status: 'planned' | 'confirmed' | 'cancelled'; details?: string; confirmationData?: { confirmedAt: any; notes: string; location: { latitude: number; longitude: number; accuracy: number; } | null; isCompleted: boolean; progressAchieved: number; }; }
export interface WorkTeam extends BaseEntity { name: string; supervisorId: string; membersCount: number; specialization?: string; }
export interface CompanyActivityType extends BaseEntity { name: string; description?: string; }
export interface BoqReferenceItem extends BaseEntity { name: string; unit?: string; isHeader?: boolean; parentBoqReferenceItemId?: string | null; transactionTypeIds?: string[]; subcontractorTypeIds?: string[]; activityTypeIds?: string[]; }
export interface SubcontractorCertificate extends BaseEntity { certificateNumber: string; subcontractorId: string; subcontractorName: string; projectId: string; projectName: string; date: any; amount: number; status: 'draft' | 'approved' | 'cancelled'; journalEntryId?: string; description?: string; }
export interface JournalEntry extends BaseEntity { entryNumber: string; date: any; narration: string; reference?: string; totalDebit: number; totalCredit: number; status: 'draft' | 'posted'; lines: { accountId: string; accountName: string; debit: number; credit: number; notes?: string; clientId?: string; transactionId?: string; auto_profit_center?: string; auto_resource_id?: string; auto_dept_id?: string; }[]; linkedReceiptId?: string; }
export interface CashReceipt extends BaseEntity { voucherNumber: string; clientId: string; clientNameAr: string; amount: number; amountInWords: string; receiptDate: any; paymentMethod: string; description: string; reference?: string; journalEntryId?: string; projectId?: string | null; projectNameAr?: string | null; isBypassed?: boolean; }
export interface PaymentVoucher extends BaseEntity { voucherNumber: string; payeeName: string; payeeType: string; amount: number; amountInWords: string; paymentDate: any; paymentMethod: string; description: string; reference?: string; debitAccountId: string; creditAccountId: string; status: 'draft' | 'paid' | 'cancelled'; journalEntryId: string; employeeId?: string | null; renewalExpiryDate?: any; }
export interface PurchaseOrder extends BaseEntity { poNumber: string; vendorId: string; vendorName: string; orderDate: any; status: 'draft' | 'approved' | 'received' | 'partially_received' | 'cancelled'; items: { internalItemId: string; itemName: string; quantity: number; unitPrice: number; total: number; }[]; totalAmount: number; rfqId?: string | null; discountAmount?: number; deliveryFees?: number; paymentTerms?: string; notes?: string; projectId?: string | null; isBypassed?: boolean; awardedItems?: Record<string, string>; awardedPoIds?: string[]; }
export interface RequestForQuotation extends BaseEntity { rfqNumber: string; date: any; vendorIds: string[]; prospectiveVendors?: { id: string; name: string; }[]; items: { id: string; internalItemId: string; itemName: string; quantity: number; }[]; status: 'draft' | 'sent' | 'closed' | 'cancelled'; awardedPoIds?: string[]; awardedItems?: Record<string, string>; projectId?: string; }
export interface SupplierQuotation extends BaseEntity { rfqId: string; vendorId: string; quotationReference?: string; date: any; items: { rfqItemId: string; unitPrice: number; }[]; discountAmount?: number; deliveryFees?: number; deliveryTimeDays?: number | null; paymentTerms?: string; }
export interface PermissionRequest extends BaseEntity { employeeId: string; employeeName: string; type: 'late_arrival' | 'early_departure'; date: any; reason: string; status: 'pending' | 'approved' | 'rejected'; }
