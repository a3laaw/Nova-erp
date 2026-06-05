
import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, value, ...props }, ref) => {
    // 🛡️ درع تصفير الحقول السيادي (Empty-by-Default Matrix V101.0): 
    // يضمن ظهور الحقل فارغاً تماماً إذا كانت القيمة 0 أو لم يتم إدخال بيانات.
    const displayValue = (type === "number" && (value === 0 || value === "0" || value === null || value === undefined)) ? "" : value;

    // 🛡️ معالج منع التمرير السيادي (Scroll-Guard V1.0):
    // يمنع زيادة/نقصان القيمة عند التمرير بعجلة الماوس فوق حقول الأرقام.
    const handleWheel = (event: React.WheelEvent<HTMLInputElement>) => {
      if (type === 'number') {
        event.currentTarget.blur();
      }
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-2xl border-2 border-slate-100 bg-white/60 px-4 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm shadow-inner transition-all text-black font-bold",
          type === "number" && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
        ref={ref}
        value={displayValue}
        onWheel={handleWheel} // تطبيق المعالج
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
