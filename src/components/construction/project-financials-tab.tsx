
'use client';

import * as React from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { where } from 'firebase/firestore';
import type { ConstructionProject, PurchaseOrder, SubcontractorCertificate, CashReceipt } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  AlertTriangle,
  Coins,
  ArrowUpRight,
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
    Pie,
    Legend
} from 'recharts';
import { Label } from '../ui/label';

interface ProjectFinancialsTabProps {
  project: ConstructionProject;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border p-3 rounded-2xl shadow-xl border-primary/10">
        <p className="font-black text-xs mb-1">{payload[0].name}</p>
        <p className="font-mono font-bold text-primary">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

export function ProjectFinancialsTab({ project }: ProjectFinancialsTabProps) {
  const { firestore } = useFirebase();

  // 1. Fetch Materials Cost (Purchase Orders)
  const poQuery = React.useMemo(() => [where('projectId', '==', project.id)], [project.id]);
  const { data: pos, loading: posLoading } = useSubscription<PurchaseOrder>(firestore, 'purchaseOrders', poQuery);

  // 2. Fetch Subcontractors Cost (Certificates)
  const certQuery = React.useMemo(() => [where('projectId', '==', project.id)], [project.id]);
  const { data: certificates, loading: certsLoading } = useSubscription<SubcontractorCertificate>(firestore, 'subcontractor_certificates', certQuery);

  // 3. Fetch Actual Income (Cash Receipts linked to project)
  const receiptsQuery = React.useMemo(() => [where('projectId', '==', project.id)], [project.id]);
  const { data: receipts, loading: receiptsLoading } = useSubscription<CashReceipt>(firestore, 'cashReceipts', receiptsQuery);

  const loading = posLoading || certsLoading || receiptsLoading;

  const stats = React.useMemo(() => {
    if (loading) return null;

    const materialCost = pos.filter(p => p.status !== 'cancelled').reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const laborCost = certificates.filter(c => c.status !== 'cancelled').reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalCosts = materialCost + laborCost;
    
    const collectedIncome = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
    const contractValue = project.contractValue || 0;
    
    const grossProfit = contractValue - totalCosts;
    const profitMargin = contractValue > 0 ? (grossProfit / contractValue) * 100 : 0;
    const collectionRate = contractValue > 0 ? (collectedIncome / contractValue) * 100 : 0;

    const budgetData = [
      { name: 'قيمة العقد', value: contractValue, fill: '#94a3b8' },
      { name: 'إجمالي التكاليف', value: totalCosts, fill: totalCosts > contractValue ? '#ef4444' : '#3b82f6' },
      { name: 'المحصل فعلياً', value: collectedIncome, fill: '#10b981' }
    ];

    const costBreakdown = [
        { name: 'المواد والتوريدات', value: materialCost, color: '#8b5cf6' },
        { name: 'مقاولين وأعمال', value: laborCost, color: '#f59e0b' },
        { name: 'الربح المتوقع', value: Math.max(0, grossProfit), color: '#10b981' }
    ].filter(d => d.value > 0);

    return {
      materialCost,
      laborCost,
      totalCosts,
      collectedIncome,
      contractValue,
      grossProfit,
      profitMargin,
      collectionRate,
      budgetData,
      costBreakdown
    };
  }, [project, pos, certificates, receipts, loading]);

  if (loading) return <Skeleton className="h-96 w-full rounded-3xl" />;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-none shadow-sm bg-blue-50/50 p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
                <Label className="text-[10px] font-black text-blue-700 uppercase">إجمالي التكاليف الفعلية</Label>
                <TrendingDown className="h-4 w-4 text-blue-400" />
            </div>
            <div className="mt-2">
                <p className="text-2xl font-black font-mono text-blue-900">{formatCurrency(stats?.totalCosts || 0)}</p>
                <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-[8px] h-4 py-0 bg-white border-blue-100">مواد: {formatCurrency(stats?.materialCost || 0)}</Badge>
                    <Badge variant="outline" className="text-[8px] h-4 py-0 bg-white border-blue-100">عمالة: {formatCurrency(stats?.laborCost || 0)}</Badge>
                </div>
            </div>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-green-50/50 p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
                <Label className="text-[10px] font-black text-green-700 uppercase">التحصيل الفعلي</Label>
                <Coins className="h-4 w-4 text-green-400" />
            </div>
            <div className="mt-2">
                <p className="text-2xl font-black font-mono text-green-900">{formatCurrency(stats?.collectedIncome || 0)}</p>
                <div className="flex items-center gap-2 mt-1">
                    <Progress value={stats?.collectionRate} className="h-1.5 flex-1" />
                    <span className="text-[10px] font-black text-green-700">{stats?.collectionRate.toFixed(0)}%</span>
                </div>
            </div>
        </Card>

        <Card className={cn("rounded-2xl border-none shadow-sm p-6 flex flex-col justify-between", stats && stats.grossProfit >= 0 ? "bg-primary/5" : "bg-red-50")}>
            <div className="flex justify-between items-start">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">صافي الربح المتوقع</Label>
                {stats && stats.grossProfit >= 0 ? <TrendingUp className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-red-500" />}
            </div>
            <div className="mt-2">
                <p className={cn("text-2xl font-black font-mono", stats && stats.grossProfit >= 0 ? "text-primary" : "text-red-700")}>
                    {formatCurrency(stats?.grossProfit || 0)}
                </p>
                <p className="text-[10px] font-bold text-muted-foreground mt-1">هامش الربح: {stats?.profitMargin.toFixed(1)}%</p>
            </div>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm p-6 bg-slate-50 flex flex-col justify-between">
            <div className="flex justify-between items-start">
                <Label className="text-[10px] font-black text-muted-foreground uppercase">قيمة العقد الإجمالية</Label>
                <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2">
                <p className="text-2xl font-black font-mono text-slate-900">{formatCurrency(stats?.contractValue || 0)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">الميزانية المرصودة للمشروع</p>
            </div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Comparison Bar Chart */}
        <Card className="lg:col-span-2 rounded-3xl border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="border-b bg-muted/10">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary"/> 
                    المقارنة المالية الشاملة
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[350px] p-6">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.budgetData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} fontWeight="bold" />
                        <YAxis axisLine={false} tickLine={false} fontSize={10} tickFormatter={(v) => `${v/1000}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" radius={[12, 12, 0, 0]} barSize={70}>
                            {stats?.budgetData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        {/* Cost Distribution Pie Chart */}
        <Card className="rounded-3xl border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="border-b bg-muted/10">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                    <PieIcon className="h-5 w-5 text-primary"/> 
                    توزيع بنود التكلفة
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[350px] p-6 flex flex-col items-center">
                <div className="flex-1 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={stats?.costBreakdown}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={100}
                                paddingAngle={8}
                                dataKey="value"
                                stroke="none"
                            >
                                {stats?.costBreakdown.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] font-black text-muted-foreground uppercase">الإجمالي</span>
                        <span className="text-xl font-black text-primary font-mono">{formatCurrency(stats?.totalCosts || 0)}</span>
                    </div>
                </div>
                <div className="w-full space-y-3 mt-4">
                    {stats?.costBreakdown.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] bg-muted/30 p-2 rounded-xl border border-muted-foreground/5">
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="font-bold">{item.name}</span>
                            </div>
                            <span className="font-black font-mono">{formatCurrency(item.value)}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
      </div>

      {/* Critical Alerts */}
      {stats && stats.totalCosts > stats.contractValue && (
          <Alert variant="destructive" className="rounded-[2rem] border-2 border-red-500 bg-red-50 animate-bounce shadow-xl">
              <AlertTriangle className="h-6 w-6" />
              <AlertTitle className="text-lg font-black">تحذير رقابي: تجاوز الميزانية!</AlertTitle>
              <AlertDescription className="font-bold">
                  لقد تجاوزت التكاليف الفعلية المسجلة (مواد وأعمال) إجمالي قيمة العقد المعتمدة بمبلغ <span className="underline">{formatCurrency(Math.abs(stats.grossProfit))}</span>. يرجى مراجعة أوامر الشراء وشهادات الإنجاز فوراً.
              </AlertDescription>
          </Alert>
      )}
    </div>
  );
}
