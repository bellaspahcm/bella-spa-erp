#!/usr/bin/env node
/**
 * PRE-TOOL ARCHITECTURE GUARD
 * 
 * Called by Kiro PreToolUse hook to block modifications to frozen artifacts.
 * Receives JSON context on stdin, returns exit code:
 *   0 = Allow (stdout may contain permission decision)
 *   2 = Block (stderr contains reason)
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// FROZEN ARTIFACTS
// ============================================================================

const FROZEN_PATHS = [
  // E7.1 Domain Kernel
  'src/platform/logistics/domain/inventory.types.ts',
  'src/platform/logistics/domain/inventory.domain.ts',
  'src/platform/logistics/domain/movement.types.ts',
  'src/platform/logistics/domain/movement.domain.ts',
  'src/platform/logistics/domain/traceability.types.ts',
  'src/platform/logistics/domain/traceability.domain.ts',
  'src/platform/logistics/domain/item.types.ts',
  'src/platform/logistics/domain/item.domain.ts',
  'src/platform/logistics/domain/location.types.ts',
  'src/platform/logistics/domain/location.domain.ts',
  'src/platform/logistics/domain/uom.types.ts',
  'src/platform/logistics/domain/uom.domain.ts',
  
  // E7.2 Operational Kernel
  'src/platform/logistics/domain/inventory-operations.domain.ts',
  
  // E7.3 Rules & Traceability
  'src/platform/logistics/domain/rules/rule.types.ts',
  'src/platform/logistics/domain/rules/rule.helpers.ts',
  'src/platform/logistics/domain/rules/expiry.rule.ts',
  'src/platform/logistics/domain/rules/quantity.rule.ts',
  'src/platform/logistics/domain/rules/traceability.rule.ts',
  'src/platform/logistics/domain/rules/traceability.operations.ts',
  'src/platform/logistics/domain/rules/compliance.evaluation.ts',
  'src/platform/logistics/domain/rules/rule.composition.ts',
  'src/platform/logistics/domain/rules/index.ts',
  
  // Architecture Guard Scripts (Self-Protection)
  'scripts/architecture/git-pre-commit-guard.js',
  'scripts/architecture/ci-frozen-check.js',
  'scripts/architecture/ci-guard-integrity.js',
  'scripts/architecture/ci-dependency-check.js',
  '.github/workflows/architecture-gate.yml',
];

const LAYER_MAP = {
  'src/platform/logistics/domain/inventory': 'E7.1 Domain Kernel',
  'src/platform/logistics/domain/movement': 'E7.1 Domain Kernel',
  'src/platform/logistics/domain/traceability': 'E7.1 Domain Kernel',
  'src/platform/logistics/domain/item': 'E7.1 Domain Kernel',
  'src/platform/logistics/domain/location': 'E7.1 Domain Kernel',
  'src/platform/logistics/domain/uom': 'E7.1 Domain Kernel',
  'src/platform/logistics/domain/inventory-operations': 'E7.2 Operational Kernel',
  'src/platform/logistics/domain/core': 'E7.2 Operational Kernel',
  'src/platform/logistics/domain/rules': 'E7.3 Rules & Traceability',
};

// ============================================================================
// UTILITIES
// ============================================================================

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function getLayerForFile(filePath) {
  const normalized = normalizePath(filePath);
  for (const [prefix, layer] of Object.entries(LAYER_MAP)) {
    if (normalized.includes(prefix)) {
      return layer;
    }
  }
  return 'Unknown';
}

function isFrozenFile(filePath) {
  const normalized = normalizePath(filePath);
  return FROZEN_PATHS.some(frozenPath => normalized.endsWith(frozenPath));
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    // Read stdin context from Kiro
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const input = Buffer.concat(chunks).toString('utf8');
    
    let context;
    try {
      context = JSON.parse(input);
    } catch (e) {
      // If no valid JSON, allow operation
      process.exit(0);
    }

    // Extract target file path from tool parameters
    let targetPath = null;
    
    if (context.toolInput) {
      targetPath = context.toolInput.path || context.toolInput.targetFile;
    }

    if (!targetPath) {
      // No path detected, allow
      process.exit(0);
    }

    // Check if target is a frozen file
    if (isFrozenFile(targetPath)) {
      const layer = getLayerForFile(targetPath);
      
      const errorMessage = `
╔════════════════════════════════════════════════════════════════╗
║  🔒 FROZEN BOUNDARY VIOLATION BLOCKED                         ║
╚════════════════════════════════════════════════════════════════╝

Layer:    ${layer}
Artifact: ${targetPath}
Status:   SEALED
Tool:     ${context.toolName || 'unknown'}

❌ This file is part of a FROZEN kernel layer and cannot be modified.

Required steps to modify frozen artifacts:
  1. Create Architecture Change Request (ACR)
  2. Submit for Human Architect Review
  3. Document Architecture Decision Record (ADR)
  4. Unlock layer (update ARCHITECTURE_FREEZE_MANIFEST.json)
  5. Implement changes
  6. Run full regression (547/547 must PASS)
  7. Update baseline hash
  8. Re-seal layer

Frozen layers:
  • E7.1 Domain Kernel (12 artifacts)
  • E7.2 Operational Kernel (1 artifact)
  • E7.3 Rules & Traceability (9 artifacts)
  • Architecture Guard (5 enforcement scripts)

For questions, refer to: docs/architecture/FREEZE_POLICY.md
`;

      process.stderr.write(errorMessage);
      process.exit(2); // Block the tool invocation
    }

    // Not a frozen file, allow
    process.exit(0);

  } catch (error) {
    // On error, fail safe: allow the operation
    console.error('Error in pre-tool-guard:', error.message);
    process.exit(0);
  }
}

main();
