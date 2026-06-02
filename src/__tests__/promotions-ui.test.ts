import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const mojibakePattern = /\uFFFD|\u00EF\u00BF\u00BD|\u00C3|\u00C4|\u00C2|\u00F0\u0178|\u00E1\u00BA|\u00E1\u00BB|\u00C6|\u00E2\u20AC|\u00E2\u20AC\u00A2/;

function read(relativePath: string) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('Promotions settings UI source contracts', () => {
  it('keeps promotions UI copy free from mojibake markers', () => {
    const uiFiles = [
      'src/app/dashboard/settings/components/PromotionsTab.tsx',
      'src/app/dashboard/settings/components/promotions/PromotionForm.tsx',
      'src/app/dashboard/settings/components/promotions/PromotionList.tsx',
      'src/app/dashboard/settings/components/promotions/usePromotionsSettings.ts',
    ];

    for (const file of uiFiles) {
      expect(read(file)).not.toMatch(mojibakePattern);
    }
  });

  it('routes promotions settings through dedicated hook and components', () => {
    const tabSource = read('src/app/dashboard/settings/components/PromotionsTab.tsx');
    const hookSource = read('src/app/dashboard/settings/components/promotions/usePromotionsSettings.ts');
    const formSource = read('src/app/dashboard/settings/components/promotions/PromotionForm.tsx');
    const listSource = read('src/app/dashboard/settings/components/promotions/PromotionList.tsx');

    expect(tabSource).toContain('usePromotionsSettings');
    expect(tabSource).toContain('<PromotionForm');
    expect(tabSource).toContain('<PromotionList');
    expect(hookSource).toContain('getPromotions');
    expect(hookSource).toContain('createPromotion');
    expect(hookSource).toContain('togglePromotionActive');
    expect(hookSource).toContain('deletePromotion');
    expect(formSource).toContain('onSubmit={onSubmit}');
    expect(listSource).toContain('formatPromotionDateRange');
  });
});
