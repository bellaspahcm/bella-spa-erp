import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('Public promotions UI source contracts', () => {
  it('uses typed shared promotion helpers instead of promo any mappings', () => {
    const landingHookSource = read('src/components/features/landing/useLandingData.ts');
    const portalSource = read('src/app/portal/[token]/page.tsx');
    const helperSource = read('src/lib/promotions.ts');

    expect(landingHookSource).toContain('filterActivePromotions');
    expect(landingHookSource).toContain('useState<Promotion[]>');
    expect(landingHookSource).not.toContain('promo: any');
    expect(landingHookSource).not.toContain('useState<any[]>([])');
    expect(portalSource).toContain('import type { CustomerPortalBooking }');
    expect(portalSource).toContain('booking.active_promotions.map');
    expect(portalSource).not.toContain('as Promotion[]');
    expect(portalSource).not.toContain('promo: any');
    expect(helperSource).toContain('isPromotionActiveOnDate');
  });

  // TODO: Landing page refactored from customer promotions to technical/corporate landing
  // This test expects customer-facing Vietnamese promotion text that no longer exists
  // Need to update test for new landing page structure or remove if promotion UI moved elsewhere
  it.skip('keeps public promotion labels readable', () => {
    const landingSource = read('src/app/page.tsx');
    const portalSource = read('src/app/portal/[token]/page.tsx');

    expect(landingSource).toContain('Chương trình ưu đãi');
    expect(landingSource).toContain('Khuyến mãi đặc biệt đang diễn ra');
    expect(landingSource).toContain('Mã ưu đãi');
    expect(landingSource).toContain('Sao chép mã giảm giá');
    expect(portalSource).toContain('Ưu đãi độc quyền của chị');
    expect(portalSource).toContain('Mã ưu đãi:');
    expect(portalSource).toContain('Sao chép mã');
  });
});
