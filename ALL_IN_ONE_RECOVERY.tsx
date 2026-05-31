// -----------------------------------------------------------------------------
// 
// هذا الملف هو ملف استعادة شامل وموحد.
// يحتوي على الشيفرات المصدرية الكاملة لكل المكونات والصفحات التي قمنا بتطويرها.
// يمكنك نسخ كل قسم ولصقه في المسار الصحيح المشار إليه لاستعادة النظام بالكامل.
// 
// -----------------------------------------------------------------------------

// =============================================================================
// القسم الأول: استعادة الهيكل الأساسي للتخطيط (Core Layout Restoration)
// المسار الأصلي: src/app/dashboard/layout.tsx
// =============================================================================
'use client';

import React from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

// Make sure to rename this function to DashboardLayout and export it as default
// when you place it in src/app/dashboard/layout.tsx
export function RecoveredDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  
  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    router.replace('/');
    return null;
  }

  return (
    <div className="relative min-h-screen">
      <SidebarProvider>
          <Sidebar side={'left'} className="no-print">
            <MainNav />
          </Sidebar>
          <SidebarInset className="flex flex-col h-screen">
            <Header onLogout={logout} className="no-print" />
            <main className="flex-1 overflow-y-auto p-4">
              {children}
            </main>
          </SidebarInset>
      </SidebarProvider>
    </div>
  );
}


// =============================================================================
// القسم الثاني: واجهة عرض المواعيد المعمارية (Architectural Appointments View)
// المسار الأصلي: src/components/appointments/architectural-appointments-view.tsx
// =============================================================================
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, User, Phone, MapPin } from 'lucide-react';

interface RecoveredAppointment {
  id: string;
  clientName: string;
  clientPhone: string;
  date: Date;
  status: 'confirmed' | 'pending' | 'cancelled';
  assignedEngineer: {
    name: string;
    avatarUrl?: string;
  };
  location: string;
}

