
'use client';

import { 
    User, Mail, Phone, Building, Briefcase, FileText, Calendar as CalendarIcon, 
    Home, CreditCard, Banknote, Shield, Plane, BookOpen, Clock, HeartHandshake, FileClock
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter'; // Use the safe date converter

// Helper component for displaying information
const InfoItem = ({ label, value, isDate = false }: { label: string, value: string | number | null | undefined, isDate?: boolean }) => {
    let displayValue = value;
    if (isDate && typeof value === 'string') {
        const date = toFirestoreDate(value);
        displayValue = date ? format(date, 'PPP', { locale: ar }) : '-';
    } else if (typeof value === 'number') {
        displayValue = formatCurrency(value);
    }
    
    return (
        <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-base font-semibold">{displayValue || '-'}</span>
        </div>
    );
};

// Helper component for section layout
const Section = ({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => (
    <section className="space-y-4 rounded-lg border p-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            {icon}
            {title}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {children}
        </div>
    </section>
);


export function EmployeeDossier({ employee, asOfDate }: { employee: any, asOfDate: Date }) {
    
    // Defensive check: if no employee data, don't render anything
    if (!employee) {
        return <div className="text-center text-muted-foreground">لا توجد بيانات موظف لعرضها.</div>;
    }

    const hireDate = toFirestoreDate(employee.hireDate);
    const serviceYears = hireDate ? ((new Date()).getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25) : 0;
    
    return (
        <div id="dossier-content" className="p-4 sm:p-6 lg:p-8 bg-white dark:bg-gray-900 rounded-lg">
            <header className="flex flex-col items-center justify-between gap-4 border-b pb-4 sm:flex-row">
                <div className="text-center sm:text-right">
                    <h1 className="text-2xl font-bold">{employee.fullName || 'بيانات الموظف'}</h1>
                    <p className="text-muted-foreground">ملف الموظف كما في تاريخ: {format(asOfDate, 'PPP', { locale: ar })}</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-muted p-2 text-center">
                        <div className="text-2xl font-bold">{employee.leaveBalance?.toFixed(0) || 0}</div>
                        <div className="text-xs text-muted-foreground">رصيد الإجازات</div>
                    </div>
                     <div className="rounded-lg bg-muted p-2 text-center">
                        <div className="text-2xl font-bold">{serviceYears.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">سنوات الخدمة</div>
                    </div>
                </div>
            </header>

            <main className="space-y-4 pt-8">
                <Section title="المعلومات الشخصية والأساسية" icon={<User />}>
                    <InfoItem label="الاسم بالعربية" value={employee.fullName} />
                    <InfoItem label="الاسم بالإنجليزية" value={employee.nameEn} />
                    <InfoItem label="الرقم المدني" value={employee.civilId} />
                    <InfoItem label="الجنسية" value={employee.nationality} />
                    <InfoItem label="تاريخ الميلاد" value={employee.dob} isDate />
                </Section>
                
                <Section title="معلومات التوظيف" icon={<Briefcase />}>
                    <InfoItem label="رقم الموظف" value={employee.employeeNumber} />
                    <InfoItem label="القسم" value={employee.department} />
                    <InfoItem label="المسمى الوظيفي" value={employee.jobTitle} />
                    <InfoItem label="تاريخ التعيين" value={employee.hireDate} isDate />
                    <InfoItem label="الحالة" value={employee.status} />
                </Section>

                <Section title="معلومات العقد والراتب" icon={<FileText />}>
                    <InfoItem label="الراتب الأساسي" value={employee.basicSalary} />
                    <InfoItem label="بدل السكن" value={employee.housingAllowance} />
                    <InfoItem label="بدل المواصلات" value={employee.transportAllowance} />
                    <InfoItem label="تاريخ انتهاء العقد" value={employee.contractExpiry} isDate />
                    <InfoItem label="تاريخ انتهاء الإقامة" value={employee.residencyExpiry} isDate />
                </Section>
                
                 <Section title="سجل التغييرات" icon={<FileClock />}>
                    <div className="col-span-full space-y-2">
                        {employee.auditLogs && employee.auditLogs.length > 0 ? employee.auditLogs.map((log: any) => (
                             <div key={log.id} className="text-xs text-muted-foreground">
                                <span className="font-semibold">{log.effectiveDate ? format(new Date(log.effectiveDate), 'dd/MM/yyyy') : ''}:</span>
                                <span> تغير حقل "{log.field}" من "{log.oldValue || '-'}" إلى "{log.newValue || '-'}".</span>
                             </div>
                        )) : <p className="text-sm text-muted-foreground">لا توجد تغييرات مسجلة.</p>}
                    </div>
                </Section>
            </main>
        </div>
    );
}


    