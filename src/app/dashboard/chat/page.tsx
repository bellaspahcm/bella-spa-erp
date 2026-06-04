'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Calendar,
  CheckCheck,
  ChevronLeft,
  CreditCard,
  MessageSquare,
  Phone,
  Search,
  Send,
  Sparkles,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import {
  getChatCustomers,
  getChatMessages,
  markMessagesAsRead,
  sendChatMessage,
  type ChatCustomerSummary,
  type ChatMessageRow
} from '@/services/chat-actions';
import { createClient } from '@/lib/supabase-client';

type ChatListItem = {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: Date;
  unread: number;
  online: boolean;
  level: string;
  phone: string;
  lastBooking: string;
  totalSpent: string;
};

type ChatMessageView = {
  id: string;
  chatId: string | null;
  sender: 'spa' | 'customer';
  text: string;
  time: Date;
};

type PresenceEntry = {
  customer_id?: string;
};

type ChatInsertPayload = {
  new: ChatMessageRow;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message.trim() ? error.message : fallback;
  if (typeof error === 'string') return error.trim() ? error : fallback;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'KH';
}

function getPreviewText(message: string | null | undefined) {
  const trimmed = message?.trim();
  return trimmed || 'Chưa có tin nhắn';
}

function getMessageTime(createdAt: string | null | undefined, fallback?: string) {
  return new Date(createdAt ?? fallback ?? Date.now());
}

function sortChatsByTime(chats: ChatListItem[]) {
  return [...chats].sort((a, b) => b.time.getTime() - a.time.getTime());
}

function formatCurrency(amount: number) {
  return `${amount.toLocaleString('vi-VN')}đ`;
}

function mapCustomerToChat(customer: ChatCustomerSummary, onlineIds: Set<string>): ChatListItem {
  return {
    id: customer.id,
    name: customer.full_name,
    avatar: getInitials(customer.full_name),
    lastMessage: getPreviewText(customer.last_message),
    time: getMessageTime(customer.last_message_at, customer.created_at),
    unread: customer.unread_count || 0,
    online: onlineIds.has(customer.id),
    level: customer.customer_level || 'Thành viên',
    phone: customer.phone || 'N/A',
    lastBooking: customer.last_package_name || 'Chưa có',
    totalSpent: formatCurrency(customer.total_spent || 0)
  };
}

function mapMessageRow(message: ChatMessageRow): ChatMessageView {
  return {
    id: message.id,
    chatId: message.customer_id,
    sender: message.sender_type === 'staff' ? 'spa' : 'customer',
    text: message.message,
    time: getMessageTime(message.created_at)
  };
}

