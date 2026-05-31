
import React from 'react';
import Link from 'next/link';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';

// 1. DATA SCHEMA & DYNAMIC ICON HELPER
// ===================================

export interface ActionCardItem {
  id: string;
  titleAr: string;
  descriptionAr: string;
  moduleKey: string;
  subActionKey: string;
  icon: string;
  href: string;
}

export const NOVA_INTERNAL_SUB_ACTIONS: ActionCardItem[] = [
  { id: 'act-new-trans', titleAr: 'بدء معاملة إدارية جديدة', descriptionAr: 'تسجيل معاملة واردة وتوجيهها للقسم المختص', moduleKey: 'transactions', subActionKey: 'create', icon: 'FilePlus', href: '/transactions/new' },
  { id: 'act-track-flow', titleAr: 'مسار تدفق المعاملات', descriptionAr: 'مراقبة خط سير المعاملات الرسمية بين الأقسام', moduleKey: 'transactions', subActionKey: 'track', icon: 'Route', href: '/transactions/track' },
  { id: 'act-calc-estimation', titleAr: 'حاسبة التقدير التكليفي', descriptionAr: 'تحليل تكاليف المواد والأجور المباشرة للمشاريع', moduleKey: 'quotations', subActionKey: 'estimate', icon: 'Calculator', href: '/quotations/estimate' },
  { id: 'act-pdf-export', titleAr: 'توليد صيغة العرض الرسمية PDF', descriptionAr: 'تصدير وثيقة السعر بهوية الشركة للعميل', moduleKey: 'quotations', subActionKey: 'export_pdf', icon: 'FileText', href: '/quotations/pdf' },
  { id: 'act-quantity-survey', titleAr: 'جداول حصر الكميات الفنية', descriptionAr: 'مطابقة الكميات المنفذة على أرض الواقع بالمخططات', moduleKey: 'extracts', subActionKey: 'survey', icon: 'Ruler', href: '/extracts/quantity-survey' },
  { id: 'act-workflow-approve', titleAr: 'مسار اعتمادات المستخلص الإنشائي', descriptionAr: 'متابعة تواقيع المهندس المشرف، مدير المشاريع، والمالية', moduleKey: 'extracts', subActionKey: 'workflow', icon: 'Signature', href: '/extracts/workflow' },
  { id: 'act-auto-journal', titleAr: 'الترحيل التلقائي للقيود', descriptionAr: 'توليد قيود محاسبية فورية من السندات المعتمدة', moduleKey: 'journalEntries', subActionKey: 'auto_post', icon: 'RefreshCw', href: '/accounting/auto-post' },
  { id: 'act-settlement', titleAr: 'تسوية الحسابات الدورية', moduleKey: 'journalEntries', descriptionAr: 'إجراء التسويات البنكية والمصرفية الشهرية', subActionKey: 'settle', icon: 'Scale', href: '/accounting/settle' }
];

const DynamicIcon = ({ name, ...props }: { name: string } & LucideIcons.LucideProps) => {
  const IconComponent = (LucideIcons as any)[name];
  if (!IconComponent) {
    return <LucideIcons.AlertCircle {...props} />;
  }
  return <IconComponent {...props} />;
};

// 2. COMPONENT PROPS
// ==================

interface InternalActionGridProps {
  currentUser: {
    role: 'owner_executive' | 'staff';
    permissions: string[];
  };
}

// 3. THE REACT COMPONENT
// ======================

