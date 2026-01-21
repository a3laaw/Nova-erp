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

  const selectedLabel = React.useMemo(() => {
    return options.find(opt => opt.value === value)?.label || '';
  }, [options, value]);

  React.useEffect(() => {
    setSearch(selectedLabel);
  }, [selectedLabel]);

  // Close dropdown if clicked outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredOptions = React.useMemo(() =>
    options.filter(opt =>
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      (opt.searchKey && opt.searchKey.toLowerCase().includes(search.toLowerCase()))
    ),
  [options, search]);

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
          if (value) onSelect(''); // Clear selection on new typing
        }}
        disabled={disabled}
      />
      {showOptions && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-card shadow-lg">
          <ul className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
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
