

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
};

export type Client = {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  totalVisits: number;
  projectIds: string[];
};

export type ProjectStatus = 'Planning' | 'In Progress' | 'Completed' | 'On Hold' | 'Cancelled';

export type EngineeringDiscipline = {
  name: 'Architectural' | 'Structural' | 'Exterior' | 'Electrical' | 'Plumbing' | 'Interior Design';
  stages: { name: string; status: 'Pending' | 'In Progress' | 'Completed' }[];
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
  title: string;
  date: string;
  description: string;
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
  name: string;
  clientId: string;
  leadEngineerId: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  description: string;
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
  date: string;
  clientId: string;
  projectId: string;
  engineerId: string;
  notes: string;
};

export type PaymentMilestone = {
  id: string;
  name: string;
  percentage: number;
  dueDate: string;
  status: 'Pending' | 'Completed' | 'Overdue';
};

export type Contract = {
  id: string;
  projectId: string;
  clientId: string;
  engineerId: string;
  title: string;
  totalAmount: number;
  startDate: string;
  milestones: PaymentMilestone[];
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
    date: string;
    clientId: string;
    amount: number;
    amountInWords: string;
    paymentMethod: 'Cash' | 'Cheque' | 'Bank Transfer';
    reference?: string; // Cheque number or transfer reference
    description: string;
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

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: 'bags' | 'tons' | 'pieces' | 'sqm';
  lowStockThreshold: number;
  supplier: string;
};

export type Employee = {
    id: string;
    fullName: string; 
    nameEn?: string;
    dob?: string;
    gender?: 'male' | 'female';
    civilId: string;
    visaType?: 'worker' | 'engineer' | 'driver' | 'admin' | 'kuwaiti';
    residencyExpiry?: string;
    contractExpiry?: string;
    mobile: string;
    emergencyContact?: string;
    email?: string;
    jobTitle?: string;
    position?: 'head' | 'employee' | 'assistant' | 'contractor';
    salaryPaymentType?: 'cash' | 'cheque' | 'transfer';
    bankName?: string;
    accountNumber?: string;
    iban?: string;
    profilePicture?: string;
    hireDate: string; // ISO String
    noticeStartDate: string | null; // Date when notice is given
    terminationDate: string | null;
    terminationReason: 'resignation' | 'termination' | null;
    contractType: 'permanent' | 'temporary' | 'subcontractor';
    department: string;
    basicSalary: number; // KWD
    housingAllowance?: number;
    transportAllowance?: number;
    status: 'active' | 'on-leave' | 'terminated';
    lastVacationAccrualDate: string; // ISO String
    annualLeaveAccrued?: number;
    annualLeaveUsed?: number;
    carriedLeaveDays?: number;
    sickLeaveUsed?: number;
    emergencyLeaveUsed?: number;
    maxEmergencyLeave?: number;
    lastLeaveResetDate?: string; // ISO String
    createdAt?: any; 
    annualLeaveBalance?: number;
};

export interface LeaveRequest {
    id: string;
    employeeId: string;
    employeeName: string;
    leaveType: 'Annual' | 'Sick' | 'Emergency' | 'Unpaid';
    startDate: string;
    endDate: string;
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
    date: any; // Can be string or Timestamp
}
