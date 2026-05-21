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

export interface TechnicalSpecifications {
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
}

export interface Quotation extends BaseEntity {
    id?: string;
    quotationNumber: string;
    quotationSequence: number;
    quotationYear: number;
    quotationDept: string;
    clientId: string;
    clientName: string;
    subject: string;
    date: Timestamp | any;
    validUntil: Timestamp | any;
    totalAmount: number;
    status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
    items: any[];
    layoutBlocks?: any[];
    financialsType: 'fixed' | 'percentage';
    totalArea?: number;
    floorsCount?: number;
    basementType: 'none' | 'full' | 'half' | 'vault';
    roofExtension: 'none' | 'quarter' | 'half';
    workNature: 'labor_only' | 'with_materials';
    transactionTypeId?: string;
    subServiceId?: string;
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
  specs?: TechnicalSpecifications;
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