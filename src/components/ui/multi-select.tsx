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
      backgroundColor: 'white', 
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))',
      minHeight: '40px',
      boxShadow: state.isFocused ? '0 0 0 1px hsl(var(--ring))' : 'none',
      cursor: 'pointer',
      borderRadius: '0.75rem',
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
    menu: (base) => ({
      ...base,
      backgroundColor: 'white', 
      zIndex: 999999,
      position: 'absolute',
      borderRadius: '1rem',
      boxShadow: '0 20px 50px rgba(0,0,0,0.15)', 
      border: '1px solid hsl(var(--border))',
      marginTop: '4px',
    }),
    menuList: (base) => ({
      ...base,
      maxHeight: '250px',
      padding: '4px',
    }),
    option: (base, state) => ({
      ...base,
      cursor: 'pointer',
      borderRadius: '0.5rem',
      marginBottom: '2px',
      fontWeight: '700',
      backgroundColor: state.isSelected 
        ? 'hsl(var(--primary))' 
        : state.isFocused 
        ? 'hsl(var(--primary) / 0.05)' 
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
      padding: '1px 4px',
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
      fontWeight: '700',
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
      menuPlacement="auto"
      closeMenuOnSelect={false}
      blurInputOnSelect={false}
    />
  );
}