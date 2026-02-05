

export interface Company {
    id?: string;
    name: string;
    nameEn?: string;
    address?: string;
    phone?: string;
    email?: string;
    crNumber?: string;
    logoUrl?: string;
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
  plotNumber?: string;
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
  transactionCounter?: number;
  assignedEngineer?: string;
  createdAt: any;
  isActive: boolean;
  projectIds?: string[];
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
  clientMobile?: string;
  engineerId: string;
  engineerName?: string;
  meetingRoom?: string;
  department?: string;
  type: 'architectural' | 'room';
  notes?: string;
  transactionId?: string;
  workStageUpdated?: boolean;
  workStageProgressId?: string;
  // For architectural appointments with color logic
  session?: 'صباحية' | 'مسائية';
  visitCount?: number;
  contractSigned?: boolean;
  projectType?: string;
  color?: string; // Hex color code
  minutesContent?: string;
  // For display purposes, not stored in DB directly
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
    paymentMethod: 'Cash' | 'Cheque' | 'Bank Transfer' | 'K-Net';
    description: string;
    reference?: string;
    journalEntryId?: string;
    createdAt: any; 
};

export interface PaymentVoucher {
  id?: string;
  voucherNumber: string;
  voucherSequence: number;
  voucherYear: number;
  payeeName: string;
  payeeType: 'vendor' | 'employee' | 'other';
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
}

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
    jobTitle?: string;
    position?: 'head' | 'employee' | 'assistant' | 'contractor';
    workStartTime?: string; 
    workEndTime?: string; 
    salaryPaymentType?: 'cash' | 'cheque' | 'transfer';
    bankName?: string;
    accountNumber?: string;
    iban?: string;
    profilePicture?: string;
    hireDate: any; 
    noticeStartDate: any | null; 
    terminationDate: any | null;
    terminationReason: 'resignation' | 'termination' | 'probation' | null;
    contractType: 'permanent' | 'temporary' | 'subcontractor';
    department: string;
    basicSalary: number; 
    housingAllowance?: number;
    transportAllowance?: number;
    status: 'active' | 'on-leave' | 'terminated';
    lastVacationAccrualDate: any; 
    annualLeaveAccrued?: number;
    annualLeaveUsed?: number;
    carriedLeaveDays?: number;
    sickLeaveUsed?: number;
    emergencyLeaveUsed?: number;
    maxEmergencyLeave?: number;
    lastLeaveResetDate?: any; 
    annualLeaveBalance?: number;
    createdAt?: any; 
    auditLogs?: AuditLog[];
    eosb?: number;
    leaveBalance?: number;
    lastLeave?: LeaveRequest | null;
    serviceDuration?: Duration;
};

export interface LeaveRequest {
    id: string;
    employeeId: string;
    employeeName: string;
    leaveType: 'Annual' | 'Sick' | 'Emergency' | 'Unpaid';
    startDate: any;
    endDate: any;
    days: number;
    workingDays?: number;
    notes?: string;
    attachmentUrl?: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: any;
    approvedBy?: string;
    approvedAt?: any;
    rejectionReason?: string;
    isBackFromLeave?: boolean;
    actualReturnDate?: any;
}


export interface Holiday {
    id?: string;
    name: string;
    date: any; 
}


export type AuditLog = {
    id?: string;
    employeeId: string;
    changeType: 'Creation' | 'SalaryChange' | 'JobChange' | 'DataUpdate';
    field: string | string[]; 
    oldValue: any;
    newValue: any;
    effectiveDate: any; 
    changedBy: string; 
    notes?: string;
};

export type AttendanceRecord = {
    date: string; 
    checkIn?: string; 
    checkOut?: string; 
    status: 'present' | 'absent' | 'late' | 'leave';
};

export type AttendanceSummary = {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    leaveDays: number;
};

export type MonthlyAttendance = {
    id?: string;
    employeeId: string;
    year: number;
    month: number;
    records: AttendanceRecord[];
    summary: AttendanceSummary;
};

export type Payslip = {
    id?: string;
    employeeId: string;
    employeeName: string;
    year: number;
    month: number;
    attendanceId?: string;
    earnings: {
        basicSalary: number;
        housingAllowance?: number;
        transportAllowance?: number;
    };
    deductions: {
        absenceDeduction: number;
        otherDeductions: number;
    };
    netSalary: number;
    salaryPaymentType?: 'cash' | 'cheque' | 'transfer';
    status: 'draft' | 'processed' | 'paid';
    createdAt: any;
};

