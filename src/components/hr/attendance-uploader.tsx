'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
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
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, updateDoc, Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Loader2, FileSpreadsheet, RotateCcw, CheckCircle2, Fingerprint, Save, Search, UserCheck, Clock, ShieldCheck, BadgeInfo, X, Info, AlertTriangle, CalendarRange } from 'lucide-react';
import type { Employee, MonthlyAttendance, AttendanceRecord, LeaveRequest, PermissionRequest } from '@/lib/types';
import { parse, format, isValid, startOfDay, eachDayOfInterval, startOfMonth, endOfMonth, getDay, isBefore, endOfDay, isAfter } from 'date-fns';
import { cleanFirestoreData, cn } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toFirestoreDate } from '@/services/date-converter';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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
            const formats = [
                'dd-MM-yyyy', 'd-M-yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy', 
                'd/M/yyyy', 'dd.MM.yyyy', 'dd-MM-yy', 'MM-dd-yyyy', 'MM/dd/yyyy'
            ];
            for (const fmt of formats) {
                const p = parse(dateStr, fmt, new Date());
                if (isValid(p)) {
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

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [clearPrevious, setClearPrevious] = useState(true);
  const [processingMode, setProcessingMode] = useState<'limit_to_file' | 'full_month'>('limit_to_file');
  
  const [summary, setSummary] = useState<{ workingDays: number, totalPunches: number, autoAbsences: number, coveredByPolicy: number } | null>(null);
  
  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editableData, setEditableData] = useState<Record<string, { employeeNumber: string, workStartTime: string, workEndTime: string }>>({});
  const [isSavingData, setIsSavingData] = useState(false);
  const [mappingSearch, setMappingSearch] = useState('');

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

  const filteredEmployees = useMemo(() => {
    if (!mappingSearch) return employees;
    const lower = mappingSearch.toLowerCase();
    return employees.filter(e => 
        e.fullName.toLowerCase().includes(lower) || 
        e.employeeNumber?.includes(lower)
    );
  }, [employees, mappingSearch]);

  const handleSaveMappingData = async () => {
    if (!firestore) return;
    setIsSavingData(true);
    try {
        const batch = writeBatch(firestore);
        let count = 0;
        for (const id in editableData) {
            const original = employees.find(e => e.id === id);
            const current = editableData[id];
            
            const hasChanged = original && (
                original.employeeNumber !== current.employeeNumber || 
                (original.workStartTime || '') !== current.workStartTime || 
                (original.workEndTime || '') !== current.workEndTime
            );

            if (hasChanged) {
                batch.update(doc(firestore, 'employees', id), { 
                    employeeNumber: current.employeeNumber,
                    workStartTime: current.workStartTime || null,
                    workEndTime: current.workEndTime || null
                });
                count++;
            }
        }
        if (count > 0) {
            await batch.commit();
            toast({ title: 'تم التحديث بنجاح', description: `تم حفظ بيانات ${count} موظف بنجاح.` });
        } else {
            toast({ title: 'لا توجد تغييرات', description: 'لم يتم تعديل أي بيانات للحفظ.' });
        }
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ التغييرات.' });
    } finally {
        setIsSavingData(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !firestore || !year || !month) return;
    setIsProcessing(true);
    setSummary(null);
    const selectedYearNum = parseInt(year);
    const selectedMonthNum = parseInt(month);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        if (json.length === 0) throw new Error("الملف المرفوع فارغ أو بتنسيق غير مدعوم.");

        const monthStart = startOfMonth(new Date(selectedYearNum, selectedMonthNum - 1));
        const monthEnd = endOfMonth(monthStart);
        const today = startOfDay(new Date());

        const [leavesSnap, permissionsSnap] = await Promise.all([
            getDocs(query(collection(firestore, 'leaveRequests'), where('status', 'in', ['approved', 'on-leave', 'returned']))),
            getDocs(query(collection(firestore, 'permissionRequests'), where('status', '==', 'approved')))
        ]);

        const approvedLeaves = leavesSnap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));
        const approvedPermissions = permissionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PermissionRequest));

        const validEmployees = employees.filter(emp => emp.employeeNumber && emp.employeeNumber.trim() !== '');
        const employeeMap = new Map(validEmployees.map(emp => [String(emp.employeeNumber), emp]));
        
        const excelPunches = new Map<string, Set<string>>(); 
        let totalPunchesCount = 0;
        let lastDateInFile: Date | null = null;
        
        // --- حماية الفترة: التحقق من توافق الشهر والسنوات ---
        const detectedMonths = new Set<string>();
        
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
                    detectedMonths.add(`${pYear}-${pMonth}`);

                    // فقط إذا كان التاريخ يطابق الفترة المختارة، نقوم بتسجيل البصمات
                    if (pYear === selectedYearNum && pMonth === selectedMonthNum) {
                        const dateKey = `${emp.id}_${format(parsed.date, 'yyyy-MM-dd')}`;
                        if (!excelPunches.has(dateKey)) excelPunches.set(dateKey, new Set());
                        if (parsed.timeStr && parsed.timeStr !== "00:00") {
                            excelPunches.get(dateKey)!.add(parsed.timeStr);
                            totalPunchesCount++;
                            if (!lastDateInFile || parsed.date > lastDateInFile) {
                                lastDateInFile = parsed.date;
                            }
                        }
                    }
                }
            }
        });

        // التحقق من تضارب الأشهر (Audit Logic)
        const targetPeriod = `${selectedYearNum}-${selectedMonthNum}`;
        if (detectedMonths.size > 0 && !detectedMonths.has(targetPeriod)) {
            const foundMonths = Array.from(detectedMonths).join(', ');
            throw new Error(`الملف المرفوع لا يحتوي على بيانات لشهر ${selectedMonthNum}/${selectedYearNum}. تم العثور على بيانات للفترات التالية: (${foundMonths}). يرجى التأكد من اختيار الشهر الصحيح في الأعلى.`);
        }

        if (excelPunches.size === 0) {
            throw new Error("لم يتم العثور على أي بصمات مطابقة للفترة المحددة داخل الملف.");
        }

        let processingLimitDate: Date;
        if (processingMode === 'full_month') {
            processingLimitDate = monthEnd;
        } else {
            processingLimitDate = lastDateInFile || today;
        }

        const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const holidayIndexes = new Set((branding?.work_hours?.holidays || []).map(h => dayNameToIndex[h]));
        const workingDaysInMonth = allDaysInMonth.filter(day => !holidayIndexes.has(getDay(day)));

        const batch = writeBatch(firestore);

        if (clearPrevious) {
            const existingQuery = query(
                collection(firestore, 'attendance'),
                where('year', '==', selectedYearNum),
                where('month', '==', selectedMonthNum)
            );
            const existingSnap = await getDocs(existingQuery);
            existingSnap.forEach(d => batch.delete(d.ref));
        } else {
            const existingQuery = query(
                collection(firestore, 'attendance'),
                where('year', '==', selectedYearNum),
                where('month', '==', selectedMonthNum)
            );
            const existingSnap = await getDocs(existingQuery);
            existingSnap.forEach(existingDoc => {
                const existingData = existingDoc.data();
                const empId = existingData.employeeId;
                (existingData.records || []).forEach((r: any) => {
                    if (r.allPunches && r.allPunches.length > 0) {
                        const dateObj = r.date?.toDate ? r.date.toDate() : new Date(r.date);
                        const dateKey = `${empId}_${format(dateObj, 'yyyy-MM-dd')}`;
                        if (!excelPunches.has(dateKey)) {
                            excelPunches.set(dateKey, new Set());
                        }
                        r.allPunches.forEach((p: string) => excelPunches.get(dateKey)!.add(p));
                    }
                });
                batch.delete(existingDoc.ref);
            });
        }

        const workHours = branding?.work_hours?.general;
        const mEnd = workHours?.morning_end_time || '13:00';
        const eStart = workHours?.evening_start_time || '16:00';

        let autoAbsencesCount = 0;
        let coveredByPolicyCount = 0;

        for (const emp of validEmployees) {
            const employeeRecords: AttendanceRecord[] = [];
            
            for (const day of workingDaysInMonth) {
                const stableDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0);
                const dateKey = `${emp.id}_${format(stableDay, 'yyyy-MM-dd')}`;
                const punches = excelPunches.get(dateKey);

                if (!isAfter(stableDay, endOfDay(processingLimitDate))) {
                    const activeLeave = approvedLeaves.find(l => 
                        l.employeeId === emp.id && 
                        stableDay >= toFirestoreDate(l.startDate)! && 
                        stableDay <= toFirestoreDate(l.endDate)!
                    );

                    const activePermission = approvedPermissions.find(p => 
                        p.employeeId === emp.id && 
                        isSameDay(stableDay, toFirestoreDate(p.date)!)
                    );

                    if (punches && punches.size > 0) {
                        const sortedTimes = Array.from(punches).sort();
                        let status: AttendanceRecord['status'] = 'present';
                        let anomaly = '';
                        let manualDeduction = 0;
                        let auditStatus: AttendanceRecord['auditStatus'] = 'verified';

                        const startTimeLimit = emp.workStartTime || workHours?.morning_start_time || '08:00';

                        if (sortedTimes[0] > startTimeLimit) {
                            if (activePermission?.type === 'late_arrival') {
                                status = 'present';
                                anomaly = 'تأخير مسموح (إذن تأخير معتمد)';
                                coveredByPolicyCount++;
                            } else {
                                status = 'late';
                                anomaly = `تأخير عن الموعد (${startTimeLimit})`;
                                auditStatus = 'pending';
                            }
                        }

                        if (!emp.workStartTime && !emp.workEndTime) {
                            const hasMorning = sortedTimes.some(t => t <= mEnd);
                            const hasEvening = sortedTimes.some(t => t >= eStart);

                            if (hasMorning && !hasEvening) {
                                if (activePermission?.type === 'early_departure') {
                                    status = 'present';
                                    anomaly = anomaly ? `${anomaly} + خروج مسموح` : 'خروج مسموح';
                                    coveredByPolicyCount++;
                                } else {
                                    status = 'half_day';
                                    anomaly = anomaly ? `${anomaly} + بصمة صباحية فقط` : 'بصمة صباحية فقط';
                                    manualDeduction = 0.5;
                                    auditStatus = 'pending';
                                }
                            } else if (!hasMorning && hasEvening) {
                                status = 'half_day';
                                anomaly = anomaly ? `${anomaly} + بصمة مسائية فقط` : 'بصمة مسائية فقط';
                                manualDeduction = 0.5;
                                auditStatus = 'pending';
                            }
                        }

                        employeeRecords.push({
                            date: Timestamp.fromDate(stableDay),
                            employeeId: emp.id!,
                            checkIn1: sortedTimes[0],
                            checkOut1: sortedTimes[sortedTimes.length - 1],
                            allPunches: sortedTimes,
                            status,
                            anomalyDescription: anomaly,
                            manualDeductionDays: manualDeduction,
                            auditStatus
                        });
                    } else {
                        if (activeLeave) {
                            coveredByPolicyCount++;
                            employeeRecords.push({
                                date: Timestamp.fromDate(stableDay),
                                employeeId: emp.id!,
                                status: 'present',
                                anomalyDescription: `إجازة ${leaveTypeTranslations[activeLeave.leaveType] || 'رسمية'} معتمدة`,
                                manualDeductionDays: 0,
                                auditStatus: 'verified',
                                allPunches: []
                            });
                        } else {
                            autoAbsencesCount++;
                            employeeRecords.push({
                                date: Timestamp.fromDate(stableDay),
                                employeeId: emp.id!,
                                status: 'absent',
                                anomalyDescription: 'غائب (لم تظهر بصمته في الملف)',
                                manualDeductionDays: 1,
                                auditStatus: 'pending',
                                allPunches: []
                            });
                        }
                    }
                }
            }

            if (employeeRecords.length > 0) {
                const presentDays = employeeRecords.filter(r => r.status === 'present').length;
                const absentDays = employeeRecords.filter(r => r.status === 'absent').length;
                const lateDays = employeeRecords.filter(r => r.status === 'late').length;
                const halfDays = employeeRecords.filter(r => r.status === 'half_day').length;
                const totalDeductionDays = employeeRecords.reduce((sum, r) => sum + (r.manualDeductionDays || 0), 0);

                const docId = `${selectedYearNum}-${selectedMonthNum}-${emp.id}`;
                batch.set(doc(firestore, 'attendance', docId), {
                    employeeId: emp.id,
                    year: selectedYearNum,
                    month: selectedMonthNum,
                    records: employeeRecords,
                    summary: {
                        presentDays,
                        absentDays,
                        lateDays,
                        halfDays,
                        totalDeductionDays,
                        totalWorkingDays: employeeRecords.length
                    },
                    updatedAt: serverTimestamp()
                });
            }
        }

        await batch.commit();
        setSummary({ workingDays: workingDaysInMonth.length, totalPunches: totalPunchesCount, autoAbsences: autoAbsencesCount, coveredByPolicy: coveredByPolicyCount });
        toast({ title: 'نجاح المعالجة', description: `تم تحليل الفترة بنجاح.` });
        setFile(null);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'خطأ في معالجة الملف', description: error.message });
      } finally { setIsProcessing(false); }
    };
    reader.readAsBinaryString(file!);
  };

  const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

  return (
    <Tabs defaultValue="upload" dir="rtl" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-14 rounded-2xl bg-muted/50 p-1.5 shadow-inner">
            <TabsTrigger value="upload" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md">
                <FileSpreadsheet className="h-4 w-4" />
                رفع ومعالجة الملف
            </TabsTrigger>
            <TabsTrigger value="mapping" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md">
                <Fingerprint className="h-4 w-4" />
                مطابقة البصمة والدوام
            </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-0 animate-in fade-in zoom-in-95 duration-300">
            <div className="space-y-8">
                <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
                    <CardHeader className="bg-muted/10 border-b pb-6 px-8">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex items-center gap-3">
                                <CalendarRange className="h-6 w-6 text-primary" />
                                <CardTitle className="text-xl font-black text-gray-800">إعدادات نطاق الرقابة وفترة التقرير</CardTitle>
                            </div>
                            <div className="flex gap-4 bg-background p-2 rounded-2xl border shadow-inner">
                                <div className="grid gap-1">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground mr-1">السنة</Label>
                                    <Select value={year} onValueChange={setYear}>
                                        <SelectTrigger className="h-9 w-28 rounded-xl border-none shadow-none"><SelectValue /></SelectTrigger>
                                        <SelectContent dir="rtl">{[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <Separator orientation="vertical" className="h-8 my-auto" />
                                <div className="grid gap-1">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground mr-1">الشهر</Label>
                                    <Select value={month} onValueChange={setMonth}>
                                        <SelectTrigger className="h-9 w-28 rounded-xl border-none shadow-none"><SelectValue /></SelectTrigger>
                                        <SelectContent dir="rtl">{Array.from({length:12}, (_,i)=>i+1).map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        <RadioGroup value={processingMode} onValueChange={(v: any) => setProcessingMode(v)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className={cn(
                                "relative flex items-center space-x-4 space-x-reverse p-6 rounded-[2rem] border-2 transition-all cursor-pointer group h-28 shadow-[0_5px_0_0_rgba(0,0,0,0.05)] active:translate-y-1 active:shadow-none",
                                processingMode === 'limit_to_file' ? "bg-primary/5 border-primary" : "bg-card border-slate-100 hover:border-primary/20"
                            )} onClick={() => setProcessingMode('limit_to_file')}>
                                <RadioGroupItem value="limit_to_file" id="r1" className="h-6 w-6" />
                                <div className="flex-1">
                                    <Label htmlFor="r1" className="font-black text-lg cursor-pointer block text-primary">أيام محددة (بناءً على الملف)</Label>
                                    <p className="text-[10px] text-muted-foreground font-bold mt-1">يتوقف النظام عند أقصى تاريخ تم رصده في الملف المرفوع.</p>
                                </div>
                            </div>
                            
                            <div className={cn(
                                "relative flex items-center space-x-4 space-x-reverse p-6 rounded-[2rem] border-2 transition-all cursor-pointer group h-28 shadow-[0_5px_0_0_rgba(0,0,0,0.05)] active:translate-y-1 active:shadow-none",
                                processingMode === 'full_month' ? "bg-primary/5 border-primary" : "bg-card border-slate-100 hover:border-primary/20"
                            )} onClick={() => setProcessingMode('full_month')}>
                                <RadioGroupItem value="full_month" id="r2" className="h-6 w-6" />
                                <div className="flex-1">
                                    <Label htmlFor="r2" className="font-black text-lg cursor-pointer block text-primary">الشهر كامل (إغلاق نهائي)</Label>
                                    <p className="text-[10px] text-muted-foreground font-bold mt-1">يحسب النظام الغياب حتى آخر يوم في الشهر المختار.</p>
                                </div>
                            </div>
                        </RadioGroup>

                        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-amber-50/30 rounded-[2rem] border-2 border-dashed border-amber-200">
                            <div className="flex items-center gap-4">
                                <Checkbox id="purge" checked={clearPrevious} onCheckedChange={(c) => setClearPrevious(!!c)} className="h-6 w-6 rounded-lg border-amber-400 data-[state=checked]:bg-amber-600" />
                                <div>
                                    <Label htmlFor="purge" className="font-black text-base text-amber-900 cursor-pointer">تطهير البيانات السابقة لهذا الشهر</Label>
                                    <p className="text-xs text-amber-700 font-medium">تفعيل هذا الخيار سيمسح أي بصمات قديمة مسجلة لهذا الشهر ويبدأ من الصفر.</p>
                                </div>
                            </div>
                            {summary && (
                                <div className="flex gap-3 animate-in zoom-in-95">
                                    <Badge variant="outline" className="bg-white text-red-700 border-red-100 font-black px-4 py-1 rounded-xl">إثبات غياب: {summary.autoAbsences}</Badge>
                                    <Badge variant="outline" className="bg-white text-green-700 border-green-100 font-black px-4 py-1 rounded-xl">إجازات: {summary.coveredByPolicy}</Badge>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white">
                    <CardContent className="p-12">
                        <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed rounded-[4rem] p-20 text-center cursor-pointer hover:bg-primary/5 transition-all bg-muted/20 group relative overflow-hidden">
                            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".xlsx, .xls, .csv" />
                            <FileSpreadsheet className="h-24 w-24 mx-auto opacity-20 mb-6 group-hover:scale-110 group-hover:opacity-40 transition-all text-primary" />
                            <p className="font-black text-3xl text-gray-700">{file ? file.name : "اسحب وأفلت ملف الإكسيل هنا"}</p>
                            <p className="text-sm text-muted-foreground mt-4 font-bold max-w-sm mx-auto">سيقوم المحاسب الذكي بمطابقة البصمات مع الإجازات والاستئذانات آلياً.</p>
                        </div>
                    </CardContent>
                    <CardFooter className="justify-center border-t p-10 bg-muted/10">
                        <Button onClick={handleUpload} disabled={!file || isProcessing} className="h-16 px-20 rounded-[2rem] font-black text-2xl shadow-2xl shadow-primary/30 gap-4 min-w-[350px] transition-all hover:scale-105 active:scale-95">
                            {isProcessing ? <Loader2 className="animate-spin h-8 w-8"/> : <RotateCcw className="h-8 w-8"/>} 
                            بدء التحليل والربط المالي
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="mapping" className="mt-0 animate-in fade-in zoom-in-95 duration-300">
            <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 pb-8 border-b">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black flex items-center gap-3">
                                <Fingerprint className="text-primary h-7 w-7" />
                                مطابقة البصمة والدوام المخصص
                            </CardTitle>
                            <CardDescription className="text-base font-medium">تحديد أرقام البصمة وساعات الدوام لكل موظف لضمان دقة الرقابة المالية.</CardDescription>
                        </div>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                            <Input 
                                placeholder="بحث بالاسم أو الرقم..." 
                                value={mappingSearch}
                                onChange={(e) => setMappingSearch(e.target.value)}
                                className="pl-10 h-12 rounded-2xl bg-white border-none shadow-inner font-bold"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[550px] overflow-y-auto scrollbar-none">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow className="h-14">
                                    <TableHead className="px-10 py-4 font-black text-gray-800">اسم الموظف</TableHead>
                                    <TableHead className="font-black text-gray-800">رقم البصمة</TableHead>
                                    <TableHead className="font-black text-center text-gray-800">بداية الدوام</TableHead>
                                    <TableHead className="font-black text-center text-gray-800">نهاية الدوام</TableHead>
                                    <TableHead className="w-32 text-center font-black text-gray-800">الحالة</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employeesLoading ? (
                                    Array.from({length: 5}).map((_, i) => (
                                        <TableRow key={i}><TableCell colSpan={5} className="px-10 py-6"><Skeleton className="h-10 w-full rounded-2xl"/></TableCell></TableRow>
                                    ))
                                ) : filteredEmployees.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic font-bold">لا توجد سجلات للموظفين.</TableCell></TableRow>
                                ) : (
                                    filteredEmployees.map((emp) => {
                                        const current = editableData[emp.id!] || { employeeNumber: '', workStartTime: '', workEndTime: '' };
                                        const isChanged = emp.employeeNumber !== current.employeeNumber || (emp.workStartTime || '') !== current.workStartTime || (emp.workEndTime || '') !== current.workEndTime;
                                        const isFullTime = !current.workStartTime && !current.workEndTime;

                                        return (
                                            <TableRow key={emp.id} className={cn("hover:bg-primary/5 transition-colors h-20 border-b last:border-0", !isFullTime && "bg-sky-50/20")}>
                                                <TableCell className="px-10">
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-gray-800">{emp.fullName}</span>
                                                        <span className="text-[10px] text-muted-foreground font-bold">{emp.department}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Input 
                                                        value={current.employeeNumber} 
                                                        onChange={(e) => setEditableData(prev => ({...prev, [emp.id!]: { ...current, employeeNumber: e.target.value }}))}
                                                        className="font-mono font-black h-10 rounded-xl border-2 w-32 text-center text-primary"
                                                        placeholder="000"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input 
                                                        type="time"
                                                        value={current.workStartTime} 
                                                        onChange={(e) => setEditableData(prev => ({...prev, [emp.id!]: { ...current, workStartTime: e.target.value }}))}
                                                        className="font-mono h-10 rounded-xl border-2 w-32 mx-auto text-center"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input 
                                                        type="time"
                                                        value={current.workEndTime} 
                                                        onChange={(e) => setEditableData(prev => ({...prev, [emp.id!]: { ...current, workEndTime: e.target.value }}))}
                                                        className="font-mono h-10 rounded-xl border-2 w-32 mx-auto text-center"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center px-6">
                                                    {isChanged ? (
                                                        <Badge className="bg-orange-600 text-white font-black text-[9px] animate-pulse rounded-lg">بانتظار الحفظ</Badge>
                                                    ) : isFullTime ? (
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100 font-black text-[9px] rounded-lg">كامل (رسمي)</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-100 font-black text-[9px] rounded-lg">جزئي (مخصص)</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="justify-end border-t p-8 bg-muted/10">
                    <div className="flex-1 text-xs text-muted-foreground font-bold pr-4 flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" />
                        اترك حقول الوقت فارغة إذا كان الموظف يتبع الدوام الرسمي الكامل للمكتب.
                    </div>
                    <Button onClick={handleSaveMappingData} disabled={isSavingData} className="h-12 px-12 rounded-xl font-black text-lg gap-2 shadow-xl shadow-primary/20">
                        {isSavingData ? <Loader2 className="animate-spin h-5 w-5"/> : <Save className="h-5 w-5"/>}
                        حفظ كافة البيانات
                    </Button>
                </CardFooter>
            </Card>
        </TabsContent>
    </Tabs>
  );
}
