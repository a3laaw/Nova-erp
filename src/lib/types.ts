
/**
 * @fileOverview القاموس البرمجي الشامل لنظام Nova ERP المطور.
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
export type AreaRange = '100-199' | '200-299' | '300-400';

export interface SubsidyQuota {
    itemId: string;
    itemName: string;
    allocatedAmount: number; 
    allocatedQuantity: number; 
    receivedQuantity: number;
    consumedQuantity: number;
    unitPrice: number; 
}

export interface TechnicalSpecifications {
    totalArea: number;
    basementType: 'none' | 'full' | 'half' | 'vault';
    floorsCount: number;
    roofExtension: 'none' | 'quarter' | 'half';
    workNature?: 'labor_only' | 'with_materials'; 
    
    // مواصفات الصحي التفصيلية
    bathroomsCount?: number;
    kitchensCount?: number;
    laundryRoomsCount?: number;
    sanitaryMaterialsIncluded?: boolean;
    sanitaryExtensionType?: 'ordinary' | 'suspended';
    toiletType?: 'ordinary' | 'suspended';
    showerType?: 'ordinary' | 'hidden';
    
    // أعداد أنواع التمديد (للتوزيع الرقمي)
    suspendedExtensionCount?: number;
    ordinaryExtensionCount?: number;
    
    // أعداد أنواع المراحيض
    suspendedToiletCount?: number;
    ordinaryToiletCount?: number;
    
    // أعداد أنواع الشاور
    hiddenShowerCount?: number;
    ordinaryShowerCount?: number;

    // مواصفات الكهرباء
    electricalPointsCount?: number;
    planReferenceNumber?: string;
}

export interface ConstructionProject extends BaseEntity, TechnicalSpecifications {
    projectId: string;          
    projectName: string;
    clientId: string;
    clientName?: string;
    projectCategory: ProjectCategory;
    projectType?: string;
    
    siteAddress: {
        governorate: string;
        area: string;
        block?: string;
        street?: string;
        houseNumber?: string;
    };

    subsidyAreaRange?: AreaRange;
    subsidyRequestId?: string;
    subsidyExpiryDate?: Timestamp | any;
    
    startDate: Timestamp | any;
    status: 'مخطط' | 'قيد التنفيذ' | 'مكتمل' | 'معلق' | 'ملغى';
    mainEngineerId: string;
    mainEngineerName?: string;
    progressPercentage: number;
    boqId?: string;             
    linkedTransactionId?: string; 
    subsidyQuotas?: SubsidyQuota[];
}

export interface ContractTemplate extends BaseEntity {
    title: string;
    description?: string;
    templateType: 'Consulting' | 'Execution';
    constructionTypeId?: string;
    transactionTypes?: string[];
    workNature: 'labor_only' | 'with_materials';
    scopeOfWork: ContractScopeItem[];
    termsAndConditions: ContractTerm[];
    financials: {
        type: 'fixed' | 'percentage';
        totalAmount: number;
        discount: number;
        milestones: ContractFinancialMilestone[];
    };
    openClauses?: ContractTerm[];
}

export interface ContractScopeItem {
    id: string;
    title: string;
    description: string;
}

export interface ContractTerm {
    id: string;
    text: string;
}

export interface ContractFinancialMilestone {
    id: string;
    name: string;
    value: number;
    condition?: string;
}

export interface Quotation extends BaseEntity, TechnicalSpecifications {
    quotationNumber: string;
    quotationSequence: number;
    quotationYear: number;
    clientId: string;
    clientName: string;
    subject: string;
    date: Timestamp | any;
    validUntil: Timestamp | any;
    status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
    items: {
        id: string;
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
        condition?: string;
        percentage?: number;
    }[];
    totalAmount: number;
    financialsType: 'fixed' | 'percentage';
    notes?: string;
    templateId?: string;
    templateDescription?: string;
    scopeOfWork?: any[];
    termsAndConditions?: any[];
    openClauses?: any[];
    projectId?: string | null;
    transactionId?: string | null;
}

export interface ContractClause {
    id: string;
    name: string;
    amount: number;
    status: 'غير مستحقة' | 'مستحقة' | 'مدفوعة';
    condition?: string; 
    percentage?: number;
}

export interface ClientTransaction extends BaseEntity {
    transactionNumber: string;
    clientId: string;
    transactionType: string;
    description?: string;
    status: 'new' | 'in-progress' | 'completed' | 'submitted' | 'on-hold' | 'cancelled';
    assignedEngineerId?: string | null;
    transactionTypeId?: string;
    stages?: any[];
    contract?: {
        clauses: ContractClause[];
        totalAmount: number;
        financialsType: 'fixed' | 'percentage';
        scopeOfWork?: any[];
        termsAndConditions?: any[];
        openClauses?: any[];
        specs?: TechnicalSpecifications; 
    };
    boqId?: string;
    projectId?: string;
}

export interface WorkShift extends BaseEntity {
    name: string;
    startTime: string;
    endTime: string;
    isDefault?: boolean;
}

export interface Employee extends BaseEntity {
    employeeNumber: string;     
    fullName: string;           
    civilId: string;
    mobile: string;
    status: 'active' | 'terminated' | 'on-leave';
    department?: string;
    jobTitle?: string;
    workTeam?: string;          
    basicSalary: number;
    housingAllowance?: number;
    transportAllowance?: number;
    contractPercentage?: number;
    profilePicture?: string;
    hireDate: any;
    residencyExpiry?: any;
    dob?: any;
    terminationDate?: any;
    terminationReason?: string;
    carriedLeaveDays?: number;
    annualLeaveAccrued?: number;
    annualLeaveUsed?: number;
    sickLeaveUsed?: number;
    emergencyLeaveUsed?: number;
    contractType?: 'permanent' | 'temporary' | 'piece-rate' | 'percentage' | 'part-time' | 'special' | 'day_laborer';
    nameEn?: string;
    gender?: 'male' | 'female';
    nationality?: string;
    salaryPaymentType?: 'cash' | 'cheque' | 'transfer';
    bankName?: string;
    accountNumber?: string;
    iban?: string;
    shiftId?: string;           // ربط الموظف بفترة دوام
    workStartTime: string;      // وقت البداية الفعلي (قد يكون مخصصاً)
    workEndTime: string;        // وقت النهاية الفعلي
    pieceRateMode?: 'salary_with_target' | 'per_piece';
    targetDescription?: number;
    pieceRate?: number;
    dailyRate?: number;
}

export interface Warehouse extends BaseEntity { name: string; location?: string; isDefault?: boolean; }
export interface Item extends BaseEntity { name: string; sku: string; categoryId: string; unitOfMeasure: string; costPrice?: number; sellingPrice?: number; inventoryTracked?: boolean; isSubsidyEligible?: boolean; warrantyYears?: number; }
export interface Vendor extends BaseEntity { name: string; phone: string; contactPerson?: string; }
export interface Account extends BaseEntity { code: string; name: string; type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'; level: number; parentCode: string | null; isPayable: boolean; statement: 'Balance Sheet' | 'Income Statement'; balanceType: 'Debit' | 'Credit'; }
export interface Department extends BaseEntity { name: string; order?: number; activityTypes?: string[]; }
export interface Governorate extends BaseEntity { name: string; order?: number; }
export interface Area extends BaseEntity { name: string; order?: number; }
export interface TransactionType extends BaseEntity { name: string; order?: number; activityType?: string; departmentIds?: string[]; }
export interface Company extends BaseEntity { name: string; crNumber?: string; activityType?: string; }
export interface ConstructionType extends BaseEntity { name: string; }
export interface WorkStage extends BaseEntity { name: string; order?: number; stageType: 'sequential' | 'parallel'; trackingType: 'duration' | 'occurrence' | 'none'; expectedDurationDays?: number | null; maxOccurrences?: number | null; allowedRoles?: string[]; allowedDuringStages?: string[]; nextStageIds?: string[]; enableModificationTracking?: boolean; }
export interface PermissionRequest extends BaseEntity { employeeId: string; employeeName: string; type: 'late_arrival' | 'early_departure'; date: any; reason: string; status: 'pending' | 'approved' | 'rejected'; approvedBy?: string; approvedAt?: any; rejectionReason?: string; }
export interface Holiday extends BaseEntity { name: string; date: any; }
export interface MonthlyAttendance extends BaseEntity { employeeId: string; year: number; month: number; records: any[]; summary: { presentDays: number; absentDays: number; lateDays: number; leaveDays: number; totalDays: number; }; }
export interface Payslip extends BaseEntity { employeeId: string; employeeName: string; year: number; month: number; type: 'Monthly' | 'Leave'; earnings: { basicSalary: number; housingAllowance: number; transportAllowance: number; commission: number; }; deductions: { absenceDeduction: number; otherDeductions: number; }; netSalary: number; status: 'draft' | 'processed' | 'paid'; notes?: string; attendanceId?: string; leaveRequestId?: string; paidAt?: any; salaryPaymentType?: string; }
export interface LeaveRequest extends BaseEntity { employeeId: string; employeeName: string; leaveType: 'Annual' | 'Sick' | 'Emergency' | 'Unpaid'; startDate: any; endDate: any; days: number; workingDays: number; unpaidDays?: number; status: 'pending' | 'approved' | 'rejected' | 'on-leave' | 'returned'; approvedBy?: string; approvedAt?: any; rejectionReason?: string; notes?: string; passportReceived?: boolean; isSalaryPaid?: boolean; actualStartDate?: any; actualReturnDate?: any; }
export interface Notification extends BaseEntity { userId: string; title: string; body: string; link?: string; isRead: boolean; }
export interface RecurringObligation extends BaseEntity { title: string; type: 'rent' | 'installment' | 'vendor_debt' | 'daily_labor'; amount: number; frequency: 'weekly' | 'monthly'; dueDate: any; lastGeneratedDate?: any; debitAccountId: string; debitAccountName?: string; creditAccountId: string; creditAccountName?: string; status: 'active' | 'paused'; }
export interface FieldVisit extends BaseEntity { projectId: string; projectName: string; clientId: string; clientName: string; transactionId: string; transactionType: string; engineerId: string | null; engineerName: string; scheduledDate: any; plannedStageId: string; plannedStageName: string; phaseEndDate: any; teamIds: string[]; teamNames: string[]; subcontractorId?: string | null; subcontractorName?: string | null; status: 'planned' | 'confirmed' | 'cancelled'; details?: string; confirmationData?: { confirmedAt: any; notes: string; location: { latitude: number; longitude: number; accuracy: number; } | null; isCompleted: boolean; progressAchieved: number; }; }
export interface WorkTeam extends BaseEntity { name: string; supervisorId: string; membersCount: number; specialization?: string; }
export interface CompanyActivityType extends BaseEntity { name: string; description?: string; }
export interface BoqReferenceItem extends BaseEntity { name: string; unit?: string; defaultCostPrice?: number; defaultSellingPrice?: number; isHeader?: boolean; parentBoqReferenceItemId?: string | null; transactionTypeIds?: string[]; subcontractorTypeIds?: string[]; activityTypeIds?: string[]; }
export interface SubcontractorCertificate extends BaseEntity { certificateNumber: string; subcontractorId: string; subcontractorName: string; projectId: string; projectName: string; date: any; amount: number; amountInWords: string; description: string; status: 'draft' | 'approved' | 'cancelled'; journalEntryId?: string; }
export interface SubcontractorSpecialization extends BaseEntity { name: string; }
export interface JournalEntry extends BaseEntity { entryNumber: string; date: any; narration: string; reference?: string; totalDebit: number; totalCredit: number; status: 'draft' | 'posted'; lines: { accountId: string; accountName: string; debit: number; credit: number; notes?: string; clientId?: string; transactionId?: string; auto_profit_center?: string; auto_resource_id?: string; auto_dept_id?: string; }[]; linkedReceiptId?: string; isSubsidyEntry?: boolean; isBypassed?: boolean; reconciliationStatus?: 'none' | 'reconciled'; reconciliationInfo?: any; }
export interface CashReceipt extends BaseEntity { voucherNumber: string; voucherSequence: number; voucherYear: number; clientId: string; clientNameAr: string; clientNameEn: string; amount: number; amountInWords: string; receiptDate: any; paymentMethod: string; description: string; reference?: string; journalEntryId?: string; projectId?: string | null; projectNameAr?: string | null; isBypassed?: boolean; commissionAmount?: number; }
export interface PaymentVoucher extends BaseEntity { voucherNumber: string; voucherSequence: number; voucherYear: number; payeeName: string; payeeType: string; amount: number; amountInWords: string; paymentDate: any; paymentMethod: string; description: string; reference?: string; debitAccountId: string; debitAccountName: string; creditAccountId: string; creditAccountName: string; status: 'draft' | 'paid' | 'cancelled'; journalEntryId: string; clientId?: string | null; transactionId?: string | null; employeeId?: string | null; renewalExpiryDate?: any; }
export interface PurchaseOrder extends BaseEntity { poNumber: string; poSequence: number; poYear: number; vendorId: string; vendorName: string; orderDate: any; status: 'draft' | 'approved' | 'received' | 'partially_received' | 'cancelled'; items: { internalItemId: string; itemName: string; quantity: number; unitPrice: number; total: number; }[]; totalAmount: number; discountAmount?: number; deliveryFees?: number; rfqId?: string | null; sourcePrId?: string | null; supplierQuotationId?: string; paymentTerms?: string; notes?: string; projectId?: string | null; isBypassed?: boolean; }
export interface RequestForQuotation extends BaseEntity { rfqNumber: string; date: any; vendorIds: string[]; prospectiveVendors?: { id: string; name: string; }[]; projectId?: string | null; items: { id: string; internalItemId: string; itemName: string; quantity: number; }[]; status: 'draft' | 'sent' | 'closed' | 'cancelled'; awardedVendorId?: string | null; awardedPoIds?: string[]; awardedItems?: Record<string, string>; }
export interface SupplierQuotation extends BaseEntity { rfqId: string; vendorId: string; quotationReference?: string; date: any; deliveryTimeDays?: number | null; paymentTerms?: string; discountAmount: number; deliveryFees: number; items: { rfqItemId: string; unitPrice: number; }[]; }
export interface WarehouseTransfer extends BaseEntity { transferNumber: string; date: any; fromWarehouseId: string; fromWarehouseName: string; toWarehouseId: string; toWarehouseName: string; items: { itemId: string; itemName: string; quantity: number; unitCost: number; totalCost: number; }[]; notes?: string; status: 'completed' | 'cancelled'; journalEntryId?: string; }
export interface InventoryAdjustment extends BaseEntity { adjustmentNumber: string; date: any; type: 'damage' | 'theft' | 'opening_balance' | 'material_issue' | 'purchase_return' | 'sales_return' | 'transfer' | 'other'; notes: string; items: { itemId: string; itemName: string; quantity: number; unitCost: number; totalCost: number; boqItemId?: string | null; warrantyEndDate?: any; }[]; warehouseId?: string; fromWarehouseId?: string; toWarehouseId?: string; journalEntryId?: string; projectId?: string | null; projectName?: string | null; clientId?: string | null; clientName?: string | null; issueType?: 'project_site' | 'direct_sale'; isBypassed?: boolean; }
export interface Subcontractor extends BaseEntity { name: string; type: string; specialization?: string; contactPerson?: string; phone: string; mobile?: string; email?: string; address?: string; bankAccount?: { bankName: string; accountNumber: string; iban: string; }; rating?: number; performanceRating?: number; isActive: boolean; blacklisted?: boolean; blacklistedReason?: string; }
export interface AuditLog extends BaseEntity { changeType: 'SalaryChange' | 'JobChange' | 'StatusChange' | 'ResidencyUpdate' | 'DataUpdate'; field: string; oldValue: any; newValue: any; effectiveDate: any; changedBy: string; notes?: string; }

export interface PaymentMethod {
    id: string;
    name: string;
    commissionType: 'percentage' | 'fixed' | 'both';
    fixedFee: number;
    percentageFee: number;
    expenseAccountId: string;
    expenseAccountName: string;
}
