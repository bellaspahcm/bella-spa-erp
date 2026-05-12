'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  MessageSquare,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

// --- MOCK DATA ---

const CHATS = [
  {
    id: 1,
    name: 'Nguyễn Thị Lan',
    avatar: 'NL',
    lastMessage: 'Cho mình đặt lịch chiều nay lúc 3h nhé!',
    time: new Date(),
    unread: 2,
    online: true,
    level: 'Kim cương',
    phone: '0901 234 567',
    lastBooking: 'Massage body - 10/05/2026',
    totalSpent: '12.500.000đ'
  },
  {
    id: 2,
    name: 'Trần Minh Anh',
    avatar: 'MA',
    lastMessage: 'Cảm ơn spa, dịch vụ hôm qua rất tuyệt vời.',
    time: new Date(Date.now() - 3600000),
    unread: 0,
    online: false,
    level: 'Vàng',
    phone: '0912 345 678',
    lastBooking: 'Chăm sóc da mặt - 11/05/2026',
    totalSpent: '5.200.000đ'
  },
  {
    id: 3,
    name: 'Lê Thu Hà',
    avatar: 'TH',
    lastMessage: 'Gói liệu trình 10 buổi còn bao nhiêu vậy ạ?',
    time: new Date(Date.now() - 86400000),
    unread: 0,
    online: true,
    level: 'Bạch kim',
    phone: '0988 777 666',
    lastBooking: 'Gội đầu dưỡng sinh - 05/05/2026',
    totalSpent: '8.900.000đ'
  },
  {
    id: 4,
    name: 'Phạm Hồng Nhung',
    avatar: 'HN',
    lastMessage: 'Mình bận chút việc nên dời lịch sang mai nha.',
    time: new Date(Date.now() - 172800000),
    unread: 1,
    online: false,
    level: 'Thành viên',
    phone: '0944 555 444',
    lastBooking: 'Triệt lông - 01/05/2026',
    totalSpent: '2.100.000đ'
  }
];

const INITIAL_MESSAGES = [
  { id: 1, chatId: 1, sender: 'customer', text: 'Chào Bella Spa, mình muốn tư vấn về liệu trình chăm sóc da mặt.', time: new Date(Date.now() - 7200000) },
  { id: 2, chatId: 1, sender: 'spa', text: 'Chào chị Lan ạ! Hiện tại spa đang có gói "Luxury Glow" rất hợp với da của chị. Chị có thể qua spa để chuyên viên soi da miễn phí nhé.', time: new Date(Date.now() - 7000000) },
  { id: 3, chatId: 1, sender: 'customer', text: 'Vậy cho mình đặt lịch chiều nay lúc 3h nhé!', time: new Date(Date.now() - 600000) },
];

