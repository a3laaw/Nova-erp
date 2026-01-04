import type { User, Client, Project, Appointment, Contract, Invoice, InventoryItem, CashReceipt, UserProfile } from './types';
import { PlaceHolderImages } from './placeholder-images';

const getUserAvatar = (id: string) => PlaceHolderImages.find(p => p.id === id)?.imageUrl || '';

// This data is for frontend demonstration and placeholder purposes.
// The actual user data for authentication is stored and managed in Firestore.
export const users: UserProfile[] = [
  { id: 'user-1', username: 'ali.ahmed', passwordHash: '123456', fullName: 'Ali Ahmed', email: 'ali.ahmed@example.com', avatarUrl: getUserAvatar('user-avatar-1'), role: 'Admin', isActive: true },
  { id: 'user-2', username: 'fatima.almansoori', passwordHash: '123456', fullName: 'Fatima Al-Mansoori', email: 'fatima.almansoori@example.com', avatarUrl: getUserAvatar('user-avatar-2'), role: 'Engineer', isActive: true },
  { id: 'user-3', username: 'yusuf.khan', passwordHash: '123456', fullName: 'Yusuf Khan', email: 'yusuf.khan@example.com', avatarUrl: getUserAvatar('user-avatar-3'), role: 'Accountant', isActive: true },
  { id: 'user-4', username: 'noor.alfalahi', passwordHash: '123456', fullName: 'Noor Al-Falahi', email: 'noor.alfalahi@example.com', avatarUrl: getUserAvatar('user-avatar-4'), role: 'Client', isActive: true },
  { id: 'user-5', username: 'hassan.ibrahim', passwordHash: '123456', fullName: 'Hassan Ibrahim', email: 'hassan.ibrahim@example.com', avatarUrl: getUserAvatar('user-avatar-5'), role: 'Engineer', isActive: true },
  { id: 'user-6', username: 'salama.almazrouei', passwordHash: '123456', fullName: 'Salama Al-Mazrouei', email: 'salama.almazrouei@example.com', avatarUrl: getUserAvatar('user-avatar-6'), role: 'Secretary', isActive: true },
  { id: 'user-7', username: 'badria.saleh', passwordHash: '123456', fullName: 'Badria Saleh', email: 'badria.saleh@example.com', avatarUrl: '', role: 'HR', isActive: true },
];

export const clients: Client[] = [
  { id: 'client-1', name: 'Emaar Properties', contactPerson: 'Mohamed Alabbar', email: 'contact@emaar.ae', phone: '+971 4 123 4567', address: 'Dubai, UAE', totalVisits: 5, projectIds: ['proj-1', 'proj-3'] },
  { id: 'client-2', name: 'Aldar Properties', contactPerson: 'Talal Al Dhiyebi', email: 'info@aldar.com', phone: '+971 2 987 6543', address: 'Abu Dhabi, UAE', totalVisits: 8, projectIds: ['proj-2'] },
];

export const projects: Project[] = [
  {
    id: 'proj-1',
    name: 'Downtown Dubai Villa',
    clientId: 'client-1',
    leadEngineerId: 'user-2',
    status: 'In Progress',
    startDate: '2023-10-01',
    endDate: '2024-12-31',
    description: 'A luxury 5-bedroom villa with a private pool and modern amenities in the heart of Downtown Dubai.',
    imageUrl: getUserAvatar('project-image-1'),
    imageHint: 'modern villa',
    disciplines: [
      { name: 'Architectural', stages: [{ name: 'Basement', status: 'Completed' }, { name: 'Ground', status: 'In Progress' }, { name: 'First', status: 'Pending' }] },
      { name: 'Structural', stages: [{ name: 'Columns design', status: 'Completed' }, { name: 'Structural drawings', status: 'In Progress' }] },
      { name: 'Exterior', stages: [{ name: '3D facade', status: 'Completed' }, { name: 'Execution drawings', status: 'Pending' }] },
      { name: 'Electrical', stages: [{ name: 'Electrical layout', status: 'Pending' }] },
    ],
    files: [],
    timeline: [
      { id: 'tl-1', type: 'Milestone', title: 'Project Kick-off', date: '2023-10-01', description: 'Initial meeting and project start.' },
      { id: 'tl-2', type: 'Visit', title: 'Initial Site Survey', date: '2023-10-05', description: 'Surveyed the plot and soil conditions.', authorId: 'user-2' },
      { id: 'tl-3', type: 'Task', title: 'Finalize Architectural Blueprints', date: '2023-11-15', description: 'Client approved the final designs.', authorId: 'user-2' },
    ],
    reports: [],
    contractId: 'cont-1',
  },
  {
    id: 'proj-2',
    name: 'Yas Island Residential Tower',
    clientId: 'client-2',
    leadEngineerId: 'user-5',
    status: 'Planning',
    startDate: '2024-02-15',
    endDate: '2026-08-30',
    description: 'A 20-story residential building featuring 150 apartments, a gym, and retail spaces.',
    imageUrl: getUserAvatar('project-image-2'),
    imageHint: 'modern skyscraper',
    disciplines: [
      { name: 'Architectural', stages: [{ name: 'Concept Design', status: 'In Progress' }] },
      { name: 'Structural', stages: [{ name: 'Initial Calculations', status: 'Pending' }] },
    ],
    files: [],
    timeline: [],
    reports: [],
    contractId: 'cont-2'
  },
  {
    id: 'proj-3',
    name: 'Dubai Marina Kiosk',
    clientId: 'client-1',
    leadEngineerId: 'user-2',
    status: 'Completed',
    startDate: '2023-05-01',
    endDate: '2023-08-01',
    description: 'A small commercial kiosk for a food and beverage brand in Dubai Marina.',
    imageUrl: getUserAvatar('project-image-3'),
    imageHint: 'food kiosk',
    disciplines: [],
    files: [],
    timeline: [],
    reports: [],
  },
];

