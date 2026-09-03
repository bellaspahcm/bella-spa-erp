/**
 * Rollback Engine Contract — D1
 * Registers in Platform Contract Registry (Law 8)
 */

import type { EngineContractDefinition } from '@/platform/host/contract-registry/types';

export const ROLLBACK_ENGINE_CONTRACT: EngineContractDefinition = {
  id: 'platform.rollback-engine',
  name: 'Platform Compensating Transaction Engine',
  version: '1.0.0',
  description:
    'Saga-pattern rollback engine providing compensating transaction lifecycle management. ' +
    'NOT a simple undo — each step has an explicit compensating business action. ' +
    'State machine: STARTED → EXECUTING → COMMITTED | ROLLED_BACK | MANUAL_RECOVERY_REQUIRED.',
  provider: 'platform.host',
  consumers: ['healthcare', 'beauty_spa', 'bella_auto', 'babycare', 'finance'],
  methods: [
    {
      name: 'startTransaction',
      description: 'Create a new business saga transaction',
      inputSchema: {
        type: 'object',
        required: ['domain', 'transactionType', 'entityType', 'entityId'],
        properties: {
          domain: { type: 'string', enum: ['healthcare', 'beauty_spa', 'bella_auto', 'babycare', 'finance', 'notification', 'inventory', 'platform'] },
          transactionType: { type: 'string' },
          entityType: { type: 'string' },
          entityId: { type: 'string', format: 'uuid' },
          createdBy: { type: 'string', format: 'uuid' },
          correlationId: { type: 'string', format: 'uuid' },
          metadata: { type: 'object' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['STARTED'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    {
      name: 'executeStep',
      description: 'Record a forward action and its compensating action',
      inputSchema: {
        type: 'object',
        required: ['action', 'entityType', 'entityId', 'compensatingAction', 'compensatingParams'],
        properties: {
          action: { type: 'string' },
          entityType: { type: 'string' },
          entityId: { type: 'string', format: 'uuid' },
          compensatingAction: { type: 'string' },
          compensatingParams: { type: 'object' },
          snapshotBefore: { type: 'object' },
          snapshotAfter: { type: 'object' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          sequence: { type: 'integer' },
          status: { type: 'string', enum: ['EXECUTED'] },
        },
      },
    },
    {
      name: 'commitTransaction',
      description: 'Mark saga as successfully committed',
      inputSchema: {
        type: 'object',
        required: ['transactionId'],
        properties: { transactionId: { type: 'string', format: 'uuid' } },
      },
      outputSchema: { type: 'null' },
    },
    {
      name: 'rollbackTransaction',
      description:
        'Execute compensating actions in REVERSE step order. ' +
        'If any compensation fails: ROLLBACK_FAILED → MANUAL_RECOVERY_REQUIRED.',
      inputSchema: {
        type: 'object',
        required: ['transactionId', 'reason'],
        properties: {
          transactionId: { type: 'string', format: 'uuid' },
          reason: { type: 'string' },
          triggeredBy: { type: 'string', format: 'uuid' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          stepsTotal: { type: 'integer' },
          stepsSucceeded: { type: 'integer' },
          stepsFailed: { type: 'integer' },
          finalStatus: {
            type: 'string',
            enum: ['ROLLED_BACK', 'ROLLBACK_FAILED', 'MANUAL_RECOVERY_REQUIRED'],
          },
        },
      },
    },
    {
      name: 'markManualRecovery',
      description: 'Operator acknowledges ROLLBACK_FAILED state and documents resolution',
      inputSchema: {
        type: 'object',
        required: ['transactionId', 'note', 'resolvedBy'],
        properties: {
          transactionId: { type: 'string', format: 'uuid' },
          note: { type: 'string' },
          resolvedBy: { type: 'string', format: 'uuid' },
        },
      },
      outputSchema: { type: 'null' },
    },
  ],
  events: [
    'platform.transaction.started.v1',
    'platform.transaction.step.executed.v1',
    'platform.transaction.committed.v1',
    'platform.transaction.rollback.started.v1',
    'platform.transaction.rollback.completed.v1',
    'platform.transaction.rollback.failed.v1',
    'platform.transaction.manual_recovery.required.v1',
  ],
  featureFlag: 'platform.rollback-engine.enabled',
  status: 'active',
  createdAt: '2026-08-08',
};
