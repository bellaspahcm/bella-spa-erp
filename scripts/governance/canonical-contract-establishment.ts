#!/usr/bin/env tsx
/**
 * Canonical Contract Establishment
 * 
 * Purpose: Establish database.types.ts from canonical schema for fresh Industry OS
 * 
 * Approach: Leverage Supabase's canonical type generation mechanism
 * 
 * Lifecycle:
 *   1. Ensure local Supabase running
 *   2. Deploy canonical migrations
 *   3. Generate types via Supabase CLI
 *   4. Verify types contain industry entities
 * 
 * Phase 3.5: Unblock Factory autonomous fresh Industry OS construction
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export interface ContractEstablishmentResult {
  status: 'SUCCESS' | 'NO_MIGRATIONS' | 'SUPABASE_ERROR' | 'GENERATION_FAILED' | 'VALIDATION_FAILED';
  reason?: string;
  typesPath?: string;
  entitiesFound?: string[];
  recovery?: string;
}

export interface ContractEstablishmentOptions {
  industryScope: string;
  migrationsPath?: string;
  typesOutputPath?: string;
  skipDeployment?: boolean; // For testing with already-deployed schema
}

/**
 * Establish canonical contract for fresh Industry OS
 */
export async function establishCanonicalContract(
  options: ContractEstablishmentOptions
): Promise<ContractEstablishmentResult> {
  const {
    industryScope,
    migrationsPath = 'supabase/migrations',
    typesOutputPath = 'src/types/database.types.ts',
    skipDeployment = false,
  } = options;

  console.log(`\n🏭 Canonical Contract Establishment: ${industryScope}`);

  // Step 1: Verify migrations exist
  const migrations = discoverIndustryMigrations(industryScope, migrationsPath);

  if (migrations.length === 0) {
    return {
      status: 'NO_MIGRATIONS',
      reason: `No migrations found for industry '${industryScope}' in ${migrationsPath}`,
      recovery: 'Create canonical schema migration first',
    };
  }

  console.log(`  ✅ Found ${migrations.length} migration(s) for ${industryScope}`);

  // Step 2: Ensure local Supabase running
  if (!skipDeployment) {
    const supabaseReady = await ensureLocalSupabase();

    if (!supabaseReady.success) {
      return {
        status: 'SUPABASE_ERROR',
        reason: supabaseReady.error,
        recovery: 'Start Supabase: npx supabase start',
      };
    }

    console.log(`  ✅ Local Supabase running`);

    // Step 3: Deploy migrations (reset to ensure clean state)
    const deployResult = await deployMigrationsToLocal();

    if (!deployResult.success) {
      return {
        status: 'SUPABASE_ERROR',
        reason: `Migration deployment failed: ${deployResult.error}`,
        recovery: 'Check migration syntax and Supabase logs',
      };
    }

    console.log(`  ✅ Migrations deployed`);
  }

  // Step 4: Generate types via Supabase CLI
  const generateResult = await generateTypesFromSupabase(typesOutputPath);

  if (!generateResult.success) {
    return {
      status: 'GENERATION_FAILED',
      reason: generateResult.error,
      recovery: 'Verify Supabase connection and schema validity',
    };
  }

  console.log(`  ✅ Types generated: ${typesOutputPath}`);

  // Step 5: Verify types contain industry entities
  const validation = verifyGeneratedTypes(industryScope, typesOutputPath);

  if (!validation.valid) {
    return {
      status: 'VALIDATION_FAILED',
      reason: validation.reason,
      recovery: 'Check that migrations created tables with expected prefix',
    };
  }

  console.log(`  ✅ Validated ${validation.entities.length} entities: ${validation.entities.join(', ')}`);

  return {
    status: 'SUCCESS',
    typesPath: typesOutputPath,
    entitiesFound: validation.entities,
  };
}

/**
 * Discover migrations for specific industry
 */
