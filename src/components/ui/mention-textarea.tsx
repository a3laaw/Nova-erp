'use client';

import * as React from 'react';
import { useState, useRef, useMemo } from 'react';
import { Textarea } from './textarea';
import { useFirebase } from '@/firebase';
import { useSubscription } from '@/hooks/use-subscription';
import type { UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { ScrollArea } from './scroll-area';
import { AtSign, Sparkles } from 'lucide-react';
import { Card } from './card';
import { Badge } from './badge';

interface MentionTextareaProps extends React.ComponentProps<typeof Textarea> {
  onValueChange: (value: string) => void;
}

/**
 * محرك المنشن المتكيف (Adaptive Sovereign Mention Engine V121.0):
 * - يظهر آلياً للأعلى (Above) لضمان عدم القص في النوافذ السفلية.
 * - تحصين مطلق لبيانات المستخدمين لمنع انهيار الواجهة.
 * - تصميم عائم لؤلؤي يتناسب مع الهوية البصرية للمكتب.
 */
export function MentionTextarea({ value, onValueChange, className, ...props }: MentionTextareaProps) {
  const { firestore } = useFirebase();
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // جلب كافة مستخدمي المنشأة مع ضمان وجود بيانات آمنة
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
    // 🛡️ درع حماية سيادي: التأكد من وجود كائن المستخدم واسم المستخدم 🛡️
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
    
    // إعادة التركيز وتحديد موقع المؤشر بدقة
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
    <div className="relative w-full">
      <Textarea
        {...props}
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        className={cn(
          "rounded-[2.5rem] p-8 text-xl font-bold leading-relaxed border-2 focus-visible:ring-primary/20 text-black placeholder:text-slate-300 shadow-sm",
          className
        )}
      />

      {showMentions && filteredUsers.length > 0 && (
        <Card className={cn(
            "absolute z-[9999] w-full max-w-[340px] rounded-[2.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.3)] border-2 border-primary/30 bg-white/98 backdrop-blur-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-300",
            "bottom-full mb-4 right-4" // ظهور للأعلى لتجنب القص في النماذج السفلية
        )}>
          <div className="p-5 bg-gradient-to-l from-primary/10 to-transparent border-b flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="p-1.5 bg-primary rounded-lg shadow-lg shadow-primary/20">
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
                    idx === selectedIndex ? "bg-primary text-white shadow-xl scale-[1.02] -translate-y-0.5" : "hover:bg-primary/5 text-black"
                  )}
                >
                  <div className="relative shrink-0">
                      <Avatar className="h-12 w-12 border-2 border-white shadow-md group-hover/item:scale-105 transition-transform">
                        <AvatarImage src={user.avatarUrl} className="object-cover" />
                        <AvatarFallback className={cn("font-black text-sm", idx === selectedIndex ? "bg-white/20 text-white" : "bg-primary/10 text-primary")}>
                            {user.username?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      {idx === selectedIndex && (
                        <div className="absolute -bottom-1 -left-1 h-4 w-4 bg-white rounded-full flex items-center justify-center shadow-lg">
                            <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                        </div>
                      )}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-black text-base truncate leading-none mb-1.5">{user.fullName || user.username}</p>
                    <p className={cn("text-[10px] font-bold font-mono tracking-wider", idx === selectedIndex ? "text-white/70" : "text-primary")}>@{user.username}</p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
          <div className="p-3 bg-slate-50 border-t flex justify-center">
             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="h-2 w-2" /> استخدم الأسهم للتنقل و Enter للاختيار
             </p>
          </div>
        </Card>
      )}
    </div>
  );
}
