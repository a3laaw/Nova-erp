'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardDescription, 
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, updateDoc, Timestamp, orderBy, limit, collectionGroup, deleteDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { RefreshCw, Trash2, FileDown, FileText, Printer, CheckCircle2, XCircle, Loader2, ShieldCheck, ShieldAlert, Ban, Info, RotateCcw, Banknote, CalendarDays, History, AlertTriangle, CalendarRange, Trash2 as Trash, FileDown as Download, Printer as Print, Search, Fingerprint, Sparkles, FileSpreadsheet, Save } from 'lucide-react';
import type { Employee, MonthlyAttendance, AttendanceRecord, LeaveRequest, PermissionRequest, Holiday } from '@/lib/types';
import { parse, format, isValid, startOfDay, eachDayOfInterval, startOfMonth, endOfMonth, getDay, isAfter, endOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cleanFirestoreData, cn } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '../ui/badge';
import { toFirestoreDate } from '@/services/date-converter';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useAuth } from '@/context/auth-context';
import { useAppTheme } from '@/context/theme-context';

const dayNameToIndex: Record<string, number> = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6
};

const leaveTypeTranslations: Record<string, string> = {
    'Annual': 'سنوية', 'Sick': 'مرضية', 'Emergency': 'طارئة', 'Unpaid': 'بدون أجر'
};

const parseSmartDateTime = (val: any): { date: Date, timeStr: string } | null => {
    if (val === undefined || val === null || val === '') return null;
    
    let parsedDate: Date | null = null;
    let timeStr = "00:00";

    if (typeof val === 'number') {
        try {
            const excelDate = XLSX.SSF.parse_date_code(val);
            if (excelDate.y < 2000) return null;
            parsedDate = new Date(excelDate.y, excelDate.m - 1, excelDate.d, 12, 0, 0);
            timeStr = `${String(excelDate.h).padStart(2, '0')}:${String(excelDate.m).padStart(2, '0')}`;
        } catch { return null; }
    } 
    else if (typeof val === 'string') {
        const cleaned = val.trim();
        const dateMatch = cleaned.match(/(\d{1,4}[-/\.]\d{1,2}[-/\.]\d{1,4})/);
        const timeMatch = cleaned.match(/(\d{1,2}:\d{2}(:\d{2})?(\s?[AaPp][Mm])?)/);

        if (dateMatch) {
            const dateStr = dateMatch[0];
            const formats = ['dd-MM-yyyy', 'd-M-yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy', 'd/M/yyyy', 'dd.MM.yyyy', 'dd-MM-yy', 'MM-dd-yyyy', 'MM/dd/yyyy'];
            for (const fmt of formats) {
                const p = parse(dateStr, fmt, new Date());
                if (isValid(p)) {
                    if (p.getFullYear() < 2000) break;
                    parsedDate = new Date(p.getFullYear(), p.getMonth(), p.getDate(), 12, 0, 0);
                    break;
                }
            }
        }

        if (timeMatch) {
            const tStr = timeMatch[0].toUpperCase();
            const tp = parse(tStr, tStr.includes('M') ? 'hh:mm a' : 'HH:mm', new Date());
            if (isValid(tp)) timeStr = format(tp, 'HH:mm');
        }
    }

    if (parsedDate && isValid(parsedDate)) {
        return { date: parsedDate, timeStr };
    }
    return null;
};

