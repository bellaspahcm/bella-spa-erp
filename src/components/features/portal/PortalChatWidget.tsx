'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  CheckCheck,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getPortalChatMessages,
  markPortalMessagesAsRead,
  sendPortalChatMessage,
} from '@/services/portal-chat-actions';
import { createClient } from '@/lib/supabase-client';
import {
  countUnreadStaffMessages,
  markStaffMessagesReadLocally,
  mergePortalMessage,
  removePortalMessage,
  replacePortalMessage,
  sortPortalMessages,
  type PortalChatMessage,
} from './portal-chat-utils';

const FALLBACK_MESSAGE_CREATED_AT = '1970-01-01T00:00:00.000Z';

type PortalChatRealtimePayload = {
  new: PortalChatMessage;
};

interface PortalChatWidgetProps {
  token: string;
  customerId?: string;
  customerName?: string;
  phoneHotline?: string;
}

function createTemporaryId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function PortalChatWidget({
  token,
  customerId,
  customerName = 'Khach hang',
  phoneHotline = '0865701493',
}: PortalChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<PortalChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);
  const isOpenRef = useRef(false);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const handleMarkAsRead = useCallback(async () => {
    const result = await markPortalMessagesAsRead(token);

    if (result.success) {
      setUnreadCount(0);
      setMessages((previousMessages) => markStaffMessagesReadLocally(previousMessages));
      setChatError(null);
      return;
    }

    const errorMessage = result.error || 'Khong the cap nhat trang thai da doc.';
    setChatError(errorMessage);
  }, [token]);

  const fetchMessages = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const result = await getPortalChatMessages(token);
      if (result.success && result.data) {
        const nextMessages = sortPortalMessages(result.data);

        setMessages((previousMessages) => {
          const previousLastMessage = previousMessages[previousMessages.length - 1];
          const nextLastMessage = nextMessages[nextMessages.length - 1];

          if (
            previousLastMessage &&
            nextLastMessage &&
            previousLastMessage.id !== nextLastMessage.id &&
            nextLastMessage.sender_type === 'staff' &&
            !isOpenRef.current
          ) {
            toast.info('Ban co tin nhan moi tu Bella Spa!', {
              action: {
                label: 'Xem ngay',
                onClick: () => setIsOpen(true),
              },
            });
          }

          return nextMessages;
        });

        if (isOpenRef.current) {
          void handleMarkAsRead();
        } else {
          setUnreadCount(countUnreadStaffMessages(nextMessages));
        }
        setChatError(null);
      } else if (!result.success) {
        setChatError(result.error || 'Khong the tai tin nhan.');
      }
    } catch (error: unknown) {
      console.error('Failed to fetch portal chat messages:', error);
      setChatError('Loi ket noi khi tai tin nhan.');
    } finally {
      isFetchingRef.current = false;
      setIsInitialLoad(false);
    }
  }, [handleMarkAsRead, token]);

  const mergeRealtimeMessage = useCallback((incomingMessage: PortalChatMessage) => {
    setMessages((previousMessages) => {
      const nextMessages = mergePortalMessage(previousMessages, incomingMessage);

      if (isOpenRef.current) {
        if (incomingMessage.sender_type === 'staff') {
          void handleMarkAsRead();
        }
        setUnreadCount(0);
      } else {
        setUnreadCount(countUnreadStaffMessages(nextMessages));
      }

      return nextMessages;
    });

    if (incomingMessage.sender_type === 'staff' && !isOpenRef.current) {
      toast.info('Ban co tin nhan moi tu Bella Spa!', {
        action: {
          label: 'Xem ngay',
          onClick: () => setIsOpen(true),
        },
      });
    }
  }, [handleMarkAsRead]);

  const handleSendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!inputValue.trim() || isSending) return;

    const messageText = inputValue.trim();
    const temporaryId = createTemporaryId();
    const optimisticMessage: PortalChatMessage = {
      id: temporaryId,
      message: messageText,
      sender_type: 'customer',
      customer_id: customerId ?? null,
      tenant_id: null,
      sender_id: null,
      is_read: false,
      created_at: new Date().toISOString(),
      isOptimistic: true,
    };

    setInputValue('');
    setIsSending(true);
    setChatError(null);
    setMessages((previousMessages) => mergePortalMessage(previousMessages, optimisticMessage));
    setTimeout(() => scrollToBottom('smooth'), 50);

    try {
      const result = await sendPortalChatMessage(token, messageText);
      if (result.success && result.data) {
        setMessages((previousMessages) =>
          replacePortalMessage(previousMessages, temporaryId, result.data)
        );
      } else {
        setMessages((previousMessages) => removePortalMessage(previousMessages, temporaryId));
        setInputValue(messageText);
        const errorMessage = result.error || 'Khong the gui tin nhan. Vui long thu lai.';
        setChatError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (error: unknown) {
      console.error('Failed to send portal chat message:', error);
      setMessages((previousMessages) => removePortalMessage(previousMessages, temporaryId));
      setInputValue(messageText);
      setChatError('Loi ket noi khi gui tin nhan.');
      toast.error('Loi ket noi khi gui tin nhan.');
    } finally {
      setIsSending(false);
      setTimeout(() => scrollToBottom('smooth'), 50);
    }
  };

  useEffect(() => {
    void fetchMessages();

    const interval = setInterval(() => {
      void fetchMessages();
    }, isOpen ? 15000 : 30000);

    return () => clearInterval(interval);
  }, [fetchMessages, isOpen]);

  useEffect(() => {
    if (!customerId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`portal-chat:${customerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `customer_id=eq.${customerId}`,
        },
        (payload: PortalChatRealtimePayload) => mergeRealtimeMessage(payload.new)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `customer_id=eq.${customerId}`,
        },
        (payload: PortalChatRealtimePayload) => mergeRealtimeMessage(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId, mergeRealtimeMessage]);

  useEffect(() => {
    if (!customerId) return;

    try {
      const supabase = createClient();
      const channel = supabase.channel('online_customers');

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            customer_id: customerId,
            online_at: new Date().toISOString(),
          });
        }
      });

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error('Failed to initialize portal presence:', error);
    }
  }, [customerId]);

  useEffect(() => {
    if (isOpen) {
      void handleMarkAsRead();
      setTimeout(() => scrollToBottom('instant'), 100);
    }
  }, [handleMarkAsRead, isOpen, scrollToBottom]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      scrollToBottom('smooth');
    }
  }, [isOpen, messages.length, scrollToBottom]);

  return (
    <>
      <div className="fixed bottom-24 right-6 z-50">
        <motion.button
          onClick={() => setIsOpen(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-xl shadow-pink-200 transition-all duration-300 hover:from-rose-600 hover:to-pink-700 dark:shadow-none"
          title="Tro chuyen voi Spa"
          type="button"
        >
          <MessageSquare className="relative z-10 h-6 w-6 fill-current text-white" />

          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[10px] font-black text-white shadow-md"
              >
                {unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <div className="pointer-events-none fixed inset-0 z-[100] flex items-end justify-end md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="pointer-events-auto absolute inset-0 bg-slate-900/40 backdrop-blur-xs md:hidden"
            />

            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="pointer-events-auto relative flex h-[85vh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-pink-100/50 bg-white shadow-2xl md:h-[550px] md:w-[380px] md:rounded-[2rem]"
            >
              <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-5 text-white shadow-lg shadow-pink-500/10">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
                    <Sparkles className="h-5 w-5 fill-current text-white" />
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-rose-500 bg-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black leading-tight tracking-wide">
                      Bella Spa Support
                    </h3>
                    <p className="mt-0.5 truncate text-[10px] font-bold text-white/80">
                      Dang hoat dong - Chao chi {customerName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={`tel:${phoneHotline}`}
                    className="rounded-xl p-2 text-white/90 transition-all hover:bg-white/10 hover:text-white"
                    title="Goi hotline ho tro"
                  >
                    <Phone className="h-4 w-4 fill-current" />
                  </a>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl p-2 text-white/90 transition-all hover:bg-white/10 hover:text-white"
                    title="Dong chat"
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {chatError && (
                <div className="mx-4 mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[11px] font-bold text-red-600">
                  {chatError}
                </div>
              )}

              <div
                ref={messagesContainerRef}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-rose-50/20 p-6 scroll-smooth"
              >
                {isInitialLoad ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Dang dong bo tin nhan...
                    </span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center space-y-3 p-6 text-center text-slate-400">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-100/50 text-primary">
                      <MessageSquare className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">
                        Chat truc tiep
                      </h4>
                      <p className="mx-auto mt-1 max-w-[220px] text-[11px] font-bold leading-relaxed text-slate-500">
                        Chi can ho tro ve lieu trinh hoac lich hen, nhan tin cho Spa tai day.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => {
                      const isCustomer = message.sender_type === 'customer';
                      const dateObj = new Date(message.created_at ?? FALLBACK_MESSAGE_CREATED_AT);
                      const timeStr = dateObj.toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const showDateHeader = index === 0 || (() => {
                        const previousDate = new Date(
                          messages[index - 1].created_at ?? FALLBACK_MESSAGE_CREATED_AT
                        );
                        return dateObj.toDateString() !== previousDate.toDateString();
                      })();

                      return (
                        <div key={message.id} className="space-y-2">
                          {showDateHeader && (
                            <div className="my-3 flex justify-center">
                              <span className="rounded-full border border-slate-100 bg-slate-200/50 px-3 py-1 text-[8px] font-black uppercase tracking-widest text-slate-500">
                                {dateObj.toLocaleDateString('vi-VN', {
                                  weekday: 'long',
                                  day: 'numeric',
                                  month: 'numeric',
                                })}
                              </span>
                            </div>
                          )}

                          <div className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                            <div className="max-w-[75%] space-y-1">
                              {!isCustomer && (
                                <span className="ml-2 block text-[8px] font-bold uppercase tracking-wider text-slate-400">
                                  Bella Spa Consultant
                                </span>
                              )}

                              <div
                                className={`rounded-3xl p-4 text-xs font-semibold leading-relaxed shadow-xs ${
                                  isCustomer
                                    ? 'rounded-br-[1.5rem] rounded-tr-xs bg-rose-500 text-white shadow-rose-100'
                                    : 'rounded-bl-[1.5rem] rounded-tl-xs border border-pink-100/40 bg-white text-slate-800 shadow-slate-100'
                                } ${message.isOptimistic ? 'animate-pulse opacity-70' : ''}`}
                              >
                                {message.message}
                              </div>

                              <div
                                className={`flex items-center gap-1 px-1.5 ${
                                  isCustomer ? 'justify-end' : 'justify-start'
                                }`}
                              >
                                <span className="text-[8px] font-bold text-slate-400">{timeStr}</span>
                                {isCustomer && !message.isOptimistic && (
                                  <span className="text-slate-400">
                                    {message.is_read ? (
                                      <CheckCheck className="h-3 w-3 text-emerald-500" />
                                    ) : (
                                      <Check className="h-3 w-3" />
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

              <form
                onSubmit={handleSendMessage}
                className="flex shrink-0 items-center gap-2 border-t border-slate-100 bg-white p-4"
              >
                <input
                  type="text"
                  placeholder="Nhap tin nhan..."
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  disabled={isSending}
                  className="flex-grow rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-xs font-semibold text-slate-800 transition-all focus:border-rose-300 focus:outline-none focus:ring-1 focus:ring-rose-200 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isSending}
                  className="flex shrink-0 items-center justify-center rounded-2xl bg-rose-500 p-3.5 text-white shadow-md shadow-pink-100 transition-all hover:bg-rose-600 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
                  title="Gui tin nhan"
                >
                  {isSending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 fill-current" />
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
