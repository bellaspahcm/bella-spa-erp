'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Send, 
  X, 
  RefreshCw, 
  Sparkles,
  Phone,
  Check,
  CheckCheck
} from 'lucide-react';
import { 
  getPortalChatMessages, 
  sendPortalChatMessage, 
  markPortalMessagesAsRead 
} from '@/services/portal-chat-actions';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import type { Database } from '@/types/database.types';

type PortalChatMessage = Database['public']['Tables']['chat_messages']['Row'] & {
  isOptimistic?: boolean;
};

const FALLBACK_MESSAGE_CREATED_AT = '1970-01-01T00:00:00.000Z';

interface PortalChatWidgetProps {
  token: string;
  customerId?: string;
  customerName?: string;
  phoneHotline?: string;
}

export default function PortalChatWidget({ 
  token, 
  customerId,
  customerName = 'Khách hàng',
  phoneHotline = '0865701493'
}: PortalChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<PortalChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom helper
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  // Fetch messages from database
  const fetchMessages = async (silent = false) => {
    if (isFetching) return;
    if (!silent) setIsFetching(true);
    
    try {
      const result = await getPortalChatMessages(token);
      if (result.success && result.data) {
        const newMessages = result.data;
        
        // Check if we have new incoming messages from staff to play a light visual cue or toast
        if (messages.length > 0 && newMessages.length > messages.length) {
          const lastOldMsg = messages[messages.length - 1];
          const lastNewMsg = newMessages[newMessages.length - 1];
          if (lastNewMsg.sender_type === 'staff' && lastNewMsg.id !== lastOldMsg.id) {
            // Trigger visual alert if chat is closed
            if (!isOpen) {
              toast.info('Bạn có tin nhắn mới từ Bella Spa!', {
                action: {
                  label: 'Xem ngay',
                  onClick: () => setIsOpen(true)
                }
              });
            }
          }
        }

        setMessages(newMessages);

        // Calculate unread count (messages sent by staff that are not read)
        if (!isOpen) {
          const unread = newMessages.filter((m) => m.sender_type === 'staff' && !m.is_read).length;
          setUnreadCount(unread);
        } else {
          // If chat is open, immediately mark as read
          handleMarkAsRead();
        }
      } else if (!result.success && result.error) {
        console.error('Error fetching portal messages:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch chat messages:', error);
    } finally {
      setIsFetching(false);
      setIsInitialLoad(false);
    }
  };

  // Mark messages as read
  const handleMarkAsRead = async () => {
    try {
      const result = await markPortalMessagesAsRead(token);
      if (result.success) {
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  // Handle send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isSending) return;

    const messageText = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    // Optimistically add the message to the list for instant visual response
    const tempId = Math.random().toString(36).substring(7);
    const optimisticMsg: PortalChatMessage = {
      id: tempId,
      message: messageText,
      sender_type: 'customer',
      customer_id: null,
      tenant_id: null,
      sender_id: null,
      is_read: false,
      created_at: new Date().toISOString(),
      isOptimistic: true
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom('smooth'), 50);

    try {
      const result = await sendPortalChatMessage(token, messageText);
      if (result.success && result.data) {
        // Replace optimistic message with actual db record
        setMessages(prev => 
          prev.map(msg => msg.id === tempId ? result.data : msg)
        );
      } else {
        // Remove optimistic message and restore input on failure
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        setInputValue(messageText);
        toast.error(result.error || 'Không thể gửi tin nhắn. Vui lòng thử lại.');
      }
    } catch {
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setInputValue(messageText);
      toast.error('Lỗi kết nối mạng khi gửi tin nhắn.');
    } finally {
      setIsSending(false);
      setTimeout(() => scrollToBottom('smooth'), 50);
    }
  };

  // Polling logic
  useEffect(() => {
    fetchMessages();

    // Set up polling interval
    const intervalTime = isOpen ? 4000 : 10000; // Poll faster when chat is open
    const interval = setInterval(() => {
      fetchMessages(true);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [token, isOpen]);

  // Realtime Presence for tracking online status
  useEffect(() => {
    if (!customerId) return;

    try {
      const supabase = createClient();
      const channel = supabase.channel('online_customers');

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            customer_id: customerId,
            online_at: new Date().toISOString()
          });
        }
      });

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error('Lỗi khởi tạo Presence:', error);
    }
  }, [customerId]);


  // Handle open state change
  useEffect(() => {
    if (isOpen) {
      handleMarkAsRead();
      setTimeout(() => scrollToBottom('instant'), 100);
    }
  }, [isOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      scrollToBottom('smooth');
    }
  }, [messages.length]);

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-24 right-6 z-50">
        <motion.button
          onClick={() => setIsOpen(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative w-14 h-14 bg-gradient-to-br from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-full flex items-center justify-center shadow-xl shadow-pink-200 dark:shadow-none transition-all duration-300 group"
          title="Trò chuyện với Spa"
        >
          {/* Ripple animation */}
          <span className="absolute inset-0 rounded-full bg-pink-500/20 animate-ping group-hover:animate-none scale-105 pointer-events-none" />
          
          <MessageSquare className="w-6 h-6 fill-current text-white relative z-10" />
          
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-md animate-bounce"
              >
                {unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Slide-out Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end items-end md:p-6 pointer-events-none">
            {/* Backdrop for Mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs pointer-events-auto md:hidden"
            />

            {/* Chat Panel Content */}
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full md:w-[380px] bg-white h-[85vh] md:h-[550px] md:rounded-[2.5rem] rounded-t-[2.5rem] shadow-2xl flex flex-col overflow-hidden pointer-events-auto border border-pink-100/50 relative"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-5 text-white flex items-center justify-between shadow-lg shadow-pink-500/10 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center relative">
                    <Sparkles className="w-5 h-5 text-white fill-current animate-pulse" />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-rose-500 rounded-full" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm tracking-wide leading-tight">Bella Spa Support</h3>
                    <p className="text-[10px] text-white/80 font-bold flex items-center gap-1 mt-0.5">
                      <span>Đang hoạt động</span> • <span className="text-white">Chào chị {customerName}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a 
                    href={`tel:${phoneHotline}`}
                    className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-95 text-white/90 hover:text-white"
                    title="Gọi hotline hỗ trợ"
                  >
                    <Phone className="w-4 h-4 fill-current" />
                  </a>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-95 text-white/90 hover:text-white"
                    title="Đóng chat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message History area */}
              <div 
                ref={messagesContainerRef}
                className="flex-grow p-6 overflow-y-auto bg-rose-50/20 space-y-4 scroll-smooth"
              >
                {isInitialLoad ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đang đồng bộ tin nhắn...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-6 space-y-3">
                    <div className="w-14 h-14 bg-pink-100/50 text-primary rounded-full flex items-center justify-center animate-bounce">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Chat Trực Tiếp</h4>
                      <p className="text-[11px] text-slate-500 font-bold mt-1 max-w-[200px] mx-auto leading-relaxed">
                        Chị có thắc mắc gì về liệu trình hoặc cần hỗ trợ đặt lịch tiếp theo? Nhắn tin cho Spa ngay nhé! 🥰
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg, index) => {
                      const isCustomer = msg.sender_type === 'customer';
                      const dateObj = new Date(msg.created_at ?? FALLBACK_MESSAGE_CREATED_AT);
                      const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                      
                      // Check if we should show date header
                      const showDateHeader = index === 0 || (() => {
                        const prevDate = new Date(messages[index - 1].created_at ?? FALLBACK_MESSAGE_CREATED_AT);
                        return dateObj.toDateString() !== prevDate.toDateString();
                      })();

                      return (
                        <div key={msg.id} className="space-y-2">
                          {showDateHeader && (
                            <div className="flex justify-center my-3">
                              <span className="bg-slate-200/50 text-slate-500 text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-slate-100">
                                {dateObj.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })}
                              </span>
                            </div>
                          )}
                          
                          <div className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                            <div className="max-w-[75%] space-y-1">
                              {/* Sender Name for Staff */}
                              {!isCustomer && (
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block ml-2">
                                  Bella Spa Consultant
                                </span>
                              )}

                              <div 
                                className={`p-4 rounded-3xl text-xs font-semibold leading-relaxed shadow-xs ${
                                  isCustomer 
                                    ? 'bg-rose-500 text-white rounded-tr-xs rounded-br-[1.5rem] shadow-rose-100'
                                    : 'bg-white text-slate-800 rounded-tl-xs rounded-bl-[1.5rem] border border-pink-100/40 shadow-slate-100'
                                } ${msg.isOptimistic ? 'opacity-70 animate-pulse' : ''}`}
                              >
                                {msg.message}
                              </div>

                              <div className={`flex items-center gap-1 px-1.5 ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                                <span className="text-[8px] font-bold text-slate-400">
                                  {timeStr}
                                </span>
                                {isCustomer && !msg.isOptimistic && (
                                  <span className="text-slate-400">
                                    {msg.is_read ? (
                                      <CheckCheck className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Check className="w-3 h-3" />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Chat Input area */}
              <form 
                onSubmit={handleSendMessage}
                className="p-4 bg-white border-t border-slate-100 flex items-center gap-2 flex-shrink-0"
              >
                <input
                  type="text"
                  placeholder="Nhập tin nhắn..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={isSending}
                  className="flex-grow bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-semibold focus:outline-none focus:border-rose-300 focus:ring-1 focus:ring-rose-200 text-slate-800 disabled:opacity-60 transition-all"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isSending}
                  className="p-3.5 bg-rose-500 hover:bg-rose-600 disabled:bg-slate-100 text-white disabled:text-slate-300 rounded-2xl flex items-center justify-center transition-all active:scale-95 disabled:scale-100 shadow-md shadow-pink-100 disabled:shadow-none flex-shrink-0"
                >
                  {isSending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 fill-current" />
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
