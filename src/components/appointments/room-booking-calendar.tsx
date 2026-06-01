'use client';

import React, { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import { useFirebase } from '@/firebase/provider';
import {
  collection, query, getDocs, where,
  serverTimestamp, Timestamp, doc, writeBatch, getDoc, deleteDoc, updateDoc, runTransaction,
} from 'firebase/firestore';
import {
  setHours, setMinutes, startOfDay, endOfDay,
  format, isPast, parse, isValid, isWithinInterval, addMinutes,
} from 'date-fns';
import { ar } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Loader2, Eye, Pencil, Trash2, CheckCircle, MousePointer2, MoreHorizontal, XCircle, GripVertical, CalendarDays, Printer, Download, FileText } from 'lucide-react';
import { getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Appointment, Client, Employee, LeaveRequest } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import { useRouter } from 'next/navigation';
import { Checkbox } from '../ui/checkbox';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import { useBranding } from '@/context/branding-context';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent,
  useDraggable, useDroppable, DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';

// ══════════════════════════════════════════════════════
//  أنماط الطباعة الاحترافية
// ══════════════════════════════════════════════════════
const PRINT_STYLES = `
@media print {
  /* إخفاء كل عناصر النظام */
  [data-sidebar],
  [data-sidebar-container],
  [data-sidebar-wrapper],
  aside,
  nav[class*="sidebar"],
  .sidebar,
  [class*="Sidebar"],
  [class*="sidebar"],
  header[class*="top-bar"],
  [class*="TopBar"],
  [class*="navbar"],
  [class*="NavBar"],
  [role="navigation"],
  [class*="CommandMenu"],
  [class*="command-menu"],
  [data-command-menu],
  button[class*="print:hidden"],
  .no-print,
  [class*="Breadcrumb"],
  [class*="breadcrumb"] {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    overflow: hidden !important;
    position: absolute !important;
    left: -9999px !important;
  }

  /* إعادة ضبط التخطيط */
  body, main, [class*="main"], [role="main"],
  [class*="page"], [class*="content"],
  [class*="layout"] > div,
  [class*="Layout"] > div {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    overflow: visible !important;
  }

  /* إخفاء الأزرار والعناصر التفاعلية */
  button:not(.print-keep),
  [class*="Popover"],
  [class*="popover"],
  [class*="Dialog"],
  [class*="dialog"],
  [class*="AlertDialog"],
  [class*="alert-dialog"],
  [class*="drag-overlay"],
  [data-dnd-overlay],
  .dnd-overlay,
  [style*="pointer-events"],
  [class*="no-print"] {
    display: none !important;
  }

  /* تنسيق منطقة الطباعة */
  .print-area {
    padding: 12mm 8mm !important;
    background: white !important;
    box-shadow: none !important;
    border: none !important;
  }

  .print-area * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }

  /* تحسين الجدول للطباعة */
  .print-area table {
    page-break-inside: auto !important;
    border-collapse: collapse !important;
    width: 100% !important;
  }

  .print-area tr {
    page-break-inside: avoid !important;
    page-break-after: auto !important;
  }

  .print-area thead {
    display: table-header-group !important;
  }

  .print-area tfoot {
    display: table-footer-group !important;
  }

  /* إخفاء عناصر السحب والإفلات */
  [class*="grip"],
  [class*="GripVertical"],
  [style*="cursor: grab"] {
    display: none !important;
  }

  /* تحسين الروؤس */
  .print-header {
    border-bottom: 3px solid #1e293b !important;
    padding-bottom: 10px !important;
    margin-bottom: 16px !important;
  }

  /* إظهار شارة الطباعة */
  .print-badge {
    display: flex !important;
  }

  @page {
    size: A4 landscape;
    margin: 8mm;
  }
}

@media not print {
  .print-badge {
    display: none !important;
  }
}
`;

// ══════════════════════════════════════════════════════
//  التحقق من تعارض وقت العميل
// ══════════════════════════════════════════════════════
function checkClientTimeConflict(
  all: Appointment[], clientId: string, newStart: Date,
  dur: number, excludeId?: string
): Appointment | null {
  const newEnd = addMinutes(newStart, dur);
  for (const a of all) {
    if (excludeId && a.id === excludeId) continue;
    if (a.status === 'cancelled' || a.clientId !== clientId) continue;
    const es = toFirestoreDate(a.appointmentDate);
    if (!es) continue;
    const ee = addMinutes(es, dur);
    if (newStart < ee && newEnd > es) return a;
  }
  return null;
}

const generateTimeSlots = (s: string, e: string, dur: number, buf: number): string[] => {
  if (!s || !e || !dur || dur <= 0) return [];
  const slots: string[] = [];
  try {
    const st = parse(s, 'HH:mm', new Date());
    const et = parse(e, 'HH:mm', new Date());
    if (!isValid(st) || !isValid(et) || st >= et) return [];
    let cur = st;
    while (cur < et) {
      const end = new Date(cur.getTime() + dur * 60000);
      if (end > et) break;
      slots.push(format(cur, 'HH:mm'));
      cur = new Date(end.getTime() + buf * 60000);
    }
  } catch {}
  return slots;
};

function getVisitColor(v: { visitCount?: number; contractSigned?: boolean }) {
  if (v.visitCount === 1) return '#facc15';
  if (v.visitCount! > 1 && !v.contractSigned) return '#22c55e';
  if (v.visitCount! > 1 && v.contractSigned) return '#3b82f6';
  return '#9ca3af';
}

function cardGradient(color?: string) {
  if (color === '#facc15') return {
    bg: 'linear-gradient(145deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)',
    border: '1.5px solid #f59e0b',
    shadow: '0 2px 8px rgba(245,158,11,0.2), inset 0 1px 0 rgba(255,255,255,0.6)',
    accent: '#d97706',
    tagBg: 'rgba(245,158,11,0.12)',
    tagBorder: 'rgba(245,158,11,0.3)',
    tagColor: '#92400e',
  };
  if (color === '#22c55e') return {
    bg: 'linear-gradient(145deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%)',
    border: '1.5px solid #22c55e',
    shadow: '0 2px 8px rgba(34,197,94,0.2), inset 0 1px 0 rgba(255,255,255,0.6)',
    accent: '#16a34a',
    tagBg: 'rgba(34,197,94,0.12)',
    tagBorder: 'rgba(34,197,94,0.3)',
    tagColor: '#166534',
  };
  if (color === '#3b82f6') return {
    bg: 'linear-gradient(145deg, #eff6ff 0%, #dbeafe 50%, #bfdbfe 100%)',
    border: '1.5px solid #3b82f6',
    shadow: '0 2px 8px rgba(59,130,246,0.2), inset 0 1px 0 rgba(255,255,255,0.6)',
    accent: '#2563eb',
    tagBg: 'rgba(59,130,246,0.12)',
    tagBorder: 'rgba(59,130,246,0.3)',
    tagColor: '#1e40af',
  };
  return {
    bg: 'linear-gradient(145deg, #f9fafb 0%, #f3f4f6 50%, #e5e7eb 100%)',
    border: '1.5px solid #d1d5db',
    shadow: '0 1px 4px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5)',
    accent: '#6b7280',
    tagBg: 'rgba(107,114,128,0.1)',
    tagBorder: 'rgba(107,114,128,0.25)',
    tagColor: '#374151',
  };
}

