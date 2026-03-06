/**
 * @fileOverview محرك الحسابات القانونية (HR & Labor Law Engine).
 * يطبق قوانين العمل في دولة الكويت (القطاع الأهلي) بدقة رياضية.
 */

import { differenceInDays, eachDayOfInterval, format, differenceInMonths } from 'date-fns';
import type { Employee, Holiday } from '@/lib/types';
import { toFirestoreDate } from './date-converter';

const dayNameToIndex: Record<string, number> = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6
};

/**
 * حساب أيام العمل الفعلية:
 * يستثني العطل الأسبوعية المحددة في الإعدادات والعطل الرسمية المسجلة.
 */
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
  const publicHolidayDates = new Set(publicHolidays.map(h => {
      const d = toFirestoreDate(h.date);
      return d ? format(d, 'yyyy-MM-dd') : '';
  }).filter(Boolean));

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

/**
 * حساب رصيد الإجازات السنوية:
 * الموظف يكتسب 30 يوماً في السنة (أي 2.5 يوم عن كل شهر عمل فعلي).
 * المعادلة: (أشهر الخدمة * 2.5) + الرصيد المرحل - الرصيد المستخدم.
 */
export const calculateAnnualLeaveBalance = (employee: Partial<Employee>, asOfDate: Date): number => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return 0;

    // حساب إجمالي أشهر الخدمة من تاريخ التعيين حتى تاريخ الحساب
    const months = differenceInMonths(asOfDate, hireDate);
    const accrued = (months / 12) * 30; // الرصيد المكتسب قانونياً
    
    const used = employee.annualLeaveUsed || 0;
    const carried = employee.carriedLeaveDays || 0;

    // الرصيد النهائي = المكتسب + المرحل من سنوات سابقة - المستخدم فعلياً
    const balance = accrued + carried - used;
    return Math.floor(Math.max(0, balance)); // تقريب للأدنى لضمان عدم تجاوز الاستحقاق
};

/**
 * محرك مكافأة نهاية الخدمة (Gratuity Engine):
 * يطبق المادة 51 من قانون العمل الكويتي رقم 6 لسنة 2010.
 * 
 * القواعد:
 * 1. أول 5 سنوات: 15 يوماً عن كل سنة.
 * 2. ما بعد 5 سنوات: شهر كامل عن كل سنة.
 * 3. سقف المكافأة: لا تتجاوز أجر 18 شهراً.
 * 4. معامل الاستقالة: 
 *    - أقل من 3 سنوات: 0%
 *    - 3 إلى 5 سنوات: 50%
 *    - 5 إلى 10 سنوات: 66%
 *    - أكثر من 10 سنوات: 100%
 */
export const calculateGratuity = (employee: Employee, asOfDate: Date) => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return { 
        gratuity: 0, 
        leaveBalancePay: 0, 
        total: 0, 
        notice: 'تاريخ تعيين غير صالح',
        yearsOfService: 0, 
        lastSalary: 0, 
        leaveBalance: 0, 
        dailyWage: 0 
    };

    const totalDays = differenceInDays(asOfDate, hireDate);
    const years = totalDays / 365;
    
    // الأجر الشامل (أساسي + بدلات ثابتة)
    const salary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);
    const dailyWage = salary / 26; // أجر اليوم الواحد حسب العرف القانوني الكويتي

    if (salary === 0) {
        return { gratuity: 0, leaveBalancePay: 0, total: 0, notice: 'لم يتم تحديد راتب للموظف.', yearsOfService: years, lastSalary: 0, leaveBalance: 0, dailyWage: 0 };
    }

    let rawGratuity = 0;

    // المرحلة 1: حساب المكافأة الخام بناءً على سنوات الخدمة
    if (years <= 5) {
        rawGratuity = years * 15 * dailyWage;
    } else {
        const firstFiveYearsGratuity = 5 * 15 * dailyWage;
        const remainingYears = years - 5;
        rawGratuity = firstFiveYearsGratuity + (remainingYears * salary);
    }

    // المرحلة 2: تطبيق سقف الـ 1.5 سنة (18 شهراً)
    const maxGratuity = 1.5 * 12 * salary;
    rawGratuity = Math.min(rawGratuity, maxGratuity);

    let finalGratuity = rawGratuity;
    let notice = `بناءً على ${years.toFixed(1)} سنوات من الخدمة.`;

    // المرحلة 3: تطبيق معامل الاستقالة (في حال كان الموظف هو من استقال)
    if (employee.terminationReason === 'resignation') {
        if (years < 3) {
            finalGratuity = 0;
            notice += " (لا يستحق مكافأة لخدمة أقل من 3 سنوات عند الاستقالة)";
        } else if (years < 5) {
            finalGratuity = rawGratuity * 0.5;
             notice += " (يستحق نصف المكافأة لخدمة بين 3-5 سنوات عند الاستقالة)";
        } else if (years < 10) {
            finalGratuity = rawGratuity * (2 / 3);
            notice += " (يستحق ثلثي المكافأة لخدمة بين 5-10 سنوات عند الاستقالة)";
        }
    }

    // المرحلة 4: إضافة بدل رصيد الإجازات غير المستخدم
    const leaveBalance = calculateAnnualLeaveBalance(employee, asOfDate);
    const leaveBalancePay = leaveBalance * dailyWage;

    return { 
        gratuity: finalGratuity, 
        leaveBalancePay, 
        total: finalGratuity + leaveBalancePay, 
        notice,
        yearsOfService: years,
        lastSalary: salary,
        leaveBalance,
        dailyWage,
    };
};
