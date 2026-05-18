import { Timestamp } from 'firebase/firestore';

export interface BaseEntity {
  id?: string;
  companyId?: string;           
  createdAt?: Timestamp | any; 
  createdBy?: string;          
  updatedAt?: Timestamp | any;
}

export interface UserProfile extends BaseEntity {
  uid: string;
  username: string;
  email: string;
  role: 'Developer' | 'Admin' | 'HR' | 'Accountant' | 'Engineer' | 'Secretary' | 'User';
  isActive: boolean;
  employeeId?: string;
  fullName?: string;
  jobTitle?: string;
  avatarUrl?: string;
  activatedAt?: Timestamp | any;
  isSuperAdmin?: boolean;
  currentCompanyId?: string;
  companyName?: string;
}

export interface LeaveRequest extends BaseEntity {
  employeeId: string;
  employeeName: string;
  leaveType: 'Annual' | 'Sick' | 'Emergency' | 'Unpaid';
  startDate: Timestamp | any;
  endDate: Timestamp | any;
  actualStartDate?: Timestamp | any;
  actualReturnDate?: Timestamp | any;
  days: number;
  workingDays: number;
  unpaidDays: number;
  status: 'pending' | 'approved' | 'rejected' | 'on-leave' | 'returned';
  approvedBy?: string;
  rejectedBy?: string;
  approvedAt?: Timestamp | any;
  rejectedAt?: Timestamp | any;
  notes?: string;
  passportReceived?: boolean;
}

export interface CustodyReconciliation extends BaseEntity {
  reconciliationNumber: string;
  employeeId: string;
  employeeName: string;
  date: Timestamp | any;
  totalAmount: number;
  items: any[];
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  journalEntryId?: string;
}

export interface Company extends BaseEntity {
  name: string;
  nameEn?: string;
  firebaseConfig: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  isActive: boolean;
  adminEmail: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  activityType?: string;
  subscriptionType: 'trial' | 'premium';
  trialEndDate?: Timestamp | any;
  subscriptionExpiryDate?: Timestamp | any; 
  maxUsersLimit: number;
}

export interface CompanyRequest extends BaseEntity {
    companyName: string;
    contactName: string;
    email: string; 
    username: string; 
    phone: string;
    activity?: string;
    status: 'pending' | 'activated' | 'rejected';
    activatedAt?: Timestamp | any;
    companyId?: string;
}

export interface Client extends BaseEntity {
  fileId: string;
  fileNumber: number;
  fileYear: number;
  nameAr: string;
  nameEn?: string;
  civilId?: string;
  mobile: string;
  address?: {
      governorate: string;
      area: string;
      block?: string;
      street?: string;
      houseNumber?: string;
  };
  status: 'prospective' | 'registered' | 'active' | 'completed' | 'archived' | 'contracted' | 'reContracted';
  assignedEngineer?: string;
  isActive?: boolean;
  transactionCounter?: number;
}

export interface Appointment extends BaseEntity {
  clientId?: string;
  clientName: string;
  clientMobile?: string;
  engineerId: string;
  appointmentDate: Timestamp | any;
  type: 'architectural' | 'room' | string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  meetingRoom?: string;
  color?: string;
  visitCount?: number;
  workStageUpdated?: boolean;
  transactionId?: string;
}

export interface ConstructionProject extends BaseEntity {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName?: string;
  projectCategory: 'Private (Subsidized)' | 'Private (Non-Subsidized)' | 'Commercial' | 'Government';
  status: string;
  progressPercentage: number;
  boqId?: string;
  linkedTransactionId?: string;
  mainEngineerId?: string;
  startDate: Timestamp | any;
  contractValue?: number;
}

export interface Boq extends BaseEntity {
  boqNumber: string;
  name: string;
  projectId?: string | null;
  totalValue: number;
  itemCount: number;
  status: string;
}

export interface BoqItem extends BaseEntity {
  itemNumber: string;
  description: string;
  unit?: string;
  quantity: number;
  sellingUnitPrice: number;
  notes?: string;
  parentId?: string | null;
  level: number;
  isHeader: boolean;
  itemId?: string;
}

