#!/usr/bin/env node
/**
 * Factory Rule 4: Explicit Mapper Contract Guard
 * 
 * Gate: G2 (Architecture/Contract Compliance)
 * Status: AUTOMATED
 * 
 * Detects:
 * - Missing required properties in object literals
 * - TS2741: Property 'X' is missing in type 'Y' but required in type 'Z'
 * - Incomplete mapper outputs
 * 
 * Evidence: Dental incident (encounter missing encounter_type, period_start)
 */

import * as ts from 'typescript';
import * as path from 'path';

interface MissingProperty {
  property: string;
  requiredIn: string;
  providedBy: string;
  location: {
    file: string;
    line: number;
    column: number;
  };
}

interface MapperResult {
  passed: boolean;
  missingProperties: MissingProperty[];
  violations: string[];
  summary: string;
}

/**
 * Extract missing property violations from diagnostics
 */
function extractMissingProperties(
  diagnostics: readonly ts.Diagnostic[]
): MissingProperty[] {
  const missingProps: MissingProperty[] = [];

  for (const diagnostic of diagnostics) {
    // TS2741: Property 'X' is missing in type 'Y' but required in type 'Z'
    if (diagnostic.code === 2741 && diagnostic.file) {
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      );

      // Parse property name, provided type, and required type
      const propertyMatch = message.match(/Property '([^']+)' is missing/);
      const providedMatch = message.match(/in type '([^']+)'/);
      const requiredMatch = message.match(/but required in type '([^']+)'/);

      if (propertyMatch && providedMatch && requiredMatch) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
          diagnostic.start!
        );

        missingProps.push({
          property: propertyMatch[1],
          providedBy: providedMatch[1],
          requiredIn: requiredMatch[1],
          location: {
            file: diagnostic.file.fileName,
            line: line + 1,
            column: character + 1,
          },
        });
      }
    }
  }

  return missingProps;
}

/**
 * Validate mapper contract completeness
 */
function validateMapperContract(configPath: string): MapperResult {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  
  if (configFile.error) {
    throw new Error(`Failed to read tsconfig: ${configFile.error.messageText}`);
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath)
  );

  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
  });

  const diagnostics = ts.getPreEmitDiagnostics(program);
  const missingProperties = extractMissingProperties(diagnostics);

  const violations = missingProperties.map(
    (prop) =>
      `Missing property '${prop.property}' required by ${prop.requiredIn} at ${path.relative(process.cwd(), prop.location.file)}:${prop.location.line}`
  );

  return {
    passed: missingProperties.length === 0,
    missingProperties,
    violations,
    summary: `Mapper Contract Guard: ${missingProperties.length} missing properties detected`,
  };
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const configPath = args[0] || 'tsconfig.json';

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  FACTORY RULE 4: Explicit Mapper Contract Guard (G2)`);
  console.log(`═══════════════════════════════════════════════════════\n`);

  console.log(`Config: ${configPath}`);
  console.log(`Checking mapper contract completeness...\n`);

  try {
    const result = validateMapperContract(configPath);

    if (result.passed) {
      console.log(`✓ PASS: All mapper contracts complete\n`);
      process.exit(0);
    } else {
      console.log(`✗ FAIL: ${result.missingProperties.length} missing properties detected\n`);

      // Group by file
      const byFile = new Map<string, MissingProperty[]>();
      for (const prop of result.missingProperties) {
        const file = prop.location.file;
        if (!byFile.has(file)) {
          byFile.set(file, []);
        }
        byFile.get(file)!.push(prop);
      }

      for (const [file, props] of byFile.entries()) {
        const relPath = path.relative(process.cwd(), file);
        console.log(`File: ${relPath}`);
        
        for (const prop of props) {
          console.log(`  Line ${prop.location.line}:${prop.location.column}`);
          console.log(`    Missing: '${prop.property}'`);
          console.log(`    Required by: ${prop.requiredIn}`);
          console.log(`    Provided by: ${prop.providedBy}`);
          console.log(``);
        }
      }

      console.log(`Rule 4 Guidance:`);
      console.log(`  1. Add ALL required properties explicitly to mapper`);
      console.log(`  2. Do NOT rely on spread operator for required fields`);
      console.log(`  3. Check canonical Insert/Update type for complete contract`);
      console.log(`  4. Provide business-valid defaults if field optional in domain`);
      console.log(`  5. Do NOT cast to 'any' or suppress error\n`);

      process.exit(2); // EXIT 2 = BLOCK
    }
  } catch (error) {
    console.error(`\n✗ ERROR: Rule execution failed`);
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { validateMapperContract, extractMissingProperties, MapperResult, MissingProperty };
