
'use client';

import React from 'react';
import Link from 'next/link';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { NovaSystemSchema } from '@/lib/nova-system-schema';
import { motion } from 'framer-motion';

// --- COMPONENT PROPS ---
interface AutoDashboardGridProps {
  userPermissions: string[];
  // This would come from a data fetching hook (e.g., React Query, SWR)
  metricsData: { [key: string]: number | string }; 
}

// --- DYNAMIC ICON LOADER ---
const Icon = ({ name, ...props }: { name: string, [key: string]: any }) => {
  const LucideIcon = (LucideIcons as any)[name];
  if (!LucideIcon) return <LucideIcons.HelpCircle {...props} />;
  return <LucideIcon {...props} />;
};

export function AutoDashboardGrid({ userPermissions, metricsData }: AutoDashboardGridProps) {

  // 1. Flatten all dashboard metrics from the schema
  const allMetrics = NovaSystemSchema.flatMap(module => module.dashboardMetrics || []);

  // 2. Filter metrics based on the user's permission array
  const accessibleMetrics = allMetrics.filter(metric => 
    userPermissions.includes(metric.permissionCode)
  );

  // --- RENDER LOGIC ---
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
      {accessibleMetrics.map((metric, index) => (
        <motion.div
          key={metric.permissionCode}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.05 }}
        >
          <Link href={metric.href} className="block h-full">
            <div className={cn(
              "h-full p-6 rounded-2xl transition-all duration-300 relative overflow-hidden group",
              "bg-slate-900/80 backdrop-blur-md border border-amber-400/30 shadow-2xl shadow-black/30",
              "hover:bg-slate-800/80 hover:border-amber-400/80 hover:shadow-amber-400/10"
            )}>
              {/* Neon glow effect */}
              <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent animate-[shimmer_4s_infinite] group-hover:via-amber-400/80"></div>
              
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/10 rounded-lg">
                    <Icon name={metric.icon} className="h-6 w-6 text-amber-300" />
                  </div>
                  {metric.metricType === 'action' && (
                    <div className="p-2 bg-green-500/20 rounded-full">
                        <Icon name="ArrowLeft" className="h-5 w-5 text-green-300 transform -rotate-45" />
                    </div>
                  )}
                </div>
                
                <div className="flex-grow">
                  {metric.metricType === 'action' ? (
                      <h3 className="text-xl font-bold text-white tracking-wide text-right">{metric.label}</h3>
                  ) : (
                    <div className="text-right">
                        <h3 className="text-base font-semibold text-slate-300/80 tracking-wide">{metric.label}</h3>
                        <p className="text-4xl font-black text-white">
                            {metric.valuePrefix}{metricsData[metric.permissionCode] || '0'}{metric.valueSuffix}
                        </p>
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-slate-400/60 text-left mt-4">
                  {metric.permissionCode}
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

// Add this animation to your tailwind.config.js
/*
@keyframes shimmer {
  0% { transform: translateX(-50%) rotate(0deg); }
  50% { transform: translateX(50%) rotate(180deg); }
  100% { transform: translateX(-50%) rotate(360deg); }
}
*/
