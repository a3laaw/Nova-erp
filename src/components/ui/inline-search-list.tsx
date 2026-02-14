'use client';

import * as React from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

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
  const [search, setSearch] = React.useState('');
  const [showOptions, setShowOptions] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Update the displayed text when the value changes externally
  React.useEffect(() => {
    const selectedLabel = options.find(opt => opt.value === value)?.label || '';
    setSearch(selectedLabel);
  }, [value, options]);

  // Handle user typing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearch = e.target.value;
    setSearch(newSearch);
    if (newSearch === '') {
      onSelect('');
    }
    setShowOptions(true);
  };

  // Handle selecting an option from the list
  const handleSelectOption = (option: SearchOption) => {
    setSearch(option.label);
    onSelect(option.value);
    setShowOptions(false);
  };
  
  // Close the dropdown when clicking outside the component
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowOptions(false);
        // Find an exact match for what the user typed
        const match = options.find(opt => opt.label.toLowerCase() === search.toLowerCase());

        if (match) {
          if (match.value !== value) {
            onSelect(match.value);
          }
          setSearch(match.label);
        } else {
          // If there's no match, revert to the last valid selected value
          const selectedLabel = options.find(opt => opt.value === value)?.label || '';
          setSearch(selectedLabel);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, options, search, onSelect]);


  const filteredOptions = React.useMemo(() => {
    if (!search) {
      return options; 
    }
    return options.filter(opt =>
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      (opt.searchKey && opt.searchKey.toLowerCase().includes(search.toLowerCase()))
    );
  }, [options, search]);

  const MAX_DISPLAY_ITEMS = 50; // Display only 50 results for performance
  const displayOptions = filteredOptions.slice(0, MAX_DISPLAY_ITEMS);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        value={search}
        placeholder={placeholder}
        onFocus={() => !disabled && setShowOptions(true)}
        onChange={handleInputChange}
        disabled={disabled}
        autoComplete="off"
      />
      {showOptions && !disabled && (
        <div data-inline-search-list-options className="absolute z-[9999] mt-1 w-full rounded-md border bg-card shadow-lg">
          <ul className="max-h-60 overflow-y-auto p-1">
            {displayOptions.length > 0 ? (
              <>
                {displayOptions.map(opt => (
                  <li
                    key={opt.value}
                    className="cursor-pointer p-2 text-sm rounded-md hover:bg-accent"
                    onMouseDown={(e) => { 
                      e.preventDefault(); // Prevent input blur before selection
                      handleSelectOption(opt);
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span>{opt.label}</span>
                      {opt.searchKey && <span className="text-xs text-muted-foreground dir-ltr">{opt.searchKey}</span>}
                    </div>
                  </li>
                ))}
                {filteredOptions.length > MAX_DISPLAY_ITEMS && (
                  <li className="p-2 text-xs text-center text-muted-foreground">
                    ... و {filteredOptions.length - MAX_DISPLAY_ITEMS} نتائج أخرى
                  </li>
                )}
              </>
            ) : (
              <li className="p-2 text-sm text-center text-muted-foreground">لا توجد نتائج</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
