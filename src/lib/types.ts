
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
    warrantyMonths?: number; // مضافة لتتبع الكفالات
}
export interface Warehouse { id?: string; name: string; isDefault?: boolean; location?: string; projectId?: string | null; companyId?: string | null; createdAt?: any; }
export interface JournalEntry { id?: string; entryNumber: string; date: any; narration: string; totalDebit: number; totalCredit: number; status: string; lines: any[]; createdAt: any; }
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
