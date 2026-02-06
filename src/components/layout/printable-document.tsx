
'use client';

import { useBranding } from '@/context/branding-context';
import { Skeleton } from '../ui/skeleton';

interface PrintableDocumentProps {
    children: React.ReactNode;
}

export function PrintableDocument({ children }: PrintableDocumentProps) {
    const { branding, loading } = useBranding();

    if (loading) {
        return <Skeleton className="h-[800px] w-full" />;
    }

    return (
        <div id="printable-area" className="printable-container bg-white dark:bg-card">
            {branding?.letterhead_image_url && (
                <div className="print-header">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={branding.letterhead_image_url} alt="Company Letterhead" className="w-full" />
                </div>
            )}

            <main className="print-content">
                {branding?.watermark_image_url && (
                    <div className="print-watermark">
                         {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={branding.watermark_image_url} alt="Watermark" />
                    </div>
                )}
                <div className="p-8 md:p-12 document-body">
                    {children}
                </div>
            </main>

            {branding?.footer_image_url && (
                <div className="print-footer">
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={branding.footer_image_url} alt="Company Footer" className="w-full" />
                </div>
            )}
        </div>
    );
}

    