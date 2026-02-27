'use client';

import { useBranding } from '@/context/branding-context';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';

interface PrintableDocumentProps {
    children: React.ReactNode;
    orientation?: 'portrait' | 'landscape';
}

export function PrintableDocument({ children, orientation = 'portrait' }: PrintableDocumentProps) {
    const { branding, loading } = useBranding();

    if (loading) {
        return <Skeleton className="h-[800px] w-full" />;
    }

    return (
        <div className={cn("printable-wrapper", orientation === 'landscape' ? 'print-landscape' : 'print-portrait')}>
            <table id="printable-area" className="printable-container w-full border-collapse bg-white dark:bg-card shadow-lg rounded-lg print:shadow-none print:border-none print:bg-transparent">
                {branding?.letterhead_image_url && (
                    <thead className="print-header">
                      <tr><td>
                        <div style={{
                          backgroundImage: `url(${branding.letterhead_image_url})`,
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center top',
                          height: '150px'
                        }}></div>
                      </td></tr>
                    </thead>
                )}

                <tbody className="print-content">
                  <tr><td>
                    <div className="relative">
                        {branding?.watermark_image_url && (
                            <div className="print-watermark">
                                 {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={branding.watermark_image_url} alt="Watermark" />
                            </div>
                        )}
                        <div className="p-8 md:p-12 document-body">
                            {children}
                        </div>
                    </div>
                  </td></tr>
                </tbody>

                {branding?.footer_image_url && (
                    <tfoot className="print-footer">
                      <tr><td>
                        <div style={{
                          backgroundImage: `url(${branding.footer_image_url})`,
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center bottom',
                          height: '100px'
                        }}></div>
                      </td></tr>
                    </tfoot>
                )}
            </table>
        </div>
    );
}
