import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("bg-sky-100 text-blue-800 p-2 rounded-md dark:bg-sky-900/30 dark:text-sky-200", className)}>
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
           <path d="M17 18V6H7v12"/>
           <path d="m17 6-10 12"/>
        </svg>
    </div>
  );
}
