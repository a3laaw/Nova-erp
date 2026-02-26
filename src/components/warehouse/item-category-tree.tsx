
'use client';

import * as React from 'react';
import type { ItemCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Folder, FolderOpen, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import { Loader2 } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Input } from '../ui/input';

interface CategoryNode extends ItemCategory {
  children: CategoryNode[];
}

function CategoryTreeItem({
  node,
  level,
  onSelectCategory,
  selectedCategoryId,
  openCategories,
  setOpenCategories,
}: {
  node: CategoryNode;
  level: number;
  onSelectCategory: (id: string | null) => void;
  selectedCategoryId: string | null;
  openCategories: Set<string>;
  setOpenCategories: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const isOpen = openCategories.has(node.id!);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(node.id!)) {
        newSet.delete(node.id!);
      } else {
        newSet.add(node.id!);
      }
      return newSet;
    });
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectCategory(node.id!);
  };

  return (
    <div style={{ paddingRight: `${level * 1.5}rem` }}>
      <div 
        className={cn(
            "flex items-center justify-between p-2 rounded-md cursor-pointer group",
            selectedCategoryId === node.id ? 'bg-primary/10' : 'hover:bg-muted/50'
        )}
        onClick={handleSelect}
      >
        <div className="flex items-center gap-2">
          {node.children.length > 0 ? (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleOpen}>
              {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
          ) : (
             <span className="w-6 h-6 inline-block" /> // Spacer
          )}
          <span className="font-medium">{node.name}</span>
        </div>
      </div>
      {isOpen && node.children.map(child => (
        <CategoryTreeItem
          key={child.id}
          node={child}
          level={level + 1}
          onSelectCategory={onSelectCategory}
          selectedCategoryId={selectedCategoryId}
          openCategories={openCategories}
          setOpenCategories={setOpenCategories}
        />
      ))}
    </div>
  );
}


interface ItemCategoryTreeProps {
    categories: ItemCategory[];
    loading: boolean;
    selectedCategoryId: string | null;
    onSelectCategory: (id: string | null) => void;
}

export function ItemCategoryTree({ categories, loading, selectedCategoryId, onSelectCategory }: ItemCategoryTreeProps) {
    const [openCategories, setOpenCategories] = React.useState(new Set<string>());
    const [searchQuery, setSearchQuery] = React.useState('');

    const categoryTree = React.useMemo(() => {
        if (!categories) return [];

        const categoryMap = new Map<string, ItemCategory & { parent?: string }>();
        categories.forEach(cat => categoryMap.set(cat.id!, { ...cat, parent: cat.parentCategoryId || undefined }));

        let filteredCategories = categories;

        if (searchQuery.trim() !== '') {
            const lowercasedQuery = searchQuery.toLowerCase();
            const matchedCategoryIds = new Set<string>();

            // Find categories that match the search query
            for (const category of categories) {
                if (category.name.toLowerCase().includes(lowercasedQuery)) {
                    matchedCategoryIds.add(category.id!);
                }
            }

            // For each matched category, find all its ancestors and add them to the set
            const allVisibleIds = new Set<string>(matchedCategoryIds);
            matchedCategoryIds.forEach(id => {
                let current = categoryMap.get(id);
                while (current && current.parent) {
                    allVisibleIds.add(current.parent);
                    current = categoryMap.get(current.parent);
                }
            });
            
            // Expand all parents of matched items
            const newOpenCategories = new Set<string>();
            allVisibleIds.forEach(id => {
                let current = categoryMap.get(id);
                while (current && current.parent) {
                    newOpenCategories.add(current.parent);
                    current = categoryMap.get(current.parent);
                }
            });
            setOpenCategories(newOpenCategories);


            filteredCategories = categories.filter(cat => allVisibleIds.has(cat.id!));
        } else {
             setOpenCategories(new Set<string>());
        }

        const map = new Map<string, ItemCategory & { children: any[] }>();
        const roots: (ItemCategory & { children: any[] })[] = [];

        filteredCategories.forEach(cat => {
            map.set(cat.id!, { ...cat, children: [] });
        });

        filteredCategories.forEach(cat => {
            if (cat.parentCategoryId && map.has(cat.parentCategoryId)) {
                map.get(cat.parentCategoryId)!.children.push(map.get(cat.id!)!);
            } else {
                roots.push(map.get(cat.id!)!);
            }
        });

        const sortRecursive = (nodes: (ItemCategory & { children: any[] })[]) => {
            nodes.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name, 'ar'));
            nodes.forEach(node => {
                if (node.children.length > 0) {
                    sortRecursive(node.children);
                }
            });
        };
        sortRecursive(roots);

        return roots;
    }, [categories, searchQuery]);

    return (
        <div className="border rounded-lg p-2 min-h-[300px]">
            <div className="relative mb-2">
                <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="ابحث عن فئة..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rtl:pr-10"
                />
            </div>

            <Button
                variant="ghost"
                className={cn(
                    "w-full justify-start p-2",
                    selectedCategoryId === null && 'bg-primary/10'
                )}
                onClick={() => onSelectCategory(null)}
            >
                جميع الفئات
            </Button>
            <Separator className="my-2" />
            <div className="max-h-[60vh] overflow-y-auto">
                {loading && <div className="p-4 text-center"><Loader2 className="animate-spin" /></div>}
                {!loading && categoryTree.length === 0 && <p className="text-center text-muted-foreground p-4">لا توجد فئات تطابق البحث.</p>}
                {!loading && categoryTree.map(node => (
                    <CategoryTreeItem 
                        key={node.id} 
                        node={node} 
                        level={0}
                        onSelectCategory={onSelectCategory}
                        selectedCategoryId={selectedCategoryId}
                        openCategories={openCategories}
                        setOpenCategories={setOpenCategories}
                    />
                ))}
            </div>
        </div>
    )
}
