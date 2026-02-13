

export interface Company {
    id?: string;
    name: string;
    nameEn?: string;
    phone?: string;
    email?: string;
    crNumber?: string;
    parentCompanyId?: string;
    activityType?: 'مكتب هندسي' | 'مقاولات' | 'مبيعات';
}

export type MultilingualString = {
    ar: string;
    en: string;
};

export type UserRole = 'Admin' | 'Engineer' | 'Accountant' | 'Secretary' | 'HR';

export type UserProfile = {
  id?: string;
  uid?: string; // Firebase Auth UID
  username: string; // Unique, for login
  email: string; // Auto-generated internal email
  passwordHash: string; // Hashed password
  employeeId: string; // Reference to 'employees' collection
  role: UserRole;
  isActive: boolean;
  createdAt?: any; 
  activatedAt?: any;
  createdBy?: string; // UID of the admin who created the user
  avatarUrl?: string; // Optional, from employee record
  fullName?:string; // Optional, from employee record
  jobTitle?: string; // Optional, from employee record
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
  status: 'new' | 'contracted' | 'cancelled';
  assignedEngineer?: string;
  createdAt: any;
  isActive: boolean;
  projectIds?: string[];
  transactionCounter?: number;
};

export type ProjectStatus = 'Planning' | 'In Progress' | 'Completed' | 'On Hold' | 'Cancelled';

export type EngineeringDiscipline = {
  name: MultilingualString;
  stages: { name: MultilingualString; status: 'Pending' | 'In Progress' | 'Completed' }[];
};

export type ProjectFile = {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  type: 'image' | 'pdf' | 'document';
};

export type TimelineEvent = {
  id: string;
  type: 'Milestone' | 'Visit' | 'Task' | 'Report';
  title: MultilingualString;
  date: string;
  description: MultilingualString;
  authorId?: string;
};

export type DailyReport = {
  id:string;
  date: string;
  authorId: string;
  workCompleted: string;
  workersCount: number;
  issues: string;
  photos: string[]; // URLs
};

export type Project = {
  id: string;
  name: MultilingualString;
  clientId: string;
  leadEngineerId: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  description: MultilingualString;
  imageUrl: string;
  imageHint: string;
  disciplines: EngineeringDiscipline[];
  files: ProjectFile[];
  timeline: TimelineEvent[];
  reports: DailyReport[];
  contractId?: string;
};

export type Appointment = {
  id: string;
  title: string;
  appointmentDate: any; // This will be the start time
  endDate?: any; // This will be the end time
  clientId?: string;
  clientName?: string;
  prospectiveClientId?: string; // NEW: Link to a prospective client record
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
  // For architectural appointments with color logic
  visitCount?: number;
  color?: string; // Hex color code
  minutesContent?: string;
};


export type PaymentMilestone = {
  id: string;
  name: MultilingualString;
  percentage: number;
  dueDate: string;
  status: 'Pending' | 'Completed' | 'Overdue';
};

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue';

export type Invoice = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  projectId: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  type: 'Receivable' | 'Payable';
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

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'Income' | 'Expense';
  category: string;
  invoiceId?: string;
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
    pieceRateMode?: 'salary_with_target' | 'per_piece';
    targetDescription?: number;
    pieceRate?: number;
    dailyRate?: number;
    department: string;
    basicSalary: number; 
    housingAllowance?: number;
    transportAllowance?: number;
    status: 'active' | 'on-leave' | 'terminated';
    lastVacationAccrualDate?: any;
    annualLeaveAccrued?: number;
    annualLeaveUsed?: number;
    carriedLeaveDays?: number;
    sickLeaveUsed?: number;
    emergencyLeaveUsed?: number;
    maxEmergencyLeave?: number;
    lastLeaveResetDate?: any;
    annualLeaveBalance?: number;
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
  attachmentUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  approvedBy?: string;
  approvedAt?: any;
  rejectionReason?: string;
  isBackFromLeave?: boolean;
  actualReturnDate?: any;
  passportReceived?: boolean;
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
  approvedBy?: string;
  approvedAt?: any;
  rejectionReason?: string;
};

export type Holiday = {
    id?: string;
    name: string;
    date: any;
}

export type AuditLog = {
    id?: string;
    changeType: 'Creation' | 'SalaryChange' | 'JobChange' | 'DataUpdate' | 'StatusChange' | 'ResidencyUpdate';
    field: string;
    oldValue: any;
    newValue: any;
    effectiveDate: any;
    changedBy: string;
    notes: string;
};