export interface JournalEntry extends BaseEntity {
  entryNumber: string;
  date: Timestamp | any;
  narration: string;
  totalDebit: number;
  totalCredit: number;
  status: 'draft' | 'posted';
  lines: any[];
  clientId?: string;
  transactionId?: string;
  linkedReceiptId?: string;
  reconciliationStatus?: 'reconciled' | 'unreconciled';
}

export interface Employee extends BaseEntity {
  employeeNumber: string;
  fullName: string;
  civilId: string;
  mobile: string;
  department: string;
  jobTitle: string;
  hireDate: Timestamp | any;
  contractType: string;
  basicSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  status: 'active' | 'on-leave' | 'terminated';
  residencyExpiry?: Timestamp | any;
  annualLeaveUsed?: number;
  annualLeaveAccrued?: number;
  carriedLeaveDays?: number;
  terminationDate?: Timestamp | any;
  terminationReason?: string;
  workStartTime?: string | null;
  workEndTime?: string | null;
}

export interface Account extends BaseEntity {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  level: number;
  parentCode: string | null;
  isPayable: boolean;
  statement: 'Balance Sheet' | 'Income Statement';
  balanceType: 'Debit' | 'Credit';
  employeeId?: string | null;
}

export interface Item extends BaseEntity {
  name: string;
  sku: string;
  categoryId: string;
  costPrice: number;
  sellingPrice: number;
  unitOfMeasure: string;
  inventoryTracked?: boolean;
}

export interface Warehouse extends BaseEntity {
  name: string;
  isDefault: boolean;
}

export interface Vendor extends BaseEntity {
  name: string;
  phone: string;
}

export interface PurchaseOrder extends BaseEntity {
  poNumber: string;
  orderDate: Timestamp | any;
  vendorId: string;
  vendorName: string;
  totalAmount: number;
  status: 'draft' | 'approved' | 'received' | 'partially_received' | 'cancelled';
  rfqId?: string;
}

export interface FieldVisit extends BaseEntity {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  scheduledDate: Timestamp | any;
  plannedStageName: string;
  status: 'planned' | 'confirmed' | 'cancelled';
  engineerId: string | null;
  engineerName: string;
  confirmationData?: any;
}

export interface WorkStage extends BaseEntity {
  name: string;
  order?: number;
}

export interface Department extends BaseEntity {
  name: string;
  order?: number;
}

export interface Job extends BaseEntity {
  name: string;
}

export interface Governorate extends BaseEntity {
  name: string;
}

export interface Area extends BaseEntity {
  name: string;
}

export interface TransactionType extends BaseEntity {
  name: string;
}

export interface Holiday extends BaseEntity {
  name: string;
  date: Timestamp | any;
}

export interface Notification extends BaseEntity {
  userId: string;
  title: string;
  body: string;
  isRead: boolean;
  link?: string;
}

export interface ClientTransaction extends BaseEntity {
    transactionNumber: string;
    clientId: string;
    transactionType: string;
    status: 'new' | 'in-progress' | 'completed' | 'submitted' | 'on-hold';
    assignedEngineerId?: string | null;
    stages?: any[];
    contract?: any;
    boqId?: string;
}

export interface AttendanceRecord {
  date: Timestamp | any;
  employeeId: string;
  status: 'present' | 'absent' | 'late' | 'half_day';
  auditStatus: 'pending' | 'verified' | 'waived';
  manualDeductionDays?: number;
  anomalyDescription?: string;
  allPunches?: string[];
}

export interface MonthlyAttendance extends BaseEntity {
  employeeId: string;
  year: number;
  month: number;
  records: AttendanceRecord[];
  summary: {
    presentDays: number;
    absentDays: number;
    lateDays: number;
  };
}

export interface PermissionRequest extends BaseEntity {
  employeeId: string;
  employeeName: string;
  type: 'late_arrival' | 'early_departure';
  date: Timestamp | any;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Payslip extends BaseEntity {
  employeeId: string;
  employeeName: string;
  year: number;
  month: number;
  type: 'Monthly' | 'Leave';
  earnings: {
    basicSalary: number;
    housingAllowance: number;
    transportAllowance: number;
    commission: number;
  };
  deductions: {
    absenceDeduction: number;
    lateDeduction: number;
    otherDeductions: number;
  };
  netSalary: number;
  status: 'draft' | 'processed' | 'paid';
}
