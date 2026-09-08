#!/usr/bin/env tsx
/**
 * TG-2.2A — Healthcare Ownership Decomposition
 * 
 * Purpose: Analyze src/services/healthcare/** files and classify by
 * Product ownership (Hospital / Medical Clinic / Dental / Shared Healthcare)
 * 
 * This is NOT automated classification — provides evidence for human decision.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

interface FileAnalysis {
  file: string;
  content: string;
  imports: string[];
  exports: string[];
  keywords: string[];
  suggestedOwner: 'Hospital' | 'Medical Clinic' | 'Dental' | 'Shared Healthcare' | 'Unknown';
  confidence: 'High' | 'Medium' | 'Low';
  reasoning: string[];
}

/**
 * Keyword patterns for ownership classification
 */
const OWNERSHIP_PATTERNS = {
  Hospital: [
    /\binpatient\b/i,
    /\badmission\b/i,
    /\b(icu|intensive.care)\b/i,
    /\bemergency\b/i,
    /\bbed\b/i,
    /\bward\b/i,
    /\bor\b.*\b(operating|room|surgery)\b/i,
    /\bpacu\b/i,
    /\bcssd\b/i,
    /\bblood.bank\b/i,
    /\bventilator\b/i,
    /\bcritical\b/i,
    /\btriage\b/i,
  ],
  'Medical Clinic': [
    /\boutpatient\b/i,
    /\bappointment\b/i,
    /\bqueue\b/i,
    /\bwaitlist\b/i,
    /\bclinic\b/i,
    /\bconsultation\b/i,
    /\bfollow.up\b/i,
  ],
  Dental: [
    /\bdental\b/i,
    /\bodontogram\b/i,
    /\btooth\b/i,
    /\borthodontic\b/i,
    /\bendodontic\b/i,
    /\bperiodontic\b/i,
    /\bprosthetic\b/i,
    /\bimplant\b/i,
  ],
  'Shared Healthcare': [
    /\bpatient\b/i,
    /\bencounter\b/i,
    /\border\b/i,
    /\blaboratory\b/i,
    /\bpharmacy\b/i,
    /\bradiology\b/i,
    /\bimaging\b/i,
    /\bbhyt\b/i,
    /\binsurance\b/i,
    /\bbilling\b/i,
    /\bmedical.record\b/i,
    /\bmpi\b/i,
    /\bidentity\b/i,
    /\bvital.sign\b/i,
    /\ballergy\b/i,
    /\bmedication\b/i,
  ],
};

/**
 * Analyze file for ownership classification
 */
function analyzeFile(filePath: string): FileAnalysis {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(process.cwd(), filePath);
  
  // Extract imports
  const importMatches = content.matchAll(/import.*from\s+['"]([^'"]+)['"]/g);
  const imports = Array.from(importMatches).map(m => m[1]);
  
  // Extract exports
  const exportMatches = content.matchAll(/export\s+(const|function|class|interface|type)\s+(\w+)/g);
  const exports = Array.from(exportMatches).map(m => m[2]);
  
  // Classify by keywords
  const keywords: string[] = [];
  let maxScore = 0;
  let suggestedOwner: FileAnalysis['suggestedOwner'] = 'Unknown';
  let reasoning: string[] = [];
  
  for (const [owner, patterns] of Object.entries(OWNERSHIP_PATTERNS)) {
    let score = 0;
    const matches: string[] = [];
    
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        score++;
        matches.push(pattern.source);
      }
    }
    
    if (score > maxScore) {
      maxScore = score;
      suggestedOwner = owner as FileAnalysis['suggestedOwner'];
      reasoning = matches.map(m => `Matched pattern: ${m}`);
    }
  }
  
  // Confidence based on match count
  let confidence: FileAnalysis['confidence'];
  if (maxScore >= 3) {
    confidence = 'High';
  } else if (maxScore >= 1) {
    confidence = 'Medium';
  } else {
    confidence = 'Low';
    reasoning.push('No strong ownership indicators found');
  }
  
  return {
    file: relativePath,
    content,
    imports,
    exports,
    keywords,
    suggestedOwner,
    confidence,
    reasoning,
  };
}

/**
 * Generate decomposition report
 */
