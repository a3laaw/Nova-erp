'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle, Workflow } from 'lucide-react';
import type { SubService, TransactionType } from '@/lib/types';

interface WbsEditorProps {
  isOpen: boolean;
  onClose: () => void;
  subService: SubService;
  transactionType: TransactionType;
}

export function WbsEditor({ isOpen, onClose, subService, transactionType }: WbsEditorProps) {

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-4xl h-[80vh] flex flex-col p-0 rounded-2xl border-none shadow-2xl bg-white">
        <DialogHeader className="p-8 border-b bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                <Workflow className="h-8 w-8"/>
            </div>
            <div>
                <DialogTitle className="text-2xl font-black text-[#1e1b4b]">
                    محرر هيكل تجزئة العمل (WBS)
                </DialogTitle>
                <DialogDescription className='font-bold'>
                    للخدمة: <span className='text-primary'>{transactionType.name} / {subService.name}</span>
                </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 p-8 overflow-y-auto">
            {/* WBS Tree will be built here */}
            <div className="text-center text-gray-400 py-16 border-4 border-dashed rounded-2xl">
                <p className="font-bold text-lg">سيتم بناء شجرة مراحل العمل هنا.</p>
                <p className="text-sm mt-2">يمكنك إضافة المراحل وتحديد التبعيات والمدد الزمنية.</p>
            </div>
        </div>

        <DialogFooter className="p-8 border-t bg-muted/30">
            <Button variant="outline" onClick={onClose} className="font-bold h-12 px-8 rounded-xl">
                إغلاق
            </Button>
            <Button className="font-black h-12 px-10 rounded-xl shadow-lg shadow-primary/30 gap-2">
                <PlusCircle className="h-5 w-5"/>
                إضافة مرحلة رئيسية
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}