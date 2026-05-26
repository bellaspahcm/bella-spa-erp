'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Send, 
  Paperclip, 
  Smile, 
  MoreVertical, 
  Phone, 
  Video, 
  User, 
  Clock, 
  Star,
  CheckCheck,
  Circle,
  Filter,
  Image as ImageIcon,
  Mic,
  Calendar,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  MessageSquare,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { getChatCustomers, getChatMessages, sendChatMessage, markMessagesAsRead } from '@/services/chat-actions';
import { createClient } from '@/lib/supabase-client';
import { getCurrentUser } from '@/services/user-actions';

export default function ChatPage() {
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showChatMobile, setShowChatMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadChats() {
      try {
        const supabase = createClient();
        const { data: customers, error } = await (supabase as any).rpc('get_chat_customers');
        
        if (error) {
          console.error('Error fetching chat customers:', error);
          return;
        }

        if (customers) {
          const mappedChats = customers.map((c: any) => ({
            id: c.id,
            name: c.full_name,
            avatar: c.full_name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'KH',
            lastMessage: 'Nhấn để xem tin nhắn...',
            time: new Date(c.created_at),
            unread: c.unread_count || 0,
            online: false,
            level: c.customer_level || 'Thành viên',
            phone: c.phone || 'N/A',
            lastBooking: c.last_package_name || 'Chưa có',
            totalSpent: `${(c.total_spent || 0).toLocaleString()}đ`
          }));
          setChats(mappedChats);
          if (mappedChats.length > 0 && !selectedChat) {
            setSelectedChat(mappedChats[0]);
          }
        }
      } catch (error) {
        console.error('Error loading chats:', error);
      } finally {
        setLoading(false);
      }
    }
    loadChats();
  }, []);

  // Fetch messages when selectedChat changes
  useEffect(() => {
    if (!selectedChat?.id) return;

    async function loadMessages() {
      try {
        const supabase = createClient();
        const { data, error } = await (supabase.from('chat_messages') as any)
          .select('*')
          .eq('customer_id', selectedChat.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching chat messages:', error);
          return;
        }

        if (data) {
          const mappedMessages = data.map((m: any) => ({
            id: m.id,
            chatId: m.customer_id,
            sender: m.sender_type === 'staff' ? 'spa' : 'customer',
            text: m.message,
            time: new Date(m.created_at)
          }));
          setMessages(mappedMessages);
          
          // Mark as read without awaiting to prevent blocking UI
          (supabase.from('chat_messages') as any)
            .update({ is_read: true } as any)
            .eq('customer_id', selectedChat.id)
            .eq('sender_type', 'customer')
            .eq('is_read', false)
            .then((res: any) => {
              if (res.error) console.error('Error marking read:', res.error);
            });
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    }

    loadMessages();

    // Subscribe to new messages
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${selectedChat.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `customer_id=eq.${selectedChat.id}`
        },
        (payload: any) => {
          const newMessage = {
            id: payload.new.id,
            chatId: payload.new.customer_id,
            sender: payload.new.sender_type === 'staff' ? 'spa' : 'customer',
            text: payload.new.message,
            time: new Date(payload.new.created_at)
          };
          setMessages(prev => {
            // Prevent duplicate messages if the sender is also the current user
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
          if (payload.new.sender_type === 'customer') {
            (supabase.from('chat_messages') as any)
              .update({ is_read: true } as any)
              .eq('customer_id', selectedChat.id)
              .eq('sender_type', 'customer')
              .eq('is_read', false)
              .then((res: any) => {
                if (res.error) console.error('Error marking read from subscription:', res.error);
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChat?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !selectedChat?.id) return;

    const messageText = inputValue;
    setInputValue('');

    try {
      const supabase = createClient();
      
      const { data: customerData } = await supabase.from('customers').select('tenant_id').eq('id', selectedChat.id).single();
      if (!customerData?.tenant_id) {
        alert('Lỗi hệ thống: Không xác định được Tenant ID của khách hàng.');
        return;
      }
      const tenantId = customerData.tenant_id;
      
      const { data: { user: authUser } } = await supabase.auth.getUser();

      const { data: sentMsg, error } = await (supabase.from('chat_messages') as any)
        .insert({
          customer_id: selectedChat.id,
          message: messageText,
          sender_type: 'staff',
          sender_id: authUser?.id || null,
          tenant_id: tenantId,
          is_read: false
        })
        .select()
        .single();

      if (error) throw error;
      
      if (sentMsg) {
        // Optimistically add message (though subscription will also add it, we check for duplicates)
        const newMessage = {
          id: sentMsg.id,
          chatId: selectedChat.id,
          sender: 'spa',
          text: messageText,
          time: new Date()
        };
        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Không thể gửi tin nhắn. Vui lòng thử lại.');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-4 lg:p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-4xl font-black text-foreground uppercase tracking-tighter flex items-center gap-3">
            <MessageSquare className="w-10 h-10 text-primary" />
            Trung tâm Tin nhắn
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Quản lý hội thoại và tư vấn khách hàng thời gian thực</p>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
        {/* Left Column: Conversations List */}
        <div className={`w-full lg:w-80 flex flex-col bg-white rounded-[2.5rem] shadow-xl shadow-pink-100/50 dark:shadow-none border border-pink-50 overflow-hidden luxury-box-hover shrink-0 ${
          showChatMobile ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="p-6 border-b border-pink-50">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Tìm kiếm khách hàng..."
                className="w-full pl-10 pr-4 py-3 bg-pink-50/50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium border border-transparent focus:border-primary/20"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-black uppercase tracking-widest text-primary">Đang tải...</p>
              </div>
            ) : chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => {
                  setSelectedChat(chat);
                  setShowChatMobile(true);
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-[1.5rem] transition-all duration-300 group ${
                  selectedChat?.id === chat.id 
                    ? 'bg-primary text-white shadow-lg shadow-pink-200 dark:shadow-none' 
                    : 'hover:bg-pink-50'
                }`}
              >
                <div className="relative">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-md transition-transform group-hover:scale-105 ${
                    selectedChat?.id === chat.id ? 'bg-white/20' : 'bg-gradient-to-br from-primary/10 to-secondary/10 text-primary'
                  }`}>
                    {chat.avatar}
                  </div>
                  {chat.online && (
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
                  )}
                </div>
                
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`font-black text-sm truncate ${selectedChat?.id === chat.id ? 'text-white' : 'text-foreground'}`}>
                      {chat.name}
                    </span>
                    <span className={`text-[10px] font-bold opacity-70 ${selectedChat?.id === chat.id ? 'text-white' : 'text-muted-foreground'}`}>
                      {format(chat.time, 'HH:mm')}
                    </span>
                  </div>
                  <p className={`text-xs truncate font-medium ${selectedChat?.id === chat.id ? 'text-white/80' : 'text-muted-foreground'}`}>
                    {chat.lastMessage}
                  </p>
                </div>

                {chat.unread > 0 && selectedChat?.id !== chat.id && (
                  <div className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-sm ring-2 ring-white">
                    {chat.unread}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Center Column: Chat Window */}
        <div className={`flex-1 flex flex-col bg-white rounded-[2.5rem] shadow-xl shadow-pink-100/50 dark:shadow-none border border-pink-50 overflow-hidden relative luxury-box-hover ${
          showChatMobile ? 'flex' : 'hidden lg:flex'
        }`}>
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-6 border-b border-pink-50 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setShowChatMobile(false)}
                    className="lg:hidden p-2 hover:bg-pink-50 rounded-xl text-primary transition-all active:scale-95 mr-1"
                    type="button"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-primary font-black shadow-inner">
                      {selectedChat.avatar}
                    </div>
                    {selectedChat.online && (
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-black text-lg text-foreground leading-none mb-1 uppercase tracking-tight">{selectedChat.name}</h2>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${selectedChat.online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                      <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
                        {selectedChat.online ? 'Đang hoạt động' : 'Ngoại tuyến'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {[Phone, Video, MoreVertical].map((Icon, i) => (
                    <button key={i} className="p-3 hover:bg-pink-50 rounded-2xl text-primary transition-all active:scale-90 shadow-sm border border-transparent hover:border-pink-100">
                      <Icon className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-gradient-to-b from-pink-50/20 to-transparent">
                {messages.length > 0 ? (
                  messages.map((msg, i) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      key={msg.id}
                      className={`flex ${msg.sender === 'spa' ? 'justify-end' : 'justify-start'} group`}
                    >
                      <div className={`max-w-[70%] space-y-1 ${msg.sender === 'spa' ? 'items-end' : 'items-start'} flex flex-col relative`}>
                        {/* Reaction Bar on Hover */}
                        <div className={`absolute -top-10 ${msg.sender === 'spa' ? 'right-0' : 'left-0'} opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1 bg-white shadow-xl border border-pink-50 px-2 py-1.5 rounded-full z-10 scale-90 group-hover:scale-100`}>
                          {['😊', '❤️', '👍', '😮', '😂'].map(emoji => (
                            <button key={emoji} className="hover:scale-125 transition-transform p-1 leading-none text-base">
                              {emoji}
                            </button>
                          ))}
                        </div>

                        <div className={`px-6 py-4 rounded-[1.8rem] text-[15px] font-semibold shadow-sm transition-all group-hover:shadow-md ${
                          msg.sender === 'spa' 
                            ? 'bg-primary text-white rounded-tr-none shadow-pink-100 dark:shadow-none' 
                            : 'bg-white text-foreground border border-pink-50 rounded-tl-none'
                        }`}>
                          {msg.text}
                        </div>
                        
                        <div className="flex items-center gap-1.5 px-1">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{format(msg.time, 'HH:mm')}</span>
                          {msg.sender === 'spa' && <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-40 text-center px-12">
                    <MessageSquare className="w-16 h-16 text-primary mb-4" />
                    <p className="font-black uppercase tracking-[0.2em] text-primary text-sm mb-2">Chưa có tin nhắn</p>
                    <p className="text-xs font-medium text-muted-foreground italic">Gửi tin nhắn chào mừng để bắt đầu cuộc hội thoại với khách hàng này.</p>
                  </div>
                )}
                {isTyping && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-white border border-pink-50 px-6 py-4 rounded-[1.8rem] rounded-tl-none shadow-sm flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-6 bg-white/50 backdrop-blur-md border-t border-pink-50">
                <form onSubmit={handleSendMessage} className="flex items-end gap-4 bg-pink-50/50 p-3 rounded-[2rem] border border-pink-100/50 focus-within:ring-4 focus-within:ring-primary/5 transition-all">
                  <div className="flex items-center gap-1 pb-1">
                    <button type="button" className="p-3 hover:bg-white rounded-full text-muted-foreground hover:text-primary transition-all active:scale-90">
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <button type="button" className="p-3 hover:bg-white rounded-full text-muted-foreground hover:text-primary transition-all active:scale-90">
                      <ImageIcon className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <textarea 
                    rows={1}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e as any);
                      }
                    }}
                    placeholder="Nhập tin nhắn của bạn..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] font-semibold placeholder:text-muted-foreground/60 py-3 resize-none min-h-[44px] max-h-32 custom-scrollbar"
                  />
                  
                  <div className="flex items-center gap-2 pb-1">
                    <button type="button" className="p-3 hover:bg-white rounded-full text-muted-foreground hover:text-primary transition-all active:scale-90">
                      <Smile className="w-5 h-5" />
                    </button>
                    <button 
                      type="submit" 
                      disabled={!inputValue.trim()}
                      className="bg-primary text-white p-4 rounded-full hover:bg-primary-hover shadow-lg shadow-pink-200 dark:shadow-none transition-all disabled:opacity-50 disabled:shadow-none active:scale-90"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </form>
                <p className="text-[10px] text-muted-foreground font-bold mt-3 text-center uppercase tracking-widest opacity-60">Nhấn Enter để gửi, Shift + Enter để xuống dòng</p>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-32 h-32 bg-pink-50 rounded-full flex items-center justify-center mb-8 animate-pulse">
                <MessageSquare className="w-12 h-12 text-primary/40" />
              </div>
              <h3 className="text-2xl font-black text-foreground mb-4 uppercase tracking-tighter">Chọn cuộc hội thoại</h3>
              <p className="text-muted-foreground font-medium max-w-sm">Chọn một khách hàng từ danh sách bên trái để bắt đầu tư vấn trực tuyến.</p>
            </div>
          )}
        </div>

        {/* Right Column: Customer Profile Summary */}
        <div className="w-80 hidden xl:flex flex-col gap-6">
          {selectedChat ? (
            <>
              <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-pink-100/50 dark:shadow-none border border-pink-50 luxury-box-hover text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-12 -mt-12" />
                
                <div className="relative mb-6 mx-auto w-24 h-24">
                    <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-pink-100 dark:shadow-none">
                      {selectedChat.avatar}
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-2xl shadow-lg border border-pink-50">
                      <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                    </div>
                </div>

                <h3 className="text-xl font-black text-foreground mb-1 uppercase tracking-tight">{selectedChat.name}</h3>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50 rounded-full mb-6">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{selectedChat.level}</span>
                </div>

                <div className="space-y-4 text-left">
                    <div className="p-4 bg-pink-50/30 rounded-2xl border border-pink-50/50">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Số điện thoại</p>
                      <p className="text-sm font-bold text-foreground">{selectedChat.phone}</p>
                    </div>
                    <div className="p-4 bg-pink-50/30 rounded-2xl border border-pink-50/50">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Dịch vụ gần nhất</p>
                      <p className="text-sm font-bold text-foreground">{selectedChat.lastBooking}</p>
                    </div>
                    <div className="p-4 bg-primary text-white rounded-2xl shadow-lg shadow-pink-100 dark:shadow-none">
                      <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">Tổng chi tiêu</p>
                      <p className="text-lg font-black">{selectedChat.totalSpent}</p>
                    </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-pink-100/50 dark:shadow-none border border-pink-50 luxury-box-hover">
                <h4 className="text-xs font-black text-foreground uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                  Hành động nhanh
                  <ChevronRight className="w-4 h-4 text-primary" />
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Đặt lịch', icon: Calendar, href: `/dashboard/bookings?name=${encodeURIComponent(selectedChat.name)}` },
                    { label: 'Thanh toán', icon: CreditCard, href: '/dashboard/finance' },
                    { label: 'Ghi chú', icon: Clock, action: 'note' },
                    { label: 'Hồ sơ', icon: User, href: `/dashboard/customers/${selectedChat.id}` }
                  ].map((btn, i) => (
                    btn.href ? (
                      <Link 
                        key={i} 
                        href={btn.href}
                        className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-pink-50/50 hover:bg-primary hover:text-white transition-all group border border-transparent hover:shadow-lg hover:shadow-pink-100 dark:hover:shadow-none"
                      >
                        <btn.icon className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
                        <span className="text-[10px] font-black uppercase tracking-wider">{btn.label}</span>
                      </Link>
                    ) : (
                      <button 
                        key={i} 
                        onClick={() => {
                          if (btn.action === 'note') {
                            const note = prompt(`Nhập ghi chú cho khách hàng ${selectedChat.name}:`);
                            if (note) alert(`Đã lưu ghi chú: ${note}`);
                          }
                        }}
                        className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-pink-50/50 hover:bg-primary hover:text-white transition-all group border border-transparent hover:shadow-lg hover:shadow-pink-100 dark:hover:shadow-none"
                      >
                        <btn.icon className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
                        <span className="text-[10px] font-black uppercase tracking-wider">{btn.label}</span>
                      </button>
                    )
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white/40 rounded-[2.5rem] p-8 border border-pink-50/50 flex flex-col items-center justify-center text-center h-48 opacity-60">
              <User className="w-8 h-8 text-muted-foreground mb-3" />
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Chưa chọn hồ sơ</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
