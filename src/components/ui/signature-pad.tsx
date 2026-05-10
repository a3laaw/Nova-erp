'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Button } from './button';
import { Eraser, Check, MousePointer2 } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  onClear?: () => void;
  width?: number;
  height?: number;
}

/**
 * مكوّن بصمة التوقيع الرقمي السيادي:
 * يستخدم لرسم التوقيع الحي على المستندات الرسمية (كشف الأعمال، العقود).
 */
export function SignaturePad({ onSave, onClear, width = 400, height = 200 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasSignature(true);
    }
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
      onClear?.();
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative border-4 border-dashed border-primary/20 rounded-[2rem] bg-slate-50 overflow-hidden touch-none h-48">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair w-full h-full"
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
            <MousePointer2 className="h-10 w-10 mb-2 text-primary" />
            <p className="font-black text-sm">وقع هنا (بالإصبع أو الماوس)</p>
          </div>
        )}
      </div>
      
      <div className="flex justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={clearCanvas} className="rounded-xl border-red-200 text-red-600 font-bold gap-2">
          <Eraser className="h-4 w-4" /> مسح التوقيع
        </Button>
        <Button 
          type="button" 
          size="sm" 
          onClick={() => canvasRef.current && onSave(canvasRef.current.toDataURL())} 
          disabled={!hasSignature}
          className="rounded-xl font-black gap-2 px-8"
        >
          <Check className="h-4 w-4" /> اعتماد التوقيع الرقمي
        </Button>
      </div>
    </div>
  );
}
