
export interface DailySiteReport {
    id?: string;
    projectId: string;
    date: any;
    engineerId: string;
    engineerName: string;
    workCompleted: string;
    workersCount: number;
    encounteredIssues?: string;
    photoUrls?: string[];
    weatherStatus?: string;
    createdAt: any;
}

export interface PaymentApplication {
    id?: string;
    applicationNumber: string;
    date: any;
    projectId: string;
    clientId: string;
    clientName: string;
    projectName: string;
    items: {
        boqItemId: string;
        description: string;
        unit: string;
        unitPrice: number;
        previousQuantity: number;
        currentQuantity: number;
        totalQuantity: number;
        totalAmount: number;
    }[];
    totalAmount: number;
    status: 'draft' | 'submitted' | 'approved' | 'paid' | 'cancelled';
    journalEntryId?: string;
    createdAt: any;
    createdBy: string;
}

export interface SubcontractorCertificate {
    id?: string;
    certificateNumber: string;
    date: any;
    subcontractorId: string;
    subcontractorName: string;
    projectId: string; 
    projectName?: string;
    amount: number;
    description: string;
    status: 'draft' | 'approved' | 'paid' | 'cancelled';
    journalEntryId?: string;
    createdAt: any;
    createdBy: string;
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
    id: string;
    name: string;
    order?: number;
}

export type MultilingualString = {
    ar: string;
    en: string;
};

export type UserRole = 'Admin' | 'Engineer' | 'Accountant' | 'Secretary' | 'HR';

export type UserProfile = {
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
};

export type Client = {
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
  projectIds?: string[];
  transactionCounter?: number;
};

export type Appointment = {
  id: string;
  title: string;
  appointmentDate: any;
  endDate?: any;
  clientId?: string;
  clientName?: string;
  prospectiveClientId?: string;
  clientMobile?: string;
  engineerId: string;
  engineerName?: string;
  meetingRoom?: string;
  department?: string;
  notes?: string;
  type: 'architectural' | 'room';
  status: 'scheduled' | 'cancelled';
  transactionId?: string;
  workStageUpdated?: boolean;
  workStageProgressId?: string;
  visitCount?: number;
  color?: string;
  minutesContent?: string;
};

export type CashReceipt = {
    id: string;
    voucherNumber: string;
    clientId: string;
    clientNameAr: string;
    clientNameEn: string;
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
};

export type Employee = {
    id?: string;
    employeeNumber?: string;
    fullName: string;
    nameEn?: string;
    dob?: any;
    gender?: 'male' | 'female';
    civilId: string;
    nationality?: string;
    residencyExpiry?: any;
    contractExpiry?: any;
    mobile: string;
    emergencyContact?: string;
    email?: string;
    jobTitle: string;
    position?: 'head' | 'employee' | 'assistant' | 'contractor';
    workStartTime?: string;
    workEndTime?: string;
    salaryPaymentType?: 'cash' | 'cheque' | 'transfer';
    bankName?: string;
    accountNumber?: string;
    iban?: string;
    profilePicture?: string;
    hireDate: any; 
    noticeStartDate?: any;
    terminationDate?: any;
    terminationReason?: 'resignation' | 'termination' | 'probation' | null;
    contractType: 'permanent' | 'temporary' | 'piece-rate' | 'percentage' | 'part-time' | 'special' | 'day_laborer';
    contractPercentage?: number;
    status: 'active' | 'on-leave' | 'terminated';
    createdAt?: any;
};

export type LeaveRequest = {
  id?: string;
  employeeId: string;
  employeeName: string;
  leaveType: 'Annual' | 'Sick' | 'Emergency' | 'Unpaid';
  startDate: any;
  endDate: any;
  days: number;
  workingDays: number;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  approvedBy?: string;
  approvedAt?: any;
  rejectionReason?: string;
  isSalaryPaid?: boolean;
};

export type PermissionRequest = {
  id?: string;
  employeeId: string;
  employeeName: string;
  date: any;
  type: 'late_arrival' | 'early_departure';
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
};

export type Holiday = {
    id?: string;
    name: string;
    date: any;
}

export type MonthlyAttendance = {
    id?: string;
    employeeId: string;
    year: number;
    month: number;
    records: {
        date: any;
        status: 'present' | 'absent' | 'late' | 'leave';
    }[];
    summary: {
        totalDays: number;
        presentDays: number;
        absentDays: number;
        lateDays: number;
        leaveDays: number;
    }
}

export type Payslip = {
    id?: string;
    employeeId: string;
    employeeName: string;
    year: number;
    month: number;
    earnings: { basicSalary: number; housingAllowance?: number; transportAllowance?: number; commission?: number; };
    deductions: { absenceDeduction: number; otherDeductions: number; };
    netSalary: number;
    status: 'draft' | 'processed' | 'paid';
    createdAt: any;
    type?: 'Monthly' | 'Leave';
};

export type Notification = {
  id?: string;
  userId: string;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  createdAt: any;
};

export type Department = { id: string; name: string; order?: number; activityTypes?: string[]; };
export type Job = { id: string; name: string; order?: number; };
export type Governorate = { id: string; name: string; order?: number; };
export type Area = { id: string; name: string; order?: number; };

export type TransactionType = {
  id: string;
  name: string;
  activityType?: string;
  departmentIds?: string[];
};

export type WorkStage = {
    id: string;
    name: string;
    order: number;
    stageType: 'sequential' | 'parallel';
    allowedRoles: string[];
    trackingType: 'duration' | 'occurrence' | 'none';
};

export type TransactionStage = {
    stageId: string;
    name: string;
    status: 'pending' | 'in-progress' | 'completed' | 'skipped' | 'awaiting-review';
    completedCount?: number;
    startDate?: any;
    endDate?: any;
    expectedEndDate?: any;
    modificationCount?: number;
};

