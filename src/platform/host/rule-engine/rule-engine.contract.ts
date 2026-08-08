/**
 * Rule Engine Contract — D3
 * Registers in Platform Contract Registry (Law 8)
 *
 * Governance boundary:
 *   D3 handles BUSINESS rules only (spa.booking, finance.commission, notification.routing, etc.)
 *   ❌ Clinical safety rules (drug interactions, allergy blocks) belong in ClinicalSafetyEngine (Phase C).
 */

import { ContractDefinition } from '@/platform/host/contract-registry/contract-registry.service';

export const RULE_ENGINE_CONTRACT: ContractDefinition = {
  id: 'platform.rule-engine',
  name: 'Platform Governed Business Rule Engine',
  version: '1.0.0',
  description:
    `No-Code business rule engine with strict governance. ` +
    `Rule lifecycle: DRAFT → REVIEW → APPROVED → ACTIVE → SUSPENDED → RETIRED. ` +
    `ACTIVE rules are immutable (enforced by DB trigger). ` +
    `ABSOLUTE severity requires ARB approval (approved_by + approved_at). ` +
    `This engine CANNOT override Clinical Safety Engine (Phase C) or Safety Policy.`,
  provider: 'platform.host',
  consumers: ['beauty_spa', 'bella_auto', 'babycare', 'finance', 'hr', 'notification', 'crm'],
  methods: [
    {
      name: 'createRule',
      description: 'Create a new business rule in DRAFT status',
      inputSchema: {
        type: 'object',
        required: ['ruleKey', 'version', 'domain', 'name', 'conditions'],
        properties: {
          ruleKey: { type: 'string' },
          version: { type: 'string', description: 'Semver: 1.0.0' },
          domain: { type: 'string', enum: ['spa.booking', 'spa.commission', 'finance.commission', 'notification.routing', 'crm.sla', 'bella_auto.sales', 'babycare.booking'] },
          name: { type: 'string' },
          severity: { type: 'string', enum: ['LOW', 'MODERATE', 'HIGH', 'ABSOLUTE'] },
          conditions: { type: 'object', description: '{ operator: AND|OR, rules: [{field, op, value}] }' },
          actionType: { type: 'string', enum: ['NOTIFY', 'WARN', 'ESCALATE', 'EXECUTE_WORKFLOW', 'BLOCK'] },
        },
      },
      outputSchema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: ['DRAFT'] } } },
    },
    {
      name: 'approveRule',
      description: 'Approve rule for activation. Required for ABSOLUTE severity (ARB governance).',
      inputSchema: {
        type: 'object',
        required: ['ruleId', 'approvedBy'],
        properties: {
          ruleId: { type: 'string', format: 'uuid' },
          approvedBy: { type: 'string', format: 'uuid', description: 'ARB member UUID' },
          approvedAt: { type: 'string', format: 'date-time' },
        },
      },
      outputSchema: { type: 'null' },
    },
    {
      name: 'activateRule',
      description: 'Activate approved rule. Automatically retires previous ACTIVE version for same rule_key.',
      inputSchema: {
        type: 'object',
        required: ['ruleId'],
        properties: { ruleId: { type: 'string', format: 'uuid' } },
      },
      outputSchema: { type: 'null' },
    },
    {
      name: 'evaluateRule',
      description: 'Evaluate a single rule against input context. Records evaluation in audit log.',
      inputSchema: {
        type: 'object',
        required: ['ruleId', 'contextType', 'inputData'],
        properties: {
          ruleId: { type: 'string', format: 'uuid' },
          contextType: { type: 'string' },
          contextId: { type: 'string', format: 'uuid' },
          inputData: { type: 'object' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          outcome: { type: 'string', enum: ['TRIGGERED', 'NOT_TRIGGERED', 'SKIPPED_SUSPENDED', 'SKIPPED_EXPIRED', 'ERROR'] },
          conditionsMet: { type: 'boolean' },
        },
      },
    },
    {
      name: 'evaluateAllActiveRules',
      description: 'Batch evaluate all ACTIVE rules for a domain against input context.',
      inputSchema: {
        type: 'object',
        required: ['domain', 'contextType', 'inputData'],
        properties: {
          domain: { type: 'string' },
          contextType: { type: 'string' },
          inputData: { type: 'object' },
          contextId: { type: 'string', format: 'uuid' },
        },
      },
      outputSchema: { type: 'array' },
    },
    {
      name: 'suspendRule',
      description: 'Suspend an ACTIVE rule',
      inputSchema: {
        type: 'object',
        required: ['ruleId', 'reason'],
        properties: { ruleId: { type: 'string', format: 'uuid' }, reason: { type: 'string' } },
      },
      outputSchema: { type: 'null' },
    },
    {
      name: 'retireRule',
      description: 'Permanently retire a rule',
      inputSchema: {
        type: 'object',
        required: ['ruleId'],
        properties: { ruleId: { type: 'string', format: 'uuid' } },
      },
      outputSchema: { type: 'null' },
    },
  ],
  events: [
    'platform.rule.created.v1',
    'platform.rule.approved.v1',
    'platform.rule.activated.v1',
    'platform.rule.evaluated.v1',
    'platform.rule.suspended.v1',
    'platform.rule.retired.v1',
  ],
  featureFlag: 'platform.rule-engine.enabled',
  status: 'active',
  createdAt: '2026-08-08',
};
