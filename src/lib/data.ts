import type { Client, Project, Appointment, Contract, Invoice, InventoryItem, CashReceipt, UserProfile, MultilingualString } from './types';
import { PlaceHolderImages } from './placeholder-images';

const getUserAvatar = (id: string) => PlaceHolderImages.find(p => p.id === id)?.imageUrl || '';

// Mock user data for UI display purposes ONLY. Authentication is handled by Firestore.
export const users: Partial<UserProfile>[] = [
    { id: 'user-1', fullName: 'Ali Ahmed', avatarUrl: getUserAvatar('user-avatar-1') },
    { id: 'user-2', fullName: 'Fatima Al-Mansoori', avatarUrl: getUserAvatar('user-avatar-2') },
    { id: 'user-3', fullName: 'Yusuf Khan', avatarUrl: getUserAvatar('user-avatar-3') },
    { id: 'user-4', fullName: 'Noor Al-Falahi', avatarUrl: getUserAvatar('user-avatar-4') },
    { id: 'user-5', fullName: 'Hassan Ibrahim', avatarUrl: getUserAvatar('user-avatar-5') },
    { id: 'user-6', fullName: 'Salama Al-Mazrouei', avatarUrl: getUserAvatar('user-avatar-6') },
];


export const clients: Client[] = [
  { 
    id: 'client-1', 
    name: { ar: 'إعمار العقارية', en: 'Emaar Properties' }, 
    contactPerson: { ar: 'محمد العبار', en: 'Mohamed Alabbar' }, 
    email: 'contact@emaar.ae', 
    phone: '+971 4 123 4567', 
    address: { ar: 'دبي, الإمارات العربية المتحدة', en: 'Dubai, UAE' }, 
    totalVisits: 5, 
    projectIds: ['proj-1', 'proj-3'] 
  },
  { 
    id: 'client-2', 
    name: { ar: 'الدار العقارية', en: 'Aldar Properties' }, 
    contactPerson: { ar: 'طلال الذييبي', en: 'Talal Al Dhiyebi' }, 
    email: 'info@aldar.com', 
    phone: '+971 2 987 6543', 
    address: { ar: 'أبو ظبي, الإمارات العربية المتحدة', en: 'Abu Dhabi, UAE' }, 
    totalVisits: 8, 
    projectIds: ['proj-2'] 
  },
];

export const projects: Project[] = [
  {
    id: 'proj-1',
    name: { ar: 'فيلا في داون تاون دبي', en: 'Downtown Dubai Villa' },
    clientId: 'client-1',
    leadEngineerId: 'user-2', // This will need to match a UID from Firestore
    status: 'In Progress',
    startDate: '2023-10-01',
    endDate: '2024-12-31',
    description: { ar: 'فيلا فاخرة مكونة من 5 غرف نوم مع مسبح خاص ووسائل راحة حديثة في قلب دبي.', en: 'A luxury 5-bedroom villa with a private pool and modern amenities in the heart of Downtown Dubai.' },
    imageUrl: getUserAvatar('project-image-1'),
    imageHint: 'modern villa',
    disciplines: [
      { name: { ar: 'الهندسة المعمارية', en: 'Architectural' }, stages: [{ name: {ar: 'الطابق السفلي', en: 'Basement'}, status: 'Completed' }, { name: {ar: 'الطابق الأرضي', en: 'Ground'}, status: 'In Progress' }, { name: {ar: 'الطابق الأول', en: 'First'}, status: 'Pending' }] },
      { name: { ar: 'الهندسة الإنشائية', en: 'Structural' }, stages: [{ name: {ar: 'تصميم الأعمدة', en: 'Columns design'}, status: 'Completed' }, { name: {ar: 'المخططات الإنشائية', en: 'Structural drawings'}, status: 'In Progress' }] },
      { name: { ar: 'التصميم الخارجي', en: 'Exterior' }, stages: [{ name: {ar: 'واجهة ثلاثية الأبعاد', en: '3D facade'}, status: 'Completed' }, { name: {ar: 'مخططات التنفيذ', en: 'Execution drawings'}, status: 'Pending' }] },
      { name: { ar: 'الهندسة الكهربائية', en: 'Electrical' }, stages: [{ name: {ar: 'تخطيط الكهرباء', en: 'Electrical layout'}, status: 'Pending' }] },
    ],
    files: [],
    timeline: [
      { id: 'tl-1', type: 'Milestone', title: { ar: 'انطلاق المشروع', en: 'Project Kick-off' }, date: '2023-10-01', description: { ar: 'الاجتماع الأولي وبدء المشروع.', en: 'Initial meeting and project start.' } },
      { id: 'tl-2', type: 'Visit', title: { ar: 'مسح أولي للموقع', en: 'Initial Site Survey' }, date: '2023-10-05', description: { ar: 'تم مسح قطعة الأرض وحالة التربة.', en: 'Surveyed the plot and soil conditions.' }, authorId: 'user-2' },
      { id: 'tl-3', type: 'Task', title: { ar: 'وضع اللمسات الأخيرة على المخططات المعمارية', en: 'Finalize Architectural Blueprints' }, date: '2023-11-15', description: { ar: 'وافق العميل على التصاميم النهائية.', en: 'Client approved the final designs.' }, authorId: 'user-2' },
    ],
    reports: [],
    contractId: 'cont-1',
  },
  {
    id: 'proj-2',
    name: { ar: 'برج سكني في جزيرة ياس', en: 'Yas Island Residential Tower' },
    clientId: 'client-2',
    leadEngineerId: 'user-5', // This will need to match a UID from Firestore
    status: 'Planning',
    startDate: '2024-02-15',
    endDate: '2026-08-30',
    description: { ar: 'مبنى سكني مكون من 20 طابقًا يضم 150 شقة وصالة رياضية ومساحات تجارية.', en: 'A 20-story residential building featuring 150 apartments, a gym, and retail spaces.' },
    imageUrl: getUserAvatar('project-image-2'),
    imageHint: 'modern skyscraper',
    disciplines: [
      { name: { ar: 'الهندسة المعمارية', en: 'Architectural' }, stages: [{ name: { ar: 'التصميم المبدئي', en: 'Concept Design' }, status: 'In Progress' }] },
      { name: { ar: 'الهندسة الإنشائية', en: 'Structural' }, stages: [{ name: { ar: 'الحسابات الأولية', en: 'Initial Calculations' }, status: 'Pending' }] },
    ],
    files: [],
    timeline: [],
    reports: [],
    contractId: 'cont-2'
  },
  {
    id: 'proj-3',
    name: { ar: 'كشك في دبي مارينا', en: 'Dubai Marina Kiosk' },
    clientId: 'client-1',
    leadEngineerId: 'user-2', // This will need to match a UID from Firestore
    status: 'Completed',
    startDate: '2023-05-01',
    endDate: '2023-08-01',
    description: { ar: 'كشك تجاري صغير لعلامة تجارية للمأكولات والمشروبات في دبي مارينا.', en: 'A small commercial kiosk for a food and beverage brand in Dubai Marina.' },
    imageUrl: getUserAvatar('project-image-3'),
    imageHint: 'food kiosk',
    disciplines: [],
    files: [],
    timeline: [],
    reports: [],
  },
];

