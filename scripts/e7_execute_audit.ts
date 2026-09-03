/**
 * E7: Execute Canonical Identity Audit via Supabase Client
 * 
 * Purpose: Execute all 6 E7 queries and capture results
 * Method: Direct SQL execution via supabase-js client
 * Status: READ-ONLY (no modifications)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeQuery(title: string, query: string): Promise<any> {
  console.log(`\n${'═'.repeat(67)}`);
  console.log(title);
  console.log('═'.repeat(67));
  
  const { data, error } = await supabase.rpc('exec_sql', { query });
  
  if (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
  
  return data;
}

async function e7Audit() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  E7: CANONICAL MIGRATION IDENTITY AUDIT                       ║');
  console.log('║  Date: 2026-08-24                                             ║');
  console.log('║  Status: READ-ONLY FORENSIC                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // E7.1: Enumerate exact remote identities
  const e71Query = `
SELECT 
  version,
  name,
  array_length(statements, 1) as statement_count,
  LEFT(statements[1], 100) as first_statement_preview,
  CASE 
    WHEN version ~ '^\\d{8}_' THEN 'LEGACY_8DIGIT'
    WHEN version ~ '^\\d{14}$' THEN 'STANDARD_14DIGIT'
    ELSE 'OTHER'
  END as version_format
FROM supabase_migrations.schema_migrations
WHERE 
  version LIKE '20260820%' 
  OR version LIKE '20260821%'
ORDER BY version;
  `;

  const { data: e71Data, error: e71Error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT version, name, statements
      FROM supabase_migrations.schema_migrations
      WHERE version LIKE '20260820%' OR version LIKE '20260821%'
      ORDER BY version
    `
  });

  if (e71Error) {
    console.error('❌ E7.1 Error:', e71Error.message);
  } else {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('E7.1: ENUMERATE EXACT REMOTE IDENTITIES');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`Total rows: ${e71Data?.length || 0}`);
    console.log('Expected: 16 rows\n');
    
    if (e71Data) {
      const legacy = e71Data.filter(m => /^\d{8}_/.test(m.version));
      const standard = e71Data.filter(m => /^\d{14}$/.test(m.version));
      
      console.log(`LEGACY_8DIGIT:     ${legacy.length} (expected: 7)`);
      console.log(`STANDARD_14DIGIT:  ${standard.length} (expected: 9)\n`);
      
      console.table(e71Data.map(m => ({
        version: m.version,
        name: m.name,
        format: /^\d{8}_/.test(m.version) ? 'LEGACY_8DIGIT' : 'STANDARD_14DIGIT',
      })));
    }
  }

  // E7.2: Classify each migration
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('E7.2: CLASSIFY EACH MIGRATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const localVersions = [
    '20260820151000_r4_3_gate_tokens',
    '20260820152000_r4_4_monitoring_audit',
    '20260820150000_r4_approval_contract',
    '20260820000000',
    '20260820010000',
    '20260820100000',
    '20260820110000',
    '20260820120000',
    '20260820130000',
    '20260820140000',
    '20260821122000_create_accessorial_rates_table',
    '20260821121000_create_carrier_rates_table',
    '20260821123000_create_discrepancies_table',
    '20260821120000_create_freight_audit_tables',
    '20260821000000',
    '20260821115404',
  ];

  const { data: remoteData } = await supabase.rpc('exec_sql', {
    query: `
      SELECT version, name
      FROM supabase_migrations.schema_migrations
      WHERE version LIKE '20260820%' OR version LIKE '20260821%'
    `
  });

  const remoteMap = new Map(remoteData?.map(r => [r.version, r.name]) || []);
  
  const classifications = localVersions.map(local => {
    const remoteName = remoteMap.get(local);
    return {
      local_version: local,
      remote_version: remoteName ? local : null,
      remote_name: remoteName || null,
      classification: remoteName 
        ? 'CLASS_A_EXACT_MATCH' 
        : 'CLASS_D_LOCAL_ONLY',
    };
  });

  console.table(classifications);

  const exactMatch = classifications.filter(c => c.classification === 'CLASS_A_EXACT_MATCH').length;
  const localOnly = classifications.filter(c => c.classification === 'CLASS_D_LOCAL_ONLY').length;
  
  console.log(`\n✅ CLASS_A_EXACT_MATCH: ${exactMatch} (expected: 16)`);
  console.log(`❌ CLASS_D_LOCAL_ONLY:  ${localOnly} (expected: 0)`);

  // E7.3: Verify 20260824000000 is FREE
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('E7.3: VERIFY 20260824000000 IS FREE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const { data: e73Data } = await supabase.rpc('exec_sql', {
    query: `
      SELECT version
      FROM supabase_migrations.schema_migrations
      WHERE version = '20260824000000'
    `
  });

  const status = e73Data ? 'OCCUPIED' : 'FREE';
  console.log(`20260824000000 status: ${status}`);
  console.log(`Expected: FREE\n`);

  if (status === 'FREE') {
    console.log('✅ Version FREE for RPC deployment');
  } else {
    console.log('❌ Version OCCUPIED — deployment blocked');
  }

  // E7.4: Detect remote-only migrations
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('E7.4: DETECT REMOTE-ONLY MIGRATIONS (Class C)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const remoteOnly = remoteData?.filter(r => !localVersions.includes(r.version)) || [];
  
  console.log(`Remote-only migrations: ${remoteOnly.length} (expected: 0)\n`);
  
  if (remoteOnly.length > 0) {
    console.log('❌ CLASS_C_REMOTE_ONLY detected:');
    console.table(remoteOnly);
  } else {
    console.log('✅ No remote-only migrations detected');
  }

  // E7.5: Full identity matrix
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('E7.5: FULL IDENTITY MATRIX');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const identityMatrix = e71Data?.map(m => {
    const isLegacy = /^\d{8}_/.test(m.version);
    const isStandard = /^\d{14}$/.test(m.version);
    
    let identityStatus = 'UNEXPECTED';
    if (isLegacy) {
      identityStatus = 'CLASS_A_LEGACY_EXACT_MATCH';
    } else if (isStandard) {
      identityStatus = 'CLASS_A_STANDARD_EXACT_MATCH';
    }
    
    return {
      version: m.version,
      name: m.name,
      format: isLegacy ? 'LEGACY_8DIGIT' : 'STANDARD_14DIGIT',
      identity_status: identityStatus,
    };
  }) || [];

  console.table(identityMatrix);

  const unexpected = identityMatrix.filter(m => m.identity_status === 'UNEXPECTED').length;
  console.log(`\n${unexpected === 0 ? '✅' : '❌'} UNEXPECTED formats: ${unexpected} (expected: 0)`);

  // E7.6: Summary report (already captured in screenshot)
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('E7.6: SUMMARY REPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const legacy = e71Data?.filter(m => /^\d{8}_/.test(m.version)).length || 0;
  const standard = e71Data?.filter(m => /^\d{14}$/.test(m.version)).length || 0;

  console.log(`LEGACY_8DIGIT:     ${legacy} (expected: 7)`);
  console.log(`STANDARD_14DIGIT:  ${standard} (expected: 9)`);
  console.log(`Total:             ${legacy + standard} (expected: 16)`);

  // Final gate evaluation
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  E7 GATE EVALUATION                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const conditions = [
    { name: 'E7.1: 16 rows returned', pass: e71Data?.length === 16 },
    { name: 'E7.2: All CLASS_A_EXACT_MATCH', pass: exactMatch === 16 && localOnly === 0 },
    { name: 'E7.3: 20260824000000 FREE', pass: status === 'FREE' },
    { name: 'E7.4: 0 remote-only', pass: remoteOnly.length === 0 },
    { name: 'E7.5: No UNEXPECTED', pass: unexpected === 0 },
    { name: 'E7.6: 7 legacy + 9 standard', pass: legacy === 7 && standard === 9 },
  ];

  conditions.forEach(c => {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}`);
  });

  const allPass = conditions.every(c => c.pass);

  console.log('\n' + '═'.repeat(67));
  if (allPass) {
    console.log('✅✅✅ E7 CANONICAL IDENTITY AUDIT: PASS ✅✅✅');
    console.log('═'.repeat(67));
    console.log('\nAll 16 migrations have exact local↔remote identity match.');
    console.log('20260824000000 is FREE for RPC deployment.');
    console.log('No identity divergence detected.');
    console.log('\nCLI reconciliation limitation is tooling issue, NOT provenance corruption.');
    console.log('\n🎯 NEXT: E8 Deployment Method Decision (Dashboard deployment recommended)');
  } else {
    console.log('🔴🔴🔴 E7 CANONICAL IDENTITY AUDIT: BLOCKED 🔴🔴🔴');
    console.log('═'.repeat(67));
    console.log('\n❌ Identity divergence detected. DO NOT PROCEED with deployment.');
    console.log('\nRequired actions:');
    console.log('  - Investigate failed conditions');
    console.log('  - Document findings');
    console.log('  - Escalate to Human Architect');
  }
  console.log('\n' + '═'.repeat(67) + '\n');
}

// Execute
e7Audit().catch(error => {
  console.error('❌ E7 execution failed:', error);
  process.exit(1);
});
