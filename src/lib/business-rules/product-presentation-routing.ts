import type { ProductDefinition } from '@/platform/registry/product-registry';

export const HAIRCUT_PRODUCT_KEY = 'bella_haircut';

type ProductPresentationIdentity = Pick<ProductDefinition, 'productKey'> | null | undefined;

export function isHaircutProductPresentation(product: ProductPresentationIdentity): boolean {
  return product?.productKey === HAIRCUT_PRODUCT_KEY;
}
