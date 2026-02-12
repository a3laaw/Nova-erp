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
  
  // Effect to set the initial search text when a value is provided
  React.useEffect(() => {
    const selectedLabel = options.find(opt => opt.value === value)?.label || '';
    setSearch(selectedLabel);
  }, [value, options]);


  // Close dropdown if clicked outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowOptions(false);
        // If user clicks away without selecting, revert to the selected value's label or clear if no value
        const selectedLabel = options.find(opt => opt.value === value)?.label || '';
        setSearch(selectedLabel);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [value, options]);

  const filteredOptions = React.useMemo(() => {
    // If the search text exactly matches the label of the selected value, don't show options.
    const selectedLabel = options.find(opt => opt.value === value)?.label;
    if (search === selectedLabel && value) {
        return [];
    }

    return options.filter(opt =>
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      (opt.searchKey && opt.searchKey.toLowerCase().includes(search.toLowerCase()))
    );
  }, [options, search, value]);

  const MAX_DISPLAY_ITEMS = 50;
  const displayOptions = filteredOptions.slice(0, MAX_DISPLAY_ITEMS);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        value={search}
        placeholder={placeholder}
        onFocus={() => !disabled && setShowOptions(true)}
        onChange={(e) => {
          setSearch(e.target.value);
          setShowOptions(true);
        }}
        onBlur={() => {
            // A short delay to allow click events on options to register
            setTimeout(() => {
                // If options are still showing (meaning no selection was made)
                // revert the input to the last known good state
                if (showOptions) {
                    const selectedLabel = options.find(opt => opt.value === value)?.label || '';
                    setSearch(selectedLabel);
                    setShowOptions(false);
                }
            }, 150);
        }}
        disabled={disabled}
        autoComplete="off"
      />
      {showOptions && !disabled && (
        <div data-inline-search-list-options className="absolute z-50 mt-1 w-full rounded-md border bg-card shadow-lg">
          <ul className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length === 0 && search.trim() !== '' ? (
              <li className="p-2 text-sm text-center text-muted-foreground">لا توجد نتائج</li>
            ) : (
              <>
                {displayOptions.map(opt => (
                  <li
                    key={opt.value}
                    className="cursor-pointer p-2 text-sm rounded-md hover:bg-accent"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(opt.value);
                      setSearch(opt.label);
                      setShowOptions(false);
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
            )}
          </ul>
        </div>
      )}
    </div>
  );
}