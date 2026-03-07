"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// 1. تعريف شكل البيانات لكل خيار في القائمة
interface Option {
  value: string // المُعرّف الفريد
  label: string // النص الذي يظهر للمستخدم
}

// 2. بيانات المثال: محافظات الكويت
const kuwaitGovernorates: Option[] = [
  { value: "capital", label: "العاصمة" },
  { value: "hawalli", label: "حولي" },
  { value: "farwaniya", label: "الفروانية" },
  { value: "mubarak", label: "مبارك الكبير" },
  { value: "jahra", label: "الجهراء" },
  { value: "ahmadi", label: "الأحمدي" },
]

// 3. تعريف المكون الرئيسي
export function GovernorateCombobox() {
  // الحالة التي تتحكم في فتح وإغلاق القائمة
  const [open, setOpen] = React.useState(false)
  // الحالة التي تخزن القيمة المختارة (value)
  const [value, setValue] = React.useState("")

  // 4. البحث عن النص الظاهر (label) للخيار المختار حاليًا لعرضه على الزر
  const selectedOption = kuwaitGovernorates.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* 5. الزر الذي يفتح القائمة المنسدلة */}
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
        >
          {/* عرض النص المختار أو النص الافتراضي */}
          {selectedOption ? selectedOption.label : "اختر المحافظة..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      {/* 6. محتوى القائمة المنسدلة الذي يظهر عند النقر */}
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          {/* 7. مربع الكتابة الفعلي للبحث داخل القائمة */}
          <CommandInput placeholder="ابحث عن محافظة..." />

          {/* 8. قائمة الخيارات التي سيتم فلترتها */}
          <CommandList>
            {/* رسالة تظهر عند عدم وجود نتائج */}
            <CommandEmpty>لا توجد نتائج مطابقة.</CommandEmpty>
            <CommandGroup>
              {kuwaitGovernorates.map((option) => (
                <CommandItem
                  key={option.value}
                  // 9. ✨ الجزء الأهم: نستخدم label هنا ليتم البحث بالنص الظاهر
                  value={option.label}
                  onMouseDown={(e) => e.preventDefault()}
                  // 10. عند اختيار عنصر، نقوم بتحديث القيمة وإغلاق القائمة
                  onSelect={(currentLabel) => {
                    const selected = kuwaitGovernorates.find(
                      (opt) => opt.label.toLowerCase() === currentLabel.toLowerCase()
                    );
                    if (selected) {
                      setValue(selected.value);
                    }
                    setOpen(false);
                  }}
                >
                  {/* 11. أيقونة ✔ التي تظهر بجانب العنصر المختار فقط */}
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 transition-opacity",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}