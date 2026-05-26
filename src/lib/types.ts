
import { Timestamp } from 'firebase/firestore';

export interface BaseEntity {
  id?: string;
  companyId?: string;           
  createdAt?: Timestamp | any; 
  createdBy?: string;          
  updatedAt?: Timestamp | any;
  updatedBy?: string;           
}

export interface UserProductivityItem extends BaseEntity {
  userId: string;
  clientId?: string; 
  entryType: 'task' | 'bookmark';
  title: string;
  actionType?: 'review' | 'decision' | 'design' | 'redesign' | 'meeting' | 'general';
  status?: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  assignedUserIds?: string[]; 
  startDate?: Timestamp | any;
  dueDate?: Timestamp | any;
  completedAt?: Timestamp | any;
  completionNote?: string;
  sourceModule: string;
  sourceId: string;
  sourceSubId?: string;
  sourceUrl?: string;
  viewCounter?: number;
  lastViewedAt?: Timestamp | any;
}

export interface UserProfile extends BaseEntity {
  uid: string;
  username: string;
  email: string;
  // 🛡️ التوسيع السيادي: دعم كافة المسميات المهنية كأدوار نظام 🛡️
  role: string; 
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

export interface TransactionStage {
  stageId: string;
  name: string;
  status: 'pending' | 'in-progress' | 'completed';
  order: number;
  trackingType: 'duration' | 'occurrence' | 'hybrid' | 'none';
  expectedDurationDays?: number | null;
  maxOccurrences?: number | null;
  currentCount?: number;
  startDate?: Timestamp | any;
  endDate?: Timestamp | any;
  expectedEndDate?: Timestamp | any;
  nextStageIds?: string[];
}

export interface ClientTransaction extends BaseEntity {
    id?: string;
    transactionNumber: string;
    clientId: string;
    transactionType: string;
    subServiceId?: string | null;
    subServiceName?: string | null;
    status: 'new' | 'in-progress' | 'completed' | 'submitted' | 'on-hold' | 'cancelled';
    assignedEngineerId?: string | null;
    transactionTypeId?: string | null;
    stages?: TransactionStage[];
    contract?: any;
    projectId?: string;
    clientName?: string;
}

export interface Company extends BaseEntity {
    name: string;
    adminEmail: string;
    adminUsername: string;
    status: 'active' | 'suspended' | 'trial';
    subscriptionType: 'trial' | 'premium';
    maxUsersLimit: number;
    trialEndDate?: Timestamp | any;
    firebaseConfig?: any;
}

export interface Employee extends BaseEntity {
    id?: string;
    fullName: string;
    employeeNumber: string;
    department: string;
    jobTitle: string;
    basicSalary: number;
    housingAllowance?: number;
    transportAllowance?: number;
    status: 'active' | 'on-leave' | 'terminated';
    hireDate: Timestamp | any;
    civilId: string;
    mobile: string;
    terminationDate?: Timestamp | any;
    terminationReason?: string;
}

export interface Account extends BaseEntity {
    code: string;
    name: string;
    type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    parentCode: string | null;
    level: number;
    isPayable: boolean;
    balanceType?: 'Debit' | 'Credit';
    statement?: 'Balance Sheet' | 'Income Statement';
}

export interface Appointment extends BaseEntity {
    id?: string;
    clientId?: string;
    clientName: string;
    clientMobile?: string;
    engineerId: string;
    engineerName?: string;
    appointmentDate: Timestamp | any;
    type: string;
    status: string;
    workStageUpdated?: boolean;
    visitCount?: number;
    color?: string;
    title: string;
    notes?: string;
    transactionId?: string;
    meetingRoom?: string;
    department?: string;
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
  transactionId?: string;
}

export interface HubPost extends BaseEntity {
    userId: string;
    userName: string;
    userAvatar?: string;
    postType: 'system_achievement' | 'employee_idea' | 'kudos' | 'birthday';
    content: string;
    moodIcon?: string;
    votesCount: number;
    voters: string[];
    pointsAwarded: number;
    companyId: string;
}

export interface Job extends BaseEntity {
    name: string;
    order?: number;
    parentId?: string; // departmentId
}

export interface Department extends BaseEntity {
    name: string;
    order?: number;
    activityTypes?: string[];
}
