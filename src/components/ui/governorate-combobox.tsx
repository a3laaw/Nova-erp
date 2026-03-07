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

interface Option {
  value: string
  label: string
}

const kuwaitGovernorates: Option[] = [
  { value: "capital", label: "العاصمة" },
  { value: "hawalli", label: "حولي" },
  { value: "farwaniya", label: "الفروانية" },
  { value: "mubarak", label: "مبارك الكبير" },
  { value: "jahra", label: "الجهراء" },
  { value: "ahmadi", label: "الأحمدي" },
]

export function GovernorateCombobox() {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")
  const isSelectingRef = React.useRef(false)

  const selectedOption = kuwaitGovernorates.find((o) => o.value === value)

  return (
    <Popover 
      open={open} 
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isSelectingRef.current) {
          isSelectingRef.current = false;
          return;
        }
        setOpen(nextOpen);
      }}
    >
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
          {selectedOption ? selectedOption.label : "اختر المحافظة..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent 
        className="w-[--radix-popover-trigger-width] p-0 z-[999999]"
        onInteractOutside={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        data-governorate-combobox-options
      >
        <Command>
          <CommandInput placeholder="ابحث عن محافظة..." />
          <CommandList>
            <CommandEmpty>لا توجد نتائج مطابقة.</CommandEmpty>
            <CommandGroup>
              {kuwaitGovernorates.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onPointerDown={() => {
                    isSelectingRef.current = true;
                  }}
                  onPointerUp={() => {
                    isSelectingRef.current = false;
                    setValue(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                  onSelect={() => {
                    setValue(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                >
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
