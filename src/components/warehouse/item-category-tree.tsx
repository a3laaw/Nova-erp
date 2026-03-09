'use client';

import * as React from 'react';
import type { ItemCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Search } from 'lucide-react';
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
      if (newSet.has(node.id!)) newSet.delete(node.id!);
      else newSet.add(node.id!);
      return newSet;
    });
  };

  return (
    <div style={{ paddingRight: `${level * 1.5}rem` }}>
      <div 
        className={cn(
            "flex items-center justify-between p-2 rounded-md cursor-pointer group",
            selectedCategoryId === node.id ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted/50'
        )}
        onClick={() => onSelectCategory(node.id!)}
      >
        <div className="flex items-center gap-2">
          {node.children.length > 0 ? (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleOpen}>
              {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
          ) : (
             <span className="w-6 h-6 inline-block ml-2" />
          )}
          <span className="text-sm">{node.name}</span>
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

export function ItemCategoryTree({ categories, loading, selectedCategoryId, onSelectCategory }: {
    categories: ItemCategory[];
    loading: boolean;
    selectedCategoryId: string | null;
    onSelectCategory: (id: string | null) => void;
}) {
    const [openCategories, setOpenCategories] = React.useState(new Set<string>());
    const [searchQuery, setSearchQuery] = React.useState('');

    // Safe effect to handle search expansion without infinite loops
    React.useEffect(() => {
        if (searchQuery.trim() === '') return;
        const lowerQuery = searchQuery.toLowerCase();
        const toOpen = new Set<string>();
        
        categories.forEach(cat => {
            if (cat.name.toLowerCase().includes(lowerQuery)) {
                let current = cat;
                while (current.parentCategoryId) {
                    toOpen.add(current.parentCategoryId);
                    const parent = categories.find(c => c.id === current.parentCategoryId);
                    if (!parent) break;
                    current = parent;
                }
            }
        });
        
        if (toOpen.size > 0) {
            setOpenCategories(prev => new Set([...prev, ...toOpen]));
        }
    }, [searchQuery, categories]);

    const categoryTree = React.useMemo(() => {
        const map = new Map<string, CategoryNode>();
        const roots: CategoryNode[] = [];

        categories.forEach(cat => {
            map.set(cat.id!, { ...cat, children: [] });
        });

        categories.forEach(cat => {
            if (cat.parentCategoryId && map.has(cat.parentCategoryId)) {
                map.get(cat.parentCategoryId)!.children.push(map.get(cat.id!)!);
            } else {
                roots.push(map.get(cat.id!)!);
            }
        });

        const sortRecursive = (nodes: CategoryNode[]) => {
            nodes.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name, 'ar'));
            nodes.forEach(node => { if (node.children.length > 0) sortRecursive(node.children); });
        };
        sortRecursive(roots);
        return roots;
    }, [categories]);

    return (
        <div className="border rounded-xl p-3 bg-card shadow-sm h-full">
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="ابحث عن فئة..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-9 text-xs rounded-lg"
                />
            </div>

            <Button
                variant="ghost"
                className={cn(
                    "w-full justify-start p-2 mb-2 font-bold",
                    selectedCategoryId === null && 'bg-primary/10 text-primary'
                )}
                onClick={() => onSelectCategory(null)}
            >
                جميع الفئات
            </Button>
            <Separator className="my-2" />
            <ScrollArea className="h-[calc(100vh-350px)]">
                {loading ? <div className="p-4 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" /></div> :
                categoryTree.length === 0 ? <p className="text-center text-muted-foreground p-4 text-xs">لا توجد فئات.</p> :
                categoryTree.map(node => (
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
            </ScrollArea>
        </div>
    )
}
