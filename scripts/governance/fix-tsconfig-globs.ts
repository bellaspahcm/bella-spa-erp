#!/usr/bin/env tsx
/**
 * Fix tsconfig.compile-*.json glob patterns
 * TypeScript doesn't support {ts,tsx} syntax, need separate patterns
 */

import * as fs from 'fs';
import * as glob from 'glob';

const configs = glob.sync('tsconfig.compile-*.json');

for (const configPath of configs) {
  const content = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(content);
  
  if (config.include) {
    config.include = config.include.flatMap((pattern: string) => {
      if (pattern.includes('.{ts,tsx}')) {
        return [
          pattern.replace('.{ts,tsx}', '.ts'),
          pattern.replace('.{ts,tsx}', '.tsx'),
        ];
      }
      return pattern;
    });
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log(`✅ Fixed: ${configPath}`);
  }
}

console.log(`\nFixed ${configs.length} tsconfig files`);