export function AttendanceUploader() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { branding } = useBranding();
  const { user: currentUser } = useAuth();
  const { theme } = useAppTheme();
  const isGlass = theme === 'glass';

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [clearPrevious, setClearPrevious] = useState(true);
  const [processingMode, setProcessingMode] = useState<'limit_to_file' | 'full_month'>('limit_to_file');
  
  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', 'in', ['active', 'on-leave'])]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editableData, setEditableData] = useState<Record<string, { employeeNumber: string, workStartTime: string, workEndTime: string }>>({});
  const [isSavingData, setIsSavingData] = useState(false);
  const [mappingSearch, setMappingSearch] = useState('');

  const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

  useEffect(() => {
    if (employees.length > 0) {
        const data: Record<string, any> = {};
        employees.forEach(emp => {
            data[emp.id!] = {
                employeeNumber: emp.employeeNumber || '',
                workStartTime: emp.workStartTime || '',
                workEndTime: emp.workEndTime || ''
            };
        });
        setEditableData(data);
    }
  }, [employees]);

  const handleUpload = async () => {
    if (!firestore || !year || !month) return;
    setIsProcessing(true);
    const selectedYearNum = parseInt(year);
    const selectedMonthNum = parseInt(month);

    const processAttendanceLogic = (json: any[]) => {
        return new Promise<void>(async (resolve, reject) => {
            try {
                const monthStart = startOfMonth(new Date(selectedYearNum, selectedMonthNum - 1));
                const monthEnd = endOfMonth(monthStart);

                const [leavesSnap, permissionsSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'leaveRequests'), where('status', 'in', ['approved', 'on-leave', 'returned']))),
                    getDocs(query(collection(firestore, 'permissionRequests'), where('status', '==', 'approved')))
                ]);

                const approvedLeaves = leavesSnap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));
                const approvedPermissions = permissionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PermissionRequest));

                const employeeMap = new Map(employees.filter(emp => !!emp.employeeNumber).map(emp => [String(emp.employeeNumber), emp]));
                const excelPunches = new Map<string, Set<string>>(); 
                let lastDateInFile: Date | null = null;
                
                if (json.length > 0) {
                    json.forEach(row => {
                        const keys = Object.keys(row);
                        let empNo = '';
                        for(let k=0; k<Math.min(keys.length, 15); k++) {
                            const val = String(row[keys[k]] || '').trim();
                            if (val && employeeMap.has(val)) { empNo = val; break; }
                        }
                        const emp = employeeMap.get(empNo);
                        if (!emp?.id) return;

                        for (const key in row) {
                            const parsed = parseSmartDateTime(row[key]);
                            if (parsed) {
                                const pMonth = parsed.date.getMonth() + 1;
                                const pYear = parsed.date.getFullYear();
                                
                                if (pYear === selectedYearNum && pMonth === selectedMonthNum) {
                                    const dateKey = `${emp.id}_${format(parsed.date, 'yyyy-MM-dd')}`;
                                    if (!excelPunches.has(dateKey)) excelPunches.set(dateKey, new Set());
                                    if (parsed.timeStr && parsed.timeStr !== "00:00") {
                                        excelPunches.get(dateKey)!.add(parsed.timeStr);
                                        if (!lastDateInFile || parsed.date > lastDateInFile) lastDateInFile = parsed.date;
                                    }
                                }
                            }
                        }
                    });
                }

                let processingLimitDate = processingMode === 'full_month' ? monthEnd : (lastDateInFile || new Date());
                const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
                const holidayIndexes = new Set((branding?.work_hours?.holidays || []).map(h => dayNameToIndex[h]));
                const workingDaysInMonth = allDaysInMonth.filter(day => !holidayIndexes.has(getDay(day)));

                const batch = writeBatch(firestore);

                if (clearPrevious) {
                    const oldQ = query(collection(firestore, 'attendance'), where('year', '==', selectedYearNum), where('month', '==', selectedMonthNum));
                    const oldSnap = await getDocs(oldQ);
                    oldSnap.forEach(d => batch.delete(d.ref));
                }

                for (const emp of employees) {
                    const employeeRecords: AttendanceRecord[] = [];
                    for (const day of workingDaysInMonth) {
                        const stableDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0);
                        const dateKey = `${emp.id}_${format(stableDay, 'yyyy-MM-dd')}`;
                        const punches = excelPunches.get(dateKey);

                        if (!isAfter(stableDay, endOfDay(processingLimitDate))) {
                            const activeLeave = approvedLeaves.find(l => l.employeeId === emp.id && stableDay >= toFirestoreDate(l.startDate)! && stableDay <= toFirestoreDate(l.endDate)!);
                            const activePermission = approvedPermissions.find(p => p.employeeId === emp.id && isSameDay(stableDay, toFirestoreDate(p.date)!));

                            if (punches && punches.size > 0) {
                                const sortedTimes = Array.from(punches).sort();
                                let status: AttendanceRecord['status'] = 'present';
                                let anomaly = '';
                                let manualDeduction = 0;
                                let auditStatus: AttendanceRecord['auditStatus'] = 'verified';

                                if (activeLeave) {
                                    anomaly = `⚠️ تعارض: بصمة موجودة أثناء إجازة (${leaveTypeTranslations[activeLeave.leaveType]})`;
                                    auditStatus = 'pending';
                                } else {
                                    const startTimeLimit = emp.workStartTime || branding?.work_hours?.general?.morning_start_time || '08:00';
                                    if (sortedTimes[0] > startTimeLimit) {
                                        if (activePermission?.type === 'late_arrival') {
                                            anomaly = 'تأخير مسموح (إذن تأخير)';
                                            auditStatus = 'verified';
                                            status = 'present';
                                        } else {
                                            status = 'late';
                                            anomaly = `تأخير عن (${startTimeLimit})`;
                                            auditStatus = 'pending';
                                        }
                                    }
                                }

                                employeeRecords.push({ date: Timestamp.fromDate(stableDay), employeeId: emp.id!, checkIn1: sortedTimes[0], checkOut1: sortedTimes[sortedTimes.length - 1], allPunches: sortedTimes, status, anomalyDescription: anomaly, manualDeductionDays: manualDeduction, auditStatus });
                            } else if (activeLeave) {
                                employeeRecords.push({ 
                                    date: Timestamp.fromDate(stableDay), 
                                    employeeId: emp.id!, 
                                    status: 'present', 
                                    anomalyDescription: `إجازة ${leaveTypeTranslations[activeLeave.leaveType] || ''} (مزامنة آلية)`, 
                                    manualDeductionDays: 0, 
                                    auditStatus: 'verified', 
                                    allPunches: [] 
                                } as any);
                            } else {
                                employeeRecords.push({ date: Timestamp.fromDate(stableDay), employeeId: emp.id!, status: 'absent', anomalyDescription: 'غائب (بدون بصمة)', manualDeductionDays: 1, auditStatus: 'pending', allPunches: [] } as any);
                            }
                        }
                    }

                    if (employeeRecords.length > 0) {
                        const docId = `${selectedYearNum}-${selectedMonthNum}-${emp.id}`;
                        batch.set(doc(firestore, 'attendance', docId), {
                            employeeId: emp.id,
                            year: selectedYearNum,
                            month: selectedMonthNum,
                            records: employeeRecords,
                            updatedAt: serverTimestamp()
                        });
                    }
                }

                await batch.commit();
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                await processAttendanceLogic(json);
                toast({ title: 'نجاح المعالجة', description: 'تم دمج البصمات مع الإجازات والاستئذانات آلياً.' });
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
            } catch (err: any) {
                toast({ variant: 'destructive', title: 'خطأ', description: err.message });
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsBinaryString(file);
    } else {
        try {
            await processAttendanceLogic([]);
            toast({ title: 'نجاح المزامنة', description: 'تم تحديث سجلات الإجازات والاستئذانات المعتمدة آلياً.' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'خطأ', description: err.message });
        } finally {
            setIsProcessing(false);
        }
    }
  };

  const handleSaveMappingData = async () => {
    if (!firestore || employees.length === 0) return;
    setIsSavingData(true);
    try {
        const batch = writeBatch(firestore);
        let hasChanges = false;

        for (const empId in editableData) {
            const current = editableData[empId];
            const original = employees.find(e => e.id === empId);
            
            if (original) {
                const needsUpdate = 
                    original.employeeNumber !== current.employeeNumber ||
                    (original.workStartTime || '') !== current.workStartTime ||
                    (original.workEndTime || '') !== current.workEndTime;

                if (needsUpdate) {
                    const empRef = doc(firestore, 'employees', empId);
                    batch.update(empRef, {
                        employeeNumber: current.employeeNumber,
                        workStartTime: current.workStartTime || null,
                        workEndTime: current.workEndTime || null
                    });
                    hasChanges = true;
                }
            }
        }

        if (hasChanges) {
            await batch.commit();
            toast({ title: 'تم حفظ البيانات', description: 'تم تحديث أرقام البصمة وساعات الدوام بنجاح.' });
        } else {
            toast({ title: 'لا توجد تغييرات', description: 'لم يتم تعديل أي بيانات للحفظ.' });
        }
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
    } finally {
        setIsSavingData(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!mappingSearch) return employees;
    const lower = mappingSearch.toLowerCase();
    return employees.filter(e => e.fullName.toLowerCase().includes(lower) || e.employeeNumber.includes(lower));
  }, [employees, mappingSearch]);

  return (
    <Tabs defaultValue="upload" dir="rtl" className="space-y-0">
        <div className={cn(isGlass ? "tabs-frame-secondary" : "mb-8")}>
            <TabsList className={cn(
                "w-full h-auto bg-transparent p-0 gap-6",
                isGlass ? "tabs-list-cards lg:grid-cols-2" : "grid grid-cols-1 md:grid-cols-2"
            )}>
                <TabsTrigger value="upload" className={cn("text-right", isGlass ? "tabs-trigger-card" : "")}>
                    <div className="tab-icon-box"><FileSpreadsheet className="h-6 w-6" /></div>
                    <h3 className="text-lg font-black">رفع ومعالجة الملف</h3>
                    <p className="text-[10px] font-bold text-muted-foreground">استيراد سجلات البصمة ومطابقتها آلياً.</p>
                </TabsTrigger>
                <TabsTrigger value="mapping" className={cn("text-right", isGlass ? "tabs-trigger-card" : "")}>
                    <div className="tab-icon-box"><Fingerprint className="h-6 w-6" /></div>
                    <h3 className="text-lg font-black">مطابقة البصمة والدوام</h3>
                    <p className="text-[10px] font-bold text-muted-foreground">تخصيص أرقام البصمة وساعات العمل.</p>
                </TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="upload" className="mt-0 animate-in fade-in zoom-in-95 duration-300">
            <div className="space-y-8">
                <Card className={cn(
                    "rounded-[2.5rem] border-none shadow-xl overflow-hidden",
                    isGlass ? "glass-effect" : "bg-white"
                )}>
                    <CardHeader className={cn(
                        "py-10 px-10 border-b",
                        isGlass ? "bg-white/5" : "bg-gradient-to-l from-white to-purple-50"
                    )}>
                        <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                            <div className="space-y-2 text-right">
                                <div className="flex items-center justify-end gap-3">
                                    <CardTitle className="text-3xl font-black text-gray-800 tracking-tight">إعدادات الفترة ونطاق الرقابة</CardTitle>
                                    <div className="bg-primary/10 rounded-2xl text-primary shadow-inner p-2">
                                        <CalendarRange className="h-8 w-8" />
                                    </div>
                                </div>
                                <CardDescription className="text-muted-foreground font-bold text-base leading-relaxed">
                                    حدد الشهر والسنة المستهدفة لاحتساب الرواتب ومطابقة البصمات.
                                </CardDescription>
                            </div>

                            <div className={cn(
                                "border p-6 rounded-[2.5rem] shadow-inner min-w-[420px]",
                                isGlass ? "bg-white/10" : "bg-muted/30"
                            )}>
                                <div className="flex gap-6 justify-center">
                                    <div className="grid gap-1">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground mr-1">السنة الرقابية</Label>
                                        <Select value={year} onValueChange={setYear}>
                                            <SelectTrigger className="h-11 w-32 rounded-xl border-primary/10 bg-background font-black"><SelectValue /></SelectTrigger>
                                            <SelectContent dir="rtl">{[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-1">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground mr-1">الشهر المستهدف</Label>
                                        <Select value={month} onValueChange={setMonth}>
                                            <SelectTrigger className="h-11 w-32 rounded-xl border-primary/10 bg-background font-black"><SelectValue /></SelectTrigger>
                                            <SelectContent dir="rtl">{Array.from({length:12}, (_,i)=>i+1).map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        <RadioGroup value={processingMode} onValueChange={(v: any) => setProcessingMode(v)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className={cn(
                                "relative flex items-center space-x-4 space-x-reverse p-6 rounded-[2rem] border-2 transition-all cursor-pointer group h-28 shadow-[0_5px_0_0_rgba(0,0,0,0.05)] active:translate-y-1 active:shadow-none",
                                processingMode === 'limit_to_file' ? "bg-primary/5 border-primary" : "bg-card border-slate-100 hover:border-primary/20",
                                isGlass && "glass-effect border-white/20"
                            )} onClick={() => setProcessingMode('limit_to_file')}>
                                <RadioGroupItem value="limit_to_file" id="r1" className="h-6 w-6" />
                                <div className="flex-1">
                                    <Label htmlFor="r1" className="font-black text-lg cursor-pointer block text-primary">أيام محددة (بناءً على الملف)</Label>
                                    <p className="text-[10px] text-muted-foreground font-bold mt-1">يحتسب الغياب فقط للأيام الموثقة في الملف المرفوع.</p>
                                </div>
                            </div>
                            <div className={cn(
                                "relative flex items-center space-x-4 space-x-reverse p-6 rounded-[2rem] border-2 transition-all cursor-pointer group h-28 shadow-[0_5px_0_0_rgba(0,0,0,0.05)] active:translate-y-1 active:shadow-none",
                                processingMode === 'full_month' ? "bg-primary/5 border-primary" : "bg-card border-slate-100 hover:border-primary/20",
                                isGlass && "glass-effect border-white/20"
                            )} onClick={() => setProcessingMode('full_month')}>
                                <RadioGroupItem value="full_month" id="r2" className="h-6 w-6" />
                                <div className="flex-1">
                                    <Label htmlFor="r2" className="font-black text-lg cursor-pointer block text-primary">الشهر كامل (إغلاق نهائي)</Label>
                                    <p className="text-[10px] text-muted-foreground font-bold mt-1">يحسب الغياب حتى آخر يوم في الشهر (للتقارير النهائية).</p>
                                </div>
                            </div>
                        </RadioGroup>

                        <div className="mt-8 grid md:grid-cols-2 gap-6">
                            <div className={cn(
                                "flex items-center gap-4 p-6 rounded-[2rem] border-2 border-dashed",
                                isGlass ? "bg-white/5 border-white/20" : "bg-amber-50/30 border-amber-200"
                            )}>
                                <Checkbox id="purge" checked={clearPrevious} onCheckedChange={(c) => setClearPrevious(!!c)} className="h-6 w-6 rounded-lg border-amber-400 data-[state=checked]:bg-amber-600" />
                                <div>
                                    <Label htmlFor="purge" className="font-black text-base text-amber-900 cursor-pointer">تطهير البيانات السابقة</Label>
                                    <p className="text-[10px] text-amber-700 font-medium">مسح أي بصمات قديمة مسجلة لهذا الشهر والبدء من الصفر.</p>
                                </div>
                            </div>
                            <div className={cn(
                                "flex items-center gap-4 p-6 rounded-[2rem] border-2 border-dashed",
                                isGlass ? "bg-white/5 border-white/20" : "bg-blue-50/30 border-blue-200"
                            )}>
                                <div className="p-3 bg-blue-100 rounded-2xl text-blue-600">
                                    <ShieldCheck className="h-6 w-6" />
                                </div>
                                <div>
                                    <Label className="font-black text-base text-blue-900">الرقابة الآلية نشطة</Label>
                                    <p className="text-[10px] text-blue-700 font-medium">سيقوم النظام بدمج الإجازات والاستئذانات آلياً أثناء المعالجة.</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className={cn(
                    "rounded-[3rem] border-none shadow-2xl overflow-hidden",
                    isGlass ? "glass-effect" : "bg-white"
                )}>
                    <CardContent className="p-8 text-center space-y-6">
                        <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed rounded-[3rem] p-6 text-center cursor-pointer hover:bg-primary/5 transition-all bg-muted/20 group relative overflow-hidden max-w-lg mx-auto">
                            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".xlsx, .xls, .csv" />
                            <FileSpreadsheet className="h-10 w-10 mx-auto opacity-20 mb-3 group-hover:scale-110 group-hover:opacity-40 transition-all text-primary" />
                            <p className="font-black text-lg text-gray-700">{file ? file.name : "اسحب وأفلت ملف الإكسيل هنا"}</p>
                            <p className="text-[10px] text-muted-foreground mt-1 font-bold max-w-xs mx-auto">سيقوم النظام بمطابقة البصمات مع الإجازات والاستئذانات آلياً.</p>
                        </div>
                        
                        <div className="flex flex-col items-center gap-4">
                            <Button onClick={handleUpload} disabled={isProcessing} className="h-12 px-12 rounded-2xl font-black text-lg shadow-[0_4px_0_0_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none bg-primary text-white hover:bg-primary/90 gap-3 min-w-[320px] transition-all">
                                {isProcessing ? <Loader2 className="animate-spin h-5 w-5"/> : <RotateCcw className="h-5 w-5"/>} 
                                {file ? "بدء التحليل والمعالجة" : "مزامنة الإعذار فقط (بدون ملف)"}
                            </Button>
                            {!file && (
                                <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
                                    <Sparkles className="h-3 w-3 text-primary" /> يمكنك المزامنة الآن حتى بدون رفع ملف بصمة.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="mapping" className="mt-0 animate-in fade-in zoom-in-95 duration-300">
            <Card className={cn(
                "rounded-[2.5rem] border-none shadow-xl overflow-hidden",
                isGlass ? "glass-effect" : "bg-white"
            )}>
                <CardHeader className={cn(
                    "py-10 px-10 border-b",
                    isGlass ? "bg-white/5" : "bg-gradient-to-l from-white to-purple-50"
                )}>
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                        <div className="space-y-2 text-right">
                            <div className="flex items-center justify-end gap-3">
                                <CardTitle className="text-3xl font-black text-gray-800 tracking-tight">مطابقة البصمة والدوام المخصص</CardTitle>
                                <div className="bg-primary/10 rounded-2xl text-primary shadow-inner p-2">
                                    <Fingerprint className="h-8 w-8" />
                                </div>
                            </div>
                            <CardDescription className="text-muted-foreground font-bold text-base leading-relaxed">
                                تحديد أرقام البصمة وساعات الدوام لكل موظف لضمان دقة الرقابة المالية.
                            </CardDescription>
                        </div>
                        <div className={cn(
                            "border p-6 rounded-[2.5rem] shadow-inner min-w-[420px]",
                            isGlass ? "bg-white/10" : "bg-muted/30"
                        )}>
                            <div className="relative w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                                <Input placeholder="بحث بالاسم أو الرقم..." value={mappingSearch} onChange={(e) => setMappingSearch(e.target.value)} className="pl-10 h-12 rounded-2xl bg-background border-primary/10 text-gray-800 placeholder:text-muted-foreground font-bold shadow-sm" />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[550px] overflow-y-auto scrollbar-none">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow className="h-14">
                                    <TableHead className="px-10 font-black text-gray-800">اسم الموظف</TableHead>
                                    <TableHead className="font-black text-gray-800">رقم الملف</TableHead>
                                    <TableHead className="font-black text-gray-800">رقم البصمة</TableHead>
                                    <TableHead className="font-black text-center text-gray-800">بداية الدوام</TableHead>
                                    <TableHead className="font-black text-center text-gray-800">نهاية الدوام</TableHead>
                                    <TableHead className="w-32 text-center font-black text-gray-800">الحالة</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employeesLoading ? (
                                    Array.from({length: 5}).map((_, i) => <TableRow key={i}><TableCell colSpan={6} className="px-10 py-6"><Skeleton className="h-10 w-full rounded-2xl"/></TableCell></TableRow>)
                                ) : filteredEmployees.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic font-bold">لا توجد سجلات للموظفين.</TableCell></TableRow>
                                ) : (
                                    filteredEmployees.map((emp) => {
                                        const current = editableData[emp.id!] || { employeeNumber: '', workStartTime: '', workEndTime: '' };
                                        const isChanged = emp.employeeNumber !== current.employeeNumber || (emp.workStartTime || '') !== current.workStartTime || (emp.workEndTime || '') !== current.workEndTime;
                                        const isFullTime = !current.workStartTime && !current.workEndTime;
                                        return (
                                            <TableRow key={emp.id} className={cn("hover:bg-primary/5 transition-colors h-20 border-b last:border-0", !isFullTime && "bg-sky-50/20")}>
                                                <TableCell className="px-10">
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-base text-gray-800">{emp.fullName}</span>
                                                        <span className="text-[10px] text-muted-foreground font-bold">{emp.department}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono font-black text-sm opacity-60">{emp.employeeNumber}</TableCell>
                                                <TableCell><Input value={current.employeeNumber} onChange={(e) => setEditableData(prev => ({...prev, [emp.id!]: { ...current, employeeNumber: e.target.value }}))} className="font-mono font-black h-10 rounded-xl border-2 w-32 text-center text-primary" placeholder="000"/></TableCell>
                                                <TableCell><Input type="time" value={current.workStartTime} onChange={(e) => setEditableData(prev => ({...prev, [emp.id!]: { ...current, workStartTime: e.target.value }}))} className="font-mono h-10 rounded-xl border-2 w-32 mx-auto text-center"/></TableCell>
                                                <TableCell><Input type="time" value={current.workEndTime} onChange={(e) => setEditableData(prev => ({...prev, [emp.id!]: { ...current, workEndTime: e.target.value }}))} className="font-mono h-10 rounded-xl border-2 w-32 mx-auto text-center"/></TableCell>
                                                <TableCell className="text-center px-6">{isChanged ? <Badge className="bg-orange-600 text-white font-black text-[9px] animate-pulse rounded-lg">بانتظار الحفظ</Badge> : isFullTime ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100 font-black text-[9px] rounded-lg">كامل (رسمي)</Badge> : <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-100 font-black text-[9px] rounded-lg">جزئي (مخصص)</Badge>}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="justify-end border-t p-8 bg-muted/10">
                    <div className="flex-1 text-xs text-muted-foreground font-bold pr-4 flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> اترك حقول الوقت فارغة إذا كان الموظف يتبع الدوام الرسمي الكامل للمكتب.</div>
                    <Button onClick={handleSaveMappingData} disabled={isSavingData} className="h-14 px-12 rounded-2xl font-black text-lg gap-2 shadow-[0_6px_0_0_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none bg-primary text-white">{isSavingData ? <Loader2 className="h-5 w-5"/> : <Save className="h-5 w-5"/>} حفظ كافة البيانات</Button>
                </CardFooter>
            </Card>
        </TabsContent>
    </Tabs>
  );
}
