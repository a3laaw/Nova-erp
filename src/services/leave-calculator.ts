import { differenceInDays, eachDayOfInterval, format, differenceInYears, differenceInMonths } from 'date-fns';
import type { Holiday, Employee } from '@/lib/types';
import { toFirestoreDate } from './date-converter';

const dayNameToIndex: Record<string, number> = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6
};

export function calculateWorkingDays(
  startDate: Date | undefined,
  endDate: Date | undefined,
  weeklyHolidays: string[],
  publicHolidays: Holiday[]
): { totalDays: number, workingDays: number } {
  if (!startDate || !endDate || startDate > endDate) {
    return { totalDays: 0, workingDays: 0 };
  }

  const totalDays = differenceInDays(endDate, startDate) + 1;
  const interval = { start: startDate, end: endDate };
  const allDaysInInterval = eachDayOfInterval(interval);

  const weeklyHolidayIndexes = new Set(weeklyHolidays.map(day => dayNameToIndex[day]));
  const publicHolidayDates = new Set(publicHolidays.map(h => format(toFirestoreDate(h.date)!, 'yyyy-MM-dd')));

  let workingDays = 0;

  for (const day of allDaysInInterval) {
    const dayIndex = day.getDay();
    const dateString = format(day, 'yyyy-MM-dd');
    
    if (!weeklyHolidayIndexes.has(dayIndex) && !publicHolidayDates.has(dateString)) {
      workingDays++;
    }
  }

  return { totalDays, workingDays };
}

export const calculateAnnualLeaveBalance = (employee: Partial<Employee>, asOfDate: Date): number => {
    // This is a simplified logic. A real-world scenario would be more complex.
    if (!employee.hireDate) return 0;
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return 0;
    
    const totalMonthsOfService = differenceInMonths(asOfDate, hireDate);
    // Assuming 2.5 days per month (30 days per year)
    const totalAccrued = (totalMonthsOfService / 12) * 30;
    
    return Math.floor(totalAccrued - (employee.annualLeaveUsed || 0) + (employee.carriedLeaveDays || 0));
};


export const calculateGratuity = (employee: Employee, asOfDate: Date) => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return { gratuity: 0, leaveBalancePay: 0, total: 0, notice: '' };

    const yearsOfService = differenceInYears(asOfDate, hireDate);
    const dailyWage = (employee.basicSalary || 0) / 30; // Simplified daily wage

    let gratuityDays = 0;
    if (yearsOfService <= 5) {
        gratuityDays = yearsOfService * 15;
    } else {
        gratuityDays = (5 * 15) + ((yearsOfService - 5) * 30);
    }
    
    let rawGratuity = gratuityDays * dailyWage;

    // Cap at 1.5 years salary
    const maxGratuity = (employee.basicSalary || 0) * 1.5;
    rawGratuity = Math.min(rawGratuity, maxGratuity);

    if (employee.terminationReason === 'resignation') {
        if (yearsOfService < 3) rawGratuity = 0;
        else if (yearsOfService < 5) rawGratuity *= 0.5;
        else if (yearsOfService < 10) rawGratuity *= (2/3);
    }

    const leaveBalance = calculateAnnualLeaveBalance(employee, asOfDate);
    const leaveBalancePay = leaveBalance * dailyWage;

    return { 
        gratuity: rawGratuity, 
        leaveBalancePay: leaveBalancePay, 
        total: rawGratuity + leaveBalancePay, 
        notice: `بناءً على ${yearsOfService.toFixed(1)} سنوات من الخدمة.` 
    };
};
