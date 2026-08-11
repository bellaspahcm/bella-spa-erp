/**
 * Production Test Data Seeding - TypeScript Version
 * Generate realistic data for stress testing via Supabase client
 * 
 * Scale targets:
 * - 1,000,000 VINs
 * - 10,000,000 journey events
 * - 5,000,000 touchpoints
 * - 100,000 customer journeys
 * - 10,000 rules
 * 
 * Usage: npx tsx scripts/seed-production-test-data.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY);

// Configuration
const CONFIG = {
  TENANT_CODE: 'bella_auto_stress_test',
  BATCH_SIZE: 1000, // Reduced for API limitations
  TOTAL_VINS: 10000, // Start smaller: 10K instead of 1M
  TOTAL_JOURNEYS: 1000, // 1K instead of 100K
  TOTAL_EVENTS: 10000, // 10K instead of 10M
  TOTAL_TOUCHPOINTS: 5000,
  TOTAL_RULES: 100, // 100 instead of 10K
};

type ProgressCallback = (current: number, total: number) => void;

async function createTestTenant(): Promise<string> {
  console.log('📦 Step 1: Create test tenant...');
  
  // Try to find existing tenant first
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('name', CONFIG.TENANT_CODE)
    .single();

  if (existing) {
    console.log(`✅ Using existing tenant: ${CONFIG.TENANT_CODE} (ID: ${existing.id})`);
    return existing.id;
  }

  // Create new tenant
  const { data, error } = await supabase
    .from('tenants')
    .insert({
      name: CONFIG.TENANT_CODE,
      status: 'active',
      enabled_modules: ['bella_auto'],
    })
    .select('id')
    .single();

  if (error) throw error;
  
  console.log(`✅ Tenant created: ${CONFIG.TENANT_CODE} (ID: ${data.id})`);
  return data.id;
}

async function seedVINs(tenantId: string, onProgress: ProgressCallback) {
  console.log(`🚗 Step 2: Seeding ${CONFIG.TOTAL_VINS.toLocaleString()} VINs...`);
  
  // Create brands
  const brands = Array.from({ length: 20 }, (_, i) => ({
    tenant_id: tenantId,
    code: `BRAND${i + 1}`,
    name: `Test Brand ${i + 1}`,
    country_origin: ['Japan', 'Korea', 'Germany', 'USA', 'China'][i % 5],
  }));

  const { data: createdBrands, error: brandError } = await supabase
    .from('auto_brands')
    .upsert(brands, { onConflict: 'tenant_id,code' })
    .select('id');

  if (brandError) {
    console.warn('Brand creation warning:', brandError);
  }

  // Create models
  const models = Array.from({ length: 100 }, (_, i) => ({
    tenant_id: tenantId,
    brand_id: createdBrands?.[i % (createdBrands.length || 1)]?.id || brands[0].tenant_id,
    code: `MODEL${i + 1}`,
    name: `Test Model ${i + 1}`,
    segment: ['sedan', 'suv', 'truck', 'hatchback'][i % 4] as any,
  }));

  const { data: createdModels, error: modelError } = await supabase
    .from('auto_models')
    .upsert(models, { onConflict: 'tenant_id,code' })
    .select('id');

  if (modelError) {
    console.warn('Model creation warning:', modelError);
  }

  // Create variants for models
  const variants: any[] = [];
  if (createdModels) {
    for (const model of createdModels.slice(0, 10)) { // Only first 10 models
      variants.push({
        tenant_id: tenantId,
        model_id: model.id,
        code: `VARIANT_${model.id}`,
        name: `Standard Variant`,
        trim_level: 'standard',
      });
    }
  }

  const { data: createdVariants } = await supabase
    .from('auto_variants')
    .upsert(variants, { onConflict: 'tenant_id,code' })
    .select('id');

  // Create vehicles in batches
  const totalBatches = Math.ceil(CONFIG.TOTAL_VINS / CONFIG.BATCH_SIZE);
  
  for (let i = 0; i < totalBatches; i++) {
    const batchVehicles = Array.from({ length: CONFIG.BATCH_SIZE }, (_, j) => {
      const index = i * CONFIG.BATCH_SIZE + j;
      if (index >= CONFIG.TOTAL_VINS) return null;

      return {
        tenant_id: tenantId,
        vin: `VIN${index.toString().padStart(12, '0')}`,
        variant_id: createdVariants?.[index % (createdVariants.length || 1)]?.id,
        color_exterior: ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue'][index % 6],
        color_interior: 'Black',
        model_year: 2020 + (index % 5),
        status: ['in_transit', 'warehouse', 'showroom', 'allocated', 'delivered'][index % 5] as any,
        acquisition_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        acquisition_price: 500000000 + Math.floor(Math.random() * 1500000000),
        current_location: 'Warehouse A',
      };
    }).filter(Boolean);

    const { error } = await supabase
      .from('auto_vehicles')
      .insert(batchVehicles);

    if (error) {
      console.error(`Batch ${i + 1} failed:`, error);
      continue;
    }

    onProgress((i + 1) * CONFIG.BATCH_SIZE, CONFIG.TOTAL_VINS);
  }

  console.log(`✅ VINs seeded`);
}

async function seedCustomerJourneys(tenantId: string, onProgress: ProgressCallback) {
  console.log(`👥 Step 3: Seeding ${CONFIG.TOTAL_JOURNEYS.toLocaleString()} customer journeys...`);

  // Create customers
  const totalBatches = Math.ceil(CONFIG.TOTAL_JOURNEYS / CONFIG.BATCH_SIZE);

  for (let i = 0; i < totalBatches; i++) {
    const batchCustomers = Array.from({ length: CONFIG.BATCH_SIZE }, (_, j) => {
      const index = i * CONFIG.BATCH_SIZE + j;
      if (index >= CONFIG.TOTAL_JOURNEYS) return null;

      return {
        tenant_id: tenantId,
        full_name: `Customer ${index}`,
        phone: `0900${index.toString().padStart(6, '0')}`,
        email: `customer${index}@test.com`,
      };
    }).filter(Boolean);

    const { error } = await supabase
      .from('customers')
      .insert(batchCustomers);

    if (error) {
      console.error(`Customer batch ${i + 1} failed:`, error);
      continue;
    }

    onProgress((i + 1) * CONFIG.BATCH_SIZE, CONFIG.TOTAL_JOURNEYS);
  }

  console.log(`✅ Customers created`);

  // Get journey stages
  const { data: stages } = await supabase
    .from('auto_journey_stages')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(10);

  if (!stages || stages.length === 0) {
    console.warn('⚠️  No journey stages found. Creating default stages...');
    
    const defaultStages = [
      { tenant_id: tenantId, name: 'Lead Inquiry', order_index: 1, is_initial: true },
      { tenant_id: tenantId, name: 'Test Drive', order_index: 2 },
      { tenant_id: tenantId, name: 'Quotation', order_index: 3 },
      { tenant_id: tenantId, name: 'Deposit', order_index: 4 },
      { tenant_id: tenantId, name: 'Delivery', order_index: 5, is_final: true },
    ];

    const { data: createdStages } = await supabase
      .from('auto_journey_stages')
      .insert(defaultStages)
      .select('id');

    if (createdStages) {
      stages.push(...createdStages);
    }
  }

  // Get customer IDs
  const { data: customers } = await supabase
    .from('customers')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(CONFIG.TOTAL_JOURNEYS);

  if (!customers || customers.length === 0) {
    throw new Error('No customers found');
  }

  // Create journeys
  const journeyBatches = Math.ceil(customers.length / CONFIG.BATCH_SIZE);

  for (let i = 0; i < journeyBatches; i++) {
    const batchJourneys = customers
      .slice(i * CONFIG.BATCH_SIZE, (i + 1) * CONFIG.BATCH_SIZE)
      .map((customer, j) => ({
        tenant_id: tenantId,
        customer_id: customer.id,
        current_stage_id: stages![j % stages!.length].id,
        status: (['active', 'completed', 'lost', 'on_hold'] as const)[j % 4],
        priority: (['high', 'medium', 'low'] as const)[j % 3],
        started_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      }));

    const { error } = await supabase
      .from('auto_customer_journeys')
      .insert(batchJourneys);

    if (error) {
      console.error(`Journey batch ${i + 1} failed:`, error);
      continue;
    }

    onProgress((i + 1) * CONFIG.BATCH_SIZE, customers.length);
  }

  console.log(`✅ Journeys seeded`);
}

async function seedJourneyEvents(tenantId: string, onProgress: ProgressCallback) {
  console.log(`📊 Step 4: Seeding ${CONFIG.TOTAL_EVENTS.toLocaleString()} journey events...`);
  console.log('  ⚠️  This may take several minutes...');

  // Get journeys
  const { data: journeys } = await supabase
    .from('auto_customer_journeys')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(CONFIG.TOTAL_JOURNEYS);

  if (!journeys || journeys.length === 0) {
    throw new Error('No journeys found');
  }

  // Get stages
  const { data: stages } = await supabase
    .from('auto_journey_stages')
    .select('id')
    .eq('tenant_id', tenantId);

  if (!stages || stages.length === 0) {
    throw new Error('No stages found');
  }

  const eventsPerJourney = Math.ceil(CONFIG.TOTAL_EVENTS / journeys.length);
  const totalBatches = Math.ceil(CONFIG.TOTAL_EVENTS / CONFIG.BATCH_SIZE);

  for (let i = 0; i < totalBatches; i++) {
    const batchEvents = Array.from({ length: CONFIG.BATCH_SIZE }, (_, j) => {
      const index = i * CONFIG.BATCH_SIZE + j;
      if (index >= CONFIG.TOTAL_EVENTS) return null;

      const journeyIndex = Math.floor(index / eventsPerJourney);
      if (journeyIndex >= journeys.length) return null;

      return {
        tenant_id: tenantId,
        journey_id: journeys[journeyIndex].id,
        event_type: [
          'stage_entered',
          'stage_completed',
          'test_drive_scheduled',
          'quotation_sent',
          'deposit_paid',
          'vehicle_allocated',
          'delivery_scheduled',
          'follow_up_call',
          'email_sent',
          'note_added',
        ][index % 10],
        stage_id: stages[index % stages.length].id,
        data: {
          note: 'Auto-generated test event',
          value: Math.floor(Math.random() * 1000000),
        },
        occurred_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }).filter(Boolean);

    const { error } = await supabase
      .from('auto_journey_events')
      .insert(batchEvents);

    if (error) {
      console.error(`Event batch ${i + 1} failed:`, error);
      continue;
    }

    onProgress((i + 1) * CONFIG.BATCH_SIZE, CONFIG.TOTAL_EVENTS);
  }

  console.log(`✅ Events seeded`);
}

async function seedBusinessRules(tenantId: string) {
  console.log(`📋 Step 5: Seeding ${CONFIG.TOTAL_RULES} business rules...`);

  const rules = Array.from({ length: CONFIG.TOTAL_RULES }, (_, i) => ({
    tenant_id: tenantId,
    name: `Test Rule ${i + 1}`,
    description: `Auto-generated test rule for performance testing`,
    entity_type: ['journey', 'vehicle', 'customer', 'event'][i % 4] as any,
    trigger_event: ['create', 'update', 'delete', 'status_change'][i % 4] as any,
    conditions: {
      field: 'status',
      operator: 'equals',
      value: 'active',
    },
    actions: [
      {
        type: 'notify',
        params: { message: `Rule ${i + 1} triggered` },
      },
    ],
    priority: (i % 10) + 1,
    is_active: i % 10 !== 0, // 90% active
  }));

  const batches = Math.ceil(rules.length / CONFIG.BATCH_SIZE);

  for (let i = 0; i < batches; i++) {
    const batch = rules.slice(i * CONFIG.BATCH_SIZE, (i + 1) * CONFIG.BATCH_SIZE);

    const { error } = await supabase
      .from('business_rules')
      .insert(batch);

    if (error) {
      console.error(`Rule batch ${i + 1} failed:`, error);
      continue;
    }
  }

  console.log(`✅ Rules seeded`);
}

async function main() {
  const startTime = Date.now();

  console.log('🚀 Starting production test data seeding...');
  console.log(`Scale: ${CONFIG.TOTAL_VINS.toLocaleString()} VINs, ${CONFIG.TOTAL_JOURNEYS.toLocaleString()} journeys, ${CONFIG.TOTAL_EVENTS.toLocaleString()} events`);
  console.log('');

  try {
    // Step 1: Create tenant
    const tenantId = await createTestTenant();

    // Step 2: Seed VINs
    await seedVINs(tenantId, (current, total) => {
      if (current % (CONFIG.BATCH_SIZE * 5) === 0 || current === total) {
        console.log(`  ⏳ Progress: ${current.toLocaleString()} / ${total.toLocaleString()} (${Math.round((current / total) * 100)}%)`);
      }
    });

    // Step 3: Seed customer journeys
    await seedCustomerJourneys(tenantId, (current, total) => {
      if (current % (CONFIG.BATCH_SIZE * 2) === 0 || current === total) {
        console.log(`  ⏳ Progress: ${current.toLocaleString()} / ${total.toLocaleString()} (${Math.round((current / total) * 100)}%)`);
      }
    });

    // Step 4: Seed journey events
    await seedJourneyEvents(tenantId, (current, total) => {
      if (current % (CONFIG.BATCH_SIZE * 5) === 0 || current === total) {
        console.log(`  ⏳ Progress: ${current.toLocaleString()} / ${total.toLocaleString()} (${Math.round((current / total) * 100)}%)`);
      }
    });

    // Step 5: Seed business rules
    await seedBusinessRules(tenantId);

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    console.log('');
    console.log(`🎉 Production test data seeding COMPLETE in ${elapsed} minutes!`);
    console.log(`Tenant ID: ${tenantId}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Run load tests: k6 run --vus 100 --duration 5m scripts/load-test-k6.js');
    console.log('2. Monitor query performance in Supabase dashboard');
    console.log('3. Check database size and index usage');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

main();
