/**
 * Temporal Engine Contract — D2
 * Registers in Platform Contract Registry (Law 8)
 */

import { ContractDefinition } from '@/platform/host/contract-registry/contract-registry.service';

export const TEMPORAL_ENGINE_CONTRACT: ContractDefinition = {
  id: 'platform.temporal-engine',
  name: 'Platform Temporal Intelligence Engine',
  version: '1.0.0',
  description:
    `Event-driven immutable snapshot engine. Answers "What did the system know at time T?" ` +
    `Capture is triggered by Domain Events, NOT by DB triggers on domain tables. ` +
    `Does NOT restore DB state — use D1 RollbackEngine for that.`,
  provider: 'platform.host',
  consumers: ['healthcare', 'beauty_spa', 'bella_auto', 'babycare', 'finance', 'platform'],
  methods: [
    {
      name: 'captureSnapshot',
      description: 'Record entity state at this point in time (called from Domain Event handlers)',
      inputSchema: {
        type: 'object',
        required: ['entityType', 'entityId', 'snapshotData', 'changeType'],
        properties: {
          entityType: { type: 'string' },
          entityId: { type: 'string', format: 'uuid' },
          snapshotData: { type: 'object' },
          changeType: { type: 'string', enum: ['INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE'] },
          changeSummary: { type: 'string' },
          changedFields: { type: 'array', items: { type: 'string' } },
          sourceEventId: { type: 'string', format: 'uuid' },
          sourceEventType: { type: 'string' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          snapshotVersion: { type: 'integer' },
          capturedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    {
      name: 'getAtPointInTime',
      description: 'Return most recent snapshot AT OR BEFORE timestamp (read-only)',
      inputSchema: {
        type: 'object',
        required: ['entityType', 'entityId', 'timestamp'],
        properties: {
          entityType: { type: 'string' },
          entityId: { type: 'string', format: 'uuid' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      outputSchema: { type: 'object', nullable: true },
    },
    {
      name: 'getHistory',
      description: 'Full chronological history for an entity',
      inputSchema: {
        type: 'object',
        required: ['entityType', 'entityId'],
        properties: {
          entityType: { type: 'string' },
          entityId: { type: 'string', format: 'uuid' },
          fromDate: { type: 'string', format: 'date-time' },
          toDate: { type: 'string', format: 'date-time' },
          changeTypes: { type: 'array', items: { type: 'string' } },
          limit: { type: 'integer' },
        },
      },
      outputSchema: { type: 'array' },
    },
    {
      name: 'diffSnapshots',
      description: 'Field-level diff between two snapshot versions of the same entity',
      inputSchema: {
        type: 'object',
        required: ['snapshotId1', 'snapshotId2'],
        properties: {
          snapshotId1: { type: 'string', format: 'uuid' },
          snapshotId2: { type: 'string', format: 'uuid' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          changes: { type: 'object' },
          addedFields: { type: 'array', items: { type: 'string' } },
          removedFields: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  ],
  events: ['platform.temporal.snapshot.captured.v1'],
  featureFlag: 'platform.temporal-engine.enabled',
  status: 'active',
  createdAt: '2026-08-08',
};