export interface TransactionStage {
  stageId: string;
  name: string;
  order?: number;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped' | 'awaiting-review';
  startDate: any | null;
  endDate: any | null;
  notes?: string;
  expectedEndDate?: any | null;
  completedCount?: number;
  
  stageType?: 'sequential' | 'parallel';
  allowedRoles?: string[];
  nextStageIds?: string[];
  allowedDuringStages?: string[];
  trackingType?: 'duration' | 'occurrence' | 'none';
  expectedDurationDays?: number | null;
  maxOccurrences?: number | null;
  allowManualCompletion?: boolean;
}
      
export type ClientTransaction = {
    id?: string;
    transactionNumber?: string;
    clientId: string;
    transactionType: string;
    description?: string;
    status: 'new' | 'in-progress' | 'completed' | 'submitted' | 'on-hold';
    departmentId?: string;
    transactionTypeId?: string;
    assignedEngineerId?: string;
    createdAt: any;
    updatedAt?: any;
    stages?: Partial<TransactionStage>[]; 
    engineerName?: string;
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
};


export type TransactionTimelineEvent = {
  id: string;
  type: 'comment' | 'log';
  content: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: any;
};

export interface Department {
    id: string;
    name: string;
    order?: number;
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
    departmentIds?: string[];
    order?: number;
}

export interface WorkStage {
  id: string;
  name: string;
  order?: number;
  stageType?: 'sequential' | 'parallel';
  allowedRoles?: string[];
  nextStageIds?: string[];
  allowedDuringStages?: string[];
  trackingType: 'duration' | 'occurrence' | 'none';
  expectedDurationDays?: number | null;
  maxOccurrences?: number | null;
  allowManualCompletion?: boolean;
}

export type ContractClause = {
  id: string;
  name: string;
  amount: number;
  status: 'مدفوعة' | 'مستحقة' | 'غير مستحقة'; 
  percentage?: number;
  condition?: string;
};

export interface ContractTerm {
  id: string;
  text: string;
}

export type ContractTemplate = {
  id?: string;
  title: string;
  description?: string;
  transactionTypes: string[];
  scopeOfWork: ContractScopeItem[];
  termsAndConditions: ContractTerm[];
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

export interface Contract {
  id?: string;
  clientId: string;
  clientName: string;
  companySnapshot: Partial<Company>;
  title: string;
  contractDate: any;
  scopeOfWork: ContractScopeItem[];
  termsAndConditions: ContractTerm[];
  financials: {
    type: 'fixed' | 'percentage';
    totalAmount: number;
    discount: number;
    milestones: ContractFinancialMilestone[];
  };
  openClauses?: ContractTerm[];
  createdAt?: any;
  createdBy?: string;
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

export interface Account {
    id?: string;
    code: string;
    name: string;
    type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    statement?: 'Balance Sheet' | 'Income Statement';
    balanceType?: 'Debit' | 'Credit';
    level: number;
    description?: string;
    isPayable: boolean;
    parentCode: string | null;
}

export interface JournalEntryLine {
  id?: string;
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
}

export interface JournalEntry {
  id?: string;
  entryNumber: string;
  date: any; 
  narration: string;
  reference?: string;
  totalDebit: number;
  totalCredit: number;
  status: 'draft' | 'posted';
  lines: JournalEntryLine[];
  clientId?: string;
  transactionId?: string;
  createdAt: any; 
  createdBy?: string;
}

export interface WorkStageProgress {
  id?: string;
  transactionId?: string;
  visitId: string;
  stageId: string;
  stageName: string;
  selectedBy: string; 
  selectedAt: any; 
}

export interface QuotationItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  condition?: string;
}

export interface Quotation {
  id?: string;
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
  items: QuotationItem[];
  totalAmount: number;
  notes?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  createdAt: any; 
  createdBy?: string;
  scopeOfWork?: ContractScopeItem[];
  termsAndConditions?: ContractTerm[];
  openClauses?: ContractTerm[];
  templateDescription?: string;
  transactionId?: string;
}

export interface Vendor {
    id?: string;
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
}

export interface PurchaseOrderItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface PurchaseOrder {
    id?: string;
    poNumber: string;
    orderDate: any;
    vendorId: string;
    vendorName: string;
    projectId?: string;
    items: PurchaseOrderItem[];
    totalAmount: number;
    paymentTerms?: string;
    notes?: string;
    status: 'draft' | 'approved' | 'partially_received' | 'received' | 'cancelled';
}

    