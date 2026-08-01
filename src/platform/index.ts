/**
 * @fileoverview Platform Core — Barrel Export
 *
 * Single entry point for ALL Platform Core Engines and infrastructure.
 * Import from here instead of deep-importing individual engine files.
 *
 * @example
 * import { eventCatalog, notificationHub, iamMatrix, commandBus } from '@/platform';
 *
 * @module platform
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION A: MESSAGING INFRASTRUCTURE (CQS / Event Bus)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Command Bus ───────────────────────────────────────────────────────────
export { commandBus, CommandBus } from './messaging/command-bus/command-bus';
export type { Command, CommandHandler } from './messaging/command-bus/command-bus';

// ─── Query Bus ─────────────────────────────────────────────────────────────
export { queryBus, QueryBus } from './messaging/query-bus/query-bus';
export type { Query, QueryHandler } from './messaging/query-bus/query-bus';

// ─── System Event Bus ──────────────────────────────────────────────────────
export { eventBus } from './messaging/event-bus/event-bus';
export type { SystemEvent } from './messaging/event-bus/event-bus';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION B: DOMAIN PATTERNS (DDD Primitives)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Specification Pattern ─────────────────────────────────────────────────
export { Specification } from './specification/specification';

// ─── Policy Engine ─────────────────────────────────────────────────────────
export {
  PolicyViolationError,
  AllPolicies,
  AnyPolicy,
} from './policy-engine/policy';
export type {
  PolicyViolation,
  PolicyResult,
  Policy,
} from './policy-engine/policy';

// ─── Projection Engine ─────────────────────────────────────────────────────
export { projectionEngine, ProjectionEngine } from './projection-engine/projection-engine';
export type { Projector } from './projection-engine/projection-engine';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION C: PLATFORM CORE ENGINES (Task 0.B — 13 Engines)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Engine 1: State Machine ───────────────────────────────────────────────
export {
  StateMachine,
  StateMachineBuilder,
  InvalidTransitionError,
  GuardRejectedError,
} from './state-machine/state-machine';
export type {
  TransitionContext,
  Transition,
  AuditHook,
  StateMachineOptions,
} from './state-machine/state-machine';

// ─── Engine 2: Event Catalog ───────────────────────────────────────────────
export {
  eventCatalog,
  EventBuilder,
} from './events/catalog';
export type {
  PlatformEventEnvelope,
  PlatformEventType,
  DomainEventType,
  IntegrationEventType,
  SystemEventType,
  AuditEventType,
  EventCategory,
  EventVersion,
  EventSchemaEntry,
} from './events/catalog';

// ─── Engine 3: Template Engine ─────────────────────────────────────────────
export { templateEngine } from './template-engine/index';
export type {
  TemplateDefinition,
  TemplateCategory,
  TemplateContext,
  CompileResult,
  TemplateFormat,
} from './template-engine/index';

// ─── Engine 4: Document Engine ─────────────────────────────────────────────
export { documentEngine } from './document-engine/index';
export {
  validateDocumentTransition,
  isDocumentTerminal,
  isSignatureRequestComplete,
  getNextPendingSignatureFields,
  TERMINAL_DOCUMENT_STATES,
} from './document-engine/index';
export type {
  DocumentTemplate,
  DocumentOutput,
  DocumentMetadata,
  DocumentCategory,
  DocumentFormat,
  DocumentGenerationOptions,
  // Lifecycle FSM
  DocumentLifecycleState,
  DocumentLifecycleEvent,
  DocumentLifecycleTransition,
  // Digital Signature
  SignatureField,
  SignatureRecord,
  SignatureRequest,
  SignatureRole,
  SignatureMethod,
  SignatureStatus,
} from './document-engine/index';

// ─── Engine 5: Activity Stream ─────────────────────────────────────────────
export { activityStream } from './activity-stream/index';
export type {
  ActivityEntry,
  ActivityActor,
  ActivityObject,
  ActivityVerb,
  StreamFilter,
  ActivityStreamSubscriber,
  IActivityStreamBackend,
} from './activity-stream/index';

// ─── Engine 6: Config Center ───────────────────────────────────────────────
export { configCenter } from './config-center/index';
export type {
  ConfigEntry,
  ConfigSource,
  ConfigChangeHandler,
} from './config-center/index';

// ─── Engine 7: KPI Engine ──────────────────────────────────────────────────
export { kpiEngine, KpiEngineClass } from './kpi-engine/index';
export type {
  KpiDefinition,
  KpiResult,
  KpiPeriod,
  KpiStatus,
  KpiUnit,
  KpiThreshold,
  KpiComputeContext,
  KpiDirection,
} from './kpi-engine/index';

// ─── Engine 8: Notification Hub ────────────────────────────────────────────
export { notificationHub } from './notification-hub/index';
export type {
  NotificationRequest,
  NotificationResult,
  NotificationRecord,
  NotificationChannel,
  NotificationType,
  NotificationPriority,
  NotificationRecipient,
  DeliveryStatus,
  INotificationAdapter,
  InAppNotificationRecord,
} from './notification-hub/index';

// ─── Engine 9: Search Engine ───────────────────────────────────────────────
export { searchEngine } from './search-engine/index';
export type {
  SearchDocument,
  SearchQuery,
  SearchResult,
  SearchHit,
  SearchDocumentType,
  ISearchBackend,
} from './search-engine/index';

// ─── Engine 10: Integration Hub (DLQ) ─────────────────────────────────────
export { integrationHub } from './integration-hub/index';
export type {
  IntegrationJob,
  IntegrationJobType,
  JobResult,
  JobHandler,
  JobStatus,
  JobPriority,
  DlqEntry,
  ProcessBatchResult,
} from './integration-hub/index';

// ─── Engine 11: IAM Permission Matrix ─────────────────────────────────────
export { iamMatrix, PERMISSIONS } from './iam-matrix/index';
export type {
  Permission,
  SystemRole,
  PermissionRule,
  PermissionRequest,
  PermissionCheckResult,
} from './iam-matrix/index';

// ─── Engine 12: Scheduler Registry ────────────────────────────────────────
export { schedulerRegistry } from './scheduler-registry/index';
export type {
  ScheduledJobDefinition,
  ScheduleContext,
  ScheduleJobResult,
  ScheduleInterval,
  ScheduledJobStatus,
  JobRunRecord,
} from './scheduler-registry/index';

// ─── Engine 13: AI Orchestrator ───────────────────────────────────────────
export { aiOrchestrator } from './ai-orchestrator/index';
export type {
  AiAgentDefinition,
  AiAgentType,
  AiTask,
  AiTaskStatus,
  AiModel,
  AiCompletionRequest,
  AiCompletionResponse,
  IAiModelAdapter,
  AiTool,
} from './ai-orchestrator/index';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION D: PLATFORM INFRASTRUCTURE (Registry, Runtime, Data)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Vertical Registry ─────────────────────────────────────────────────────
export { verticalRegistry } from './registry/vertical-registry';
export type { VerticalManifest } from './registry/vertical-registry';

// ─── Tenant Runtime ────────────────────────────────────────────────────────
export { TenantRuntime } from './runtime/tenant-runtime';
export type { ResolvedTenantState } from './runtime/tenant-runtime';

// ─── Metadata Engine (Supabase-backed versioned config) ───────────────────
export { metadataEngine, MetadataEngine } from './metadata-engine/metadata-engine';
export type { MetadataConfig } from './metadata-engine/metadata-engine';

// ─── Compatibility / Legacy Bridge ────────────────────────────────────────
export { LegacySpaBridge } from './compatibility/legacy-bridge';
