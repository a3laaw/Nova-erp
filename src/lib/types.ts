
export interface FieldVisit {
  id?: string;
  clientId: string;
  clientName: string;
  transactionId: string;
  transactionType: string;
  engineerId: string;
  engineerName: string;
  scheduledDate: any;
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
  itemId?: string; 
  itemNumber: string;
  description: string;
  unit: string;
  quantity: number;
  sellingUnitPrice: number;
  costUnitPrice?: number;
  isHeader: boolean;
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
  constructionTypeId?: string;
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

export interface PurchaseRequest {
    id?: string;
    requestNumber: string;
    date: any;
    requesterId: string;
    requesterName: string;
    projectId: string;
    items: {
        internalItemId: string;
        itemName: string;
        quantity: number;
        notes?: string;
    }[];
    status: 'pending' | 'approved' | 'rejected' | 'converted';
    createdAt: any;
    approvedBy?: string;
    approvedAt?: any;
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
  fileId: string;
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
    code: string;
    name: string;
    type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    statement: 'Balance Sheet' | 'Income Statement';
    balanceType: 'Debit' | 'Credit';
    level: number;
    parentCode: string | null;
    isPayable?: boolean;
}
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
    discountAmount?: number;
    deliveryFees?: number;
    status: string;
    createdAt: any;
    createdBy?: string;
    supplierQuotationId?: string;
    paymentTerms?: string;
    notes?: string;
}
export interface Boq {
  id?: string;
  boqNumber: string;
  name: string;
  status: 'تقديري' | 'تعاقدي' | 'منفذ';
  clientId?: string;
  clientName?: string; 
  totalValue: number;
  itemCount: number;
  projectId?: string;
  transactionId?: string;
  createdAt: any;
  updatedAt: any;
  createdBy?: string;
}
export interface BoqReferenceItem { 
    id?: string; 
    name: string; 
    unit?: string;
    isHeader?: boolean; 
    transactionTypeIds?: string[];
    subcontractorTypeIds?: string[];
    activityTypeIds?: string[];
    order?: number;
    parentBoqReferenceItemId?: string;
}
export interface ItemCategory { id?: string; name: string; parentCategoryId: string | null; boqReferenceItemIds?: string[]; activityTypeIds?: string[]; order?: number; }
export interface Item { 
    id?: string; 
    name: string; 
    sku: string; 
    categoryId: string; 
    description?: string;
    itemType: 'product' | 'service';
    inventoryTracked: boolean;
    unitOfMeasure: string;
    costPrice?: number; 
    sellingPrice?: number; 
    reorderLevel?: number;
    warrantyYears?: number; 
}
export interface Warehouse { id?: string; name: string; isDefault?: boolean; location?: string; projectId?: string | null; companyId?: string | null; createdAt?: any; }
export interface JournalEntry { id?: string; entryNumber: string; date: any; narration: string; totalDebit: number; totalCredit: number; status: string; lines: any[]; createdAt: any; reconciliationStatus?: string; reconciliationInfo?: any; transactionId?: string; clientId?: string; createdBy?: string; }
export interface DailySiteReport { id?: string; projectId: string; date: any; engineerId: string; engineerName: string; workCompleted: string; workersCount: number; encounteredIssues?: string; weatherStatus?: string; photoUrls: string[]; createdAt: any; }
export interface PaymentApplication { id?: string; applicationNumber: string; date: any; projectId: string; clientId: string; clientName: string; projectName: string; items: any[]; totalAmount: number; status: 'draft' | 'submitted' | 'approved' | 'paid' | 'cancelled'; journalEntryId?: string; createdAt: any; createdBy: string; }

export interface LetterOfCredit {
    id?: string;
    lcNumber: string;
    issuingBank: string;
    vendorId: string;
    vendorName: string;
    amount: number;
    currency: string;
    expiryDate: any;
    status: 'open' | 'used' | 'expired' | 'cancelled';
    notes?: string;
    createdAt: any;
}

export interface ConstructionType {
    id?: string;
    name: string;
    order?: number;
}

export interface ConstructionWorkStage {
    id?: string;
    name: string;
    description?: string;
    parentId: string | null;
    order?: number;
    activityTypeIds?: string[];
    createdAt?: any;
}

export interface SubcontractorCertificate {
    id?: string;
    certificateNumber: string;
    date: any;
    subcontractorId: string;
    subcontractorName: string;
    projectId: string;
    projectName: string;
    amount: number;
    description: string;
    status: 'draft' | 'approved' | 'cancelled';
    journalEntryId?: string;
    createdAt: any;
    createdBy: string;
}

export interface Subcontractor {
    id?: string;
    name: string;
    type: string;
    specialization?: string;
    contactPerson?: string;
    phone?: string;
    mobile?: string;
    email?: string;
    address?: string;
    bankAccount?: {
        bankName?: string;
        accountNumber?: string;
        iban?: string;
    };
    isActive: boolean;
    blacklisted: boolean;
    blacklistedReason?: string;
    performanceRating?: number;
    createdAt: any;
}

export interface AuditLog {
    id?: string;
    changeType: 'Creation' | 'SalaryChange' | 'JobChange' | 'DataUpdate' | 'StatusChange' | 'ResidencyUpdate';
    field: string;
    oldValue: any;
    newValue: any;
    effectiveDate: any;
    changedBy: string;
    notes?: string;
}

