#!/usr/bin/env node
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GateRunner } from '../bdgf/gate-runner.mjs';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

async function main() {
  try {
    const configPath = join(rootDir, '.bdgf/gates/test/exception-test-gate.json');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    
    const runner = new GateRunner({
      gateName: config.gateName,
      gateVersion: config.gateVersion,
      deployment: config.deployment,
      config: config
    });

    const result = await runner.run();
    console.log(`\nStatus: ${result.status}, Checks: ${result.checks.pass}/${result.checks.total}`);
    process.exit(result.status === 'PASS' ? 0 : 1);
  } catch (error) {
    console.error(`\n❌ EXCEPTION: ${error.message}`);
    process.exit(1);
  }
}

main();
