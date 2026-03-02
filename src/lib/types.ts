
/**
 * @fileOverview القاموس البرمجي الشامل لنظام Nova ERP المطور.
 * تم تحديثه ليشمل ميزة دعم مواد البناء (السكن الخاص الكويتي).
 */

import { Timestamp } from 'firebase/firestore';

export interface BaseEntity {
  id?: string;
  companyId?: string;           
  createdAt: Timestamp | any;
  createdBy: string;
  updatedAt?: Timestamp | any;
}

export type ProjectCategory = 'Private (Subsidized)' | 'Private (Non-Subsidized)' | 'Commercial' | 'Government';

export interface SubsidyQuota {
    itemId: string;
    itemName: string;
    allocatedQuantity: number;
    receivedQuantity: number;
    consumedQuantity: number;
    unitPrice: number; // سعر السوق للتقييم المحاسبي
}

export interface ConstructionProject extends BaseEntity {
    projectId: string;          
    projectName: string;
    clientId: string;
    clientName?: string;
    projectType: 'استشاري' | 'تنفيذي' | 'مختلط';
    projectCategory: ProjectCategory;
    contractValue: number;
    startDate: Timestamp | any;
    endDate: Timestamp | any;
    status: 'مخطط' | 'قيد التنفيذ' | 'مكتمل' | 'معلق' | 'ملغى';
    mainEngineerId: string;
    mainEngineerName?: string;
    progressPercentage: number;
    boqId?: string;             
    linkedTransactionId?: string; 
    constructionTypeName?: string;
    subcontractorId?: string;    
    subcontractorName?: string;
    numFloors?: string; 
    // ميزات الدعم
    subsidyQuotas?: SubsidyQuota[];
}

export interface JournalEntry extends BaseEntity { 
    entryNumber: string;        
    date: Timestamp | any;            
    narration: string;          
    totalDebit: number;         
    totalCredit: number;        
    status: 'draft' | 'posted'; 
    lines: JournalEntryLine[];  
    transactionId?: string;     
    clientId?: string;          
    linkedReceiptId?: string;   
    reconciliationStatus?: 'unreconciled' | 'reconciled';
    reconciliationInfo?: any;
    isBypassed?: boolean;
    isSubsidyEntry?: boolean; // وسم القيود الخاصة بالدعم
}

export interface JournalEntryLine {
    accountId: string;          
    accountName: string;        
    debit: number;              
    credit: number;             
    auto_profit_center?: string;
    auto_resource_id?: string;  
    auto_dept_id?: string;      
}

export interface Employee extends BaseEntity {
    employeeNumber: string;     
    fullName: string;           
    nameEn?: string;
    civilId: string;
    mobile: string;
    basicSalary: number;        
    housingAllowance?: number;  
    transportAllowance?: number;
    contractType: string;
    status: 'active' | 'terminated' | 'on-leave';
    hireDate: Timestamp | any;        
    terminationDate?: Timestamp | any; 
    terminationReason?: 'resignation' | 'termination';
    residencyExpiry?: Timestamp | any; 
    department?: string;
    jobTitle?: string;
    profilePicture?: string;
    contractPercentage?: number;
}

export interface FieldVisit extends BaseEntity { 
    projectId: string;          
    projectName: string;
    clientId: string;
    clientName: string; 
    scheduledDate: Timestamp | any; 
    status: 'planned' | 'confirmed' | 'cancelled'; 
    plannedStageId: string;     
    plannedStageName: string;   
    phaseEndDate?: Timestamp | any; 
    numFloors?: string;         
    engineerId?: string | null;
    engineerName?: string | null; 
    details?: string;           
    requiredPayment?: string;   
    teamIds: string[];          
    teamNames: string[];        
    confirmationData?: {
        confirmedAt: Timestamp | any;
        notes: string;
        location?: { latitude: number, longitude: number, accuracy: number };
        isCompleted: boolean;
        progressAchieved: number; 
    };
}

export interface PaymentApplication extends BaseEntity { 
    applicationNumber: string; 
    date: Timestamp | any; 
    projectId: string; 
    clientId: string; 
    clientName: string; 
    projectName: string; 
    totalAmount: number; 
    subsidizedMaterialsValue: number; // قيمة المواد المدعومة المخصومة
    netDueAmount: number; // الصافي المستحق للشركة
    status: 'draft' | 'submitted' | 'approved' | 'paid' | 'cancelled'; 
    items: any[]; 
    journalEntryId?: string; 
}

export interface Warehouse extends BaseEntity { name: string; location?: string; isDefault?: boolean; projectId?: string | null; companyId?: string | null; }
export interface Item extends BaseEntity { name: string; sku: string; categoryId: string; unitOfMeasure: string; costPrice?: number; sellingPrice?: number; inventoryTracked?: boolean; isSubsidyEligible?: boolean; }
export interface RequestForQuotation extends BaseEntity { rfqNumber: string; date: Timestamp | any; status: 'draft' | 'sent' | 'closed' | 'cancelled'; vendorIds: string[]; items: any[]; awardedVendorId?: string; awardedPoIds?: string[]; awardedItems?: Record<string, string>; isBypassed?: boolean; }
export interface PurchaseOrder extends BaseEntity { poNumber: string; orderDate: Timestamp | any; vendorId: string; vendorName: string; totalAmount: number; status: 'draft' | 'approved' | 'received' | 'partially_received' | 'cancelled'; items: any[]; rfqId?: string; supplierQuotationId?: string; type?: 'standard' | 'direct_invoice'; isBypassed?: boolean; }
export interface Vendor extends BaseEntity { name: string; phone: string; contactPerson?: string; }
export interface Account extends BaseEntity { code: string; name: string; type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'; level: number; parentCode: string | null; isPayable: boolean; statement: 'Balance Sheet' | 'Income Statement'; balanceType: 'Debit' | 'Credit'; }
export interface Department extends BaseEntity { name: string; order?: number; activityTypes?: string[]; }
export interface Job extends BaseEntity { name: string; order?: number; }
export interface TransactionType extends BaseEntity { name: string; order?: number; departmentIds?: string[]; activityType?: string; }
export interface WorkStage extends BaseEntity { name: string; order?: number; stageType: 'sequential' | 'parallel'; trackingType: 'duration' | 'occurrence' | 'none'; allowedRoles?: string[]; }
export interface ItemCategory extends BaseEntity { name: string; order?: number; parentCategoryId: string | null; }
export interface Boq extends BaseEntity { boqNumber: string; name: string; status: string; totalValue: number; itemCount: number; clientId?: string | null; transactionId?: string | null; projectId?: string | null; }
export interface BoqItem extends BaseEntity { itemNumber: string; description: string; quantity: number; sellingUnitPrice: number; level: number; isHeader: boolean; parentId: string | null; startDate?: Timestamp | any; endDate?: Timestamp | any; itemId?: string; notes?: string; progressPercentage?: number; }
export interface Notification extends BaseEntity { userId: string; title: string; body: string; link?: string; isRead: boolean; }
export interface UserProfile { id?: string; uid: string; username: string; email: string; role: 'Admin' | 'Engineer' | 'Accountant' | 'Secretary' | 'HR'; employeeId: string; companyId: string; isActive: boolean; createdAt: Timestamp | any; }
