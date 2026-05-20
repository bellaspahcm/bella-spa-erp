'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

export function FeedbackCarousel() {
  return (
    <section id="testimonials" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        
        <span className="text-xs font-black tracking-widest text-primary uppercase block mb-3">Phản Hồi Thực Tế</span>
        <h2 className="text-3xl sm:text-4xl font-serif font-black text-slate-800 tracking-tight mb-4">
          Trọn Vẹn Lòng Tin Từ Hàng Nghìn Ông Bố Bà Mẹ 💖
        </h2>
        <p className="text-slate-500 text-sm font-semibold max-w-xl mx-auto mb-16">
          Lắng nghe những tâm sự chân thành từ các bà mẹ đã gửi gắm sự tin tưởng trọn vẹn và nhận lại những khoảnh khắc hạnh phúc cùng con yêu.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          
          {/* Review 1 */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-rose-50 relative flex flex-col justify-between"
          >
            <div>
              <div className="flex gap-1 text-amber-400 mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
              <p className="text-slate-600 text-xs font-medium leading-relaxed italic mb-6">
                &ldquo;Thời kỳ mang thai tháng thứ 7 em bị đau nhức ê ẩm vùng hông và thắt lưng không ngủ nổi. May mắn được giới thiệu gói Bầu VIP tại Bella Spa. KTV massage cực kỳ êm ái, nhẹ nhàng kết hợp đắp đá muối ấm làm em ngủ say sưa ngay buổi đầu tiên. Bầu bí nhẹ nhàng hẳn ra các mẹ ạ!&rdquo;
              </p>
            </div>
            <div className="flex items-center gap-4 pt-6 border-t border-rose-50">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center font-black text-primary text-xs shadow-sm">MB</div>
              <div>
                <h6 className="text-slate-800 font-black text-xs">Mẹ Bích Phương</h6>
                <span className="text-[10px] text-slate-400 font-semibold">Chăm sóc Bầu VIP</span>
              </div>
            </div>
          </motion.div>

          {/* Review 2 */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-rose-50 relative flex flex-col justify-between"
          >
            <div>
              <div className="flex gap-1 text-amber-400 mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
              <p className="text-slate-600 text-xs font-medium leading-relaxed italic mb-6">
                &ldquo;Sau sinh bé đầu em bị tắc tia sữa, ngực căng cứng đau phát sốt lên. Nhờ có các chị hộ sinh Bella Spa qua tận nhà thông tắc bằng máy chuyên dụng rồi massage gọi sữa. Trộm vía sau 2 tiếng là sữa chảy thành dòng ướt áo, bé bú no nê ngủ ngoan. Cảm ơn Bella Spa nhiều lắm.&rdquo;
              </p>
            </div>
            <div className="flex items-center gap-4 pt-6 border-t border-rose-50">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center font-black text-primary text-xs shadow-sm">MH</div>
              <div>
                <h6 className="text-slate-800 font-black text-xs">Mẹ Hồng Ngọc</h6>
                <span className="text-[10px] text-slate-400 font-semibold">Phục hồi Sau Sinh tại nhà</span>
              </div>
            </div>
          </motion.div>

          {/* Review 3 */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-rose-50 relative flex flex-col justify-between"
          >
            <div>
              <div className="flex gap-1 text-amber-400 mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
              <p className="text-slate-600 text-xs font-medium leading-relaxed italic mb-6">
                &ldquo;Nhà em đăng ký trọn gói tắm bé sơ sinh tại nhà. Các cô hộ sinh tắm và massage rốn cực kỳ nhẹ nhàng, vệ sinh rốn an toàn, con ko hề khóc mà cứ lim dim ngủ. Quy trình hơ lá trầu chuẩn truyền thống ấm áp làm bé ngủ sâu cả ngày. Rất an tâm giao con cho các cô!&rdquo;
              </p>
            </div>
            <div className="flex items-center gap-4 pt-6 border-t border-rose-50">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center font-black text-primary text-xs shadow-sm">MB</div>
              <div>
                <h6 className="text-slate-800 font-black text-xs">Bố Minh Trí</h6>
                <span className="text-[10px] text-slate-400 font-semibold">Tắm bé chuẩn Y khoa</span>
              </div>
            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