const InternalActionGrid: React.FC<InternalActionGridProps> = ({ currentUser }) => {
  const isExecutive = currentUser.role === 'owner_executive';

  const hasPermission = (moduleKey: string, subActionKey: string): boolean => {
    return currentUser.permissions.includes(`${moduleKey}.${subActionKey}`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6" style={{ direction: 'rtl' }}>
      {NOVA_INTERNAL_SUB_ACTIONS.map((card) => {
        const canAccess = hasPermission(card.moduleKey, card.subActionKey);

        // حجب الموديول الداخلي تماماً عن الموظف العادي إن لم يملك الصلاحية
        if (!isExecutive && !canAccess) {
          return null;
        }

        const isVisuallyLocked = isExecutive && !canAccess;
        const CardWrapper = isVisuallyLocked ? 'div' : Link;

        // إعداد ذكي للخصائص لمنع تمرير href إلى عنصر div
        const wrapperProps = isVisuallyLocked 
          ? { className: cn('group rounded-2xl p-6 text-right transition-all duration-300 border flex flex-col justify-between relative overflow-hidden backdrop-blur-md bg-white/10 border-white/40 opacity-50 cursor-not-allowed select-none') }
          : { 
              href: card.href, 
              className: cn('group rounded-2xl p-6 text-right transition-all duration-300 border flex flex-col justify-between relative overflow-hidden backdrop-blur-md bg-white/40 border-white/70 shadow-[0_12px_32px_rgba(245,130,13,0.03)] hover:bg-white/75 hover:border-[#FFA611]/30 hover:shadow-[0_16px_36px_rgba(255,138,101,0.08)]') 
            };

        return (
          <CardWrapper key={card.id} {...wrapperProps}>
            
            {/* أيقونة القفل الذكية العلوية في زاوية الكارت البلوري */}
            {isVisuallyLocked && (
              <div className="absolute top-4 left-4 z-20 bg-amber-50/90 backdrop-blur-md border border-amber-200/50 rounded-lg p-1.5 shadow-sm">
                <LucideIcons.Lock className="h-4 w-4 text-[#F5820D]" />
              </div>
            )}

            {/* تأثير الهالة الضوئية الانسيابية الخلفية للكروت النشطة فقط */}
            {!isVisuallyLocked && (
              <span className="absolute -inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[#FFA585]/5 via-[#FFCB2B]/5 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            )}

            <div>
              {/* هيكل الحاوية الحاضنة للأيقونة الملونة */}
              <div className="flex items-center justify-end mb-4">
                <div 
                  className={cn(
                    "p-3 rounded-xl transition-all duration-300",
                    isVisuallyLocked 
                      ? "bg-slate-100/50 text-slate-400" 
                      : "bg-gradient-to-br from-[#FFA585]/15 to-[#FFCB2B]/10 border border-[#FFA585]/20 text-[#FF8A65] group-hover:from-[#FFA611]/20 group-hover:to-[#F5820D]/10 group-hover:text-[#F5820D] group-hover:shadow-[0_0_15px_rgba(255,166,17,0.15)]"
                  )}
                >
                  <DynamicIcon 
                    name={card.icon} 
                    className="h-6 w-6 transition-transform duration-300 group-hover:scale-105" 
                  />
                </div>
              </div>

              {/* عنوان الكارت التفاعلي */}
              <h3 
                className={cn(
                  "font-bold text-base tracking-wide mb-2 transition-colors duration-200 text-right",
                  isVisuallyLocked ? "text-slate-500" : "text-slate-800 group-hover:text-[#F5820D]"
                )}
              >
                {card.titleAr}
              </h3>
              
              {/* تفاصيل الوصف العملياتي */}
              <p className="text-slate-500 text-xs leading-relaxed text-right font-normal">
                {card.descriptionAr}
              </p>
            </div>

            {/* شارة المعاينة والرقابة الإدارية المخصصة للمدير العام فقط */}
            {isVisuallyLocked && (
              <div className="mt-4 pt-3 border-t border-white/40 flex justify-start">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-[#FFCB2B]/10 text-[#F5820D] border border-[#FFCB2B]/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#F5820D] animate-pulse" />
                  شاشة معاينة إدارية
                </span>
              </div>
            )}
          </CardWrapper>
        );
      })}
    </div>
  );
};

export default InternalActionGrid;
