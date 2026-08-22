#!/usr/bin/env node

/**
 * E7.1 Frozen Boundary Enforcement
 * 
 * Prevents unauthorized modification of frozen E7.1 artifacts.
 * 
 * Usage: Called by PreToolUse hook
 * Input: JSON on stdin with tool call details
 * Output: exit 0 (allow) or exit 2 (block)
 */

const fs = require('fs');
const path = require('path');

// Read frozen manifest
const manifestPath = path.join(process.cwd(), 'E7_1_FROZEN_MANIFEST.json');

if (!fs.existsSync(manifestPath)) {
  console.error('ERROR: E7_1_FROZEN_MANIFEST.json not found');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Read tool call from stdin
let inputData = '';
process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const toolCall = JSON.parse(inputData);
    
    // Extract file path being modified
    let targetPath = null;
    
    if (toolCall.tool === 'str_replace' || toolCall.tool === 'fs_write' || toolCall.tool === 'fs_append') {
      targetPath = toolCall.parameters?.path;
    }
    
    if (!targetPath) {
      // No file path, allow
      process.exit(0);
    }
    
    // Normalize path (handle both absolute and relative)
    const normalizedPath = targetPath.replace(/\\/g, '/').replace(/^.*\/BELLA SPA ERP\//, '');
    
    // Check if path matches any frozen artifact
    const allFrozenPaths = [
      ...manifest.frozenArtifacts.domain,
      ...manifest.frozenArtifacts.types,
      ...manifest.frozenArtifacts.contracts,
      ...manifest.frozenArtifacts.schema,
      ...manifest.frozenArtifacts.repository,
      ...manifest.frozenArtifacts.migrations,
      ...manifest.frozenArtifacts.tests
    ];
    
    const isFrozen = allFrozenPaths.some(frozenPath => {
      const normalized = frozenPath.replace(/\\/g, '/');
      return normalizedPath === normalized || normalizedPath.endsWith(normalized);
    });
    
    if (isFrozen) {
      // BLOCK: Frozen artifact modification attempt
      const errorMessage = `
❌ FROZEN BOUNDARY VIOLATION

File: ${targetPath}
Status: FROZEN (E7.1 Domain Kernel, locked ${manifest.frozenDate})

This artifact is part of the frozen E7.1 baseline and cannot be modified directly.

If you need to make changes:
1. Create an Architecture Change Request (ACR)
2. Document rationale and impact analysis
3. Obtain architecture review approval
4. Follow the change process in E7_1_FROZEN_MANIFEST.json

Frozen artifacts: ${allFrozenPaths.length} files
Frozen contracts: ${Object.keys(manifest.frozenContracts).length} domain classes
Frozen invariants: ${manifest.frozenInvariants.length} invariants

For details: E7_1_FROZEN_MANIFEST.json
      `.trim();
      
      console.error(errorMessage);
      
      // Output hook-specific decision
      const hookOutput = {
        hookSpecificOutput: {
          permissionDecision: 'deny',
          permissionDecisionReason: `Frozen E7.1 artifact: ${normalizedPath}`
        }
      };
      
      console.log(JSON.stringify(hookOutput));
      
      // Exit 2 = block the action
      process.exit(2);
    }
    
    // Not frozen, allow
    process.exit(0);
    
  } catch (error) {
    console.error('ERROR parsing tool call:', error.message);
    // On error, allow (fail open to avoid blocking legitimate work)
    process.exit(0);
  }
});
