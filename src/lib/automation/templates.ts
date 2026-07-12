/**
 * Automation Studio - Template Data Structure
 * 
 * This file contains production-ready automation templates for Bella ERP.
 * Templates follow the template-first product philosophy inspired by Canva.
 * 
 * Design Philosophy:
 * - 95% of automations should be created from templates
 * - Templates are pre-filled with sensible defaults
 * - Users only need to adjust 1-2 fields (e.g., discount percentage)
 * 
 * @author Automation Studio Team
 * @date 2026-07-09
 */

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export type ConditionType = 
  | 'customer_tier' 
  | 'booking_value' 
  | 'day_of_week' 
  | 'is_birthday' 
  | 'session_count'
  | 'rating_average'
  | 'attendance_days'
  | 'stock_level'
  | 'expiry_days';

export type ActionType = 
  | 'apply_discount' 
  | 'award_points' 
  | 'send_sms' 
  | 'assign_ktv'
  | 'apply_bonus'
  | 'apply_deduction'
  | 'reorder_stock'
  | 'allocate_product';

export interface ConditionConfig {
  type: ConditionType;
  label: string;
  description: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'in_range' | 'is_true';
  value: string | number | boolean;
  icon: string;
}

export interface ActionConfig {
  type: ActionType;
  label: string;
  description: string;
  value: string | number | boolean;
  icon: string;
}

export interface AutomationTemplate {
  id: string;
  name: string;
  category: 'promotion' | 'booking' | 'hr' | 'commission' | 'inventory';
  icon: string;
  description: string;
  valueProp: string; // "Tiết kiệm 3 giờ/tuần"
  usageCount: number; // Social proof
  tags: string[];
  conditions: ConditionConfig[];
  actions: ActionConfig[];
  isPopular: boolean;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedSetupTime: string; // "< 2 phút"
}

