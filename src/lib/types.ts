import { Timestamp } from 'firebase/firestore';

export interface BaseEntity {
  id?: string;
  companyId?: string;           
  createdAt?: Timestamp | any; 
  createdBy?: string;          
  updatedAt?: Timestamp | any;
  updatedBy?: string;           
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
  bio?: string;
  totalPoints?: number;         
  currentMood?: string;         
  currentFocus?: string;        
  activatedAt?: Timestamp | any;
  isSuperAdmin?: boolean;
  currentCompanyId?: string;
  companyName?: string;
}

export interface AppointmentAuditLog extends BaseEntity {
    action: 'created' | 'rescheduled' | 'updated' | 'cancelled' | 'confirmed';
    details: string;
    userName: string;
    userAvatar?: string;
}

export interface HubPost extends BaseEntity {
    userId: string;
    userName: string;
    userAvatar?: string;
    postType: 'system_achievement' | 'employee_idea' | 'kudos' | 'birthday' | 'anniversary';
    content: string;
    moodIcon?: string;
    votesCount: number;
    voters?: string[];
    pointsAwarded: number;
    metadata?: any; 
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
  adminComment?: string;
  rejectionReason?: string;
  passportReceived?: boolean;
}

export interface PermissionRequest extends BaseEntity {
  employeeId: string;
  employeeName: string;
  type: 'late_arrival' | 'early_departure';
  date: Timestamp | any;
  durationHours: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminComment?: string;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: Timestamp | any;
}

export interface CashReceipt extends BaseEntity {
    id?: string;
    voucherNumber: string;
    voucherSequence: number;
    voucherYear: number;
    clientId: string | null;
    clientNameAr: string;
    projectId?: string | null;
    projectNameAr?: string | null;
    amount: number;
    amountInWords: string;
    receiptDate: Timestamp | any;
    paymentMethod: string;
    description: string;
    reference?: string;
    journalEntryId?: string;
    commissionAmount?: number;
    isBypassed?: boolean;
}

export interface PaymentVoucher extends BaseEntity {
    id?: string;
    voucherNumber: string;
    voucherSequence: number;
    voucherYear: number;
    payeeName: string;
    payeeType: string;
    amount: number;
    amountInWords: string;
    paymentDate: Timestamp | any;
    paymentMethod: string;
    description: string;
    reference?: string;
    debitAccountId: string;
    debitAccountName: string;
    creditAccountId: string;
    creditAccountName: string;
    status: 'draft' | 'paid' | 'cancelled';
    journalEntryId?: string;
    employeeId?: string;
    renewalExpiryDate?: any;
    clientId?: string;
    transactionId?: string;
}

export interface Payslip extends BaseEntity {
    id?: string;
    employeeId: string;
    employeeName: string;
    employeeNumber?: string;
    year: number;
    month: number;
    type?: 'Monthly' | 'Leave';
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
    paidAt?: Timestamp | any;
}

export interface Company extends BaseEntity {
  id: string;
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
  engineerName?: string;
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
  subcontractorId?: string | null;
  subcontractorName?: string | null;
  subsidyQuotas?: any[];
}

export interface Boq extends BaseEntity {
  boqNumber: string;
  name: string;
  projectId?: string | null;
  clientName?: string | null;
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
  startDate?: Timestamp | any;
  endDate?: Timestamp | any;
}

export interface JournalEntry extends BaseEntity {
  id?: string;
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
  passportExpiry?: Timestamp | any;
  drivingLicenseExpiry?: Timestamp | any;
  healthCardExpiry?: Timestamp | any;
  annualLeaveUsed?: number;
  annualLeaveAccrued?: number;
  carriedLeaveDays?: number;
  terminationDate?: Timestamp | any;
  terminationReason?: string;
  workStartTime?: string | null;
  workEndTime?: string | null;
  lastLeaveResetDate?: Timestamp | any;
  contractPercentage?: number;
  dailyRate?: number;
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
  expiryTracked?: boolean;
  warrantyYears?: number;
  isSubsidyEligible?: boolean;
}

export interface Warehouse extends BaseEntity {
  name: string;
  location?: string;
  isDefault: boolean;
  projectId?: string | null;
}

export interface Vendor extends BaseEntity {
  name: string;
  phone: string;
  contactPerson?: string;
  email?: string;
  address?: string;
}