export const appointments: Appointment[] = [
  { id: 'appt-1', title: { ar: 'زيارة موقع الفيلا', en: 'Villa Site Visit' }, date: '2025-08-01T10:00:00.000Z', clientId: 'client-1', projectId: 'proj-1', engineerId: 'user-2', notes: { ar: 'التحقق من تقدم الأساسات.', en: 'Check foundation progress.' } },
  { id: 'appt-2', title: { ar: 'مراجعة تصميم البرج', en: 'Tower Design Review' }, date: '2025-08-04T14:30:00.000Z', clientId: 'client-2', projectId: 'proj-2', engineerId: 'user-5', notes: { ar: 'مراجعة أحدث المسودات المعمارية مع العميل.', en: 'Reviewing the latest architectural drafts with the client.' } },
];

export const contracts: Contract[] = [
    {
        id: 'cont-1',
        projectId: 'proj-1',
        clientId: 'client-1',
        engineerId: 'user-2',
        title: { ar: 'عقد فيلا في داون تاون دبي', en: 'Contract for Downtown Dubai Villa' },
        totalAmount: 5000000,
        startDate: '2023-09-25',
        milestones: [
            { id: 'ms-1', name: { ar: 'الموافقة على التصميم', en: 'Design Approval' }, percentage: 20, dueDate: '2023-11-15', status: 'Completed' },
            { id: 'ms-2', name: { ar: 'اكتمال الأساسات', en: 'Foundation Completion' }, percentage: 30, dueDate: '2024-03-01', status: 'Pending' },
            { id: 'ms-3', name: { ar: 'اكتمال الهيكل', en: 'Structure Completion' }, percentage: 30, dueDate: '2024-08-01', status: 'Pending' },
            { id: 'ms-4', name: { ar: 'التسليم', en: 'Handover' }, percentage: 20, dueDate: '2024-12-31', status: 'Pending' },
        ],
    },
    {
        id: 'cont-2',
        projectId: 'proj-2',
        clientId: 'client-2',
        engineerId: 'user-5',
        title: { ar: 'عقد برج جزيرة ياس', en: 'Contract for Yas Island Tower' },
        totalAmount: 75000000,
        startDate: '2024-02-01',
        milestones: [
            { id: 'ms-5', name: { ar: 'دفعة أولى', en: 'Initial Deposit' }, percentage: 10, dueDate: '2024-02-15', status: 'Pending' },
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
        amountInWords: { ar: 'خمسون ألف درهم فقط لا غير', en: 'Fifty Thousand Dirhams only' },
        paymentMethod: 'Cheque',
        reference: '123456',
        description: { ar: 'دفعة مقدمة لفيلا في داون تاون دبي', en: 'Advance payment for Downtown Dubai Villa' },
    }
];


export const inventory: InventoryItem[] = [
    { id: 'item-1', name: { ar: 'أسمنت', en: 'Cement' }, quantity: 500, unit: { ar: 'أكياس', en: 'bags' }, lowStockThreshold: 100, supplier: { ar: 'شركة أسمنت الإمارات', en: 'Emirates Cement Co.' } },
    { id: 'item-2', name: { ar: 'حديد تسليح', en: 'Steel Rebar' }, quantity: 20, unit: { ar: 'أطنان', en: 'tons' }, lowStockThreshold: 5, supplier: { ar: 'كونارس للحديد', en: 'Conares Steel' } },
    { id: 'item-3', name: { ar: 'بلاط سيراميك', en: 'Ceramic Tiles' }, quantity: 150, unit: { ar: 'متر مربع', en: 'sqm' }, lowStockThreshold: 50, supplier: { ar: 'سيراميك رأس الخيمة', en: 'RAK Ceramics' } },
    { id: 'item-4', name: { ar: 'أسلاك كهربائية', en: 'Electrical Wiring' }, quantity: 80, unit: { ar: 'قطع', en: 'pieces' }, lowStockThreshold: 20, supplier: { ar: 'كابلات دبي', en: 'Dubai Cables' } },
];