// ============================================================================
// Production Templates (15 templates across 5 categories)
// ============================================================================

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  // ========================================
  // 🎁 PROMOTION TEMPLATES (5 templates)
  // ========================================
  {
    id: 'promo-vip-discount',
    name: 'Giảm giá VIP tự động',
    category: 'promotion',
    icon: '👑',
    description: 'Tự động giảm 15% cho khách VIP khi booking trên 2 triệu',
    valueProp: 'Tiết kiệm 5 giờ/tuần',
    usageCount: 248,
    tags: ['VIP', 'Giảm giá', 'Khách hàng'],
    isPopular: true,
    difficulty: 'beginner',
    estimatedSetupTime: '< 2 phút',
    conditions: [
      {
        type: 'customer_tier',
        label: 'Khách hàng VIP',
        description: 'Áp dụng cho khách có hạng VIP',
        operator: 'equals',
        value: 'VIP',
        icon: '👑',
      },
      {
        type: 'booking_value',
        label: 'Đơn hàng trên 2 triệu',
        description: 'Giá trị booking tối thiểu',
        operator: 'greater_than',
        value: 2000000,
        icon: '💰',
      },
    ],
    actions: [
      {
        type: 'apply_discount',
        label: 'Giảm 15%',
        description: 'Giảm giá trực tiếp trên hóa đơn',
        value: 15,
        icon: '🎁',
      },
      {
        type: 'send_sms',
        label: 'Gửi SMS xác nhận',
        description: 'Thông báo khách về ưu đãi',
        value: 'Chúc mừng! Bạn được giảm 15% cho booking này.',
        icon: '📱',
      },
    ],
  },

  {
    id: 'promo-birthday',
    name: 'Ưu đãi sinh nhật',
    category: 'promotion',
    icon: '🎂',
    description: 'Tặng 500 điểm và giảm 20% cho khách sinh nhật',
    valueProp: 'Tăng 35% tỷ lệ quay lại',
    usageCount: 187,
    tags: ['Sinh nhật', 'Điểm thưởng', 'Giảm giá'],
    isPopular: true,
    difficulty: 'beginner',
    estimatedSetupTime: '< 1 phút',
    conditions: [
      {
        type: 'is_birthday',
        label: 'Sinh nhật trong tuần',
        description: 'Khách có sinh nhật trong 7 ngày',
        operator: 'is_true',
        value: true,
        icon: '🎂',
      },
    ],
    actions: [
      {
        type: 'apply_discount',
        label: 'Giảm 20%',
        description: 'Khuyến mãi sinh nhật đặc biệt',
        value: 20,
        icon: '🎁',
      },
      {
        type: 'award_points',
        label: 'Tặng 500 điểm',
        description: 'Cộng điểm vào tài khoản',
        value: 500,
        icon: '⭐',
      },
      {
        type: 'send_sms',
        label: 'Gửi lời chúc sinh nhật',
        description: 'SMS tự động',
        value: 'Chúc mừng sinh nhật! Bella tặng bạn 20% giảm giá và 500 điểm.',
        icon: '📱',
      },
    ],
  },

  {
    id: 'promo-weekend',
    name: 'Flash Sale cuối tuần',
    category: 'promotion',
    icon: '⚡',
    description: 'Giảm 10% cho booking vào thứ 7, chủ nhật',
    valueProp: 'Tăng 45% đơn cuối tuần',
    usageCount: 156,
    tags: ['Flash Sale', 'Cuối tuần', 'Giảm giá'],
    isPopular: true,
    difficulty: 'beginner',
    estimatedSetupTime: '< 1 phút',
    conditions: [
      {
        type: 'day_of_week',
        label: 'Thứ 7 hoặc Chủ nhật',
        description: 'Áp dụng cho booking cuối tuần',
        operator: 'equals',
        value: 'weekend',
        icon: '📅',
      },
    ],
    actions: [
      {
        type: 'apply_discount',
        label: 'Giảm 10%',
        description: 'Flash sale cuối tuần',
        value: 10,
        icon: '⚡',
      },
      {
        type: 'send_sms',
        label: 'Thông báo flash sale',
        description: 'SMS tự động',
        value: 'Flash Sale cuối tuần! Giảm ngay 10% cho booking hôm nay.',
        icon: '📱',
      },
    ],
  },

  {
    id: 'promo-combo',
    name: 'Combo 3 dịch vụ giảm 25%',
    category: 'promotion',
    icon: '🎁',
    description: 'Giảm 25% khi khách đặt từ 3 dịch vụ trở lên',
    valueProp: 'Tăng 60% giá trị đơn trung bình',
    usageCount: 134,
    tags: ['Combo', 'Upsell', 'Giảm giá'],
    isPopular: false,
    difficulty: 'intermediate',
    estimatedSetupTime: '< 2 phút',
    conditions: [
      {
        type: 'booking_value',
        label: 'Từ 3 dịch vụ trở lên',
        description: 'Số lượng dịch vụ trong booking',
        operator: 'greater_than',
        value: 3,
        icon: '🎁',
      },
    ],
    actions: [
      {
        type: 'apply_discount',
        label: 'Giảm 25%',
        description: 'Ưu đãi combo đặc biệt',
        value: 25,
        icon: '🎁',
      },
      {
        type: 'award_points',
        label: 'Tặng 1000 điểm',
        description: 'Thưởng cho khách đặt combo',
        value: 1000,
        icon: '⭐',
      },
    ],
  },

  {
    id: 'promo-first-time',
    name: 'Khách mới giảm 30%',
    category: 'promotion',
    icon: '🆕',
    description: 'Giảm 30% cho booking đầu tiên của khách hàng mới',
    valueProp: 'Tăng 80% tỷ lệ chuyển đổi',
    usageCount: 203,
    tags: ['Khách mới', 'Giảm giá', 'Conversion'],
    isPopular: true,
    difficulty: 'beginner',
    estimatedSetupTime: '< 1 phút',
    conditions: [
      {
        type: 'session_count',
        label: 'Booking đầu tiên',
        description: 'Khách chưa từng booking trước đó',
        operator: 'equals',
        value: 0,
        icon: '🆕',
      },
    ],
    actions: [
      {
        type: 'apply_discount',
        label: 'Giảm 30%',
        description: 'Ưu đãi khách hàng mới',
        value: 30,
        icon: '🎁',
      },
      {
        type: 'send_sms',
        label: 'Chào mừng khách mới',
        description: 'SMS chào mừng',
        value: 'Chào mừng đến Bella! Booking đầu tiên giảm ngay 30%.',
        icon: '📱',
      },
    ],
  },

  // ========================================
  // 📅 BOOKING TEMPLATES (3 templates)
  // ========================================
  {
    id: 'booking-auto-assign',
    name: 'Phân công KTV tự động',
    category: 'booking',
    icon: '👩',
    description: 'Tự động phân công KTV có rating cao và lịch trống',
    valueProp: 'Tiết kiệm 8 giờ/tuần',
    usageCount: 312,
    tags: ['KTV', 'Phân công', 'Tự động'],
    isPopular: true,
    difficulty: 'intermediate',
    estimatedSetupTime: '< 3 phút',
    conditions: [
      {
        type: 'rating_average',
        label: 'KTV rating > 4.5',
        description: 'Chỉ chọn KTV có đánh giá cao',
        operator: 'greater_than',
        value: 4.5,
        icon: '⭐',
      },
    ],
    actions: [
      {
        type: 'assign_ktv',
        label: 'Phân công tự động',
        description: 'Bella chọn KTV phù hợp nhất',
        value: 'auto',
        icon: '🤖',
      },
      {
        type: 'send_sms',
        label: 'Thông báo KTV',
        description: 'SMS nhắc lịch',
        value: 'Bạn được phân công booking mới. Vui lòng kiểm tra lịch.',
        icon: '📱',
      },
    ],
  },

  {
    id: 'booking-reminder',
    name: 'Nhắc lịch trước 2 giờ',
    category: 'booking',
    icon: '⏰',
    description: 'Gửi SMS nhắc khách trước 2 giờ để giảm no-show',
    valueProp: 'Giảm 70% no-show',
    usageCount: 289,
    tags: ['Nhắc lịch', 'SMS', 'No-show'],
    isPopular: true,
    difficulty: 'beginner',
    estimatedSetupTime: '< 1 phút',
    conditions: [
      {
        type: 'booking_value',
        label: '2 giờ trước booking',
        description: 'Gửi SMS tự động trước 2 giờ',
        operator: 'equals',
        value: '2h_before',
        icon: '⏰',
      },
    ],
    actions: [
      {
        type: 'send_sms',
        label: 'Gửi SMS nhắc lịch',
        description: 'Nhắc khách về booking',
        value: 'Nhắc lịch: Bạn có booking tại Bella lúc {time}. Xác nhận: {link}',
        icon: '📱',
      },
    ],
  },

  {
    id: 'booking-peak-hours',
    name: 'Ưu tiên giờ cao điểm',
    category: 'booking',
    icon: '🔥',
    description: 'Chỉ nhận booking VIP vào giờ cao điểm (18h-21h)',
    valueProp: 'Tăng 25% doanh thu/giờ',
    usageCount: 98,
    tags: ['Cao điểm', 'VIP', 'Ưu tiên'],
    isPopular: false,
    difficulty: 'advanced',
    estimatedSetupTime: '< 3 phút',
    conditions: [
      {
        type: 'booking_value',
        label: 'Giờ cao điểm (18h-21h)',
        description: 'Booking vào khung giờ đắt khách',
        operator: 'in_range',
        value: '18:00-21:00',
        icon: '🔥',
      },
      {
        type: 'customer_tier',
        label: 'Chỉ khách VIP',
        description: 'Ưu tiên khách VIP vào giờ vàng',
        operator: 'equals',
        value: 'VIP',
        icon: '👑',
      },
    ],
    actions: [
      {
        type: 'assign_ktv',
        label: 'Phân công KTV senior',
        description: 'Chọn KTV có kinh nghiệm cao',
        value: 'senior',
        icon: '⭐',
      },
    ],
  },

  // ========================================
  // 👩 HR TEMPLATES (4 templates)
  // ========================================
  {
    id: 'hr-kpi-bonus',
    name: 'Thưởng KPI tự động',
    category: 'hr',
    icon: '🎯',
    description: 'Tự động thưởng 2 triệu cho KTV đạt >20 ca/tháng + rating >4.5',
    valueProp: 'Tiết kiệm 10 giờ/tháng',
    usageCount: 167,
    tags: ['KPI', 'Thưởng', 'KTV'],
    isPopular: true,
    difficulty: 'intermediate',
    estimatedSetupTime: '< 2 phút',
    conditions: [
      {
        type: 'session_count',
        label: 'Trên 20 ca/tháng',
        description: 'Đạt chỉ tiêu số ca',
        operator: 'greater_than',
        value: 20,
        icon: '📊',
      },
      {
        type: 'rating_average',
        label: 'Rating trên 4.5',
        description: 'Chất lượng dịch vụ đảm bảo',
        operator: 'greater_than',
        value: 4.5,
        icon: '⭐',
      },
    ],
    actions: [
      {
        type: 'apply_bonus',
        label: 'Thưởng 2 triệu',
        description: 'KPI bonus tháng',
        value: 2000000,
        icon: '💰',
      },
      {
        type: 'send_sms',
        label: 'Thông báo KTV',
        description: 'Chúc mừng đạt KPI',
        value: 'Chúc mừng! Bạn đạt KPI tháng này và được thưởng 2 triệu.',
        icon: '📱',
      },
    ],
  },

  {
    id: 'hr-attendance-deduction',
    name: 'Trừ lương vắng không phép',
    category: 'hr',
    icon: '⚠️',
    description: 'Tự động trừ 500k cho mỗi ngày vắng không phép',
    valueProp: 'Giảm 85% tranh chấp lương',
    usageCount: 145,
    tags: ['Chấm công', 'Trừ lương', 'Vi phạm'],
    isPopular: false,
    difficulty: 'intermediate',
    estimatedSetupTime: '< 2 phút',
    conditions: [
      {
        type: 'attendance_days',
        label: 'Vắng không phép',
        description: 'Không có đơn xin nghỉ',
        operator: 'equals',
        value: 'absent_no_leave',
        icon: '⚠️',
      },
    ],
    actions: [
      {
        type: 'apply_deduction',
        label: 'Trừ 500k/ngày',
        description: 'Trừ lương tự động',
        value: 500000,
        icon: '💸',
      },
      {
        type: 'send_sms',
        label: 'Thông báo vi phạm',
        description: 'SMS cảnh báo',
        value: 'Cảnh báo: Bạn vắng không phép hôm nay. Lương sẽ bị trừ 500k.',
        icon: '📱',
      },
    ],
  },

  {
    id: 'hr-overtime-bonus',
    name: 'Thưởng tăng ca',
    category: 'hr',
    icon: '🌙',
    description: 'Thưởng 1.5x lương giờ cho ca làm sau 21h',
    valueProp: 'Tăng 40% sẵn sàng tăng ca',
    usageCount: 112,
    tags: ['Tăng ca', 'Thưởng', 'Lương'],
    isPopular: false,
    difficulty: 'intermediate',
    estimatedSetupTime: '< 2 phút',
    conditions: [
      {
        type: 'session_count',
        label: 'Ca sau 21h',
        description: 'Làm việc ngoài giờ',
        operator: 'equals',
        value: 'after_21h',
        icon: '🌙',
      },
    ],
    actions: [
      {
        type: 'apply_bonus',
        label: 'Thưởng 1.5x lương giờ',
        description: 'Hệ số tăng ca',
        value: 1.5,
        icon: '💰',
      },
    ],
  },

  {
    id: 'hr-probation-bonus',
    name: 'Thưởng hoàn thành thử việc',
    category: 'hr',
    icon: '🎓',
    description: 'Thưởng 1 triệu khi KTV vượt qua thử việc (>15 ca + rating >4.0)',
    valueProp: 'Giảm 50% tỷ lệ nghỉ việc sớm',
    usageCount: 89,
    tags: ['Thử việc', 'Thưởng', 'Onboarding'],
    isPopular: false,
    difficulty: 'intermediate',
    estimatedSetupTime: '< 2 phút',
    conditions: [
      {
        type: 'session_count',
        label: 'Hoàn thành >15 ca',
        description: 'Vượt qua thử việc',
        operator: 'greater_than',
        value: 15,
        icon: '📊',
      },
      {
        type: 'rating_average',
        label: 'Rating >4.0',
        description: 'Chất lượng đạt chuẩn',
        operator: 'greater_than',
        value: 4.0,
        icon: '⭐',
      },
    ],
    actions: [
      {
        type: 'apply_bonus',
        label: 'Thưởng 1 triệu',
        description: 'Bonus hoàn thành thử việc',
        value: 1000000,
        icon: '🎓',
      },
      {
        type: 'send_sms',
        label: 'Chúc mừng',
        description: 'Thông báo chính thức',
        value: 'Chúc mừng! Bạn đã chính thức trở thành KTV của Bella. Thưởng 1 triệu.',
        icon: '📱',
      },
    ],
  },

  // ========================================
  // 💰 COMMISSION TEMPLATES (2 templates)
  // ========================================
  {
    id: 'commission-tiered',
    name: 'Hoa hồng theo bậc',
    category: 'commission',
    icon: '📈',
    description: 'Tăng hoa hồng từ 5% → 10% khi đạt >30 ca/tháng',
    valueProp: 'Tăng 65% động lực KTV',
    usageCount: 178,
    tags: ['Hoa hồng', 'Bậc thang', 'Động lực'],
    isPopular: true,
    difficulty: 'intermediate',
    estimatedSetupTime: '< 3 phút',
    conditions: [
      {
        type: 'session_count',
        label: 'Trên 30 ca/tháng',
        description: 'Đạt chỉ tiêu cao',
        operator: 'greater_than',
        value: 30,
        icon: '📊',
      },
    ],
    actions: [
      {
        type: 'apply_bonus',
        label: 'Hoa hồng 10%',
        description: 'Bậc cao nhất',
        value: 10,
        icon: '💰',
      },
    ],
  },

  {
    id: 'commission-rating-bonus',
    name: 'Thưởng rating cao',
    category: 'commission',
    icon: '⭐',
    description: 'Cộng thêm 500k cho KTV có rating trung bình >4.7',
    valueProp: 'Tăng 55% chất lượng dịch vụ',
    usageCount: 134,
    tags: ['Rating', 'Thưởng', 'Chất lượng'],
    isPopular: false,
    difficulty: 'beginner',
    estimatedSetupTime: '< 1 phút',
    conditions: [
      {
        type: 'rating_average',
        label: 'Rating >4.7',
        description: 'Dịch vụ xuất sắc',
        operator: 'greater_than',
        value: 4.7,
        icon: '⭐',
      },
    ],
    actions: [
      {
        type: 'apply_bonus',
        label: 'Thưởng 500k',
        description: 'Bonus chất lượng',
        value: 500000,
        icon: '💎',
      },
    ],
  },

  // ========================================
  // 📦 INVENTORY TEMPLATES (1 template)
  // ========================================
  {
    id: 'inventory-reorder',
    name: 'Đặt hàng tự động khi hết',
    category: 'inventory',
    icon: '📦',
    description: 'Tạo đơn đặt hàng khi tồn kho dưới 10 sản phẩm',
    valueProp: 'Giảm 90% hết hàng',
    usageCount: 67,
    tags: ['Kho', 'Đặt hàng', 'Tự động'],
    isPopular: false,
    difficulty: 'advanced',
    estimatedSetupTime: '< 3 phút',
    conditions: [
      {
        type: 'stock_level',
        label: 'Tồn kho <10',
        description: 'Sắp hết hàng',
        operator: 'less_than',
        value: 10,
        icon: '📦',
      },
    ],
    actions: [
      {
        type: 'reorder_stock',
        label: 'Đặt 50 sản phẩm',
        description: 'Tự động tạo đơn mua hàng',
        value: 50,
        icon: '🛒',
      },
      {
        type: 'send_sms',
        label: 'Thông báo quản lý',
        description: 'SMS cảnh báo hết hàng',
        value: 'Sản phẩm {product} sắp hết. Bella đã tạo đơn đặt hàng tự động.',
        icon: '📱',
      },
    ],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get template by ID
 */
export function getTemplateById(id: string): AutomationTemplate | undefined {
  return AUTOMATION_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: AutomationTemplate['category']
): AutomationTemplate[] {
  return AUTOMATION_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get popular templates (sorted by usage count)
 */
export function getPopularTemplates(limit = 5): AutomationTemplate[] {
  return [...AUTOMATION_TEMPLATES]
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, limit);
}

/**
 * Search templates by keyword
 */
export function searchTemplates(keyword: string): AutomationTemplate[] {
  const lowerKeyword = keyword.toLowerCase();
  return AUTOMATION_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerKeyword) ||
      t.description.toLowerCase().includes(lowerKeyword) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerKeyword))
  );
}

/**
 * Get total number of templates
 */
export function getTotalTemplates(): number {
  return AUTOMATION_TEMPLATES.length;
}

/**
 * Get category statistics
 */
export function getCategoryStats() {
  return {
    promotion: getTemplatesByCategory('promotion').length,
    booking: getTemplatesByCategory('booking').length,
    hr: getTemplatesByCategory('hr').length,
    commission: getTemplatesByCategory('commission').length,
    inventory: getTemplatesByCategory('inventory').length,
  };
}
