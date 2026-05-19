'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  Heart, 
  Sparkles, 
  Calendar, 
  Award, 
  Clock, 
  ShieldCheck, 
  Phone, 
  MapPin, 
  Mail, 
  ArrowRight, 
  ChevronRight, 
  Star, 
  CheckCircle2, 
  LogIn, 
  Menu, 
  X, 
  Baby, 
  Scissors, 
  UserCheck,
  Zap,
  Info,
  Gift,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

// Types for packages
interface ServicePackage {
  id: string;
  name: string;
  price: string;
  duration: string;
  description: string;
  benefits: string[];
  tag?: string;
}

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<' bầu' | 'sau-sinh' | 'baby' | 'combo'>(' bầu');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [bookingName, setBookingName] = useState('');
  const [bookingPhone, setBookingPhone] = useState('');
  const [bookingService, setBookingService] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recommendation wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardUserType, setWizardUserType] = useState<string>('');
  const [wizardConcern, setWizardConcern] = useState<string>('');
  const [wizardLocation, setWizardLocation] = useState<string>('');
  const [recommendedPackage, setRecommendedPackage] = useState<ServicePackage | null>(null);

  // Change navbar background on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const serviceCategories = {
    ' bầu': {
      title: 'Chăm Sóc Mẹ Bầu',
      description: 'Liệu trình massage bầu chuyên sâu giúp giải tỏa stress, giảm đau nhức lưng hông, cải thiện giấc ngủ và chống rạn nứt da hiệu quả.',
      packages: [
        {
          id: 'bau-1',
          name: 'Gói Bầu Thư Giãn Bella',
          price: '450.000đ',
          duration: '75 phút',
          description: 'Phù hợp cho các mẹ bầu từ tháng thứ 4 mong muốn thư giãn nhẹ nhàng, phục hồi năng lượng.',
          benefits: [
            'Ngâm chân thảo dược thải độc',
            'Massage body thảo dược nhẹ nhàng',
            'Chăm sóc da mặt cơ bản organic',
            'Thư giãn vùng đầu, cổ, vai gáy',
          ],
          tag: 'Phổ biến nhất'
        },
        {
          id: 'bau-2',
          name: 'Gói Bầu VIP Toàn Diện',
          price: '690.000đ',
          duration: '100 phút',
          description: 'Liệu pháp tối ưu giúp trị liệu các cơn đau mỏi nặng, kết hợp massage mặt chuyên sâu đá nóng.',
          benefits: [
            'Rửa chân và xông chân đá muối Himalaya',
            'Massage trị liệu thắt lưng, hông chuyên sâu',
            'Massage Thụy Điển kết hợp đá nóng bazan',
            'Chăm sóc da mặt chuyên sâu sữa ong chúa',
            'Gội đầu dưỡng sinh thảo dược tự nhiên',
          ],
          tag: 'Khuyên dùng'
        }
      ]
    },
    'sau-sinh': {
      title: 'Phục Hồi Sau Sinh',
      description: 'Liệu trình toàn diện giúp đẩy nhanh sản dịch, gọi sữa về dồi dào, thu gọn vòng eo và tái tạo vóc dáng săn chắc cho mẹ bỉm sữa.',
      packages: [
        {
          id: 'post-1',
          name: 'Gói Phục Hồi Cơ Bản',
          price: '650.000đ',
          duration: '90 phút',
          description: 'Hỗ trợ mẹ phục hồi sức khỏe nhanh chóng ngay những tuần đầu tiên sau khi sinh.',
          benefits: [
            'Xông tắm thảo dược Dao Đỏ tái tạo sinh lực',
            'Massage thông tắc tia sữa, gọi sữa về',
            'Massage bụng tống sản dịch bằng tinh dầu gừng',
            'Quấn muối thảo dược giúp săn cơ bụng',
          ]
        },
        {
          id: 'post-2',
          name: 'Gói Eo Thon Dáng Ngọc VIP',
          price: '950.000đ',
          duration: '120 phút',
          description: 'Liệu trình điêu khắc vòng eo chuẩn hoàng gia kết hợp chăm sóc da sáng hồng, giảm thâm sạm.',
          benefits: [
            'Chăm sóc đầy đủ gói Phục Hồi Cơ Bản',
            'Đắp men rượu thuốc Bắc kết hợp chạy máy RF săn cơ',
            'Đắp mặt nạ nghệ hạ thổ sáng hồng da',
            'Massage body toàn thân giải tỏa trầm cảm sau sinh',
            'Chăm sóc và tẩy tế bào chết body thảo mộc',
          ],
          tag: 'Đặc sắc nhất'
        }
      ]
    },
    'baby': {
      title: 'Tắm & Massage Bé Yêu',
      description: 'Quy trình tắm chuẩn y khoa, hơ lá trầu truyền thống và massage kích thích giác quan giúp bé ngủ ngon, mau lớn và phát triển trí não vượt trội.',
      packages: [
        {
          id: 'baby-1',
          name: 'Tắm Bé Chuẩn Y Khoa',
          price: '200.000đ',
          duration: '45 phút',
          description: 'Quy trình vệ sinh và massage an toàn tuyệt đối bởi đội ngũ điều dưỡng giàu kinh nghiệm.',
          benefits: [
            'Massage kích hoạt giác quan cơ/xương trước khi tắm',
            'Tắm chuẩn y khoa, vệ sinh rốn, mắt, mũi, tai kỹ lưỡng',
            'Hơ lá trầu giữ ấm ngực, thóp đầu và các khớp',
            'Bôi tinh dầu tràm bảo vệ hô hấp',
          ]
        },
        {
          id: 'baby-2',
          name: 'Gói Bé Yêu Thông Minh VIP',
          price: '350.000đ',
          duration: '60 phút',
          description: 'Tích hợp liệu trình bơi thủy liệu mini và tập vận động sớm cho bé từ 2 tháng tuổi.',
          benefits: [
            'Massage nâng cao kích thích hệ tiêu hóa, chống đầy hơi',
            'Tắm rửa sát khuẩn nước thảo dược tự nhiên',
            'Hơ lá trầu ấm áp theo phương pháp cung đình',
            'Bơi thủy liệu (Hydrotherapy) phát triển thể chất',
            'Tập vận động phản xạ sớm nâng cao chỉ số EQ/IQ',
          ],
          tag: 'Khuyên dùng'
        }
      ]
    },
    'combo': {
      title: 'Gói Combo Trọn Gói Mẹ & Bé',
      description: 'Sự kết hợp hoàn hảo từ lúc mang bầu cho đến khi sinh nở và chăm sóc bé yêu. Tiết kiệm tối đa và nhận ngập tràn quà tặng hấp dẫn.',
      packages: [
        {
          id: 'combo-1',
          name: 'Gói Bella Home-Care Tiêu Chuẩn',
          price: '7.900.000đ',
          duration: '10 buổi',
          description: 'Combo trọn gói phục hồi cho mẹ sau sinh và tắm bé tại nhà cực kỳ tiện lợi.',
          benefits: [
            '5 buổi Chăm Sóc Phục Hồi cho mẹ sau sinh tại nhà',
            '5 buổi Tắm Bé & Massage chuẩn y khoa tại nhà',
            'Tặng thêm 01 hũ muối thảo dược quấn bụng trị giá 350k',
            'KTV là điều dưỡng có chứng chỉ hành nghề y tế',
          ]
        },
        {
          id: 'combo-2',
          name: 'Gói Hoàng Gia Bella Signature',
          price: '18.500.000đ',
          duration: '25 buổi',
          description: 'Giải pháp chăm sóc tối cao trọn vẹn dành cho gia đình thượng lưu, cam kết hoàn tiền nếu không hài lòng.',
          benefits: [
            '10 buổi Chăm sóc Bầu VIP thư giãn giảm đau nhức',
            '15 buổi Liệu trình Phục Hồi Eo Thon Dáng Ngọc sau sinh',
            '15 buổi Tắm Bé & Bơi Thủy Liệu VIP kích thích phát triển',
            'Miễn phí tư vấn dinh dưỡng cùng Bác sĩ Sản Nhi trong suốt thai kỳ',
            'Tặng hộp quà Premium gồm 05 tinh dầu cao cấp và 01 túi thảo dược chườm mắt',
          ],
          tag: 'Siêu giá trị'
        }
      ]
    }
  };

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingName || !bookingPhone || !bookingService || !bookingDate) {
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc 🌸');
      return;
    }
    
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      
      // Save locally to show active operation
      const currentBookings = JSON.parse(localStorage.getItem('bella_bookings') || '[]');
      const newBooking = {
        id: Math.random().toString(36).substr(2, 9),
        name: bookingName,
        phone: bookingPhone,
        service: bookingService,
        date: bookingDate,
        notes: bookingNotes,
        createdAt: new Date().toISOString(),
        status: 'pending'
      };
      currentBookings.push(newBooking);
      localStorage.setItem('bella_bookings', JSON.stringify(currentBookings));
      
      toast.success(`Đặt lịch thành công! Bella Spa sẽ liên hệ với mẹ ${bookingName} qua SĐT ${bookingPhone} sớm nhất để xác nhận lịch hẹn 💖`);
      
      // Reset form
      setBookingName('');
      setBookingPhone('');
      setBookingService('');
      setBookingDate('');
      setBookingNotes('');
    }, 1200);
  };

  // Recommendation flow logic
  const handleWizardUserType = (type: string) => {
    setWizardUserType(type);
    setWizardStep(2);
  };

  const handleWizardConcern = (concern: string) => {
    setWizardConcern(concern);
    setWizardStep(3);
  };

  const handleWizardLocation = (loc: string) => {
    setWizardLocation(loc);
    
    // Calculate recommendation based on selections
    let pkg: ServicePackage | null = null;
    
    if (wizardUserType === 'bau') {
      if (wizardConcern === 'dau-nhuc') {
        pkg = serviceCategories[' bầu'].packages[1]; // Gói Bầu VIP
      } else {
        pkg = serviceCategories[' bầu'].packages[0]; // Gói Bầu Thư Giãn
      }
    } else if (wizardUserType === 'sau-sinh') {
      if (wizardConcern === 'giam-eo' || wizardConcern === 'toan-dien') {
        pkg = serviceCategories['sau-sinh'].packages[1]; // Eo thon VIP
      } else {
        pkg = serviceCategories['sau-sinh'].packages[0]; // Phục hồi cơ bản
      }
    } else if (wizardUserType === 'be') {
      if (wizardConcern === 'boi-thuy-lieu') {
        pkg = serviceCategories['baby'].packages[1]; // Bé yêu thông minh VIP
      } else {
        pkg = serviceCategories['baby'].packages[0]; // Tắm bé chuẩn y khoa
      }
    } else {
      pkg = serviceCategories['combo'].packages[1]; // Hoàng Gia VIP
    }
    
    setRecommendedPackage(pkg);
    setWizardStep(4);
  };

  const resetWizard = () => {
    setWizardStep(1);
    setWizardUserType('');
    setWizardConcern('');
    setWizardLocation('');
    setRecommendedPackage(null);
  };

  const startBookingWithRecommendation = () => {
    if (recommendedPackage) {
      setBookingService(recommendedPackage.name);
      const element = document.getElementById('booking-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
      toast.info(`Đã tự động điền liệu trình đề xuất: ${recommendedPackage.name} vào phiếu đăng ký! 🌸`);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden font-sans selection:bg-rose-100 selection:text-primary">
      
      {/* ── Background Gradients ── */}
      <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[50%] rounded-full bg-gradient-to-tr from-pink-300/10 to-rose-200/20 blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-[40%] right-[-10%] w-[50%] h-[40%] rounded-full bg-gradient-to-bl from-rose-300/10 to-pink-200/10 blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-[0%] left-[-10%] w-[40%] h-[30%] rounded-full bg-gradient-to-tr from-rose-200/10 to-pink-300/5 blur-[80px] pointer-events-none -z-10" />

      {/* ── HEADER & NAVIGATION ── */}
      <header className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-md shadow-md py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center border border-rose-100/50 group-hover:scale-105 transition-transform overflow-hidden">
                <img src="/logo.png" alt="Bella Spa" className="w-8 h-8 object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-black text-slate-800 tracking-wider uppercase leading-none">Bella Spa</span>
                <span className="text-[10px] text-rose-500 font-extrabold uppercase tracking-widest leading-none mt-1">Mẹ & Bé ERP</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#about" className="text-slate-600 hover:text-primary transition-colors font-bold text-sm tracking-wide">Giới Thiệu</a>
              <a href="#services" className="text-slate-600 hover:text-primary transition-colors font-bold text-sm tracking-wide">Dịch Vụ & Bảng Giá</a>
              <a href="#wizard" className="text-slate-600 hover:text-primary transition-colors font-bold text-sm tracking-wide">Tư Vấn Liệu Trình</a>
              <a href="#testimonials" className="text-slate-600 hover:text-primary transition-colors font-bold text-sm tracking-wide">Lời Từ Các Mẹ</a>
              <a href="#booking" className="text-slate-600 hover:text-primary transition-colors font-bold text-sm tracking-wide">Đặt Lịch Hẹn</a>
            </nav>

            {/* Right Buttons */}
            <div className="hidden md:flex items-center gap-4">
              <Link href="/login" className="flex items-center gap-1.5 px-4 py-2 text-slate-700 hover:text-rose-600 transition-all font-black text-xs uppercase tracking-widest group">
                <LogIn className="w-4 h-4 group-hover:translate-x-0.5 transition-transform text-rose-500" />
                ĐĂNG NHẬP
              </Link>
              <a 
                href="#booking" 
                className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-full shadow-lg shadow-pink-200 hover:shadow-pink-300/40 hover:-translate-y-0.5 transition-all text-xs font-black uppercase tracking-wider"
              >
                DÙNG THỬ NGAY
              </a>
            </div>

            {/* Mobile menu button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-primary transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white/95 backdrop-blur-lg border-t border-rose-100"
            >
              <div className="px-4 pt-2 pb-6 space-y-4 shadow-xl">
                <a 
                  href="#about" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-slate-700 font-bold py-2 border-b border-rose-50"
                >
                  Giới Thiệu
                </a>
                <a 
                  href="#services" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-slate-700 font-bold py-2 border-b border-rose-50"
                >
                  Dịch Vụ & Bảng Giá
                </a>
                <a 
                  href="#wizard" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-slate-700 font-bold py-2 border-b border-rose-50"
                >
                  Tư Vấn Liệu Trình
                </a>
                <a 
                  href="#testimonials" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-slate-700 font-bold py-2 border-b border-rose-50"
                >
                  Lời Từ Các Mẹ
                </a>
                <a 
                  href="#booking" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-slate-700 font-bold py-2 border-b border-rose-50"
                >
                  Đặt Lịch Hẹn
                </a>
                <div className="pt-4 flex flex-col gap-3">
                  <Link 
                    href="/login" 
                    className="flex items-center justify-center gap-2 w-full py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-800 font-black text-xs uppercase tracking-wider"
                  >
                    <LogIn className="w-4 h-4 text-rose-500" />
                    Đăng nhập hệ thống
                  </Link>
                  <a 
                    href="#booking" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-pink-100"
                  >
                    Dùng Thử Ngay
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative pt-32 pb-24 md:pt-40 md:pb-36 flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-center">
          
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-pink-100 text-primary text-[10px] font-black tracking-widest uppercase mb-6 shadow-sm border border-rose-200/50"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            PHIÊN BẢN 2.0 ĐÃ SẴN SÀNG
          </motion.div>

          {/* Big Animated Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-4xl sm:text-5xl md:text-7xl font-serif font-black text-slate-900 tracking-tight leading-tight max-w-5xl mx-auto"
          >
            Bella Spa - Chăm Sóc <span className="text-gradient-pink relative">Mẹ & Bé <span className="absolute bottom-1.5 left-0 w-full h-[6px] bg-rose-200/40 rounded-full -z-10" /></span>
          </motion.h1>

          {/* Slogan */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-6 mb-8"
          >
            <p className="font-handwriting text-primary text-4xl sm:text-5xl md:text-6xl font-medium tracking-wide drop-shadow-sm select-none">
              Chăm Sóc Trọn Yêu Thương
            </p>
          </motion.div>

          {/* Subtitle Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-sm sm:text-base md:text-lg text-slate-500 font-medium max-w-3xl mx-auto leading-relaxed"
          >
            Hệ thống chăm sóc và phục hồi sức khỏe chuẩn y khoa chuyên sâu dành cho Mẹ Bầu, Mẹ Sau Sinh và Bé Yêu tại nhà hoặc tại Spa. Đồng hành cùng hàng triệu gia đình nâng niu những khoảnh khắc tuyệt diệu nhất.
          </motion.p>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a 
              href="#booking"
              className="w-full sm:w-auto bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-full shadow-xl shadow-pink-200 hover:shadow-pink-300/40 hover:-translate-y-0.5 transition-all text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 group"
            >
              Bắt đầu đặt lịch ngay
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a 
              href="#services"
              className="w-full sm:w-auto bg-white hover:bg-rose-50/50 text-slate-800 border-2 border-rose-100 px-8 py-4 rounded-full shadow-md hover:-translate-y-0.5 transition-all text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
            >
              Xem các Gói Dịch Vụ
            </a>
          </motion.div>

          {/* Image Placeholder Visual */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 1.0 }}
            className="mt-16 relative rounded-[3rem] overflow-hidden max-w-5xl mx-auto border-4 border-white shadow-2xl aspect-[16/9] bg-gradient-to-br from-rose-50 to-pink-50 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-cover bg-center mix-blend-multiply opacity-20 filter saturate-50" style={{ backgroundImage: 'url("/logo.png")' }} />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
            
            <div className="relative z-10 p-8 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg border border-pink-100 animate-bounce mb-4">
                <Heart className="w-10 h-10 text-rose-500 fill-rose-100" />
              </div>
              <h3 className="text-xl md:text-3xl font-serif font-black text-slate-800 mb-2">Trải nghiệm liệu trình thư giãn chuẩn Nhật Bản</h3>
              <p className="text-xs md:text-sm text-slate-500 font-semibold max-w-lg mb-6">Không gian tinh tế, thảo dược 100% tự nhiên cùng tay nghề y đức nâng niu nâng niu giấc ngủ của mẹ và nụ cười của bé.</p>
              
              <div className="flex flex-wrap items-center justify-center gap-6 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                <span className="flex items-center gap-1.5 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-rose-50"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 100% Chuẩn Y Khoa</span>
                <span className="flex items-center gap-1.5 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-rose-50"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> KTV Cử Nhân Y Điều Dưỡng</span>
                <span className="flex items-center gap-1.5 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-rose-50"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Nguyên Liệu Organic Sạch</span>
              </div>
            </div>
          </motion.div>

          {/* Three Feature Cards - aligned like in the image but customized for customer presentation */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div 
              whileHover={{ y: -6 }}
              className="bg-white/80 backdrop-blur-md p-8 rounded-[2.5rem] shadow-lg border border-rose-50/50 text-left transition-all"
            >
              <div className="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center text-primary mb-6 shadow-sm">
                <Calendar className="w-6 h-6 text-rose-500" />
              </div>
              <h4 className="text-lg font-black text-slate-800 mb-2 tracking-tight">Đặt Lịch Tiện Lợi</h4>
              <p className="text-slate-500 text-sm font-semibold leading-relaxed">
                Đăng ký dịch vụ nhanh chóng qua website hoặc app. Bella Spa tự động sắp xếp KTV phù hợp nhất theo thời gian của mẹ.
              </p>
            </motion.div>

            <motion.div 
              whileHover={{ y: -6 }}
              className="bg-white/80 backdrop-blur-md p-8 rounded-[2.5rem] shadow-lg border border-rose-50/50 text-left transition-all"
            >
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 shadow-sm">
                <UserCheck className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-black text-slate-800 mb-2 tracking-tight">Kỹ Thuật Viên Chuyên Nghiệp</h4>
              <p className="text-slate-500 text-sm font-semibold leading-relaxed">
                100% đội ngũ kỹ thuật viên là các Nữ điều dưỡng, Y sĩ, Hộ sinh chuyên môn cao, thấu hiểu cơ địa nhạy cảm của mẹ và bé.
              </p>
            </motion.div>

            <motion.div 
              whileHover={{ y: -6 }}
              className="bg-white/80 backdrop-blur-md p-8 rounded-[2.5rem] shadow-lg border border-rose-50/50 text-left transition-all"
            >
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 shadow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-black text-slate-800 mb-2 tracking-tight">Liệu Trình Chuẩn Y Khoa</h4>
              <p className="text-slate-500 text-sm font-semibold leading-relaxed">
                Mỗi gói dịch vụ đều được nghiên cứu khoa học kỹ lưỡng bởi bác sĩ chuyên khoa, bảo đảm độ an toàn và hiệu quả tốt nhất.
              </p>
            </motion.div>
          </div>

        </div>
      </section>

      {/* ── ABOUT SECTION ── */}
      <section id="about" className="py-24 bg-white/50 backdrop-blur-md border-y border-rose-100/50 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            {/* Left Column: Visual Bento Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="rounded-[2.5rem] overflow-hidden shadow-md aspect-square bg-gradient-to-br from-rose-100 to-rose-200 flex items-center justify-center p-8 text-center relative group">
                  <div className="absolute inset-0 bg-cover bg-center mix-blend-multiply opacity-25" style={{ backgroundImage: 'url("/logo.png")' }} />
                  <div className="relative z-10">
                    <Heart className="w-12 h-12 text-rose-600 mx-auto mb-3 fill-rose-200 animate-pulse" />
                    <h5 className="font-serif font-black text-slate-800 text-sm">Chăm sóc từ tâm</h5>
                    <p className="text-[10px] text-slate-500 mt-1 font-semibold">Tận tụy chăm chút từng bữa ăn giấc ngủ của mẹ & bé</p>
                  </div>
                </div>
                <div className="rounded-[2.5rem] overflow-hidden shadow-md aspect-[3/4] bg-slate-900 flex flex-col justify-end p-6 text-white text-left relative group">
                  <div className="absolute inset-x-0 top-0 p-6 flex justify-between items-start">
                    <Award className="w-8 h-8 text-amber-400" />
                    <span className="text-[9px] bg-white/10 backdrop-blur px-2.5 py-1 rounded-full font-black uppercase tracking-wider">Premium</span>
                  </div>
                  <h5 className="font-serif font-black text-lg mb-1 leading-tight">Hoàng Gia</h5>
                  <p className="text-[10px] text-rose-200 font-semibold leading-normal">Không gian và trang thiết bị chuẩn spa y khoa cao cấp bậc nhất.</p>
                </div>
              </div>
              <div className="space-y-4 pt-8">
                <div className="rounded-[2.5rem] overflow-hidden shadow-md aspect-[3/4] bg-gradient-to-bl from-pink-50 to-rose-100 border border-white flex flex-col justify-end p-6 text-left group">
                  <Clock className="w-8 h-8 text-rose-500 mb-4" />
                  <h5 className="font-serif font-black text-slate-800 text-base mb-1">Thời gian linh hoạt</h5>
                  <p className="text-[10px] text-slate-500 font-semibold">Đặt lịch 24/7. Điều phối kỹ thuật viên đến tận nhà chăm sóc đúng giờ.</p>
                </div>
                <div className="rounded-[2.5rem] overflow-hidden shadow-md aspect-square bg-rose-500 text-white flex items-center justify-center p-8 text-center relative">
                  <div>
                    <h4 className="text-4xl font-serif font-black mb-1">5★</h4>
                    <span className="text-[9px] font-black uppercase tracking-widest block text-rose-100">Đánh Giá Phản Hồi</span>
                    <p className="text-[10px] text-rose-100/80 mt-1 font-semibold">99.8% các mẹ cực kỳ hài lòng với chất lượng chăm sóc.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Copy & Core values */}
            <div>
              <span className="text-xs font-black tracking-widest text-primary uppercase block mb-3">Về chúng tôi</span>
              <h2 className="text-3xl sm:text-4xl font-serif font-black text-slate-800 tracking-tight mb-6">
                Kiến Tạo Hành Trình Làm Mẹ Hạnh Phúc Nhất
              </h2>
              <p className="text-slate-500 text-sm font-semibold leading-relaxed mb-6">
                Mang thai và làm mẹ là thiên chức thiêng liêng nhưng cũng đầy rẫy mệt mỏi và lo toan. Thấu hiểu những đau nhức trên cơ thể mẹ bầu, những trăn trở của mẹ sau sinh và sự bỡ ngỡ khi tắm bế sơ sinh, Bella Spa ra đời như một điểm tựa yêu thương vững chắc.
              </p>
              <p className="text-slate-500 text-sm font-semibold leading-relaxed mb-8">
                Chúng tôi không chỉ cung cấp dịch vụ spa thông thường, mà mang đến giải pháp y khoa toàn diện kết hợp tinh hoa thảo dược gia truyền cung đình, mang lại nguồn sức khỏe tuyệt hảo và tinh thần rạng rỡ cho cả mẹ và bé.
              </p>

              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-5 h-5 rounded-full bg-pink-100 text-primary flex items-center justify-center mt-0.5 shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h6 className="text-slate-800 font-black text-sm mb-0.5">Sản phẩm 100% thảo mộc hữu cơ</h6>
                    <p className="text-slate-400 text-xs font-semibold">An toàn tuyệt đối cho làn da mỏng manh của bé và cơ thể nhạy cảm của mẹ.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-5 h-5 rounded-full bg-pink-100 text-primary flex items-center justify-center mt-0.5 shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h6 className="text-slate-800 font-black text-sm mb-0.5">Giám sát y khoa chặt chẽ</h6>
                    <p className="text-slate-400 text-xs font-semibold">Tất cả quy trình, tư thế massage, nhiệt độ nước hơ lá trầu đều có sự tham vấn của các bác sĩ đầu ngành sản nhi.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-5 h-5 rounded-full bg-pink-100 text-primary flex items-center justify-center mt-0.5 shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h6 className="text-slate-800 font-black text-sm mb-0.5">Yêu thương và tận tâm như gia đình</h6>
                    <p className="text-slate-400 text-xs font-semibold">Kỹ thuật viên nâng niu bé chu đáo, nhẹ nhàng động viên sẻ chia cùng mẹ đẩy lùi trầm cảm.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── PREMIUM PACKAGES SECTION ── */}
      <section id="services" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <span className="text-xs font-black tracking-widest text-primary uppercase block mb-3">Các Gói Liệu Trình</span>
          <h2 className="text-3xl sm:text-4xl font-serif font-black text-slate-800 tracking-tight mb-4">
            Bảng Giá Dịch Vụ Chăm Sóc Cao Cấp
          </h2>
          <p className="text-slate-500 text-sm font-semibold max-w-xl mx-auto mb-12">
            Rõ ràng, minh bạch, trọn gói không phát sinh thêm chi phí. Lựa chọn gói chăm sóc phù hợp để trao tặng món quà sức khỏe tốt nhất.
          </p>

          {/* Navigation Tabs */}
          <div className="inline-flex p-1.5 bg-rose-50/50 backdrop-blur rounded-full border border-rose-100/50 mb-16 flex-wrap justify-center">
            <button
              onClick={() => setActiveTab(' bầu')}
              className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${activeTab === ' bầu' ? 'bg-primary text-white shadow-md' : 'text-slate-600 hover:text-primary'}`}
            >
              Chăm sóc Mẹ Bầu
            </button>
            <button
              onClick={() => setActiveTab('sau-sinh')}
              className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'sau-sinh' ? 'bg-primary text-white shadow-md' : 'text-slate-600 hover:text-primary'}`}
            >
              Phục hồi Sau Sinh
            </button>
            <button
              onClick={() => setActiveTab('baby')}
              className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'baby' ? 'bg-primary text-white shadow-md' : 'text-slate-600 hover:text-primary'}`}
            >
              Tắm & Massage Bé
            </button>
            <button
              onClick={() => setActiveTab('combo')}
              className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'combo' ? 'bg-primary text-white shadow-md' : 'text-slate-600 hover:text-primary'}`}
            >
              Combo Mẹ & Bé
            </button>
          </div>

          {/* Packages Display with smooth animation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left max-w-5xl mx-auto">
            <AnimatePresence mode="wait">
              {serviceCategories[activeTab].packages.map((pkg) => (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -10 }}
                  transition={{ duration: 0.4 }}
                  className="bg-white rounded-[2.5rem] shadow-xl border border-rose-50 overflow-hidden flex flex-col justify-between hover:border-primary/20 transition-all group hover:shadow-2xl relative"
                >
                  {pkg.tag && (
                    <span className="absolute top-6 right-6 bg-pink-100 text-primary text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-rose-200/50">
                      {pkg.tag}
                    </span>
                  )}
                  
                  <div className="p-8 sm:p-10">
                    <div className="flex justify-between items-start gap-4 mb-4">
                      <div>
                        <h4 className="text-xl font-serif font-black text-slate-800 tracking-tight group-hover:text-primary transition-colors">{pkg.name}</h4>
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                          <Clock className="w-3 h-3" /> {pkg.duration} / buổi
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-serif font-black text-primary block">{pkg.price}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Trọn gói</span>
                      </div>
                    </div>

                    <p className="text-slate-500 text-xs font-semibold leading-relaxed mb-6 pb-6 border-b border-rose-50">
                      {pkg.description}
                    </p>

                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-4">Quy trình liệu trình gồm:</h5>
                    <ul className="space-y-3">
                      {pkg.benefits.map((benefit, i) => (
                        <li key={i} className="flex gap-3 text-slate-600 text-xs font-medium">
                          <div className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mt-0.5 shrink-0">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-8 sm:p-10 pt-0">
                    <button
                      onClick={() => {
                        setBookingService(pkg.name);
                        const el = document.getElementById('booking');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                        toast.info(`Mẹ đã chọn gói: ${pkg.name}. Mời điền thông tin đăng ký bên dưới! 🌸`);
                      }}
                      className="w-full bg-slate-50 hover:bg-primary hover:text-white text-slate-700 text-xs font-black uppercase tracking-widest py-4 rounded-2xl transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm group-hover:shadow-md"
                    >
                      Đặt lịch gói này ngay <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

        </div>
      </section>

      {/* ── INTERACTIVE RECOMMENDATION TOOL (WIZARD) ── */}
      <section id="wizard" className="py-24 bg-gradient-to-br from-rose-50 to-pink-50 border-y border-rose-100/50 relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[40%] bg-pink-200/20 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          
          <span className="text-xs font-black tracking-widest text-primary uppercase block mb-3">Tư vấn thông minh</span>
          <h2 className="text-3xl font-serif font-black text-slate-800 tracking-tight mb-4">
            Đề Xuất Liệu Trình Cá Nhân Hóa 🌸
          </h2>
          <p className="text-slate-500 text-sm font-semibold max-w-xl mx-auto mb-12">
            Trả lời 3 câu hỏi nhanh dưới đây, thuật toán của Bella Spa sẽ tự động phân tích và chọn ra gói dịch vụ tối ưu, phù hợp nhất với thể trạng của mẹ và bé.
          </p>

          <div className="bg-white/80 backdrop-blur-xl border border-white p-8 sm:p-12 rounded-[3rem] shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-rose-400" />
            
            {/* Step indicators */}
            <div className="flex items-center justify-center gap-2 mb-10">
              {[1, 2, 3, 4].map((step) => (
                <div 
                  key={step}
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${wizardStep === step ? 'bg-primary text-white scale-110 shadow-md shadow-pink-100' : wizardStep > step ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}
                >
                  {wizardStep > step ? '✓' : step}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              
              {/* Step 1: User Type */}
              {wizardStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  key="step-1"
                  className="space-y-6"
                >
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">Mẹ đang có nhu cầu chăm sóc cho đối tượng nào?</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      onClick={() => handleWizardUserType('bau')}
                      className="p-6 bg-white border-2 border-rose-50 hover:border-primary rounded-[2rem] shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center gap-3 active:scale-95 group"
                    >
                      <div className="w-12 h-12 bg-pink-50 rounded-full flex items-center justify-center text-primary group-hover:scale-105 transition-transform"><Heart className="w-6 h-6" /></div>
                      <span className="font-serif font-black text-sm text-slate-800">Mẹ Bầu mang thai</span>
                    </button>
                    <button
                      onClick={() => handleWizardUserType('sau-sinh')}
                      className="p-6 bg-white border-2 border-rose-50 hover:border-primary rounded-[2rem] shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center gap-3 active:scale-95 group"
                    >
                      <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 group-hover:scale-105 transition-transform"><UserCheck className="w-6 h-6" /></div>
                      <span className="font-serif font-black text-sm text-slate-800">Mẹ Sau Sinh phục hồi</span>
                    </button>
                    <button
                      onClick={() => handleWizardUserType('be')}
                      className="p-6 bg-white border-2 border-rose-50 hover:border-primary rounded-[2rem] shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center gap-3 active:scale-95 group"
                    >
                      <div className="w-12 h-12 bg-sky-50 rounded-full flex items-center justify-center text-sky-500 group-hover:scale-105 transition-transform"><Baby className="w-6 h-6" /></div>
                      <span className="font-serif font-black text-sm text-slate-800">Bé Yêu sơ sinh</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Major Concerns */}
              {wizardStep === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  key="step-2"
                  className="space-y-6"
                >
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">Mối quan tâm lớn nhất hiện tại của mẹ là gì?</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                    {wizardUserType === 'bau' && (
                      <>
                        <button onClick={() => handleWizardConcern('dau-nhuc')} className="p-4 bg-white border border-rose-100 hover:border-primary rounded-xl font-bold text-slate-700 text-left flex items-center gap-3 hover:bg-rose-50/20">
                          <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0" />
                          Giảm đau nhức thắt lưng, hông, tê bì chân tay
                        </button>
                        <button onClick={() => handleWizardConcern('giam-stress')} className="p-4 bg-white border border-rose-100 hover:border-primary rounded-xl font-bold text-slate-700 text-left flex items-center gap-3 hover:bg-rose-50/20">
                          <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0" />
                          Thư giãn đầu óc, cải thiện giấc ngủ, ngủ sâu giấc hơn
                        </button>
                      </>
                    )}
                    {wizardUserType === 'sau-sinh' && (
                      <>
                        <button onClick={() => handleWizardConcern('thong-sua')} className="p-4 bg-white border border-rose-100 hover:border-primary rounded-xl font-bold text-slate-700 text-left flex items-center gap-3 hover:bg-rose-50/20">
                          <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0" />
                          Thông tắc tia sữa, gọi sữa về dồi dào
                        </button>
                        <button onClick={() => handleWizardConcern('giam-eo')} className="p-4 bg-white border border-rose-100 hover:border-primary rounded-xl font-bold text-slate-700 text-left flex items-center gap-3 hover:bg-rose-50/20">
                          <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0" />
                          Tống sản dịch, thu nhỏ vòng bụng, giảm mỡ
                        </button>
                        <button onClick={() => handleWizardConcern('toan-dien')} className="p-4 bg-white border border-rose-100 hover:border-primary rounded-xl font-bold text-slate-700 text-left flex items-center gap-3 hover:bg-rose-50/20">
                          <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0" />
                          Phục hồi sức khỏe toàn diện & dưỡng sáng hồng da
                        </button>
                      </>
                    )}
                    {wizardUserType === 'be' && (
                      <>
                        <button onClick={() => handleWizardConcern('tam-be')} className="p-4 bg-white border border-rose-100 hover:border-primary rounded-xl font-bold text-slate-700 text-left flex items-center gap-3 hover:bg-rose-50/20">
                          <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0" />
                          Tắm vệ sinh bé chuẩn y khoa, rốn sạch, hơ trầu
                        </button>
                        <button onClick={() => handleWizardConcern('boi-thuy-lieu')} className="p-4 bg-white border border-rose-100 hover:border-primary rounded-xl font-bold text-slate-700 text-left flex items-center gap-3 hover:bg-rose-50/20">
                          <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0" />
                          Bơi thủy liệu cứng cáp xương khớp, vận động sớm
                        </button>
                      </>
                    )}
                  </div>
                  
                  <button onClick={() => setWizardStep(1)} className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-wider block mx-auto mt-6">← Quay lại bước 1</button>
                </motion.div>
              )}

              {/* Step 3: Location preference */}
              {wizardStep === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  key="step-3"
                  className="space-y-6"
                >
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">Mẹ mong muốn trải nghiệm dịch vụ ở đâu?</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
                    <button
                      onClick={() => handleWizardLocation('spa')}
                      className="p-6 bg-white border border-rose-100 hover:border-primary rounded-xl shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center gap-2 group"
                    >
                      <MapPin className="w-6 h-6 text-primary group-hover:scale-105 transition-transform" />
                      <span className="font-serif font-black text-sm text-slate-800">Tại cơ sở Spa của Bella</span>
                      <span className="text-[10px] text-slate-400 font-semibold">Tận hưởng trọn vẹn không gian tinh tế</span>
                    </button>
                    <button
                      onClick={() => handleWizardLocation('home')}
                      className="p-6 bg-white border border-rose-100 hover:border-primary rounded-xl shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center gap-2 group"
                    >
                      <Phone className="w-6 h-6 text-primary group-hover:scale-105 transition-transform" />
                      <span className="font-serif font-black text-sm text-slate-800">Tại nhà (KTV đến nhà)</span>
                      <span className="text-[10px] text-slate-400 font-semibold">Tiện lợi, an toàn, không tốn thời gian di chuyển</span>
                    </button>
                  </div>
                  <button onClick={() => setWizardStep(2)} className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-wider block mx-auto mt-6">← Quay lại bước trước</button>
                </motion.div>
              )}

              {/* Step 4: Results */}
              {wizardStep === 4 && recommendedPackage && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key="step-4"
                  className="space-y-6"
                >
                  <div className="inline-flex p-3 bg-emerald-50 rounded-full text-emerald-600 mb-2">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  
                  <h3 className="text-xl font-serif font-black text-slate-800">Bella Spa đề xuất liệu trình dành cho mẹ:</h3>
                  
                  <div className="bg-gradient-to-br from-rose-50/50 to-pink-50/50 border border-rose-100 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto text-left relative">
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div>
                        <span className="text-[9px] bg-primary text-white font-black uppercase tracking-widest px-2.5 py-1 rounded-full mb-2 inline-block">ĐỀ XUẤT TỐI ƯU</span>
                        <h4 className="text-lg font-serif font-black text-slate-800">{recommendedPackage.name}</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-serif font-black text-primary block">{recommendedPackage.price}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Trọn gói liệu trình</span>
                      </div>
                    </div>

                    <p className="text-slate-500 text-xs font-semibold leading-relaxed mb-4">
                      {recommendedPackage.description}
                    </p>

                    <ul className="space-y-2 mt-4 pt-4 border-t border-rose-100/50">
                      {recommendedPackage.benefits.slice(0, 3).map((benefit, i) => (
                        <li key={i} className="flex gap-2 text-slate-600 text-xs font-medium">
                          <span className="text-emerald-500 font-bold shrink-0">✓</span>
                          <span>{benefit}</span>
                        </li>
                      ))}
                      {recommendedPackage.benefits.length > 3 && (
                        <li className="text-[10px] text-slate-400 italic font-semibold">Và một số bước chăm sóc bổ trợ y khoa chuyên nghiệp khác...</li>
                      )}
                    </ul>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto pt-6">
                    <button
                      onClick={startBookingWithRecommendation}
                      className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-pink-200 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      Đặt lịch ngay với liệu trình này
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={resetWizard}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all"
                    >
                      Chọn lại từ đầu
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </div>
      </section>

      {/* ── TESTIMONIALS SECTION ── */}
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

      {/* ── BOOKING CONSULTATION FORM SECTION ── */}
      <section id="booking" className="py-24 bg-white/50 backdrop-blur-md border-t border-rose-100/50 relative">
        <div id="booking-section" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            
            {/* Left Col: Info panel */}
            <div className="lg:col-span-5 space-y-8">
              <div>
                <span className="text-xs font-black tracking-widest text-primary uppercase block mb-3">Đăng ký giữ chỗ</span>
                <h2 className="text-3xl font-serif font-black text-slate-800 tracking-tight mb-4">
                  Đặt Lịch Tư Vấn Nhận Ngay Ưu Đãi 🎁
                </h2>
                <p className="text-slate-500 text-sm font-semibold leading-relaxed">
                  Để lại thông tin bên dưới, Bella Spa sẽ liên hệ lại ngay trong vòng 15 phút để tư vấn miễn phí trạng thái sức khỏe và hỗ trợ đặt lịch phù hợp nhất.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-pink-50 text-primary rounded-xl flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Hotline đặt lịch 24/7</span>
                    <a href="tel:0865701493" className="text-slate-800 font-black text-sm hover:text-primary transition-colors">0865 701 493</a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-pink-50 text-primary rounded-xl flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Địa chỉ cơ sở chính</span>
                    <p className="text-slate-800 font-black text-sm">Vinhomes Grand Park & Quận 7, TPHCM</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-pink-50 text-primary rounded-xl flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Email liên hệ</span>
                    <a href="mailto:info@bellaspa.vn" className="text-slate-800 font-black text-sm hover:text-primary transition-colors">contact@bellaspa.vn</a>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-pink-50/50 rounded-3xl border border-rose-100 text-left relative overflow-hidden">
                <div className="absolute right-[-10px] bottom-[-10px] w-20 h-20 opacity-10">
                  <Gift className="w-20 h-20 text-primary" />
                </div>
                <h5 className="font-serif font-black text-primary text-sm mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Ưu Đãi Mùa Sinh 🌸
                </h5>
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                  Tặng ngay Voucher giảm giá **15%** cho tất cả các mẹ đặt lịch trực tuyến lần đầu tiên trên website ngày hôm nay. Hỗ trợ thay đổi lịch hẹn hoàn toàn miễn phí.
                </p>
              </div>
            </div>

            {/* Right Col: Booking Form Card */}
            <div className="lg:col-span-7">
              
              <div className="bg-white rounded-[3rem] border border-rose-50 p-8 sm:p-10 shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-primary" />
                
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider mb-6 pb-4 border-b border-rose-50 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-500 fill-rose-100" />
                  Thông tin đăng ký tư vấn
                </h3>

                <form onSubmit={handleBooking} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    
                    {/* Name */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tên mẹ / bố *</label>
                      <input
                        type="text"
                        required
                        value={bookingName}
                        onChange={(e) => setBookingName(e.target.value)}
                        className="block w-full px-4 py-3.5 bg-slate-50 border border-rose-100/50 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all outline-none font-semibold text-slate-800 text-xs"
                        placeholder="Mẹ Ngọc Diệp"
                      />
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Số điện thoại *</label>
                      <input
                        type="tel"
                        required
                        value={bookingPhone}
                        onChange={(e) => setBookingPhone(e.target.value)}
                        className="block w-full px-4 py-3.5 bg-slate-50 border border-rose-100/50 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all outline-none font-semibold text-slate-800 text-xs"
                        placeholder="0987xxxxxx"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    
                    {/* Package selection */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dịch vụ quan tâm *</label>
                      <select
                        required
                        value={bookingService}
                        onChange={(e) => setBookingService(e.target.value)}
                        className="block w-full px-4 py-3.5 bg-slate-50 border border-rose-100/50 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all outline-none font-semibold text-slate-800 text-xs cursor-pointer"
                      >
                        <option value="">-- Chọn gói chăm sóc --</option>
                        <optgroup label="Chăm sóc Mẹ Bầu">
                          <option value="Gói Bầu Thư Giãn Bella">Gói Bầu Thư Giãn Bella (450k)</option>
                          <option value="Gói Bầu VIP Toàn Diện">Gói Bầu VIP Toàn Diện (690k)</option>
                        </optgroup>
                        <optgroup label="Phục Hồi Sau Sinh">
                          <option value="Gói Phục Hồi Cơ Bản">Gói Phục Hồi Cơ Bản (650k)</option>
                          <option value="Gói Eo Thon Dáng Ngọc VIP">Gói Eo Thon Dáng Ngọc VIP (950k)</option>
                        </optgroup>
                        <optgroup label="Tắm & Massage Bé">
                          <option value="Tắm Bé Chuẩn Y Khoa">Tắm Bé Chuẩn Y Khoa (200k)</option>
                          <option value="Gói Bé Yêu Thông Minh VIP">Gói Bé Yêu Thông Minh VIP (350k)</option>
                        </optgroup>
                        <optgroup label="Gói Combo">
                          <option value="Gói Bella Home-Care Tiêu Chuẩn">Bella Home-Care (7.9M)</option>
                          <option value="Gói Hoàng Gia Bella Signature">Hoàng Gia Signature (18.5M)</option>
                        </optgroup>
                      </select>
                    </div>

                    {/* Date */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ngày mong muốn tư vấn *</label>
                      <input
                        type="date"
                        required
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        className="block w-full px-4 py-3 bg-slate-50 border border-rose-100/50 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all outline-none font-semibold text-slate-800 text-xs"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Yêu cầu đặc biệt hoặc tình trạng sức khỏe (nếu có)</label>
                    <textarea
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      rows={3}
                      className="block w-full px-4 py-3 bg-slate-50 border border-rose-100/50 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all outline-none font-semibold text-slate-800 text-xs resize-none"
                      placeholder="VD: Mẹ đang bầu tháng thứ 6, đau mỏi thắt lưng nhiều..."
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary hover:bg-primary-hover disabled:bg-slate-200 text-white font-black py-4.5 rounded-2xl shadow-xl shadow-pink-200 hover:shadow-pink-300/40 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 mt-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Đang đăng ký...
                      </>
                    ) : (
                      <>
                        Gửi thông tin giữ ưu đãi ngay
                        <ArrowRight className="w-4.5 h-4.5" />
                      </>
                    )}
                  </button>
                </form>

                <p className="text-[10px] text-center text-slate-400 font-semibold mt-4">
                  * Bella Spa cam kết bảo mật tuyệt đối 100% mọi thông tin cá nhân của khách hàng.
                </p>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 text-white pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 pb-16 border-b border-white/10">
            
            {/* Brand block */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md">
                  <img src="/logo.png" alt="Bella Spa" className="w-7 h-7 object-contain" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black tracking-wider uppercase text-white leading-none">Bella Spa</span>
                  <span className="text-[9px] text-rose-400 font-bold uppercase tracking-widest mt-1">Chăm sóc mẹ & bé</span>
                </div>
              </div>
              
              <p className="text-slate-400 text-xs font-medium leading-relaxed">
                Tự hào là đơn vị chăm sóc sức khỏe Sản Nhi hàng đầu tại Việt Nam. Đồng hành cùng mẹ nuôi dưỡng trọn yêu thương trong từng giây phút.
              </p>

              <div className="flex items-center gap-4 text-xs font-black uppercase tracking-wider text-rose-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                Đang trực tuyến hỗ trợ
              </div>
            </div>

            {/* Links block 1 */}
            <div>
              <h5 className="font-serif font-black text-sm text-white uppercase tracking-wider mb-6">Dịch vụ tiêu biểu</h5>
              <ul className="space-y-3.5 text-xs text-slate-400 font-semibold">
                <li><a href="#services" className="hover:text-primary transition-colors">Chăm sóc mẹ bầu hoàng gia</a></li>
                <li><a href="#services" className="hover:text-primary transition-colors">Thông tắc tia sữa y khoa</a></li>
                <li><a href="#services" className="hover:text-primary transition-colors">Massage & Tắm bé sơ sinh</a></li>
                <li><a href="#services" className="hover:text-primary transition-colors">Bơi thủy liệu thông minh</a></li>
                <li><a href="#services" className="hover:text-primary transition-colors">Phục hồi vóc dáng sau sinh</a></li>
              </ul>
            </div>

            {/* Links block 2 */}
            <div>
              <h5 className="font-serif font-black text-sm text-white uppercase tracking-wider mb-6">Liên kết hữu ích</h5>
              <ul className="space-y-3.5 text-xs text-slate-400 font-semibold">
                <li><a href="#about" className="hover:text-primary transition-colors">Về chúng tôi</a></li>
                <li><a href="#services" className="hover:text-primary transition-colors">Bảng giá chi tiết</a></li>
                <li><a href="#wizard" className="hover:text-primary transition-colors">Công cụ tư vấn tự động</a></li>
                <li><a href="#testimonials" className="hover:text-primary transition-colors">Phản hồi khách hàng</a></li>
                <li>
                  <Link href="/login" className="text-rose-400 hover:text-rose-300 transition-colors font-black flex items-center gap-1">
                    <LogIn className="w-3.5 h-3.5" />
                    Vào hệ thống quản lý ERP
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact details */}
            <div>
              <h5 className="font-serif font-black text-sm text-white uppercase tracking-wider mb-6">Địa chỉ & Liên hệ</h5>
              <ul className="space-y-4 text-xs text-slate-400 font-semibold">
                <li className="flex gap-3">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Vinhomes Grand Park & Quận 7, TPHCM</span>
                </li>
                <li className="flex gap-3">
                  <Phone className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Hotline: 0865 701 493</span>
                </li>
                <li className="flex gap-3">
                  <Mail className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Email: contact@bellaspa.vn</span>
                </li>
              </ul>
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-xs font-semibold">
            <p>&copy; {new Date().getFullYear()} Bella Spa - Chăm Sóc Mẹ & Bé. Bảo lưu mọi quyền.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-slate-400 transition-colors">Chính sách bảo mật</a>
              <a href="#" className="hover:text-slate-400 transition-colors">Điều khoản dịch vụ</a>
              <Link href="/login" className="hover:text-primary text-rose-500/80 font-bold transition-colors">Hệ Thống ERP</Link>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
