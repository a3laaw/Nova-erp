export type UserRole = 'Admin' | 'Engineer' | 'Accountant' | 'Client';

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: UserRole;
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
  id: string;
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
