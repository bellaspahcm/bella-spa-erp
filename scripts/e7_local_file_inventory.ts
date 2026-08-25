/**
 * E7: LOCAL FILE INVENTORY
 * 
 * Purpose: Extract exact local migration identities for 16 affected migrations
 * Method: Read filesystem, parse filenames, compute content hash
 * Status: READ-ONLY (no file modifications)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface LocalMigration {
  filename: string;
  version: string;
  name: string;
  format: 'LEGACY_8DIGIT' | 'STANDARD_14DIGIT' | 'OTHER';
  contentHash: string;
  fileSize: number;
  sqlPreview: string;
}

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

const AFFECTED_VERSIONS = [
  '20260820_r4_3_gate_tokens',
  '20260820_r4_4_monitoring_audit',
  '20260820_r4_approval_contract',
  '20260820000000',
  '20260820010000',
  '20260820100000',
  '20260820110000',
  '20260820120000',
  '20260820130000',
  '20260820140000',
  '20260821_create_accessorial_rates_table',
  '20260821_create_carrier_rates_table',
  '20260821_create_discrepancies_table',
  '20260821_create_freight_audit_tables',
  '20260821000000',
  '20260821115404',
];

function parseFilename(filename: string): { version: string; name: string; format: string } {
  const match = filename.match(/^(\d{8}(?:_[a-z0-9_]+)?|\d{14})_(.+)\.sql$/);
  
  if (!match) {
    return { version: 'INVALID', name: '', format: 'OTHER' };
  }

  const version = match[1];
  const name = match[2];
  
  let format: string;
  if (/^\d{8}_[a-z0-9_]+$/.test(version)) {
    format = 'LEGACY_8DIGIT';
  } else if (/^\d{14}$/.test(version)) {
    format = 'STANDARD_14DIGIT';
  } else {
    format = 'OTHER';
  }

  return { version, name, format };
}

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

function inventoryLocalMigrations(): LocalMigration[] {
  const migrations: LocalMigration[] = [];

  for (const version of AFFECTED_VERSIONS) {
    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.startsWith(version));
    
    if (files.length === 0) {
      console.warn(`⚠️  No file found for version: ${version}`);
      continue;
    }

    if (files.length > 1) {
      console.warn(`⚠️  Multiple files found for version: ${version}`, files);
    }

    const filename = files[0];
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const content = fs.readFileSync(filepath, 'utf-8');
    const parsed = parseFilename(filename);

    migrations.push({
      filename,
      version: parsed.version,
      name: parsed.name,
      format: parsed.format as any,
      contentHash: computeHash(content),
      fileSize: content.length,
      sqlPreview: content.substring(0, 200).replace(/\n/g, ' ').trim(),
    });
  }

  return migrations;
}

function generateReport(migrations: LocalMigration[]): void {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('E7.1: LOCAL FILE INVENTORY (16 affected migrations)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('Total files found:', migrations.length);
  console.log('Expected:', AFFECTED_VERSIONS.length);
  console.log('');

  const legacy = migrations.filter(m => m.format === 'LEGACY_8DIGIT');
  const standard = migrations.filter(m => m.format === 'STANDARD_14DIGIT');
  const other = migrations.filter(m => m.format === 'OTHER');

  console.log('Format breakdown:');
  console.log(`  LEGACY_8DIGIT:     ${legacy.length} (expected: 7)`);
  console.log(`  STANDARD_14DIGIT:  ${standard.length} (expected: 9)`);
  console.log(`  OTHER:             ${other.length} (expected: 0)`);
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('E7.2: DETAILED INVENTORY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('Legacy 8-digit migrations (CLI cannot reconcile):');
  console.log('─'.repeat(67));
  legacy.forEach(m => {
    console.log(`Version:  ${m.version}`);
    console.log(`Name:     ${m.name}`);
    console.log(`Hash:     ${m.contentHash}`);
    console.log(`Size:     ${m.fileSize} bytes`);
    console.log(`Preview:  ${m.sqlPreview.substring(0, 80)}...`);
    console.log('─'.repeat(67));
  });

  console.log('\nStandard 14-digit migrations (CLI reconciles correctly):');
  console.log('─'.repeat(67));
  standard.forEach(m => {
    console.log(`Version:  ${m.version}`);
    console.log(`Name:     ${m.name}`);
    console.log(`Hash:     ${m.contentHash}`);
    console.log(`Size:     ${m.fileSize} bytes`);
    console.log(`Preview:  ${m.sqlPreview.substring(0, 80)}...`);
    console.log('─'.repeat(67));
  });

  if (other.length > 0) {
    console.log('\n⚠️  UNEXPECTED FORMAT DETECTED:');
    console.log('─'.repeat(67));
    other.forEach(m => {
      console.log(`Filename: ${m.filename}`);
      console.log(`Version:  ${m.version}`);
      console.log(`Format:   ${m.format}`);
      console.log('─'.repeat(67));
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('E7.3: IDENTITY MATRIX (for comparison with remote)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.table(migrations.map(m => ({
    Version: m.version,
    Format: m.format,
    Name: m.name.substring(0, 30),
    Hash: m.contentHash,
    Size: m.fileSize,
  })));

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('E7.4: GATE STATUS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const issues: string[] = [];

  if (migrations.length !== AFFECTED_VERSIONS.length) {
    issues.push(`❌ File count mismatch: ${migrations.length} found, ${AFFECTED_VERSIONS.length} expected`);
  }

  if (legacy.length !== 7) {
    issues.push(`❌ Legacy format count: ${legacy.length} found, 7 expected`);
  }

  if (standard.length !== 9) {
    issues.push(`❌ Standard format count: ${standard.length} found, 9 expected`);
  }

  if (other.length > 0) {
    issues.push(`❌ Unexpected format detected: ${other.length} files`);
  }

  if (issues.length === 0) {
    console.log('✅ E7 LOCAL INVENTORY: PASS');
    console.log('');
    console.log('All 16 local migration files verified:');
    console.log('  - 7 legacy 8-digit format (CLI limitation)');
    console.log('  - 9 standard 14-digit format (CLI reconciles)');
    console.log('  - 0 unexpected formats');
    console.log('');
    console.log('Next: Execute e7_canonical_identity_audit.sql via Dashboard');
    console.log('      to compare local inventory with remote provenance.');
  } else {
    console.log('🔴 E7 LOCAL INVENTORY: BLOCKED');
    console.log('');
    issues.forEach(issue => console.log(issue));
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

// Execute
try {
  const migrations = inventoryLocalMigrations();
  generateReport(migrations);
} catch (error) {
  console.error('❌ E7 execution failed:', error);
  process.exit(1);
}
