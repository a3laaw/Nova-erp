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
import { Loader2, Save, ImageIcon, User, Briefcase, Sparkles, Camera, Mail, AtSign, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * ملف التعريف المهني (Professional Profile):
 * تم تحصينه بـ "رادار أخطاء الرفع" وتوحيد الهوية البصرية البرتقالية الحية.
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
        if (!firestore || !user?.id) return;

        setIsSaving(true);
        try {
            let finalAvatarUrl = formData.avatarUrl;

            // 1. محرك الرفع السحابي (Cloud Storage Engine)
            if (profileFile && storage) {
                const storagePath = `companies/${tenantId || 'master'}/users/${user.id}/avatar_${Date.now()}`;
                const storageRef = ref(storage, storagePath);
                
                try {
                    const uploadResult = await uploadBytes(storageRef, profileFile);
                    finalAvatarUrl = await getDownloadURL(uploadResult.ref);
                } catch (storageErr: any) {
                    // رصد خطأ الصلاحيات وإطلاقه للرادار
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: `[STORAGE] ${storagePath}`,
                        operation: 'write',
                        requestResourceData: { fileName: profileFile.name, type: profileFile.type, size: profileFile.size }
                    }));
                    throw new Error("عائق في قواعد الأمان السحابية.");
                }
            }

            // 2. محرك تحديث المستند (Firestore Sync)
            const isDev = user.role === 'Developer';
            const userPath = isDev ? `developers/${user.id}` : getTenantPath(`users/${user.id}`, tenantId);
            const userRef = doc(firestore, userPath);

            const updateData = {
                fullName: formData.fullName,
                jobTitle: formData.jobTitle,
                bio: formData.bio,
                avatarUrl: finalAvatarUrl,
                updatedAt: serverTimestamp()
            };

            const safeData = cleanFirestoreData(updateData);

            await updateDoc(userRef, safeData).catch(async (err) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: userPath,
                    operation: 'update',
                    requestResourceData: safeData
                }));
                throw err;
            });

            await refreshToken();
            toast({ title: '✅ تم الحفظ بنجاح', description: 'تم تحديث ملفك الشخصي بنجاح.' });
            setProfileFile(null);
            setPreview(null);
            setFormData(prev => ({ ...prev, avatarUrl: finalAvatarUrl }));

        } catch (error: any) {
            console.error("Profile Save Failure:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700" dir="rtl">
            <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl border-4 border-white">
                <CardHeader className="p-10 pb-8 bg-gradient-to-r from-[#FFB000] to-[#FF7A00] text-white relative">
                    <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
                    <div className="flex items-center gap-8 relative z-10">
                        <div className="relative group">
                            <div className="w-36 h-36 rounded-[3rem] border-4 border-white shadow-2xl overflow-hidden bg-white/20 flex items-center justify-center transition-transform hover:scale-105 duration-500">
                                {preview || formData.avatarUrl ? (
                                    <Image src={preview || formData.avatarUrl} alt="Avatar" fill className="object-cover" unoptimized />
                                ) : (
                                    <User className="h-16 w-16 opacity-30" />
                                )}
                            </div>
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute -bottom-2 -left-2 p-3 bg-white text-primary rounded-2xl shadow-xl border-2 border-primary/10 hover:scale-110 active:scale-95 transition-all"
                                title="تغيير الصورة"
                            >
                                <Camera className="h-5 w-5" />
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                        </div>
                        <div className="text-right flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-4xl font-black text-white tracking-tighter drop-shadow-lg">{user?.fullName}</CardTitle>
                                <Badge variant="outline" className="text-white border-white/40 font-black bg-white/10 px-4 h-6 rounded-full">{user?.role}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-4 text-white/80">
                                <span className="flex items-center gap-1.5 text-xs font-bold"><AtSign className="h-3 w-3" /> @{user?.username}</span>
                                <span className="flex items-center gap-1.5 text-xs font-bold"><Mail className="h-3 w-3" /> {user?.email}</span>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-12 space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="grid gap-3">
                            <Label className="font-black text-[10px] uppercase text-slate-400 tracking-[0.2em] pr-2">الاسم المهني المعتمد</Label>
                            <Input 
                                value={formData.fullName} 
                                onChange={e => setFormData({...formData, fullName: e.target.value})} 
                                className="h-14 rounded-2xl border-2 bg-slate-50/50 shadow-inner font-black text-xl px-6 focus:bg-white"
                                placeholder="أدخل اسمك الكامل..."
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label className="font-black text-[10px] uppercase text-slate-400 tracking-[0.2em] pr-2">المسمى الوظيفي الحالي</Label>
                            <Input 
                                value={formData.jobTitle} 
                                onChange={e => setFormData({...formData, jobTitle: e.target.value})} 
                                className="h-14 rounded-2xl border-2 bg-slate-50/50 shadow-inner font-bold text-lg px-6 focus:bg-white"
                                placeholder="مثال: مهندس معماري أول..."
                            />
                        </div>
                    </div>

                    <Separator className="opacity-10" />

                    <div className="space-y-4">
                        <div className="flex justify-between items-center pr-2">
                            <Label className="font-black text-xl flex items-center gap-3 text-[#1e1b4b]">
                                <Sparkles className="h-6 w-6 text-primary animate-pulse" /> السيرة المهنية والخبرات
                            </Label>
                        </div>
                        <div className="p-6 bg-primary/5 rounded-[2.5rem] border-2 border-dashed border-primary/10 shadow-inner group hover:bg-white transition-all duration-500">
                            <Textarea 
                                value={formData.bio} 
                                onChange={e => setFormData({...formData, bio: e.target.value})}
                                placeholder="اكتب هنا عن تاريخك المهني..."
                                rows={10}
                                className="border-none bg-transparent shadow-none focus-visible:ring-0 text-xl leading-loose font-medium text-slate-700 placeholder:italic placeholder:opacity-30"
                            />
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="p-10 border-t bg-muted/10 flex justify-end gap-4">
                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving} 
                        className="h-16 px-20 rounded-[2rem] font-black text-2xl shadow-xl shadow-primary/30 min-w-[380px] gap-4 transition-all hover:scale-[1.02] active:scale-95 bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white border-none"
                    >
                        {isSaving ? <Loader2 className="animate-spin h-8 w-8" /> : <Save className="h-8 w-8" />}
                        {isSaving ? 'جاري ترحيل البيانات...' : 'اعتماد وحفظ الملف'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
