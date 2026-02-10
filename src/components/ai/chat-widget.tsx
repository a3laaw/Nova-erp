'use client';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, MessageSquare, Send, User, Loader2, X as CloseIcon } from 'lucide-react';
import { askSystemExpert, type SystemExpertInput } from '@/ai/flows/ask-system-expert';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';


type Message = {
  role: 'user' | 'model';
  content: string;
};

export function SystemExpertChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
    useEffect(() => {
        if (scrollAreaRef.current) {
            const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) {
                viewport.scrollTop = viewport.scrollHeight;
            }
        }
    }, [messages, isLoading]);


  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
        const history = messages.map(m => ({ role: m.role, content: m.content }));
        const response = await askSystemExpert({ question: input, history });
        const modelMessage: Message = { role: 'model', content: response.answer };
        setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
        console.error("Error asking system expert:", error);
        const errorMessage: Message = { role: 'model', content: "عذرًا، حدث خطأ أثناء معالجة طلبك." };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
    }
  };
  
    // Add a welcome message when the chat opens for the first time
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([
                { role: 'model', content: 'أهلاً بك! أنا مساعدك الذكي. كيف يمكنني مساعدتك اليوم في استخدام النظام؟' }
            ]);
        }
    }, [isOpen, messages.length]);


  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4" dir="rtl">
        {/* Chat Window */}
        <Card className={cn(
            "w-[380px] h-[60vh] flex-col shadow-2xl transition-all duration-300 ease-in-out",
            isOpen ? "flex" : "hidden"
        )}>
            <CardHeader className="flex flex-row items-center justify-between border-b p-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full">
                        <Bot className="h-6 w-6 text-primary" />
                    </div>
                    <div className="grid gap-0.5">
                        <CardTitle className="text-base">المساعد الذكي</CardTitle>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
                    <CloseIcon className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="flex-1 p-4 overflow-hidden">
                <ScrollArea className="h-full" ref={scrollAreaRef}>
                     <div className="space-y-4">
                        {messages.map((message, index) => (
                            <div key={index} className={cn("flex items-start gap-3", message.role === 'user' ? 'justify-end' : '')}>
                            {message.role === 'model' && (
                                <Avatar className="h-8 w-8 border">
                                    <Bot className="h-5 w-5 m-auto text-primary"/>
                                </Avatar>
                            )}
                            <div
                                className={cn("max-w-xs rounded-lg p-3 text-sm",
                                message.role === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                )}
                            >
                                <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm dark:prose-invert">
                                    {message.content}
                                </ReactMarkdown>
                            </div>
                            {message.role === 'user' && (
                                <Avatar className="h-8 w-8 border">
                                    <AvatarImage src={user?.avatarUrl} alt="User"/>
                                    <AvatarFallback>{user?.fullName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                            )}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-start gap-3">
                                <Avatar className="h-8 w-8 border">
                                   <Bot className="h-5 w-5 m-auto text-primary"/>
                                </Avatar>
                                <div className="rounded-lg p-3 text-sm bg-muted flex items-center">
                                    <Loader2 className="h-5 w-5 animate-spin"/>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
            <CardFooter className="p-4 border-t">
                <div className="relative w-full">
                <Input
                    placeholder="اكتب سؤالك هنا..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={isLoading}
                    className="pr-12"
                />
                <Button
                    type="submit"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                >
                    <Send className="h-4 w-4" />
                </Button>
                </div>
            </CardFooter>
        </Card>
        
        {/* Floating Action Button */}
        <Button
            className="h-16 w-16 rounded-full bg-primary shadow-lg hover:bg-primary/90"
            onClick={() => setIsOpen(prev => !prev)}
        >
            {isOpen ? <CloseIcon className="h-8 w-8 text-primary-foreground" /> : <MessageSquare className="h-8 w-8 text-primary-foreground" />}
        </Button>
    </div>
  );
}
