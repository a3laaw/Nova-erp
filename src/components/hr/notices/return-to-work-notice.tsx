'use client';

import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { PrintableDocument } from '@/components/layout/printable-document';
import { Logo } from '@/components/layout/logo';
import { useBranding } from '@/context/branding-context';
import type { LeaveRequest, Employee } from '@/lib/types';
import { toFirestoreDate } from '@/services/date-converter';
import { User, Calendar, Briefcase, History, Home, CheckCircle2 } from 'lucide-react';

interface Props {
  leave: LeaveRequest;
  employee: Employee;
}

const leaveTypeTranslations: Record<string, string> = {
    'Annual': 'سنوية', 'Sick': 'مرضية', 'Emergency': 'طارئة', 'Unpaid': 'بدون أجر'
};

export function ReturnToWorkNotice({ leave, employee }: Props) {
  const { branding } = useBranding();
  const actualReturnDate = toFirestoreDate(leave.actualReturnDate);
  const startDate = toFirestoreDate(leave.startDate);
  const endDate = toFirestoreDate(leave.endDate);

  return (
    <PrintableDocument>
      <div className="space-y-10">
        <header className="flex justify-between items-start pb-6 border-b-4 border-primary">
          <div className="flex items-center gap-5">
            <Logo className="h-20 w-20 !p-3 shadow-inner border" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
            <div>
              <h1 className="text-2xl font-black">{branding?.company_name || 'Nova ERP'}</h1>
              <p className="text-xs text-muted-foreground mt-1">قسم الموارد البشرية</p>
            </div>
          </div>
          <div className="text-left">
            <h2 className="text-3xl font-black text-primary tracking-tighter">إشعار عودة للعمل</h2>
            <p className="text-muted-foreground font-mono text-sm mt-1 uppercase tracking-widest">Return to Work Notice</p>
            <p className="font-mono text-xs mt-2">مرجع: RTW-{leave.id?.substring(0, 6).toUpperCase()}</p>
          </div>
        </header>

        <section className="space-y-6">
          <div className="p-8 bg-muted/20 rounded-[2rem] border-2 border-dashed border-primary/10">
            <p className="text-lg leading-loose text-center font-medium">
              نحيطكم علماً بأن الموظف المذكور أدناه قد باشر عمله رسمياً لدينا بعد انتهاء فترة إجازته المقررة، وذلك وفق التفاصيل التالية:
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4 p-6 border rounded-3xl bg-card">
              <h3 className="font-black text-primary border-b pb-2 mb-4 flex items-center gap-2">
                <User className="h-4 w-4"/> بيانات الموظف
              </h3>
              <div className="space-y-3 text-sm">
                <p><span className="text-muted-foreground font-bold ml-2">الاسم الكامل:</span> <span className="font-black">{employee.fullName}</span></p>
                <p><span className="text-muted-foreground font-bold ml-2">الرقم الوظيفي:</span> <span className="font-mono">{employee.employeeNumber}</span></p>
                <p><span className="text-muted-foreground font-bold ml-2">القسم:</span> <span>{employee.department}</span></p>
                <p><span className="text-muted-foreground font-bold ml-2">المسمى الوظيفي:</span> <span>{employee.jobTitle}</span></p>
              </div>
            </div>

            <div className="space-y-4 p-6 border rounded-3xl bg-card">
              <h3 className="font-black text-primary border-b pb-2 mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4"/> تفاصيل الإجازة والعودة
              </h3>
              <div className="space-y-3 text-sm">
                <p><span className="text-muted-foreground font-bold ml-2">نوع الإجازة:</span> <span className="font-bold">{leaveTypeTranslations[leave.leaveType]}</span></p>
                <p><span className="text-muted-foreground font-bold ml-2">فترة الإجازة:</span> <span className="font-mono" dir="ltr">({startDate ? format(startDate, 'dd/MM/yyyy') : '-'}) - ({endDate ? format(endDate, 'dd/MM/yyyy') : '-'})</span></p>
                <div className="pt-2 mt-2 border-t border-dashed">
                    <p className="flex items-center gap-2 text-green-700 font-black text-base">
                        <CheckCircle2 className="h-5 w-5" />
                        تاريخ المباشرة الفعلي: {actualReturnDate ? format(actualReturnDate, 'eeee, dd MMMM yyyy', { locale: ar }) : '-'}
                    </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h4 className="font-black text-gray-700">ملاحظات إدارية:</h4>
          <div className="p-6 border rounded-2xl bg-muted/10 min-h-[100px] text-sm italic">
            {leave.notes || 'لا توجد ملاحظات إضافية. الموظف لائق طبياً وفنياً لمزاولة مهامه المعتادة.'}
          </div>
        </section>

        <footer className="pt-24">
          <div className="grid grid-cols-3 gap-8 text-center text-[10px] font-black uppercase text-muted-foreground">
            <div className="space-y-12">
              <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">توقيع الموظف</p>
              <div className="pt-2 border-t border-dashed">إقرار بالمباشرة</div>
            </div>
            <div className="space-y-12">
              <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">اعتماد القسم</p>
              <div className="pt-2 border-t border-dashed">المدير المباشر</div>
            </div>
            <div className="space-y-12">
              <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">الموارد البشرية</p>
              <div className="pt-2 border-t border-dashed">التوثيق والأرشفة</div>
            </div>
          </div>
        </footer>
      </div>
    </PrintableDocument>
  );
}
