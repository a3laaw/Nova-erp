# دليل إصلاح جميع القوائم المنسدلة في النظام

هذا الملف يحتوي على جميع التعديلات المطلوبة لإصلاح مشكلة عدم القدرة على الاختيار بالماوس في جميع أنواع القوائم المنسدلة.

---

## 1. إصلاح MultiSelect (الاختيار المتعدد)

**الملف:** `src/components/ui/multi-select.tsx`

**الإجراء:** استبدل المحتوى بالكامل بالكود التالي:

```tsx
'use client';

import * as React from 'react';
import Select, { type MultiValue, type StylesConfig } from 'react-select';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelect({ options, selected, onChange, placeholder = 'اختر...', className, disabled = false }: MultiSelectProps) {
  const handleChange = (newSelected: MultiValue<MultiSelectOption>) => {
    const values = newSelected ? newSelected.map(opt => opt.value) : [];
    onChange(values);
  };

  const selectedOptions = options.filter(opt => selected.includes(opt.value));
  
  const customStyles: StylesConfig<MultiSelectOption, true> = {
    control: (base, state) => ({
      ...base,
      backgroundColor: 'hsl(var(--card))',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))',
      minHeight: '40px',
      boxShadow: state.isFocused ? '0 0 0 1px hsl(var(--ring))' : 'none',
      cursor: 'pointer',
      '&:hover': {
        borderColor: 'hsl(var(--ring))',
      },
    }),
    placeholder: (base) => ({
        ...base,
        color: 'hsl(var(--muted-foreground))',
    }),
    input: (base) => ({
        ...base,
        color: 'hsl(var(--foreground))',
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'hsl(var(--card))',
      zIndex: 9999,
      position: 'absolute',
    }),
    menuList: (base) => ({
      ...base,
      maxHeight: '200px',
    }),
    option: (base, state) => ({
      ...base,
      cursor: 'pointer',
      backgroundColor: state.isSelected 
        ? 'hsl(var(--primary))' 
        : state.isFocused 
        ? 'hsl(var(--accent))' 
        : 'transparent',
      color: state.isSelected 
        ? 'hsl(var(--primary-foreground))' 
        : 'hsl(var(--foreground))',
      '&:active': {
        backgroundColor: 'hsl(var(--primary))',
      },
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: 'hsl(var(--secondary))',
      borderRadius: '9999px',
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: 'hsl(var(--secondary-foreground))',
      paddingRight: '6px',
      fontSize: '0.875rem'
    }),
    multiValueRemove: (base) => ({
      ...base,
      cursor: 'pointer',
      color: 'hsl(var(--secondary-foreground))',
      '&:hover': {
        backgroundColor: 'hsl(var(--destructive) / 0.8)',
        color: 'hsl(var(--destructive-foreground))',
      },
    }),
    noOptionsMessage: (base) => ({
      ...base,
      color: 'hsl(var(--muted-foreground))',
    }),
  };

  return (
    <Select
      isMulti
      options={options}
      value={selectedOptions}
      onChange={handleChange}
      placeholder={placeholder}
      className={cn("w-full", className)}
      classNamePrefix="react-select"
      isDisabled={disabled}
      isSearchable={true}
      noOptionsMessage={() => "لا توجد نتائج"}
      styles={customStyles}
      menuPlacement="auto"
      closeMenuOnSelect={false}
      blurInputOnSelect={false}
      theme={(theme) => ({
        ...theme,
        borderRadius: 6,
        colors: {
            ...theme.colors,
            primary: 'hsl(var(--primary))',
            primary75: 'hsl(var(--primary) / 0.75)',
            primary50: 'hsl(var(--primary) / 0.5)',
            primary25: 'hsl(var(--primary) / 0.25)',
            danger: 'hsl(var(--destructive))',
            dangerLight: 'hsl(var(--destructive) / 0.25)',
            neutral0: 'hsl(var(--card))',
            neutral5: 'hsl(var(--border))',
            neutral10: 'hsl(var(--secondary))',
            neutral20: 'hsl(var(--border))',
            neutral30: 'hsl(var(--border))',
            neutral40: 'hsl(var(--muted-foreground))',
            neutral50: 'hsl(var(--muted-foreground))',
            neutral60: 'hsl(var(--foreground))',
            neutral70: 'hsl(var(--foreground))',
            neutral80: 'hsl(var(--foreground))',
            neutral90: 'hsl(var(--foreground))',
        }
      })}
    />
  );
}
```

