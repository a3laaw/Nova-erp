
'use client';

import type { Employee } from '@/lib/types';
import { differenceInDays } from 'date-fns';
import { toFirestoreDate } from './date-converter';

/**
 * Calculates the annual leave balance for an employee as of a specific date.
 * This function is designed to be safe and never crash, returning 0 on any error.
 * It adheres to the simple rule of 30 days per year of service.
 *
 * @param employee The employee object. Must contain hireDate, annualLeaveUsed, and carriedLeaveDays.
 * @param asOfDate The date to calculate the balance for. Defaults to now.
 * @returns The calculated leave balance, rounded down, or 0 if any error occurs.
 */
export function calculateAnnualLeaveBalance(employee: Employee | null, asOfDate: Date = new Date()): number {
    try {
        // 1. Validate inputs
        if (!employee) {
            console.warn("Cannot calculate leave balance: employee object is null.");
            return 0;
        }

        const hireDate = toFirestoreDate(employee.hireDate);
        if (!hireDate) {
            console.warn(`Cannot calculate leave balance: hire date is invalid for employee ID: ${employee.id}`);
            return 0;
        }
        
        // If the "as of" date is before the hire date, balance is zero.
        if (asOfDate < hireDate) {
            return 0;
        }

        // 2. Perform calculations
        const daysOfService = differenceInDays(asOfDate, hireDate);
        
        // Total days accrued based on 30 days per year.
        const totalAccrued = (daysOfService / 365.25) * 30;

        // Safely get numerical values from employee object, defaulting to 0.
        const used = Number(employee.annualLeaveUsed) || 0;
        const carried = Number(employee.carriedLeaveDays) || 0;

        const balance = totalAccrued + carried - used;
        
        // 3. Return a safe, rounded-down result.
        // The balance should not be negative.
        return Math.floor(Math.max(0, balance));

    } catch (error) {
        // Catch any unexpected errors during calculation and fail safely.
        console.error("Critical error in calculateAnnualLeaveBalance for employee:", employee?.id, error);
        return 0;
    }
}
