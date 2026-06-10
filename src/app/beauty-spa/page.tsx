'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import './beauty-spa.css';

// ─── Types ───────────────────────────────────────────────────────────────────
type ServiceCategory = 'facial' | 'body' | 'hightech';

interface ServiceItem {
  name: string;
  duration: string;
  price: string;
  tag: string;
  desc: string;
}

interface WizardAnswers {
  step1: { value: string; label: string } | null;
  step2: { value: string; label: string } | null;
  step3: { value: string; label: string } | null;
}

// ─── Service Catalog ─────────────────────────────────────────────────────────
const servicesData: Record<ServiceCategory, ServiceItem[]> = {
  facial: [
    {
      name: 'Trị Liệu Trắng Sáng Nhụy Hoa Nghệ Tây',
      duration: '75 Phút',
      price: '1.950.000 đ',
      tag: 'Best Seller',
      desc: 'Massage thư giãn chuyên sâu kết hợp đắp mặt nạ Saffron organic nhập khẩu Trung Đông giúp giảm hắc sắc tố, dưỡng ẩm sâu.',
    },
    {
      name: 'Phục Hồi Tế Bào Tươi Bio-Suisse',
      duration: '90 Phút',
      price: '2.500.000 đ',
      tag: 'Luxury VIP',
      desc: 'Công nghệ khóa ẩm tế bào thực vật từ dãy Alps Thụy Sĩ. Thích hợp cho da tổn thương do Treatment nặng hoặc laser.',
    },
    {
      name: 'Căng Bóng Da Thủy Tinh Glass-Skin',
      duration: '60 Phút',
      price: '1.600.000 đ',
      tag: 'Khuyên Dùng',
      desc: 'Phương pháp đẩy tinh chất Hyaluronic siêu vi điểm giúp da căng mướt óng ánh tựa pha lê ngay sau buổi đầu.',
    },
  ],
  body: [
    {
      name: 'Trị Liệu Đá Nóng Lục Bảo Ngọc Bích',
      duration: '90 Phút',
      price: '1.800.000 đ',
      tag: 'Signature',
      desc: 'Sử dụng ngọc bích nóng tự nhiên để chườm dọc huyệt đạo vai gáy, kết hợp tinh dầu tùng thông đẩy lùi mệt mỏi.',
    },
    {
      name: 'Massage Trị Liệu Hoàng Gia Thụy Điển',
      duration: '75 Phút',
      price: '1.450.000 đ',
      tag: 'Relaxing',
      desc: 'Kỹ thuật miết ấn cơ sâu nhẹ nhàng kích thích tuần hoàn máu toàn thân, loại bỏ Acid Lactic tồn đọng gây mỏi mệt.',
    },
    {
      name: 'Thải Độc Hệ Bạch Huyết Đất Sét Núi Lửa',
      duration: '105 Phút',
      price: '2.200.000 đ',
      tag: 'Deep Detox',
      desc: 'Ủ ấm bùn khoáng nóng và quấn thảo dược lạnh Thụy Sĩ giúp đào thải mỡ thừa, độc tố tích tụ lâu ngày.',
    },
  ],
  hightech: [
    {
      name: "Combo Trẻ Hóa Nâng Cơ L'Émeraude Ultimate",
      duration: '120 Phút',
      price: '3.900.000 đ',
      tag: 'Premium Combo',
      desc: 'Kết hợp nâng cơ tầng sâu, truyền vitamin tươi Thụy Sĩ và đắp mặt nạ vàng 24K tại Suite đơn đặc biệt.',
    },
    {
      name: 'Trẻ Hóa Hifu Laser Lift 4D',
      duration: '90 Phút',
      price: '3.200.000 đ',
      tag: 'High Tech',
      desc: 'Sử dụng sóng siêu âm hội tụ kích hoạt sản sinh Elastin dưới lớp cân cơ, thu gọn viền hàm tức thì.',
    },
    {
      name: 'Thanh Tẩy Ánh Sáng Băng Tuyết Cryo-Glow',
      duration: '60 Phút',
      price: '2.000.000 đ',
      tag: 'New Tech',
      desc: 'Liệu pháp đóng băng lạnh sâu se khít lỗ chân lông tức thì, ức chế tuyến bã nhờn, trả lại làn da mịn màng.',
    },
  ],
};

const CATEGORIES: { key: ServiceCategory; label: string }[] = [
  { key: 'facial', label: 'Chăm Sóc Mặt Chuyên Sâu' },
  { key: 'body', label: 'Trị Liệu Cơ Thể & Massage' },
  { key: 'hightech', label: 'Tái Tạo Công Nghệ Cao' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function LotusIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4C13.5,4 15,6.5 15,9C15,11.5 13.5,14 12,14C10.5,14 9,11.5 9,9C9,6.5 10.5,4 12,4M8.3,9.5C9.8,9.5 11,11.5 11,13.5C11,15.5 9.8,17.5 8.3,17.5C6.8,17.5 5.5,15.5 5.5,13.5C5.5,11.5 6.8,9.5 8.3,9.5M15.7,9.5C17.2,9.5 18.5,11.5 18.5,13.5C18.5,15.5 17.2,17.5 15.7,17.5C14.2,17.5 13,15.5 13,13.5C13,11.5 14.2,9.5 15.7,9.5Z" />
    </svg>
  );
}

function StarIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" />
    </svg>
  );
}

function CheckIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M9,16.17L4.83,12L3.41,13.41L9,19L21,7L19.59,5.59L9,16.17Z" />
    </svg>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function BeautySpaNav({ onBook }: { onBook: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className="beauty-spa-wrapper"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 100,
        padding: scrolled ? '14px 0' : '24px 0',
        background: scrolled ? 'rgba(250, 249, 246, 0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        boxShadow: scrolled ? '0 8px 30px rgba(7, 78, 68, 0.06)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(197, 168, 128, 0.15)' : 'none',
        transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <a href="/beauty-spa" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'linear-gradient(135deg, #074E44 0%, #0B2240 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid #C5A880',
            boxShadow: '0 6px 15px rgba(7, 78, 68, 0.2)',
          }}>
            <LotusIcon className="w-6 h-6 text-[#C5A880]" />
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 700, color: '#074E44', letterSpacing: 1, lineHeight: 1.1 }}>
              L&apos;Émeraude
            </div>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#C5A880', textTransform: 'uppercase', letterSpacing: 3 }}>
              Luxury Spa
            </div>
          </div>
        </a>

        {/* Nav Links */}
        <nav className="hidden lg:flex items-center gap-9">
          {[
            { label: 'Về Chúng Tôi', href: '#philosophy' },
            { label: 'Liệu Trình', href: '#services' },
            { label: 'Tư Vấn VIP', href: '#wizard' },
          ].map(link => (
            <a key={link.href} href={link.href}
              style={{ color: '#0B2240', fontSize: 13.5, fontWeight: 600, textDecoration: 'none', letterSpacing: 0.5, transition: 'color 0.3s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#074E44')}
              onMouseLeave={e => (e.currentTarget.style.color = '#0B2240')}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <button
          id="beauty-spa-book-btn"
          onClick={onBook}
          className="beauty-btn-primary"
          style={{ padding: '14px 28px', borderRadius: 99, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, cursor: 'pointer' }}
        >
          Đặt Lịch VIP
        </button>
      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function BeautySpaHero({ onBook }: { onBook: () => void }) {
  return (
    <section style={{ paddingTop: 180, paddingBottom: 100, position: 'relative' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: 60, alignItems: 'center' }}>
        {/* Content */}
        <div>
          <span style={{ fontFamily: "'Corinthia', cursive", fontSize: 56, color: '#C5A880', lineHeight: 1, display: 'block', marginBottom: 16 }}>
            Trải nghiệm thượng lưu
          </span>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(38px, 4.5vw, 60px)', fontWeight: 400, color: '#0B2240', lineHeight: 1.15, marginBottom: 24 }}>
            Khởi nguồn vẻ đẹp{' '}
            <em style={{ color: '#074E44' }}>tự nhiên & sang quý</em>
          </h1>
          <p style={{ color: '#64748B', fontSize: 15.5, maxWidth: 560, marginBottom: 40 }}>
            Hòa mình vào không gian trị liệu đỉnh cao tại L&apos;Émeraude. Nơi hội tụ tinh hoa thảo mộc quý hiếm,
            công nghệ phục hồi trẻ hóa da thế hệ mới và nghệ thuật chăm sóc cơ thể tinh xảo từ Thụy Sĩ.
          </p>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            <button
              id="beauty-spa-hero-book-btn"
              onClick={onBook}
              className="beauty-btn-primary"
              style={{ padding: '16px 32px', borderRadius: 99, fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Nhận Tư Vấn Độc Quyền
            </button>
            <a href="#services" style={{ color: '#0B2240', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, transition: 'color 0.3s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#074E44')}
              onMouseLeave={e => (e.currentTarget.style.color = '#0B2240')}
            >
              Xem Bảng Giá
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#C5A880" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>

          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 24, marginTop: 60, paddingTop: 40, borderTop: '1px solid rgba(197,168,128,0.2)' }}>
            {[
              { val: '99.9%', label: 'Hài Lòng Tuyệt Đối' },
              { val: '40+', label: 'Trị Liệu Viên VIP' },
              { val: '5★', label: 'Suite Cá Nhân' },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 600, color: '#074E44', marginBottom: 6 }}>{m.val}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Media Collage */}
        <div style={{ position: 'relative', aspectRatio: '1/1.1' }}>
          {/* Main block */}
          <div className="beauty-glass-card" style={{
            position: 'absolute', top: 0, left: '10%', width: '70%', height: '70%',
            borderRadius: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(7,78,68,0.08) 0%, rgba(11,34,64,0.10) 100%)',
          }}>
            <svg viewBox="0 0 100 100" width="80" height="80" style={{ opacity: 0.12, fill: '#074E44' }}>
              <path d="M50,15 C60,35 90,40 90,50 C90,75 70,85 50,85 C30,85 10,75 10,50 C10,40 40,35 50,15 Z" />
            </svg>
            <span style={{ position: 'absolute', bottom: 24, left: 24, fontFamily: "'Playfair Display',serif", fontSize: 28, fontStyle: 'italic', color: '#074E44', opacity: 0.3 }}>
              L&apos;Émeraude
            </span>
          </div>
          {/* Bottom left */}
          <div className="beauty-glass-card" style={{
            position: 'absolute', bottom: '5%', left: 0, width: '50%', height: '45%',
            borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(220deg, rgba(197,168,128,0.15) 0%, rgba(7,78,68,0.15) 100%)',
          }}>
            <LotusIcon className="w-12 h-12" style={{ color: '#074E44', opacity: 0.2 } as CSSProperties} />
          </div>
          {/* Bottom right */}
          <div className="beauty-glass-card" style={{
            position: 'absolute', bottom: '15%', right: 0, width: '45%', height: '40%',
            borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(45deg, rgba(11,34,64,0.12) 0%, rgba(197,168,128,0.15) 100%)',
          }}>
            <StarIcon className="w-14 h-14" style={{ color: '#C5A880', opacity: 0.2 } as CSSProperties} />
          </div>

          {/* Floating badge */}
          <div style={{
            position: 'absolute', top: '10%', right: '5%',
            background: '#fff', border: '1px solid #C5A880',
            padding: 16, borderRadius: 20, textAlign: 'center',
            boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
            animation: 'floatUp 4s ease-in-out infinite',
          }}>
            <StarIcon className="w-6 h-6 mx-auto mb-2" style={{ color: '#C5A880' } as CSSProperties} />
            <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: '#0B2240' }}>
              Luxury Award<br />Winner 2026
            </p>
          </div>

          <style>{`
            @keyframes floatUp { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
          `}</style>
        </div>
      </div>
    </section>
  );
}

