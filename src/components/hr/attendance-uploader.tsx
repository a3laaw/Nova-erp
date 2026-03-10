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
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Loader2, FileSpreadsheet, RotateCcw, CheckCircle2, Fingerprint, Save, Search, UserCheck } from 'lucide-react';
import type { Employee, MonthlyAttendance, AttendanceRecord } from '@/lib/types';
import { parse, format, isValid, startOfDay, eachDayOfInterval, startOfMonth, endOfMonth, getDay, setHours } from 'date-fns';
import { cleanFirestoreData, cn } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

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
  
  const [summary, setSummary] = useState<{ workingDays: number, totalPunches: number, autoAbsences: number } | null>(null);
  
  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mapping state
  const [editableNumbers, setEditableNumbers] = useState<Record<string, string>>({});
  const [isSavingNumbers, setIsSavingNumbers] = useState(false);
  const [mappingSearch, setMappingSearch] = useState('');

  useEffect(() => {
    if (employees.length > 0) {
        const numbers: Record<string, string> = {};
        employees.forEach(emp => {
            numbers[emp.id!] = emp.employeeNumber || '';
        });
        setEditableNumbers(numbers);
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

  const handleSaveNumbers = async () => {
    if (!firestore) return;
    setIsSavingNumbers(true);
    try {
        const batch = writeBatch(firestore);
        let count = 0;
        for (const id in editableNumbers) {
            const original = employees.find(e => e.id === id);
            if (original && original.employeeNumber !== editableNumbers[id]) {
                batch.update(doc(firestore, 'employees', id), { employeeNumber: editableNumbers[id] });
                count++;
            }
        }
        if (count > 0) {
            await batch.commit();
            toast({ title: 'تم التحديث', description: `تم تحديث أرقام البصمة لـ ${count} موظف بنجاح.` });
        } else {
            toast({ title: 'لا توجد تغييرات', description: 'لم يتم تعديل أي أرقام للحفظ.' });
        }
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ التغييرات.' });
    } finally {
        setIsSavingNumbers(false);
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

        const employeeMap = new Map(employees.map(emp => [String(emp.employeeNumber), emp]));
        const excelPunches = new Map<string, Set<string>>(); 
        let totalPunchesCount = 0;

        json.forEach(row => {
            const keys = Object.keys(row);
            let empNo = '';
            for(let k=0; k<Math.min(keys.length, 15); k++) {
                const val = String(row[keys[k]] || '').trim();
                if (employeeMap.has(val)) { empNo = val; break; }
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

        const monthStart = startOfMonth(new Date(selectedYearNum, selectedMonthNum - 1));
        const monthEnd = endOfMonth(monthStart);
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
        }

        const workHours = branding?.work_hours?.general;
        const mEnd = workHours?.morning_end_time || '13:00';
        const eStart = workHours?.evening_start_time || '16:00';

        let autoAbsencesCount = 0;

        for (const emp of employees) {
            const employeeRecords: AttendanceRecord[] = [];
            
            for (const day of workingDaysInMonth) {
                const stableDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0);
                const dateKey = `${emp.id}_${format(stableDay, 'yyyy-MM-dd')}`;
                const punches = excelPunches.get(dateKey);

                if (punches && punches.size > 0) {
                    const sortedTimes = Array.from(punches).sort();
                    let status: AttendanceRecord['status'] = 'present';
                    let anomaly = '';
                    let manualDeduction = 0;

                    const startTimeLimit = emp.workStartTime || workHours?.morning_start_time || '08:00';
                    if (sortedTimes[0] > startTimeLimit) {
                        status = 'late';
                        anomaly = `تأخير عن الموعد (${startTimeLimit})`;
                    } else {
                        const hasMorning = sortedTimes.some(t => t <= mEnd);
                        const hasEvening = sortedTimes.some(t => t >= eStart);

                        if (hasMorning && !hasEvening) {
                            status = 'half_day';
                            anomaly = 'بصمة صباحية فقط';
                            manualDeduction = 0.5;
                        } else if (!hasMorning && hasEvening) {
                            status = 'half_day';
                            anomaly = 'بصمة مسائية فقط';
                            manualDeduction = 0.5;
                        } else if (hasMorning && hasEvening && sortedTimes.length < 2) {
                            status = 'missing_punch';
                            anomaly = 'بصمة ناقصة';
                        }
                    }

                    employeeRecords.push({
                        date: Timestamp.fromDate(stableDay),
                        employeeId: emp.id!,
                        checkIn1: sortedTimes[0],
                        checkOut1: sortedTimes[sortedTimes.length - 1],
                        checkIn2: null, checkOut2: null,
                        allPunches: sortedTimes,
                        status,
                        anomalyDescription: anomaly,
                        manualDeductionDays: manualDeduction,
                        auditStatus: status === 'present' ? 'verified' : 'pending'
                    });
                } else {
                    autoAbsencesCount++;
                    employeeRecords.push({
                        date: Timestamp.fromDate(stableDay),
                        employeeId: emp.id!,
                        checkIn1: null, checkOut1: null, checkIn2: null, checkOut2: null,
                        allPunches: [],
                        status: 'absent',
                        anomalyDescription: 'غائب (لم تظهر بصمته في الملف)',
                        manualDeductionDays: 1,
                        auditStatus: 'pending'
                    });
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
        setSummary({ workingDays: workingDaysInMonth.length, totalPunches: totalPunchesCount, autoAbsences: autoAbsencesCount });
        toast({ title: 'نجاح المعالجة', description: `تم تحليل الشهر وإثبات ${autoAbsencesCount} غياب آلياً.` });
        setFile(null);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: error.message });
      } finally { setIsProcessing(false); }
    };
    reader.readAsBinaryString(file!);
  };

  return (
    <Tabs defaultValue="upload" dir="rtl" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-12 rounded-2xl bg-muted/50 p-1">
            <TabsTrigger value="upload" className="rounded-xl font-black gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                رفع ومعالجة الملف
            </TabsTrigger>
            <TabsTrigger value="mapping" className="rounded-xl font-black gap-2">
                <Fingerprint className="h-4 w-4" />
                مطابقة أرقام البصمة
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
                                <p className="text-[9px] text-red-600 font-bold leading-tight">مسح كافة البصمات القديمة المسجلة لهذا الشهر لضمان دقة الرقابة.</p>
                            </div>
                        </div>

                        {summary && (
                            <div className="p-4 bg-green-50 rounded-2xl border border-green-100 space-y-3 animate-in zoom-in-95">
                                <h4 className="font-black text-green-800 flex items-center gap-2 text-xs"><CheckCircle2 className="h-4 w-4"/> ملخص المعالجة الأخيرة:</h4>
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                                    <div className="bg-white p-2 rounded-lg border">أيام العمل: {summary.workingDays}</div>
                                    <div className="bg-white p-2 rounded-lg border">البصمات: {summary.totalPunches}</div>
                                    <div className="col-span-2 bg-red-600 text-white p-2 rounded-lg text-center">إثبات غياب آلي: {summary.autoAbsences} يوم</div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 rounded-[2.5rem] border-none shadow-xl">
                    <CardHeader>
                        <CardTitle className="font-black">رفع وتحليل ملف البصمة</CardTitle>
                        <CardDescription>ارفع ملف الإكسل ليقوم النظام بمطابقته مع أيام العمل الرسمية وكشف فجوات الغياب.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed rounded-[2.5rem] p-12 text-center cursor-pointer hover:bg-primary/5 transition-all bg-muted/30 group">
                            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".xlsx, .xls, .csv" />
                            <FileSpreadsheet className="h-16 w-16 mx-auto opacity-20 mb-4 group-hover:scale-110 transition-transform" />
                            <p className="font-black text-lg">{file ? file.name : "اضغط هنا لاختيار ملف الإكسل"}</p>
                            <p className="text-xs text-muted-foreground mt-2 font-bold leading-relaxed">
                                سيقوم النظام بمقارنة محتوى الملف مع التقويم الرسمي.<br/>
                                <span className="text-primary">أي موظف مفقود من الملف في يوم عمل سيُسجل "غائباً" آلياً.</span>
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
                                مطابقة أرقام البصمة للموظفين
                            </CardTitle>
                            <CardDescription>قم بتعديل الرقم الوظيفي ليتطابق مع "رقم المستخدم" الموجود في جهاز البصمة لديك.</CardDescription>
                        </div>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="بحث بالاسم أو الرقم..." 
                                value={mappingSearch}
                                onChange={(e) => setMappingSearch(e.target.value)}
                                className="pl-10 h-11 rounded-xl bg-white border-none shadow-inner"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[500px] overflow-y-auto">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="px-8 py-4 font-black">اسم الموظف</TableHead>
                                    <TableHead className="font-black">القسم</TableHead>
                                    <TableHead className="w-48 font-black">رقم البصمة (المعرف الخارجي)</TableHead>
                                    <TableHead className="w-32 text-center font-black">الحالة</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employeesLoading ? (
                                    Array.from({length: 5}).map((_, i) => (
                                        <TableRow key={i}><TableCell colSpan={4} className="p-4"><Skeleton className="h-10 w-full rounded-lg"/></TableCell></TableRow>
                                    ))
                                ) : filteredEmployees.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic">لا توجد سجلات للموظفين.</TableCell></TableRow>
                                ) : (
                                    filteredEmployees.map((emp) => (
                                        <TableRow key={emp.id} className="hover:bg-muted/30">
                                            <TableCell className="px-8 font-bold">{emp.fullName}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground font-medium">{emp.department}</TableCell>
                                            <TableCell>
                                                <Input 
                                                    value={editableNumbers[emp.id!] || ''} 
                                                    onChange={(e) => setEditableNumbers(prev => ({...prev, [emp.id!]: e.target.value}))}
                                                    className="font-mono h-9 rounded-lg border-2 focus:border-primary"
                                                    placeholder="أدخل الرقم..."
                                                />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {emp.employeeNumber === editableNumbers[emp.id!] ? (
                                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100 text-[9px] font-black">
                                                        <UserCheck className="h-2.5 w-2.5 ml-1"/> متوافق
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 text-[9px] font-black animate-pulse">
                                                        بانتظار الحفظ
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="justify-end border-t p-6 bg-muted/10">
                    <Button onClick={handleSaveNumbers} disabled={isSavingNumbers} className="h-12 px-10 rounded-xl font-black text-lg gap-2 shadow-xl shadow-primary/20">
                        {isSavingNumbers ? <Loader2 className="animate-spin h-5 w-5"/> : <Save className="h-5 w-5"/>}
                        حفظ كافة التغييرات
                    </Button>
                </CardFooter>
            </Card>
        </TabsContent>
    </Tabs>
  );
}
