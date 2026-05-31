'use client';

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

// =============================================================================
// 
// هذا هو الكود الكامل للمكون المساعد للقائمة الجانبية.
// المسار الأصلي: src/components/layout/sidebar-collapsible-item.tsx
// 
// =============================================================================

interface SidebarCollapsibleItemProps {
  title: string;
  icon: React.ElementType;
  isActive: boolean;
  children: React.ReactNode;
}

export function SidebarCollapsibleItem({ title, icon: Icon, isActive, children }: SidebarCollapsibleItemProps) {
  const [isOpen, setIsOpen] = useState(isActive);

  // This effect ensures that if the user navigates to a different category,
  // the previously active one closes if it's no longer active.
  useEffect(() => {
    setIsOpen(isActive);
  }, [isActive]);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-muted text-primary"
            : "text-muted-foreground hover:bg-muted/50"
        )}
      >
        <div className="flex items-center space-x-3 space-x-reverse">
            {Icon && <Icon className="h-5 w-5" />}
            <span>{title}</span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 transform transition-transform duration-200",
            isOpen ? "rotate-180" : ""
          )}
        />
      </button>
      {isOpen && <div className="mt-1 space-y-1 pr-4">{children}</div>}
    </div>
  );
}
