'use client';

import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { PrintableDocument } from '@/components/layout/printable-document';
import { Logo } from '@/components/layout/logo';
import { useBranding } from '@/context/branding-context';
import type { Employee } from '@/lib/types';
import { toFirestoreDate } from '@/services/date-converter';
import { User, Briefcase, ShieldCheck, MapPin, BadgeInfo, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Props {
  employee: Employee;
}

export function CommencementNotice({ employee }: Props) {
  const { branding } = useBranding();
  const hireDate = toFirestoreDate(employee.hireDate);

  return (
    <PrintableDocument>
      <div className="space-y-10">
        <header className="flex justify-between items-start pb-6 border-b-4 border-primary">
          <div className="flex items-center gap-5">
            <Logo className="h-20 w-20 !p-3 shadow-inner border" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
            <div>
              <h1 className="text-2xl font-black">{branding?.company_name || 'Nova ERP'}</h1>
              <p className="text-xs text-muted-foreground mt-1">قسم شؤون الموظفين</p>
            </div>
          </div>
          <div className="text-left">
            <h2 className="text-3xl font-black text-primary tracking-tighter">إشعار مباشرة عمل</h2>
            <p className="text-muted-foreground font-mono text-sm mt-1 uppercase tracking-widest">Commencement of Work</p>
            <p className="font-mono text-xs mt-2">الرقم الوظيفي: {employee.employeeNumber}</p>
          </div>
        </header>

        <section className="space-y-8">
          <div className="p-8 bg-muted/20 rounded-[2rem] border-2 border-dashed border-primary/10">
            <p className="text-lg leading-loose text-center font-medium">
              تشهد الشركة بأن الموظف المذكور أدناه قد باشر مهام عمله رسمياً في التاريخ المحدد، وذلك بعد استكمال كافة مسوغات التعيين وإجراءات التعاقد المتبعة.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
                <h3 className="font-black text-primary border-r-4 border-primary pr-3 text-lg">البيانات الشخصية</h3>
                <div className="space-y-4 p-6 border rounded-3xl bg-card shadow-sm">
                    <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-primary opacity-40" />
                        <div><p className="text-[10px] font-bold text-muted-foreground uppercase">اسم الموظف:</p><p className="font-black text-lg">{employee.fullName}</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <BadgeInfo className="h-5 w-5 text-primary opacity-40" />
                        <div><p className="text-[10px] font-bold text-muted-foreground uppercase">الرقم المدني:</p><p className="font-mono font-bold">{employee.civilId}</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-primary opacity-40" />
                        <div><p className="text-[10px] font-bold text-muted-foreground uppercase">الجنسية:</p><p className="font-bold">{employee.nationality}</p></div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h3 className="font-black text-primary border-r-4 border-primary pr-3 text-lg">البيانات الوظيفية</h3>
                <div className="space-y-4 p-6 border rounded-3xl bg-card shadow-sm">
                    <div className="flex items-center gap-3">
                        <Briefcase className="h-5 w-5 text-primary opacity-40" />
                        <div><p className="text-[10px] font-bold text-muted-foreground uppercase">المسمى الوظيفي / القسم:</p><p className="font-black">{employee.jobTitle} - {employee.department}</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="h-5 w-5 text-primary opacity-40" />
                        <div><p className="text-[10px] font-bold text-muted-foreground uppercase">تاريخ المباشرة:</p><p className="font-black text-xl text-primary">{hireDate ? format(hireDate, 'eeee, dd MMMM yyyy', { locale: ar }) : '-'}</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-primary opacity-40" />
                        <div><p className="text-[10px] font-bold text-muted-foreground uppercase">نوع التعاقد:</p><p className="font-bold">{employee.contractType}</p></div>
                    </div>
                </div>
            </div>
          </div>
        </section>

        <section className="bg-primary/5 p-8 rounded-[2.5rem] border-2 border-primary/10">
            <h4 className="font-black text-primary mb-4 flex items-center gap-2">
                <Briefcase className="h-5 w-5" /> الشروط والرواتب:
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
                <div className="bg-white p-4 rounded-2xl border shadow-sm">
                    <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">الراتب الأساسي</p>
                    <p className="text-xl font-black font-mono text-primary">{formatCurrency(employee.basicSalary)}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border shadow-sm">
                    <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">إجمالي البدلات</p>
                    <p className="text-xl font-black font-mono text-primary">{formatCurrency((employee.housingAllowance || 0) + (employee.transportAllowance || 0))}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center justify-center">
                    <p className="text-[10px] font-black text-muted-foreground leading-tight">يخضع الموظف لفترة تجربة حسب قانون العمل.</p>
                </div>
            </div>
        </section>

        <footer className="pt-20">
          <div className="grid grid-cols-3 gap-12 text-center text-[10px] font-black uppercase text-muted-foreground">
            <div className="space-y-16">
              <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">توقيع الموظف</p>
              <div className="pt-2 border-t border-dashed">أقر بالمباشرة</div>
            </div>
            <div className="space-y-16">
              <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">مدير القسم</p>
              <div className="pt-2 border-t border-dashed">الاعتماد الفني</div>
            </div>
            <div className="space-y-16">
              <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">مدير الإدارة</p>
              <div className="pt-2 border-t border-dashed">الختم والاعتماد</div>
            </div>
          </div>
        </footer>
      </div>
    </PrintableDocument>
  );
}