async function reconcileClientAppointments(firestore: any, tenantId: string | undefined, id: { clientId?: string | null; clientMobile?: string | null }) {
  if (!id.clientId && !id.clientMobile) return;
  try {
    const p = getTenantPath('appointments', tenantId);
    const snap = await getDocs(query(collection(firestore, p!), where('type', '==', 'architectural')));
    const appts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment))
      .filter(a => { if (a.status === 'cancelled') return false; return id.clientId ? a.clientId === id.clientId : a.clientMobile === id.clientMobile; })
      .sort((a, b) => (a.appointmentDate?.toMillis() || 0) - (b.appointmentDate?.toMillis() || 0));
    let contractSigned = false;
    if (id.clientId) {
      const cs = await getDoc(doc(firestore, getTenantPath(`clients/${id.clientId}`, tenantId)!));
      contractSigned = cs.exists() && ['contracted', 'reContracted'].includes((cs.data() as any)?.status);
    }
    const batch = writeBatch(firestore);
    let dirty = false;
    appts.forEach((a, i) => {
      const vc = i + 1, nc = getVisitColor({ visitCount: vc, contractSigned });
      if (a.visitCount !== vc || a.color !== nc) { batch.update(doc(firestore, p!, a.id!), { visitCount: vc, color: nc }); dirty = true; }
    });
    if (dirty) await batch.commit();
  } catch (e) { console.error('❌ reconcile:', e); }
}

const weekDays = [{ id: 'Sunday', label: 'الأحد' }, { id: 'Monday', label: 'الاثنين' }, { id: 'Tuesday', label: 'الثلاثاء' }, { id: 'Wednesday', label: 'الأربعاء' }, { id: 'Thursday', label: 'الخميس' }, { id: 'Friday', label: 'الجمعة' }, { id: 'Saturday', label: 'السبت' }];

// ══════════════════════════════════════════════════════
//  بطاقة الموعد الاحترافية
// ══════════════════════════════════════════════════════
type ApptWithMeta = Appointment & { clientArea?: string | null; bookedByName?: string | null };