const recoveredStatusStyles: Record<RecoveredAppointment['status'], string> = {
  confirmed: 'bg-green-100 text-green-800 border-green-300',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

// Make sure to rename this function to ArchitecturalAppointmentsView
// when you place it in src/components/appointments/architectural-appointments-view.tsx
export function RecoveredArchitecturalAppointmentsView({ appointments }: { appointments: RecoveredAppointment[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
      {appointments.map((appt) => (
        <Card key={appt.id} className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-slate-50 p-4 border-b">
            <CardTitle className="text-sm font-medium">{appt.clientName}</CardTitle>
            <Badge className={recoveredStatusStyles[appt.status]}>{appt.status}</Badge>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4 space-x-reverse text-sm text-muted-foreground mb-4">
                <Clock className="h-4 w-4" />
                <span>{new Date(appt.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' })}</span>
            </div>
            <div className="flex items-center space-x-4 space-x-reverse text-sm text-muted-foreground mb-4">
                <Phone className="h-4 w-4" />
                <span>{appt.clientPhone}</span>
            </div>
             <div className="flex items-center space-x-4 space-x-reverse text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{appt.location}</span>
            </div>
            <div className="border-t my-4"></div>
            <div className="flex items-center space-x-3 space-x-reverse">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={appt.assignedEngineer.avatarUrl} alt={appt.assignedEngineer.name} />
                    <AvatarFallback>{appt.assignedEngineer.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-sm font-medium leading-none">المهندس المسؤول</p>
                    <p className="text-sm text-muted-foreground">{appt.assignedEngineer.name}</p>
                </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// =============================================================================
// القسم الثالث: منطق حجز المواعيد الذكي (Intelligent Appointment Booking Logic)
// المسار الأصلي: src/app/dashboard/appointments/new/page.tsx
// =============================================================================
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { DateInput } from '@/components/ui/date-input';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const recoveredAppointmentSchema = z.object({
  clientId: z.string().min(1, "يجب اختيار العميل"),
  engineerId: z.string().min(1, "يجب اختيار المهندس"),
  date: z.date({ required_error: "يجب تحديد تاريخ ووقت الموعد" }),
  location: z.string().min(1, "يجب إدخال موقع الموعد"),
  purpose: z.string().optional(),
});

// Make sure to rename this function to NewAppointmentPage and export it as default
// when you place it in src/app/dashboard/appointments/new/page.tsx
export default function RecoveredNewAppointmentPage() {
  const [isSaving, setIsSaving] = useState(false);
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const tenantId = user?.currentCompanyId;

  const { data: clients = [], loading: clientsLoading } = useSubscription<any>(
    firestore,
    useMemo(() => (tenantId ? `companies/${tenantId}/clients` : null), [tenantId])
  );

  const { data: users = [], loading: usersLoading } = useSubscription<any>(
    firestore,
    useMemo(() => (tenantId ? `companies/${tenantId}/users` : null), [tenantId])
  );

  const form = useForm<z.infer<typeof recoveredAppointmentSchema>>({
    resolver: zodResolver(recoveredAppointmentSchema),
  });

  const selectedClientId = form.watch('clientId');
  const selectedClient = useMemo(() => clients.find(c => c.id === selectedClientId), [clients, selectedClientId]);

  const engineerOptions = useMemo(() => {
    const engineers = users.filter(u => u.role === 'Engineer' || u.role === 'Admin');
    if (selectedClient && selectedClient.assignedEngineer) {
        return engineers
            .filter(e => e.id === selectedClient.assignedEngineer)
            .map(e => ({ value: e.id, label: e.fullName }));
    }
    return engineers.map(e => ({ value: e.id, label: e.fullName }));
  }, [users, selectedClient]);

  async function onSubmit(values: z.infer<typeof recoveredAppointmentSchema>) {
    if (!firestore || !tenantId) return;
    setIsSaving(true);

    try {
        const q = query(
            collection(firestore, `companies/${tenantId}/appointments`),
            where('clientId', '==', values.clientId),
            where('date', '==', values.date)
        );
        const conflictingAppointments = await getDocs(q);

        if (!conflictingAppointments.empty) {
            toast({ variant: 'destructive', title: 'خطأ في الحجز', description: 'هذا العميل لديه بالفعل موعد آخر في نفس الوقت المحدد.' });
            setIsSaving(false);
            return;
        }

        await addDoc(collection(firestore, `companies/${tenantId}/appointments`), {
            ...values,
            status: 'pending',
            createdAt: serverTimestamp(),
            createdBy: user?.uid,
        });

        toast({ title: '✅ تم إنشاء الموعد بنجاح' });
        router.push('/dashboard/appointments');
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشلت عملية إنشاء الموعد.' });
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>حجز موعد جديد</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>العميل</FormLabel>
                  <FormControl>
                    <Combobox
                      options={clients.map(c => ({ value: c.id, label: `${c.fileId} - ${c.nameAr}` }))}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="ابحث عن عميل..."
                      loading={clientsLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="engineerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>المهندس المسؤول</FormLabel>
                   <FormControl>
                    <Combobox
                      options={engineerOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="اختر المهندس..."
                      loading={usersLoading}
                      disabled={!selectedClientId || (selectedClient && selectedClient.assignedEngineer)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تاريخ ووقت الموعد</FormLabel>
                  <FormControl><DateInput value={field.value} onChange={field.onChange} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الموقع</FormLabel>
                  <FormControl><Input {...field} placeholder="مثال: مكتب الشركة" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />} حفظ الموعد
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// القسم الرابع: محرك الإنتاجية والمشاركة (Universal Action Trigger)
// المسار الأصلي: src/components/productivity/universal-action-trigger.tsx
// =============================================================================
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Share2, Repeat, CalendarPlus, UserPlus } from 'lucide-react';

interface UniversalActionTriggerProps {
  entityId: string;
  entityType: 'appointment' | 'task' | 'project';
  defaultAction?: 'share';
}

// Make sure to rename this function to UniversalActionTrigger
// when you place it in src/components/productivity/universal-action-trigger.tsx
export function RecoveredUniversalActionTrigger({ entityId, entityType, defaultAction }: UniversalActionTriggerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { user } = useAuth();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const tenantId = user?.currentCompanyId;
  const { data: users = [] } = useSubscription<any>(
    firestore,
    useMemo(() => (tenantId ? `companies/${tenantId}/users` : null), [tenantId])
  );

  const userSuggestions = useMemo(() => {
    return users.map(u => ({ id: u.uid, value: u.fullName || u.email, image: u.avatarUrl }));
  }, [users]);

  const handleShare = async () => {
    if (!message || !user || !tenantId || !firestore) return;
    setIsSaving(true);
    try {
        const mentions = message.match(/@\[(.*?)\]\((.*?)\)/g)?.map(m => m.match(/\[(.*?)\]\((.*?)\)/)?.[2]) || [];

        await addDoc(collection(firestore, `companies/${tenantId}/notifications`), {
            senderId: user.uid,
            recipientIds: mentions,
            entityId,
            entityType,
            message,
            createdAt: serverTimestamp(),
            read: false,
        });

        toast({ title: "✅ تمت المشاركة بنجاح!", description: "تم إرسال إشعار إلى الزملاء المذكورين." });
        setIsModalOpen(false);
        setMessage('');
    } catch (error) {
        console.error("Error sharing entity:", error);
        toast({ variant: 'destructive', title: "حدث خطأ", description: "فشلت عملية المشاركة." });
    } finally {
        setIsSaving(false);
    }
  }

  const handleAction = (action: string) => {
    if (action === 'share') {
      setIsModalOpen(true);
    }
  }

  const ACTIONS = {
      appointment: [
          { id: 'share', label: 'مشاركة مع زميل', icon: Share2 },
          { id: 'reschedule', label: 'إعادة جدولة', icon: Repeat },
      ],
      task: [
          { id: 'share', label: 'مشاركة مع زميل', icon: Share2 },
          { id: 'reassign', label: 'إسناد لشخص آخر', icon: UserPlus },
      ],
      project: [
          { id: 'share', label: 'مشاركة تحديث المشروع', icon: Share2 },
          { id: 'add_meeting', label: 'إنشاء اجتماع متعلق', icon: CalendarPlus },
      ]
  }

  return (
    <>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                    <Share2 className="ml-2 h-4 w-4" />
                    إجراء سريع
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                {ACTIONS[entityType].map(action => (
                     <DropdownMenuItem key={action.id} onSelect={() => handleAction(action.id)}>
                        <action.icon className="ml-2 h-4 w-4" />
                        {action.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>مشاركة {entityType === 'appointment' ? 'الموعد' : 'المهمة'} مع زميل</DialogTitle>
                    <DialogDescription>
                        اكتب رسالتك واذكر (@) الزملاء الذين تريد إشعارهم بهذه المشاركة.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <RecoveredMentionTextarea 
                        value={message}
                        onChange={setMessage}
                        suggestions={userSuggestions}
                        placeholder="مثال: @أحمد الرجاء المتابعة بشكل عاجل..."
                    />
                </div>
                <DialogFooter>
                    <Button onClick={handleShare} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إرسال ومشاركة'}
                    </Button>
                    <Button variant="ghost" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}

// =============================================================================
// القسم الخامس: مكون الكتابة مع المنشن (MentionTextarea)
// المسار الأصلي: src/components/ui/mention-textarea.tsx
// =============================================================================
import { KeyboardEvent } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface RecoveredSuggestion {
  id: string;
  value: string;
  image?: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: RecoveredSuggestion[];
  placeholder?: string;
}

// Make sure to rename this function to MentionTextarea
// when you place it in src/components/ui/mention-textarea.tsx
export function RecoveredMentionTextarea({ value, onChange, suggestions, placeholder }: MentionTextareaProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const lastMentionPos = React.useRef<number | null>(null);

  const filteredSuggestions = suggestions.filter(s =>
    s.value.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleTextChange = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = value.substring(0, cursorPos);
      const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

      if (mentionMatch) {
        setIsOpen(true);
        setQuery(mentionMatch[1]);
        lastMentionPos.current = cursorPos - mentionMatch[1].length - 1;
      } else {
        setIsOpen(false);
      }
    };
    handleTextChange();
  }, [value]);

  const handleSuggestionClick = (suggestion: RecoveredSuggestion) => {
    const textarea = textareaRef.current;
    if (!textarea || lastMentionPos.current === null) return;

    const textBefore = value.substring(0, lastMentionPos.current);
    const textAfter = value.substring(lastMentionPos.current + query.length + 1);
    
    const formattedMention = `@[${suggestion.value}](${suggestion.id}) `;

    const newValue = textBefore + formattedMention + textAfter;
    onChange(newValue);
    setIsOpen(false);

    setTimeout(() => {
        const newCursorPos = textBefore.length + formattedMention.length;
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (isOpen) {
          if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex(prev => (prev + 1) % filteredSuggestions.length);
          } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
              if(filteredSuggestions[activeIndex]){
                e.preventDefault();
                handleSuggestionClick(filteredSuggestions[activeIndex]);
              }
          } else if (e.key === 'Escape') {
              setIsOpen(false);
          }
      }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[100px]"
        />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" side="top" align="start">
        <div className="flex flex-col">
          {filteredSuggestions.length > 0 ? (
            filteredSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion)}
                className={`flex items-center gap-2 p-2 text-sm text-right w-full ${index === activeIndex ? 'bg-muted' : 'hover:bg-muted/50'}`}>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={suggestion.image} />
                  <AvatarFallback>{suggestion.value.charAt(0)}</AvatarFallback>
                </Avatar>
                <span>{suggestion.value}</span>
              </button>
            ))
          ) : (
            <div className="p-2 text-sm text-center text-muted-foreground">لا يوجد مستخدمون مطابقون</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