export interface MonthlyAttendance {
    id?: string;
    employeeId: string;
    year: number;
    month: number;
    records: {
        date: any;
        checkIn1: string | null;
        checkOut1: string | null;
        checkIn2: string | null;
        checkOut2: string | null;
        totalHours: number | null;
        status: 'present' | 'absent' | 'late' | 'leave';
    }[];
    summary: {
        totalDays: number;
        presentDays: number;
        absentDays: number;
        lateDays: number;
        leaveDays: number;
    };
}

export interface Payslip {
    id?: string;
    employeeId: string;
    employeeName: string;
    year: number;
    month: number;
    attendanceId?: string;
    type: 'Monthly' | 'Leave';
    leaveRequestId?: string;
    salaryPaymentType?: string;
    earnings: {
        basicSalary: number;
        housingAllowance: number;
        transportAllowance: number;
        commission: number;
    };
    deductions: {
        absenceDeduction: number;
        otherDeductions: number;
    };
    netSalary: number;
    status: 'draft' | 'processed' | 'paid';
    createdAt: any;
    notes?: string;
}

export interface Notification {
    id?: string;
    userId: string;
    title: string;
    body: string;
    link: string;
    isRead: boolean;
    createdAt: any;
}

export interface Department {
    id: string;
    name: string;
    order?: number;
    activityTypes?: string[];
}

export interface Job {
    id: string;
    name: string;
    order?: number;
}

export interface Governorate {
    id: string;
    name: string;
    order?: number;
}

export interface Area {
    id: string;
    name: string;
    order?: number;
}

export interface TransactionType {
    id: string;
    name: string;
    activityType?: string;
    departmentIds?: string[];
    order?: number;
}

export interface WorkStage {
    id: string;
    name: string;
    order: number;
    stageType: 'sequential' | 'parallel';
    allowedRoles?: string[];
    nextStageIds?: string[];
    allowedDuringStages?: string[];
    trackingType: 'duration' | 'occurrence' | 'none';
    enableModificationTracking?: boolean;
    expectedDurationDays?: number | null;
    maxOccurrences?: number | null;
    allowManualCompletion?: boolean;
}

export interface Appointment {
    id?: string;
    clientId?: string;
    clientName?: string;
    clientMobile?: string;
    engineerId: string;
    meetingRoom?: string;
    department?: string;
    title: string;
    notes?: string;
    type: 'architectural' | 'room';
    status: 'scheduled' | 'cancelled';
    appointmentDate: any;
    endDate?: any;
    createdAt: any;
    transactionId?: string;
    workStageUpdated?: boolean;
    workStageProgressId?: string;
    visitCount?: number;
    color?: string;
    minutesContent?: string;
}

export interface Company {
    id?: string;
    name: string;
    nameEn?: string;
    address?: string;
    phone?: string;
    email?: string;
    crNumber?: string;
    logoUrl?: string;
    parentCompanyId?: string;
    activityType?: string;
}

export interface CompanyActivityType {
    id?: string;
    name: string;
    order?: number;
}

export interface ContractTerm {
    id: string;
    text: string;
}

export interface ContractScopeItem {
    id: string;
    title: string;
    description: string;
}

export interface ContractFinancialMilestone {
    id: string;
    name: string;
    condition: string;
    value: number;
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

export interface TransactionStage {
    stageId: string;
    name: string;
    status: 'pending' | 'in-progress' | 'completed' | 'skipped' | 'awaiting-review';
    startDate?: any;
    endDate?: any;
    completedCount?: number;
    modificationCount?: number;
    allowedRoles?: string[];
}

export interface CashReceipt {
    id?: string;
    voucherNumber: string;
    voucherSequence: number;
    voucherYear: number;
    clientId: string;
    clientNameAr: string;
    clientNameEn?: string;
    projectId?: string;
    projectNameAr?: string;
    amount: number;
    amountInWords: string;
    receiptDate: any;
    paymentMethod: string;
    bankFeeAmount?: number;
    netAmount?: number;
    description: string;
    reference?: string;
    journalEntryId?: string;
    createdAt: any;
}

export interface Quotation {
    id: string;
    quotationNumber: string;
    quotationSequence: number;
    quotationYear: number;
    clientId: string;
    clientName: string;
    date: any;
    validUntil: any;
    subject: string;
    departmentId?: string;
    transactionTypeId?: string;
    templateDescription?: string;
    scopeOfWork?: any[];
    termsAndConditions?: any[];
    openClauses?: any[];
    items: any[];
    totalAmount: number;
    financialsType?: 'fixed' | 'percentage';
    notes: string;
    status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
    createdAt: any;
    createdBy: string;
    transactionId?: string;
}

export interface RequestForQuotation {
    id: string;
    rfqNumber: string;
    date: any;
    status: 'draft' | 'sent' | 'closed' | 'cancelled';
    vendorIds: string[];
    prospectiveVendors?: { id: string, name: string }[];
    projectId?: string;
    items: {
        id: string;
        internalItemId: string;
        itemName: string;
        quantity: number;
    }[];
    awardedVendorId?: string;
    awardedPoIds?: string[];
    awardedItems?: Record<string, string>; // itemId -> vendorId
    createdAt: any;
}

export interface SupplierQuotation {
    id?: string;
    rfqId: string;
    vendorId: string;
    quotationReference?: string;
    date: any;
    deliveryTimeDays?: number;
    paymentTerms?: string;
    discountAmount?: number;
    deliveryFees?: number;
    items: {
        rfqItemId: string;
        unitPrice: number;
    }[];
    createdAt: any;
}
