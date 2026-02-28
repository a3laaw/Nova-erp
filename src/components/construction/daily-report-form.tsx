
'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useFirebase, useStorage } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Camera, Save, X, Plus, AlertCircle } from 'lucide-react';
import Image from 'next/image';

interface DailyReportFormProps {
  projectId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DailyReportForm({ projectId, onSuccess, onCancel }: DailyReportFormProps) {
  const { firestore } = useFirebase();
  const storage = useStorage();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [workCompleted, setWorkCompleted] = useState('');
  const [workersCount, setWorkersCount] = useState('');
  const [issues, setIssues] = useState('');
  const [weather, setWeather] = useState('صافي');
  
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
      
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removePhoto = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !storage) return;

    if (!workCompleted || !workersCount) {
      toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى وصف العمل المنجز وعدد العمال.' });
      return;
    }

    setIsSaving(true);
    try {
      const photoUrls: string[] = [];
      
      // Upload photos
      for (const file of files) {
        const storageRef = ref(storage, `projects/${projectId}/daily_reports/${Date.now()}_${file.name}`);
        const uploadResult = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(uploadResult.ref);
        photoUrls.push(url);
      }

      const reportData = {
        projectId,
        date: serverTimestamp(),
        engineerId: user.id,
        engineerName: user.fullName,
        workCompleted,
        workersCount: parseInt(workersCount),
        encounteredIssues: issues,
        weatherStatus: weather,
        photoUrls,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(firestore, `projects/${projectId}/daily_reports`), reportData);
      
      toast({ title: 'تم الإرسال', description: 'تم حفظ تقرير الموقع اليومي بنجاح.' });
      onSuccess();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ التقرير.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-2 shadow-xl rounded-3xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500" dir="rtl">
      <CardHeader className="bg-primary/5 border-b pb-6">
        <CardTitle className="text-xl font-black flex items-center gap-2">
          <Camera className="text-primary" />
          تقرير موقع جديد
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="grid gap-2">
            <Label className="font-bold">حالة الطقس</Label>
            <Input value={weather} onChange={e => setWeather(e.target.value)} placeholder="مثال: غائم، حار، أمطار..." />
          </div>
          <div className="grid gap-2">
            <Label className="font-bold">عدد العمال في الموقع *</Label>
            <Input type="number" value={workersCount} onChange={e => setWorkersCount(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div className="grid gap-2">
          <Label className="font-bold">الأعمال المنجزة اليوم *</Label>
          <Textarea 
            value={workCompleted} 
            onChange={e => setWorkCompleted(e.target.value)} 
            placeholder="اشرح بالتفصيل ما تم تنفيذه اليوم من بنود..."
            rows={4}
          />
        </div>

        <div className="grid gap-2">
          <Label className="font-bold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            عقبات أو مشاكل واجهتكم
          </Label>
          <Textarea 
            value={issues} 
            onChange={e => setIssues(e.target.value)} 
            placeholder="نقص مواد، أعطال معدات، تأخير مقاولين..."
            rows={2}
          />
        </div>

        <div className="space-y-4">
          <Label className="font-bold">صور من الموقع</Label>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {previews.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border-2 border-primary/20 group">
                <Image src={url} alt="Site" fill className="object-cover" />
                <button 
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 left-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-primary/30 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-all text-primary"
            >
              <Plus className="h-6 w-6" />
              <span className="text-[10px] font-bold">إضافة صورة</span>
            </button>
          </div>
          <input type="file" multiple ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        </div>
      </CardContent>
      <CardFooter className="bg-muted/30 p-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={isSaving}>إلغاء</Button>
        <Button onClick={handleSubmit} disabled={isSaving} className="h-12 px-10 rounded-2xl font-black text-lg gap-2">
          {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
          حفظ وإرسال التقرير
        </Button>
      </CardFooter>
    </Card>
  );
}