export type ClientTransaction = {
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
    contract?: {
        clauses: any[];
        totalAmount: number;
        financialsType?: 'fixed' | 'percentage';
        scopeOfWork?: any[];
        termsAndConditions?: any[];
        openClauses?: any[];
    };
    stages?: TransactionStage[];
};

export type Account = {
    id?: string;
    code: string;
    name: string;
    type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    statement: 'Balance Sheet' | 'Income Statement';
    balanceType: 'Debit' | 'Credit';
    level: number;
    parentCode: string | null;
    isPayable?: boolean;
};

export type JournalEntry = {
    id?: string;
    entryNumber: string;
    date: any;
    narration: string;
    totalDebit: number;
    totalCredit: number;
    status: 'draft' | 'posted';
    lines: any[];
    transactionId?: string;
    clientId?: string;
    createdAt: any;
    createdBy: string;
    linkedReceiptId?: string;
    reconciliationStatus?: 'unreconciled' | 'reconciled' | 'pending';
    reconciliationInfo?: any;
};

export type ContractTemplate = {
  id?: string;
  title: string;
  transactionTypes?: string[];
  templateType?: 'Consulting' | 'Execution';
  description?: string;
  financials: { type: 'fixed' | 'percentage'; totalAmount: number; discount?: number; milestones: any[]; };
  scopeOfWork?: any[];
  termsAndConditions?: any[];
  openClauses?: any[];
  createdAt?: any;
  createdBy?: string;
};

export type Quotation = {
  id?: string;
  quotationNumber: string;
  quotationSequence?: number;
  quotationYear?: number;
  clientId: string;
  clientName: string;
  date: any;
  validUntil: any;
  subject: string;
  items: any[];
  totalAmount: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  createdAt: any;
  createdBy: string;
  departmentId?: string;
  transactionTypeId?: string;
  templateDescription?: string;
  scopeOfWork?: any[];
  termsAndConditions?: any[];
  openClauses?: any[];
  financialsType?: 'fixed' | 'percentage';
  transactionId?: string;
};

export type Vendor = { id?: string; name: string; contactPerson?: string; phone?: string; email?: string; address?: string; createdAt?: any; };

export interface ContractTerm { id: string; text: string; }
export interface ContractScopeItem { id: string; title: string; description?: string; }
export interface ContractFinancialMilestone { id: string; name: string; condition: string; value: number; }

export type RequestForQuotation = {
  id?: string;
  rfqNumber: string;
  date: any;
  status: 'draft' | 'sent' | 'closed' | 'cancelled';
  vendorIds: string[];
  prospectiveVendors?: { id: string; name: string }[];
  items: { id: string; internalItemId: string; itemName: string; quantity: number; }[];
  awardedItems?: Record<string, string>;
  awardedPoIds?: string[];
  awardedVendorId?: string;
  projectId?: string;
  createdAt: any;
};

export type SupplierQuotation = {
    id?: string;
    rfqId: string;
    vendorId: string;
    date: any;
    items: { rfqItemId: string; unitPrice: number; }[];
    discountAmount?: number;
    deliveryFees?: number;
    deliveryTimeDays?: number;
    paymentTerms?: string;
};

export type PurchaseOrder = {
    id?: string;
    poNumber: string;
    orderDate: any;
    vendorId: string;
    vendorName: string;
    projectId?: string;
    items: { internalItemId?: string; itemName: string; quantity: number; unitPrice: number; total: number; }[];
    totalAmount: number;
    discountAmount?: number;
    deliveryFees?: number;
    status: 'draft' | 'approved' | 'partially_received' | 'received' | 'cancelled';
    rfqId?: string;
    supplierQuotationId?: string;
    paymentTerms?: string;
    notes?: string;
    createdAt: any;
    createdBy: string;
    approvedBy?: string;
    approvedAt?: any;
};

export type ConstructionProject = {
  id?: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName?: string;
  projectType: 'استشاري' | 'تنفيذي' | 'مختلط';
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
};

export type Subcontractor = { 
    id?: string; 
    name: string; 
    type: string; 
    specialization?: string;
    contactPerson?: string;
    phone?: string;
    mobile?: string;
    email?: string;
    address?: string;
    isActive: boolean;
    performanceRating?: number;
    blacklisted?: boolean;
    blacklistedReason?: string;
    bankAccount?: { bankName?: string; accountNumber?: string; iban?: string; };
    createdAt?: any;
};

export type BoqItem = {
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
  createdAt?: any;
  updatedAt?: any;
};
    
export type Boq = {
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
  updatedAt?: any;
  createdBy?: string;
};
  
export type BoqReferenceItem = { 
    id?: string; 
    name: string; 
    unit?: string;
    isHeader?: boolean; 
    transactionTypeIds?: string[];
    subcontractorTypeIds?: string[];
    activityTypeIds?: string[];
    order?: number;
    parentBoqReferenceItemId?: string;
};

export type Warehouse = { id?: string; name: string; isDefault?: boolean; location?: string; projectId?: string | null; companyId?: string | null; createdAt?: any; };
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
    expiryTracked?: boolean;
    createdAt?: any;
}

export type InventoryAdjustment = {
    id?: string;
    adjustmentNumber: string;
    date: any;
    type: 'opening_balance' | 'damage' | 'theft' | 'material_issue' | 'purchase_return' | 'sales_return' | 'transfer' | 'other';
    journalEntryId?: string;
    items: any[];
    projectId?: string;
    clientId?: string;
    warehouseId?: string;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    notes?: string;
    createdAt?: any;
    createdBy?: string;
};

export interface SubcontractorType { id: string; name: string; order?: number; }
export interface SubcontractorSpecialization { id: string; name: string; order?: number; }