function discoverIndustryMigrations(industryScope: string, migrationsPath: string): string[] {
  if (!existsSync(migrationsPath)) {
    return [];
  }

  const allMigrations = readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // Find migrations that mention the industry scope
  const industryLower = industryScope.toLowerCase();

  return allMigrations.filter(migration => {
    const content = readFileSync(join(migrationsPath, migration), 'utf-8').toLowerCase();

    // Migration mentions industry in filename or creates tables with industry prefix
    const mentionsIndustry =
      migration.toLowerCase().includes(industryLower) ||
      content.includes(`${industryLower}_`) ||
      content.includes(`${industryLower} `);

    return mentionsIndustry;
  });
}

/**
 * Ensure local Supabase is running
 */
async function ensureLocalSupabase(): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if Supabase is already running
    execSync('npx supabase status', { stdio: 'pipe', encoding: 'utf-8' });
    return { success: true };
  } catch {
    // Not running, try to start
    console.log('  ⏳ Starting local Supabase...');

    try {
      execSync('npx supabase start', { stdio: 'inherit' });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to start Supabase: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

/**
 * Deploy migrations to local Supabase
 */
async function deployMigrationsToLocal(): Promise<{ success: boolean; error?: string }> {
  try {
    // Reset database to clean state and apply all migrations
    execSync('npx supabase db reset', { stdio: 'pipe', encoding: 'utf-8' });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate types from deployed Supabase schema
 */
async function generateTypesFromSupabase(
  outputPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use Supabase CLI to generate types from local database
    const command = `npx supabase gen types typescript --local > ${outputPath}`;

    execSync(command, { stdio: 'pipe', encoding: 'utf-8', shell: true });

    // Verify file was created and is not empty
    if (!existsSync(outputPath)) {
      return {
        success: false,
        error: `Types file not created at ${outputPath}`,
      };
    }

    const content = readFileSync(outputPath, 'utf-8');
    if (content.trim().length === 0) {
      return {
        success: false,
        error: 'Generated types file is empty',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Verify generated types contain industry entities
 */
function verifyGeneratedTypes(
  industryScope: string,
  typesPath: string
): { valid: boolean; reason?: string; entities: string[] } {
  if (!existsSync(typesPath)) {
    return {
      valid: false,
      reason: `Types file not found: ${typesPath}`,
      entities: [],
    };
  }

  const content = readFileSync(typesPath, 'utf-8');

  // Look for table types matching industry prefix
  const industryLower = industryScope.toLowerCase();
  const tablePattern = new RegExp(`${industryLower}_([a-z_]+):\\s*\\{`, 'g');

  const entities: string[] = [];
  let match;

  while ((match = tablePattern.exec(content)) !== null) {
    entities.push(match[1]);
  }

  if (entities.length === 0) {
    return {
      valid: false,
      reason: `No tables found with prefix '${industryLower}_' in generated types`,
      entities: [],
    };
  }

  return {
    valid: true,
    entities,
  };
}

/**
 * CLI entry point
 */
async function main() {
  const industryScope = process.argv[2];

  if (!industryScope) {
    console.error('Usage: npx tsx scripts/governance/canonical-contract-establishment.ts <industry>');
    console.error('Example: npx tsx scripts/governance/canonical-contract-establishment.ts manufacturing');
    process.exit(1);
  }

  const result = await establishCanonicalContract({ industryScope });

  console.log('\n═══════════════════════════════════════');
  console.log('📋 CONTRACT ESTABLISHMENT RESULT');
  console.log('═══════════════════════════════════════');
  console.log(`Status: ${result.status}`);

  if (result.status === 'SUCCESS') {
    console.log(`✅ Types: ${result.typesPath}`);
    console.log(`✅ Entities: ${result.entitiesFound?.join(', ')}`);
    console.log('\n✅ Canonical contract established');
  } else {
    console.log(`❌ Reason: ${result.reason}`);
    console.log(`💡 Recovery: ${result.recovery}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
