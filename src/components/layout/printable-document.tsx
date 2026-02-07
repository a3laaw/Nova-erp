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
                <thead className="print-header">
                  <tr><td>
                    <div style={{
                      backgroundImage: `url(${branding.letterhead_image_url})`,
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center top',
                      height: '150px' /* Adjust height as needed */
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
                      height: '100px' /* Adjust height as needed */
                    }}></div>
                  </td></tr>
                </tfoot>
            )}
        </div>
    );
}
