import type { Database } from '@/types/database.types';

export interface ServicePackage {
  id: string;
  name: string;
  price: string;
  duration: string;
  description: string;
  benefits: string[];
  tag?: string;
  total_sessions?: number;
}

export type PackageRow = Database['public']['Tables']['packages']['Row'];
export type LandingCategoryKey = 'bau' | 'sau-sinh' | 'baby' | 'combo';

type LandingPackageCategoryInput = Pick<PackageRow, 'name' | 'total_sessions'>;

const LANDING_PACKAGE_CATEGORY_KEYWORDS: Array<{
  category: LandingCategoryKey;
  keywords: string[];
}> = [
  {
    category: 'combo',
    keywords: ['combo', 'home-care', 'home care', 'signature'],
  },
  {
    category: 'sau-sinh',
    keywords: ['sau sinh', 'phuc hoi', 'eo thon', 'dang ngoc', 'tia sua'],
  },
  {
    category: 'baby',
    keywords: ['be', 'tam', 'hydrotherapy', 'con yeu'],
  },
  {
    category: 'bau',
    keywords: ['bau', 'thai'],
  },
];

function normalizeLandingPackageName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

function matchesLandingPackageKeyword(normalizedName: string, keyword: string) {
  const searchableName = normalizedName.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const normalizedKeyword = normalizeLandingPackageName(keyword).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (normalizedKeyword.includes(' ')) {
    return searchableName.includes(normalizedKeyword);
  }

  return ` ${searchableName} `.includes(` ${normalizedKeyword} `);
}

export function getLandingCategoryForPackage(pkg: LandingPackageCategoryInput): LandingCategoryKey {
  const normalizedName = normalizeLandingPackageName(pkg.name);

  for (const { category, keywords } of LANDING_PACKAGE_CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => matchesLandingPackageKeyword(normalizedName, keyword))) {
      return category;
    }
  }

  return Number(pkg.total_sessions || 0) >= 10 ? 'combo' : 'bau';
}

export interface LandingCategory {
  title: string;
  description: string;
  packages: ServicePackage[];
}

export type LandingCategories = Record<LandingCategoryKey, LandingCategory>;

export const DEFAULT_SERVICE_CATEGORIES: LandingCategories = {
  bau: {
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
        tag: 'Phổ biến nhất',
      },
      {
        id: 'bau-2',
        name: 'Gói Bầu VIP Toàn Diện',
        price: '690.000đ',
        duration: '100 phút',
        description: 'Liệu pháp tối ưu giúp chăm sóc các cơn đau mỏi nặng, kết hợp massage mặt chuyên sâu đá nóng.',
        benefits: [
          'Rửa chân và xông chân đá muối Himalaya',
          'Massage chuyên sâu thắt lưng, hông',
          'Massage Thụy Điển kết hợp đá nóng bazan',
          'Chăm sóc da mặt chuyên sâu sữa ong chúa',
          'Gội đầu dưỡng sinh thảo dược tự nhiên',
        ],
        tag: 'Khuyên dùng',
      },
    ],
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
        ],
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
        tag: 'Đặc sắc nhất',
      },
    ],
  },
  baby: {
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
        ],
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
        tag: 'Khuyên dùng',
      },
    ],
  },
  combo: {
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
        ],
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
        tag: 'Siêu giá trị',
      },
    ],
  },
};

export function cloneLandingCategories(categories: LandingCategories): LandingCategories {
  return {
    bau: {
      ...categories.bau,
      packages: [...categories.bau.packages],
    },
    'sau-sinh': {
      ...categories['sau-sinh'],
      packages: [...categories['sau-sinh'].packages],
    },
    baby: {
      ...categories.baby,
      packages: [...categories.baby.packages],
    },
    combo: {
      ...categories.combo,
      packages: [...categories.combo.packages],
    },
  };
}

export function createEmptyLandingCategories(): LandingCategories {
  return {
    bau: {
      ...DEFAULT_SERVICE_CATEGORIES.bau,
      packages: [],
    },
    'sau-sinh': {
      ...DEFAULT_SERVICE_CATEGORIES['sau-sinh'],
      packages: [],
    },
    baby: {
      ...DEFAULT_SERVICE_CATEGORIES.baby,
      packages: [],
    },
    combo: {
      ...DEFAULT_SERVICE_CATEGORIES.combo,
      packages: [],
    },
  };
}
