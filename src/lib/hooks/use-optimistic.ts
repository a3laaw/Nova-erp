'use client';

import { useState, useCallback, useRef } from 'react';

export function useOptimistic<T extends { id?: string }>(
  initialData: T[],
  updateFn: (newData: T[]) => Promise<void>
) {
  const [data, setData] = useState<T[]>(initialData);
  const [isOptimistic, setIsOptimistic] = useState(false);

  // ✅ FIX: Make the update function stable by removing the `data` dependency
  // and using the functional form of `setData` to access the latest state.

  const addOptimistic = useCallback(async (item: T, tempId: string) => {
    const optimisticItem = { ...item, id: tempId };
    let originalData: T[] | null = null;

    setData(currentData => {
      originalData = currentData;
      return [optimisticItem, ...currentData];
    });

    setIsOptimistic(true);
    
    try {
      const newData = [optimisticItem, ...(originalData!)]
      await updateFn(newData);
      setIsOptimistic(false);
    } catch (error) {
      setData(originalData!); // Revert to original data
      setIsOptimistic(false);
      throw error;
    }
  }, [updateFn]);

  const updateOptimistic = useCallback(async (id: string, updates: Partial<T>) => {
    let originalData: T[] | null = null;

    setData(currentData => {
      originalData = currentData;
      return currentData.map(item => 
        item.id === id ? { ...item, ...updates } as T : item
      );
    });
    
    setIsOptimistic(true);
    
    try {
      const newData = originalData!.map(item => 
        item.id === id ? { ...item, ...updates } as T : item
      );
      await updateFn(newData);
      setIsOptimistic(false);
    } catch (error) {
      setData(originalData!); // Revert
      setIsOptimistic(false);
      throw error;
    }
  }, [updateFn]);

  const deleteOptimistic = useCallback(async (id: string) => {
    let originalData: T[] | null = null;
    
    setData(currentData => {
        originalData = currentData;
        return currentData.filter(item => item.id !== id);
    });

    setIsOptimistic(true);
    
    try {
      const newData = originalData!.filter(item => item.id !== id);
      await updateFn(newData);
      setIsOptimistic(false);
    } catch (error) {
      setData(originalData!); // Revert
      setIsOptimistic(false);
      throw error;
    }
  }, [updateFn]);

  return { data, isOptimistic, addOptimistic, updateOptimistic, deleteOptimistic };
}
