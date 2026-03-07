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

  const selectedOption = kuwaitGovernorates.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
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

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="ابحث عن محافظة..." />
          <CommandList>
            <CommandEmpty>لا توجد نتائج مطابقة.</CommandEmpty>
            <CommandGroup>
              {kuwaitGovernorates.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onMouseDown={(e) => e.preventDefault()}
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