export type MonthlyAttendance = {
    id?: string;
    employeeId: string;
    year: number;
    month: number;
    records: {
        date: any;
        checkIn1?: string | null;
        checkOut1?: string | null;
        checkIn2?: string | null;
        checkOut2?: string | null;
        totalHours?: number | null;
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
    attendanceId?: string;
    type?: 'Monthly' | 'Leave';
    leaveRequestId?: string;
    salaryPaymentType: 'cash' | 'cheque' | 'transfer';
    earnings: {
        basicSalary: number;
        housingAllowance?: number;
        transportAllowance?: number;
        commission?: number;
    };
    deductions: {
        absenceDeduction: number;
        otherDeductions: number;
    };
    netSalary: number;
    status: 'draft' | 'processed' | 'paid';
    createdAt: any;
    notes?: string;
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


export type Department = {
    id: string;
    name: string;
    order?: number;
};

export type Job = {
    id: string;
    name: string;
    order?: number;
};

export type Governorate = {
    id: string;
    name: string;
    order?: number;
};

export type Area = {
    id: string;
    name: string;
    order?: number;
};

export type TransactionType = {
  id: string;
  name: string;
  departmentIds?: string[];
  order?: number;
};

export type WorkStage = {
    id: string;
    name: string;
    order: number;
    stageType: 'sequential' | 'parallel';
    allowedRoles: string[];
    nextStageIds?: string[];
    allowedDuringStages?: string[];
    trackingType: 'duration' | 'occurrence' | 'none';
    expectedDurationDays?: number | null;
    maxOccurrences?: number | null;
    allowManualCompletion?: boolean;
    enableModificationTracking?: boolean;
};

export type TransactionStage = {
    stageId: string;
    name: string;
    status: 'pending' | 'in-progress' | 'completed' | 'skipped' | 'awaiting-review';
    order?: number;
    stageType?: 'sequential' | 'parallel';
    allowedRoles?: string[];
    nextStageIds?: string[];
    allowedDuringStages?: string[];
    trackingType?: 'duration' | 'occurrence' | 'none';
    expectedDurationDays?: number | null;
    maxOccurrences?: number | null;
    allowManualCompletion?: boolean;
    enableModificationTracking?: boolean;
    modificationCount?: number | null;
    startDate?: any | null;
    endDate?: any | null;
    expectedEndDate?: any | null;
    notes?: string | null;
    completedCount?: number | null;
};

export type WorkStageProgress = {
    id?: string;
    transactionId: string;
    visitId: string;
    stageId: string;
    stageName: string;
    selectedBy: string;
    selectedAt: any;
};

export type ClientTransaction = {
    id?: string;
    transactionNumber?: string;
    clientId: string;
    transactionType: string;
    description?: string;
    departmentId?: string;
    transactionTypeId?: string;
    status: 'new' | 'in-progress' | 'completed' | 'submitted' | 'on-hold';
    assignedEngineerId?: string;
    createdAt: any;
    updatedAt?: any;
    engineerName?: string;
    stages?: TransactionStage[];
    contract?: {
        clauses: ContractClause[];
        scopeOfWork?: ContractScopeItem[];
        termsAndConditions?: ContractTerm[];
        openClauses?: ContractTerm[];
        totalAmount: number;
        financialsType?: 'fixed' | 'percentage';
    };
};

export type TransactionAssignment = {
    id?: string;
    transactionId: string;
    clientId: string;
    departmentId: string;
    departmentName: string;
    engineerId?: string;
    notes?: string;
    status: 'pending' | 'in-progress' | 'completed';
    createdAt: any;
    createdBy: string;
}

export type Account = {
    id?: string;
    code: string;
    name: string;
    type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    statement: 'Balance Sheet' | 'Income Statement';
    balanceType: 'Debit' | 'Credit';
    level: number;
    parentCode: string | null;
    description?: string;
    isPayable?: boolean;
};

export type JournalEntryLine = {
    accountId: string;
    accountName: string;
    debit: number;
    credit: number;
    notes?: string;
    clientId?: string;
    transactionId?: string;
    auto_profit_center?: string;
    auto_resource_id?: string;
    auto_dept_id?: string;
};

export type JournalEntry = {
    id?: string;
    entryNumber: string;
    date: any;
    narration: string;
    reference?: string;
    linkedReceiptId?: string;
    totalDebit: number;
    totalCredit: number;
    status: 'draft' | 'posted';
    reconciliationStatus?: 'unreconciled' | 'reconciled' | 'pending';
    reconciliationInfo?: {
        reconciledAt: any;
        reconciledBy: string;
        bankTransactionId: string;
        reconciliationEntryId: string;
    };
    lines: JournalEntryLine[];
    clientId?: string;
    transactionId?: string;
    createdAt: any;
    createdBy: string;
};

export type PaymentVoucher = {
    id?: string;
    voucherNumber: string;
    voucherSequence: number;
    voucherYear: number;
    payeeName: string;
    payeeType: 'vendor' | 'employee' | 'other';
    employeeId?: string; // For residency renewal
    renewalExpiryDate?: any;
    amount: number;
    amountInWords: string;
    paymentDate: any;
    paymentMethod: 'Cash' | 'Cheque' | 'Bank Transfer' | 'EmployeeCustody';
    description: string;
    reference?: string;
    debitAccountId: string;
    debitAccountName: string;
    creditAccountId: string;
    creditAccountName: string;
    status: 'draft' | 'paid' | 'cancelled';
    journalEntryId?: string;
    createdAt: any;
    clientId?: string;
    transactionId?: string;
};

export type ContractScopeItem = {
    id: string;
    title: string;
    description: string;
};

export type ContractTerm = {
    id: string;
    text: string;
};

export type ContractFinancialMilestone = {
    id: string;
    name: string;
    condition: string; // Link to a work stage name
    value: number; // Either fixed amount or percentage
};

export type ContractClause = {
    id: string;
    name: string;
    amount: number;
    status: 'مدفوعة' | 'مستحقة' | 'غير مستحقة';
    percentage?: number;
    condition?: string;
};

export type ContractTemplate = {
  id?: string;
  title: string;
  templateType?: 'Consulting' | 'Execution';
  description?: string;
  transactionTypes?: string[];
  scopeOfWork?: ContractScopeItem[];
  termsAndConditions?: ContractTerm[];
  financials: {
    type: 'fixed' | 'percentage';
    totalAmount: number;
    discount: number;
    milestones: ContractFinancialMilestone[];
  };
  openClauses?: ContractTerm[];
  createdAt?: any;
  createdBy?: string;
};

export type QuotationItem = {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  condition?: string;
};

export type Quotation = {
  id?: string;
  quotationNumber: string;
  quotationSequence: number;
  quotationYear: number;
  clientId: string;
  clientName: string;
  date: any;
  validUntil: any;
  subject: string;
  departmentId: string;
  transactionTypeId: string;
  templateDescription?: string;
  scopeOfWork?: ContractScopeItem[];
  termsAndConditions?: ContractTerm[];
  openClauses?: ContractTerm[];
  items: QuotationItem[];
  totalAmount: number;
  notes?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  createdAt: any;
  createdBy: string;
  transactionId?: string; // Link to transaction if converted
};

export type Vendor = {
  id?: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
};

export type RfqItem = {
    id: string;
    internalItemId: string;
    itemName: string;
    quantity: number;
};

export type RequestForQuotation = {
  id?: string;
  rfqNumber: string;
  date: any;
  status: 'draft' | 'sent' | 'closed' | 'cancelled';
  vendorIds: string[];
  items: RfqItem[];
  createdAt: any;
};

export type SupplierQuotation = {
    id?: string;
    rfqId: string;
    vendorId: string;
    quotationReference: string;
    date: any;
    deliveryTimeDays?: number;
    paymentTerms?: string;
    items: {
        rfqItemId: string;
        unitPrice: number;
    }[];
    createdAt?: any;
};

export type PurchaseOrder = {
    id?: string;
    poNumber: string;
    orderDate: any;
    vendorId: string;
    vendorName: string;
    supplierQuotationId?: string;
    items: {
      internalItemId?: string;
      itemName: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }[];
    totalAmount: number;
    paymentTerms?: string;
    notes?: string;
    status: 'draft' | 'approved' | 'partially_received' | 'received' | 'cancelled';
    createdAt?: any;
};

export type ConstructionProject = {
  id?: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName?: string;
  projectType: 'استشاري' | 'تنفيذي' | 'مختلط';
  contractValue: number;
  startDate: any; // Using 'any' for Firestore Timestamps
  endDate: any;
  status: 'مخطط' | 'قيد التنفيذ' | 'مكتمل' | 'معلق' | 'ملغى';
  mainEngineerId: string;
  mainEngineerName?: string;
  progressPercentage: number;
  linkedTransactionId?: string;
  createdAt?: any;
  createdBy?: string;
};

export type Subcontractor = {
    id?: string;
    name: string;
    type: string; // e.g., 'كهرباء', 'صحي'
    specialization?: string;
    contactPerson?: string;
    phone?: string;
    mobile?: string;
    email?: string;
    address?: string;
    bankAccount?: {
        bankName: string;
        accountNumber: string;
        iban: string;
    };
    rating?: number; // 1-5
    isActive: boolean;
    blacklisted: boolean;
    blacklistedReason?: string;
    createdAt?: any;
    performanceRating?: number;
};

export type SubcontractorType = {
    id: string;
    name: string;
    order?: number;
};

export type SubcontractorSpecialization = {
    id: string;
    name: string;
    order?: number;
};

export type BoqItem = {
    id?: string;
    itemNumber: string;
    description: string;
    unit: string;
    plannedQuantity: number;
    plannedUnitPrice: number;
    executedQuantity?: number;
    createdAt?: any;
    updatedAt?: any;
};
    