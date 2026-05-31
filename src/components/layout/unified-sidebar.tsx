
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { NovaSystemSchema } from '@/lib/nova-system-schema';
import { useSidebar } from '@/components/ui/sidebar'; // Assuming a sidebar context
import { AnimatePresence, motion } from 'framer-motion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// --- COMPONENT PROPS ---
interface UnifiedSidebarProps {
  userPermissions: string[];
}

// --- DYNAMIC ICON LOADER ---
const Icon = ({ name, ...props }: { name: string, [key: string]: any }) => {
  const LucideIcon = (LucideIcons as any)[name];
  if (!LucideIcon) return <LucideIcons.HelpCircle {...props} />;
  return <LucideIcon {...props} />;
};

export function UnifiedSidebar({ userPermissions }: UnifiedSidebarProps) {
  const pathname = usePathname();
  const { state } = useSidebar(); // { state: 'open' | 'collapsed' }
  const [activeModule, setActiveModule] = useState<string | null>(null);

  // Filter the entire schema based on the user's permissions
  const accessibleModules = NovaSystemSchema.filter(module =>
    userPermissions.includes(module.globalMenuPermission)
  ).map(module => ({
    ...module,
    children: module.children.filter(child => userPermissions.includes(child.viewPermission))
  }));

  const handleModuleClick = (moduleId: string) => {
    if (state === 'collapsed') {
      setActiveModule(prev => prev === moduleId ? null : moduleId);
    }
  };
  
  // When sidebar opens, close any open fly-out menu
  React.useEffect(() => {
    if (state === 'open') {
      setActiveModule(null);
    }
  }, [state]);

  // --- RENDER LOGIC ---
  return (
    <TooltipProvider delayDuration={0}>
      <nav className="p-3 space-y-1">
        {accessibleModules.map(module => {
          const isModuleActive = module.children.some(c => pathname.startsWith(c.href));

          if (state === 'collapsed') {
            // COLLAPSED STATE: Tooltips and fly-out panels
            return (
              <div key={module.id} className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleModuleClick(module.id)}
                      className={cn(
                        "flex items-center justify-center size-14 rounded-2xl border transition-all duration-300 relative group outline-none",
                        (isModuleActive || activeModule === module.id)
                          ? "bg-white/75 border-white/50 text-[#F5820D] shadow-[0_12px_35px_rgba(245,130,13,0.05)] backdrop-blur-xl"
                          : "bg-gradient-to-r from-[#FFA611] via-[#FFCB2B] to-[#FFA611]/90 border-white/20 text-white/95 font-semibold hover:brightness-105 shadow-lg shadow-black/10"
                      )}
                    >
                      <Icon name={module.icon} className="size-6 shrink-0" strokeWidth={2.5} />
                    </button>
                  </TooltipTrigger>
                  {activeModule !== module.id && <TooltipContent side="left"><p>{module.label}</p></TooltipContent>}
                </Tooltip>

                <AnimatePresence>
                  {activeModule === module.id && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute right-full top-0 mr-3 w-64 bg-white/75 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl p-3 z-50"
                    >
                      <div className="font-bold text-[#F5820D] text-right p-2 pr-4 text-[13px] tracking-wide border-b border-amber-200/50 mb-2">
                        {module.label}
                      </div>
                      <div className="space-y-1">
                        {module.children.map(child => (
                          <Link
                            key={child.id}
                            href={child.href}
                            className={cn(
                              "flex items-center justify-end gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 group/link rtl:flex-row-reverse font-semibold tracking-wide antialiased",
                              pathname.startsWith(child.href)
                                ? "bg-amber-100 text-amber-900"
                                : "text-slate-700 hover:bg-amber-50 hover:text-amber-800"
                            )}
                          >
                            <Icon name={child.icon} className="h-4 w-4 shrink-0"/>
                            <span className="text-right flex-1">{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          } else {
            // EXPANDED STATE: Accordion-style
            return (
              <div key={module.id}>
                <div
                  className={cn(
                    "flex items-center justify-end gap-4 px-5 py-3.5 rounded-2xl border transition-all duration-300 group",
                    "rtl:flex-row-reverse text-sm tracking-wide antialiased",
                    isModuleActive
                      ? "bg-white/75 border-white/50 text-[#F5820D] shadow-[0_12px_35px_rgba(245,130,13,0.05)] backdrop-blur-xl font-bold"
                      : "bg-gradient-to-r from-[#FFA611] via-[#FFCB2B] to-[#FFA611]/90 border-white/20 text-white/95 font-semibold hover:brightness-105 shadow-lg shadow-black/10"
                  )}
                >
                  <Icon name={module.icon} className="size-5 shrink-0" strokeWidth={2.5} />
                  <span className="flex-1 text-right">{module.label}</span>
                </div>
                
                {isModuleActive && (
                   <div className="bg-white/75 backdrop-blur-xl rounded-xl shadow-inner mx-2.5 my-1 p-3 space-y-1 border border-white/50">
                      {module.children.map(child => (
                        <Link 
                            key={child.id} 
                            href={child.href}
                            className={cn(
                                "flex items-center justify-end w-full gap-3 h-11 px-4 rounded-lg text-sm transition-colors rtl:flex-row-reverse font-semibold tracking-wide antialiased", 
                                pathname.startsWith(child.href) ? "bg-amber-100 text-amber-900" : "text-slate-600 hover:bg-amber-50 hover:text-amber-800"
                            )}>
                            <Icon name={child.icon} className={cn("h-4 w-4 shrink-0", pathname.startsWith(child.href) ? "text-amber-700" : "text-slate-400")} />
                            <span className="flex-1 text-right">{child.label}</span>
                        </Link>
                      ))}
                  </div>
                )}
              </div>
            );
          }
        })}
      </nav>
    </TooltipProvider>
  );
}