export interface PurchaseOrder extends BaseEntity {
  id?: string;
  poNumber: string;
  orderDate: Timestamp | any;
  vendorId: string;
  vendorName: string;
  totalAmount: number;
  status: 'draft' | 'approved' | 'received' | 'partially_received' | 'cancelled';
  rfqId?: string;
  projectId?: string | null;
  items: any[];
  paymentTerms?: string;
  notes?: string;
  isBypassed?: boolean;
  discountAmount?: number;
  deliveryFees?: number;
  supplierQuotationId?: string;
}

export interface FieldVisit extends BaseEntity {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  scheduledDate: Timestamp | any;
  plannedStageId?: string;
  plannedStageName: string;
  phaseEndDate?: Timestamp | any | null;
  status: 'planned' | 'confirmed' | 'cancelled';
  engineerId: string | null;
  engineerName: string;
  teamIds?: string[];
  teamNames?: string[];
  subcontractorId?: string | null;
  subcontractorName?: string | null;
  details?: string;
  confirmationData?: any;
  transactionId?: string;
  transactionType?: string;
}

export interface WorkStage extends BaseEntity {
  name: string;
  order?: number;
  stageType?: 'sequential' | 'parallel';
  trackingType?: 'none' | 'duration' | 'occurrence';
  expectedDurationDays?: number | null;
  maxOccurrences?: number | null;
  allowedRoles?: string[];
  enableModificationTracking?: boolean;
}

export interface Department extends BaseEntity {
  name: string;
  order?: number;
  activityTypes?: string[];
}

export interface Job extends BaseEntity {
  name: string;
  order?: number;
  parentId?: string;
}

export interface Governorate extends BaseEntity {
  name: string;
  order?: number;
}

export interface Area extends BaseEntity {
  name: string;
  order?: number;
  parentId?: string;
}

export interface TransactionType extends BaseEntity {
  name: string;
  order?: number;
  activityType?: string;
  departmentIds?: string[];
}

export interface SubService extends BaseEntity {
    name: string;
    order?: number;
    parentId?: string;
}

export interface Holiday extends BaseEntity {
  name: string;
  date: Timestamp | any;
}

export interface Notification extends BaseEntity {
  id?: string;
  userId: string;
  title: string;
  body: string;
  isRead: boolean;
  link?: string;
  createdAt?: any;
}

