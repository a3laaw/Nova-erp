'use client';

import * as React from 'react';
import { useState, useRef, useMemo, useEffect } from 'react';
import { Textarea } from './textarea';
import { useFirebase } from '@/firebase';
import { useSubscription } from '@/hooks/use-subscription';
import type { UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { ScrollArea } from './scroll-area';
import { AtSign, Sparkles, Command } from 'lucide-react';
import { Card } from './card';
import { Badge } from './badge';

interface MentionTextareaProps extends React.ComponentProps<typeof Textarea> {
  onValueChange: (value: string) => void;
}

/**
 * محرك المنشن الذكي المتكيف (Sovereign Adaptive Mention Engine V124.0):
 * - محرك "التفكير المكاني": يحدد اتجاه الفتح (أعلى/أسفل) بناءً على المساحة المتاحة.
 * - عزل بصري مطلق بـ z-index سيادي لمنع أي تداخل مع رؤوس النوافذ أو التبويبات.
 * - تباين أسود (#000000) للوضوح المطلق في الواجهة العربية اللؤلؤية.
 */
export function MentionTextarea({ value, onValueChange, className, ...props }: MentionTextareaProps) {
  const { firestore } = useFirebase();
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [openUpwards, setOpenUpwards] = useState(false); // ذكاء التموضع
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // جلب كافة مستخدمي المنشأة
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

  // محرك الذكاء المكاني: فحص المساحة المتاحة عند ظهور المؤشر
  useEffect(() => {
    if (showMentions && textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        // إذا كانت المساحة تحت النص أقل من 250px، نفتح للأعلى
        setOpenUpwards(spaceBelow < 250);
    }
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
    
    const before = text.slice(0, lastAt);
    const after = text.slice(cursor);
    const newValue = `${before}@${user.username} ${after}`;
    
    onValueChange(newValue);
    setShowMentions(false);
    
    setTimeout(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            const usernameLen = user.username?.length || 0;
            const newPos = before.length + usernameLen + 2; 
            textareaRef.current.setSelectionRange(newPos, newPos);
        }
    }, 10);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <Textarea
        {...props}
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        className={cn(
          "rounded-[2.5rem] p-8 text-xl font-bold leading-relaxed border-2 focus-visible:ring-primary/20 text-black placeholder:text-slate-300 shadow-sm min-h-[140px] bg-white",
          className
        )}
      />

      {showMentions && filteredUsers.length > 0 && (
        <Card className={cn(
            "absolute w-full max-w-[340px] rounded-[2.5rem] border-2 border-primary/30 bg-white overflow-hidden animate-in zoom-in-95 duration-300",
            openUpwards ? "bottom-full mb-3" : "top-full mt-3", // ذكاء الاتجاه
            "right-2", // محاذاة RTL الصحيحة
            "z-[999999999] shadow-[0_45px_100px_-20px_rgba(0,0,0,0.5)]" // سيادة مطلقة وظل سينمائي
        )}>
          <div className="p-5 bg-primary/5 border-b flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="p-1.5 bg-primary rounded-lg shadow-lg">
                    <AtSign className="h-4 w-4 text-white" />
                </div>
                <span className="text-[10px] font-black uppercase text-[#1e1b4b] tracking-[0.2em]">إشارة ذكية لزميل</span>
             </div>
             <Badge variant="secondary" className="text-[8px] font-black bg-white border-primary/10 shadow-sm px-3">{filteredUsers.length} زملاء</Badge>
          </div>
          <ScrollArea className="max-h-72">
            <div className="p-3 space-y-1.5">
              {filteredUsers.map((user, idx) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => selectUser(user)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-3xl transition-all text-right group/item",
                    idx === selectedIndex ? "bg-primary text-white shadow-xl scale-[1.02]" : "hover:bg-primary/5 text-black"
                  )}
                >
                  <div className="relative shrink-0">
                      <Avatar className="h-12 w-12 border-2 border-white shadow-md group-hover/item:scale-105 transition-transform">
                        <AvatarImage src={user.avatarUrl} className="object-cover" />
                        <AvatarFallback className={cn("font-black text-sm", idx === selectedIndex ? "bg-white/20 text-white" : "bg-primary/10 text-primary")}>
                            {user.username?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className={cn("font-black text-base truncate leading-none mb-1.5", idx === selectedIndex ? "text-white" : "text-[#000000]")}>
                        {user.fullName || user.username}
                    </p>
                    <p className={cn("text-[10px] font-bold font-mono tracking-wider", idx === selectedIndex ? "text-white/70" : "text-primary")}>
                        @{user.username}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
          <div className="p-3 bg-slate-50 border-t flex justify-center">
             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Command className="h-3 w-3" /> استخدم الأسهم للتنقل و Enter للاختيار
             </p>
          </div>
        </Card>
      )}
    </div>
  );
}
