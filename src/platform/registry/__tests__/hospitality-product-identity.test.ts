/**
 * Bella Hospitality Phase 0 product identity contract tests.
 *
 * Phase 0 seals only ProductRegistry/ProductResolver identity. It must not
 * create Hotel/Travel runtime, split products, DB schema, or a shared Resource
 * / Availability / Allocation kernel.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Bella Hospitality Product Identity', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('registers bella_hospitality as the single Hospitality product identity', async () => {
    const { productRegistry } = await import('../product-registry');

    const product = productRegistry.getRequired('bella_hospitality');

    expect(product.productKey).toBe('bella_hospitality');
    expect(product.displayName).toBe('Bella Hospitality');
    expect(product.subtitle).toBe('Hospitality & Travel Operations');
    expect(product.requiredModules).toEqual([]);
    expect(product.serviceProfile).toBe('hospitality');
    expect(product.defaultRoute).toBe('/dashboard/hospitality');
    expect(product.navigationProfile).toBe('hospitality');
  });

  it('keeps Hotel and Travel as future domains, not separate product keys', async () => {
    const { productRegistry } = await import('../product-registry');

    expect(productRegistry.has('bella_hospitality')).toBe(true);
    expect(productRegistry.has('bella_hotel')).toBe(false);
    expect(productRegistry.has('bella_travel')).toBe(false);
    expect(productRegistry.has('bella_resort')).toBe(false);
  });

  it('resolves tenant.product_key through the existing ProductResolver contract', async () => {
    const { productResolver } = await import('../product-resolver');

    const tenant = {
      id: 'tenant-hospitality-phase0',
      product_key: 'bella_hospitality'
    };

    const resolved = productResolver.resolve(tenant);

    expect(resolved.tenant).toBe(tenant);
    expect(resolved.product.productKey).toBe('bella_hospitality');
    expect(resolved.product.serviceProfile).toBe('hospitality');
    expect(resolved.product.defaultRoute).toBe('/dashboard/hospitality');
  });

  it('does not bind Hospitality identity to another industry OS or a shared resource kernel', async () => {
    const { productRegistry } = await import('../product-registry');

    const product = productRegistry.getRequired('bella_hospitality');

    expect(product.requiredModules).not.toContain('beauty_spa');
    expect(product.requiredModules).not.toContain('healthcare');
    expect(product.requiredModules).not.toContain('bella_education');
    expect(product.requiredModules).not.toContain('resource_allocation');
    expect(product.requiredModules).not.toContain('global_resource_kernel');
  });
});