const AppointmentCard = memo(({
  appointment, onOpenDetails, onOpenEdit, onDelete, onCancel,
}: {
  appointment: ApptWithMeta;
  onOpenDetails: (a: ApptWithMeta) => void;
  onOpenEdit:   (a: ApptWithMeta, mode: 'edit' | 'reschedule') => void;
  onDelete:     (a: ApptWithMeta) => void;
  onCancel:     (a: ApptWithMeta) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: appointment.id!, data: appointment });
  const dragStyle = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 1000, opacity: 0.85 } : undefined;
  const styles = cardGradient(appointment.color);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 6, left: rect.left });
    }
    setMenuOpen(p => !p);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const visitLabel = appointment.visitCount === 1 ? 'زيارة أولى 🆕' : `زيارة ${appointment.visitCount}`;

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          ...dragStyle,
          position: 'absolute',
          inset: '3px',
          background: styles.bg,
          border: styles.border,
          boxShadow: styles.shadow,
          borderRadius: 10,
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'visible',
          transition: 'box-shadow .2s, border-color .2s, transform .15s',
          pointerEvents: 'auto',
          touchAction: 'none',
          zIndex: 10,
        }}
        {...attributes}
      >
        {/* زر القائمة */}
        <div style={{ position: 'absolute', top: 2, left: 2, zIndex: 20 }} className="no-print">
          <button
            ref={btnRef}
            onClick={toggleMenu}
            onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
            style={{
              width: 22, height: 22, borderRadius: 6,
              background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#94a3b8', transition: 'all .2s', zIndex: 25,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#334155'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.9)'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; }}
          >
            <MoreHorizontal size={12} />
          </button>
        </div>

        {/* محتوى البطاقة */}
        <div
          onClick={e => { e.stopPropagation(); e.preventDefault(); onOpenDetails(appointment); }}
          style={{ flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3, height: '100%', pointerEvents: 'auto' }}
        >
          {/* مقبض السحب */}
          <div
            {...listeners}
            className="no-print"
            style={{
              position: 'absolute', top: '50%', right: 3, transform: 'translateY(-50%)',
              cursor: 'grab', color: 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center',
              zIndex: 15, padding: '3px', borderRadius: 4, pointerEvents: 'auto', touchAction: 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(0,0,0,0.35)'; e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(0,0,0,0.15)'; e.currentTarget.style.background = 'transparent'; }}
            onClick={e => { e.stopPropagation(); e.preventDefault(); }}
            onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
          >
            <GripVertical size={12} />
          </div>

          {/* اسم العميل */}
          <div style={{ paddingLeft: 20, paddingRight: 14, minWidth: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
            {appointment.workStageUpdated && (
              <CheckCircle style={{ width: 11, height: 11, color: '#16a34a', flexShrink: 0 }} />
            )}
            <span style={{
              fontSize: 11.5, fontWeight: 800, color: '#0f172a',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              letterSpacing: '-0.01em', lineHeight: 1.3,
            }}>
              {appointment.clientName}
            </span>
          </div>

          {/* شارات الزيارة والمنطقة */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden', flexWrap: 'nowrap', paddingRight: 14 }}>
            {appointment.visitCount && (
              <span style={{
                fontSize: 8.5, fontWeight: 700, padding: '1.5px 6px', borderRadius: 6,
                background: styles.tagBg, color: styles.tagColor,
                border: `1px solid ${styles.tagBorder}`,
                whiteSpace: 'nowrap', flexShrink: 0, lineHeight: 1.4,
              }}>
                {visitLabel}
              </span>
            )}
            {appointment.clientArea && (
              <span style={{
                fontSize: 8.5, fontWeight: 700, padding: '1.5px 6px', borderRadius: 6,
                background: 'rgba(13,148,136,0.08)', color: '#0d9488',
                border: '1px solid rgba(13,148,136,0.2)',
                whiteSpace: 'nowrap', flexShrink: 0, lineHeight: 1.4,
              }}>
                📍 {appointment.clientArea}
              </span>
            )}
          </div>

          {/* اسم الحاجز */}
          {appointment.bookedByName && (
            <div style={{
              fontSize: 8.5, color: '#64748b', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              paddingRight: 14, lineHeight: 1.3,
            }}>
              👤 {appointment.bookedByName}
            </div>
          )}
        </div>
      </div>

      {/* القائمة المنبثقة */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="no-print"
          style={{
            position: 'fixed', top: menuPos.top, left: menuPos.left,
            background: '#ffffff', borderRadius: 14, width: 230,
            boxShadow: '0 20px 60px -15px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)',
            zIndex: 99999, overflow: 'hidden', direction: 'rtl',
            animation: 'menuSlideIn .18s cubic-bezier(.16,1,.3,1)',
          }}
        >
          <style>{`@keyframes menuSlideIn{from{opacity:0;transform:scale(.92) translateY(-6px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

          <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {appointment.clientName}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, fontWeight: 600 }}>
              {appointment.visitCount ? `زيارة رقم ${appointment.visitCount}` : 'موعد'}
            </div>
          </div>

          <div style={{ padding: '6px' }}>
            {[
              { icon: <Eye size={14} />, label: 'الدخول للمسار الفني', color: '#2563eb', bg: '#eff6ff', action: () => { setMenuOpen(false); onOpenDetails(appointment); } },
              { icon: <Pencil size={14} />, label: 'تعديل بيانات الموعد', color: '#475569', bg: '#f8fafc', action: () => { setMenuOpen(false); onOpenEdit(appointment, 'edit'); } },
              { icon: <CalendarDays size={14} />, label: 'جدولة ليوم آخر', color: '#0891b2', bg: '#ecfeff', action: () => { setMenuOpen(false); onOpenEdit(appointment, 'reschedule'); } },
            ].map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, color: item.color, textAlign: 'right',
                  borderRadius: 10, transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = item.bg; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: item.bg }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: '#e2e8f0', margin: '2px 6px' }} />

          <div style={{ padding: '6px' }}>
            <button
              onClick={() => { setMenuOpen(false); onCancel(appointment); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: '#ea580c', textAlign: 'right',
                borderRadius: 10, transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fff7ed'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: '#fff7ed' }}><XCircle size={14} /></span>
              إلغاء الموعد
            </button>
            <button
              onClick={() => { setMenuOpen(false); onDelete(appointment); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: '#dc2626', textAlign: 'right',
                borderRadius: 10, transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: '#fef2f2' }}><Trash2 size={14} /></span>
              حذف نهائي
            </button>
          </div>
        </div>
      )}
    </>
  );
});
AppointmentCard.displayName = 'AppointmentCard';

// ══════════════════════════════════════════════════════
//  خانة الإفلات
// ══════════════════════════════════════════════════════
function DroppableSlot({ id, children, onClick, isEngineerOnLeave }: { id: string; children: React.ReactNode; onClick: () => void; isEngineerOnLeave: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled: isEngineerOnLeave || !!children });
  return (
    <div
      ref={setNodeRef}
      onClick={(e) => { if (children || isEngineerOnLeave) { e.stopPropagation(); return; } onClick(); }}
      style={{
        minHeight: 72, height: '100%',
        background: isOver ? 'rgba(232,124,36,0.1)' : 'transparent',
        border: `2px dashed ${isOver ? '#e87c24' : 'transparent'}`,
        borderRadius: 8,
        cursor: children || isEngineerOnLeave ? 'default' : 'pointer',
        transition: 'all .15s', position: 'relative',
        display: 'flex', alignItems: children ? 'flex-start' : 'center',
        justifyContent: children ? 'flex-start' : 'center',
        pointerEvents: 'auto',
      }}
    >
      {children}
      {!children && isOver && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'rgba(232,124,36,0.08)', borderRadius: 8,
          fontSize: 22, color: '#e87c24', fontWeight: 900, pointerEvents: 'none',
        }}>+</div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  كارد إحصائيات المهندس
// ══════════════════════════════════════════════════════
const ENG_COLORS = ['#e87c24', '#3b82f6', '#22c55e', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b'];

const EngineerStatCard = memo(({ engineer, appointments, isOnLeave }: { engineer: Employee; appointments: ApptWithMeta[]; isOnLeave: boolean }) => {
  const yellow = appointments.filter(a => a.color === '#facc15').length;
  const green  = appointments.filter(a => a.color === '#22c55e').length;
  const blue   = appointments.filter(a => a.color === '#3b82f6').length;
  const total  = appointments.length;
  const avatarBg = isOnLeave ? '#94a3b8' : ENG_COLORS[engineer.fullName?.charCodeAt(0) % ENG_COLORS.length || 0];

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16,
      padding: '14px 16px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      opacity: isOnLeave ? 0.65 : 1, transition: 'all .2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12, flexShrink: 0,
          background: `linear-gradient(135deg,${avatarBg},${avatarBg}dd)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 900, color: 'white',
          boxShadow: `0 3px 8px ${avatarBg}44`,
        }}>
          {engineer.fullName?.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {engineer.fullName}
          </div>
          <div style={{ fontSize: 10, color: isOnLeave ? '#f59e0b' : '#94a3b8', marginTop: 1, fontWeight: 600 }}>
            {isOnLeave ? '⚠️ في إجازة رسمية' : 'مهندس معماري'}
          </div>
        </div>
        <div style={{
          textAlign: 'center', flexShrink: 0, background: total > 0 ? '#f0fdf4' : '#f8fafc',
          border: `1.5px solid ${total > 0 ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 10,
          padding: '4px 10px', minWidth: 44,
        }}>
          <span style={{ display: 'block', fontSize: 20, fontWeight: 900, color: total === 0 ? '#94a3b8' : '#0f172a', lineHeight: 1 }}>{total}</span>
          <span style={{ display: 'block', fontSize: 8, color: '#94a3b8', fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>إجمالي</span>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0,
        marginBottom: 10, background: '#f8fafc', border: '1px solid #f1f5f9',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {[
          { count: yellow, dot: '#f59e0b', bg: '#fffbeb', label: 'أولى' },
          { count: green,  dot: '#22c55e', bg: '#f0fdf4', label: 'متابعة' },
          { count: blue,   dot: '#3b82f6', bg: '#eff6ff', label: 'متعاقد' },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '8px 4px', gap: 3,
            borderLeft: i > 0 ? '1px solid #e2e8f0' : 'none',
            opacity: total === 0 ? 0.4 : 1,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: item.dot }} />
            <span style={{ fontSize: 17, fontWeight: 900, color: total === 0 ? '#94a3b8' : '#0f172a', lineHeight: 1 }}>{item.count}</span>
            <span style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700 }}>{item.label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', height: 6, borderRadius: 100, overflow: 'hidden', background: '#f1f5f9', gap: 1 }}>
        {total === 0 ? (
          <div style={{ width: '100%', background: '#f1f5f9' }} />
        ) : (
          <>
            {yellow > 0 && <div style={{ width: `${(yellow / total) * 100}%`, background: 'linear-gradient(90deg,#fde047,#f59e0b)', borderRadius: 100 }} />}
            {green  > 0 && <div style={{ width: `${(green / total) * 100}%`, background: 'linear-gradient(90deg,#4ade80,#22c55e)', borderRadius: 100 }} />}
            {blue   > 0 && <div style={{ width: `${(blue / total) * 100}%`, background: 'linear-gradient(90deg,#60a5fa,#3b82f6)', borderRadius: 100 }} />}
          </>
        )}
      </div>
    </div>
  );
});
EngineerStatCard.displayName = 'EngineerStatCard';

// ══════════════════════════════════════════════════════
//  نافذة الحجز/التعديل/إعادة الجدولة
// ══════════════════════════════════════════════════════
function AppointmentManagerDialog({ isOpen, onClose, onSaveSuccess, mode, initialData, clients, firestore, currentUser, canBypassTime, rawAppointments, slotDur }: any) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = mode !== 'create';
  const originalApptDate = initialData?.appointmentDate ? toFirestoreDate(initialData.appointmentDate) : null;

  const [selectedDate, setSelectedDate] = useState<Date>(originalApptDate || new Date());
  const [selectedTime, setSelectedTime] = useState(originalApptDate ? format(originalApptDate, 'HH:mm') : '10:00');
  const [title, setTitle] = useState(initialData?.title || '');
  const [isNewClient, setIsNewClient] = useState(!initialData?.clientId);
  const [newName, setNewName] = useState(initialData?.clientName || '');
  const [newMobile, setNewMobile] = useState(initialData?.clientMobile || '');
  const [selectedClientId, setSelectedClientId] = useState(initialData?.clientId || '');

  const tenantId = currentUser?.currentCompanyId;
  const engineerId = initialData?.engineerId;

  const filteredClients = useMemo(() => {
    if (!engineerId || !clients?.length) return [];
    return clients.filter((c: Client) => (c as any).assignedEngineer === engineerId);
  }, [clients, engineerId]);

  const clientOptions = useMemo(() => filteredClients.map((c: Client) => ({ value: c.id!, label: c.nameAr })), [filteredClients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !tenantId) return;
    if (!title.trim()) { toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى إدخال الغرض من الزيارة.' }); return; }
    if (!selectedTime || !isValid(selectedDate)) { toast({ variant: 'destructive', title: 'خطأ زمني', description: 'تأكد من تحديد التاريخ والوقت.' }); return; }

    const [hh, mm] = selectedTime.split(':').map(Number);
    const finalDate = setHours(setMinutes(selectedDate, mm), hh);
    if (isPast(finalDate) && !canBypassTime) { toast({ variant: 'destructive', title: '⏰ عائق زمني', description: 'لا يمكن الحجز في الماضي.' }); return; }

    if (isNewClient && (!newName || !newMobile)) { toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'أدخل الاسم والجوال.' }); return; }
    if (!isNewClient && !selectedClientId) { toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'اختر العميل.' }); return; }

    const isReschedule = isEditing && format(finalDate, 'HH:mm yyyy-MM-dd') !== format(originalApptDate!, 'HH:mm yyyy-MM-dd');

    if (isReschedule) {
      const clientIdToCheck = isNewClient ? '' : selectedClientId;
      if (clientIdToCheck) {
        const c = checkClientTimeConflict(rawAppointments || [], clientIdToCheck, finalDate, slotDur || 45, initialData.id);
        if (c) { toast({ variant: 'destructive', title: '⏰ العميل مشغول', description: `لديه موعد الساعة ${format(toFirestoreDate(c.appointmentDate)!, 'HH:mm')}.` }); return; }
      }
    }

    setIsSaving(true);
    try {
      const p = getTenantPath('appointments', tenantId);
      if (isEditing) {
        const ref = doc(firestore, p!, initialData.id);
        await updateDoc(ref, cleanFirestoreData({
          engineerId, title: title.trim(), appointmentDate: Timestamp.fromDate(finalDate),
          ...(isNewClient ? { clientName: newName, clientMobile: newMobile } : { clientId: selectedClientId }),
          updatedAt: serverTimestamp(), updatedBy: currentUser?.id
        }));
        const action = isReschedule ? 'rescheduled' : 'updated';
        const details = isReschedule ? `أُعيد جدوله إلى ${format(finalDate, 'PPp', { locale: ar })}` : `تم تعديل بيانات الموعد`;
        const batch = writeBatch(firestore);
        batch.set(doc(collection(ref, 'auditLogs')), { action, details, userName: currentUser?.fullName, createdAt: serverTimestamp(), companyId: tenantId });
        await batch.commit();
      } else {
        const ref = doc(collection(firestore, p!));
        const batch = writeBatch(firestore);
        const data: any = {
          title: title.trim(), engineerId, appointmentDate: Timestamp.fromDate(finalDate),
          type: 'architectural', status: 'scheduled', createdAt: serverTimestamp(),
          createdBy: currentUser.id, createdByName: currentUser.fullName,
          workStageUpdated: false, companyId: tenantId
        };
        if (isNewClient) { data.clientName = newName; data.clientMobile = newMobile; data.visitCount = 1; data.color = '#facc15'; }
        else { const vc = (rawAppointments || []).filter((a: Appointment) => a.clientId === selectedClientId && a.status !== 'cancelled').length + 1; data.clientId = selectedClientId; data.visitCount = vc; data.color = getVisitColor({ visitCount: vc }); }
        batch.set(ref, cleanFirestoreData(data));
        batch.set(doc(collection(ref, 'auditLogs')), { action: 'created', details: `أنشأه ${currentUser.fullName}.`, userName: currentUser.fullName, createdAt: serverTimestamp(), companyId: tenantId });
        await batch.commit();
      }
      toast({ title: `✅ ${isEditing ? (isReschedule ? 'تمت إعادة الجدولة' : 'تم التعديل بنجاح') : 'تم الحجز بنجاح'}` });
      onSaveSuccess(); onClose();
    } catch (err: any) { toast({ variant: 'destructive', title: 'خطأ', description: err.message }); } finally { setIsSaving(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={o => { if (!o && !isSaving) onClose(); }}>
      <DialogContent style={{ maxWidth: 480, borderRadius: 20 }}>
        <DialogHeader>
          <DialogTitle style={{ fontWeight: 800 }}>
            {isEditing ? (mode === 'reschedule' ? '🔄 إعادة جدولة الموعد' : '✏️ تعديل بيانات الموعد') : '📅 حجز موعد جديد'}
          </DialogTitle>
          <DialogDescription style={{ fontSize: 13 }}>
            {initialData?.engineerName || 'مهندس غير محدد'} • {initialData?.clientName || ''}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Label style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>التاريخ والوقت</Label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" style={{ flex: 1, justifyContent: 'flex-start', borderRadius: 12, fontWeight: 700, height: 42 }}>
                    <CalendarIcon className="ml-2 w-4 h-4" />
                    {format(selectedDate, 'PPP', { locale: ar })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" style={{ width: 'auto', padding: 0, borderRadius: 16, overflow: 'hidden' }}>
                  <Calendar mode="single" selected={selectedDate} locale={ar} onSelect={d => d && setSelectedDate(d)} className="rounded-lg border shadow-sm" />
                </PopoverContent>
              </Popover>
              <Input type="time" value={selectedTime} onChange={e => setSelectedTime(e.target.value)} style={{ width: 110, borderRadius: 12, height: 42, fontWeight: 700 }} />
            </div>
          </div>
          <div>
            <Label style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>الغرض من الزيارة *</Label>
            <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: مناقشة المخططات..." style={{ height: 42, borderRadius: 12, marginTop: 6, fontWeight: 600 }} disabled={isSaving} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Checkbox id="newC" checked={isNewClient} onCheckedChange={c => { setIsNewClient(!!c); setSelectedClientId(''); }} disabled={isSaving} />
            <Label htmlFor="newC" style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#334155' }}>عميل جديد (زيارة أولى)</Label>
          </div>

          {isNewClient ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><Label style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>الاسم *</Label><Input value={newName} onChange={e => setNewName(e.target.value)} required disabled={isSaving} style={{ height: 40, borderRadius: 12, marginTop: 6, fontWeight: 600 }} /></div>
              <div><Label style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>الجوال *</Label><Input value={newMobile} onChange={e => setNewMobile(e.target.value)} required disabled={isSaving} style={{ height: 40, borderRadius: 12, marginTop: 6, fontWeight: 600 }} /></div>
            </div>
          ) : (
            <div>
              <Label style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>العميل المسجل</Label>
              <div style={{ marginTop: 6 }}><InlineSearchList value={selectedClientId} onSelect={setSelectedClientId} options={clientOptions} placeholder="ابحث عن عميل..." disabled={isSaving || clientOptions.length === 0} className="h-10" /></div>
            </div>
          )}
          <DialogFooter style={{ gap: 8, marginTop: 4 }}>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} style={{ borderRadius: 12, fontWeight: 700 }}>إلغاء</Button>
            <Button type="submit" disabled={isSaving} style={{ borderRadius: 12, fontWeight: 700, minWidth: 100 }}>{isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />} تأكيد</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════
//  المكوّن الرئيسي
// ══════════════════════════════════════════════════════
export function ArchitecturalAppointmentsView() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { branding, loading: brandingLoading } = useBranding();
  const printRef = useRef<HTMLDivElement>(null);

  const [date, setDate] = useState<Date | undefined>(undefined);
  const [rawAppointments, setRawAppointments] = useState<Appointment[]>([]);
  const [engineers, setEngineers] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{ mode: 'create' | 'edit' | 'reschedule', appointmentDate?: Date, engineerId?: string, engineerName?: string, id?: string, clientId?: string, clientName?: string, clientMobile?: string, title?: string } | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [appointmentToDelete, setAppointmentToDelete] = useState<ApptWithMeta | null>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<ApptWithMeta | null>(null);

  const tenantId = currentUser?.currentCompanyId;
  const canBypassTime = useMemo(() => ['Admin', 'Developer'].includes(currentUser?.role || ''), [currentUser?.role]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  useEffect(() => { if (!date) setDate(new Date()); }, [date]);

  const { morningSlots, eveningSlots, isRamadan, slotDur } = useMemo(() => {
    const fb = { morningSlots: [] as string[], eveningSlots: [] as string[], isRamadan: false, slotDur: 45 };
    if (!date) return fb;
    const ram = branding?.work_hours?.ramadan;
    const inRam = ram?.is_enabled && date >= toFirestoreDate(ram.start_date)! && date <= toFirestoreDate(ram.end_date)!;
    if (inRam) {
      const d = ram.appointment_slot_duration || 30;
      return { morningSlots: generateTimeSlots(ram.start_time || '09:00', ram.end_time || '15:00', d, ram.appointment_buffer_time || 0), eveningSlots: [], isRamadan: true, slotDur: d };
    }
    const wh = branding?.work_hours?.architectural;
    if (!wh) return fb;
    const d = wh.appointment_slot_duration || 45, buf = wh.appointment_buffer_time || 0;
    const today = weekDays[date.getDay()].id;
    if (branding?.work_hours?.holidays?.includes(today)) return { ...fb, slotDur: d };
    const half = branding?.work_hours?.half_day, isHalf = half?.day === today;
    let { morning_start_time: ms, morning_end_time: me, evening_start_time: es, evening_end_time: ee } = wh;
    if (isHalf) {
      if (half.type === 'morning_only') { es = ''; ee = ''; }
      else if (half.type === 'custom_end_time' && half.end_time) {
        if (half.end_time <= me) { me = half.end_time; es = ''; ee = ''; }
        else { ee = half.end_time < ee ? half.end_time : ee; }
      }
    }
    return { morningSlots: generateTimeSlots(ms, me, d, buf), eveningSlots: generateTimeSlots(es, ee, d, buf), isRamadan: false, slotDur: d };
  }, [branding, date]);

  const fetchAppointments = useCallback(async (d: Date) => {
    if (!firestore || !tenantId) return;
    setLoading(true);
    try {
      const p = getTenantPath('appointments', tenantId);
      const snap = await getDocs(query(collection(firestore, p!), where('appointmentDate', '>=', startOfDay(d)), where('appointmentDate', '<=', endOfDay(d))));
      setRawAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)).filter(a => a.type === 'architectural'));
    } finally { setLoading(false); }
  }, [firestore, tenantId]);

  useEffect(() => {
    if (!firestore || !tenantId) return;
    getDocs(query(collection(firestore, getTenantPath('employees', tenantId)!), where('status', 'in', ['active', 'on-leave'])))
      .then(snap => { setEngineers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)).filter(e => e.department?.includes('المعماري')).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'))); });
    getDocs(query(collection(firestore, getTenantPath('clients', tenantId)!), where('isActive', '==', true)))
      .then(snap => { setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)).sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'))); });
    getDocs(query(collection(firestore, getTenantPath('leaveRequests', tenantId)!), where('status', 'in', ['approved', 'on-leave', 'returned'])))
      .then(snap => { setLeaveRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest))); });
  }, [firestore, tenantId]);

  useEffect(() => { if (date) fetchAppointments(date); }, [date, fetchAppointments]);

  const clientsMap = useMemo(() => { const map = new Map<string, Client>(); clients.forEach(c => map.set(c.id, c)); return map; }, [clients]);
  const appointments = useMemo<ApptWithMeta[]>(() => rawAppointments.filter(a => a.status !== 'cancelled').map(appt => {
    const client = clientsMap.get(appt.clientId || '');
    return { ...appt, clientName: appt.clientId ? (client?.nameAr || appt.clientName) : appt.clientName, clientArea: (client as any)?.address?.area || null, bookedByName: (appt as any).createdByName || null };
  }), [rawAppointments, clientsMap]);

  const stats = useMemo(() => ({
    total: appointments.length,
    yellow: appointments.filter(a => a.color === '#facc15').length,
    green: appointments.filter(a => a.color === '#22c55e').length,
    blue: appointments.filter(a => a.color === '#3b82f6').length,
  }), [appointments]);

  const engApptMap = useMemo(() => {
    const m: Record<string, ApptWithMeta[]> = {};
    engineers.forEach(e => { m[e.id!] = []; });
    appointments.forEach(a => { if (m[a.engineerId]) m[a.engineerId].push(a); });
    return m;
  }, [appointments, engineers]);

  const grid = useMemo(() => {
    const g: Record<string, Record<string, ApptWithMeta | null>> = {};
    engineers.forEach(e => { g[e.id!] = {}; [...morningSlots, ...eveningSlots].forEach(s => (g[e.id!][s] = null)); });
    appointments.forEach(a => {
      const d = toFirestoreDate(a.appointmentDate);
      if (!d) return;
      const t = format(d, 'HH:mm');
      if (g[a.engineerId] && t in g[a.engineerId]) g[a.engineerId][t] = a;
    });
    return g;
  }, [appointments, engineers, morningSlots, eveningSlots]);

  const getLeave = useCallback((empId: string, d: Date) => leaveRequests.find(r => {
    if (r.employeeId !== empId) return false;
    const s = toFirestoreDate(r.startDate), e = toFirestoreDate(r.endDate);
    if (!s || !e) return false;
    return isWithinInterval(startOfDay(d), { start: startOfDay(s), end: endOfDay(e) });
  }), [leaveRequests]);

  // ═══════════════════════════════════════════════════
  //  معالجة السحب والإفلات
  // ═══════════════════════════════════════════════════
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event; setActiveDragId(null);
    if (!over || !firestore || !tenantId || !date) return;
    const apptId = active.id as string;
    const dragged = rawAppointments.find(a => a.id === apptId);
    if (!dragged) return;
    const parts = (over.id as string).split('|');
    if (parts[0] !== 'slot' || parts.length !== 3) return;
    const [, targetEngId, targetTime] = parts;
    const [h, m] = targetTime.split(':').map(Number);
    const newDT = setHours(setMinutes(date, m), h);
    if (isPast(newDT) && !canBypassTime) { toast({ variant: 'destructive', title: '⏰ عائق زمني', description: 'لا يمكنك نقل موعد للماضي.' }); return; }
    if (dragged.clientId) {
      const cs = await getDoc(doc(firestore, getTenantPath(`clients/${dragged.clientId}`, tenantId)!));
      if (cs.exists() && (cs.data() as any)?.assignedEngineer && (cs.data() as any).assignedEngineer !== targetEngId) {
        toast({ variant: 'destructive', title: '🚫 ملكية حصرية', description: 'عذراً، هذا المهندس ليس هو المسؤول عن هذا العميل.' }); return;
      }
    }
    if (rawAppointments.some(a => a.id !== apptId && a.engineerId === targetEngId && format(toFirestoreDate(a.appointmentDate)!, 'HH:mm') === targetTime && a.status !== 'cancelled')) {
      toast({ variant: 'destructive', title: '📅 تعارض', description: 'هذا المهندس لديه موعد آخر في هذا الوقت.' }); return;
    }
    if (dragged.clientId) {
      const c = checkClientTimeConflict(rawAppointments, dragged.clientId, newDT, slotDur, apptId);
      if (c) { toast({ variant: 'destructive', title: '⏰ العميل مشغول', description: `لديه موعد الساعة ${format(toFirestoreDate(c.appointmentDate)!, 'HH:mm')}.` }); return; }
    }
    try {
      const appointmentRef = doc(firestore, getTenantPath('appointments', tenantId)!, apptId);
      await runTransaction(firestore, async (transaction) => {
        transaction.update(appointmentRef, { engineerId: targetEngId, appointmentDate: Timestamp.fromDate(newDT), updatedAt: serverTimestamp(), updatedBy: currentUser?.id });
        transaction.set(doc(collection(appointmentRef, 'auditLogs')), { action: 'rescheduled', details: `نُقل من ${toFirestoreDate(dragged.appointmentDate) ? format(toFirestoreDate(dragged.appointmentDate)!, 'HH:mm') : '---'} إلى ${targetTime} بواسطة ${currentUser?.fullName}.`, userName: currentUser?.fullName, createdAt: serverTimestamp(), companyId: tenantId });
      });
      if (dragged.clientId || dragged.clientMobile) await reconcileClientAppointments(firestore, tenantId, { clientId: dragged.clientId, clientMobile: dragged.clientMobile });
      toast({ title: '✅ تمت الإزاحة بنجاح' }); fetchAppointments(date);
    } catch (error: any) { toast({ variant: 'destructive', title: 'فشل النقل', description: error.message || 'حدث خطأ غير متوقع' }); }
  };

  const handleCancel = async () => {
    if (!appointmentToCancel || !firestore || !tenantId) return;
    try {
      const batch = writeBatch(firestore);
      const p = getTenantPath('appointments', tenantId);
      const ref = doc(firestore, p!, appointmentToCancel.id!);
      batch.update(ref, { status: 'cancelled', updatedBy: currentUser?.id, updatedAt: serverTimestamp() });
      batch.set(doc(collection(ref, 'auditLogs')), { action: 'cancelled', details: `ألغاه ${currentUser?.fullName}.`, userName: currentUser?.fullName, createdAt: serverTimestamp(), companyId: tenantId });
      await batch.commit();
      await reconcileClientAppointments(firestore, tenantId, { clientId: appointmentToCancel.clientId, clientMobile: appointmentToCancel.clientMobile });
      toast({ title: 'تم إلغاء الموعد بنجاح' }); fetchAppointments(date!);
    } finally { setAppointmentToCancel(null); }
  };

  const handleHardDelete = async () => {
    if (!appointmentToDelete || !firestore || !tenantId) return;
    try {
      const p = getTenantPath('appointments', tenantId);
      await deleteDoc(doc(firestore, p!, appointmentToDelete.id!));
      await reconcileClientAppointments(firestore, tenantId, { clientId: appointmentToDelete.clientId, clientMobile: appointmentToDelete.clientMobile });
      toast({ title: 'تم حذف الموعد نهائياً' }); fetchAppointments(date!);
    } finally { setAppointmentToDelete(null); }
  };

  // ═══════════════════════════════════════════════════
  //  وظيفة الطباعة الاحترافية
  // ═══════════════════════════════════════════════════
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ═══════════════════════════════════════════════════
  //  عرض فترة (صباحية/مسائية)
  // ═══════════════════════════════════════════════════
  const renderPeriod = (title: string, emoji: string, slots: string[]) => {
    if (!slots.length) return null;
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#334155', letterSpacing: '-0.01em' }}>{emoji} {title}</span>
          <div style={{ flex: 1, height: 1.5, background: 'linear-gradient(90deg,#e2e8f0,transparent)' }} />
          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>{slots.length} خانة</span>
        </div>
        <div style={{
          background: '#fff', borderRadius: 18,
          border: '1.5px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)',
          overflowX: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 500 }}>
            <thead>
              <tr>
                <th style={{
                  background: 'linear-gradient(180deg,#f8fafc,#f1f5f9)',
                  padding: '12px 16px', fontSize: 11, fontWeight: 800, color: '#475569',
                  textAlign: 'right', borderBottom: '2px solid #e2e8f0',
                  borderLeft: '1px solid #e2e8f0', width: 160, minWidth: 160,
                  position: 'sticky', left: 0, zIndex: 5,
                }}>
                  المهندس المختص
                </th>
                {slots.map(t => (
                  <th key={t} style={{
                    background: 'linear-gradient(180deg,#f8fafc,#f1f5f9)',
                    padding: '10px 6px', fontSize: 12, fontWeight: 800, color: '#334155',
                    textAlign: 'center', borderBottom: '2px solid #e2e8f0',
                    borderLeft: '1px solid #e2e8f0', minWidth: 100,
                  }}>
                    <div>{t}</div>
                    <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2, fontWeight: 600 }}>{slotDur} دقيقة</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {engineers.map((eng, engIdx) => {
                const onLeave = !!(date && getLeave(eng.id!, date));
                const engColor = ENG_COLORS[eng.fullName?.charCodeAt(0) % ENG_COLORS.length || 0];
                const engAppts = engApptMap[eng.id!] || [];
                return (
                  <tr key={eng.id} style={{ background: engIdx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                    <td style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid #e2e8f0',
                      borderLeft: '1px solid #e2e8f0',
                      background: engIdx % 2 === 0 ? '#fafbfc' : '#f5f6f8',
                      verticalAlign: 'middle',
                      position: 'sticky', left: 0, zIndex: 5,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 10,
                          background: onLeave ? '#94a3b8' : `linear-gradient(135deg,${engColor},${engColor}dd)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 900, color: 'white', flexShrink: 0,
                          boxShadow: onLeave ? 'none' : `0 2px 6px ${engColor}44`,
                        }}>
                          {eng.fullName?.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>{eng.fullName}</div>
                          <div style={{ fontSize: 10, color: onLeave ? '#f59e0b' : '#94a3b8', marginTop: 2, fontWeight: 600 }}>
                            {onLeave ? '⚠️ في إجازة' : `${engAppts.length} مواعيد`}
                          </div>
                        </div>
                      </div>
                    </td>
                    {slots.map(time => {
                      const booking = grid[eng.id!]?.[time];
                      return (
                        <td key={time} style={{
                          padding: 4,
                          borderBottom: '1px solid #e2e8f0',
                          borderLeft: '1px solid #e2e8f0',
                          verticalAlign: 'top',
                          height: 78,
                          overflow: 'visible',
                          position: 'relative',
                          // الخلية تكبر مع المحتوى
                          minHeight: 78,
                        }}>
                          <DroppableSlot
                            id={`slot|${eng.id}|${time}`}
                            isEngineerOnLeave={onLeave}
                            onClick={() => {
                              if (onLeave || booking) return;
                              const [hh, mm] = time.split(':').map(Number);
                              const apptDate = setHours(setMinutes(date!, mm), hh);
                              if (isPast(apptDate) && !canBypassTime) return toast({ title: 'عائق زمني', description: 'لا يمكن الحجز في الماضي.' });
                              setDialogData({ mode: 'create', engineerId: eng.id, engineerName: eng.fullName, appointmentDate: apptDate });
                              setIsDialogOpen(true);
                            }}
                          >
                            {onLeave ? (
                              <div style={{
                                fontSize: 10, color: '#dc2626', fontWeight: 700,
                                padding: '6px 8px', textAlign: 'center', width: '100%',
                                background: 'rgba(239,68,68,0.06)', borderRadius: 6,
                              }}>
                                في إجازة رسمية
                              </div>
                            ) : booking ? (
                              <AppointmentCard
                                appointment={booking}
                                onOpenDetails={a => router.push(`/dashboard/appointments/${a.id}`)}
                                onOpenEdit={(a, mode) => { setDialogData({ mode, ...a, engineerName: eng.fullName }); setIsDialogOpen(true); }}
                                onDelete={a => setAppointmentToDelete(a)}
                                onCancel={a => setAppointmentToCancel(a)}
                              />
                            ) : null}
                          </DroppableSlot>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (brandingLoading || loading) return <Skeleton className="w-full h-64 rounded-2xl" />;

  const formattedDate = date ? format(date, 'EEEE d MMMM yyyy', { locale: ar }) : '';

  return (
    <>
      <style>{PRINT_STYLES}</style>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => setActiveDragId(e.active.id as string)} onDragEnd={handleDragEnd}>
        <div ref={printRef} className="print-area" style={{ padding: '18px 20px', background: '#f4f6f9', minHeight: '100%', borderRadius: 0 }}>

          {/* ══════ رأس الصفحة ══════ */}
          <div style={{
            background: '#fff', borderRadius: 20, padding: '18px 24px', marginBottom: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1.5px solid #e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: 'linear-gradient(135deg,#e87c24,#f59e0b)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
                boxShadow: '0 4px 12px rgba(232,124,36,0.3)',
              }}>📅</div>
              <div>
                <div style={{ fontSize: 19, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>جدول المواعيد المعمارية</div>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>
                  <MousePointer2 style={{ width: 11, height: 11, display: 'inline', marginLeft: 4, verticalAlign: 'middle' }} />
                  السحب والإفلات نشط · حماية التعارضات مفعّلة
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="no-print">
              <Button
                onClick={handlePrint}
                variant="outline"
                style={{
                  borderRadius: 12, fontWeight: 700, fontSize: 12, height: 38,
                  background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Printer size={15} />
                طباعة الجدول
              </Button>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" style={{
                    background: '#fff7ed', borderColor: '#fed7aa', color: '#ea580c',
                    fontWeight: 800, fontSize: 12, borderRadius: 12, height: 38,
                  }}>
                    <CalendarIcon className="ml-2 w-4 h-4" />
                    {date ? format(date, 'PPP', { locale: ar }) : 'اختر تاريخ'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" style={{ width: 'auto', padding: 0, borderRadius: 16, overflow: 'hidden' }}>
                  <Calendar mode="single" selected={date} locale={ar} initialFocus onSelect={d => { if (d) setDate(d); setIsCalendarOpen(false); }} className="rounded-lg border shadow-sm" />
                </PopoverContent>
              </Popover>
            </div>

            {/* شارة الطباعة - تظهر فقط عند الطباعة */}
            <div className="print-badge" style={{ display: 'none', alignItems: 'center', gap: 12, justifyContent: 'center', width: '100%', padding: '8px 0' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>جدول المواعيد المعمارية</div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>• {formattedDate}</div>
            </div>
          </div>

          {/* ══════ بطاقات الإحصائيات ══════ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { emoji: '📅', bg: '#fff7ed', count: stats.total, label: 'مواعيد اليوم', color: '#ea580c', showBar: true },
              { emoji: '🟡', bg: '#fffbeb', count: stats.yellow, label: 'زيارة أولى', color: '#d97706', showBar: false },
              { emoji: '🟢', bg: '#f0fdf4', count: stats.green, label: 'متابعة', color: '#16a34a', showBar: false },
              { emoji: '🔵', bg: '#eff6ff', count: stats.blue, label: 'متعاقد', color: '#2563eb', showBar: false },
            ].map((item, i) => (
              <div key={i} style={{
                background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16,
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, background: item.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>{item.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: item.color, lineHeight: 1 }}>{item.count}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, marginTop: 3 }}>{item.label}</div>
                </div>
                {item.showBar && stats.total > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                    <div style={{ width: `${Math.max(10, (stats.yellow / stats.total) * 44)}px`, height: 4, borderRadius: 100, background: 'linear-gradient(90deg,#fde047,#f59e0b)' }} />
                    <div style={{ width: `${Math.max(10, (stats.green / stats.total) * 44)}px`, height: 4, borderRadius: 100, background: 'linear-gradient(90deg,#4ade80,#22c55e)' }} />
                    <div style={{ width: `${Math.max(10, (stats.blue / stats.total) * 44)}px`, height: 4, borderRadius: 100, background: 'linear-gradient(90deg,#60a5fa,#3b82f6)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ══════ بطاقات المهندسين ══════ */}
          {engineers.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(engineers.length, 4)}, 1fr)`,
              gap: 10, marginBottom: 16,
            }}>
              {engineers.map(eng => (
                <EngineerStatCard
                  key={eng.id}
                  engineer={eng}
                  appointments={engApptMap[eng.id!] || []}
                  isOnLeave={!!(date && getLeave(eng.id!, date))}
                />
              ))}
            </div>
          )}

          {/* ══════ الجدول ══════ */}
          {isRamadan
            ? renderPeriod('دوام رمضان', '🌙', morningSlots)
            : <>{renderPeriod('الفترة الصباحية', '☀️', morningSlots)}{renderPeriod('الفترة المسائية', '🌆', eveningSlots)}</>
          }
        </div>

        {isDialogOpen && dialogData && (
          <AppointmentManagerDialog
            isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)}
            onSaveSuccess={() => date && fetchAppointments(date)}
            mode={dialogData.mode} initialData={dialogData}
            clients={clients} firestore={firestore} currentUser={currentUser}
            canBypassTime={canBypassTime} rawAppointments={rawAppointments} slotDur={slotDur}
          />
        )}

        <AlertDialog open={!!appointmentToCancel} onOpenChange={() => setAppointmentToCancel(null)}>
          <AlertDialogContent style={{ borderRadius: 20 }}>
            <AlertDialogHeader>
              <AlertDialogTitle style={{ fontWeight: 800 }}>⚠️ إلغاء الموعد؟</AlertDialogTitle>
              <AlertDialogDescription>سيتم تحديد الموعد كملغى، ولن يتم احتسابه ضمن عدد زيارات العميل.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel style={{ borderRadius: 12, fontWeight: 700 }}>تراجع</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancel} style={{ borderRadius: 12, fontWeight: 700, background: '#ea580c' }}>نعم، إلغاء</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!appointmentToDelete} onOpenChange={() => setAppointmentToDelete(null)}>
          <AlertDialogContent style={{ borderRadius: 20 }}>
            <AlertDialogHeader>
              <AlertDialogTitle style={{ fontWeight: 800 }}>🗑️ حذف الموعد نهائياً؟</AlertDialogTitle>
              <AlertDialogDescription>سيتم مسح الموعد تماماً من السجلات. هذا الإجراء لا يمكن التراجع عنه.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel style={{ borderRadius: 12, fontWeight: 700 }}>تراجع</AlertDialogCancel>
              <AlertDialogAction onClick={handleHardDelete} style={{ borderRadius: 12, fontWeight: 700, background: '#dc2626' }}>نعم، حذف نهائي</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <DragOverlay
          dropAnimation={defaultDropAnimationSideEffects({
            styles: { active: { opacity: '0.85', cursor: 'grabbing', zIndex: 9999 } }
          })}
          style={{ pointerEvents: 'none' }}
        >
          {activeDragId && (() => {
            const a = rawAppointments.find(x => x.id === activeDragId);
            const client = clients.find(c => c.id === a?.clientId);
            const styles = cardGradient(a?.color);
            return (
              <div style={{
                background: styles.bg, border: styles.border, borderRadius: 12,
                padding: '8px 16px', fontSize: 13, fontWeight: 800,
                boxShadow: '0 16px 40px rgba(0,0,0,0.25)', cursor: 'grabbing',
                minWidth: 120,
              }}>
                <div style={{ color: '#1e293b' }}>{a?.clientId ? (client?.nameAr || a?.clientName) : a?.clientName}</div>
                {client && (client as any).address?.area && (
                  <div style={{ fontSize: 10, color: '#0d9488', marginTop: 3, fontWeight: 700 }}>📍 {(client as any).address.area}</div>
                )}
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>
    </>
  );
}