export default function ChatPage() {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatListItem | null>(null);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [showChatMobile, setShowChatMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const onlineIdsRef = useRef<Set<string>>(new Set());
  const selectedChatIdRef = useRef<string | null>(null);
  const chatIdsRef = useRef<Set<string>>(new Set());

  const filteredChats = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return chats;

    return chats.filter((chat) =>
      `${chat.name} ${chat.phone} ${chat.level} ${chat.lastMessage}`.toLowerCase().includes(query)
    );
  }, [chats, searchQuery]);

  useEffect(() => {
    selectedChatIdRef.current = selectedChat?.id ?? null;
  }, [selectedChat?.id]);

  useEffect(() => {
    chatIdsRef.current = new Set(chats.map((chat) => chat.id));
  }, [chats]);

  const clearUnreadForChat = useCallback((customerId: string) => {
    setChats((prevChats) =>
      prevChats.map((chat) => (chat.id === customerId ? { ...chat, unread: 0 } : chat))
    );
    setSelectedChat((prevSelected) =>
      prevSelected?.id === customerId ? { ...prevSelected, unread: 0 } : prevSelected
    );
  }, []);

  const updateChatPreview = useCallback((
    customerId: string,
    message: string,
    createdAt: string | null,
    getUnread: (current: number) => number
  ) => {
    const messageTime = getMessageTime(createdAt);

    setChats((prevChats) =>
      sortChatsByTime(
        prevChats.map((chat) =>
          chat.id === customerId
            ? {
                ...chat,
                lastMessage: getPreviewText(message),
                time: messageTime,
                unread: getUnread(chat.unread)
              }
            : chat
        )
      )
    );

    setSelectedChat((prevSelected) =>
      prevSelected?.id === customerId
        ? {
            ...prevSelected,
            lastMessage: getPreviewText(message),
            time: messageTime,
            unread: getUnread(prevSelected.unread)
          }
        : prevSelected
    );
  }, []);

  const loadChats = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const customers = await getChatCustomers();
      const mappedChats = sortChatsByTime(
        customers.map((customer) => mapCustomerToChat(customer, onlineIdsRef.current))
      );

      setChats(mappedChats);
      setSelectedChat((current) => current ?? mappedChats[0] ?? null);
    } catch (error: unknown) {
      console.error('Error loading chats:', error);
      setChats([]);
      setSelectedChat(null);
      setLoadError(getErrorMessage(error, 'Không thể tải danh sách hội thoại.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const presenceChannel = supabase.channel('online_customers');

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const onlineIds = new Set<string>();

        Object.values(state).forEach((presences) => {
          (presences as PresenceEntry[]).forEach((presence) => {
            if (presence.customer_id) onlineIds.add(presence.customer_id);
          });
        });

        onlineIdsRef.current = onlineIds;

        setChats((prevChats) =>
          prevChats.map((chat) => ({
            ...chat,
            online: onlineIds.has(chat.id)
          }))
        );
        setSelectedChat((prevSelected) =>
          prevSelected ? { ...prevSelected, online: onlineIds.has(prevSelected.id) } : null
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (!selectedChat?.id) {
      setMessages([]);
      return;
    }

    const selectedChatId = selectedChat.id;

    async function loadMessages() {
      try {
        setMessageError(null);
        const data = await getChatMessages(selectedChatId);
        setMessages(data.map(mapMessageRow));

        void markMessagesAsRead(selectedChatId)
          .then(() => clearUnreadForChat(selectedChatId))
          .catch((error: unknown) => {
            console.error('Error marking read:', error);
            setMessageError(getErrorMessage(error, 'Không thể đánh dấu tin nhắn đã đọc.'));
          });
      } catch (error: unknown) {
        console.error('Error loading messages:', error);
        setMessages([]);
        setMessageError(getErrorMessage(error, 'Không thể tải tin nhắn.'));
      }
    }

    void loadMessages();
  }, [clearUnreadForChat, selectedChat?.id]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('dashboard-chat:all')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload: ChatInsertPayload) => {
          const incomingCustomerId = payload.new.customer_id;
          if (!incomingCustomerId) return;

          const isSelectedChat = incomingCustomerId === selectedChatIdRef.current;
          const customerIsKnown = chatIdsRef.current.has(incomingCustomerId);
          const newMessage = mapMessageRow(payload.new);

          if (isSelectedChat) {
            setMessages((previousMessages) => {
              if (previousMessages.some((message) => message.id === newMessage.id)) {
                return previousMessages;
              }

              return [...previousMessages, newMessage];
            });
          }

          if (customerIsKnown) {
            updateChatPreview(
              incomingCustomerId,
              payload.new.message,
              payload.new.created_at,
              (currentUnread) => {
                if (payload.new.sender_type !== 'customer') return currentUnread;
                return isSelectedChat ? 0 : currentUnread + 1;
              }
            );
          } else {
            void loadChats();
          }

          if (payload.new.sender_type === 'customer' && isSelectedChat) {
            void markMessagesAsRead(incomingCustomerId)
              .then(() => clearUnreadForChat(incomingCustomerId))
              .catch((error: unknown) => {
                console.error('Error marking read from subscription:', error);
                setMessageError(getErrorMessage(error, 'Không thể đánh dấu tin nhắn đã đọc.'));
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clearUnreadForChat, loadChats, updateChatPreview]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendCurrentMessage = async () => {
    if (!inputValue.trim() || !selectedChat?.id || isSending) return;

    const messageText = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    try {
      setMessageError(null);
      const sentMessage = await sendChatMessage(selectedChat.id, messageText);
      const newMessage = mapMessageRow(sentMessage);

      setMessages((previousMessages) => {
        if (previousMessages.some((message) => message.id === newMessage.id)) {
          return previousMessages;
        }
        return [...previousMessages, newMessage];
      });
      updateChatPreview(selectedChat.id, sentMessage.message, sentMessage.created_at, () => 0);
    } catch (error: unknown) {
      console.error('Error sending message:', error);
      setMessageError(getErrorMessage(error, 'Không thể gửi tin nhắn. Vui lòng thử lại.'));
      setInputValue(messageText);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black text-foreground uppercase">
            <MessageSquare className="h-8 w-8 text-primary" />
            Trung tâm tin nhắn
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Quản lý hội thoại khách hàng theo thời gian thực
          </p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <section
          className={`min-h-0 flex-col overflow-hidden rounded-lg border border-pink-100 bg-white shadow-sm ${
            showChatMobile ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="border-b border-pink-100 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Tìm khách hàng, SĐT, nội dung..."
                className="h-11 w-full rounded-lg border border-pink-100 bg-pink-50/40 pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-primary/70">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-xs font-black uppercase">Đang tải</p>
              </div>
            ) : loadError ? (
              <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600">
                {loadError}
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <MessageSquare className="mb-3 h-10 w-10 text-primary/40" />
                <p className="text-sm font-black uppercase text-foreground">
                  {searchQuery.trim() ? 'Không tìm thấy hội thoại' : 'Chưa có hội thoại'}
                </p>
                <p className="mt-2 text-xs font-medium text-muted-foreground">
                  {searchQuery.trim()
                    ? 'Thử tìm bằng tên khách hàng hoặc số điện thoại khác.'
                    : 'Khi khách hàng nhắn tin, hội thoại sẽ xuất hiện ở đây.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredChats.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => {
                      setSelectedChat(chat);
                      setMessageError(null);
                      setShowChatMobile(true);
                    }}
                    className={`grid w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-3 text-left transition ${
                      selectedChat?.id === chat.id
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-white hover:bg-pink-50'
                    }`}
                  >
                    <div className="relative">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-lg text-sm font-black ${
                          selectedChat?.id === chat.id
                            ? 'bg-white/20 text-white'
                            : 'bg-pink-100 text-primary'
                        }`}
                      >
                        {chat.avatar}
                      </div>
                      {chat.online && (
                        <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-black">{chat.name}</span>
                        <span
                          className={`shrink-0 text-[10px] font-bold ${
                            selectedChat?.id === chat.id ? 'text-white/75' : 'text-muted-foreground'
                          }`}
                        >
                          {format(chat.time, 'HH:mm')}
                        </span>
                      </div>
                      <p
                        className={`mt-1 truncate text-xs font-semibold ${
                          selectedChat?.id === chat.id ? 'text-white/80' : 'text-muted-foreground'
                        }`}
                      >
                        {chat.lastMessage}
                      </p>
                    </div>

                    {chat.unread > 0 && selectedChat?.id !== chat.id && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-white ring-2 ring-white">
                        {chat.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section
          className={`min-h-0 flex-col overflow-hidden rounded-lg border border-pink-100 bg-white shadow-sm ${
            showChatMobile ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {selectedChat ? (
            <>
              <header className="flex items-center justify-between border-b border-pink-100 bg-white p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowChatMobile(false)}
                    className="rounded-full p-2 text-primary transition hover:bg-pink-50 lg:hidden"
                    title="Quay lại danh sách"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-pink-100 text-sm font-black text-primary">
                      {selectedChat.avatar}
                    </div>
                    {selectedChat.online && (
                      <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black text-foreground">{selectedChat.name}</h2>
                    <p className="text-xs font-bold text-muted-foreground">
                      {selectedChat.online ? 'Đang hoạt động' : 'Ngoại tuyến'}
                    </p>
                  </div>
                </div>

                <a
                  href={`tel:${selectedChat.phone}`}
                  className="rounded-full p-3 text-primary transition hover:bg-pink-50"
                  title="Gọi khách hàng"
                >
                  <Phone className="h-5 w-5" />
                </a>
              </header>

              {messageError && (
                <div className="mx-4 mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                  {messageError}
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto bg-pink-50/20 p-4 lg:p-6">
                {messages.length > 0 ? (
                  <div className="space-y-5">
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${message.sender === 'spa' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`flex max-w-[78%] flex-col gap-1 ${
                            message.sender === 'spa' ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div
                            className={`rounded-lg px-4 py-3 text-sm font-semibold leading-relaxed shadow-sm ${
                              message.sender === 'spa'
                                ? 'bg-primary text-white'
                                : 'border border-pink-100 bg-white text-foreground'
                            }`}
                          >
                            {message.text}
                          </div>
                          <div className="flex items-center gap-1 px-1 text-[10px] font-bold text-muted-foreground">
                            <span>{format(message.time, 'HH:mm')}</span>
                            {message.sender === 'spa' && <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                    <MessageSquare className="mb-4 h-14 w-14 text-primary/40" />
                    <p className="text-sm font-black uppercase text-foreground">Chưa có tin nhắn</p>
                    <p className="mt-2 max-w-sm text-sm font-medium text-muted-foreground">
                      Gửi tin nhắn đầu tiên để bắt đầu tư vấn cho khách hàng này.
                    </p>
                  </div>
                )}
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendCurrentMessage();
                }}
                className="border-t border-pink-100 bg-white p-4"
              >
                <div className="flex items-end gap-3 rounded-lg border border-pink-100 bg-pink-50/40 p-2 transition focus-within:border-primary focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/20">
                  <textarea
                    rows={1}
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void sendCurrentMessage();
                      }
                    }}
                    disabled={isSending}
                    placeholder="Nhập tin nhắn..."
                    className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-sm font-semibold outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isSending}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-hover disabled:bg-slate-200 disabled:text-slate-400"
                    title="Gửi tin nhắn"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="mb-4 h-16 w-16 text-primary/30" />
              <h3 className="text-xl font-black text-foreground">Chọn hội thoại</h3>
              <p className="mt-2 max-w-sm text-sm font-medium text-muted-foreground">
                Chọn một khách hàng từ danh sách để xem lịch sử và trả lời tin nhắn.
              </p>
            </div>
          )}
        </section>

        <aside className="hidden min-h-0 flex-col gap-4 xl:flex">
          {selectedChat ? (
            <>
              <section className="rounded-lg border border-pink-100 bg-white p-5 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-lg bg-primary text-2xl font-black text-white">
                  {selectedChat.avatar}
                </div>
                <h3 className="text-lg font-black text-foreground">{selectedChat.name}</h3>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-black text-amber-600">{selectedChat.level}</span>
                </div>

                <div className="mt-5 space-y-3 text-left">
                  <div className="rounded-lg border border-pink-100 bg-pink-50/40 p-3">
                    <p className="text-xs font-bold text-muted-foreground">Số điện thoại</p>
                    <p className="mt-1 text-sm font-black text-foreground">{selectedChat.phone}</p>
                  </div>
                  <div className="rounded-lg border border-pink-100 bg-pink-50/40 p-3">
                    <p className="text-xs font-bold text-muted-foreground">Dịch vụ gần nhất</p>
                    <p className="mt-1 text-sm font-black text-foreground">{selectedChat.lastBooking}</p>
                  </div>
                  <div className="rounded-lg bg-primary p-3 text-white">
                    <p className="text-xs font-bold text-white/75">Tổng chi tiêu</p>
                    <p className="mt-1 text-lg font-black">{selectedChat.totalSpent}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-pink-100 bg-white p-4 shadow-sm">
                <h4 className="mb-3 text-sm font-black text-foreground">Hành động nhanh</h4>
                <div className="grid grid-cols-3 gap-2">
                  <Link
                    href={`/dashboard/bookings?name=${encodeURIComponent(selectedChat.name)}`}
                    className="flex flex-col items-center gap-2 rounded-lg bg-pink-50 p-3 text-center text-xs font-black text-foreground transition hover:bg-primary hover:text-white"
                  >
                    <Calendar className="h-5 w-5" />
                    Đặt lịch
                  </Link>
                  <Link
                    href="/dashboard/finance"
                    className="flex flex-col items-center gap-2 rounded-lg bg-pink-50 p-3 text-center text-xs font-black text-foreground transition hover:bg-primary hover:text-white"
                  >
                    <CreditCard className="h-5 w-5" />
                    Thu tiền
                  </Link>
                  <Link
                    href={`/dashboard/customers/${selectedChat.id}`}
                    className="flex flex-col items-center gap-2 rounded-lg bg-pink-50 p-3 text-center text-xs font-black text-foreground transition hover:bg-primary hover:text-white"
                  >
                    <User className="h-5 w-5" />
                    Hồ sơ
                  </Link>
                </div>
              </section>
            </>
          ) : (
            <section className="flex h-48 flex-col items-center justify-center rounded-lg border border-pink-100 bg-white p-6 text-center shadow-sm">
              <User className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-black text-muted-foreground">Chưa chọn hồ sơ</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
