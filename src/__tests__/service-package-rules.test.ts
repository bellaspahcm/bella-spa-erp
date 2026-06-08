import {
  buildHqPackageTemplatePayload,
  buildServicePackagePayload,
  resolveDistributedPackagePrice,
  validatePackagePriceBounds,
  validateTenantPackagePriceOverride,
} from '@/lib/business-rules/service-package';

describe('service package business rules', () => {
  it('normalizes package money, session count, details, and multiplier in one place', () => {
    const payload = buildServicePackagePayload({
      name: ' VIP ',
      price: '1.500.000',
      sessions: '21',
      ktv_commission: '150.000',
      details: 'Massage body, Tam be',
      session_multiplier: '1.5',
    });

    expect(payload).toEqual(expect.objectContaining({
      name: 'VIP',
      price: 1500000,
      total_sessions: 21,
      ktv_commission: 150000,
      details: ['Massage body', 'Tam be'],
      session_multiplier: 1.5,
      status: 'active',
    }));
  });

  it('normalizes Beauty Spa service metadata without changing default babycare packages', () => {
    const defaultPayload = buildServicePackagePayload({
      name: 'Tắm bé',
      price: 450000,
    });

    expect(defaultPayload).toEqual(expect.objectContaining({
      module_key: 'babycare',
      service_kind: 'treatment_package',
      default_duration_minutes: 90,
      requires_resource: false,
      default_resource_type: null,
      before_after_required: false,
    }));

    const beautyPayload = buildServicePackagePayload({
      name: ' Facial Hydrate ',
      price: '850.000',
      module_key: 'beauty_spa',
      service_kind: 'single_service',
      service_category: ' facial ',
      default_duration_minutes: '75',
      requires_resource: true,
      default_resource_type: 'room',
      before_after_required: true,
      care_note_template: 'Ghi chú tình trạng da trước/sau buổi.',
    });

    expect(beautyPayload).toEqual(expect.objectContaining({
      name: 'Facial Hydrate',
      module_key: 'beauty_spa',
      service_kind: 'single_service',
      service_category: 'facial',
      default_duration_minutes: 75,
      requires_resource: true,
      default_resource_type: 'room',
      before_after_required: true,
      care_note_template: 'Ghi chú tình trạng da trước/sau buổi.',
    }));
  });

  it('rejects invalid HQ price bounds before database writes', () => {
    expect(validatePackagePriceBounds({
      price_floor: '1.200.000',
      price_cap: '800.000',
    })).toEqual(expect.objectContaining({
      success: false,
      error: 'Giá sàn không được lớn hơn giá trần.',
    }));

    expect(buildHqPackageTemplatePayload({
      name: 'Invalid',
      price: 1000000,
      price_floor: 1200000,
      price_cap: 800000,
    })).toEqual(expect.objectContaining({
      success: false,
      error: 'Giá sàn không được lớn hơn giá trần.',
    }));
  });

  it('resolves distributed package price using lock, floor, and cap rules', () => {
    const template = {
      id: 'template-1',
      name: 'VIP',
      price: 1000000,
      price_floor: 800000,
      price_cap: 1200000,
      allowed_franchise_override: true,
    };

    expect(resolveDistributedPackagePrice({ template })).toBe(1000000);
    expect(resolveDistributedPackagePrice({ template, existingPrice: 700000 })).toBe(800000);
    expect(resolveDistributedPackagePrice({ template, existingPrice: 1300000 })).toBe(1200000);
    expect(resolveDistributedPackagePrice({
      template: { ...template, allowed_franchise_override: false },
      existingPrice: 900000,
    })).toBe(1000000);
  });

  it('validates tenant price overrides with the same floor/cap policy', () => {
    const packageRow = {
      id: 'pkg-1',
      name: 'VIP',
      template_id: 'template-1',
      price_floor: 600000,
      price_cap: 1000000,
      allowed_franchise_override: true,
    };

    expect(validateTenantPackagePriceOverride({
      packageRow,
      newPrice: '750.000',
    })).toEqual({ success: true, price: 750000 });

    expect(validateTenantPackagePriceOverride({
      packageRow,
      newPrice: 500000,
    })).toEqual(expect.objectContaining({
      success: false,
      error: expect.stringContaining('không được thấp hơn giá sàn'),
    }));

    expect(validateTenantPackagePriceOverride({
      packageRow: { ...packageRow, allowed_franchise_override: false },
      newPrice: 750000,
    })).toEqual(expect.objectContaining({
      success: false,
      error: expect.stringContaining('khóa giá cố định bởi HQ'),
    }));
  });
});
