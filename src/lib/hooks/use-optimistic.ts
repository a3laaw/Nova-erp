'use client';
import { useState, useCallback } from 'react';

export function useOptimistic<T extends { id?: string }>(
  initialData: T[],
  updateFn: (newData: T[]) => Promise<void>
) {
  const [data, setData] = useState<T[]>(initialData);
  const [isOptimistic, setIsOptimistic] = useState(false);

  const addOptimistic = useCallback(async (item: T, tempId: string) => {
    const originalData = data;
    const optimisticItem = { ...item, id: tempId };
    const newData = [optimisticItem, ...originalData];

    setData(newData);
    setIsOptimistic(true);
    
    try {
      await updateFn(newData);
      setIsOptimistic(false);
    } catch (error) {
      setData(originalData); // Revert to original data
      setIsOptimistic(false);
      throw error;
    }
  }, [data, updateFn]);

  const updateOptimistic = useCallback(async (id: string, updates: Partial<T>) => {
    const originalData = data;
    const newData = originalData.map(item => 
      item.id === id ? { ...item, ...updates } as T : item
    );
    
    setData(newData);
    setIsOptimistic(true);
    
    try {
      await updateFn(newData);
      setIsOptimistic(false);
    } catch (error) {
      setData(originalData); // Revert
      setIsOptimistic(false);
      throw error;
    }
  }, [data, updateFn]);

  const deleteOptimistic = useCallback(async (id: string) => {
    const originalData = data;
    const newData = originalData.filter(item => item.id !== id);

    setData(newData);
    setIsOptimistic(true);
    
    try {
      await updateFn(newData);
      setIsOptimistic(false);
    } catch (error) {
      setData(originalData); // Revert
      setIsOptimistic(false);
      throw error;
    }
  }, [data, updateFn]);

  return {
    data,
    setData, // Exposing setData to allow external updates from real-time listeners
    isOptimistic,
    addOptimistic,
    updateOptimistic,
    deleteOptimistic
  };
}
