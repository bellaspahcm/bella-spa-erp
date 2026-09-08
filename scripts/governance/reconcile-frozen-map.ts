#!/usr/bin/env tsx
/**
 * Reconcile Frozen Ownership Map
 * 
 * Verify structural invariants + derive final ownership distribution
 */

import * as fs from 'fs';

interface OwnershipRow {
  file_path: string;
  route_path: string;
  file_role: string;
  owner: string;
  owner_type: string;
  status: string;
  primary_evidence: string;
  secondary_evidence: string;
  confidence: string;
  notes: string;
}

function parseOwnershipCSV(csvPath: string): OwnershipRow[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const rows: OwnershipRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const match = lines[i].match(/"([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]*)","([^"]*)","([^"]+)","([^"]*)"/);
    if (match) {
      rows.push({
        file_path: match[1],
        route_path: match[2],
        file_role: match[3],
        owner: match[4],
        owner_type: match[5],
        status: match[6],
        primary_evidence: match[7],
        secondary_evidence: match[8],
        confidence: match[9],
        notes: match[10]
      });
    }
  }
  
  return rows;
}

function main() {
  console.log('🔍 Final Reconciliation — Frozen Ownership Map');
  console.log('═══════════════════════════════════════════════\n');
  
  const frozenPath = 'docs/architecture/gate3/TG2_APP_ROUTES_OWNERSHIP_MAP_FROZEN.csv';
  
  console.log('📁 Loading frozen ownership map...');
  const rows = parseOwnershipCSV(frozenPath);
  console.log(`   ${rows.length} routes loaded\n`);
  
  // Structural invariants
  console.log('🔍 Verifying Structural Invariants...\n');
  
  const uniquePaths = new Set(rows.map(r => r.file_path));
  const duplicates = rows.length - uniquePaths.size;
  
  const knownWithoutEvidence = rows.filter(r => 
    r.status === 'KNOWN' && !r.primary_evidence.trim()
  );
  
  const invalidStatuses = rows.filter(r => 
    !['KNOWN', 'AMBIGUOUS', 'UNKNOWN'].includes(r.status)
  );
  
  console.log('   Structural Invariants:');
  console.log(`   rows_total:              ${rows.length === 445 ? '✅' : '❌'} ${rows.length}`);
  console.log(`   unique_file_path:        ${uniquePaths.size === 445 ? '✅' : '❌'} ${uniquePaths.size}`);
  console.log(`   duplicate_file_path:     ${duplicates === 0 ? '✅' : '❌'} ${duplicates}`);
  console.log(`   KNOWN_without_evidence:  ${knownWithoutEvidence.length === 0 ? '✅' : '❌'} ${knownWithoutEvidence.length}`);
  console.log(`   invalid_status:          ${invalidStatuses.length === 0 ? '✅' : '❌'} ${invalidStatuses.length}\n`);
  
  // Final ownership distribution
  const known = rows.filter(r => r.status === 'KNOWN').length;
  const ambiguous = rows.filter(r => r.status === 'AMBIGUOUS').length;
  const unknown = rows.filter(r => r.status === 'UNKNOWN').length;
  
  console.log('📊 Final Ownership Distribution:');
  console.log(`   KNOWN:      ${known}`);
  console.log(`   AMBIGUOUS:  ${ambiguous}`);
  console.log(`   UNKNOWN:    ${unknown}`);
  console.log(`   TOTAL:      ${rows.length}`);
  console.log(`   Sum check:  ${known + ambiguous + unknown === rows.length ? '✅' : '❌'}\n`);
  
  // Owner type breakdown
  const products = rows.filter(r => r.owner_type === 'Product' && r.status === 'KNOWN').length;
  const platform = rows.filter(r => r.owner_type === 'Platform' && r.status === 'KNOWN').length;
  const unknownType = rows.filter(r => r.owner_type === 'UNKNOWN').length;
  const ambiguousType = rows.filter(r => r.owner_type === 'AMBIGUOUS').length;
  
  console.log('📊 Owner Type Breakdown (KNOWN only):');
  console.log(`   Product:   ${products}`);
  console.log(`   Platform:  ${platform}`);
  console.log(`   UNKNOWN:   ${unknownType}`);
  console.log(`   AMBIGUOUS: ${ambiguousType}\n`);
  
  // Delta from STEP 2
  const step2Known = 386;
  const step2Ambiguous = 23;
  const step2Unknown = 36;
  
  console.log('📊 Delta from STEP 2:');
  console.log(`   KNOWN:      ${step2Known} → ${known} (${known - step2Known >= 0 ? '+' : ''}${known - step2Known})`);
  console.log(`   AMBIGUOUS:  ${step2Ambiguous} → ${ambiguous} (${ambiguous - step2Ambiguous >= 0 ? '+' : ''}${ambiguous - step2Ambiguous})`);
  console.log(`   UNKNOWN:    ${step2Unknown} → ${unknown} (${unknown - step2Unknown >= 0 ? '+' : ''}${unknown - step2Unknown})\n`);
  
  const allInvariantsPass = 
    rows.length === 445 &&
    uniquePaths.size === 445 &&
    duplicates === 0 &&
    knownWithoutEvidence.length === 0 &&
    invalidStatuses.length === 0;
  
  if (allInvariantsPass) {
    console.log('🎉 ALL STRUCTURAL INVARIANTS PASS');
    console.log('\n✅ STEP 4 — BOUNDARY DECISIONS + FREEZE 🔒 CLOSED');
    console.log('\n📋 Frozen Ownership Map: ' + frozenPath);
    console.log('📋 Decision Provenance: docs/architecture/gate3/TG2_STEP4_DECISIONS.csv');
    console.log('\n📋 Next: STEP 5 — Owner-based Scope Architecture Design');
  } else {
    console.log('❌ STRUCTURAL INVARIANTS FAILED');
    console.log('   STEP 4 REMAINS OPEN');
  }
}

main();
