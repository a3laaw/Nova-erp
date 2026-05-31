
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { SystemModules } from '@/lib/system-modules';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const PERMISSION_STYLES: { [key: string]: string } = {
    full: 'text-[#F5820D] font-black', // Bright tech orange for full control
    edit_all: 'text-[#F5820D] font-semibold', // Bright tech orange for edit all
    edit_own: 'text-slate-800 font-semibold', // Standard for own edits
    add_view: 'text-slate-800 font-semibold', // Standard for adding/viewing
    add_only: 'text-slate-700 font-medium', // Slightly lighter for add only
    view: 'text-amber-700 font-medium', // Calm amber for view only
};

export function DynamicSidebar() {
    const { user, currentRole } = useAuth();
    const pathname = usePathname();

    if (!user || !currentRole) {
        // You can return a loading skeleton here
        return <div className="w-72 bg-white/50 backdrop-blur-xl p-4">Loading...</div>;
    }

    const permissionMap = currentRole.permissionMap || {};

    const accessibleModules = SystemModules.filter(module => {
        const permissionLevel = permissionMap[module.id];
        return permissionLevel && permissionLevel !== 'none';
    });

    return (
        <aside className="w-72 flex flex-col p-6 bg-white/60 backdrop-blur-2xl border-r border-white/50 shadow-2xl">
            <div className="text-center mb-10">
                {/* Placeholder for company logo */}
                <div className="w-24 h-8 bg-slate-200 mx-auto rounded-lg"></div>
            </div>

            <nav className="flex-1 space-y-2">
                {accessibleModules.map((module, index) => {
                    const permissionLevel = permissionMap[module.id];
                    const isActive = pathname.startsWith(module.href);
                    const style = PERMISSION_STYLES[permissionLevel] || 'text-slate-700 font-medium';

                    return (
                        <motion.div
                            key={module.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05, duration: 0.3 }}
                        >
                            <Link 
                                href={module.href}
                                className={cn(
                                    'flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group',
                                    'rtl:flex-row-reverse text-sm tracking-wide antialiased',
                                    isActive 
                                        ? 'bg-white/75 border-white/50 shadow-lg backdrop-blur-xl' 
                                        : 'hover:bg-white/50'
                                )}
                            >
                                <module.icon className={cn(
                                    'size-5 shrink-0 transition-colors',
                                    isActive ? style : 'text-slate-500 group-hover:text-slate-800'
                                )} strokeWidth={2.5} />
                                <span className={cn(
                                    'flex-1 text-right transition-colors',
                                    isActive ? style : 'text-slate-600 group-hover:text-slate-900' 
                                )}>
                                    {module.name}
                                </span>
                            </Link>
                        </motion.div>
                    );
                })}
            </nav>

            <div className="mt-auto text-center text-xs text-slate-500">
                <p>&copy; 2024 Nova ERP</p>
            </div>
        </aside>
    );
}
