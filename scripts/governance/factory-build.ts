#!/usr/bin/env tsx
/**
 * Factory Build Command
 * 
 * Phase 3.5: Canonical Contract Establishment Integration
 * 
 * Usage: npx tsx scripts/governance/factory-build.ts <industry>
 * Example: npx tsx scripts/governance/factory-build.ts manufacturing
 * 
 * Pipeline:
 * 1. Canonical Contract Establishment (Phase 3.5) - NEW
 * 2. Evidence Collection (E9.1)
 * 3. Scope Derivation (E9)
 * 4. Construction Context Assembly (Phase 2)
 * 5. Output context for AI agent consumption
 */

import { establishCanonicalContract } from './canonical-contract-establishment';
import { collectIndustryEvidence } from './evidence-collector';
import { deriveCanonicalScope, type ScopeDerivationResult, type CanonicalEvidence } from './canonical-scope-derivation';
import { assembleConstructionContext, generateContextDocument, type ConstructionContext } from './construction-context-assembly';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface FactoryBuildResult {
  industry: string;
  contractEstablished: boolean;
  totalEntities: number;
  decisions: {
    CONFORM: number;
    RECONSTRUCT: number;
    DEFER: number;
    BLOCK: number;
  };
  contextsGenerated: number;
  outputPath: string;
}

async function main() {
  const industry = process.argv[2];
  const skipContract = process.argv.includes('--skip-contract'); // For testing with existing types

  if (!industry) {
    console.error('Usage: npx tsx scripts/governance/factory-build.ts <industry> [--skip-contract]');
    console.error('Example: npx tsx scripts/governance/factory-build.ts manufacturing');
    process.exit(1);
  }

  console.log('🏭 BELLA INDUSTRY OS FACTORY');
  console.log(`Industry: ${industry}\n`);

  const result: FactoryBuildResult = {
    industry,
    contractEstablished: false,
    totalEntities: 0,
    decisions: {
      CONFORM: 0,
      RECONSTRUCT: 0,
      DEFER: 0,
      BLOCK: 0,
    },
    contextsGenerated: 0,
    outputPath: '',
  };

  try {
    // Step 1: Canonical Contract Establishment (Phase 3.5)
    if (!skipContract) {
      console.log('[1/4] Canonical Contract Establishment (Phase 3.5)...');

      const contractResult = await establishCanonicalContract({
        industryScope: industry,
        migrationsPath: 'supabase/migrations',
        typesOutputPath: 'src/types/database.types.ts',
      });

      if (contractResult.status !== 'SUCCESS') {
        console.error(`\n❌ Contract establishment failed: ${contractResult.reason}`);
        console.error(`💡 Recovery: ${contractResult.recovery}`);
        process.exit(1);
      }

      result.contractEstablished = true;
      console.log(`  ✅ Contract established: ${contractResult.entitiesFound?.length} entities\n`);
    }

    // Step 2: Evidence Collection
    console.log(`[${skipContract ? '1' : '2'}/4] Evidence Collection (E9.1)...`);
    const evidenceMap = await collectIndustryEvidence(industry, {
      migrationsPath: 'supabase/migrations',
      generatedTypesPath: 'src/types/database.types.ts',
      domainBasePath: `src/platform/${industry}`,
      testBasePath: `tests/platform/${industry}`,
    });

    result.totalEntities = evidenceMap.size;
    console.log(`  ✅ Discovered ${evidenceMap.size} entities\n`);

    // Step 3: Scope Derivation
    console.log(`[${skipContract ? '2' : '3'}/4] Scope Derivation (E9)...`);
    const scopeResults = new Map<string, ScopeDerivationResult>();

    for (const [entityName, evidence] of evidenceMap.entries()) {
      const decision = deriveCanonicalScope(evidence);
      scopeResults.set(entityName, decision);

      result.decisions[decision.decision]++;
    }

    console.log(`  CONFORM: ${result.decisions.CONFORM}`);
    console.log(`  RECONSTRUCT: ${result.decisions.RECONSTRUCT}`);
    console.log(`  DEFER: ${result.decisions.DEFER}`);
    console.log(`  BLOCK: ${result.decisions.BLOCK}\n`);

    // Step 4: Construction Context Assembly
    console.log(`[${skipContract ? '3' : '4'}/4] Construction Context Assembly (Phase 2)...`);

    const contexts = new Map<string, ConstructionContext>();

    for (const [entityName, scopeResult] of scopeResults.entries()) {
      const context = assembleConstructionContext(entityName, scopeResult, industry, {
        migrationsPath: 'supabase/migrations',
        domainBasePath: `src/platform/${industry}`,
        testBasePath: `tests/platform/${industry}`,
      });

      if (context) {
        contexts.set(entityName, context);
      }
    }

    result.contextsGenerated = contexts.size;
    console.log(`  ✅ Generated ${contexts.size} construction contexts\n`);

    // Output contexts
    const outputDir = `.factory/contexts/${industry}`;
    mkdirSync(outputDir, { recursive: true });

    for (const [entityName, context] of contexts.entries()) {
      const doc = generateContextDocument(context);
      const filename = entityName.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      const outputPath = join(outputDir, `${filename}.md`);

      writeFileSync(outputPath, doc, 'utf-8');
    }

    result.outputPath = outputDir;

    // Summary
    console.log('═══════════════════════════════════════');
    console.log('📊 FACTORY BUILD SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Industry: ${result.industry}`);
    console.log(`Contract Established: ${result.contractEstablished ? 'YES' : 'NO (--skip-contract)'}`);
    console.log(`Total Entities: ${result.totalEntities}`);
    console.log('');
    console.log('Scope Decisions:');
    console.log(`  ✅ CONFORM: ${result.decisions.CONFORM}`);
    console.log(`  🔨 RECONSTRUCT: ${result.decisions.RECONSTRUCT}`);
    console.log(`  ⏸️  DEFER: ${result.decisions.DEFER}`);
    console.log(`  🚫 BLOCK: ${result.decisions.BLOCK}`);
    console.log('');
    console.log(`Construction Contexts: ${result.contextsGenerated}`);
    console.log(`Output: ${result.outputPath}/`);
    console.log('');

    // Recommendations
    if (result.decisions.BLOCK > 0) {
      console.log('⚠️  BLOCKED entities detected');
      console.log('   Resolve governance issues before construction');
    } else if (result.decisions.RECONSTRUCT > 0) {
      console.log('✅ Construction contexts ready');
      console.log(`   Review contexts in ${result.outputPath}/`);
      console.log('   Provide contexts to AI coding agent for autonomous construction');
    } else if (result.decisions.CONFORM === result.totalEntities) {
      console.log('✅ All entities CONFORM');
      console.log('   Implementation complete');
    } else {
      console.log('ℹ️  No RECONSTRUCT entities detected');
      console.log('   No construction required');
    }

    console.log('');
    console.log('Next: Provide construction contexts to AI agent');
    console.log(`      Agent should read contexts and implement autonomously`);

  } catch (error) {
    console.error('\n❌ Factory Build Failed');
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);
