import { getLandingCategoryForPackage } from '@/components/features/landing/landing-data';

describe('landing package category mapping', () => {
  it('maps combo package names to the combo tab', () => {
    expect(getLandingCategoryForPackage({ name: 'Combo Mẹ & Bé Hạnh Phúc', total_sessions: 5 })).toBe('combo');
    expect(getLandingCategoryForPackage({ name: 'Gói Hoàng Gia Bella Signature', total_sessions: 5 })).toBe('combo');
  });

  it('maps postpartum package names to the sau-sinh tab', () => {
    expect(getLandingCategoryForPackage({ name: 'Gói Phục Hồi Sau Sinh', total_sessions: 5 })).toBe('sau-sinh');
    expect(getLandingCategoryForPackage({ name: 'Massage thông tắc tia sữa', total_sessions: 5 })).toBe('sau-sinh');
  });

  it('maps baby package names to the baby tab', () => {
    expect(getLandingCategoryForPackage({ name: 'Tắm Bé Chuẩn Y Khoa', total_sessions: 5 })).toBe('baby');
    expect(getLandingCategoryForPackage({ name: 'Bơi thủy liệu Hydrotherapy', total_sessions: 5 })).toBe('baby');
  });

  it('maps pregnancy package names to the bau tab', () => {
    expect(getLandingCategoryForPackage({ name: 'Gói Bầu Thư Giãn Bella', total_sessions: 5 })).toBe('bau');
    expect(getLandingCategoryForPackage({ name: 'Chăm sóc thai kỳ', total_sessions: 5 })).toBe('bau');
  });

  it('falls back to combo for long packages and bau for short packages', () => {
    expect(getLandingCategoryForPackage({ name: 'Liệu trình chuyên sâu', total_sessions: 10 })).toBe('combo');
    expect(getLandingCategoryForPackage({ name: 'Liệu trình lẻ', total_sessions: 1 })).toBe('bau');
  });
});
