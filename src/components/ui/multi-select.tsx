'use client';

import * as React from 'react';
import ReactSelect, { type StylesConfig } from 'react-select';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

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

// Using HSL values directly from globals.css for theming
const customStyles: StylesConfig<MultiSelectOption, true> = {
  control: (provided, state) => ({
    ...provided,
    minHeight: '40px',
    backgroundColor: 'hsl(var(--background))',
    borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))',
    boxShadow: state.isFocused ? '0 0 0 1px hsl(var(--ring))' : 'none',
    borderRadius: 'var(--radius)',
    '&:hover': {
      borderColor: 'hsl(var(--input))',
    },
    direction: 'rtl',
  }),
  valueContainer: (provided) => ({
    ...provided,
    padding: '2px 8px',
    gap: '4px'
  }),
  multiValue: (provided) => ({
    ...provided,
    backgroundColor: 'hsl(var(--secondary))',
    borderRadius: 'calc(var(--radius) - 4px)',
  }),
  multiValueLabel: (provided) => ({
    ...provided,
    color: 'hsl(var(--secondary-foreground))',
    fontSize: '0.875rem',
  }),
  multiValueRemove: (provided) => ({
    ...provided,
    color: 'hsl(var(--muted-foreground))',
    borderRadius: '0 calc(var(--radius) - 4px) calc(var(--radius) - 4px) 0',
    '&:hover': {
      backgroundColor: 'hsl(var(--destructive) / 0.2)',
      color: 'hsl(var(--destructive))',
    },
  }),
  menu: (provided) => ({
    ...provided,
    backgroundColor: 'hsl(var(--popover))',
    borderRadius: 'var(--radius)',
    borderColor: 'hsl(var(--border))',
    zIndex: 50,
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? 'hsl(var(--primary))'
      : state.isFocused
      ? 'hsl(var(--accent))'
      : 'transparent',
    color: state.isSelected
      ? 'hsl(var(--primary-foreground))'
      : 'hsl(var(--popover-foreground))',
    cursor: 'pointer',
    textAlign: 'right',
  }),
  placeholder: (provided) => ({
    ...provided,
    color: 'hsl(var(--muted-foreground))',
  }),
  input: (provided) => ({
    ...provided,
    color: 'hsl(var(--foreground))',
    margin: '0',
    padding: '0',
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
  clearIndicator: (provided) => ({
    ...provided,
    color: 'hsl(var(--muted-foreground))',
    '&:hover': {
      color: 'hsl(var(--foreground))',
    }
  }),
};

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select options...',
  className,
  disabled = false,
}: MultiSelectProps) {

  const handleChange = (selectedOptions: readonly MultiSelectOption[] | null) => {
    const values = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
    console.log("تم اختيار:", values);
    onChange(values);
  };

  const selectedValue = options.filter(option => selected.includes(option.value));

  return (
    <ReactSelect
      isMulti
      options={options}
      value={selectedValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={cn('basic-multi-select', className)}
      classNamePrefix="select"
      isDisabled={disabled}
      isSearchable={true}
      noOptionsMessage={() => "لا توجد نتائج"}
      styles={customStyles}
      isRtl={true}
      components={{
        MultiValueRemove: ({ children, ...props }) => (
          <div {...props.innerProps}>
            <X className="h-3 w-3" />
          </div>
        )
      }}
    />
  );
}
