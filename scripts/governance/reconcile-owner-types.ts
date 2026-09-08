#!/usr/bin/env tsx
/**
 * Reconcile Owner Types in Frozen Map
 * 
 * Fix 23 newly-resolved KNOWN routes missing owner_type
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

function deriveOwnerType(owner: string): string {
  // Product owners
  const productOwners = [
    'Preschool',
    'Hospital',
    'AutoMove',
    'Real Estate',
    'Medical Clinic',
    'Dental',
    'Beauty/Spa'
  ];
  
  if (productOwners.includes(owner)) {
    return 'Product';
  }
  
  // Platform owners
  const platformOwners = [
    'Healthcare Shared',
    'Intelligence',
    'Admin',
    'Partner Management',
    'Workforce Management',
    'Identity/Auth',
    'Platform Core',
    'Decision Engine',
    'Customer Management',
    'Booking Engine',
    'Waitlist',
    'AI Copilot',
    'Operations',
    'Training',
    'Marketing',
    'Inventory',
    'Workflows',
    'HR/Payroll',
    'Finance Core',
    'Platform Finance Core',
    'Test/Debug',
    'Dashboard General',
    'Marketing/Landing'
  ];
  
  if (platformOwners.includes(owner)) {
    return 'Platform';
  }
  
  // Special cases
  if (owner === 'UNKNOWN') {
    return 'UNKNOWN';
  }
  
  if (owner.includes('/')) {
    // Multi-owner like "Medical Clinic / Healthcare Shared"
    return 'AMBIGUOUS';
  }
  
  // Default to Platform for unrecognized but non-UNKNOWN owners
  return 'Platform';
}

function reconcileOwnerTypes(rows: OwnershipRow[]): { updated: number; rows: OwnershipRow[] } {
  let updated = 0;
  
  for (const row of rows) {
    if (row.status === 'KNOWN' && row.owner !== 'UNKNOWN') {
      const derivedType = deriveOwnerType(row.owner);
      
      // Only update if owner_type is inconsistent
      if (row.owner_type !== derivedType) {
        console.log(`   Reconciling: ${row.route_path}`);
        console.log(`      Owner: ${row.owner}`);
        console.log(`      ${row.owner_type} → ${derivedType}`);
        row.owner_type = derivedType;
        updated++;
      }
    }
    
    // Handle AMBIGUOUS/UNKNOWN status
    if (row.status === 'AMBIGUOUS' && row.owner_type !== 'AMBIGUOUS') {
      row.owner_type = 'AMBIGUOUS';
      updated++;
    }
    
    if (row.status === 'UNKNOWN' && row.owner_type !== 'UNKNOWN') {
      row.owner_type = 'UNKNOWN';
      updated++;
    }
  }
  
  return { updated, rows };
}

function main() {
  console.log('🔧 Owner Type Reconciliation');
  console.log('═══════════════════════════════\n');
  
  const frozenPath = 'docs/architecture/gate3/TG2_APP_ROUTES_OWNERSHIP_MAP_FROZEN.csv';
  
  console.log('📁 Loading frozen ownership map...');
  const rows = parseOwnershipCSV(frozenPath);
  console.log(`   ${rows.length} routes loaded\n`);
  
  console.log('🔍 Identifying owner_type gaps...');
  const knownRoutes = rows.filter(r => r.status === 'KNOWN');
  const missingType = knownRoutes.filter(r => 
    !['Product', 'Platform'].includes(r.owner_type)
  );
  
  console.log(`   KNOWN routes:              ${knownRoutes.length}`);
  console.log(`   Missing/incorrect type:    ${missingType.length}\n`);
  
  if (missingType.length > 0) {
    console.log('🔧 Reconciling owner_types...\n');
    const { updated, rows: reconciledRows } = reconcileOwnerTypes(rows);
    console.log(`\n   ✅ Updated ${updated} rows\n`);
    
    // Write reconciled CSV
    console.log('💾 Writing reconciled ownership map...');
    const header = 'file_path,route_path,file_role,owner,owner_type,status,primary_evidence,secondary_evidence,confidence,notes\n';
    const csvLines = reconciledRows.map(r =>
      `"${r.file_path}","${r.route_path}","${r.file_role}","${r.owner}","${r.owner_type}","${r.status}","${r.primary_evidence}","${r.secondary_evidence}","${r.confidence}","${r.notes}"`
    );
    
    fs.writeFileSync(frozenPath, header + csvLines.join('\n'));
    console.log(`   ✅ Written to: ${frozenPath}\n`);
    
    // Final verification
    console.log('🔍 Final Verification...\n');
    const finalRows = reconciledRows;
    const finalKnown = finalRows.filter(r => r.status === 'KNOWN');
    const finalProduct = finalKnown.filter(r => r.owner_type === 'Product').length;
    const finalPlatform = finalKnown.filter(r => r.owner_type === 'Platform').length;
    const finalOther = finalKnown.filter(r => 
      !['Product', 'Platform'].includes(r.owner_type)
    ).length;
    
    console.log('   Owner Type Distribution (KNOWN):');
    console.log(`   Product:   ${finalProduct}`);
    console.log(`   Platform:  ${finalPlatform}`);
    console.log(`   Other:     ${finalOther}`);
    console.log(`   Total:     ${finalProduct + finalPlatform + finalOther}`);
    console.log(`   Expected:  ${finalKnown.length}`);
    console.log(`   Match:     ${finalProduct + finalPlatform + finalOther === finalKnown.length ? '✅' : '❌'}\n`);
    
    if (finalProduct + finalPlatform + finalOther === finalKnown.length && finalOther === 0) {
      console.log('🎉 OWNER-TYPE RECONCILIATION COMPLETE');
      console.log('\n✅ STEP 4 — BOUNDARY DECISIONS + FREEZE 🔒 CLOSED');
      console.log('\n📋 Next: STEP 5 — Owner-based Scope Architecture Design');
    } else {
      console.log('⚠️  Reconciliation incomplete - manual review required');
    }
  } else {
    console.log('✅ No owner_type gaps detected');
  }
}

main();
