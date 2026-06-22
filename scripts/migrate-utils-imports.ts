/**
 * Migrate utils imports from @/lib/utils to @bella/shared
 * ONLY migrate format functions, keep cn() in @/lib/utils
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const FORMAT_FUNCTIONS = [
  'formatCurrency',
  'parseMoneyInput',
  'getLocalDateString',
  'formatMoneyInput',
  'resolvePackageName',
  'sanitizeTime',
];

async function migrateFile(filePath: string): Promise<boolean> {
  const content = readFileSync(filePath, 'utf-8');
  
  // Find import from @/lib/utils
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]@\/lib\/utils['"]/g;
  
  let modified = false;
  let newContent = content;
  
  const matches = Array.from(content.matchAll(importRegex));
  
  for (const match of matches) {
    const [fullImport, imports] = match;
    const importList = imports.split(',').map(i => i.trim());
    
    const formatImports: string[] = [];
    const utilImports: string[] = [];
    
    for (const imp of importList) {
      const funcName = imp.replace(/\s*as\s+\w+/, '').trim();
      if (FORMAT_FUNCTIONS.includes(funcName)) {
        formatImports.push(imp);
      } else {
        utilImports.push(imp);
      }
    }
    
    if (formatImports.length === 0) {
      // No format functions, skip
      continue;
    }
    
    // Build new imports
    let replacement = '';
    
    if (formatImports.length > 0) {
      replacement += `import { ${formatImports.join(', ')} } from '@bella/shared';\n`;
    }
    
    if (utilImports.length > 0) {
      replacement += `import { ${utilImports.join(', ')} } from '@/lib/utils';`;
    } else {
      // Remove trailing newline if no util imports
      replacement = replacement.trimEnd();
    }
    
    newContent = newContent.replace(fullImport, replacement);
    modified = true;
  }
  
  if (modified) {
    writeFileSync(filePath, newContent, 'utf-8');
    console.log(`✓ ${filePath}`);
    return true;
  }
  
  return false;
}

async function main() {
  const files = await glob('src/**/*.{ts,tsx}', {
    ignore: ['**/*.test.ts', '**/*.test.tsx', 'node_modules/**'],
  });
  
  let count = 0;
  for (const file of files) {
    if (await migrateFile(file)) {
      count++;
    }
  }
  
  console.log(`\n✅ Migrated ${count} files`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
