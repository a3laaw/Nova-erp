'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Textarea } from './textarea';
import { useFirebase } from '@/firebase';
import { useSubscription } from '@/hooks/use-subscription';
import type { UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { ScrollArea } from './scroll-area';
import { AtSign, User } from 'lucide-react';
import { Card } from './card';
import { Badge } from './badge';

interface MentionTextareaProps extends React.ComponentProps<typeof Textarea> {
  onValueChange: (value: string) => void;
}

/**
 * مكون مساحة النص مع المنشن الذكي (Sovereign Mention Engine V119.0):
 * - تم تحويل المحاذاة لجهة اليمين (right-0) لتناسب واجهة RTL وتكون قريبة من حرف @.
 * - تحصين الفلترة ضد القيم غير المعرفة (undefined) لمنع انهيار الواجهة.
 */
export function MentionTextarea({ value, onValueChange, className, ...props }: MentionTextareaProps) {
  const { firestore } = useFirebase();
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // جلب كافة مستخدمي المنشأة
  const { data: users = [] } = useSubscription<UserProfile>(firestore, 'users');

  const filteredUsers = useMemo(() => {
    const queryStr = (mentionQuery || '').toLowerCase();
    return (users || [])
      .filter(u => 
        (u?.username?.toLowerCase() || '').includes(queryStr) || 
        (u?.fullName?.toLowerCase() || '').includes(queryStr)
      )
      .slice(0, 8);
  }, [users, mentionQuery]);

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
    const text = (value as string) || '';
    const cursor = textareaRef.current?.selectionStart || 0;
    const lastAt = text.lastIndexOf('@', cursor - 1);
    
    const before = text.slice(0, lastAt);
    const after = text.slice(cursor);
    const newValue = `${before}@${user.username} ${after}`;
    
    onValueChange(newValue);
    setShowMentions(false);
    
    // إعادة التركيز للمساحة النصية
    setTimeout(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            const newPos = before.length + user.username.length + 2;
            textareaRef.current.setSelectionRange(newPos, newPos);
        }
    }, 10);
  };

  return (
    <div className="relative w-full">
      <Textarea
        {...props}
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        className={cn(
          "rounded-[2rem] p-6 text-lg font-bold leading-relaxed border-2 focus-visible:ring-primary/20 text-black placeholder:text-slate-300",
          className
        )}
      />

      {showMentions && filteredUsers.length > 0 && (
        <Card className="absolute top-full right-0 mt-2 z-[9999] w-72 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-2 border-primary/20 bg-white/95 backdrop-blur-xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
          <div className="p-3 bg-primary/5 border-b flex items-center justify-between">
             <div className="flex items-center gap-2">
                <AtSign className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-black uppercase text-primary tracking-widest">إشارة إلى زميل</span>
             </div>
             <Badge variant="secondary" className="text-[8px] font-black bg-white">{filteredUsers.length} نتائج</Badge>
          </div>
          <ScrollArea className="max-h-64">
            <div className="p-2 space-y-1">
              {filteredUsers.map((user, idx) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => selectUser(user)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-right",
                    idx === selectedIndex ? "bg-primary text-white shadow-lg scale-[1.02]" : "hover:bg-primary/5 text-black"
                  )}
                >
                  <div className="relative">
                      <Avatar className="h-8 w-8 border-2 border-white shadow-sm">
                        <AvatarImage src={user.avatarUrl} className="object-cover" />
                        <AvatarFallback className="bg-primary/10 text-primary font-black text-[10px]">{user.username?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                      {idx === selectedIndex && <div className="absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 bg-white rounded-full flex items-center justify-center shadow-sm"><div className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse" /></div>}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-black text-xs truncate leading-none">{user.fullName || user.username}</p>
                    <p className={cn("text-[9px] font-bold mt-1", idx === selectedIndex ? "text-white/70" : "text-primary")}>@{user.username}</p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
