'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useFirebase } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { 
    Loader2, Save, ImageIcon, User, Briefcase, 
    Sparkles, Camera, Mail, AtSign, ShieldCheck, 
    BadgeCheck, Globe, History, Clock
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { cleanFirestoreData, getTenantPath, cn } from '@/lib/utils';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * ملف التعريف المهني (Professional Profile V8.0):
 * - تم إحكام الهوية البصرية البرتقالية لتسيطر على المشهد بالكامل.
 * - عزل كامل لأخطاء الرفع السحابي (Cloud Storage) وربطها بالرادار.
 * - تحسين استقرار الحفظ للمطورين والموظفين.
 */
export function ProfileManager() {
    const { firestore, storage } = useFirebase();
    const { user, refreshToken } = useAuth();
    const { toast } = useToast();
    
    const [formData, setFormData] = useState({
        fullName: user?.fullName || '',
        jobTitle: user?.jobTitle || '',
        bio: user?.bio || '',
        avatarUrl: user?.avatarUrl || '',
    });

    const [profileFile, setProfileFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            setFormData({
                fullName: user.fullName || '',
                jobTitle: user.jobTitle || '',
                bio: user.bio || '',
                avatarUrl: user.avatarUrl || '',
            });
        }
    }, [user]);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setPreview(URL.createObjectURL(file));
            setProfileFile(file);
        }
    };

    const handleSave = async () => {
        const tenantId = user?.currentCompanyId;
        if (!firestore || !user?.id) {
            toast({ variant: 'destructive', title: 'خطأ في الجلسة', description: 'يرجى إعادة تسجيل الدخول.' });
            return;
        }

        setIsSaving(true);
        try {
            let finalAvatarUrl = formData.avatarUrl;

            // 1. محرك الرفع السحابي (Cloud Storage Logic)
            if (profileFile && storage) {
                // مسار معزول للصور: companies/{id}/users/{uid}/avatar_timestamp
                const storagePath = `companies/${tenantId || 'master'}/users/${user.id}/avatar_${Date.now()}`;
                const storageRef = ref(storage, storagePath);
                
                try {
                    const uploadResult = await uploadBytes(storageRef, profileFile);
                    finalAvatarUrl = await getDownloadURL(uploadResult.ref);
                } catch (storageErr: any) {
                    // رصد خطأ الصلاحيات السحابية وإطلاقه للرادار (FirebaseErrorListener)
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: `[STORAGE] ${storagePath}`,
                        operation: 'write',
                        requestResourceData: { fileName: profileFile.name, type: profileFile.type, size: profileFile.size }
                    }));
                    throw new Error("قواعد أمان جوجل ترفض رفع الملف. يرجى مراجعة الصلاحيات.");
                }
            }

            // 2. محرك تحديث المستند (Firestore Sync)
            const isDev = user.role === 'Developer';
            const userPath = isDev ? `developers/${user.id}` : getTenantPath(`users/${user.id}`, tenantId);
            const userRef = doc(firestore, userPath);

            const updateData = cleanFirestoreData({
                fullName: formData.fullName,
                jobTitle: formData.jobTitle,
                bio: formData.bio,
                avatarUrl: finalAvatarUrl,
                updatedAt: serverTimestamp()
            });

            await updateDoc(userRef, updateData).catch(async (err) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: userPath,
                    operation: 'update',
                    requestResourceData: updateData
                }));
                throw err;
            });

            await refreshToken();
            toast({ title: '✅ تم الحفظ بنجاح', description: 'تم تحديث هويتك الرقمية في المنظومة.' });
            setProfileFile(null);
            setPreview(null);
            setFormData(prev => ({ ...prev, avatarUrl: finalAvatarUrl }));

        } catch (error: any) {
            console.error("Profile Save Failure:", error);
            // لا حاجة لـ toast هنا لأن errorEmitter يتولى التنبيه التقني
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-1000" dir="rtl">
            {/* بطاقة الهيدر الملكية */}
            <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-white/80 backdrop-blur-3xl border-4 border-white active-glow">
                <CardHeader className="p-10 pb-10 bg-gradient-to-br from-[#FFB000] to-[#FF7A00] text-white relative">
                    <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
                    <div className="flex flex-col sm:flex-row items-center gap-10 relative z-10">
                        <div className="relative group">
                            <div className="w-40 h-40 rounded-[3.5rem] border-8 border-white/30 shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden bg-white/20 flex items-center justify-center transition-all duration-500 group-hover:scale-105 group-hover:rotate-3">
                                {preview || formData.avatarUrl ? (
                                    <Image src={preview || formData.avatarUrl} alt="Avatar" fill className="object-cover" unoptimized />
                                ) : (
                                    <User className="h-20 w-20 opacity-30 text-white" />
                                )}
                            </div>
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute -bottom-2 -left-2 p-4 bg-white text-[#FF7A00] rounded-[1.5rem] shadow-2xl border-4 border-orange-50 hover:scale-110 active:scale-90 transition-all z-20"
                                title="تغيير الصورة"
                            >
                                <Camera className="h-6 w-6" />
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                        </div>
                        
                        <div className="text-center sm:text-right flex-1 space-y-3">
                            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center sm:justify-start">
                                <CardTitle className="text-5xl font-black tracking-tighter drop-shadow-2xl">{user?.fullName || 'موظف جديد'}</CardTitle>
                                <Badge variant="outline" className="text-white border-white/40 font-black bg-white/10 px-6 h-7 rounded-full text-xs uppercase tracking-widest">{user?.role}</Badge>
                            </div>
                            <div className="flex flex-wrap justify-center sm:justify-start gap-6 text-white/80">
                                <span className="flex items-center gap-2 text-sm font-bold bg-black/10 px-4 py-1.5 rounded-2xl backdrop-blur-sm"><AtSign className="h-4 w-4 text-orange-200" /> @{user?.username}</span>
                                <span className="flex items-center gap-2 text-sm font-bold bg-black/10 px-4 py-1.5 rounded-2xl backdrop-blur-sm"><Mail className="h-4 w-4 text-orange-200" /> {user?.email}</span>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-12 space-y-12 bg-gradient-to-b from-transparent to-orange-50/10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="grid gap-3 group">
                            <Label className="font-black text-xs uppercase text-slate-400 tracking-[0.3em] pr-3 transition-colors group-focus-within:text-[#FF7A00]">الاسم المهني المعتمد</Label>
                            <div className="relative">
                                <User className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                                <Input 
                                    value={formData.fullName} 
                                    onChange={e => setFormData({...formData, fullName: e.target.value})} 
                                    className="h-16 rounded-[1.5rem] border-2 border-slate-100 bg-slate-50/50 shadow-inner font-black text-2xl pr-14 focus:bg-white focus:border-[#FF7A00]/30 transition-all"
                                    placeholder="أدخل اسمك الثلاثي..."
                                />
                            </div>
                        </div>
                        <div className="grid gap-3 group">
                            <Label className="font-black text-xs uppercase text-slate-400 tracking-[0.3em] pr-3 transition-colors group-focus-within:text-[#FF7A00]">المسمى الوظيفي</Label>
                            <div className="relative">
                                <Briefcase className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                                <Input 
                                    value={formData.jobTitle} 
                                    onChange={e => setFormData({...formData, jobTitle: e.target.value})} 
                                    className="h-16 rounded-[1.5rem] border-2 border-slate-100 bg-slate-50/50 shadow-inner font-bold text-xl pr-14 focus:bg-white focus:border-[#FF7A00]/30 transition-all text-slate-700"
                                    placeholder="مثال: مهندس معماري أول..."
                                />
                            </div>
                        </div>
                    </div>

                    <Separator className="opacity-10" />

                    <div className="space-y-4">
                        <div className="flex justify-between items-center pr-3">
                            <Label className="font-black text-2xl flex items-center gap-3 text-[#1e1b4b]">
                                <Sparkles className="h-7 w-7 text-[#FF7A00] animate-pulse" /> النبذة المهنية والخبرات
                            </Label>
                            <Badge variant="secondary" className="bg-orange-100 text-[#FF7A00] border-none font-black px-4">Bio / Portfolio</Badge>
                        </div>
                        <div className="p-8 bg-white rounded-[2.5rem] border-2 border-dashed border-orange-200 shadow-inner group hover:shadow-2xl hover:border-orange-400 transition-all duration-700">
                            <Textarea 
                                value={formData.bio} 
                                onChange={e => setFormData({...formData, bio: e.target.value})}
                                placeholder="صف مسيرتك المهنية، مهاراتك، وإنجازاتك في الشركة..."
                                rows={8}
                                className="border-none bg-transparent shadow-none focus-visible:ring-0 text-xl leading-relaxed font-medium text-slate-700 placeholder:italic placeholder:opacity-30"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
                        <div className="p-6 bg-slate-50 rounded-3xl border-2 border-white shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-white rounded-2xl shadow-md"><BadgeCheck className="h-6 w-6 text-green-600"/></div>
                            <div><p className="text-[10px] font-black text-slate-400 uppercase">حالة الحساب</p><p className="font-black text-sm text-green-700">مفعل ونشط</p></div>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-3xl border-2 border-white shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-white rounded-2xl shadow-md"><ShieldCheck className="h-6 w-6 text-blue-600"/></div>
                            <div><p className="text-[10px] font-black text-slate-400 uppercase">رتبة الدخول</p><p className="font-black text-sm text-blue-700">{user?.role}</p></div>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-3xl border-2 border-white shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-white rounded-2xl shadow-md"><History className="h-6 w-6 text-orange-600"/></div>
                            <div><p className="text-[10px] font-black text-slate-400 uppercase">عضو منذ</p><p className="font-black text-sm text-orange-700">2026</p></div>
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="p-10 border-t bg-muted/10 flex justify-end gap-6">
                    <div className="hidden lg:flex items-center gap-3 ml-auto opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                        <Clock className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Nova Professional System v8.0</span>
                    </div>
                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving} 
                        className="h-16 px-20 rounded-[2.2rem] font-black text-2xl shadow-2xl shadow-orange-500/30 min-w-[400px] gap-4 transition-all hover:scale-[1.03] active:scale-95 bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white border-none"
                    >
                        {isSaving ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
                        <span>اعتماد وحفظ الملف</span>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}