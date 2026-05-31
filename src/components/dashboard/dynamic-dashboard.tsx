
'use client';

import React from 'react';
import { useAuth } from '@/context/auth-context';
import { SystemDashboardWidgets, canViewWidget } from '@/lib/dashboard-widgets';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HandMetal } from 'lucide-react';

// A placeholder for a component that would fetch and display actual data
const StatCard = ({ widget, value }: { widget: any, value: string }) => (
    <Card className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-lg rounded-3xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-slate-600">{widget.title}</CardTitle>
            <widget.icon className="h-5 w-5 text-slate-500" style={{ color: widget.color }} />
        </CardHeader>
        <CardContent>
            <div className="text-3xl font-black text-slate-800">{value}</div>
            {/* Here you would typically have a sub-description or a small chart */}
        </CardContent>
    </Card>
);

const ActionCard = ({ widget }: { widget: any }) => (
    <Link href={widget.href || '#'} passHref>
        <Button variant="outline" className="h-full w-full p-6 flex flex-col justify-center items-center gap-3 bg-white/70 backdrop-blur-xl border border-white/50 shadow-lg rounded-3xl hover:bg-white/90 transition-all">
            <widget.icon className="h-8 w-8 text-primary" />
            <span className="text-base font-black text-primary text-center">{widget.title}</span>
        </Button>
    </Link>
);

const WelcomeScreen = () => (
    <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-50 to-blue-50 rounded-3xl p-10 text-center"
    >
        <HandMetal className="h-24 w-24 text-blue-400 mb-6" />
        <h1 className="text-4xl font-black text-slate-800">مرحباً بك في نظام Nova</h1>
        <p className="mt-3 text-lg text-slate-600 max-w-md">
            تم تخصيص واجهتك بنجاح. لا توجد عناصر حالياً في لوحة التحكم الخاصة بك، ولكن يمكنك البدء من خلال القائمة الجانبية.
        </p>
    </motion.div>
);

export function DynamicDashboard() {
    const { currentRole } = useAuth();
    
    if (!currentRole) {
        return <div>Loading Dashboard...</div>; // Or a skeleton loader
    }

    const permissionMap = currentRole.permissionMap || {};

    // Check if dashboard itself is hidden
    if (permissionMap['dashboard'] === 'none') {
        return <WelcomeScreen />;
    }

    const accessibleWidgets = SystemDashboardWidgets.filter(widget => 
        canViewWidget(permissionMap, widget.requiredPermission)
    );

    const statWidgets = accessibleWidgets.filter(w => !w.isAction);
    const actionWidgets = accessibleWidgets.filter(w => w.isAction);

    if (accessibleWidgets.length === 0) {
        return <WelcomeScreen />;
    }

    return (
        <div className="p-8 h-full">
            <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                {statWidgets.map((widget, index) => (
                    <motion.div
                        key={widget.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1, duration: 0.4 }}
                    >
                        {/* 
                            NOTE: In a real application, the `value` would come from a data fetching hook 
                            (e.g., useSWR, React Query) that fetches data based on the widget.dataKey.
                            For this simulation, we'll use placeholder values.
                        */}
                        <StatCard widget={widget} value={ (index + 1) * 23 } />
                    </motion.div>
                ))}
                
                {actionWidgets.map((widget, index) => (
                     <motion.div
                        key={widget.id}
                        className="col-span-1 h-40" // Ensure action cards have enough height
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: (statWidgets.length + index) * 0.1, duration: 0.4 }}
                    >
                        <ActionCard widget={widget} />
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
}
