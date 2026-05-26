'use client';

import * as React from 'react';
import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Textarea } from './textarea';
import { useFirebase } from '@/firebase';
import { useSubscription } from '@/hooks/use-subscription';
import type { UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { ScrollArea } from './scroll-area';
import { AtSign, Command } from 'lucide-react';
import { Card } from './card';
import { Badge } from './badge';

interface MentionTextareaProps extends React.ComponentProps<typeof Textarea> {
  onValueChange: (value: string) => void;
}

/**
 * محرك المنشن السيادي العابر للطبقات (Sovereign Portal Mention Engine V128.0):
 * - تم فرض pointer-events: auto لضمان الاستجابة المطلقة داخل النوافذ المنبثقة.
 * - استخدام onMouseDown لمنع فقدان التركيز (Blur) قبل اكتمال عملية الحقن.
 */
export function MentionTextarea({ value, onValueChange, className, ...props }: MentionTextareaProps) {
  const { firestore } = useFirebase();
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0, openUpwards: false });
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const { data: users = [] } = useSubscription<UserProfile>(firestore, 'users');

  const filteredUsers = useMemo(() => {
    const queryStr = (mentionQuery || '').toLowerCase();
    return (users || [])
      .filter(u => 
        u?.username && (
            u.username.toLowerCase().includes(queryStr) || 
            (u.fullName?.toLowerCase() || '').includes(queryStr)
        )
      )
      .slice(0, 8);
  }, [users, mentionQuery]);

  const updateMenuPosition = () => {
    if (textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const shouldOpenUp = spaceBelow < 250;
        
        setMenuPosition({
            top: shouldOpenUp ? rect.top - 8 : rect.bottom + 8,
            left: rect.left,
            width: rect.width,
            openUpwards: shouldOpenUp
        });
    }
  };

  useEffect(() => {
    if (showMentions) {
        updateMenuPosition();
        window.addEventListener('scroll', updateMenuPosition, true);
        window.addEventListener('resize', updateMenuPosition);
    }
    return () => {
        window.removeEventListener('scroll', updateMenuPosition, true);
        window.removeEventListener('resize', updateMenuPosition);
    };
  }, [showMentions]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectUser(filteredUsers[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursor = e.target.selectionStart || 0;
    onValueChange(text);

    const lastAt = text.lastIndexOf('@', cursor - 1);
    if (lastAt !== -1) {
      const queryText = text.slice(lastAt + 1, cursor);
      if (!queryText.includes(' ') && !queryText.includes('\n')) {
        setMentionSearch(queryText);
        setShowMentions(true);
        setSelectedIndex(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const selectUser = (user: UserProfile) => {
    if (!user || !user.username) {
        setShowMentions(false);
        return;
    }

    const text = (value as string) || '';
    const cursor = textareaRef.current?.selectionStart || 0;
    const lastAt = text.lastIndexOf('@', cursor - 1);
    
    if (lastAt === -1) return;

    const before = text.slice(0, lastAt);
    const after = text.slice(cursor);
    const newValue = `${before}@${user.username} ${after}`;
    
    onValueChange(newValue);
    setShowMentions(false);
    
    // إعادة التركيز وتحديد موقع القلم بعد الحقن لضمان استمرارية الكتابة
    setTimeout(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            const usernameLen = user.username?.length || 0;
            const newPos = before.length + usernameLen + 2; 
            textareaRef.current.setSelectionRange(newPos, newPos);
        }
    }, 50);
  };

  const mentionList = showMentions && filteredUsers.length > 0 && mounted ? (
    <Card 
        className={cn(
            "fixed rounded-[2.5rem] border-2 border-primary/30 bg-white overflow-hidden shadow-[0_45px_100px_-20px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-200",
            menuPosition.openUpwards ? "origin-bottom" : "origin-top"
        )}
        style={{ 
            top: menuPosition.openUpwards ? 'auto' : `${menuPosition.top}px`,
            bottom: menuPosition.openUpwards ? `${window.innerHeight - menuPosition.top}px` : 'auto',
            left: `${menuPosition.left}px`,
            width: `${menuPosition.width}px`,
            zIndex: 999999999, // سيادة بصرية مطلقة
            pointerEvents: 'auto' // 🛡️ ضمان استجابة الماوس حتى داخل الـ Modals 🛡️
        }}
        dir="rtl"
        data-radix-popover-content="" // لتفعيل القواعد العامة في globals.css
        data-inline-search-list-options="true"
    >
      <div className="p-4 bg-primary/5 border-b flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="p-1.5 bg-primary rounded-lg">
                <AtSign className="h-4 w-4 text-white" />
            </div>
            <span className="text-[10px] font-black uppercase text-[#1e1b4b] tracking-[0.2em]">إشارة ذكية لزميل</span>
         </div>
         <Badge variant="secondary" className="text-[8px] font-black bg-white border-primary/10 px-3">{filteredUsers.length} متاحين</Badge>
      </div>
      <ScrollArea className="max-h-60">
        <div className="p-2 space-y-1">
          {filteredUsers.map((user, idx) => (
            <button
              key={user.id}
              type="button"
              // 🛡️ استخدام onMouseDown مع منع Blur لضمان الحقن قبل إغلاق القائمة 🛡️
              onMouseDown={(e) => { 
                e.preventDefault(); 
                e.stopPropagation();
                selectUser(user); 
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-2xl transition-all text-right",
                idx === selectedIndex ? "bg-primary text-white scale-[1.01]" : "hover:bg-primary/5 text-black"
              )}
            >
                <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                    <AvatarImage src={user.avatarUrl} className="object-cover" />
                    <AvatarFallback className={cn("font-black text-xs", idx === selectedIndex ? "bg-white/20 text-white" : "bg-primary/10 text-primary")}>
                        {user.username?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                    <p className={cn("font-black text-sm truncate", idx === selectedIndex ? "text-white" : "text-black")}>
                        {user.fullName || user.username}
                    </p>
                    <p className={cn("text-[9px] font-mono", idx === selectedIndex ? "text-white/70" : "text-primary")}>
                        @{user.username}
                    </p>
                </div>
            </button>
          ))}
        </div>
      </ScrollArea>
      <div className="p-2.5 bg-slate-50 border-t flex justify-center">
         <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Command className="h-3 w-3" /> استخدم الأسهم للتحكم و Enter للاختيار
         </p>
      </div>
    </Card>
  ) : null;

  return (
    <div className="relative w-full">
      <Textarea
        {...props}
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShowMentions(false), 200)}
        className={cn(
          "rounded-[2.5rem] p-8 text-xl font-bold leading-relaxed border-2 focus-visible:ring-primary/20 text-black placeholder:text-slate-300 shadow-sm min-h-[140px] bg-white",
          className
        )}
      />
      {mounted && createPortal(mentionList, document.body)}
    </div>
  );
}