// ─── Philosophy Bento ──────────────────────────────────────────────────────────
const bentoItems = [
  {
    title: 'Cá Nhân Hóa Trị Liệu',
    desc: 'Không có liệu trình đại trà. Mỗi khách hàng khi bước vào Suite Hoàng Gia đều được quét chuyên sâu cấu trúc cơ và da, từ đó bác sĩ pha chế tinh chất riêng biệt phù hợp 100% cơ địa.',
    icon: '◆',
  },
  {
    title: 'Không Gian Private Tuyệt Đối',
    desc: 'Hệ thống phòng cách âm chuẩn studio, điều chỉnh ánh sáng dịu nhẹ theo nhịp sinh học và hương ngải diệp kết hợp oải hương tươi, kích hoạt trạng thái phục hồi sâu sau 10 phút.',
    icon: '⬡',
  },
  {
    title: 'Thảo Dược Độc Quyền Thụy Sĩ',
    desc: '100% dòng sản phẩm phục hồi da hữu cơ đạt tiêu chuẩn Bio-Suisse danh giá. Cam kết không chứa chất bảo quản nhân tạo hay hương liệu tổng hợp, nâng niu làn da nhạy cảm nhất.',
    icon: '✦',
  },
  {
    title: 'Dịch Vụ Trà Đạo Thượng Hạng',
    desc: 'Sau mỗi ca trị liệu, quý khách được phục vụ trà hoa cúc tuyết Tây Tạng và tổ yến chưng đường phèn nhụy hoa nghệ tây — nghi thức bổ khí huyết cao cấp của phái đông y hiện đại.',
    icon: '❋',
  },
];

