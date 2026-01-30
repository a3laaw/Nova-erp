import Fuse from 'fuse.js';
import type { Client, Employee, Account } from '@/lib/types';

// Options for Client search
const clientSearchOptions = {
  keys: [
    { name: 'nameAr', weight: 0.4 },
    { name: 'nameEn', weight: 0.3 },
    { name: 'fileId', weight: 0.2 },
    { name: 'mobile', weight: 0.1 },
  ],
  threshold: 0.4,
  includeScore: true,
};

// Options for Employee search
const employeeSearchOptions = {
  keys: [
    { name: 'fullName', weight: 0.5 },
    { name: 'employeeNumber', weight: 0.3 },
    { name: 'civilId', weight: 0.2 },
  ],
  threshold: 0.4,
  includeScore: true,
};

// Options for Account search
const accountSearchOptions = {
    keys: [
      { name: 'name', weight: 0.6 },
      { name: 'code', weight: 0.4 },
    ],
    threshold: 0.3,
    includeScore: true,
  };


/**
 * Searches a list of clients using Fuse.js.
 * @param query The search string.
 * @param clients The array of clients to search through.
 * @returns A filtered and sorted array of clients.
 */
export function searchClients(query: string, clients: Client[]): Client[] {
  if (!query) {
    return clients;
  }
  const fuse = new Fuse(clients, clientSearchOptions);
  return fuse.search(query).map(result => result.item);
}

/**
 * Searches a list of employees using Fuse.js.
 * @param query The search string.
 * @param employees The array of employees to search through.
 * @returns A filtered and sorted array of employees.
 */
export function searchEmployees(query: string, employees: Employee[]): Employee[] {
    if (!query) {
      return employees;
    }
    const fuse = new Fuse(employees, employeeSearchOptions);
    return fuse.search(query).map(result => result.item);
  }
  
/**
 * Searches a list of accounts using Fuse.js.
 * @param query The search string.
 * @param accounts The array of accounts to search through.
 * @returns A filtered and sorted array of accounts.
 */
export function searchAccounts(query: string, accounts: Account[]): Account[] {
    if (!query) {
        return accounts;
    }
    const fuse = new Fuse(accounts, accountSearchOptions);
    return fuse.search(query).map(result => result.item);
}
