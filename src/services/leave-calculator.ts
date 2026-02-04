
import type { Employee } from '@/lib/types';
import { differenceInDays } from 'date-fns';
import { toFirestoreDate } from './date-converter';

/**
 * Calculates the annual leave balance for an employee as of a specific date.
 * @param employee The employee object. Must contain hireDate, annualLeaveUsed, and carriedLeaveDays.
 * @param asOfDate The date to calculate the balance for. Defaults to now.
 * @returns The calculated leave balance, rounded down to the nearest whole number. Returns 0 on any failure.
 */
export function calculateAnnualLeaveBalance(employee: Employee | null, asOfDate: Date = new Date()): number {
    try {
        if (!employee || !employee.hireDate) {
            console.warn("Cannot calculate leave balance: employee or hire date is missing.");
            return 0;
        }

        const hireDate = toFirestoreDate(employee.hireDate);
        if (!hireDate) {
            console.warn("Cannot calculate leave balance: hire date is invalid for employee:", employee.id);
            return 0;
        }
        
        // If the "as of" date is before the hire date, balance is zero.
        if (asOfDate < hireDate) {
            return 0;
        }

        const daysOfService = differenceInDays(asOfDate, hireDate);
        
        // Total days accrued based on 30 days per year.
        const totalAccrued = (daysOfService / 365.25) * 30;

        const used = employee.annualLeaveUsed || 0;
        const carried = employee.carriedLeaveDays || 0;

        const balance = totalAccrued + carried - used;
        
        // Return the balance, ensuring it's not negative.
        return Math.floor(Math.max(0, balance));

    } catch (error) {
        console.error("Error in calculateAnnualLeaveBalance:", error);
        return 0; // Fail safely
    }
}
