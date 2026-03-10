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
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp, Timestamp, getDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Loader2, FileSpreadsheet, RotateCcw, CheckCircle2, Fingerprint, Save, Search, UserCheck, Clock, ShieldCheck, BadgeInfo, X, Info } from 'lucide-react';
import type { Employee, MonthlyAttendance, AttendanceRecord, LeaveRequest, PermissionRequest } from '@/lib/types';
import { parse, format, isValid, startOfDay, eachDayOfInterval, startOfMonth, endOfMonth, getDay, isWithinInterval } from 'date-fns';
import { cleanFirestoreData, cn } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toFirestoreDate } from '@/services/date-converter';

const dayNameToIndex: Record<string, number> = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6
};

const parseSmartDateTime = (val: any, targetMonth: number, targetYear: number): { date: Date, timeStr: string } | null => {
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
                if (isValid(p) && p.getFullYear() >= 2000) {
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
        if (parsedDate.getFullYear() === targetYear && (parsedDate.getMonth() + 1) === targetMonth) {
            return { date: parsedDate, timeStr };
        }
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
        
        if (json.length === 0) throw new Error("الملف المرفوع فارغ.");

        // 1. جلب كافة الإجازات والاستئذانات المعتمدة للشهر المختار
        const monthStart = startOfMonth(new Date(selectedYearNum, selectedMonthNum - 1));
        const monthEnd = endOfMonth(monthStart);

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
                const parsed = parseSmartDateTime(row[key], selectedMonthNum, selectedYearNum);
                if (parsed) {
                    const dateKey = `${emp.id}_${format(parsed.date, 'yyyy-MM-dd')}`;
                    if (!excelPunches.has(dateKey)) excelPunches.set(dateKey, new Set());
                    if (parsed.timeStr && parsed.timeStr !== "00:00") {
                        excelPunches.get(dateKey)!.add(parsed.timeStr);
                        totalPunchesCount++;
                    }
                }
            }
        });

        const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const holidayIndexes = new Set((branding?.work_hours?.holidays || []).map(h => dayNameToIndex[h]));
        const halfDaySettings = branding?.work_hours?.half_day;
        const halfDayIndex = halfDaySettings?.day ? dayNameToIndex[halfDaySettings.day] : -1;

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
        }

        const workHours = branding?.work_hours?.general;
        const mEnd = workHours?.morning_end_time || '13:00';
        const eStart = workHours?.evening_start_time || '16:00';

        let autoAbsencesCount = 0;
        let coveredByPolicyCount = 0;

        for (const emp of validEmployees) {
            const employeeRecords: AttendanceRecord[] = [];
            
            for (const day of workingDaysInMonth) {
                const dayIdx = getDay(day);
                const isSystemHalfDay = dayIdx === halfDayIndex;
                
                const stableDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0);
                const dateKey = `${emp.id}_${format(stableDay, 'yyyy-MM-dd')}`;
                const punches = excelPunches.get(dateKey);

                // فحص الإجازات والاستئذانات لهذا اليوم
                // تشمل كافة الأنواع: سنوية، مرضية، طارئة، بدون أجر
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
                    const isCustomShift = !!emp.workStartTime && !!emp.workEndTime;

                    // منطق التأخير الصباحي + الاستئذان
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

                    // منطق الدوام المزدوج / نصف اليوم + الاستئذان
                    if (!isCustomShift && !isSystemHalfDay) {
                        const hasMorning = sortedTimes.some(t => t <= mEnd);
                        const hasEvening = sortedTimes.some(t => t >= eStart);

                        if (hasMorning && !hasEvening) {
                            if (activePermission?.type === 'early_departure') {
                                status = 'present';
                                anomaly = anomaly ? `${anomaly} + خروج مسموح (إذن خروج)` : 'خروج مسموح (إذن خروج)';
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
                    // لم توجد بصمة: فحص ما إذا كان في إجازة (سنوية، طارئة، مرضية، إلخ)
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
        setSummary({ workingDays: workingDaysInMonth.length, totalPunches: totalPunchesCount, autoAbsences: autoAbsencesCount, coveredByPolicy: coveredByPolicyCount });
        toast({ title: 'نجاح المعالجة', description: `تم تحليل الشهر وإثبات ${autoAbsencesCount} غياب، وتغطية ${coveredByPolicyCount} حالة بسياسات الإجازات.` });
        setFile(null);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: error.message });
      } finally { setIsProcessing(false); }
    };
    reader.readAsBinaryString(file!);
  };

  const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  const leaveTypeTranslations: any = { 'Annual': 'سنوية', 'Sick': 'مرضية', 'Emergency': 'طارئة', 'Unpaid': 'بدون أجر' };

  return (
    <Tabs defaultValue="upload" dir="rtl" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-12 rounded-2xl bg-muted/50 p-1">
            <TabsTrigger value="upload" className="rounded-xl font-black gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                رفع ومعالجة الملف
            </TabsTrigger>
            <TabsTrigger value="mapping" className="rounded-xl font-black gap-2">
                <Fingerprint className="h-4 w-4" />
                مطابقة البصمة والدوام
            </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
            <div className="grid lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1 rounded-[2.5rem] border-none shadow-sm">
                    <CardHeader><CardTitle className="text-lg font-black">فترة التقرير والرقابة</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-2">
                            <Label className="font-bold">السنة</Label>
                            <Select value={year} onValueChange={setYear}>
                                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl">{[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold">الشهر</Label>
                            <Select value={month} onValueChange={setMonth}>
                                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl">{Array.from({length:12}, (_,i)=>i+1).map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        
                        <Separator />

                        <div className="flex items-center gap-3 p-4 bg-red-50/50 rounded-2xl border border-red-100 animate-in fade-in">
                            <Checkbox id="purge" checked={clearPrevious} onCheckedChange={(c) => setClearPrevious(!!c)} />
                            <div className="space-y-0.5">
                                <Label htmlFor="purge" className="font-black text-xs text-red-800 cursor-pointer">تطهير البيانات السابقة</Label>
                                <p className="text-[9px] text-red-600 font-bold leading-tight">مساحة كافة البصمات القديمة المسجلة لهذا الشهر لضمان دقة الرقابة.</p>
                            </div>
                        </div>

                        {summary && (
                            <div className="p-4 bg-green-50 rounded-2xl border border-green-100 space-y-3 animate-in zoom-in-95">
                                <h4 className="font-black text-green-800 flex items-center gap-2 text-xs"><CheckCircle2 className="h-4 w-4"/> ملخص المعالجة الأخيرة:</h4>
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                                    <div className="bg-white p-2 rounded-lg border">أيام العمل: {summary.workingDays}</div>
                                    <div className="bg-white p-2 rounded-lg border">البصمات: {summary.totalPunches}</div>
                                    <div className="bg-blue-600 text-white p-2 rounded-lg text-center">إجازات/إذونات: {summary.coveredByPolicy}</div>
                                    <div className="bg-red-600 text-white p-2 rounded-lg text-center">إثبات غياب: {summary.autoAbsences}</div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 rounded-[2.5rem] border-none shadow-xl">
                    <CardHeader>
                        <CardTitle className="font-black">رفع وتحليل ملف البصمة</CardTitle>
                        <CardDescription>ارفع ملف الإكسل ليقوم النظام بمطابقته مع الإجازات والاستئذانات وكشف فجوات الحضور.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed rounded-[2.5rem] p-12 text-center cursor-pointer hover:bg-primary/5 transition-all bg-muted/30 group">
                            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".xlsx, .xls, .csv" />
                            <FileSpreadsheet className="h-16 w-16 mx-auto opacity-20 mb-4 group-hover:scale-110 transition-transform" />
                            <p className="font-black text-lg">{file ? file.name : "اضغط هنا لاختيار ملف الإكسل"}</p>
                            <p className="text-xs text-muted-foreground mt-2 font-bold leading-relaxed">
                                سيقوم النظام بمقارنة محتوى الملف مع سجلات الإجازات والاستئذانات المعتمدة آلياً.<br/>
                                <span className="text-primary font-black">الموظف الحاصل على إجازة مرضية أو إذن تأخير سيتم استثناؤه من الخصم فوراً.</span>
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="justify-end border-t p-6">
                        <Button onClick={handleUpload} disabled={!file || isProcessing} className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 gap-3">
                            {isProcessing ? <Loader2 className="animate-spin h-6 w-6"/> : <RotateCcw className="h-6 w-6"/>} 
                            بدء المعالجة الرقابية الشاملة
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="mapping">
            <Card className="rounded-[2.5rem] border-none shadow-xl">
                <CardHeader className="bg-primary/5 pb-8 border-b">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black flex items-center gap-3">
                                <Fingerprint className="text-primary h-7 w-7" />
                                مطابقة البصمة والدوام
                            </CardTitle>
                            <CardDescription>تحديد أرقام البصمة وساعات الدوام الخاصة لكل موظف.</CardDescription>
                        </div>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="بحث بالاسم أو الرقم..." 
                                value={mappingSearch}
                                onChange={(e) => setMappingSearch(e.target.value)}
                                className="pl-10 h-11 rounded-xl bg-white border-none shadow-inner font-bold"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[550px] overflow-y-auto">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="px-8 py-4 font-black">اسم الموظف</TableHead>
                                    <TableHead className="font-black">رقم البصمة</TableHead>
                                    <TableHead className="font-black text-center">بداية الدوام</TableHead>
                                    <TableHead className="font-black text-center">نهاية الدوام</TableHead>
                                    <TableHead className="w-32 text-center font-black">الحالة</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employeesLoading ? (
                                    Array.from({length: 5}).map((_, i) => (
                                        <TableRow key={i}><TableCell colSpan={5} className="p-4"><Skeleton className="h-10 w-full rounded-lg"/></TableCell></TableRow>
                                    ))
                                ) : filteredEmployees.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic">لا توجد سجلات للموظفين.</TableCell></TableRow>
                                ) : (
                                    filteredEmployees.map((emp) => {
                                        const current = editableData[emp.id!] || { employeeNumber: '', workStartTime: '', workEndTime: '' };
                                        const isChanged = emp.employeeNumber !== current.employeeNumber || (emp.workStartTime || '') !== current.workStartTime || (emp.workEndTime || '') !== current.workEndTime;
                                        const isFullTime = !current.workStartTime && !current.workEndTime;

                                        return (
                                            <TableRow key={emp.id} className={cn("hover:bg-muted/30 transition-colors h-16", isFullTime ? "bg-white" : "bg-sky-50/20")}>
                                                <TableCell className="px-8">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{emp.fullName}</span>
                                                        <span className="text-[9px] text-muted-foreground font-bold">{emp.department}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Input 
                                                        value={current.employeeNumber} 
                                                        onChange={(e) => setEditableData(prev => ({...prev, [emp.id!]: { ...current, employeeNumber: e.target.value }}))}
                                                        className="font-mono h-9 rounded-lg border-2 w-28 text-center"
                                                        placeholder="000"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input 
                                                        type="time"
                                                        value={current.workStartTime} 
                                                        onChange={(e) => setEditableData(prev => ({...prev, [emp.id!]: { ...current, workStartTime: e.target.value }}))}
                                                        className="font-mono h-9 rounded-lg border-2 w-32 mx-auto text-center"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input 
                                                        type="time"
                                                        value={current.workEndTime} 
                                                        onChange={(e) => setEditableData(prev => ({...prev, [emp.id!]: { ...current, workEndTime: e.target.value }}))}
                                                        className="font-mono h-9 rounded-lg border-2 w-32 mx-auto text-center"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {isChanged ? (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 text-[9px] font-black animate-pulse">
                                                            بانتظار الحفظ
                                                        </Badge>
                                                    ) : isFullTime ? (
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100 text-[9px] font-black">
                                                            كامل (رسمي)
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-100 text-[9px] font-black">
                                                            جزئي (مخصص)
                                                        </Badge>
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
                <CardFooter className="justify-end border-t p-6 bg-muted/10">
                    <div className="flex-1 text-xs text-muted-foreground font-medium pr-4">
                        <Info className="h-3 w-3 inline ml-1" />
                        اترك حقول الوقت فارغة إذا كان الموظف يتبع الدوام الرسمي الكامل للمكتب.
                    </div>
                    <Button onClick={handleSaveMappingData} disabled={isSavingData} className="h-12 px-10 rounded-xl font-black text-lg gap-2 shadow-xl shadow-primary/20">
                        {isSavingData ? <Loader2 className="animate-spin h-5 w-5"/> : <Save className="h-5 w-5"/>}
                        حفظ كافة التغييرات
                    </Button>
                </CardFooter>
            </Card>
        </TabsContent>
    </Tabs>
  );
}
