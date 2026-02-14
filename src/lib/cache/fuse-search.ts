
import Fuse from 'fuse.js';
import type { Client, Employee, Account, JournalEntry, CashReceipt, PaymentVoucher, Quotation, PurchaseOrder, Item, Vendor, RequestForQuotation } from '@/lib/types';

function search<T>(items: T[], query: string, keys: (keyof T | string)[], threshold: number = 0.3): T[] {
    if (!query.trim()) return items;
    const fuse = new Fuse(items, {
      keys: keys as string[],
      threshold,
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });
    return fuse.search(query).map(r => r.item);
}

export const searchClients = (items: Client[], query: string) => {
    return search(items, query, ['nameAr', 'nameEn', 'fileId', 'mobile'], 0.4);
};

export const searchEmployees = (items: Employee[], query: string) => {
    return search(items, query, ['fullName', 'employeeNumber', 'civilId'], 0.4);
};

export const searchAccounts = (items: Account[], query: string) => {
    return search(items, query, ['name', 'code'], 0.3);
};

export const searchJournalEntries = (items: JournalEntry[], query: string) => {
    return search(items, query, ['entryNumber', 'narration'], 0.4);
};

export const searchCashReceipts = (items: CashReceipt[], query: string) => {
    return search(items, query, ['voucherNumber', 'clientNameAr', 'amount'], 0.4);
};

export const searchPaymentVouchers = (items: PaymentVoucher[], query: string) => {
    return search(items, query, ['voucherNumber', 'payeeName', 'amount'], 0.4);
};

export const searchQuotations = (items: Quotation[], query: string) => {
    return search(items, query, ['quotationNumber', 'clientName', 'subject'], 0.4);
};

export const searchPurchaseOrders = (items: PurchaseOrder[], query: string) => {
    return search(items, query, ['poNumber', 'vendorName'], 0.4);
};

export const searchItems = (items: (Item & { categoryName?: string })[], query: string) => {
    return search(items, query, ['name', 'sku', 'description', 'categoryName'], 0.4);
};

export const searchVendors = (items: Vendor[], query: string) => {
    return search(items, query, ['name', 'contactPerson', 'phone', 'email'], 0.4);
};

export const searchRfqs = (items: RequestForQuotation[], query: string) => {
    return search(items, query, ['rfqNumber', 'status'], 0.4);
};
