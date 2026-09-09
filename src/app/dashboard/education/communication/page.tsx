/**
 * Bella Education — Parent Communication & Electronic Contact Book
 *
 * Full viewport width layout, parent chat messages, announcements, photo sharing, and daily logs.
 */

import Link from 'next/link';
import { 
  MessageSquare, 
  Send, 
  Search, 
  ArrowLeft, 
  Megaphone, 
  Image as ImageIcon, 
  Bell, 
  CheckCheck,
  User,
  Heart
} from 'lucide-react';

const MESSAGES_LIST = [
  {
    id: 'MSG-001',
    parentName: 'Mẹ Bé Minh An (Lớp Mầm A1)',
    time: '08:15 Sáng',
    lastMessage: 'Cô ơi hôm nay bé Bi hơi sụt sịt mũi, nhờ cô cho bé mặc thêm áo khoác giúp em ạ!',
    unreadCount: 1,
    status: 'Mới',
    avatarBg: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
  },
  {
    id: 'MSG-002',
    parentName: 'Bố Bé Bảo Ngọc (Lớp Chồi B1)',
    time: 'Hôm qua',
    lastMessage: 'Dạ gia đình đã nhận được ảnh bé tham gia hoạt động làm bánh chiều nay rồi, cảm ơn cô!',
    unreadCount: 0,
    status: 'Đã Xem',
    avatarBg: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',
  },
  {
    id: 'MSG-003',
    parentName: 'Mẹ Bé Hoàng Nam (Lớp Lá C1)',
    time: 'Thứ Ba',
    lastMessage: 'Cô Linh cho em hỏi lịch đóng học phí tháng 10 hạn chót là ngày nào ạ?',
    unreadCount: 0,
    status: 'Đã Xem',
    avatarBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  },
];

const ANNOUNCEMENTS = [
  {
    id: 'ANN-001',
    title: 'Thông báo Lịch nghỉ Lễ & Dã ngoại Nông trại Sinh thái cho Toàn trường',
    date: '08/09/2026',
    author: 'Ban Giám Hiệu Bella Preschool',
    views: '268 Phụ huynh đã đọc (95.7%)',
  },
  {
    id: 'ANN-002',
    title: 'Thư mời Tham dự Hội thảo "Đồng hành cùng Con trong Giới hạn 0-6 Tuổi"',
    date: '02/09/2026',
    author: 'Chuyên gia Tâm lý & Ban Giám Hiệu',
    views: '240 Phụ huynh đã đọc (85.7%)',
  },
];

export default function CommunicationPage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* Header Banner */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/education" 
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Truyền Thông & Sổ Liên Lạc Điện Tử Phụ Huynh
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Kênh trao đổi trực tiếp giữa Nhà trường - Cô giáo & Phụ huynh học sinh
                </p>
              </div>
            </div>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 shrink-0">
            <Megaphone className="w-4 h-4" />
            <span>Gửi Thông Báo Toàn Trường</span>
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60">
            <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">Tin Nhắn Phụ Huynh Mới</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">08 Tin Nhắn</p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60">
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Tỷ Lệ Phụ Huynh Đọc Tin</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">96.8%</p>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60">
            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">Hình Ảnh Hoạt Động Đã Đăng</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">1,420 Ảnh</p>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60">
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Đánh Giá Từ Phụ Huynh</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">4.9 / 5.0 ⭐</p>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-4">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-500" />
                Hộp Tin Nhắn Sổ Liên Lạc
              </h2>
              <span className="text-xs font-bold text-slate-500">32 Cuộc Trò Chuyện</span>
            </div>

            <div className="space-y-4">
              {MESSAGES_LIST.map((msg) => (
                <div key={msg.id} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-4 hover:bg-slate-100 transition-colors cursor-pointer">
                  <div className={`w-11 h-11 rounded-2xl ${msg.avatarBg} flex items-center justify-center font-extrabold text-sm shrink-0 shadow-sm`}>
                    {msg.parentName.split(' ')[1]?.[0] || 'P'}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-gray-900 dark:text-white">{msg.parentName}</h4>
                      <span className="text-[11px] text-gray-400 font-medium">{msg.time}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2">{msg.lastMessage}</p>
                  </div>
                  {msg.unreadCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {msg.unreadCount}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* School Announcements */}
        <div className="space-y-6">
          <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5">
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-4">
              <Megaphone className="w-5 h-5 text-indigo-500" />
              Thông Báo Nhà Trường
            </h2>

            <div className="space-y-4">
              {ANNOUNCEMENTS.map((a) => (
                <div key={a.id} className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/50 space-y-2">
                  <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400">{a.date}</span>
                  <h4 className="text-xs font-extrabold text-gray-900 dark:text-white leading-snug">{a.title}</h4>
                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-indigo-200/40">
                    <span>{a.author}</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{a.views}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