export default function ChatPage() {
  const [selectedChat, setSelectedChat] = useState(CHATS[0]);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const newMessage = {
      id: messages.length + 1,
      chatId: selectedChat.id,
      sender: 'spa',
      text: inputValue,
      time: new Date()
    };

    setMessages([...messages, newMessage]);
    setInputValue('');

    // Simulate real-time response
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        const responseMessage = {
          id: messages.length + 2,
          chatId: selectedChat.id,
          sender: 'customer',
          text: 'Vâng, cảm ơn spa nhiều ạ! Mình sẽ đến đúng giờ.',
          time: new Date()
        };
        setMessages(prev => [...prev, responseMessage]);
        setIsTyping(false);
      }, 2000);
    }, 1000);
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

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Left Column: Conversations List */}
        <div className="w-80 flex flex-col bg-white rounded-[2.5rem] shadow-xl shadow-pink-100/50 border border-pink-50 overflow-hidden luxury-box-hover">
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
            {CHATS.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setSelectedChat(chat)}
                className={`w-full flex items-center gap-4 p-4 rounded-[1.5rem] transition-all duration-300 group ${
                  selectedChat.id === chat.id 
                    ? 'bg-primary text-white shadow-lg shadow-pink-200' 
                    : 'hover:bg-pink-50'
                }`}
              >
                <div className="relative">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-md transition-transform group-hover:scale-105 ${
                    selectedChat.id === chat.id ? 'bg-white/20' : 'bg-gradient-to-br from-primary/10 to-secondary/10 text-primary'
                  }`}>
                    {chat.avatar}
                  </div>
                  {chat.online && (
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
                  )}
                </div>
                
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`font-black text-sm truncate ${selectedChat.id === chat.id ? 'text-white' : 'text-foreground'}`}>
                      {chat.name}
                    </span>
                    <span className={`text-[10px] font-bold opacity-70 ${selectedChat.id === chat.id ? 'text-white' : 'text-muted-foreground'}`}>
                      {format(chat.time, 'HH:mm')}
                    </span>
                  </div>
                  <p className={`text-xs truncate font-medium ${selectedChat.id === chat.id ? 'text-white/80' : 'text-muted-foreground'}`}>
                    {chat.lastMessage}
                  </p>
                </div>

                {chat.unread > 0 && selectedChat.id !== chat.id && (
                  <div className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-sm ring-2 ring-white">
                    {chat.unread}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Center Column: Chat Window */}
        <div className="flex-1 flex flex-col bg-white rounded-[2.5rem] shadow-xl shadow-pink-100/50 border border-pink-50 overflow-hidden relative luxury-box-hover">
          {/* Chat Header */}
          <div className="p-6 border-b border-pink-50 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-4">
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
          <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-gradient-to-b from-pink-50/20 to-transparent">
            {messages.map((msg, i) => (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                key={msg.id}
                className={`flex ${msg.sender === 'spa' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] space-y-1 ${msg.sender === 'spa' ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`px-6 py-4 rounded-[1.8rem] text-sm font-bold shadow-sm ${
                    msg.sender === 'spa' 
                      ? 'bg-primary text-white rounded-tr-none shadow-pink-100' 
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
            ))}
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
            <form onSubmit={handleSendMessage} className="flex items-center gap-4 bg-pink-50/50 p-2 rounded-[2rem] border border-pink-100/50 focus-within:ring-4 focus-within:ring-primary/5 transition-all">
              <div className="flex items-center gap-1 pl-2">
                <button type="button" className="p-3 hover:bg-white rounded-full text-muted-foreground hover:text-primary transition-all">
                  <Paperclip className="w-5 h-5" />
                </button>
                <button type="button" className="p-3 hover:bg-white rounded-full text-muted-foreground hover:text-primary transition-all">
                  <ImageIcon className="w-5 h-5" />
                </button>
              </div>
              
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Nhập tin nhắn của bạn..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-bold placeholder:text-muted-foreground/60"
              />
              
              <div className="flex items-center gap-2 pr-1">
                <button type="button" className="p-3 hover:bg-white rounded-full text-muted-foreground hover:text-primary transition-all">
                  <Smile className="w-5 h-5" />
                </button>
                <button 
                  type="submit" 
                  disabled={!inputValue.trim()}
                  className="bg-primary text-white p-4 rounded-full hover:bg-primary-hover shadow-lg shadow-pink-200 transition-all disabled:opacity-50 disabled:shadow-none active:scale-90"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Customer Profile Summary */}
        <div className="w-80 hidden xl:flex flex-col gap-6">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-pink-100/50 border border-pink-50 luxury-box-hover text-center relative overflow-hidden">
             <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-12 -mt-12" />
             
             <div className="relative mb-6 mx-auto w-24 h-24">
                <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-pink-100">
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
                <div className="p-4 bg-primary text-white rounded-2xl shadow-lg shadow-pink-100">
                  <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">Tổng chi tiêu</p>
                  <p className="text-lg font-black">{selectedChat.totalSpent}</p>
                </div>
             </div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-pink-100/50 border border-pink-50 luxury-box-hover">
            <h4 className="text-xs font-black text-foreground uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
              Hành động nhanh
              <ChevronRight className="w-4 h-4 text-primary" />
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Đặt lịch', icon: Calendar },
                { label: 'Thanh toán', icon: CreditCard },
                { label: 'Ghi chú', icon: Clock },
                { label: 'Hồ sơ', icon: User }
              ].map((btn, i) => (
                <button key={i} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-pink-50/50 hover:bg-primary hover:text-white transition-all group border border-transparent hover:shadow-lg hover:shadow-pink-100">
                  <btn.icon className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
                  <span className="text-[10px] font-black uppercase tracking-wider">{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
