'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFirebase } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, ImageIcon, User, Briefcase, Sparkles, Camera } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

/**
 * الملف المهني للموظف (Professional Portfolio):
 * مساحة خاصة للموظف لإدارة صورته وخبراته بهوية بصرية ذهبية.
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

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setPreview(URL.createObjectURL(file));
            setProfileFile(file);
        }
    };

    const handleSave = async () => {
        const tenantId = user?.currentCompanyId;
        if (!firestore || !tenantId || !user?.id) return;

        setIsSaving(true);
        try {
            let finalAvatarUrl = formData.avatarUrl;

            if (profileFile && storage) {
                const storageRef = ref(storage, `companies/${tenantId}/users/${user.id}/avatar_${Date.now()}`);
                const uploadResult = await uploadBytes(storageRef, profileFile);
                finalAvatarUrl = await getDownloadURL(uploadResult.ref);
            }

            const userPath = getTenantPath(`users/${user.id}`, tenantId);
            const userRef = doc(firestore, userPath);

            await updateDoc(userRef, cleanFirestoreData({
                fullName: formData.fullName,
                jobTitle: formData.jobTitle,
                bio: formData.bio,
                avatarUrl: finalAvatarUrl,
                updatedAt: serverTimestamp()
            }));

            await refreshToken();
            toast({ title: '✅ تم تحديث الملف بنجاح', description: 'تظهر بياناتك الجديدة الآن لجميع الزملاء.' });
            setProfileFile(null);
            setPreview(null);
            setFormData(prev => ({ ...prev, avatarUrl: finalAvatarUrl }));

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8" dir="rtl">
            <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/70 backdrop-blur-xl">
                <CardHeader className="p-10 pb-8 bg-gradient-to-r from-[#FFB000] to-[#FF7A00] text-white">
                    <div className="flex items-center gap-6">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-[2.5rem] border-4 border-white shadow-2xl overflow-hidden bg-white/20 flex items-center justify-center transition-transform hover:scale-105 duration-500">
                                {preview || formData.avatarUrl ? (
                                    <Image src={preview || formData.avatarUrl} alt="Avatar" fill className="object-cover" unoptimized />
                                ) : (
                                    <User className="h-16 w-16 opacity-30" />
                                )}
                            </div>
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute -bottom-2 -left-2 p-2.5 bg-white text-primary rounded-2xl shadow-xl border-2 border-primary/10 hover:scale-110 active:scale-95"
                            >
                                <Camera className="h-5 w-5" />
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                        </div>
                        <div className="text-right flex-1">
                            <CardTitle className="text-3xl font-black text-white">{user?.fullName}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-white border-white/40 font-bold bg-white/10">{user?.role}</Badge>
                                <span className="text-white/70 font-mono text-sm">@{user?.username}</span>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-10 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="grid gap-3">
                            <Label className="font-black text-[10px] uppercase text-muted-foreground tracking-widest pr-1">الاسم الكامل المعتمد</Label>
                            <Input 
                                value={formData.fullName} 
                                onChange={e => setFormData({...formData, fullName: e.target.value})} 
                                className="h-12 rounded-2xl border-2 bg-slate-50 shadow-inner font-black text-lg"
                                placeholder="أدخل اسمك الكامل..."
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label className="font-black text-[10px] uppercase text-muted-foreground tracking-widest pr-1">المسمى الوظيفي</Label>
                            <Input 
                                value={formData.jobTitle} 
                                onChange={e => setFormData({...formData, jobTitle: e.target.value})} 
                                className="h-12 rounded-2xl border-2 bg-slate-50 shadow-inner font-bold"
                                placeholder="مثال: مهندس معماري أول..."
                            />
                        </div>
                    </div>

                    <Separator className="opacity-10" />

                    <div className="space-y-4">
                        <Label className="font-black text-lg flex items-center gap-2 text-primary">
                            <Sparkles className="h-5 w-5" /> السيرة المهنية والخبرات
                        </Label>
                        <div className="p-4 bg-primary/5 rounded-[2rem] border-2 border-dashed border-primary/10 shadow-inner">
                            <Textarea 
                                value={formData.bio} 
                                onChange={e => setFormData({...formData, bio: e.target.value})}
                                placeholder="اكتب هنا عن تاريخك المهني وإنجازاتك..."
                                rows={8}
                                className="border-none bg-transparent shadow-none focus-visible:ring-0 text-lg leading-loose font-medium"
                            />
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="p-10 border-t bg-muted/10 flex justify-end">
                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving} 
                        className="h-14 px-20 rounded-[2.5rem] font-black text-xl shadow-xl shadow-primary/30 min-w-[320px] gap-3"
                    >
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                        {isSaving ? 'جاري الحفظ...' : 'حفظ الملف الشخصي'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <div className="p-4 sm:p-8 animate-in fade-in duration-700">
            <ProfileManager />
        </div>
    );
}