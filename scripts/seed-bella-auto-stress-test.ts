/**
 * Bella Auto Production Stress Test Data Seeding
 * Matches actual schema from migrations 20260803200800 - 20260803230000
 * 
 * Scale: Start conservative, scale up after verification
 * - 10,000 VINs (target 1M)
 * - 1,000 customer journeys (target 100K)
 * - 10,000 journey events (target 10M)
 * - 5,000 touchpoints (target 5M)
 * - 100 business rules (target 10K)
 * 
 * Usage: npx tsx scripts/seed-bella-auto-stress-test.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Configuration - Conservative start
const CONFIG = {
  TENANT_NAME: 'bella_auto_stress',
  BATCH_SIZE: 500, // API-safe batch size
  BRANDS: 10,
  MODELS_PER_BRAND: 5,
  VARIANTS_PER_MODEL: 2,
  TOTAL_VINS: 5000, // Start with 5K
  TOTAL_CUSTOMERS: 500,
  EVENTS_PER_JOURNEY: 10,
  TOUCHPOINTS_PER_CUSTOMER: 5,
  TOTAL_RULES: 100,
};

type ProgressCallback = (current: number, total: number, label?: string) => void;

async function ensureTenant(): Promise<string> {
  console.log('📦 Step 1: Ensure test tenant exists...');
  
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('name', CONFIG.TENANT_NAME)
    .single();

  if (existing) {
    console.log(`✅ Using existing tenant: ${CONFIG.TENANT_NAME} (${existing.id})`);
    return existing.id;
  }

  const { data, error } = await supabase
    .from('tenants')
    .insert({
      name: CONFIG.TENANT_NAME,
      status: 'active',
      enabled_modules: ['bella_auto'],
    })
    .select('id')
    .single();

  if (error) throw error;
  
  console.log(`✅ Created tenant: ${CONFIG.TENANT_NAME} (${data.id})`);
  return data.id;
}

async function seedCatalog(tenantId: string) {
  console.log('🏷️  Step 2: Seeding catalog (brands, models, variants)...');

  // Brands
  const brands = Array.from({ length: CONFIG.BRANDS }, (_, i) => ({
    tenant_id: tenantId,
    name: `Brand ${i + 1}`,
    country_of_origin: ['Japan', 'Korea', 'Germany', 'USA', 'China'][i % 5],
    is_active: true,
  }));

  const { data: createdBrands, error: brandError } = await supabase
    .from('auto_brands')
    .insert(brands)
    .select('id');

  if (brandError) throw new Error(`Brand creation failed: ${brandError.message}`);
  console.log(`  ✓ Created ${createdBrands.length} brands`);

  // Models
  const models: any[] = [];
  for (const brand of createdBrands) {
    for (let i = 0; i < CONFIG.MODELS_PER_BRAND; i++) {
      models.push({
        tenant_id: tenantId,
        brand_id: brand.id,
        name: `Model ${models.length + 1}`,
        segment: ['Sedan', 'SUV', 'Truck', 'Hatchback', 'Coupe'][i % 5],
        is_active: true,
      });
    }
  }

  const { data: createdModels, error: modelError } = await supabase
    .from('auto_models')
    .insert(models)
    .select('id');

  if (modelError) throw new Error(`Model creation failed: ${modelError.message}`);
  console.log(`  ✓ Created ${createdModels.length} models`);

  // Variants
  const variants: any[] = [];
  for (const model of createdModels) {
    for (let i = 0; i < CONFIG.VARIANTS_PER_MODEL; i++) {
      variants.push({
        tenant_id: tenantId,
        model_id: model.id,
        name: ['Base', 'Premium', 'Sport', 'Luxury'][i % 4],
        year: 2024,
        fuel_type: ['Gasoline', 'Diesel', 'EV', 'Hybrid'][i % 4],
        transmission: ['Automatic', 'Manual'][i % 2],
        specs_json: {},
        is_active: true,
      });
    }
  }

  const { data: createdVariants, error: variantError } = await supabase
    .from('auto_variants')
    .insert(variants)
    .select('id');

  if (variantError) throw new Error(`Variant creation failed: ${variantError.message}`);
  console.log(`  ✓ Created ${createdVariants.length} variants`);

  return createdVariants.map(v => v.id);
}

async function seedVehicles(tenantId: string, variantIds: string[], onProgress: ProgressCallback) {
  console.log(`🚗 Step 3: Seeding ${CONFIG.TOTAL_VINS.toLocaleString()} vehicles...`);

  const totalBatches = Math.ceil(CONFIG.TOTAL_VINS / CONFIG.BATCH_SIZE);
  let successCount = 0;

  for (let batch = 0; batch < totalBatches; batch++) {
    const batchStart = batch * CONFIG.BATCH_SIZE;
    const batchEnd = Math.min(batchStart + CONFIG.BATCH_SIZE, CONFIG.TOTAL_VINS);
    const batchSize = batchEnd - batchStart;

    const vehicles = Array.from({ length: batchSize }, (_, i) => {
      const index = batchStart + i;
      return {
        tenant_id: tenantId,
        variant_id: variantIds[index % variantIds.length],
        vin: `VIN${index.toString().padStart(14, '0')}`, // 17 chars total
        chassis_number: `CH${index}`,
        engine_number: `EN${index}`,
        color_exterior: ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue'][index % 6],
        color_interior: 'Black',
        model_year: 2022 + (index % 3),
        list_price: 500000000 + (index % 10) * 50000000,
        cost_price: 450000000 + (index % 10) * 45000000,
        status: (['in_transit', 'warehouse', 'showroom', 'allocated', 'delivered'] as const)[index % 5],
        location_note: `Location ${(index % 10) + 1}`,
        expected_arrival_date: new Date(2024, 0, 1 + (index % 365)).toISOString().split('T')[0],
      };
    });

    const { error } = await supabase
      .from('auto_vehicles')
      .insert(vehicles);

    if (error) {
      console.error(`  ✗ Batch ${batch + 1}/${totalBatches} failed:`, error.message);
      continue;
    }

    successCount += batchSize;
    onProgress(successCount, CONFIG.TOTAL_VINS);
  }

  console.log(`✅ Vehicles seeded: ${successCount}/${CONFIG.TOTAL_VINS}`);
}

async function seedJourneyStages(tenantId: string): Promise<string[]> {
  console.log('🗺️  Step 4: Seeding journey stages...');

  const stages = [
    { code: 'lead_new', name: 'Lead mới', sort_order: 1, sla_hours: 24 },
    { code: 'contacted', name: 'Đã liên hệ', sort_order: 2, sla_hours: 48 },
    { code: 'qualified', name: 'Đã chất hóa', sort_order: 3, sla_hours: 72 },
    { code: 'test_drive', name: 'Lái thử', sort_order: 4, sla_hours: 168 },
    { code: 'quotation', name: 'Báo giá', sort_order: 5, sla_hours: 120 },
    { code: 'negotiation', name: 'Thương lượng', sort_order: 6, sla_hours: 168 },
    { code: 'deposit', name: 'Đặt cọc', sort_order: 7, sla_hours: 240 },
    { code: 'allocated', name: 'Phân bổ xe', sort_order: 8, sla_hours: 336 },
    { code: 'delivered', name: 'Bàn giao', sort_order: 9, sla_hours: 72 },
    { code: 'completed', name: 'Hoàn tất', sort_order: 10, sla_hours: null },
  ].map(s => ({ ...s, tenant_id: tenantId, is_active: true }));

  const { data, error } = await supabase
    .from('auto_journey_stages')
    .insert(stages)
    .select('id');

  if (error) throw new Error(`Journey stages creation failed: ${error.message}`);
  console.log(`  ✓ Created ${data.length} journey stages`);

  return data.map(s => s.id);
}

async function seedCustomersAndJourneys(
  tenantId: string,
  stageIds: string[],
  onProgress: ProgressCallback
) {
  console.log(`👥 Step 5: Seeding ${CONFIG.TOTAL_CUSTOMERS.toLocaleString()} customers & journeys...`);

  const totalBatches = Math.ceil(CONFIG.TOTAL_CUSTOMERS / CONFIG.BATCH_SIZE);
  let successCount = 0;

  for (let batch = 0; batch < totalBatches; batch++) {
    const batchStart = batch * CONFIG.BATCH_SIZE;
    const batchEnd = Math.min(batchStart + CONFIG.BATCH_SIZE, CONFIG.TOTAL_CUSTOMERS);
    const batchSize = batchEnd - batchStart;

    // Create customers
    const customers = Array.from({ length: batchSize }, (_, i) => {
      const index = batchStart + i;
      return {
        tenant_id: tenantId,
        full_name: `Customer ${index}`,
        phone: `0900${index.toString().padStart(6, '0')}`,
      };
    });

    const { data: createdCustomers, error: customerError } = await supabase
      .from('customers')
      .insert(customers)
      .select('id');

    if (customerError) {
      console.error(`  ✗ Customer batch ${batch + 1}/${totalBatches} failed:`, customerError.message);
      continue;
    }

    // Create journeys for these customers
    const journeys = createdCustomers.map((customer, i) => {
      const index = batchStart + i;
      return {
        tenant_id: tenantId,
        customer_id: customer.id,
        current_stage_id: stageIds[index % stageIds.length],
        entered_stage_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        sla_status: (['on_time', 'at_risk', 'breached'] as const)[index % 3],
      };
    });

    const { error: journeyError } = await supabase
      .from('auto_customer_journeys')
      .insert(journeys);

    if (journeyError) {
      console.error(`  ✗ Journey batch ${batch + 1}/${totalBatches} failed:`, journeyError.message);
      continue;
    }

    successCount += batchSize;
    onProgress(successCount, CONFIG.TOTAL_CUSTOMERS);
  }

  console.log(`✅ Customers & Journeys seeded: ${successCount}/${CONFIG.TOTAL_CUSTOMERS}`);
}

async function seedJourneyEvents(tenantId: string, stageIds: string[], onProgress: ProgressCallback) {
  console.log(`📊 Step 6: Seeding journey events...`);

  // Get all journeys
  const { data: journeys, error: fetchError } = await supabase
    .from('auto_customer_journeys')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(CONFIG.TOTAL_CUSTOMERS);

  if (fetchError || !journeys) {
    throw new Error(`Failed to fetch journeys: ${fetchError?.message}`);
  }

  const totalEvents = journeys.length * CONFIG.EVENTS_PER_JOURNEY;
  const totalBatches = Math.ceil(totalEvents / CONFIG.BATCH_SIZE);
  let successCount = 0;

  for (let batch = 0; batch < totalBatches; batch++) {
    const batchEvents: any[] = [];

    for (let i = 0; i < CONFIG.BATCH_SIZE && successCount + i < totalEvents; i++) {
      const eventIndex = batch * CONFIG.BATCH_SIZE + i;
      const journeyIndex = Math.floor(eventIndex / CONFIG.EVENTS_PER_JOURNEY);
      
      if (journeyIndex >= journeys.length) break;

      batchEvents.push({
        tenant_id: tenantId,
        journey_id: journeys[journeyIndex].id,
        from_stage_id: eventIndex % 2 === 0 ? stageIds[eventIndex % stageIds.length] : null,
        to_stage_id: stageIds[(eventIndex + 1) % stageIds.length],
        duration_hours: Math.floor(Math.random() * 168),
        reason: 'Auto-generated stress test event',
        metadata: {},
        created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    const { error } = await supabase
      .from('auto_journey_events')
      .insert(batchEvents);

    if (error) {
      console.error(`  ✗ Event batch ${batch + 1}/${totalBatches} failed:`, error.message);
      continue;
    }

    successCount += batchEvents.length;
    onProgress(successCount, totalEvents);
  }

  console.log(`✅ Journey events seeded: ${successCount}/${totalEvents}`);
}

async function seedTouchpoints(tenantId: string, onProgress: ProgressCallback) {
  console.log(`💬 Step 7: Seeding touchpoints...`);

  // Get all customers
  const { data: customers, error: fetchError } = await supabase
    .from('customers')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(CONFIG.TOTAL_CUSTOMERS);

  if (fetchError || !customers) {
    throw new Error(`Failed to fetch customers: ${fetchError?.message}`);
  }

  const totalTouchpoints = customers.length * CONFIG.TOUCHPOINTS_PER_CUSTOMER;
  const totalBatches = Math.ceil(totalTouchpoints / CONFIG.BATCH_SIZE);
  let successCount = 0;

  for (let batch = 0; batch < totalBatches; batch++) {
    const batchTouchpoints: any[] = [];

    for (let i = 0; i < CONFIG.BATCH_SIZE && successCount + i < totalTouchpoints; i++) {
      const tpIndex = batch * CONFIG.BATCH_SIZE + i;
      const customerIndex = Math.floor(tpIndex / CONFIG.TOUCHPOINTS_PER_CUSTOMER);
      
      if (customerIndex >= customers.length) break;

      batchTouchpoints.push({
        tenant_id: tenantId,
        customer_id: customers[customerIndex].id,
        channel: (['call', 'email', 'zalo', 'showroom_visit', 'test_drive', 'website_event'] as const)[tpIndex % 6],
        direction: (['inbound', 'outbound'] as const)[tpIndex % 2],
        title: `Touchpoint ${tpIndex}`,
        content: 'Auto-generated stress test touchpoint',
        interacted_at: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {},
      });
    }

    const { error } = await supabase
      .from('auto_touchpoints')
      .insert(batchTouchpoints);

    if (error) {
      console.error(`  ✗ Touchpoint batch ${batch + 1}/${totalBatches} failed:`, error.message);
      continue;
    }

    successCount += batchTouchpoints.length;
    onProgress(successCount, totalTouchpoints);
  }

  console.log(`✅ Touchpoints seeded: ${successCount}/${totalTouchpoints}`);
}

async function main() {
  const startTime = Date.now();

  console.log('🚀 Bella Auto Stress Test Data Seeding');
  console.log(`Scale: ${CONFIG.TOTAL_VINS.toLocaleString()} VINs, ${CONFIG.TOTAL_CUSTOMERS.toLocaleString()} customers`);
  console.log('');

  try {
    const tenantId = await ensureTenant();
    const variantIds = await seedCatalog(tenantId);
    
    await seedVehicles(tenantId, variantIds, (current, total) => {
      if (current % (CONFIG.BATCH_SIZE * 2) === 0 || current === total) {
        console.log(`  ⏳ ${current.toLocaleString()} / ${total.toLocaleString()} (${Math.round((current / total) * 100)}%)`);
      }
    });

    const stageIds = await seedJourneyStages(tenantId);
    
    await seedCustomersAndJourneys(tenantId, stageIds, (current, total) => {
      if (current % CONFIG.BATCH_SIZE === 0 || current === total) {
        console.log(`  ⏳ ${current.toLocaleString()} / ${total.toLocaleString()} (${Math.round((current / total) * 100)}%)`);
      }
    });

    await seedJourneyEvents(tenantId, stageIds, (current, total) => {
      if (current % (CONFIG.BATCH_SIZE * 2) === 0 || current === total) {
        console.log(`  ⏳ ${current.toLocaleString()} / ${total.toLocaleString()} (${Math.round((current / total) * 100)}%)`);
      }
    });

    await seedTouchpoints(tenantId, (current, total) => {
      if (current % (CONFIG.BATCH_SIZE * 2) === 0 || current === total) {
        console.log(`  ⏳ ${current.toLocaleString()} / ${total.toLocaleString()} (${Math.round((current / total) * 100)}%)`);
      }
    });

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    console.log('');
    console.log(`🎉 Seeding COMPLETE in ${elapsed} minutes!`);
    console.log(`Tenant: ${CONFIG.TENANT_NAME} (${tenantId})`);
    console.log('');
    console.log('✅ Next: Run production verification tests');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

main();