function PhilosophySection() {
  return (
    <section id="philosophy" style={{ padding: '100px 0', background: '#fff', borderTop: '1px solid rgba(197,168,128,0.15)', borderBottom: '1px solid rgba(197,168,128,0.15)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <span style={{ fontFamily: "'Corinthia',cursive", fontSize: 44, color: '#C5A880', display: 'block', lineHeight: 1, marginBottom: 8 }}>Dịch Vụ Tận Tâm</span>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 36, fontWeight: 400, color: '#0B2240' }}>
            Triết Lý <em style={{ color: '#074E44' }}>L&apos;Émeraude Experience</em>
          </h2>
        </div>

        {/* Bento Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
          {bentoItems.map(item => (
            <BentoCard key={item.title} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BentoCard({ item }: { item: typeof bentoItems[0] }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#fff' : '#FAF9F6',
        border: `1px solid ${hovered ? '#C5A880' : 'rgba(197,168,128,0.2)'}`,
        borderRadius: 24,
        padding: 40,
        transition: 'all 0.4s',
        transform: hovered ? 'translateY(-6px)' : 'none',
        boxShadow: hovered ? '0 20px 50px rgba(7,78,68,0.08)' : 'none',
      }}
    >
      <div style={{
        width: 60, height: 60, borderRadius: 18,
        background: hovered ? '#074E44' : 'rgba(7,78,68,0.05)',
        border: `1.5px solid ${hovered ? '#C5A880' : 'transparent'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 28,
        fontSize: 22,
        color: hovered ? '#C5A880' : '#074E44',
        transition: 'all 0.3s',
      }}>
        {item.icon}
      </div>
      <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: '#0B2240', marginBottom: 14 }}>{item.title}</h3>
      <p style={{ color: '#64748B', fontSize: 14.5 }}>{item.desc}</p>
    </div>
  );
}

// ─── Services Section ─────────────────────────────────────────────────────────
function ServicesSection({ onBook }: { onBook: (service?: string) => void }) {
  const [activeTab, setActiveTab] = useState<ServiceCategory>('facial');
  const items = servicesData[activeTab];

  return (
    <section id="services" style={{ padding: '100px 0' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <span style={{ fontFamily: "'Corinthia',cursive", fontSize: 44, color: '#C5A880', display: 'block', lineHeight: 1, marginBottom: 8 }}>Danh Mục Dịch Vụ</span>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 36, fontWeight: 400, color: '#0B2240' }}>
            Liệu Trình <em style={{ color: '#074E44' }}>Tinh Hoa L&apos;Émeraude</em>
          </h2>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 48, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              id={`beauty-spa-tab-${cat.key}`}
              onClick={() => setActiveTab(cat.key)}
              style={{
                background: activeTab === cat.key ? '#074E44' : '#fff',
                color: activeTab === cat.key ? '#fff' : '#0B2240',
                border: `1px solid ${activeTab === cat.key ? '#C5A880' : 'rgba(197,168,128,0.25)'}`,
                padding: '14px 28px',
                borderRadius: 99,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: activeTab === cat.key ? '0 10px 20px rgba(7,78,68,0.12)' : 'none',
                transition: 'all 0.3s',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Service Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 28 }}>
          {items.map(item => (
            <ServiceCard key={item.name} item={item} onBook={onBook} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceCard({ item, onBook }: { item: ServiceItem; onBook: (s?: string) => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: `1px solid ${hovered ? '#C5A880' : 'rgba(197,168,128,0.2)'}`,
        borderRadius: 24,
        overflow: 'hidden',
        transform: hovered ? 'translateY(-8px)' : 'none',
        boxShadow: hovered ? '0 30px 60px rgba(11,34,64,0.12)' : '0 20px 50px rgba(7,78,68,0.06)',
        transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Image Holder */}
      <div style={{
        height: 220, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #E8F5F2 0%, #EEF2F8 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(7,78,68,0.35) 100%)' }} />
        {/* Tag */}
        <span style={{
          position: 'absolute', top: 18, right: 18,
          background: 'rgba(250,249,246,0.92)', border: '1px solid #C5A880',
          padding: '6px 12px', borderRadius: 99,
          fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5,
          color: '#074E44', zIndex: 2,
        }}>
          {item.tag}
        </span>
        {/* Brand watermark */}
        <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, fontStyle: 'italic', color: '#074E44', opacity: 0.2 }}>
          L&apos;Émeraude
        </span>
      </div>

      {/* Info */}
      <div style={{ padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#C5A880' }}>
          <span>⏱ {item.duration}</span>
          <span>Premium Suite</span>
        </div>
        <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 19, color: '#0B2240', marginBottom: 10, fontWeight: 500 }}>{item.name}</h3>
        <p style={{ color: '#64748B', fontSize: 13.5, marginBottom: 24, height: 56, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {item.desc}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, borderTop: '1px solid rgba(197,168,128,0.18)' }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 600, color: '#074E44' }}>{item.price}</div>
          <button
            onClick={() => onBook(item.name)}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '1px solid rgba(197,168,128,0.4)',
              background: hovered ? '#074E44' : 'transparent',
              color: hovered ? '#fff' : '#074E44',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s',
              transform: hovered ? 'rotate(45deg)' : 'none',
              fontSize: 20,
            }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Consultation Wizard ───────────────────────────────────────────────────────
const WIZARD_STEPS = [
  {
    question: 'Bước 1: Mục tiêu hàng đầu của quý khách là gì?',
    options: [
      { value: 'brighten', label: 'Căng bóng & Trắng sáng', desc: 'Phù hợp da sạm, xỉn màu và thiếu sức sống.' },
      { value: 'detox', label: 'Trị liệu giảm đau cơ & Detox', desc: 'Khôi phục năng lượng cơ thể từ lõi cơ bắp.' },
      { value: 'antiage', label: 'Trẻ hóa & Nâng cơ mặt', desc: 'Chống lão hóa chuyên sâu và kích thích collagen.' },
      { value: 'acne', label: 'Kiểm soát dầu & Trị mụn', desc: 'Kháng khuẩn và phục hồi da nhạy cảm bị tổn thương.' },
    ],
  },
  {
    question: 'Bước 2: Loại phòng và không gian quý khách ưu thích?',
    options: [
      { value: 'royal', label: 'Royal Suite Room (Phòng Đơn VIP)', desc: 'Tiêu chuẩn cách âm 100%, tích hợp bồn massage cá nhân.' },
      { value: 'couple', label: 'Couple Suite Room (Phòng Đôi)', desc: 'Dành riêng cho các cặp đôi hoặc mẹ và con gái.' },
    ],
  },
  {
    question: 'Bước 3: Mức độ nhạy cảm của da hoặc cơ thể bạn?',
    options: [
      { value: 'sensitive', label: 'Da nhạy cảm / Phụ nữ mang thai', desc: 'Áp dụng các gói thảo dược lạnh và động tác massage cực nhẹ.' },
      { value: 'normal', label: 'Da và cơ địa bình thường', desc: 'Dễ dàng tương thích với mọi loại dưỡng chất và công nghệ.' },
    ],
  },
];

const WIZARD_RECOMMENDATIONS: Record<string, { name: string; price: string }> = {
  brighten: { name: 'Trị Liệu Trắng Sáng Nhụy Hoa Nghệ Tây', price: '1.950.000 đ / 75 phút' },
  detox: { name: 'Trị Liệu Đá Nóng Lục Bảo Ngọc Bích', price: '1.800.000 đ / 90 phút' },
  antiage: { name: "Combo Trẻ Hóa Nâng Cơ L'Émeraude Ultimate", price: '3.900.000 đ / 120 phút' },
  acne: { name: 'Thanh Tẩy Ánh Sáng Băng Tuyết Cryo-Glow', price: '2.000.000 đ / 60 phút' },
};

function WizardSection({ onBook }: { onBook: (service?: string) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<WizardAnswers>({ step1: null, step2: null, step3: null });
  const [done, setDone] = useState(false);

  const currentStepData = WIZARD_STEPS[step];
  const currentAnswer = answers[`step${step + 1}` as keyof WizardAnswers];

  function selectOption(value: string, label: string) {
    const key = `step${step + 1}` as keyof WizardAnswers;
    setAnswers(prev => ({ ...prev, [key]: { value, label } }));
  }

  function goNext() {
    if (step < 2) {
      setStep(s => s + 1);
    } else {
      setDone(true);
    }
  }

  function goPrev() {
    if (step > 0) setStep(s => s - 1);
  }

  function reset() {
    setStep(0);
    setAnswers({ step1: null, step2: null, step3: null });
    setDone(false);
  }

  const recommendation = answers.step1 ? WIZARD_RECOMMENDATIONS[answers.step1.value] : null;

  return (
    <section id="wizard" style={{
      margin: '40px 0',
      padding: '100px 24px',
      background: 'linear-gradient(135deg, #0B2240 0%, #0d2847 100%)',
      borderRadius: 40,
      position: 'relative',
      overflow: 'hidden',
      border: '1px solid rgba(197,168,128,0.25)',
    }}>
      {/* BG Glow */}
      <div style={{ position: 'absolute', top: '-50%', right: '-20%', width: '80%', height: '150%', background: 'radial-gradient(circle, rgba(7,78,68,0.2) 0%, transparent 60%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative', zIndex: 2 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <span style={{ fontFamily: "'Corinthia',cursive", fontSize: 44, color: '#C5A880', display: 'block', lineHeight: 1, marginBottom: 8 }}>Trợ Lý Ảo Thiết Kế Liệu Trình</span>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 34, fontWeight: 400, color: '#fff' }}>
            Khảo Sát <em style={{ color: '#7DD3C7' }}>Cá Nhân Hóa Trị Liệu</em>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', marginTop: 14, fontSize: 15 }}>
            Trả lời 3 câu hỏi để trợ lý AI của L&apos;Émeraude thiết lập chương trình phục hồi tối ưu dành riêng cho bạn.
          </p>
        </div>

        {/* Wizard Box */}
        <div style={{ background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 30, padding: 40 }}>
          {!done ? (
            <>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: '#C5A880', textAlign: 'center', marginBottom: 28, fontWeight: 400 }}>
                {currentStepData.question}
              </h3>

              {/* Options */}
              <div style={{ display: 'grid', gridTemplateColumns: currentStepData.options.length === 2 ? '1fr 1fr' : '1fr 1fr', gap: 18, marginBottom: 36 }}>
                {currentStepData.options.map(opt => {
                  const isSelected = currentAnswer?.value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      id={`beauty-spa-wizard-opt-${opt.value}`}
                      onClick={() => selectOption(opt.value, opt.label)}
                      style={{
                        background: isSelected ? 'rgba(7,78,68,0.4)' : 'rgba(255,255,255,0.02)',
                        border: `1.5px solid ${isSelected ? '#C5A880' : 'rgba(255,255,255,0.1)'}`,
                        boxShadow: isSelected ? '0 0 20px rgba(197,168,128,0.2)' : 'none',
                        borderRadius: 20,
                        padding: 24,
                        color: '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.3s',
                      }}
                    >
                      <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{opt.label}</h4>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{opt.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24 }}>
                <button onClick={goPrev} disabled={step === 0}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', padding: '12px 28px', borderRadius: 99, color: '#fff', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, cursor: step === 0 ? 'not-allowed' : 'pointer', opacity: step === 0 ? 0.3 : 1 }}>
                  Quay Lại
                </button>
                <div style={{ flexGrow: 1, margin: '0 28px', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${((step + 1) / 3) * 100}%`, background: 'linear-gradient(90deg, #C5A880, #0b695c)', borderRadius: 2, transition: 'width 0.4s' }} />
                </div>
                <button onClick={goNext} disabled={!currentAnswer}
                  style={{ background: currentAnswer ? '#074E44' : 'none', border: `1px solid ${currentAnswer ? '#C5A880' : 'rgba(255,255,255,0.2)'}`, padding: '12px 28px', borderRadius: 99, color: '#fff', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, cursor: currentAnswer ? 'pointer' : 'not-allowed', opacity: currentAnswer ? 1 : 0.3, transition: 'all 0.3s' }}>
                  {step < 2 ? 'Tiếp Theo' : 'Xem Kết Quả'}
                </button>
              </div>
            </>
          ) : (
            /* Result */
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(197,168,128,0.15)', border: '1px solid #C5A880', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckIcon className="w-9 h-9" style={{ color: '#C5A880' } as CSSProperties} />
              </div>
              <h4 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: '#fff', marginBottom: 12 }}>Phân Tích Liệu Trình Hoàn Tất!</h4>
              <p style={{ color: 'rgba(255,255,255,0.65)', maxWidth: 480, margin: '0 auto 30px', fontSize: 14 }}>
                Dựa trên mong muốn của bạn, chuyên gia y khoa L&apos;Émeraude đề xuất liệu trình độc quyền dưới đây:
              </p>

              {recommendation && (
                <div style={{ background: 'rgba(197,168,128,0.1)', border: '1px solid #C5A880', borderRadius: 24, padding: 28, maxWidth: 460, margin: '0 auto 30px', textAlign: 'left' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#C5A880', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Liệu trình khuyên dùng</div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 19, color: '#fff', marginBottom: 8 }}>{recommendation.name}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#C5A880' }}>{recommendation.price}</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                <button
                  id="beauty-spa-wizard-book-btn"
                  onClick={() => { onBook(recommendation?.name); reset(); }}
                  className="beauty-btn-primary"
                  style={{ padding: '14px 28px', borderRadius: 99, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, cursor: 'pointer' }}
                >
                  Đặt Liệu Trình Này Ngay
                </button>
                <button onClick={reset}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', padding: '14px 24px', borderRadius: 99, color: '#fff', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer' }}>
                  Khảo Sát Lại
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Booking Form ──────────────────────────────────────────────────────────────
function BookingSection({ prefillService, onClear }: { prefillService: string | null; onClear: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', service: '', date: '', room: 'Tiêu chuẩn', notes: '' });

  useEffect(() => {
    if (prefillService) {
      setForm(prev => ({ ...prev, service: prefillService }));
      onClear();
    }
    // Set tomorrow's date
    const t = new Date();
    t.setDate(t.getDate() + 1);
    setForm(prev => ({ ...prev, date: t.toISOString().split('T')[0] }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillService]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1200);
  }

  return (
    <section id="booking" style={{ padding: '100px 0' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: 60, alignItems: 'center' }}>
        {/* Info */}
        <div>
          <span style={{ fontFamily: "'Corinthia',cursive", fontSize: 44, color: '#C5A880', display: 'block', lineHeight: 1, marginBottom: 8 }}>Đăng Ký Đặt Lịch VIP</span>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 38, fontWeight: 400, color: '#0B2240', lineHeight: 1.2, marginBottom: 20 }}>
            Kiến Tạo Khoảnh Khắc{' '}<em style={{ color: '#074E44' }}>Thăng Hoa Sức Khỏe</em>
          </h2>
          <p style={{ color: '#64748B', marginBottom: 40 }}>
            Quý khách vui lòng điền thông tin đăng ký bên dưới. Trợ lý Suite sẽ liên hệ điện thoại trong vòng 10 phút để xác nhận và chuẩn bị Suite trị liệu chu đáo nhất.
          </p>

          {[
            { icon: '📞', label: 'Hotline VIP', value: '0868 999 555' },
            { icon: '⏰', label: 'Thời Gian Phục Vụ', value: '08:30 – 21:30 hàng ngày' },
            { icon: '📍', label: 'Đại Lộ Cơ Sở Chính', value: 'Villa L-08, Vinhomes Golden River, Quận 1, TPHCM' },
          ].map(c => (
            <div key={c.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 28 }}>
              <div style={{ width: 50, height: 50, borderRadius: 16, background: '#fff', border: '1px solid rgba(197,168,128,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {c.icon}
              </div>
              <div>
                <span style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#C5A880', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>{c.label}</span>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#0B2240' }}>{c.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div style={{ background: '#fff', border: '1.5px solid rgba(197,168,128,0.35)', borderRadius: 32, padding: 44, boxShadow: '0 20px 50px rgba(7,78,68,0.08)', position: 'relative' }}>
          {/* Top accent bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(90deg, #074E44, #C5A880, #0B2240)', borderRadius: '32px 32px 0 0' }} />

          {submitted ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(7,78,68,0.06)', border: '1px solid #C5A880', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 36 }}>✅</div>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: '#0B2240', marginBottom: 14 }}>Đặt Lịch Thành Công!</h3>
              <p style={{ color: '#64748B', marginBottom: 28 }}>
                Kính gửi <strong>{form.name}</strong>, L&apos;Émeraude đã nhận đăng ký Suite của quý khách. Trợ lý VIP sẽ gọi điện xác nhận sớm nhất!
              </p>
              <button onClick={() => setSubmitted(false)}
                className="beauty-btn-secondary"
                style={{ padding: '12px 28px', borderRadius: 99, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, cursor: 'pointer' }}>
                Đặt Lịch Mới
              </button>
            </div>
          ) : (
            <>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: '#0B2240', fontWeight: 500, marginBottom: 28, paddingBottom: 16, borderBottom: '1px solid rgba(197,168,128,0.18)', display: 'flex', alignItems: 'center', gap: 12 }}>
                📅 Yêu Cầu Đặt Lịch Suite VIP
              </h3>
              <form onSubmit={handleSubmit}>
                {/* Row 1 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: '#0B2240', marginBottom: 8 }}>Họ và tên *</label>
                    <input id="beauty-spa-name" type="text" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Quý bà / Quý ông..." className="beauty-input" style={{ width: '100%', padding: '14px 18px', borderRadius: 14, border: '1.5px solid rgba(197,168,128,0.2)', background: '#FAF9F6', fontSize: 13.5, fontWeight: 600, outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: '#0B2240', marginBottom: 8 }}>Số điện thoại *</label>
                    <input id="beauty-spa-phone" type="tel" required value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="0987 xxx xxx" className="beauty-input" style={{ width: '100%', padding: '14px 18px', borderRadius: 14, border: '1.5px solid rgba(197,168,128,0.2)', background: '#FAF9F6', fontSize: 13.5, fontWeight: 600, outline: 'none' }} />
                  </div>
                </div>

                {/* Row 2 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: '#0B2240', marginBottom: 8 }}>Liệu trình *</label>
                    <select id="beauty-spa-service" required value={form.service} onChange={e => setForm(p => ({ ...p, service: e.target.value }))} className="beauty-input" style={{ width: '100%', padding: '14px 18px', borderRadius: 14, border: '1.5px solid rgba(197,168,128,0.2)', background: '#FAF9F6', fontSize: 13.5, fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
                      <option value="">-- Chọn trị liệu --</option>
                      {Object.values(servicesData).flat().map(s => (
                        <option key={s.name} value={s.name}>{s.name} ({s.price})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: '#0B2240', marginBottom: 8 }}>Ngày hẹn *</label>
                    <input id="beauty-spa-date" type="date" required value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="beauty-input" style={{ width: '100%', padding: '14px 18px', borderRadius: 14, border: '1.5px solid rgba(197,168,128,0.2)', background: '#FAF9F6', fontSize: 13.5, fontWeight: 600, outline: 'none' }} />
                  </div>
                </div>

                {/* Room */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: '#0B2240', marginBottom: 8 }}>Chọn Suite Phòng</label>
                  <select id="beauty-spa-room" value={form.room} onChange={e => setForm(p => ({ ...p, room: e.target.value }))} className="beauty-input" style={{ width: '100%', padding: '14px 18px', borderRadius: 14, border: '1.5px solid rgba(197,168,128,0.2)', background: '#FAF9F6', fontSize: 13.5, fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
                    <option value="Tiêu chuẩn">Suite Tiêu Chuẩn</option>
                    <option value="Royal VIP Suite">Royal VIP Suite (+500k) — Bồn hoa hồng & cách âm đặc biệt</option>
                    <option value="Couple Room">Couple Suite Room (Dành cho 2 người)</option>
                  </select>
                </div>

                {/* Notes */}
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: '#0B2240', marginBottom: 8 }}>Yêu cầu đặc biệt</label>
                  <textarea id="beauty-spa-notes" rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Ví dụ: Trà tổ yến chưng sau liệu trình; nghe nhạc thiền; trị liệu viên tay nghề 5+ năm..." className="beauty-input" style={{ width: '100%', padding: '14px 18px', borderRadius: 14, border: '1.5px solid rgba(197,168,128,0.2)', background: '#FAF9F6', fontSize: 13.5, fontWeight: 600, outline: 'none', resize: 'none' }} />
                </div>

                <button id="beauty-spa-submit" type="submit" disabled={loading} className="beauty-btn-primary"
                  style={{ width: '100%', padding: 18, borderRadius: 16, fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1 }}>
                  {loading ? 'Đang kết nối Suite bảo mật...' : 'Gửi Đăng Ký Giữ Chỗ Suite'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function BeautySpaFooter() {
  return (
    <footer style={{ background: '#0B2240', color: 'rgba(255,255,255,0.65)', padding: '80px 0 40px', borderTop: '1px solid rgba(197,168,128,0.15)', fontSize: 14 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.6fr 0.6fr 0.6fr', gap: 50, marginBottom: 60 }}>
          {/* Brand */}
          <div>
            <a href="/beauty-spa" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, textDecoration: 'none', marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid #C5A880', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LotusIcon className="w-6 h-6" style={{ color: '#C5A880' } as CSSProperties} />
              </div>
              <div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>L&apos;Émeraude</div>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#C5A880', textTransform: 'uppercase', letterSpacing: 3 }}>Luxury Spa</div>
              </div>
            </a>
            <p style={{ fontSize: 13.5, lineHeight: 1.8, marginBottom: 28 }}>
              Hệ thống chuỗi Spa Trị Liệu & Làm Đẹp chuẩn Y Khoa Thụy Sĩ dành riêng cho giới tinh hoa tại Việt Nam. Vận hành trên nền tảng Bella ERP.
            </p>
          </div>

          {/* Links */}
          {[
            { title: 'Về Chúng Tôi', links: ['Triết Lý Vận Hành', 'Hệ Thống Trị Liệu', 'Đội Ngũ Bác Sĩ VIP', 'Bảo Mật Thông Tin'] },
            { title: 'Phân Hệ VIP', links: ['Tự Thiết Kế Liệu Trình', 'Đăng Ký Thành Viên', 'Ưu Đãi Đặc Quyền'] },
            { title: 'Địa Chỉ', links: ['Q1: Vinhomes Golden River', 'Q7: Phú Mỹ Hưng'] },
          ].map(col => (
            <div key={col.title}>
              <h4 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: '#fff', marginBottom: 24, paddingBottom: 10, borderBottom: '1.5px solid #C5A880', display: 'inline-block' }}>
                {col.title}
              </h4>
              <ul style={{ listStyle: 'none' }}>
                {col.links.map(link => (
                  <li key={link} style={{ marginBottom: 14 }}>
                    <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'all 0.3s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#C5A880'; e.currentTarget.style.paddingLeft = '5px'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.paddingLeft = '0'; }}>
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          <p>&copy; 2026 L&apos;Émeraude Spa & Clinic. Bảo lưu toàn quyền. Đối tác cấp cao của Bella ERP.</p>
          <p>Thiết kế dành riêng cho phân hệ <strong style={{ color: '#C5A880' }}>Beauty Spa</strong></p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BeautySpaPage() {
  const [bookingService, setBookingService] = useState<string | null>(null);

  function scrollToBooking(service?: string) {
    if (service) setBookingService(service);
    const el = document.getElementById('booking');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="beauty-spa-wrapper" style={{ minHeight: '100vh', overflowX: 'hidden' }}>
      <BeautySpaNav onBook={() => scrollToBooking()} />

      {/* Decorative blobs */}
      <div style={{ position: 'fixed', top: '-10%', left: '-10%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(7,78,68,0.1) 0%, transparent 70%)', filter: 'blur(140px)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', top: '45%', right: '-10%', width: '35vw', height: '35vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(11,34,64,0.08) 0%, transparent 70%)', filter: 'blur(140px)', zIndex: 0, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <BeautySpaHero onBook={() => scrollToBooking()} />

        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
          <PhilosophySection />
          <ServicesSection onBook={(s) => scrollToBooking(s)} />
          <WizardSection onBook={(s) => scrollToBooking(s)} />
          <BookingSection prefillService={bookingService} onClear={() => setBookingService(null)} />
        </div>

        <BeautySpaFooter />
      </div>
    </div>
  );
}
