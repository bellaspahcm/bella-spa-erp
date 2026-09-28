#!/usr/bin/env node
/**
 * Focused tests for the BDGF operational approval entrypoint.
 *
 * These tests do not write to the database. They verify the record contract
 * and validation logic before the command is used operationally.
 */

import assert from 'assert/strict';
import { readFileSync } from 'fs';
import { computeApprovalHash, computeHash } from './r4-verify-approval.mjs';
import {
  MAX_EXPIRY_MINUTES,
  buildApprovalHashInput,
  buildRequestFromArgs,
  parseArgs,
  parseExpiryMinutes,
  validateApprovalRequest
} from './create-migration-approval.mjs';

const R3_MIGRATION_PATH = 'supabase/migrations/20260926000000_r3_student_identity_resolver.sql';
const EXPECTED_R3_HASH = '069feaf9ff4f098d6bb02031eaa2b820874fc5a566ef497e3f7cc3eab0f33c8a';

const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, pass: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, pass: false, error });
    console.log(`FAIL ${name}: ${error.message}`);
  }
}

function validRequest(overrides = {}) {
  return {
    migrationFile: R3_MIGRATION_PATH,
    migrationContent: readFileSync(R3_MIGRATION_PATH, 'utf8'),
    migrationHash: EXPECTED_R3_HASH,
    requesterId: 'owner-requester@bella',
    approverId: 'owner-approver@bella',
    approverRole: 'admin',
    approvalMode: 'separated',
    targetEnvironment: 'production',
    targetSchema: 'public',
    expiresInMinutes: 120,
    notes: null,
    ...overrides
  };
}

test('valid approval request is accepted', () => {
  assert.doesNotThrow(() => validateApprovalRequest(validRequest()));
});

test('separated + same identity is rejected', () => {
  assert.throws(
    () => validateApprovalRequest(validRequest({
      requesterId: 'same@bella',
      approverId: 'same@bella',
      approvalMode: 'separated'
    })),
    /different identities/
  );
});

test('owner-operated + same identity + authorized production role is accepted', () => {
  assert.doesNotThrow(() => validateApprovalRequest(validRequest({
    requesterId: 'owner@bella',
    approverId: 'owner@bella',
    approvalMode: 'owner_operated',
    approverRole: 'admin'
  })));
});

test('owner-operated + unauthorized production role is rejected', () => {
  assert.throws(
    () => validateApprovalRequest(validRequest({
      requesterId: 'owner@bella',
      approverId: 'owner@bella',
      approvalMode: 'owner_operated',
      approverRole: 'tech_lead'
    })),
    /not authorized for production/
  );
});

test('missing approval mode defaults to separated and rejects same identity', () => {
  const request = validRequest({
    requesterId: 'same-default@bella',
    approverId: 'same-default@bella'
  });
  delete request.approvalMode;

  assert.throws(
    () => validateApprovalRequest({ ...request, approvalMode: request.approvalMode || 'separated' }),
    /different identities/
  );
});

test('unauthorized production role is rejected', () => {
  assert.throws(
    () => validateApprovalRequest(validRequest({ approverRole: 'tech_lead' })),
    /not authorized for production/
  );
});

test('approval hash uses the existing canonical algorithm', () => {
  const row = {
    approval_id: '11111111-1111-4111-8111-111111111111',
    migration_hash: EXPECTED_R3_HASH,
    approval_mode: 'owner_operated',
    requester_id: 'owner-requester@bella',
    approver_id: 'owner-approver@bella',
    approved_at: '2026-09-26T10:00:00.000Z',
    target_environment: 'production',
    expires_at: '2026-09-26T12:00:00.000Z'
  };

  const approvalInput = buildApprovalHashInput(row);
  assert.equal(approvalInput.migration_id, row.approval_id);
  assert.equal(computeApprovalHash(approvalInput), computeApprovalHash({
    approval_id: row.approval_id,
    migration_id: row.approval_id,
    migration_hash: row.migration_hash,
    approval_mode: row.approval_mode,
    requester_id: row.requester_id,
    approver_id: row.approver_id,
    approved_at: row.approved_at,
    target_environment: row.target_environment,
    expires_at: row.expires_at
  }));
});

test('approval hash binds approval mode', () => {
  const baseApproval = {
    approval_id: '22222222-2222-4222-8222-222222222222',
    migration_id: '22222222-2222-4222-8222-222222222222',
    migration_hash: EXPECTED_R3_HASH,
    requester_id: 'owner@bella',
    approver_id: 'owner@bella',
    approved_at: '2026-09-26T10:00:00.000Z',
    target_environment: 'production',
    expires_at: '2026-09-26T12:00:00.000Z'
  };

  const separatedHash = computeApprovalHash({
    ...baseApproval,
    approval_mode: 'separated'
  });
  const ownerOperatedHash = computeApprovalHash({
    ...baseApproval,
    approval_mode: 'owner_operated'
  });

  assert.notEqual(separatedHash, ownerOperatedHash);
});

test('migration hash is bound to exact file content', () => {
  const actualHash = computeHash(readFileSync(R3_MIGRATION_PATH, 'utf8'));
  assert.equal(actualHash, EXPECTED_R3_HASH);

  const request = buildRequestFromArgs(parseArgs([
    `--migration-file=${R3_MIGRATION_PATH}`,
    '--requester=owner-requester@bella',
    '--approver=owner-approver@bella',
    '--approver-role=admin',
    '--approval-mode=separated',
    '--environment=production',
    '--target-schema=public',
    '--expires-in-minutes=120'
  ]));

  assert.equal(request.migrationHash, EXPECTED_R3_HASH);
  assert.equal(request.approvalMode, 'separated');
});

test('owner-operated CLI spelling is normalized', () => {
  const request = buildRequestFromArgs(parseArgs([
    `--migration-file=${R3_MIGRATION_PATH}`,
    '--requester=owner@bella',
    '--approver=owner@bella',
    '--approver-role=admin',
    '--approval-mode=owner-operated',
    '--environment=production'
  ]));

  assert.equal(request.approvalMode, 'owner_operated');
  assert.doesNotThrow(() => validateApprovalRequest(request));
});

test('expiry is present and bounded', () => {
  assert.equal(parseExpiryMinutes(undefined), 120);
  assert.equal(parseExpiryMinutes('60'), 60);
  assert.throws(() => parseExpiryMinutes('0'), /positive integer/);
  assert.throws(() => parseExpiryMinutes(String(MAX_EXPIRY_MINUTES + 1)), /must be <=/);
  assert.throws(
    () => validateApprovalRequest(validRequest({ expiresInMinutes: MAX_EXPIRY_MINUTES + 1 })),
    /Approval expiry/
  );
});

const failed = results.filter(result => !result.pass);
console.log(`\nBDGF approval entrypoint tests: ${results.length - failed.length}/${results.length} PASS`);

if (failed.length > 0) {
  process.exit(1);
}
