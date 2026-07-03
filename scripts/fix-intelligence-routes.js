#!/usr/bin/env node
/**
 * Batch Fix Intelligence API Routes
 * 
 * Auto-applies tenantId session fetch pattern to all remaining Intelligence routes.
 * 
 * Changes:
 * 1. Add import: getTenantIdFromSessionOrParam
 * 2. Replace tenantId validation block with helper call
 * 3. Remove unused isValidTenantId import (if no other usage)
 * 
 * Usage: node scripts/fix-intelligence-routes.js
 */

const fs = require('fs');
const path = require('path');

// Route directories to fix
const ROUTE_DIRS = [
  'src/app/api/intelligence/finance',
  'src/app/api/intelligence/operational',
  'src/app/api/intelligence/marketing',
];

// Helper import to add
const HELPER_IMPORT = "import { getTenantIdFromSessionOrParam } from '../../shared/get-tenant-id';";

// Pattern to find and replace
const OLD_PATTERN_REGEX = /const tenantId = searchParams\.get\('tenantId'\);[\s\S]*?if \(!isValidTenantId\(tenantId\)\) \{[\s\S]*?\}/m;

const NEW_PATTERN = `    // Get tenant ID from session or query param
    const tenantIdResult = await getTenantIdFromSessionOrParam(searchParams);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult; // Return error response
    }
    const { tenantId } = tenantIdResult;`;

/**
 * Find all route.ts files in a directory
 */
function findRouteFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.name === 'route.ts') {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

/**
 * Check if file needs helper import
 */
function needsHelperImport(content) {
  return !content.includes('getTenantIdFromSessionOrParam');
}

/**
 * Add helper import to file
 */
function addHelperImport(content) {
  // Find last import statement
  const importLines = content.split('\n').filter(line => line.trim().startsWith('import '));
  
  if (importLines.length === 0) {
    // No imports, add at top
    return `${HELPER_IMPORT}\n\n${content}`;
  }
  
  // Find position after last import
  const lastImportLine = importLines[importLines.length - 1];
  const lastImportIndex = content.indexOf(lastImportLine) + lastImportLine.length;
  
  return content.slice(0, lastImportIndex) + '\n' + HELPER_IMPORT + content.slice(lastImportIndex);
}

/**
 * Remove unused isValidTenantId import if no other usage
 */
function removeUnusedImport(content) {
  // Check if isValidTenantId is used elsewhere
  const usageCount = (content.match(/isValidTenantId/g) || []).length;
  
  // If only used in import statement (1 occurrence), remove it
  if (usageCount === 1) {
    // Remove entire import line
    content = content.replace(/import \{ isValidTenantId \} from '@\/services\/intelligence\/shared\/helpers';\n?/g, '');
  }
  
  return content;
}

/**
 * Replace tenantId validation block
 */
function replaceTenantIdValidation(content) {
  // More precise pattern matching the exact validation block structure
  const patterns = [
    // Pattern 1: Standard with isValidTenantId check
    {
      regex: /const tenantId = searchParams\.get\('tenantId'\);\s*\/\/ Validate required params\s*if \(!tenantId\) \{\s*return NextResponse\.json\(\s*\{ error: 'Missing required parameter: tenantId' \},\s*\{ status: 400 \}\s*\);\s*\}\s*if \(!isValidTenantId\(tenantId\)\) \{\s*return NextResponse\.json\(\s*\{ error: 'Invalid tenantId format \(must be UUID v4\)' \},\s*\{ status: 400 \}\s*\);\s*\}/gs,
      replacement: `// Get tenant ID from session or query param
    const tenantIdResult = await getTenantIdFromSessionOrParam(searchParams);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult; // Return error response
    }
    const { tenantId } = tenantIdResult;`
    },
    // Pattern 2: Simpler without comment
    {
      regex: /const tenantId = searchParams\.get\('tenantId'\);\s*if \(!tenantId\) \{\s*return NextResponse\.json\(\s*\{ error: 'Missing required parameter: tenantId' \},\s*\{ status: 400 \}\s*\);\s*\}\s*if \(!isValidTenantId\(tenantId\)\) \{\s*return NextResponse\.json\(\s*\{ error: 'Invalid tenantId format \(must be UUID v4\)' \},\s*\{ status: 400 \}\s*\);\s*\}/gs,
      replacement: `// Get tenant ID from session or query param
    const tenantIdResult = await getTenantIdFromSessionOrParam(searchParams);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult; // Return error response
    }
    const { tenantId } = tenantIdResult;`
    }
  ];
  
  for (const { regex, replacement } of patterns) {
    if (regex.test(content)) {
      return { content: content.replace(regex, replacement), changed: true };
    }
  }
  
  return { content, changed: false };
}

/**
 * Process a single route file
 */
function processFile(filePath) {
  console.log(`Processing: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Step 1: Add helper import if needed
  if (needsHelperImport(content)) {
    content = addHelperImport(content);
    changed = true;
    console.log('  ✓ Added helper import');
  }
  
  // Step 2: Replace validation block
  const { content: newContent, changed: validationChanged } = replaceTenantIdValidation(content);
  content = newContent;
  if (validationChanged) {
    changed = true;
    console.log('  ✓ Replaced validation block');
  }
  
  // Step 3: Remove unused import
  const oldContent = content;
  content = removeUnusedImport(content);
  if (content !== oldContent) {
    changed = true;
    console.log('  ✓ Removed unused import');
  }
  
  // Write back if changed
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('  ✅ File updated\n');
    return true;
  } else {
    console.log('  ⏭️  No changes needed\n');
    return false;
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🔧 Batch Fix Intelligence API Routes\n');
  console.log('Scanning directories...\n');
  
  let totalFiles = 0;
  let updatedFiles = 0;
  
  for (const dir of ROUTE_DIRS) {
    const fullPath = path.join(process.cwd(), dir);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Directory not found: ${dir}\n`);
      continue;
    }
    
    const files = findRouteFiles(fullPath);
    console.log(`Found ${files.length} route files in ${dir}\n`);
    
    for (const file of files) {
      totalFiles++;
      const updated = processFile(file);
      if (updated) updatedFiles++;
    }
  }
  
  console.log('═══════════════════════════════════════');
  console.log(`✅ Complete!`);
  console.log(`   Total files scanned: ${totalFiles}`);
  console.log(`   Files updated: ${updatedFiles}`);
  console.log(`   Files unchanged: ${totalFiles - updatedFiles}`);
  console.log('═══════════════════════════════════════\n');
  
  if (updatedFiles > 0) {
    console.log('Next steps:');
    console.log('1. npm run build');
    console.log('2. git add -A && git commit -m "fix: batch apply tenantId auto-fetch to remaining routes"');
    console.log('3. git push\n');
  }
}

// Run
main();
