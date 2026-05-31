'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarCollapsibleItemProps {
  item: any;
  isOpen: boolean; 
  onToggle: () => void;
  isSidebarOpen: boolean;
}

export const SidebarCollapsibleItem: React.FC<SidebarCollapsibleItemProps> = ({
  item,
  isOpen,
  onToggle,
}) => {
  const pathname = usePathname();
  const hasActiveChild = item.children?.some((child: any) => pathname.startsWith(child.href));
  const IconComponent = (LucideIcons as any)[item.icon] || LucideIcons.HelpCircle;

  const isTriggerActive = isOpen || hasActiveChild;

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle} className="relative w-full">
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <CollapsibleTrigger
              className={cn(
                "flex items-center justify-center size-14 rounded-2xl border transition-all duration-300 relative group outline-none",
                isTriggerActive
                  ? "bg-white/75 border-white/50 text-[#F5820D] shadow-[0_12px_35px_rgba(245,130,13,0.05)] backdrop-blur-xl"
                  : "bg-gradient-to-r from-[#FFA611] via-[#FFCB2B] to-[#FFA611]/90 border-white/20 text-white/95 hover:brightness-105 shadow-lg shadow-black/10"
              )}
            >
              <IconComponent className="size-6 shrink-0" strokeWidth={2.5} />
            </CollapsibleTrigger>
          </TooltipTrigger>
          
          <TooltipContent side="left" className="backdrop-blur-md bg-white/80 border border-amber-200/50 rounded-lg shadow-lg px-3 py-2 text-xs font-semibold text-slate-800">
            <p>{item.label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <CollapsibleContent
        className={cn(
          "fixed right-[72px] left-auto top-auto z-50 w-64 rounded-2xl bg-white/75 backdrop-blur-xl border border-white/50 shadow-[0_12px_35px_rgba(245,130,13,0.05)] p-3"
        )}
      >
        <div className="space-y-1">
          <div className="font-bold text-[#F5820D] text-right p-2 pr-4 text-[13px] tracking-wide border-b border-amber-200/50 mb-2">
            {item.label}
          </div>

          {item.children.map((child: any) => {
            const ChildIcon = (LucideIcons as any)[child.icon] || LucideIcons.Circle;
            const isChildActive = pathname === child.href;

            return (
              <Link
                key={child.id}
                href={child.href || '#'}
                className={cn(
                  "flex items-center justify-end gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 group/link rtl:flex-row-reverse font-semibold tracking-wide antialiased",
                  isChildActive
                    ? "bg-amber-100 text-amber-900"
                    : "text-slate-700 hover:bg-amber-50 hover:text-amber-800"
                )}
              >
                <ChildIcon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors duration-200",
                    isChildActive ? "text-amber-700" : "text-slate-400 group-hover/link:text-amber-600"
                  )}
                />
                <span className="text-right flex-1">{child.label}</span>
              </Link>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};