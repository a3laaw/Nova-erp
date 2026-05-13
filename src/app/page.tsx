'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, LogIn, Building2, Sparkles, AlertCircle, User, Key } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase';

/**
 * بوابة العبور السيادية (Sovereign Gateway v10.0):
 * تدعم الدخول بـ "اسم المستخدم" مع محرك تحويل هوية سحابي ذكي.
 */
export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [identifier, setIdentifier] = useState(''); 
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<{ message: string, email?: string } | null>(null);

  useEffect(() => {
    if (user && !loading) {
        const target = user.role === 'Developer' ? '/developer' : '/dashboard';
        router.replace(target);
    }
  }, [user, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localLoading) return;
    
    setLocalLoading(true);
    setDiagnosis(null);

    try {
        let finalEmail = identifier.trim().toLowerCase();

        // 🛡️ محرك تحويل الهوية الذكي (Identity Transformer)
        // يبحث في الفهرس العالمي عن اسم المستخدم ليجلب الإيميل الحقيقي
        if (!finalEmail.includes('@') && firestore) {
            const globalQuery = query(
                collection(firestore, 'global_users'), 
                where('username', '==', finalEmail),
                limit(1)
            );
            const snap = await getDocs(globalQuery);
            if (snap.empty) {
                throw new Error('اسم المستخدم هذا غير مسجل في المنظومة حالياً.');
            }
            finalEmail = snap.docs[0].data().email;
        }

        await login(finalEmail, password);

    } catch (error: any) {
        setLocalLoading(false);
        
        // 🔍 محرك تشخيص أعطال الأمان
        if (firestore) {
            const checkEmail = identifier.includes('@') ? identifier.trim().toLowerCase() : null;
            const diagQuery = checkEmail 
                ? query(collection(firestore, 'global_users'), where('email', '==', checkEmail), limit(1))
                : query(collection(firestore, 'global_users'), where('username', '==', identifier.trim().toLowerCase()), limit(1));
            
            const snap = await getDocs(diagQuery);
            if (!snap.empty) {
                const userData = snap.docs[0].data();
                setDiagnosis({
                    message: 'تم العثور على حسابك في قاعدة البيانات، ولكنه غير مفعل سحابياً. يرجى تفعيل الحساب عبر الرابط المرسل لبريدك.',
                    email: userData.email
                });
            } else {
                setDiagnosis({ message: 'تأكد من كتابة اسم المستخدم وكلمة المرور بشكل صحيح.' });
            }
        }

        toast({
            variant: 'destructive',
            title: 'تعذر الدخول',
            description: error.message || 'بيانات الدخول غير صحيحة.'
        });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, #818cf8 0%, transparent 50%)' }} />
      
      <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden glass-effect animate-in zoom-in-95 duration-500 relative z-10">
        <CardHeader className="py-10 px-8 text-center border-b border-white/40 bg-white/20">
            <div className="bg-white/60 p-4 rounded-3xl w-fit mx-auto mb-4 border border-white shadow-lg">
                <ShieldCheck className="h-10 w-10 text-[#1e1b4b]" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tighter text-[#1e1b4b] flex items-center justify-center gap-2">
                Nova ERP
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            </CardTitle>
            <CardDescription className="text-[#1e1b4b]/60 font-bold mt-1 uppercase tracking-widest text-[10px]">بوابة العبور السيادية</CardDescription>
        </CardHeader>
        
        <CardContent className="p-8 space-y-6">
            {diagnosis && (
                <Alert variant="destructive" className="rounded-2xl bg-red-50 border-red-200 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-[11px] font-black">تشخيص أعطال العبور</AlertTitle>
                    <AlertDescription className="text-[10px] font-black leading-relaxed space-y-2 mt-1">
                        <p>{diagnosis.message}</p>
                        {diagnosis.email && (
                            <div className="p-2 bg-white rounded-lg border border-red-100 flex items-center justify-between">
                                <span className="font-mono select-all text-[9px]">{diagnosis.email}</span>
                                <Key className="h-3 w-3 opacity-30" />
                            </div>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-5" autoComplete="on">
                <div className="grid gap-2">
                    <Label className="font-black text-[10px] pr-1 uppercase tracking-widest text-[#1e1b4b]">اسم المستخدم فقط (Login ID)</Label>
                    <div className="relative group">
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <Input 
                            type="text" 
                            value={identifier} 
                            onChange={e => setIdentifier(e.target.value)} 
                            className="h-12 rounded-xl border-white/60 bg-white/40 dir-ltr font-black text-base shadow-inner border-2 pr-10" 
                            required 
                            placeholder="e.g. nova1"
                            disabled={localLoading || loading}
                        />
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label className="font-black text-[10px] pr-1 uppercase tracking-widest text-[#1e1b4b]">كلمة المرور</Label>
                    <Input 
                        type="password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        className="h-12 rounded-xl border-white/60 bg-white/40 font-mono font-black text-center shadow-inner border-2 focus:border-primary/50 transition-all" 
                        required 
                        placeholder="********"
                        disabled={localLoading || loading}
                    />
                </div>

                <Button 
                    type="submit" 
                    disabled={localLoading || loading} 
                    className="w-full h-14 rounded-2xl font-black text-xl gap-4 shadow-xl bg-[#1e1b4b] text-white hover:bg-black transition-all border-b-4 border-black/30 mt-2 active:translate-y-1 active:border-b-0"
                >
                    {localLoading || loading ? (
                        <>
                            <Loader2 className="animate-spin h-6 w-6" />
                            <span>جاري التحقق...</span>
                        </>
                    ) : (
                        <>
                            <LogIn className="h-6 w-6" />
                            <span>دخول للنظام</span>
                        </>
                    )}
                </Button>
            </form>

            <div className="pt-6 border-t border-black/5 text-center">
                <p className="text-[10px] font-bold text-slate-500 mb-3 uppercase">ليس لديك منشأة مسجلة؟</p>
                <Button asChild variant="ghost" className="w-full h-12 rounded-2xl border-2 border-white/60 bg-white/20 text-[#1e1b4b] font-black hover:bg-white/40 gap-2">
                    <Link href="/register">
                        <Building2 className="h-4 w-4" />
                        سجل منشأتك الآن
                    </Link>
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
