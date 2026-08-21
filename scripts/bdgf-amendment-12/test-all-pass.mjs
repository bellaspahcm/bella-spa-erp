#!/usr/bin/env node
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GateRunner } from '../bdgf/gate-runner.mjs';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

async function main() {
  const configPath = join(rootDir, '.bdgf/gates/test/pass-test-gate.json');
  const config = JSON.parse(await readFile(configPath, 'utf-8'));
  
  const runner = new GateRunner({
    gateName: config.gateName,
    gateVersion: config.gateVersion,
    deployment: config.deployment,
    config: config
  });

  const result = await runner.run();
  console.log(`\nStatus: ${result.status}, Exit: ${result.status === 'PASS' ? 0 : 1}`);
  process.exit(result.status === 'PASS' ? 0 : 1);
}

main();
