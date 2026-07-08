/**
 * Test API Endpoint for Provider Activation
 * 
 * This endpoint just logs test info and tells user to check terminal.
 * The actual providers are tested when salary page loads.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, tenantId, month } = body;

    if (!employeeId || !tenantId || !month) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: employeeId, tenantId, month' 
        },
        { status: 400 }
      );
    }

    console.log('\n' + '='.repeat(60));
    console.log('🚀 PROVIDER ACTIVATION TEST');
    console.log('='.repeat(60));
    console.log(`📋 Config: USE_CONFIG_PROVIDERS = ${process.env.USE_CONFIG_PROVIDERS || 'false'}`);
    console.log(`👤 Employee ID: ${employeeId}`);
    console.log(`🏢 Tenant ID: ${tenantId}`);
    console.log(`📅 Month: ${month}`);
    console.log('='.repeat(60));
    console.log('\n⏭️  SIMPLIFIED TEST METHOD:');
    console.log('   Providers are already running when you load /dashboard/salary page');
    console.log('   Check logs above for [PHASE_2_ACTIVE] or [PROVIDER_INTEGRATION] markers');
    console.log('   If you see [PROVIDER_INTEGRATION], set USE_CONFIG_PROVIDERS=true');
    console.log('\n' + '='.repeat(60) + '\n');

    return NextResponse.json({
      success: true,
      message: 'Check terminal logs for provider activation status',
      data: {
        employeeName: 'Test KTV',
        totalSalary: 0,
        note: 'Providers are tested automatically when salary page loads'
      },
      testInfo: {
        useConfigProviders: process.env.USE_CONFIG_PROVIDERS === 'true',
        instructions: [
          '1. Go to http://localhost:3000/dashboard/salary',
          '2. Watch npm run dev terminal for logs',
          '3. Look for [PHASE_2_ACTIVE] markers (providers ON)',
          '4. Or [PROVIDER_INTEGRATION] markers (providers in comparison mode)',
          '5. If comparison mode, set USE_CONFIG_PROVIDERS=true in .env.local'
        ],
        expectedLogMarkers: [
          '[PHASE_2_ACTIVE] KPI - Using Provider Result',
          '[PHASE_2_ACTIVE] Attendance - Using Provider Result',
          '[PHASE_2_ACTIVE] Rating - Using Provider Result'
        ]
      }
    });

  } catch (error) {
    console.error('\n❌ TEST ERROR:');
    console.error(error);

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint for usage instructions
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test/recalculate-salary',
    method: 'POST (but not needed - just load salary page)',
    purpose: 'Check provider activation status',
    simplifiedMethod: {
      step1: 'Open http://localhost:3000/dashboard/salary',
      step2: 'Watch npm run dev terminal',
      step3: 'Look for [PHASE_2_ACTIVE] logs',
      step4: 'If not found, check USE_CONFIG_PROVIDERS in .env.local'
    },
    environment: {
      USE_CONFIG_PROVIDERS: process.env.USE_CONFIG_PROVIDERS || 'false'
    },
    status: process.env.USE_CONFIG_PROVIDERS === 'true' 
      ? '✅ Providers ACTIVE - You should see [PHASE_2_ACTIVE] logs'
      : '⏸️  Providers in COMPARISON mode - You will see [PROVIDER_INTEGRATION] logs'
  });
}
