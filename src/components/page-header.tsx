'use client';

import { cn } from '@/lib/utils';
import React from 'react';

// A flexible container for page headers
function PageHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <section
            className={cn(
                'flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-gray-200',
                className
            )}
            {...props}
        >
            {children}
        </section>
    );
}

// The main title of the page header
function PageHeaderTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
        <h2
            className={cn(
                'text-2xl font-bold tracking-tight flex items-center gap-3',
                className
            )}
            {...props}>
            {children}
        </h2>
    );
}

// A description or subtitle for the page header
function PageHeaderDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return (
        <p
            className={cn('text-muted-foreground text-sm', className)}
            {...props}
        >
            {children}
        </p>
    );
}

export { PageHeader, PageHeaderTitle, PageHeaderDescription };
