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

export interface WorkStage extends BaseEntity {
  name: string;
  order: number;
  parentId: string; // Linked to SubService ID
  trackingType: 'duration' | 'occurrence' | 'hybrid' | 'none'; // Added Hybrid
  expectedDurationDays?: number;
  maxOccurrences?: number;
}

export interface TransactionStage {
  stageId: string;
  name: string;
  status: 'pending' | 'in-progress' | 'completed';
  trackingType: 'duration' | 'occurrence' | 'hybrid' | 'none';
  startDate?: Timestamp | any;
  endDate?: Timestamp | any;
  expectedEndDate?: Timestamp | any;
  currentCount?: number;
  maxOccurrences?: number;
  order: number;
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
    stages?: TransactionStage[];
    contract?: any;
    boqId?: string;
    projectId?: string;
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
  contract?: any;
  specs?: any;
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

export interface HubPost extends BaseEntity {
    id?: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    postType: 'system_achievement' | 'employee_idea' | 'kudos' | 'birthday';
    content: string;
    moodIcon?: string;
    votesCount: number;
    voters?: string[];
    pointsAwarded: number;
}

export interface UserProductivityItem extends BaseEntity {
    id?: string;
    userId: string;
    entryType: 'task' | 'bookmark';
    title: string;
    actionType?: 'review' | 'decision' | 'design' | 'redesign' | 'meeting' | 'general';
    status: 'pending' | 'in-progress' | 'completed' | 'cancelled' | null;
    startDate?: Timestamp | any;
    dueDate?: Timestamp | any;
    sourceModule: string;
    sourceId: string;
    sourceSubId?: string;
    sourceUrl?: string;
    completedAt?: Timestamp | any;
    viewCounter?: number;
    lastViewedAt?: Timestamp | any;
}

export interface AppointmentAuditLog extends BaseEntity {
    id?: string;
    action: 'created' | 'rescheduled' | 'cancelled' | 'confirmed';
    details: string;
    userName: string;
    userAvatar?: string;
}

export interface ContractTemplate extends BaseEntity {
    id?: string;
    title: string;
    description?: string;
    templateType: 'Consulting' | 'Execution';
    workNature: 'labor_only' | 'with_materials';
    transactionTypeId?: string;
    subServiceId?: string;
    financials?: {
        type: 'fixed' | 'percentage';
        totalAmount: number;
        milestones: Array<{
            name: string;
            condition: string;
            value: number;
        }>;
    };
}

export interface CashReceipt extends BaseEntity {
    voucherNumber: string;
    receiptDate: Timestamp | any;
    clientId: string | null;
    clientNameAr: string;
    projectId: string | null;
    projectNameAr?: string;
    amount: number;
    amountInWords: string;
    description: string;
    paymentMethod: string;
    reference?: string;
    journalEntryId?: string;
    visitCount?: number;
    color?: string;
}

export interface PaymentVoucher extends BaseEntity {
    voucherNumber: string;
    paymentDate: Timestamp | any;
    payeeName: string;
    payeeType: string;
    amount: number;
    amountInWords: string;
    description: string;
    paymentMethod: string;
    reference?: string;
    debitAccountId: string;
    creditAccountId: string;
    status: 'draft' | 'paid' | 'cancelled';
    journalEntryId?: string;
    employeeId?: string;
    renewalExpiryDate?: Timestamp | any;
}

export interface TechnicalSpecifications {
    totalArea: number;
    floorsCount: number;
    hasBasement: boolean;
    basementType: 'none' | 'full' | 'half' | 'vault';
    roofExtension: 'none' | 'quarter' | 'half';
    bathroomsCount?: number;
    kitchensCount?: number;
    laundryRoomsCount?: number;
    electricalPointsCount?: number;
    planReferenceNumber?: string;
    workNature?: 'labor_only' | 'with_materials';
    sanitaryExtensionType?: 'ordinary' | 'suspended';
    suspendedExtensionCount?: number;
    ordinaryExtensionCount?: number;
    suspendedToiletCount?: number;
    ordinaryToiletCount?: number;
    hiddenShowerCount?: number;
    ordinaryShowerCount?: number;
}

export interface Quotation extends BaseEntity {
    quotationNumber: string;
    clientId: string;
    clientName: string;
    subject: string;
    date: Timestamp | any;
    validUntil: Timestamp | any;
    totalAmount: number;
    status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
    items: any[];
    financialsType: 'fixed' | 'percentage';
    totalArea?: number;
    floorsCount?: number;
    basementType: 'none' | 'full' | 'half' | 'vault';
    roofExtension: 'none' | 'quarter' | 'half';
    workNature: 'labor_only' | 'with_materials';
    layoutBlocks?: any[];
}

export interface InventoryAdjustment extends BaseEntity {
    adjustmentNumber: string;
    date: Timestamp | any;
    type: 'damage' | 'theft' | 'opening_balance' | 'material_issue' | 'purchase_return' | 'sales_return' | 'other' | 'transfer';
    issueType?: 'project_site' | 'direct_sale';
    notes?: string;
    items: any[];
    warehouseId?: string;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    projectId?: string;
    projectName?: string;
    clientId?: string;
    clientName?: string;
    journalEntryId?: string;
}

export interface GoodsReceiptNote extends BaseEntity {
    grnNumber: string;
    date: Timestamp | any;
    vendorId: string;
    vendorName: string;
    purchaseOrderId?: string;
    warehouseId: string;
    totalValue: number;
    itemsReceived: any[];
    status: 'received' | 'cancelled';
    journalEntryId?: string;
}

export interface Subcontractor extends BaseEntity {
    name: string;
    type: string;
    specialization?: string;
    contactPerson?: string;
    phone: string;
    mobile?: string;
    email?: string;
    address?: string;
    isActive: boolean;
    blacklisted: boolean;
    blacklistedReason?: string;
    performanceRating?: number;
    bankAccount?: {
        bankName: string;
        accountNumber: string;
        iban: string;
    };
}

export interface SubcontractorCertificate extends BaseEntity {
    certificateNumber: string;
    date: Timestamp | any;
    subcontractorId: string;
    subcontractorName: string;
    projectId: string;
    projectName: string;
    amount: number;
    description?: string;
    status: 'draft' | 'approved' | 'cancelled';
    journalEntryId?: string;
}

export interface SubcontractorType extends BaseEntity {
    name: string;
    order?: number;
}

export interface SubcontractorSpecialization extends BaseEntity {
    name: string;
    order?: number;
    parentTypeId: string;
}

export interface MonthlyAttendance extends BaseEntity {
    employeeId: string;
    year: number;
    month: number;
    summary: {
        presentDays: number;
        absentDays: number;
        lateDays: number;
    };
    records: any[];
}