export const appointments: Appointment[] = [
  { id: 'appt-1', title: 'Villa Site Visit', date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), clientId: 'client-1', projectId: 'proj-1', engineerId: 'user-2', notes: 'Check foundation progress.' },
  { id: 'appt-2', title: 'Tower Design Review', date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), clientId: 'client-2', projectId: 'proj-2', engineerId: 'user-5', notes: 'Reviewing the latest architectural drafts with the client.' },
];

export const contracts: Contract[] = [
    {
        id: 'cont-1',
        projectId: 'proj-1',
        clientId: 'client-1',
        engineerId: 'user-2',
        title: 'Contract for Downtown Dubai Villa',
        totalAmount: 5000000,
        startDate: '2023-09-25',
        milestones: [
            { id: 'ms-1', name: 'Design Approval', percentage: 20, dueDate: '2023-11-15', status: 'Completed' },
            { id: 'ms-2', name: 'Foundation Completion', percentage: 30, dueDate: '2024-03-01', status: 'Pending' },
            { id: 'ms-3', name: 'Structure Completion', percentage: 30, dueDate: '2024-08-01', status: 'Pending' },
            { id: 'ms-4', name: 'Handover', percentage: 20, dueDate: '2024-12-31', status: 'Pending' },
        ],
    },
    {
        id: 'cont-2',
        projectId: 'proj-2',
        clientId: 'client-2',
        engineerId: 'user-5',
        title: 'Contract for Yas Island Tower',
        totalAmount: 75000000,
        startDate: '2024-02-01',
        milestones: [
            { id: 'ms-5', name: 'Initial Deposit', percentage: 10, dueDate: '2024-02-15', status: 'Pending' },
        ],
    }
];

export const invoices: Invoice[] = [
    { id: 'inv-1', invoiceNumber: 'INV-2023-001', clientId: 'client-1', projectId: 'proj-1', amount: 1000000, issueDate: '2023-11-16', dueDate: '2023-12-16', status: 'Paid', type: 'Receivable' },
    { id: 'inv-2', invoiceNumber: 'INV-2024-001', clientId: 'client-2', projectId: 'proj-2', amount: 25000, issueDate: '2024-03-10', dueDate: '2024-04-10', status: 'Sent', type: 'Receivable' },
];

export const cashReceipts: CashReceipt[] = [
    {
        id: 'cr-1',
        voucherNumber: 'CRV-2024-001',
        date: '2024-07-20',
        clientId: 'client-1',
        amount: 50000,
        amountInWords: 'Fifty Thousand Dirhams only',
        paymentMethod: 'Cheque',
        reference: '123456',
        description: 'Advance payment for Downtown Dubai Villa',
    }
];


export const inventory: InventoryItem[] = [
    { id: 'item-1', name: 'Cement', quantity: 500, unit: 'bags', lowStockThreshold: 100, supplier: 'Emirates Cement Co.' },
    { id: 'item-2', name: 'Steel Rebar', quantity: 20, unit: 'tons', lowStockThreshold: 5, supplier: 'Conares Steel' },
    { id: 'item-3', name: 'Ceramic Tiles', quantity: 150, unit: 'sqm', lowStockThreshold: 50, supplier: 'RAK Ceramics' },
    { id: 'item-4', name: 'Electrical Wiring', quantity: 80, unit: 'pieces', lowStockThreshold: 20, supplier: 'Dubai Cables' },
];
