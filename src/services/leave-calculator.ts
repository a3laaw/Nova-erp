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
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return 0;

    // Calculate total months of service
    const totalMonthsOfService = differenceInMonths(asOfDate, hireDate);
    
    // Accrual is 30 days per year, which is 2.5 days per month.
    const totalAccrued = (totalMonthsOfService / 12) * 30;
    
    const usedLeave = employee.annualLeaveUsed || 0;
    const carriedOver = employee.carriedLeaveDays || 0;

    const balance = totalAccrued + carriedOver - usedLeave;

    return Math.floor(balance > 0 ? balance : 0);
};


export const calculateGratuity = (employee: Employee, asOfDate: Date) => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return { gratuity: 0, leaveBalancePay: 0, total: 0, notice: 'تاريخ التعيين غير صالح.' };

    const yearsOfService = differenceInYears(asOfDate, hireDate);
    const lastSalary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);

    if (lastSalary === 0) {
        return { gratuity: 0, leaveBalancePay: 0, total: 0, notice: 'لم يتم تحديد راتب للموظف.' };
    }

    let rawGratuity = 0;
    const dailyWage = lastSalary / 26; // As per common practice for Kuwait law

    // Kuwaiti Private Sector Labor Law No. 6 of 2010, Article 51
    if (yearsOfService <= 5) {
        // 15 days' remuneration for each of the first five years
        rawGratuity = yearsOfService * 15 * dailyWage;
    } else {
        // 15 days for first 5 years + one month's remuneration for each year thereafter.
        const firstFiveYearsGratuity = 5 * 15 * dailyWage;
        const subsequentYears = yearsOfService - 5;
        const subsequentYearsGratuity = subsequentYears * lastSalary;
        rawGratuity = firstFiveYearsGratuity + subsequentYearsGratuity;
    }

    // Cap at 1.5 years salary
    const maxGratuity = 1.5 * 12 * lastSalary;
    rawGratuity = Math.min(rawGratuity, maxGratuity);

    let finalGratuity = rawGratuity;
    let notice = `بناءً على ${yearsOfService.toFixed(1)} سنوات من الخدمة.`;

    if (employee.terminationReason === 'resignation') {
        if (yearsOfService < 3) {
            finalGratuity = 0;
            notice += " (لا يستحق مكافأة لخدمة أقل من 3 سنوات عند الاستقالة)";
        } else if (yearsOfService < 5) {
            finalGratuity = rawGratuity * 0.5;
             notice += " (يستحق نصف المكافأة لخدمة بين 3-5 سنوات عند الاستقالة)";
        } else if (yearsOfService < 10) {
            finalGratuity = rawGratuity * (2 / 3);
            notice += " (يستحق ثلثي المكافأة لخدمة بين 5-10 سنوات عند الاستقالة)";
        }
        // If > 10 years, they get the full amount, so no change needed.
    }

    const leaveBalance = calculateAnnualLeaveBalance(employee, asOfDate);
    const leaveBalancePay = leaveBalance * dailyWage;

    return { 
        gratuity: finalGratuity, 
        leaveBalancePay, 
        total: finalGratuity + leaveBalancePay, 
        notice,
    };
};