export interface ClientTransaction extends BaseEntity {
    id?: string;
    transactionNumber: string;
    clientId: string;
    transactionType: string;
    subServiceId?: string | null;
    subServiceName?: string | null;
    status: 'new' | 'in-progress' | 'completed' | 'submitted' | 'on-hold';
    assignedEngineerId?: string | null;
    transactionTypeId?: string | null;
    departmentId?: string | null;
    stages?: any[];
    contract?: any;
    boqId?: string;
    projectId?: string;
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

export interface AuditLog extends BaseEntity {
    changeType: string;
    field: string;
    oldValue: any;
    newValue: any;
    effectiveDate: Timestamp | any;
    changedBy: string;
    notes?: string;
}

export interface WorkTeam extends BaseEntity {
    name: string;
}

export interface ContractTemplate extends BaseEntity {
    id?: string;
    title: string;
    description?: string;
    templateType: 'Consulting' | 'Execution';
    workNature?: 'labor_only' | 'with_materials';
    transactionTypeId?: string | null; 
    subServiceId?: string | null;    
    financials?: {
        type: 'fixed' | 'percentage';
        totalAmount?: number;
        milestones: any[];
    };
}

export interface Subcontractor extends BaseEntity {
    id?: string;
    name: string;
    type: string;
    specialization?: string;
    contactPerson?: string;
    phone: string;
    mobile?: string;
    email?: string;
    address?: string;
    bankAccount?: {
        bankName: string;
        accountNumber: string;
        iban: string;
    };
    isActive: boolean;
    performanceRating?: number;
    blacklisted?: boolean;
    blacklistedReason?: string;
}

export interface SubcontractorCertificate extends BaseEntity {
    id?: string;
    certificateNumber: string;
    subcontractorId: string;
    subcontractorName: string;
    projectId: string;
    projectName: string;
    date: Timestamp | any;
    amount: number;
    description: string;
    status: 'draft' | 'approved' | 'cancelled';
    journalEntryId?: string;
}

export interface RecurringObligation extends BaseEntity {
    id?: string;
    title: string;
    type: 'rent' | 'installment' | 'vendor_debt' | 'daily_labor';
    amount: number;
    frequency: 'weekly' | 'monthly';
    dueDate: Timestamp | any;
    lastGeneratedDate?: Timestamp | any;
    debitAccountId: string;
    debitAccountName?: string;
    creditAccountId: string;
    creditAccountName?: string;
    status: 'active' | 'paused';
}

export interface UserProductivityItem extends BaseEntity {
  id?: string;
  userId: string;
  entryType: 'task' | 'bookmark';
  title: string;
  actionType?: 'review' | 'decision' | 'design' | 'redesign' | 'meeting' | 'general';
  status?: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  startDate?: Timestamp | any;
  dueDate?: Timestamp | any;
  completedAt?: Timestamp | any;
  sourceModule: string;
  sourceId: string;
  sourceSubId?: string;
  sourceUrl?: string;
  viewCounter?: number;
  lastViewedAt?: Timestamp | any;
}

export interface RequestForQuotation extends BaseEntity {
    id?: string;
    rfqNumber: string;
    date: Timestamp | any;
    vendorIds: string[];
    prospectiveVendors?: { id: string; name: string }[];
    projectId?: string | null;
    items: { id: string; internalItemId: string; itemName: string; quantity: number }[];
    status: 'draft' | 'sent' | 'closed' | 'cancelled';
    awardedVendorId?: string;
    awardedPoIds?: string[];
    awardedItems?: Record<string, string>;
}

export interface SupplierQuotation extends BaseEntity {
    id?: string;
    rfqId: string;
    vendorId: string;
    quotationReference?: string;
    date: Timestamp | any;
    deliveryTimeDays?: number;
    paymentTerms?: string;
    discountAmount?: number;
    deliveryFees?: number;
    items: { rfqItemId: string; unitPrice: number }[];
}

export interface ItemCategory extends BaseEntity {
    id?: string;
    name: string;
    parentCategoryId?: string | null;
    order?: number;
    boqReferenceItemIds?: string[];
}

export interface BoqReferenceItem extends BaseEntity {
    name: string;
    parentBoqReferenceItemId?: string | null;
    unit?: string;
    isHeader?: boolean;
}

export interface InventoryAdjustment extends BaseEntity {
    id?: string;
    adjustmentNumber: string;
    date: Timestamp | any;
    type: 'material_issue' | 'damage' | 'theft' | 'transfer' | 'opening_balance' | 'purchase_return' | 'sales_return' | 'other';
    issueType?: 'project_site' | 'direct_sale';
    notes?: string;
    items: any[];
    projectId?: string | null;
    projectName?: string | null;
    clientId?: string | null;
    clientName?: string | null;
    warehouseId?: string | null;
    fromWarehouseId?: string | null;
    toWarehouseId?: string | null;
    journalEntryId?: string;
    isDirectReturn?: boolean;
    recoveredDiscount?: number;
}

export interface PaymentApplication extends BaseEntity {
    id?: string;
    applicationNumber: string;
    date: Timestamp | any;
    projectId: string;
    clientId: string;
    clientName: string;
    projectName: string;
    items: any[];
    totalAmount: number;
    subsidizedMaterialsValue?: number;
    netDueAmount: number;
    status: 'draft' | 'submitted' | 'approved' | 'paid' | 'cancelled';
    journalEntryId?: string;
}

export type TechnicalSpecifications = {
    totalArea: number;
    floorsCount: number;
    hasBasement: boolean;
    basementType: 'none' | 'full' | 'half' | 'vault';
    roofExtension: 'none' | 'quarter' | 'half';
    workNature: 'labor_only' | 'with_materials';
    bathroomsCount?: number;
    kitchensCount?: number;
    laundryRoomsCount?: number;
    sanitaryMaterialsIncluded?: boolean;
    sanitaryExtensionType?: 'ordinary' | 'suspended';
    suspendedExtensionCount?: number;
    ordinaryExtensionCount?: number;
    suspendedToiletCount?: number;
    ordinaryToiletCount?: number;
    hiddenShowerCount?: number;
    ordinaryShowerCount?: number;
    electricalPointsCount?: number;
    planReferenceNumber?: string;
};
