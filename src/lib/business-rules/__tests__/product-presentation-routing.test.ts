import { isHaircutProductPresentation } from '../product-presentation-routing';
import { productRegistry } from '@/platform/registry/product-registry';

describe('product presentation routing', () => {
  it('selects Haircut presentation for canonical bella_haircut product identity', () => {
    expect(isHaircutProductPresentation({ productKey: 'bella_haircut' })).toBe(true);
  });

  it('does not select Haircut presentation for Beauty Spa product identity', () => {
    expect(isHaircutProductPresentation({ productKey: 'beauty_spa' })).toBe(false);
  });

  it('does not infer Haircut presentation from a beauty_spa module capability', () => {
    const beautyTenantWithBeautyModule = {
      productKey: 'beauty_spa',
      enabledModules: { beauty_spa: true },
    };

    expect(isHaircutProductPresentation(beautyTenantWithBeautyModule)).toBe(false);
  });

  it('preserves Haircut access to required Beauty OS capability', () => {
    const haircutProduct = productRegistry.getRequired('bella_haircut');

    expect(isHaircutProductPresentation(haircutProduct)).toBe(true);
    expect(haircutProduct.requiredModules).toContain('beauty_spa');
  });

  it('leaves existing non-Haircut products outside Haircut presentation', () => {
    expect(isHaircutProductPresentation({ productKey: 'bella_babycare' })).toBe(false);
    expect(isHaircutProductPresentation(null)).toBe(false);
  });
});
