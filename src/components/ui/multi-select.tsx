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
      backgroundColor: 'hsl(var(--card))',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))',
      minHeight: '40px',
      boxShadow: state.isFocused ? '0 0 0 1px hsl(var(--ring))' : 'none',
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
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'hsl(var(--card))',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? 'hsl(var(--primary))' : state.isFocused ? 'hsl(var(--accent))' : 'transparent',
      color: state.isSelected ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
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
    multiValueRemove: (base, state) => ({
      ...base,
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
      menuPortalTarget={portalTarget}
      menuPosition="fixed"
      menuPlacement="auto"
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
