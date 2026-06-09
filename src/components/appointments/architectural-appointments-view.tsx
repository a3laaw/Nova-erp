'use client';

import React, { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import { useFirebase } from '@/firebase/provider';
import {
  collection, query, getDocs, where,
  serverTimestamp, Timestamp, doc, writeBatch, getDoc, deleteDoc, updateDoc, runTransaction, setDoc, addDoc,
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
import { CalendarIcon, Loader2, Eye, Pencil, Trash2, CheckCircle, MousePointer2, MoreHorizontal, XCircle, GripVertical, CalendarDays } from 'lucide-react';
import { getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Appointment, Client, Employee, LeaveRequest } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import { useRouter } from 'next/navigation';
import { Checkbox } from '../ui/checkbox';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import { useBranding } from '@/context/branding-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent,
  useDraggable, useDroppable, DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';

// ══════════════════════════════════════════════════════
// 🔍 التحقق من تعارض وقت العميل
// ═════════════════════════════════════════════════════
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
  if (color === '#facc15') return { bg: 'linear-gradient(135deg,#fef9c3,#fef08a)', border: '1.5px solid #fde047', shadow: '0 2px 5px rgba(234,179,8,.18)' };
  if (color === '#22c55e') return { bg: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', border: '1.5px solid #4ade80', shadow: '0 2px 5px rgba(34,197,94,.18)' };
  if (color === '#3b82f6') return { bg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)', border: '1.5px solid #60a5fa', shadow: '0 2px 5px rgba(59,130,246,.18)' };
  return { bg: 'linear-gradient(135deg,#f3f4f6,#e5e7eb)', border: '1.5px solid #d1d5db', shadow: '0 1px 3px rgba(0,0,0,.08)' };
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
      contractSigned = cs.exists() && ['contracted', 'reContracted', 'active'].includes((cs.data() as any)?.status);
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
// 🎴 بطاقة الموعد (تم تكبير الخطوط)
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
  const { bg, border, shadow } = cardGradient(appointment.color);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (btnRef.current) { const rect = btnRef.current.getBoundingClientRect(); setMenuPos({ top: rect.bottom + 6, left: rect.left }); }
    setMenuOpen(p => !p);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <>
      <div ref={setNodeRef} style={{ ...dragStyle, position: 'relative', height: '100%', width: '100%', minHeight: 70, boxSizing: 'border-box', background: bg, border, boxShadow: shadow, borderRadius: 0, padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'visible', transition: 'box-shadow .15s, border-color .15s', pointerEvents: 'auto', touchAction: 'none', zIndex: 10 }} {...attributes}>
        
        <div style={{ flex: 1, cursor: 'default', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', width: '100%', pointerEvents: 'auto' }}>
          
          <div style={{ position: 'absolute', top: 4, left: 4, zIndex: 20 }}>
            <button ref={btnRef} onClick={toggleMenu} onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }} style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all .2s', zIndex: 25 }} onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#000'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; e.currentTarget.style.color = '#64748b'; }}>
              <MoreHorizontal size={12} />
            </button>
          </div>

          <div {...listeners} style={{ position: 'absolute', top: '50%', right: 4, transform: 'translateY(-50%)', cursor: 'grab', color: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', zIndex: 15, padding: '4px', borderRadius: 4, pointerEvents: 'auto', touchAction: 'none' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }} onClick={e => { e.stopPropagation(); e.preventDefault(); }} onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}>
            <GripVertical size={16} />
          </div>

          {/* ✅ تعديل تكبير الخط هنا */}
          <div style={{ paddingLeft: 24, minWidth: 0, display: 'flex', alignItems: 'center' }}>
            {appointment.workStageUpdated && <CheckCircle style={{ width: 14, height: 14, color: '#16a34a', flexShrink: 0, marginLeft: 4 }} />}
            <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{appointment.clientName}</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', flexWrap: 'nowrap', marginTop: 4 }}>
            {appointment.visitCount && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 100, background: 'rgba(255,255,255,0.8)', color: '#475569', border: '1px solid rgba(0,0,0,0.1)', whiteSpace: 'nowrap', flexShrink: 0 }}>زيارة {appointment.visitCount}{appointment.visitCount === 1 ? ' 🆕' : ''}</span>}
            {appointment.clientArea && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 100, background: 'rgba(255,255,255,0.8)', color: '#0d9488', border: '1px solid rgba(13,148,136,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>📍 {appointment.clientArea}</span>}
          </div>
          
          {appointment.bookedByName && <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>👤 حجزه: {appointment.bookedByName}</div>}
        </div>
      </div>

      {menuOpen && (
        <div ref={menuRef} style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, background: '#ffffff', borderRadius: 12, width: 220, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)', zIndex: 99999, overflow: 'hidden', direction: 'rtl', animation: 'menuIn .15s ease' }}>
          <style>{`@keyframes menuIn{from{opacity:0;transform:scale(.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
          <div style={{ padding: '12px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appointment.clientName}</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{appointment.visitCount && `زيارة رقم ${appointment.visitCount}`}</div>
          </div>
          <div style={{ padding: '4px' }}>
            {[
              { icon: <Eye size={14} />, label: 'الدخول للمسار الفني', color: '#2563eb', action: () => { setMenuOpen(false); onOpenDetails(appointment); } },
              { icon: <Pencil size={14} />, label: 'تعديل بيانات الموعد', color: '#475569', action: () => { setMenuOpen(false); onOpenEdit(appointment, 'edit'); } },
              { icon: <CalendarDays size={14} />, label: 'جدولة ليوم آخر', color: '#0891b2', action: () => { setMenuOpen(false); onOpenEdit(appointment, 'reschedule'); } },
            ].map((item, i) => (
              <button key={i} onClick={item.action} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: item.color, textAlign: 'right', borderRadius: 8, transition: 'background .15s' }} onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
          <div style={{ height: 1, background: '#e2e8f0', margin: '4px 0' }} />
          <div style={{ padding: '4px' }}>
            <button onClick={() => { setMenuOpen(false); onCancel(appointment); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#ea580c', textAlign: 'right', borderRadius: 8, transition: 'background .15s' }} onMouseEnter={e => { e.currentTarget.style.background = '#fff7ed'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
              <XCircle size={14} /> إلغاء الموعد
            </button>
            <button onClick={() => { setMenuOpen(false); onDelete(appointment); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#dc2626', textAlign: 'right', borderRadius: 8, transition: 'background .15s' }} onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
              <Trash2 size={14} /> حذف نهائي
            </button>
          </div>
        </div>
      )}
    </>
  );
});
AppointmentCard.displayName = 'AppointmentCard';

// ══════════════════════════════════════════════════════
// 📦 خانة الإفلات
// ══════════════════════════════════════════════════════
function DroppableSlot({ id, children, onClick, isEngineerOnLeave }: { id: string; children: React.ReactNode; onClick: () => void; isEngineerOnLeave: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled: isEngineerOnLeave || !!children });
  return (
    <div ref={setNodeRef} onClick={(e) => { if (children || isEngineerOnLeave) { e.stopPropagation(); return; } onClick(); }} style={{ height: '100%', width: '100%', minHeight: 70, boxSizing: 'border-box', background: isOver ? 'rgba(232,124,36,0.15)' : 'transparent', border: `2px dashed ${isOver ? '#e87c24' : 'transparent'}`, borderRadius: 0, cursor: children || isEngineerOnLeave ? 'not-allowed' : 'pointer', transition: 'all .15s', position: 'relative', display: 'flex', alignItems: children ? 'flex-start' : 'center', justifyContent: children ? 'flex-start' : 'center', pointerEvents: 'auto' }}>
      {children}
      {!children && isOver && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(232,124,36,0.1)', fontSize: 20, color: '#e87c24', fontWeight: 900, pointerEvents: 'none' }}>+</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// 📊 كارد إحصائيات المهندس
// ══════════════════════════════════════════════════════
const ENG_COLORS = ['#e87c24','#3b82f6','#22c55e','#8b5cf6','#ec4899','#14b8a6','#f59e0b'];
function EngineerStatCard({ engineer, appointments, isOnLeave }: { engineer: Employee; appointments: ApptWithMeta[]; isOnLeave: boolean }) {
  const yellow = appointments.filter(a => a.color === '#facc15').length;
  const green  = appointments.filter(a => a.color === '#22c55e').length;
  const blue   = appointments.filter(a => a.color === '#3b82f6').length;
  const total  = appointments.length;
  const avatarBg = isOnLeave ? '#94a3b8' : ENG_COLORS[engineer.fullName?.charCodeAt(0) % ENG_COLORS.length || 0];
  return (
    <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '12px 14px 10px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', opacity: isOnLeave ? 0.75 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg,${avatarBg},${avatarBg}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>{engineer.fullName?.charAt(0)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{engineer.fullName}</div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{isOnLeave ? '⚠️ في إجازة رسمية' : 'مهندس معماري'}</div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 8px', minWidth: 40 }}>
          <span style={{ display: 'block', fontSize: 18, fontWeight: 900, color: total === 0 ? '#94a3b8' : '#0f172a', lineHeight: 1 }}>{total}</span>
          <span style={{ display: 'block', fontSize: 9, color: '#94a3b8', fontWeight: 700, marginTop: 1 }}>إجمالي</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 8, background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
        {[{ count: yellow, dot: '#fde047', label: 'زيارة أولى' }, { count: green, dot: '#4ade80', label: 'متابعة' }, { count: blue, dot: '#60a5fa', label: 'متعاقد' }].map((item, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6px 4px', gap: 3, borderLeft: i > 0 ? '1px solid #e2e8f0' : 'none', opacity: total === 0 ? 0.4 : 1 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.dot, border: `1.5px solid ${item.dot}` }} />
            <span style={{ fontSize: 16, fontWeight: 900, color: total === 0 ? '#94a3b8' : '#0f172a', lineHeight: 1 }}>{item.count}</span>
            <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textAlign: 'center' }}>{item.label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', height: 5, borderRadius: 100, overflow: 'hidden', background: '#f1f5f9', gap: 1 }}>
        {total === 0 ? <div style={{ width: '100%', background: '#f1f5f9' }} /> : <>
          {yellow > 0 && <div style={{ width: `${(yellow/total)*100}%`, background: 'linear-gradient(90deg,#fde047,#facc15)', borderRadius: 100 }} />}
          {green  > 0 && <div style={{ width: `${(green /total)*100}%`, background: 'linear-gradient(90deg,#4ade80,#22c55e)', borderRadius: 100 }} />}
          {blue   > 0 && <div style={{ width: `${(blue  /total)*100}%`, background: 'linear-gradient(90deg,#60a5fa,#3b82f6)', borderRadius: 100 }} />}
        </>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// 📋 نافذة الحجز/التعديل/إعادة الجدولة
// ══════════════════════════════════════════════════════
function AppointmentManagerDialog({ 
  isOpen, onClose, onSaveSuccess, mode, initialData, clients, 
  firestore, currentUser, canBypassTime, rawAppointments, slotDur, dialogData 
}: any) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const isCreating = mode === 'create';
  const isEditing = mode === 'edit';
  const isRescheduling = mode === 'reschedule';
  
  const originalApptDate = initialData?.appointmentDate ? toFirestoreDate(initialData.appointmentDate) : null;
  
  const [selectedDate, setSelectedDate] = useState<Date>(originalApptDate || new Date());
  const [selectedTime, setSelectedTime] = useState(originalApptDate ? format(originalApptDate, 'HH:mm') : '10:00');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [title, setTitle] = useState(initialData?.title || '');
  const [isNewClient, setIsNewClient] = useState(!initialData?.clientId);
  const [newName, setNewName] = useState(initialData?.clientName || '');
  const [newMobile, setNewMobile] = useState(initialData?.clientMobile || '');
  const [newCity, setNewCity] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(initialData?.clientId || '');

  const tenantId = currentUser?.currentCompanyId;
  const engineerId = isCreating ? dialogData?.engineerId : initialData?.engineerId;

  const finalAppointmentDateTime = useMemo(() => {
    let dateTime: Date | null = null;
    if (isCreating) {
      dateTime = dialogData?.appointmentDate ? toFirestoreDate(dialogData.appointmentDate) : null;
    } else if (isEditing || isRescheduling) {
      const [hh, mm] = selectedTime.split(':').map(Number);
      const combinedDate = setHours(setMinutes(selectedDate, mm), hh);
      if (isValid(combinedDate)) {
        dateTime = combinedDate;
      }
    }
    return dateTime;
  }, [isCreating, dialogData?.appointmentDate, isEditing, isRescheduling, selectedDate, selectedTime]);

  useEffect(() => { 
    if (isOpen) { 
      if (isCreating) {
        setSelectedDate(dialogData?.appointmentDate ? toFirestoreDate(dialogData.appointmentDate) : new Date());
        setSelectedTime(dialogData?.appointmentDate ? format(toFirestoreDate(dialogData.appointmentDate), 'HH:mm') : '10:00');
        setTitle('');
        setIsNewClient(true); 
        setNewName(''); setNewMobile(''); setNewCity('');
        setSelectedClientId('');
      } else if (isRescheduling) {
        setSelectedDate(originalApptDate || new Date());
        setSelectedTime(originalApptDate ? format(originalApptDate, 'HH:mm') : '10:00');
        setTitle(initialData?.title || '');
        setIsNewClient(false);
        setSelectedClientId(initialData?.clientId || '');
        setNewName(''); setNewMobile(''); setNewCity('');
      } else if (isEditing) {
          setSelectedDate(originalApptDate || new Date());
          setSelectedTime(originalApptDate ? format(originalApptDate, 'HH:mm') : '10:00');
          setTitle(initialData?.title || '');
          setIsNewClient(!initialData?.clientId);
          setSelectedClientId(initialData?.clientId || '');
          setNewName(initialData?.clientName || ''); 
          setNewMobile(initialData?.clientMobile || '');
          setNewCity((initialData as any)?.clientArea || '');
      }
    } 
  }, [isOpen, isCreating, isRescheduling, isEditing, dialogData?.appointmentDate, originalApptDate, initialData]);

  const filteredClients = useMemo(() => {
    if (!engineerId) return clients;
    // Show all clients if status is prospective, otherwise filter by assigned engineer
    return clients.filter(c => {
        if (c.status === 'prospective') return true;
        const ae = (c as any).assignedEngineer;
        return !ae || ae === engineerId;
    });
  }, [clients, engineerId]);

  const clientOptions = useMemo(() => filteredClients.map((c: Client) => ({ value: c.id!, label: `${c.nameAr} (${c.fileNumber || 'جديد'})` })), [filteredClients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !tenantId || !currentUser) return;
    setIsSaving(true);
    let newClientId: string | null = null;

    try {
      let finalClientId: string | null = selectedClientId;
      let finalClientName: string | undefined = isNewClient ? newName : clients.find(c => c.id === selectedClientId)?.nameAr;
      let finalClientMobile: string | undefined = isNewClient ? newMobile : clients.find(c => c.id === selectedClientId)?.mobile;

      if (isNewClient && isCreating) {
        if (!newName || !newMobile) {
          toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى إدخال اسم وجوال العميل الجديد.' });
          setIsSaving(false);
          return;
        }

        await runTransaction(firestore, async (transaction) => {
          const counterRef = doc(firestore, getTenantPath('counters/clientFiles', tenantId));
          const counterDoc = await transaction.get(counterRef);
          const currentYear = new Date().getFullYear().toString();
          const counts = counterDoc.exists() ? counterDoc.data()?.counts || {} : {};
          const nextFileNumber = (counts[currentYear] || 0) + 1;
          transaction.set(counterRef, { counts: { ...counts, [currentYear]: nextFileNumber } }, { merge: true });
          const newFileNumberFormatted = `${nextFileNumber}/${currentYear}`;

          const newClientRef = doc(collection(firestore, getTenantPath('clients', tenantId)));
          transaction.set(newClientRef, {
            nameAr: newName,
            mobile: newMobile,
            address: { city: newCity }, // Storing city in a structured address object
            assignedEngineer: engineerId,
            status: 'prospective',
            fileNumber: newFileNumberFormatted,
            createdAt: serverTimestamp(),
            createdBy: currentUser.id,
            companyId: tenantId,
            source: 'appointment',
            isActive: true, // Remains true, status field differentiates
          });
          newClientId = newClientRef.id;

          // Add audit log for client creation
          const auditLogRef = doc(collection(newClientRef, 'auditLogs'));
          transaction.set(auditLogRef, {
              action: 'created',
              details: `تم إنشاء الملف كعميل محتمل من شاشة المواعيد.`,
              userName: currentUser.fullName,
              userId: currentUser.id,
              createdAt: serverTimestamp(),
          });
        });

        finalClientId = newClientId;
        finalClientName = newName;
        finalClientMobile = newMobile;

      } else if (isNewClient && isEditing) {
        // This case should ideally not happen if we disable the form correctly, but as a fallback
        finalClientName = newName;
        finalClientMobile = newMobile;
        finalClientId = null;
      } else {
        if (!selectedClientId) {
          toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى اختيار عميل مسجل.' });
          setIsSaving(false);
          return;
        }
        finalClientId = selectedClientId;
      }

      const [hh, mm] = selectedTime.split(':').map(Number);
      const appointmentDate = setHours(setMinutes(selectedDate, mm), hh);

      const baseData: Partial<Appointment> = {
        type: 'architectural',
        engineerId,
        engineerName: isCreating ? dialogData?.engineerName : initialData?.engineerName,
        clientId: finalClientId,
        clientName: finalClientName,
        clientMobile: finalClientMobile,
        title,
        appointmentDate: Timestamp.fromDate(appointmentDate),
        status: 'scheduled', 
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.id,
        companyId: tenantId,
      };

      const p = getTenantPath('appointments', tenantId)!;

      if (isCreating) {
        const newRef = doc(collection(firestore, p));
        baseData.createdAt = serverTimestamp();
        baseData.createdBy = currentUser.id;
        baseData.visitCount = 1;
        baseData.color = getVisitColor({ visitCount: 1 });

        await setDoc(newRef, baseData);
        await addDoc(collection(newRef, 'auditLogs'), {
          action: 'created', details: `أنشأه ${currentUser.fullName}`,
          userName: currentUser.fullName, createdAt: serverTimestamp(), companyId: tenantId
        });
      } else if (isEditing) {
        const ref = doc(firestore, p, initialData.id!);
        await updateDoc(ref, baseData);
        await addDoc(collection(ref, 'auditLogs'), {
            action: 'updated', details: `حدّثه ${currentUser.fullName}`,
            userName: currentUser.fullName, createdAt: serverTimestamp(), companyId: tenantId
        });
      } else if (isRescheduling) {
        const ref = doc(firestore, p, initialData.id!);
        await updateDoc(ref, {
          appointmentDate: Timestamp.fromDate(appointmentDate),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.id,
        });
        await addDoc(collection(ref, 'auditLogs'), {
          action: 'rescheduled', details: `أُعيد جدولته إلى ${format(appointmentDate, 'PPP HH:mm', { locale: ar })} بواسطة ${currentUser.fullName}`,
          userName: currentUser.fullName, createdAt: serverTimestamp(), companyId: tenantId
        });
      }

      if (finalClientId || finalClientMobile) await reconcileClientAppointments(firestore, tenantId, { clientId: finalClientId, clientMobile: finalClientMobile });
      toast({ title: '✅ تمت العملية بنجاح' });
      onSaveSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Save Error:', error);
      toast({ variant: 'destructive', title: 'خطأ', description: error.message || 'حدث خطأ غير متوقع' });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={o => { if (!o && !isSaving) onClose(); }}>
      <DialogContent style={{ maxWidth: 480 }}>
        <DialogHeader>
          <DialogTitle>{isCreating ? 'حجز موعد جديد' : isRescheduling ? 'إعادة جدولة الموعد' : 'تعديل الموعد'}</DialogTitle>
          <DialogDescription className="font-bold text-indigo-700">
             {isCreating ? dialogData?.engineerName : initialData?.engineerName} 
             • 
             {isNewClient ? newName : clients.find(c => c.id === selectedClientId)?.nameAr || initialData?.clientName || ''}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          {(isEditing || isRescheduling) && (
            <div>
              <Label>التاريخ والوقت *</Label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}> 
                  <PopoverTrigger asChild>
                    <Button variant="outline" style={{ flex: 1, justifyContent: 'flex-start', height: '38px', fontSize: '13px' }}>
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {format(selectedDate, 'PPP', { locale: ar })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" style={{ width: 'auto', padding: 0 }}>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      locale={ar}
                      onSelect={d => { if (d) setSelectedDate(d); setIsCalendarOpen(false); }}
                      className="rounded-lg border shadow-sm"
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  value={selectedTime}
                  onChange={e => setSelectedTime(e.target.value)}
                  style={{ width: 110 }} 
                  disabled={isSaving}
                />
              </div>
            </div>
          )}

          <div>
            <Label>الغرض من الزيارة *</Label>
            <Input
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="مثال: مناقشة المخططات..."
              className="h-10 rounded-xl border-2 mt-1"
              disabled={isSaving || isRescheduling}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Checkbox
              id="newClientCheckbox"
              checked={isNewClient}
              onCheckedChange={c => { setIsNewClient(!!c); if(!!c) setSelectedClientId(''); }}
              disabled={isSaving || isRescheduling}
            />
            <Label htmlFor="newClientCheckbox" style={{ cursor: 'pointer' }}>عميل جديد (زيارة أولى)</Label>
          </div>
          
          {isNewClient ? (
            <div className="space-y-2">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><Label>الاسم *</Label><Input value={newName} onChange={e => setNewName(e.target.value)} required disabled={isSaving || isRescheduling} className="h-9 rounded-xl mt-1" /></div>
                  <div><Label>الجوال *</Label><Input value={newMobile} onChange={e => setNewMobile(e.target.value)} required disabled={isSaving || isRescheduling} className="h-9 rounded-xl mt-1" /></div>
              </div>
              <div>
                  <Label>المدينة</Label>
                  <Input value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="اختياري" disabled={isSaving || isRescheduling} className="h-9 rounded-xl mt-1" />
              </div>
            </div>
          ) : (
            <div>
              <Label>العميل المسجل</Label>
              <div className="mt-1">
                <InlineSearchList
                  value={selectedClientId}
                  onSelect={setSelectedClientId}
                  options={clientOptions}
                  placeholder={filteredClients.length === 0 ? 'لا يوجد عملاء مخصصون...' : 'ابحث عن عميل...'}
                  disabled={isSaving || isRescheduling || filteredClients.length === 0}
                  className="h-9"
                />
              </div>
              {filteredClients.length === 0 && !isNewClient && (
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>💡 هذا المهندس يرى فقط عملاءه المعيَّنين.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              {isCreating ? 'حجز الموعد' : isRescheduling ? 'إعادة جدولة' : 'حفظ التعديلات'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════
// 🏠 المكوّن الرئيسي — ArchitecturalAppointmentsView
// ═════════════════════════════════════════════════════
export function ArchitecturalAppointmentsView() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { branding, loading: brandingLoading } = useBranding();

  const [date, setDate] = useState<Date | undefined>(undefined);
  const [rawAppointments, setRawAppointments] = useState<Appointment[]>([]);
  const [engineers, setEngineers] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<any | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [appointmentToDelete, setAppointmentToDelete] = useState<ApptWithMeta | null>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<ApptWithMeta | null>(null);

  const tenantId = currentUser?.currentCompanyId;
  const canBypassTime = useMemo(() => ['Admin', 'Developer'].includes(currentUser?.role || ''), [currentUser?.role]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }));
  useEffect(() => { if (!date) setDate(new Date()); }, [date]);

  const { morningSlots, eveningSlots, isRamadan, slotDur } = useMemo(() => {
    const fb = { morningSlots: [] as string[], eveningSlots: [] as string[], isRamadan: false, slotDur: 45 };
    if (!date) return fb;
    const ram = branding?.work_hours?.ramadan;
    const inRam = ram?.is_enabled && date >= toFirestoreDate(ram.start_date)! && date <= toFirestoreDate(ram.end_date)!;
    if (inRam) { const d = ram.appointment_slot_duration || 30; return { morningSlots: generateTimeSlots(ram.start_time || '09:00', ram.end_time || '15:00', d, ram.appointment_buffer_time || 0), eveningSlots: [], isRamadan: true, slotDur: d }; }
    const wh = branding?.work_hours?.architectural;
    if (!wh) return fb;
    const d = wh.appointment_slot_duration || 45, buf = wh.appointment_buffer_time || 0;
    const today = weekDays[date.getDay()].id;
    if (branding?.work_hours?.holidays?.includes(today)) return { ...fb, slotDur: d };
    const half = branding?.work_hours?.half_day, isHalf = half?.day === today;
    let { morning_start_time: ms, morning_end_time: me, evening_start_time: es, evening_end_time: ee } = wh;
    if (isHalf) { if (half.type === 'morning_only') { es = ''; ee = ''; } else if (half.type === 'custom_end_time' && half.end_time) { if (half.end_time <= me) { me = half.end_time; es = ''; ee = ''; } else { ee = half.end_time < ee ? half.end_time : ee; } } }
    return { morningSlots: generateTimeSlots(ms, me, d, buf), eveningSlots: generateTimeSlots(es, ee, d, buf), isRamadan: false, slotDur: d };
  }, [branding, date]);

  const fetchAppointments = useCallback(async (d: Date) => { if (!firestore || !tenantId) return; setLoading(true); try { const p = getTenantPath('appointments', tenantId); const snap = await getDocs(query(collection(firestore, p!), where('appointmentDate', '>=', startOfDay(d)), where('appointmentDate', '<=', endOfDay(d)))); setRawAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)).filter(a => a.type === 'architectural')); } finally { setLoading(false); } }, [firestore, tenantId]);
  useEffect(() => { if (!firestore || !tenantId) return; getDocs(query(collection(firestore, getTenantPath('employees', tenantId)!), where('status', 'in', ['active', 'on-leave']))).then(snap => { setEngineers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)).filter(e => e.department?.includes('المعماري')).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'))); }); getDocs(query(collection(firestore, getTenantPath('clients', tenantId)!))).then(snap => { setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)).sort((a, b) => String(b.fileNumber || '').localeCompare(String(a.fileNumber || ''), undefined, { numeric: true }))); }); getDocs(query(collection(firestore, getTenantPath('leaveRequests', tenantId)!), where('status', 'in', ['approved', 'on-leave', 'returned']))).then(snap => { setLeaveRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest))); }); }, [firestore, tenantId]);
  useEffect(() => { if (date) fetchAppointments(date); }, [date, fetchAppointments]);

  const clientsMap = useMemo(() => { const map = new Map<string, Client>(); clients.forEach(c => map.set(c.id, c)); return map; }, [clients]);
  const appointments = useMemo<ApptWithMeta[]>(() => rawAppointments.filter(a => a.status !== 'cancelled').map(appt => { const client = clientsMap.get(appt.clientId || ''); return { ...appt, clientName: appt.clientId ? (client?.nameAr || appt.clientName) : appt.clientName, clientArea: (client as any)?.address?.area || null, bookedByName: (appt as any).createdByName || null }; }), [rawAppointments, clientsMap]);
  const stats = useMemo(() => ({ total: appointments.length, yellow: appointments.filter(a => a.color === '#facc15').length, green: appointments.filter(a => a.color === '#22c55e').length, blue: appointments.filter(a => a.color === '#3b82f6').length }), [appointments]);
  const engApptMap = useMemo(() => { const m: Record<string, ApptWithMeta[]> = {}; engineers.forEach(e => { m[e.id!] = []; }); appointments.forEach(a => { if (m[a.engineerId]) m[a.engineerId].push(a); }); return m; }, [appointments, engineers]);
  const grid = useMemo(() => { const g: Record<string, Record<string, ApptWithMeta | null>> = {}; engineers.forEach(e => { g[e.id!] = {}; [...morningSlots, ...eveningSlots].forEach(s => (g[e.id!][s] = null)); }); appointments.forEach(a => { const d = toFirestoreDate(a.appointmentDate); if (!d) return; const t = format(d, 'HH:mm'); if (g[a.engineerId] && t in g[a.engineerId]) g[a.engineerId][t] = a; }); return g; }, [appointments, engineers, morningSlots, eveningSlots]);
  const getLeave = useCallback((empId: string, d: Date) => leaveRequests.find(r => { if (r.employeeId !== empId) return false; const s = toFirestoreDate(r.startDate), e = toFirestoreDate(r.endDate); if (!s || !e) return false; return isWithinInterval(startOfDay(d), { start: startOfDay(s), end: endOfDay(e) }); }), [leaveRequests]);

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
    if (dragged.clientId) { const cs = await getDoc(doc(firestore, getTenantPath(`clients/${dragged.clientId}`, tenantId)!)); if (cs.exists() && (cs.data() as any)?.assignedEngineer && (cs.data() as any).assignedEngineer !== targetEngId) { toast({ variant: 'destructive', title: '🚫 ملكية حصرية', description: 'عذراً، هذا المهندس ليس هو المسؤول عن هذا العميل.' }); return; } }
    if (rawAppointments.some(a => a.id !== apptId && a.engineerId === targetEngId && format(toFirestoreDate(a.appointmentDate)!, 'HH:mm') === targetTime && a.status !== 'cancelled')) { toast({ variant: 'destructive', title: '📅 تعارض', description: 'هذا المهندس لديه موعد آخر في هذا الوقت.' }); return; }
    if (dragged.clientId) { const c = checkClientTimeConflict(rawAppointments, dragged.clientId, newDT, slotDur, apptId); if (c) { toast({ variant: 'destructive', title: '⏰ العميل مشغول', description: `لديه موعد الساعة ${format(toFirestoreDate(c.appointmentDate)!, 'HH:mm')}.` }); return; } }
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

  const renderPeriod = (title: string, emoji: string, slots: string[]) => {
    if (!slots.length) return null;
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, marginTop: 4 }}><span style={{ fontSize: 13, fontWeight: 800, color: '#475569' }}>{emoji} {title}</span><div style={{ flex: 1, height: 1, background: '#e2e8f0' }} /></div>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead><tr>
              <th style={{ background: '#f8fafc', padding: '10px 14px', fontSize: 10, fontWeight: 800, color: '#94a3b8', textAlign: 'right', borderBottom: '2px solid #e2e8f0', borderLeft: '1px solid #f1f5f9', width: 150, minWidth: 150 }}>المهندس المختص</th>
              {slots.map(t => (<th key={t} style={{ background: '#f8fafc', padding: '9px 6px', fontSize: 11, fontWeight: 800, color: '#64748b', textAlign: 'center', borderBottom: '2px solid #e2e8f0', borderLeft: '1px solid #f1f5f9', minWidth: 90 }}>{t}<div style={{ fontSize: 9, color: '#b0bec5', marginTop: 1 }}>{slotDur} د</div></th>))}
            </tr></thead>
            <tbody>
              {engineers.map(eng => {
                const onLeave = !!(date && getLeave(eng.id!, date));
                const engColor = ENG_COLORS[eng.fullName?.charCodeAt(0) % ENG_COLORS.length || 0];
                return (
                  <tr key={eng.id}>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f8fafc', borderLeft: '1px solid #f1f5f9', background: '#fafafa', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: onLeave ? '#94a3b8' : `linear-gradient(135deg,${engColor},${engColor}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: 'white', flexShrink: 0 }}>{eng.fullName?.charAt(0)}</div>
                        <div><div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{eng.fullName}</div><div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{onLeave ? '⚠️ في إجازة' : `${engApptMap[eng.id!]?.length || 0} مواعيد`}</div></div>
                      </div>
                    </td>
                    {slots.map(time => {
                      const booking = grid[eng.id!]?.[time];
                      return (
                        // ✅ تم زيادة الارتفاع ليناسب الخط الأكبر
                        <td key={time} style={{ 
                          padding: 0, 
                          borderBottom: '1px solid #cbd5e1',
                          borderLeft: '1px solid #cbd5e1',
                          verticalAlign: 'top', 
                          height: 90,
                          overflow: 'visible', 
                          position: 'relative' 
                        }}>
                          <DroppableSlot id={`slot|${eng.id}|${time}`} isEngineerOnLeave={onLeave} onClick={() => { if (onLeave || booking) return; const [hh, mm] = time.split(':').map(Number); const apptDate = setHours(setMinutes(date!, mm), hh); if (isPast(apptDate) && !canBypassTime) return toast({ title: 'عائق زمني', description: 'لا يمكن الحجز في الماضي.' }); setDialogData({ mode: 'create', engineerId: eng.id, engineerName: eng.fullName, appointmentDate: apptDate }); setIsDialogOpen(true); }}>
                            {onLeave ? (<div style={{ fontSize: 10, color: '#dc2626', padding: '4px 6px', textAlign: 'center', width: '100%' }}>في إجازة رسمية</div>) : booking ? (<AppointmentCard appointment={booking} onOpenDetails={a => router.push(`/dashboard/appointments/${a.id}`)} onOpenEdit={(a, mode) => { setDialogData({ mode, ...a, engineerName: eng.fullName }); setIsDialogOpen(true); }} onDelete={a => setAppointmentToDelete(a)} onCancel={a => setAppointmentToCancel(a)} />) : null}
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => setActiveDragId(e.active.id as string)} onDragEnd={handleDragEnd}>
      {/* ✅ إصلاح الطباعة وعدم قطع الشاشة */}
      <style>{`
        @media print {
          aside, nav, header, [data-sidebar], [data-header],
          .sidebar, .navbar, .topbar, .no-print, button {
            display: none !important; 
          }
          body, main, div, section {
            overflow: visible !important;
            height: auto !important;
            position: static !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          table { 
            border-collapse: collapse !important; 
            width: 100% !important; 
          }
          td, th { 
            border: 1px solid #bbb !important; 
            padding: 4px !important; 
          }
          @page {
            size: A4 landscape;
            margin: 5mm;
          }
          #print-header { 
            display: block !important; 
          }
        }
        #print-header { display: none; }
        
        ::view-transition-group(*),
        ::view-transition-old(*),
        ::view-transition-new(*) {
          animation-duration: 0.25s;
          animation-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
        }
      `}</style>

      <div id="print-header" style={{ padding: '0 16px 12px', borderBottom: '2px solid #e2e8f0', marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
          جدول المواعيد المعمارية — {date ? format(date, 'PPP', { locale: ar }) : ''}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          إجمالي المواعيد: {stats.total} | زيارة أولى: {stats.yellow} | متابعة: {stats.green} | متعاقد: {stats.blue}
        </div>
      </div>

      <div id="appointments-print-root" style={{ padding: 16, background: '#f1f5f9', minHeight: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📅</div>
            <div><div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{stats.total}</div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>مواعيد اليوم</div></div>
            {stats.total > 0 && (<div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}><div style={{ width: `${Math.max(8,(stats.yellow/stats.total)*40)}px`, height: 4, borderRadius: 100, background: 'linear-gradient(90deg,#fde047,#facc15)' }} /><div style={{ width: `${Math.max(8,(stats.green /stats.total)*40)}px`, height: 4, borderRadius: 100, background: 'linear-gradient(90deg,#4ade80,#22c55e)' }} /><div style={{ width: `${Math.max(8,(stats.blue/stats.total)*40)}px`, height: 4, borderRadius: 100, background: 'linear-gradient(90deg,#60a5fa,#3b82f6)' }} /></div>)}
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🟡</div>
            <div><div style={{ fontSize: 20, fontWeight: 900, color: '#ca8a04', lineHeight: 1 }}>{stats.yellow}</div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>زيارة أولى</div></div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🟢</div>
            <div><div style={{ fontSize: 20, fontWeight: 900, color: '#16a34a', lineHeight: 1 }}>{stats.green}</div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>متابعة</div></div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔵</div>
            <div><div style={{ fontSize: 20, fontWeight: 900, color: '#2563eb', lineHeight: 1 }}>{stats.blue}</div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>متعاقد</div></div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '14px 20px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#e87c24,#f59e0b)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📅</div>
            <div><div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a' }}>جدول المواعيد المعمارية</div><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginTop: 1 }}><MousePointer2 style={{ width: 10, height: 10, display: 'inline', marginLeft: 4 }} /> السحب والإفلات نشط · القواعد الثلاث مفعّلة</div></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', color: '#16a34a', padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800 }}>🛡️ حماية تعارض القاعات</div>
            
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="no-print"
              style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a', fontWeight: 800, fontSize: 12 }}
            >
              <i style={{ marginLeft: 6, fontSize: 15 }}>🖨️</i>
              طباعة الجدول
            </Button>
            
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild><Button variant="outline" className="no-print" style={{ background: '#fff7ed', borderColor: '#fed7aa', color: '#ea580c', fontWeight: 800, fontSize: 12 }}><CalendarIcon className="ml-2 w-4 h-4" />{date ? format(date, 'PPP', { locale: ar }) : 'اختر تاريخ'}</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0" style={{ width: 'auto', padding: 0 }}>
                <Calendar 
                  mode="single" 
                  selected={date} 
                  locale={ar} 
                  initialFocus 
                  onSelect={d => { if (d) setDate(d); setIsCalendarOpen(false); }} 
                  className="rounded-lg border shadow-sm"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {engineers.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(engineers.length, 4)}, 1fr)`, gap: 10, marginBottom: 14 }}>
            {engineers.map(eng => (<EngineerStatCard key={eng.id} engineer={eng} appointments={engApptMap[eng.id!] || []} isOnLeave={!!(date && getLeave(eng.id!, date))} />))}
          </div>
        )}

        {isRamadan ? renderPeriod('دوام رمضان', '🌙', morningSlots) : <>{renderPeriod('الفترة الصباحية', '☀️', morningSlots)}{renderPeriod('الفترة المسائية', '🌆', eveningSlots)}</>}
      </div>

      {isDialogOpen && dialogData && (
        <AppointmentManagerDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} onSaveSuccess={() => date && fetchAppointments(date)} mode={dialogData.mode} initialData={dialogData} clients={clients} firestore={firestore} currentUser={currentUser} canBypassTime={canBypassTime} rawAppointments={rawAppointments} slotDur={slotDur} dialogData={dialogData} />
      )}

      <AlertDialog open={!!appointmentToCancel} onOpenChange={() => setAppointmentToCancel(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>إلغاء الموعد؟</AlertDialogTitle><AlertDialogDescription>سيتم تحديد الموعد كملغى، ولن يتم احتسابه ضمن عدد زيارات العميل.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>تراجع</AlertDialogCancel><AlertDialogAction onClick={handleCancel}>نعم، إلغاء</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!appointmentToDelete} onOpenChange={() => setAppointmentToDelete(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>حذف الموعد نهائياً؟</AlertDialogTitle><AlertDialogDescription>سيتم مسح الموعد تماماً من السجلات. هذا الإجراء لا يمكن التراجع عنه.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>تراجع</AlertDialogCancel><AlertDialogAction onClick={handleHardDelete}>نعم، حذف نهائي</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <DragOverlay dropAnimation={defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.8', cursor: 'grabbing', zIndex: 9999 } } })} style={{ pointerEvents: 'none' }}>
        {activeDragId && (() => {
          const a = rawAppointments.find(x => x.id === activeDragId);
          const client = clients.find(c => c.id === a?.clientId);
          const { bg, border } = cardGradient(a?.color);
          return (<div style={{ background: bg, border, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', cursor: 'grabbing' }}><div style={{ color: '#1e293b' }}>{a?.clientId ? (client?.nameAr || a?.clientName) : a?.clientName}</div>{client && (client as any).address?.area && (<div style={{ fontSize: 10, color: '#0d9488', marginTop: 2 }}>📍 {(client as any).address.area}</div>)}</div>);
        })()}
      </DragOverlay>
    </DndContext>
  );
}
