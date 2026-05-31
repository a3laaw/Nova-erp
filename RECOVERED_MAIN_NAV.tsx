'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SidebarCollapsibleItem } from "./sidebar-collapsible-item";
import { SystemModules } from "@/lib/system-modules"; // The source of truth for navigation
import { useAuth } from "@/context/auth-context";
import { ScrollArea } from "../ui/scroll-area";

// =============================================================================
// 
// هذا هو الكود الكامل والصحيح للقائمة الجانبية الديناميكية.
// المسار الأصلي: src/components/layout/main-nav.tsx
// 
// =============================================================================

export function MainNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname();
  const { user, checkPermission } = useAuth(); // Using the permission checker and user object

  // If the user is an Admin, show all modules. Otherwise, filter by permissions.
  const accessibleModules = user?.role === 'Admin'
    ? SystemModules
    : SystemModules.filter(module => checkPermission(module.id, 'view'));

  // Group modules by category (e.g., Accounting, HR)
  const groupedModules = accessibleModules.reduce((acc, module) => {
    if (module.category) {
      if (!acc[module.category]) {
        acc[module.category] = [];
      }
      acc[module.category].push(module);
    }
    return acc;
  }, {} as Record<string, typeof SystemModules>);

  // Find the icon for each category from the first module in the group
  const categoryIcons: Record<string, React.ElementType> = {};
  Object.keys(groupedModules).forEach(category => {
      const firstModuleInCategory = SystemModules.find(m => m.category === category);
      if (firstModuleInCategory && firstModuleInCategory.categoryIcon) {
          categoryIcons[category] = firstModuleInCategory.categoryIcon;
      }
  });

  const mainLinks = accessibleModules.filter(module => !module.category);

  return (
    <ScrollArea className="h-full">
        <nav
            className={cn("flex flex-col space-y-2 p-4 pt-6", className)}
            {...props}
            >
            {/* Render non-categorized items first */}
            {mainLinks.map((module) => (
                <Link
                key={module.id}
                href={module.path}
                className={cn(
                    "flex items-center space-x-3 space-x-reverse rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname.startsWith(module.path)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/50"
                )}
                >
                <module.icon className="h-5 w-5" />
                <span>{module.name}</span>
                </Link>
            ))}

            {/* Render categorized and collapsible items */}
            {Object.entries(groupedModules).map(([category, modules]) => (
                <SidebarCollapsibleItem
                    key={category}
                    title={category}
                    icon={categoryIcons[category]}
                    isActive={modules.some(m => pathname.startsWith(m.path))}
                >
                {modules.map((module) => (
                    <Link
                        key={module.id}
                        href={module.path}
                        className={cn(
                            "flex items-center space-x-3 space-x-reverse rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            pathname.startsWith(module.path)
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted/50"
                        )}
                    >
                    <module.icon className="h-4 w-4" />
                    <span>{module.name}</span>
                    </Link>
                ))}
                </SidebarCollapsibleItem>
            ))}
        </nav>
    </ScrollArea>
  );
}