---

## 2. إصلاح Select العادي (الاختيار المفرد)

**الملف:** `src/components/ui/select.tsx`

**الإجراء:** في مكون `SelectContent`، قم بحذف `<SelectPrimitive.Portal>` و `</SelectPrimitive.Portal>`

**الكود المطلوب لـ SelectContent:**

```tsx
const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Content
    ref={ref}
    className={cn(
      "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      position === "popper" &&
        "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
      className
    )}
    position={position}
    {...props}
  >
    <SelectScrollUpButton />
    <SelectPrimitive.Viewport
      className={cn(
        "p-1",
        position === "popper" &&
          "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
      )}
    >
      {children}
    </SelectPrimitive.Viewport>
    <SelectScrollDownButton />
  </SelectPrimitive.Content>
))
SelectContent.displayName = SelectPrimitive.Content.displayName
```

**تأكد أيضاً من:** أن `SelectItem` يحتوي على `cursor-pointer` في className:

```tsx
const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
```

---

## 3. إصلاح InlineSearchList

**الملف:** `src/components/ui/inline-search-list.tsx`

**الإجراء:** استبدل المحتوى بالكامل بالكود التالي:

```tsx
'use client';

import * as React from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from './button';

export interface SearchOption {
  value: string;
  label: string;
  searchKey?: string;
}

interface InlineSearchListProps {
  value: string;
  onSelect: (value: string) => void;
  options: SearchOption[];
  placeholder: string;
  disabled?: boolean;
  className?: string;
}

export function InlineSearchList({
  value,
  onSelect,
  options,
  placeholder,
  disabled,
  className,
}: InlineSearchListProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  const selectedLabel = options.find((option) => option.value === value)?.label;

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const searchLower = search.toLowerCase();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(searchLower) || 
      opt.searchKey?.toLowerCase().includes(searchLower)
    );
  }, [options, search]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full justify-between font-normal",
          !value && "text-muted-foreground",
          className
        )}
        disabled={disabled}
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {open && (
        <div 
          className="absolute z-[99999] w-full mt-1 bg-popover border rounded-md shadow-md"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="p-2 border-b">
            <Input
              placeholder="ابحث..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
              autoFocus
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                لا توجد نتائج.
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    value === option.value && "bg-accent"
                  )}
                  onClick={() => {
                    onSelect(option.value === value ? '' : option.value);
                    setOpen(false);
                    setSearch('');
                  }}
                  style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 4. إضافة CSS عام للحماية

**الملف:** `src/app/globals.css`

**الإجراء:** أضف الكود التالي في **نهاية الملف**:

```css
/* Fix for dropdown/popover click issues */
[data-radix-popper-content-wrapper] {
  z-index: 99999 !important;
  pointer-events: auto !important;
}

[role="listbox"],
[role="menu"],
[role="dialog"],
[data-state="open"][data-radix-select-content],
[data-state="open"][data-radix-popover-content] {
  pointer-events: auto !important;
  z-index: 99999 !important;
}

[role="option"],
[role="menuitem"],
[cmdk-item] {
  cursor: pointer !important;
  pointer-events: auto !important;
}

.radix-themes {
  pointer-events: auto !important;
}
```

---

## خلاصة التعديلات

بعد تطبيق جميع التعديلات أعلاه:

✅ **MultiSelect** (اختيار متعدد) - يعمل بالماوس  
✅ **Select** (اختيار مفرد) - يعمل بالماوس  
✅ **InlineSearchList** (بحث واختيار) - يعمل بالماوس  
✅ **Popover/Command** (جميع المكونات المعتمدة عليها) - تعمل بالماوس  

---

## ملاحظات مهمة

1. **السبب الرئيسي للمشكلة:** استخدام `Portal` من Radix UI يسبب مشاكل في `pointer-events`
2. **الحل:** إلغاء Portal واستخدام positioning مباشر
3. **CSS الإضافي:** يعمل كطبقة حماية لأي مكونات أخرى قد تواجه نفس المشكلة

---

**تاريخ الإنشاء:** 2026-02-15  
**النظام:** Firebase Studio + Next.js 14 + ShadCN UI
