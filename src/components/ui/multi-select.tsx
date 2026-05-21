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

/**
 * مكون الاختيار المتعدد السيادي (MultiSelect V12.0):
 * - تم تفعيل نظام الـ Portal لضمان عدم حدوث Clipping في النوافذ المنبثقة.
 * - فرض خلفية بيضاء مصمتة 100% لمنع تداخل النصوص الخلفية.
 * - وضوح تقني مطلق بـ z-index سيادي.
 */
export function MultiSelect({ options, selected, onChange, placeholder = 'اختر...', className, disabled = false }: MultiSelectProps) {
  // استخدام Portal لمنع القص البصري (Clipping) داخل الـ Modals
  const [portalTarget, setPortalTarget] = React.useState<HTMLElement | null>(null);
  
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setPortalTarget(document.body);
    }
  }, []);

  const handleChange = (newSelected: MultiValue<MultiSelectOption>) => {
    const values = newSelected ? newSelected.map(opt => opt.value) : [];
    onChange(values);
  };

  const selectedOptions = options.filter(opt => selected.includes(opt.value));
  
  const customStyles: StylesConfig<MultiSelectOption, true> = {
    control: (base, state) => ({
      ...base,
      backgroundColor: 'white', 
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))',
      minHeight: '44px',
      boxShadow: state.isFocused ? '0 0 0 1px hsl(var(--ring))' : 'none',
      cursor: 'pointer',
      borderRadius: '1rem',
      '&:hover': {
        borderColor: 'hsl(var(--ring))',
      },
    }),
    placeholder: (base) => ({
        ...base,
        color: 'hsl(var(--muted-foreground))',
        fontWeight: '700',
    }),
    input: (base) => ({
        ...base,
        color: 'hsl(var(--foreground))',
    }),
    menuPortal: (base) => ({
        ...base,
        zIndex: 999999999, // سيادة مطلقة فوق كافة الطبقات
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'white', 
      zIndex: 999999999,
      borderRadius: '1.25rem',
      boxShadow: '0 25px 60px rgba(0,0,0,0.2)', 
      border: '2px solid hsl(var(--primary))',
      overflow: 'hidden',
      marginTop: '4px',
    }),
    menuList: (base) => ({
      ...base,
      maxHeight: '280px',
      padding: '6px',
    }),
    option: (base, state) => ({
      ...base,
      cursor: 'pointer',
      borderRadius: '0.75rem',
      marginBottom: '3px',
      fontWeight: '700',
      backgroundColor: state.isSelected 
        ? 'hsl(var(--primary))' 
        : state.isFocused 
        ? 'hsl(var(--primary) / 0.08)' 
        : 'transparent',
      color: state.isSelected 
        ? 'white' 
        : 'hsl(var(--foreground))',
      '&:active': {
        backgroundColor: 'hsl(var(--primary))',
      },
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: 'hsl(var(--primary) / 0.1)',
      borderRadius: '9999px',
      padding: '2px 8px',
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: 'hsl(var(--primary))',
      paddingRight: '6px',
      fontSize: '0.75rem',
      fontWeight: '900',
    }),
    multiValueRemove: (base) => ({
      ...base,
      cursor: 'pointer',
      color: 'hsl(var(--primary))',
      '&:hover': {
        backgroundColor: 'hsl(var(--destructive))',
        color: 'white',
      },
    }),
    noOptionsMessage: (base) => ({
      ...base,
      color: 'hsl(var(--muted-foreground))',
      fontWeight: '800',
      padding: '20px',
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
      noOptionsMessage={() => "لا توجد نتائج مطابقة"}
      styles={customStyles}
      menuPortalTarget={portalTarget}
      menuPosition="fixed"
      menuPlacement="auto"
      closeMenuOnSelect={false}
      blurInputOnSelect={false}
    />
  );
}
