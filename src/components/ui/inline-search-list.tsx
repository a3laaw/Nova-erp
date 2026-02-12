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

  // Sync the input text when the external `value` prop changes.
  // This happens when the form is first loaded or reset.
  React.useEffect(() => {
    const selectedLabel = options.find(opt => opt.value === value)?.label || '';
    setSearch(selectedLabel);
  }, [value, options]);

  // Handle user typing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearch = e.target.value;
    setSearch(newSearch);
    // If user clears the input, we should also clear the underlying value
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
  
  // Handle clicking outside the component
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowOptions(false);
        // On blur, if the text doesn't match a valid option, revert to the last valid selection.
        const currentSelectionLabel = options.find(opt => opt.value === value)?.label || '';
        setSearch(currentSelectionLabel);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, options]);


  const filteredOptions = React.useMemo(() => {
    if (!search) {
      return options; // Show all options if search is empty
    }
    return options.filter(opt =>
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      (opt.searchKey && opt.searchKey.toLowerCase().includes(search.toLowerCase()))
    );
  }, [options, search]);

  const MAX_DISPLAY_ITEMS = 50;
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
        <div data-inline-search-list-options className="absolute z-50 mt-1 w-full rounded-md border bg-card shadow-lg">
          <ul className="max-h-60 overflow-y-auto p-1">
            {displayOptions.length > 0 ? (
              <>
                {displayOptions.map(opt => (
                  <li
                    key={opt.value}
                    className="cursor-pointer p-2 text-sm rounded-md hover:bg-accent"
                    onMouseDown={(e) => { // Use onMouseDown to fire before blur
                      e.preventDefault();
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
