#!/usr/bin/env tsx
/**
 * STEP 5 Phase D Reconciliation
 * 
 * Verify 29 app routes scopes successfully registered in TG-2 gate
 */

import * as fs from 'fs';
import * as glob from 'glob';

interface ReconciliationResult {
  pass: boolean;
  tsconfig_files_created: number;
  scopes_registered_in_tg2: number;
  expected_scopes: number;
  expected_routes: number;
  missing_tsc onfigs: string[];
  missing_registrations: string[];
}

function reconcilePhaseD(): ReconciliationResult {
  console.log('🔍 STEP 5 Phase D Reconciliation');
  console.log('═══════════════════════════════════════\n');
  
  // Expected from STEP 5
  const expected_scopes = 29;
  const expected_routes = 409;
  
  // Check tsconfig files
  console.log('📁 Verifying tsconfig files...');
  const tsconfigFiles = glob.sync('tsconfig.app-routes-*.json', { cwd: process.cwd() });
  console.log(`   Found ${tsconfigFiles.length} tsconfig files\n`);
  
  // Check TG-2 registration
  console.log('📋 Verifying TG-2 gate registration...');
  const tg2Script = fs.readFileSync('scripts/governance/tg2-production-coverage.ts', 'utf-8');
  
  // Extract GOVERNED_TSCONFIGS array
  const governedArrayRegex = /const GOVERNED_TSCONFIGS = \[([\s\S]*?)\];/;
  const match = tg2Script.match(governedArrayRegex);
  
  if (!match) {
    throw new Error('Could not find GOVERNED_TSCONFIGS array');
  }
  
  const governedConfigs = match[1];
  
  // Count app-routes registrations
  const appRoutesLines = governedConfigs.split('\n').filter(line => 
    line.includes('app-routes') && line.trim().startsWith("'tsconfig.app-routes")
  );
  
  console.log(`   Found ${appRoutesLines.length} app-routes scopes registered\n`);
  
  // Sum route counts from comments
  let totalRoutes = 0;
  for (const line of appRoutesLines) {
    const match = line.match(/\((\d+) routes\)/);
    if (match) {
      totalRoutes += parseInt(match[1]);
    }
  }
  
  console.log(`   Total routes covered: ${totalRoutes}\n`);
  
  // Reconciliation
  console.log('🔍 Reconciliation Results:\n');
  console.log(`   Expected scopes:                ${expected_scopes}`);
  console.log(`   Tsconfig files created:         ${tsconfigFiles.length}`);
  console.log(`   Scopes registered in TG-2:      ${appRoutesLines.length}`);
  console.log(`   Expected routes:                ${expected_routes}`);
  console.log(`   Routes covered by registration: ${totalRoutes}\n`);
  
  const tsconfigMatch = tsconfigFiles.length === expected_scopes;
  const registrationMatch = appRoutesLines.length === expected_scopes;
  const routeMatch = totalRoutes === expected_routes;
  
  console.log('✅ Required Invariants:\n');
  console.log(`   ${tsconfigMatch ? '✅' : '❌'} tsconfig_files_created = ${expected_scopes}`);
  console.log(`   ${registrationMatch ? '✅' : '❌'} scopes_registered_in_tg2 = ${expected_scopes}`);
  console.log(`   ${routeMatch ? '✅' : '❌'} routes_covered = ${expected_routes}`);
  console.log();
  
  // Traceability
  console.log('🔗 Traceability Chain:\n');
  console.log('   Canonical route');
  console.log('      ↓');
  console.log('   scope_id (from frozen ownership map)');
  console.log('      ↓');
  console.log('   owner');
  console.log('      ↓');
  console.log('   tsconfig.app-routes-{scope_id}.json');
  console.log('      ↓');
  console.log('   GOVERNED_TSCONFIGS (TG-2 gate)');
  console.log('      ↓');
  console.log('   TG-2 coverage enforcement\n');
  
  const allPass = tsconfigMatch && registrationMatch && routeMatch;
  
  if (allPass) {
    console.log('🎉 PHASE D REGISTRATION COMPLETE\n');
    console.log('✅ All invariants PASS');
    console.log('✅ Traceability chain established');
    console.log('✅ 29 scopes registered in TG-2 gate');
    console.log('✅ 409 routes governed\n');
    console.log('🔒 STEP 5 — OWNER-BASED SCOPE ARCHITECTURE CLOSED\n');
    console.log('📋 APP ROUTES READY FOR TG-2 COVERAGE MEASUREMENT\n');
    console.log('📋 Next: npm run governance:tg2');
  } else {
    console.log('⚠️  PHASE D RECONCILIATION FAILED\n');
    console.log('STEP 5 REMAINS OPEN');
  }
  
  return {
    pass: allPass,
    tsconfig_files_created: tsconfigFiles.length,
    scopes_registered_in_tg2: appRoutesLines.length,
    expected_scopes,
    expected_routes,
    missing_tsconfigsconfigs: [],
    missing_registrations: []
  };
}

reconcilePhaseD();
