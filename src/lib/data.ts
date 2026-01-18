import type { Client, Project, Appointment, Contract, Invoice, InventoryItem, CashReceipt, UserProfile, MultilingualString, Notification } from './types';
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

// All data below is now managed in Firestore or is no longer needed.
export const clients: Client[] = [];
export const projects: Project[] = [];
export const appointments: Appointment[] = [];
export const contracts: Contract[] = [];
export const invoices: Invoice[] = [];
export const cashReceipts: CashReceipt[] = [];

// Mock notifications for demonstration when Firestore is empty.
export const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    userId: 'mock-admin-id',
    title: 'تم تحويل معاملة إليك',
    body: 'حول إليك علي أحمد معاملة "تصميم بلدية" الخاصة بالعميل "شركة المشاريع المتحدة".',
    link: '#',
    isRead: false,
    createdAt: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
  },
  {
    id: 'notif-2',
    userId: 'mock-admin-id',
    title: 'تعليق جديد على معاملة',
    body: 'أضافت فاطمة المنصوري تعليقًا على معاملة "تصميم كهرباء" للعميل "مؤسسة البناء الحديث".',
    link: '#',
    isRead: false,
    createdAt: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
  },
  {
    id: 'notif-3',
    userId: 'mock-admin-id',
    title: 'تمت الموافقة على طلب الإجازة',
    body: 'تمت الموافقة على طلب الإجازة السنوية الذي قدمته.',
    link: '#',
    isRead: true,
    createdAt: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString(),
  },
    {
    id: 'notif-4',
    userId: 'mock-admin-id',
    title: 'مهمة جديدة: مراجعة المخططات',
    body: 'تم إسناد مهمة جديدة لك لمراجعة المخططات المعمارية لمشروع "برج خليفة الجديد".',
    link: '#',
    isRead: true,
    createdAt: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(),
  },
];


export const inventory: InventoryItem[] = [
    { id: 'item-1', name: { ar: 'أسمنت', en: 'Cement' }, quantity: 500, unit: { ar: 'أكياس', en: 'bags' }, lowStockThreshold: 100, supplier: { ar: 'شركة أسمنت الإمارات', en: 'Emirates Cement Co.' } },
    { id: 'item-2', name: { ar: 'حديد تسليح', en: 'Steel Rebar' }, quantity: 20, unit: { ar: 'أطنان', en: 'tons' }, lowStockThreshold: 5, supplier: { ar: 'كونارس للحديد', en: 'Conares Steel' } },
    { id: 'item-3', name: { ar: 'بلاط سيراميك', en: 'Ceramic Tiles' }, quantity: 150, unit: { ar: 'متر مربع', en: 'sqm' }, lowStockThreshold: 50, supplier: { ar: 'سيراميك رأس الخيمة', en: 'RAK Ceramics' } },
    { id: 'item-4', name: { ar: 'أسلاك كهربائية', en: 'Electrical Wiring' }, quantity: 80, unit: { ar: 'قطع', en: 'pieces' }, lowStockThreshold: 20, supplier: { ar: 'كابلات دبي', en: 'Dubai Cables' } },
];
