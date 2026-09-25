import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { verifyApprovedCoreChange } from './approved-core-change-guard.mjs';

function approval(overrides = {}) {
  return {
    file: 'docs/architecture/acr/ACR-test.md',
    metadata: {
      version: 1,
      acrId: 'ACR-TEST-001',
      status: 'APPROVED',
      pr: 153,
      approvedCoreFiles: [
        'src/core/services/order/payment-actions.ts',
        'src/core/services/order/payment-helpers.ts',
      ],
      approver: 'Human/ARB',
      approvedDate: '2026-09-25',
      purpose: 'Test approved Core change.',
      contractChange: false,
      schemaChange: false,
      rpcChange: false,
      apiChange: false,
      ownershipChange: false,
      ...overrides,
    },
  };
}

function expectPass(name, input, expectedReason) {
  const result = verifyApprovedCoreChange(input);
  assert.equal(result.status, 'PASS', name);
  if (expectedReason) {
    assert.match(result.reason, expectedReason, name);
  }
}

function expectFail(name, input, expectedMessage) {
  assert.throws(
    () => verifyApprovedCoreChange(input),
    expectedMessage,
    name,
  );
}

function runUnitCases() {
  const exactCoreFiles = [
    'src/core/services/order/payment-actions.ts',
    'src/core/services/order/payment-helpers.ts',
  ];

  expectPass(
    'no Core change passes without approval',
    {
      changedFiles: ['src/app/dashboard/bookings/page.tsx'],
      approvals: [],
      prNumber: 153,
    },
    /No src\/core changes/,
  );

  expectFail(
    'Core change without approval fails',
    {
      changedFiles: exactCoreFiles,
      approvals: [],
      prNumber: 153,
    },
    /no APPROVED_CORE_CHANGE_V1 metadata/i,
  );

  expectFail(
    'PENDING ACR fails',
    {
      changedFiles: exactCoreFiles,
      approvals: [approval({ status: 'PENDING' })],
      prNumber: 153,
    },
    /not APPROVED|does not exactly match/i,
  );

  expectFail(
    'REJECTED ACR fails',
    {
      changedFiles: exactCoreFiles,
      approvals: [approval({ status: 'REJECTED' })],
      prNumber: 153,
    },
    /not APPROVED|does not exactly match/i,
  );

  expectFail(
    'wrong PR binding fails',
    {
      changedFiles: exactCoreFiles,
      approvals: [approval({ pr: 999 })],
      prNumber: 153,
    },
    /bound to PR 999|does not exactly match/i,
  );

  expectPass(
    'exact approved Core file set passes',
    {
      changedFiles: [...exactCoreFiles].reverse(),
      approvals: [approval()],
      prNumber: 153,
    },
    /ACR-TEST-001/,
  );

  expectFail(
    'one extra Core file fails',
    {
      changedFiles: [...exactCoreFiles, 'src/core/services/order/other.ts'],
      approvals: [approval()],
      prNumber: 153,
    },
    /does not exactly match/,
  );

  expectFail(
    'one approved file missing from diff fails',
    {
      changedFiles: ['src/core/services/order/payment-actions.ts'],
      approvals: [approval()],
      prNumber: 153,
    },
    /does not exactly match/,
  );

  expectFail(
    'malformed metadata fails closed',
    {
      changedFiles: exactCoreFiles,
      approvals: [approval({ approvedDate: 'pending' })],
      prNumber: 153,
    },
    /approvedDate|does not exactly match/i,
  );

  expectFail(
    'wildcard authorization fails',
    {
      changedFiles: exactCoreFiles,
      approvals: [approval({ approvedCoreFiles: ['src/core/services/order/*'] })],
      prNumber: 153,
    },
    /wildcard|does not exactly match/i,
  );

  expectFail(
    'one valid approval does not mask malformed metadata',
    {
      changedFiles: exactCoreFiles,
      approvals: [approval(), approval({ approvedDate: 'pending' })],
      prNumber: 153,
    },
    /Invalid approved Core change metadata|approvedDate/i,
  );
}

async function runParserCase() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'bella-core-approval-'));
  try {
    const acrDir = path.join(tempDir, 'acr');
    mkdirSync(acrDir, { recursive: true });
    writeFileSync(
      path.join(acrDir, 'ACR-test.md'),
      `# Test ACR

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-TEST-002",
  "status": "APPROVED",
  "pr": 153,
  "approvedCoreFiles": [
    "src/core/services/order/payment-actions.ts",
    "src/core/services/order/payment-helpers.ts"
  ],
  "approver": "Human/ARB",
  "approvedDate": "2026-09-25",
  "purpose": "Parser test.",
  "contractChange": false,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->
`,
      'utf8',
    );

    const result = spawnSync(
      process.execPath,
      [
        'scripts/approved-core-change-guard.mjs',
        '--acr-dir',
        acrDir,
        '--pr',
        '153',
        '--files',
        'src/core/services/order/payment-actions.ts',
        'src/core/services/order/payment-helpers.ts',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /ACR-TEST-002/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

runUnitCases();
await runParserCase();
console.log('approved-core-change-guard tests passed');