function generateReport(analyses: FileAnalysis[]): string {
  const byOwner = new Map<string, FileAnalysis[]>();
  
  for (const analysis of analyses) {
    const owner = analysis.suggestedOwner;
    if (!byOwner.has(owner)) {
      byOwner.set(owner, []);
    }
    byOwner.get(owner)!.push(analysis);
  }
  
  let report = `
╔═══════════════════════════════════════════════════════════════════════════╗
║          TG-2.2A — HEALTHCARE OWNERSHIP DECOMPOSITION ANALYSIS            ║
╚═══════════════════════════════════════════════════════════════════════════╝

CONTEXT:
  Healthcare is an Industry OS with 3 Products:
    - Hospital
    - Medical Clinic
    - Dental
  
  src/services/healthcare/** must be decomposed by Product ownership
  before creating governed scopes.

PURPOSE:
  Provide evidence for human architectural decision.
  This is NOT automated classification.

PRINCIPLE:
  Do not create unified healthcare-services scope just for coverage.
  Classify by actual Product/capability ownership.

───────────────────────────────────────────────────────────────────────────

OWNERSHIP ANALYSIS

Total files analyzed: ${analyses.length}

`;

  const sortedOwners = ['Hospital', 'Medical Clinic', 'Dental', 'Shared Healthcare', 'Unknown'];
  
  for (const owner of sortedOwners) {
    const files = byOwner.get(owner) || [];
    if (files.length === 0) continue;
    
    const highConfidence = files.filter(f => f.confidence === 'High').length;
    const mediumConfidence = files.filter(f => f.confidence === 'Medium').length;
    const lowConfidence = files.filter(f => f.confidence === 'Low').length;
    
    report += `\n${owner.toUpperCase()}\n`;
    report += `${'─'.repeat(80)}\n`;
    report += `Files: ${files.length}\n`;
    report += `Confidence: High (${highConfidence}), Medium (${mediumConfidence}), Low (${lowConfidence})\n\n`;
    
    // Show up to 15 files per owner with confidence
    const samplesToShow = files.slice(0, 15);
    for (const file of samplesToShow) {
      const confidenceMarker = file.confidence === 'High' ? '✅' : file.confidence === 'Medium' ? '⚠️' : '❓';
      report += `  ${confidenceMarker} ${file.file}\n`;
      if (file.reasoning.length > 0 && file.confidence !== 'Low') {
        report += `     Reasoning: ${file.reasoning[0]}\n`;
      }
    }
    
    if (files.length > 15) {
      report += `  ... and ${files.length - 15} more files\n`;
    }
    report += '\n';
  }

  report += `
───────────────────────────────────────────────────────────────────────────

RECOMMENDED SCOPE ARCHITECTURE

Based on analysis, consider this governed scope structure:

1. Hospital Product Scope
   Files: ${(byOwner.get('Hospital') || []).length}
   Coverage: Hospital-owned capabilities (inpatient, ICU, emergency, surgical)

2. Medical Clinic Product Scope  
   Files: ${(byOwner.get('Medical Clinic') || []).length}
   Coverage: Clinic-owned capabilities (outpatient, appointments, queue)

3. Dental Product Scope
   Files: ${(byOwner.get('Dental') || []).length}
   Coverage: Dental-owned capabilities (odontogram, dental procedures)

4. Shared Healthcare Scope
   Files: ${(byOwner.get('Shared Healthcare') || []).length}
   Coverage: Cross-product capabilities (patient identity, billing, pharmacy, lab)

5. Unclassified
   Files: ${(byOwner.get('Unknown') || []).length}
   Action: Manual review required

───────────────────────────────────────────────────────────────────────────

NEXT ACTIONS

1. HUMAN REVIEW
   Review suggested ownership classifications
   Correct misclassifications based on actual architecture
   Decide ownership for "Unknown" files

2. ARCHITECTURAL DECISION
   Confirm scope structure:
     Option A: 4 separate scopes (Hospital, Medical Clinic, Dental, Shared)
     Option B: Different grouping based on actual architecture
     Option C: Hybrid model

3. SCOPE IMPLEMENTATION
   Create/extend governed tsconfigs per decided ownership
   DO NOT create single healthcare-services scope

4. COVERAGE VERIFICATION
   Rerun TG-2 to verify coverage restored
   Ensure each Product has clear governed boundary

───────────────────────────────────────────────────────────────────────────

IMPORTANT NOTES

⚠️  This classification is SUGGESTIVE, not authoritative
    Human architectural judgment required for final decisions

⚠️  Files may have MULTIPLE owners (shared dependencies)
    Document multi-owner rationale clearly

⚠️  "Unknown" files are ARCHITECTURAL ORPHANS
    Require explicit ownership decision before proceeding

⚠️  Do NOT optimize for coverage percentage
    Optimize for ownership clarity and architectural correctness

═══════════════════════════════════════════════════════════════════════════

See: docs/architecture/TG2_2A_SERVICES_OWNERSHIP_DECISION.md
`;

  return report;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 TG-2.2A — Healthcare Ownership Decomposition');
  console.log('');

  try {
    // Find all Healthcare service files
    console.log('📊 Analyzing src/services/healthcare/**...');
    const files = glob.sync('src/services/healthcare/**/*.{ts,tsx}', {
      cwd: process.cwd(),
      absolute: true,
      nodir: true,
      ignore: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
    });
    
    console.log(`   Found ${files.length} Healthcare service files`);
    console.log('');
    
    if (files.length === 0) {
      console.log('⚠️  No Healthcare service files found in src/services/healthcare/');
      console.log('   Verify path exists and contains TypeScript files');
      process.exit(0);
    }
    
    // Analyze each file
    console.log('🔬 Classifying by Product ownership...');
    const analyses = files.map(analyzeFile);
    
    // Generate report
    const report = generateReport(analyses);
    console.log(report);
    
    // Write to file
    const reportPath = path.join(process.cwd(), '.tg2-healthcare-decomposition.txt');
    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`\n📄 Detailed report written to: ${reportPath}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
