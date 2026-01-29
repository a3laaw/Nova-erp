import { cn } from "@/lib/utils";
import Image from 'next/image';

export function Logo({ className, logoUrl, companyName }: { className?: string, logoUrl?: string, companyName?: string }) {
  const fallbackLetter = companyName ? companyName.charAt(0).toUpperCase() : 'N';

  return (
    <div className={cn("bg-sky-100 text-blue-800 p-2 rounded-md dark:bg-sky-900/30 dark:text-sky-200 flex items-center justify-center overflow-hidden", className)}>
        {logoUrl ? (
             <Image src={logoUrl} alt={`${companyName || 'Company'} Logo`} width={40} height={40} className="object-contain" />
        ) : (
            <span className="text-xl font-bold text-blue-800 dark:text-sky-200">{fallbackLetter}</span>
        )}
    </div>
  );
}
