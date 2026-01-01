'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  Home,
  Briefcase,
  Users,
  Calendar,
  Wallet,
  Warehouse,
  Settings,
  LogOut,
  Bell
} from 'lucide-react';
import { Logo } from './logo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { users } from '@/lib/data';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard/projects', label: 'Projects', icon: Briefcase },
  { href: '/dashboard/clients', label: 'Clients', icon: Users },
  { href: '/dashboard/appointments', label: 'Appointments', icon: Calendar },
  { href: '/dashboard/accounting', label: 'Accounting', icon: Wallet },
  { href: '/dashboard/warehouse', label: 'Warehouse', icon: Warehouse },
];

export function MainNav() {
  const pathname = usePathname();
  const currentUser = users[0];

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
            <Logo />
            <div className="flex flex-col">
                <span className="text-lg font-semibold font-headline tracking-tighter">EmaratiScope</span>
                <span className="text-xs text-muted-foreground">Engineering Management</span>
            </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              <Link href={item.href} passHref legacyBehavior>
                <SidebarMenuButton
                  isActive={pathname.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')}
                  asChild
                  tooltip={item.label}
                >
                  <a>
                    <item.icon />
                    <span>{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
             <SidebarMenuItem>
                <Link href="/dashboard/settings" passHref legacyBehavior>
                    <SidebarMenuButton isActive={pathname.startsWith('/dashboard/settings')} asChild tooltip="Settings">
                        <a>
                            <Settings />
                            <span>Settings</span>
                        </a>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={currentUser.avatarUrl} alt={currentUser.fullName} />
                    <AvatarFallback>{currentUser.fullName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="grid text-sm">
                    <span className="font-semibold text-foreground">{currentUser.fullName}</span>
                    <span className="text-muted-foreground">{currentUser.email}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="ml-auto">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
