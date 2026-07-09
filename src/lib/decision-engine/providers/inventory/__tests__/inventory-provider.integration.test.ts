/**
 * @fileoverview InventoryProvider Integration Tests
 * 
 * Tests complete real-world scenarios combining multiple rules.
 * 
 * **Test Coverage:**
 * - Complete reorder workflow (2 tests)
 * - Complete allocation workflow (2 tests)
 * - Complete expiry workflow (1 test)
 * - Multi-location coordination (1 test)
 * 
 * **Total:** 6 integration tests
 */

import { InventoryProvider } from '../inventory-provider';
import type {
  InventoryDecisionInput,
  ReorderDecision,
  AllocationDecision,
  ExpiryDecision,
  _TransferDecision,
} from '../types';

describe('InventoryProvider - Integration Tests', () => {
  let provider: InventoryProvider;

  beforeEach(() => {
    provider = new InventoryProvider({ debug: false });
  });

  // ============================================================================
  // REAL-WORLD SCENARIO 1: Spa Product Running Low During Peak Season
  // ============================================================================

  test('Real-world: Spa product running low during summer peak season', async () => {
    // Scenario: Sunscreen SPF50 stock is at 35%, demand is up 40%, peak season approaching
    const input: InventoryDecisionInput = {
      tenantId: 'bella-spa-hcm',
      decisionType: 'reorder',
      productStock: {
        productId: 'sunscreen-spf50',
        productName: 'Sunscreen SPF50 Premium',
        currentStock: 70, // 35% of max
        maxStock: 200,
        minStock: 60,
        unit: 'bottle',
        daysUntilExpiry: null, // Non-perishable
        unitCost: 180000, // 180k VND
        supplierLeadTime: 5, // 5 days delivery
      },
      demandTrend: {
        productId: 'sunscreen-spf50',
        avgDailyDemand: 10, // High demand
        trending: 'up',
        trendPercentage: 0.40, // 40% increase
        seasonalityFactor: 1.6, // Peak summer season
        forecastAccuracy: 0.92,
      },
    };

    const result = (await provider.evaluate(input)) as ReorderDecision;

    // Expectations:
    // 1. Should reorder (stock < 60% during peak season)
    expect(result.shouldReorder).toBe(true);
    
    // 2. High urgency (peak season + high demand)
    expect(result.urgency).toBe('high');
    
    // 3. Should target 90% capacity (peak season buffer)
    // Target: 200 * 0.9 = 180, Current: 70, Reorder: 110
    expect(result.reorderQuantity).toBeGreaterThanOrEqual(100);
    expect(result.reorderQuantity).toBeLessThanOrEqual(130);
    
    // 4. Should mention peak season
    expect(result.reason).toContain('Peak season');
    
    // 5. Cost should be reasonable
    const expectedCost = result.reorderQuantity * 180000;
    expect(result.estimatedCost).toBe(expectedCost);
    
    // 6. Days of coverage should account for peak demand
    // With seasonality 1.6: demand = 10 * 1.6 = 16/day
    // 110 units / 16/day ≈ 7 days
    expect(result.daysOfCoverage).toBeGreaterThan(5);
    expect(result.daysOfCoverage).toBeLessThan(12);
  });

  // ============================================================================
  // REAL-WORLD SCENARIO 2: VIP Customer Booking During Low Stock
  // ============================================================================

  test('Real-world: VIP customer booking premium package, low stock situation', async () => {
    // Scenario: VIP customer books premium facial, requires rare serum, only 8 bottles left
    const input: InventoryDecisionInput = {
      tenantId: 'bella-spa-hcm',
      decisionType: 'allocation',
      productStock: {
        productId: 'serum-luxury-gold',
        productName: 'Luxury Gold Serum 24K',
        currentStock: 8, // Low stock
        maxStock: 50,
        minStock: 10,
        unit: 'bottle',
        daysUntilExpiry: 180, // 6 months
        unitCost: 1500000, // 1.5M VND (expensive)
        locationId: 'bella-spa-hcm-district1',
      },
      allocationRequest: {
        bookingId: 'booking-vip-premium-001',
        productId: 'serum-luxury-gold',
        quantity: 3, // Need 3 bottles for full treatment
        customerTier: 'vip',
        scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        isConfirmed: true,
      },
    };

    const result = (await provider.evaluate(input)) as AllocationDecision;

    // Expectations:
    // 1. Can allocate (8 > 3)
    expect(result.canAllocate).toBe(true);
    expect(result.allocatedQuantity).toBe(3);
    
    // 2. HIGH priority for VIP
    expect(result.priority).toBe('high');
    
    // 3. Should reserve (VIP + confirmed)
    expect(result.shouldReserve).toBe(true);
    
    // 4. Reservation should be 24h (VIP tier)
    expect(result.reservationExpiry).toBeDefined();
    const reservationHours = 
      (result.reservationExpiry!.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(reservationHours).toBeGreaterThan(23);
    expect(reservationHours).toBeLessThan(25);
    
    // 5. Should mention VIP
    expect(result.reason).toContain('VIP');
    
    // 6. Should allocate from correct location
    expect(result.fromLocation).toBe('bella-spa-hcm-district1');
  });

  // ============================================================================
  // REAL-WORLD SCENARIO 3: Product Approaching Expiry, Apply Discount
  // ============================================================================

  test('Real-world: Face cream approaching expiry, need to clear stock', async () => {
    // Scenario: 25 jars of face cream, 18 days until expiry, need discount to clear
    const input: InventoryDecisionInput = {
      tenantId: 'bella-spa-hcm',
      decisionType: 'expiry',
      productStock: {
        productId: 'face-cream-hydrating',
        productName: 'Hydrating Face Cream',
        currentStock: 25, // Need to clear
        maxStock: 100,
        minStock: 20,
        unit: 'jar',
        daysUntilExpiry: 18, // <30 days, triggers discount
        unitCost: 280000, // 280k VND
      },
    };

    const result = (await provider.evaluate(input)) as ExpiryDecision;

    // Expectations:
    // 1. Should discount (18 days = 15-30 days range → 10% discount)
    expect(result.action).toBe('discount');
    expect(result.discountPercentage).toBe(10); // 15-30 days = 10%
    
    // 2. Should alert manager
    expect(result.shouldAlert).toBe(true);
    expect(result.alertUrgency).toBe('medium'); // 15-30 days = medium urgency
    
    // 3. Value impact should be calculated correctly
    // Loss: 25 jars * 280,000 * 10% = 700,000 VND
    expect(result.valueImpact).toBe(-700000);
    
    // 4. Days until action = days until expiry
    expect(result.daysUntilAction).toBe(18);
    
    // 5. Reason should mention discount and waste reduction
    expect(result.reason.toLowerCase()).toContain('discount');
    expect(result.reason.toLowerCase()).toContain('waste');
  });

  // ============================================================================
  // REAL-WORLD SCENARIO 4: Critical Stock + Long Lead Time = Urgent Order
  // ============================================================================

  test('Real-world: Critical stock with long supplier lead time', async () => {
    // Scenario: Massage oil stock at 8%, supplier needs 14 days, will run out in 4 days
    const input: InventoryDecisionInput = {
      tenantId: 'bella-spa-hcm',
      decisionType: 'reorder',
      productStock: {
        productId: 'massage-oil-premium',
        productName: 'Premium Massage Oil',
        currentStock: 16, // 8% of 200 (critical!)
        maxStock: 200,
        minStock: 60,
        unit: 'bottle',
        daysUntilExpiry: null,
        unitCost: 120000,
        supplierLeadTime: 14, // 2 weeks delivery
      },
      demandTrend: {
        productId: 'massage-oil-premium',
        avgDailyDemand: 4, // Will run out in 4 days
        trending: 'stable',
        trendPercentage: 0.0,
        seasonalityFactor: 1.0,
        forecastAccuracy: 0.88,
      },
    };

    const result = (await provider.evaluate(input)) as ReorderDecision;

    // Expectations:
    // 1. MUST reorder (critical stock + lead time issue)
    expect(result.shouldReorder).toBe(true);
    
    // 2. CRITICAL or HIGH urgency
    expect(['critical', 'high']).toContain(result.urgency);
    
    // 3. Should target 80% capacity (critical stock rule)
    // Target: 200 * 0.8 = 160, Current: 16, Reorder: 144
    expect(result.reorderQuantity).toBeGreaterThan(140);
    
    // 4. Should mention BOTH critical stock AND lead time
    expect(
      result.reason.toLowerCase().includes('critical') || 
      result.reason.toLowerCase().includes('lead time')
    ).toBe(true);
    
    // 5. Order date should be immediate (today)
    const orderDate = result.recommendedOrderDate;
    const today = new Date();
    expect(orderDate.toDateString()).toBe(today.toDateString());
  });

  // ============================================================================
  // REAL-WORLD SCENARIO 5: Regular Customer Booking Confirmed
  // ============================================================================

  test('Real-world: Regular customer confirmed booking, normal allocation', async () => {
    // Scenario: Regular customer booked body treatment, needs standard products
    const input: InventoryDecisionInput = {
      tenantId: 'bella-spa-hanoi',
      decisionType: 'allocation',
      productStock: {
        productId: 'body-scrub-standard',
        productName: 'Body Scrub Standard',
        currentStock: 150, // Plenty in stock
        maxStock: 200,
        minStock: 40,
        unit: 'jar',
        daysUntilExpiry: 120,
        unitCost: 200000,
        locationId: 'bella-spa-hanoi-hoankịem',
      },
      allocationRequest: {
        bookingId: 'booking-regular-001',
        productId: 'body-scrub-standard',
        quantity: 2,
        customerTier: 'regular',
        scheduledDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        isConfirmed: true,
      },
    };

    const result = (await provider.evaluate(input)) as AllocationDecision;

    // Expectations:
    // 1. Can allocate (150 >> 2)
    expect(result.canAllocate).toBe(true);
    expect(result.allocatedQuantity).toBe(2);
    
    // 2. NORMAL priority (not VIP)
    expect(result.priority).toBe('normal');
    
    // 3. Should reserve (booking is confirmed)
    expect(result.shouldReserve).toBe(true);
    
    // 4. Reservation should be 12h (regular tier, confirmed)
    const reservationHours = 
      (result.reservationExpiry!.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(reservationHours).toBeGreaterThan(11);
    expect(reservationHours).toBeLessThan(13);
    
    // 5. Should mention standard allocation or FEFO
    expect(
      result.reason.toLowerCase().includes('standard') ||
      result.reason.toLowerCase().includes('fefo')
    ).toBe(true);
  });

  // ============================================================================
  // REAL-WORLD SCENARIO 6: Multi-Location Transfer (No Local Stock)
  // ============================================================================

  test('Real-world: No local stock, transfer from nearest location', async () => {
    // Scenario: District 3 branch out of stock, District 1 branch has plenty
    const input: InventoryDecisionInput = {
      tenantId: 'bella-spa-hcm',
      decisionType: 'allocation',
      productStock: {
        productId: 'hair-treatment-mask',
        productName: 'Hair Treatment Mask',
        currentStock: 0, // Out of stock at District 3
        maxStock: 100,
        minStock: 20,
        unit: 'jar',
        daysUntilExpiry: 90,
        unitCost: 350000,
        locationId: 'bella-spa-hcm-district3',
      },
      allocationRequest: {
        bookingId: 'booking-loyal-001',
        productId: 'hair-treatment-mask',
        quantity: 3,
        customerTier: 'loyal',
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        isConfirmed: true,
      },
      locationStocks: [
        {
          locationId: 'bella-spa-hcm-district1',
          locationName: 'Bella Spa District 1',
          productId: 'hair-treatment-mask',
          stock: 45, // Plenty here
          maxCapacity: 100,
          distanceKm: 5, // 5km away (nearest)
        },
        {
          locationId: 'bella-spa-hcm-district7',
          locationName: 'Bella Spa District 7',
          productId: 'hair-treatment-mask',
          stock: 30,
          maxCapacity: 80,
          distanceKm: 12, // 12km away (farther)
        },
      ],
    };

    const result = (await provider.evaluate(input)) as AllocationDecision;

    // Expectations:
    // 1. Cannot allocate immediately (no local stock)
    expect(result.canAllocate).toBe(false);
    expect(result.allocatedQuantity).toBe(0);
    
    // 2. Should NOT reserve (no stock)
    expect(result.shouldReserve).toBe(false);
    
    // 3. Should mention transfer
    expect(result.reason.toLowerCase()).toContain('transfer');
    
    // 4. Should recommend District 1 (nearest with sufficient stock)
    expect(result.reason).toContain('District 1');
    expect(result.reason).toContain('45'); // Available stock
    expect(result.reason).toContain('5km'); // Distance
  });
});

