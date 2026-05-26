'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Textarea } from './textarea';
import { useFirebase, useSubscription } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { ScrollArea } from './scroll-area';
import { Badge } from './badge';
import { AtSign, Search, User } from 'lucide-react';

interface MentionTextareaProps extends React.ComponentProps<typeof Textarea> {
  onValueChange: (value: string) => void;
}

/**
 * مكون مساحة النص مع المنشن الذكي (Sovereign Mention Engine V1.0):
 * - يظهر قائمة مستخدمين عند كتابة @.
 * - يدعم الاختيار بالماوس أو لوحة المفاتيح.
 * - يضمن تباين النصوص باللون الأسود القوي.
 */
export function MentionTextarea({ value, onValueChange, className, ...props }: MentionTextareaProps) {
  const { firestore } = useFirebase();
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // جلب كافة مستخدمي المنشأة
  const { data: users, loading } = useSubscription<UserProfile>(firestore, 'users');

  const filteredUsers = useMemo(() => {
    const query = mentionQuery.toLowerCase();
    return users
      .filter(u => u.username.toLowerCase().includes(query) || u.fullName?.toLowerCase().includes(query))
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
    const cursor = e.target.selectionStart;
    onValueChange(text);

    // البحث عن آخر @ قبل مكان المؤشر
    const lastAt = text.lastIndexOf('@', cursor - 1);
    if (lastAt !== -1) {
      const queryText = text.slice(lastAt + 1, cursor);
      // تأكد أنه لا توجد مسافات بين @ والكلمة
      if (!queryText.includes(' ')) {
        setMentionSearch(queryText);
        setShowMentions(true);
        // حساب موقع القائمة (تقريبي أسفل المساحة)
        setCoords({ top: 40, left: 0 }); 
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
    textareaRef.current?.focus();
  };

  return (
    <div className="relative w-full group">
      <Textarea
        {...props}
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        className={cn(
          "rounded-[2.5rem] p-8 text-xl leading-relaxed font-black placeholder:italic bg-transparent text-black",
          className
        )}
      />

      {showMentions && filteredUsers.length > 0 && (
        <Card className="absolute z-[9999] w-72 rounded-[2rem] shadow-2xl border-2 border-primary/20 bg-white/95 backdrop-blur-xl overflow-hidden animate-in zoom-in-95 duration-200 mt-2">
          <div className="p-3 bg-primary/5 border-b flex items-center gap-2">
             <AtSign className="h-3 w-3 text-primary" />
             <span className="text-[10px] font-black uppercase text-primary tracking-widest">إشارة إلى زميل</span>
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
                  <Avatar className="h-8 w-8 border-2 border-white shadow-sm">
                    <AvatarImage src={user.avatarUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-[10px]">{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-black text-xs truncate">{user.fullName || user.username}</p>
                    <p className={cn("text-[9px] font-bold opacity-60", idx === selectedIndex ? "text-white/70" : "text-primary")}>@{user.username}</p>
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
