
'use client';

import * as React from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { where, query, collection, getDocs } from 'firebase/firestore';
import type { ConstructionProject, PurchaseOrder, SubcontractorCertificate, JournalEntry } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  AlertTriangle,
  ArrowUpRight,
  Calculator,
  PieChart as PieIcon
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    Cell,
    PieChart,
    Pie
} from 'recharts';

interface ProjectFinancialsTabProps {
  project: ConstructionProject;
}

export function ProjectFinancialsTab({ project }: ProjectFinancialsTabProps) {
  const { firestore } = useFirebase();

  // 1. جلب كافة التكاليف الفعلية المرتبطة بالمشروع (أوامر شراء + شهادات إنجاز)
  const poQuery = React.useMemo(() => [where('projectId', '==', project.id)], [project.id]);
  const { data: pos, loading: posLoading } = useSubscription<PurchaseOrder>(firestore, 'purchaseOrders', poQuery);

  const certQuery = React.useMemo(() => [where('projectId', '==', project.id)], [project.id]);
  const { data: certificates, loading: certsLoading } = useSubscription<SubcontractorCertificate>(firestore, 'subcontractor_certificates', certQuery);

  const loading = posLoading || certsLoading;

  const stats = React.useMemo(() => {
    if (loading) return null;

    const materialCost = pos.filter(p => p.status !== 'cancelled').reduce((sum, p) => sum + p.totalAmount, 0);
    const laborCost = certificates.filter(c => c.status !== 'cancelled').reduce((sum, c) => sum + c.amount, 0);
    const actualTotal = materialCost + laborCost;
    
    const budget = project.contractValue || 0;
    const remainingBudget = budget - actualTotal;
    const burnRate = budget > 0 ? (actualTotal / budget) * 100 : 0;

    const chartData = [
      { name: 'ميزانية مرصودة', value: budget, fill: '#94a3b8' },
      { name: 'تكلفة فعلية', value: actualTotal, fill: burnRate > 90 ? '#ef4444' : '#3b82f6' }
    ];

    const distributionData = [
        { name: 'مواد بضاعة', value: materialCost, color: '#8b5cf6' },
        { name: 'أعمال مقاولين', value: laborCost, color: '#f59e0b' },
        { name: 'متبقي', value: Math.max(0, remainingBudget), color: '#10b981' }
    ].filter(d => d.value > 0);

    return {
      materialCost,
      laborCost,
      actualTotal,
      budget,
      remainingBudget,
      burnRate,
      chartData,
      distributionData
    };
  }, [project, pos, certificates, loading]);

  if (loading) return <Skeleton className="h-96 w-full rounded-3xl" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-none shadow-sm bg-primary/5 p-6">
            <Label className="text-[10px] font-black text-primary uppercase mb-2 block">إجمالي التكاليف الفعلية</Label>
            <p className="text-2xl font-black font-mono">{formatCurrency(stats?.actualTotal || 0)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">مواد + مقاولي باطن</p>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm p-6">
            <Label className="text-[10px] font-black text-muted-foreground uppercase mb-2 block">الميزانية التعاقدية</Label>
            <p className="text-2xl font-black font-mono text-muted-foreground">{formatCurrency(stats?.budget || 0)}</p>
        </Card>
        <Card className={cn("rounded-2xl border-none shadow-sm p-6", stats && stats.remainingBudget < 0 ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800")}>
            <Label className="text-[10px] font-black uppercase mb-2 block">الرصيد المتبقي</Label>
            <p className="text-2xl font-black font-mono">{formatCurrency(stats?.remainingBudget || 0)}</p>
            {stats && stats.remainingBudget < 0 && <p className="text-[10px] font-bold mt-1">تجاوز الميزانية!</p>}
        </Card>
        <Card className="rounded-2xl border-none shadow-sm p-6">
            <Label className="text-[10px] font-black text-muted-foreground uppercase mb-2 block">نسبة حرق الميزانية</Label>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-black font-mono">{stats?.burnRate.toFixed(1)}%</span>
                <TrendingUp className="h-4 w-4 text-orange-500" />
            </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-3xl border-none shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg font-black flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary"/> تحليل الميزانية مقابل الفعلي</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                        <YAxis axisLine={false} tickLine={false} fontSize={10} tickFormatter={(v) => `KD ${v/1000}k`} />
                        <Tooltip 
                            contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                            formatter={(v: number) => [formatCurrency(v), 'القيمة']}
                        />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={60}>
                            {stats?.chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        <Card className="rounded-3xl border-none shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg font-black flex items-center gap-2"><PieIcon className="h-5 w-5 text-primary"/> توزيع التكاليف</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px] flex flex-col items-center justify-center">
                <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={stats?.distributionData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {stats?.distributionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="w-full space-y-2 mt-6 px-4">
                    {stats?.distributionData.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="font-bold">{item.name}</span>
                            </div>
                            <span className="font-mono">{formatCurrency(item.value)}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
      </div>

      {stats && stats.burnRate > 100 && (
          <Alert variant="destructive" className="rounded-2xl border-2 border-red-200 bg-red-50 animate-in zoom-in-95">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="font-black">تجاوز ميزانية المشروع!</AlertTitle>
              <AlertDescription>
                  لقد تجاوزت التكاليف الفعلية المسجلة قيمة العقد الأصلية بمبلغ {formatCurrency(Math.abs(stats.remainingBudget))}. يرجى مراجعة أوامر الشراء وشهادات الإنجاز.
              </AlertDescription>
          </Alert>
      )}
    </div>
  );
}
