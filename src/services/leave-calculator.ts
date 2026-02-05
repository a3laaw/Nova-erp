
'use client';

import type { Employee } from '@/lib/types';
import { differenceInDays } from 'date-fns';
import { toFirestoreDate } from './date-converter';

export function calculateAnnualLeaveBalance(employee: Partial<Employee> | null, asOfDate: Date = new Date()): number {
    try {
        if (!employee) {
            console.warn("Cannot calculate leave balance: employee object is null.");
            return 0;
        }

        const hireDate = toFirestoreDate(employee.hireDate);
        if (!hireDate) {
            console.warn(`Cannot calculate leave balance: hire date is invalid for employee ID: ${employee.id}`);
            return 0;
        }
        
        if (asOfDate < hireDate) {
            return 0;
        }

        const daysOfService = differenceInDays(asOfDate, hireDate);
        
        const totalAccrued = (daysOfService / 365.25) * 30;

        const used = Number(employee.annualLeaveUsed) || 0;
        const carried = Number(employee.carriedLeaveDays) || 0;

        const balance = totalAccrued + carried - used;
        
        return Math.floor(Math.max(0, balance));

    } catch (error) {
        console.error("Critical error in calculateAnnualLeaveBalance for employee:", employee?.id, error);
        return 0;
    }
}

    