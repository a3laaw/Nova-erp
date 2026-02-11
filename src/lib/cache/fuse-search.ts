import { cache } from './smart-cache';
import type { Client, Employee, Account, JournalEntry, CashReceipt, PaymentVoucher, Quotation, PurchaseOrder, Item } from '@/lib/types';

export const searchClients = (items: Client[], query: string) => {
    return cache.search(items, query, ['nameAr', 'nameEn', 'fileId', 'mobile'], 0.4);
};

export const searchEmployees = (items: Employee[], query: string) => {
    return cache.search(items, query, ['fullName', 'employeeNumber', 'civilId'], 0.4);
};

export const searchAccounts = (items: Account[], query: string) => {
    return cache.search(items, query, ['name', 'code'], 0.3);
};

export const searchJournalEntries = (items: JournalEntry[], query: string) => {
    return cache.search(items, query, ['entryNumber', 'narration'], 0.4);
};

export const searchCashReceipts = (items: CashReceipt[], query: string) => {
    return cache.search(items, query, ['voucherNumber', 'clientNameAr', 'amount'], 0.4);
};

export const searchPaymentVouchers = (items: PaymentVoucher[], query: string) => {
    return cache.search(items, query, ['voucherNumber', 'payeeName', 'amount'], 0.4);
};

export const searchQuotations = (items: Quotation[], query: string) => {
    return cache.search(items, query, ['quotationNumber', 'clientName', 'subject'], 0.4);
};

export const searchPurchaseOrders = (items: PurchaseOrder[], query: string) => {
    return cache.search(items, query, ['poNumber', 'vendorName'], 0.4);
};

export const searchItems = (items: Item[], query: string) => {
    return cache.search(items, query, ['name', 'sku', 'description'], 0.4);
};
```