/**
 * Extension Bootstrap Example
 * 
 * File này demo cách setup DI container và register extensions.
 * Trong production, code này sẽ được gọi trong app initialization.
 * 
 * @example
 * ```typescript
 * // In Next.js app initialization (e.g., middleware.ts or _app.tsx)
 * import { bootstrapExtensions } from '@/lib/di/bootstrap.example';
 * 
 * // On app start
 * bootstrapExtensions();
 * 
 * // On app shutdown
 * process.on('SIGTERM', async () => {
 *   await cleanupExtensions();
 * });
 * ```
 */

import { extensionRegistry } from './ExtensionRegistry';
import { globalContainer } from './ServiceContainer';

// Import reference implementations
import { RuleProvider } from '../decision-engine/providers/RuleProvider';
import { EmailAction } from '../workflow-engine/actions/EmailAction';
import { InMemoryEventPublisher } from '../events/publishers/InMemoryEventPublisher';

/**
 * Bootstrap all extensions
 * 
 * Đây là nơi register tất cả implementations.
 * Trong production, có thể load config từ environment variables.
 */
export function bootstrapExtensions(): void {
  console.log('[Bootstrap] Initializing extensions...');
  
  // ========================================
  // 1. Register Decision Providers
  // ========================================
  
  const ruleProvider = new RuleProvider();
  extensionRegistry.registerDecisionProvider(ruleProvider);
  console.log(`[Bootstrap] Registered decision provider: ${ruleProvider.name}`);
  
  // Future: Register BI Provider, AI Provider, etc.
  // const biProvider = new BIProvider();
  // extensionRegistry.registerDecisionProvider(biProvider);
  
  // ========================================
  // 2. Register Workflow Actions
  // ========================================
  
  // Email Action - requires SMTP config
  const emailConfig = {
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: parseInt(process.env.SMTP_PORT || '587'),
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
    from: process.env.EMAIL_FROM || 'noreply@bella.vn',
    fromName: process.env.EMAIL_FROM_NAME || 'Bella ERP',
    useTLS: true
  };
  
  const emailAction = new EmailAction(emailConfig);
  extensionRegistry.registerWorkflowAction(emailAction);
  console.log(`[Bootstrap] Registered workflow action: ${emailAction.actionType}`);
  
  // Future: Register other actions
  // const webhookAction = new WebhookAction();
  // extensionRegistry.registerWorkflowAction(webhookAction);
  
  // const zaloAction = new ZaloAction(zaloConfig);
  // extensionRegistry.registerWorkflowAction(zaloAction);
  
  // ========================================
  // 3. Register Event Publishers
  // ========================================
  
  // In-memory publisher for development
  const inMemoryPublisher = new InMemoryEventPublisher({
    bufferSize: 1000,
    enableMetrics: true,
    debug: process.env.NODE_ENV === 'development'
  });
  
  extensionRegistry.registerEventPublisher(inMemoryPublisher, true); // Set as default
  console.log(`[Bootstrap] Registered event publisher: ${inMemoryPublisher.name} (default)`);
  
  // Future: Register Redis/RabbitMQ/Kafka publishers for production
  // if (process.env.REDIS_URL) {
  //   const redisPublisher = new RedisEventPublisher({
  //     url: process.env.REDIS_URL
  //   });
  //   extensionRegistry.registerEventPublisher(redisPublisher);
  // }
  
  // ========================================
  // 4. Register Integration Adapters
  // ========================================
  
  // Zalo Adapter
  // if (process.env.ZALO_OA_ID && process.env.ZALO_ACCESS_TOKEN) {
  //   const zaloAdapter = new ZaloAdapter({
  //     oaId: process.env.ZALO_OA_ID,
  //     accessToken: process.env.ZALO_ACCESS_TOKEN,
  //     refreshToken: process.env.ZALO_REFRESH_TOKEN
  //   });
  //   extensionRegistry.registerIntegrationAdapter(zaloAdapter);
  //   console.log(`[Bootstrap] Registered integration adapter: ${zaloAdapter.provider}`);
  // }
  
  // Meta Adapter
  // if (process.env.META_APP_ID && process.env.META_APP_SECRET) {
  //   const metaAdapter = new MetaAdapter({
  //     appId: process.env.META_APP_ID,
  //     appSecret: process.env.META_APP_SECRET
  //   });
  //   extensionRegistry.registerIntegrationAdapter(metaAdapter);
  //   console.log(`[Bootstrap] Registered integration adapter: ${metaAdapter.provider}`);
  // }
  
  // ========================================
  // 5. Register Services in DI Container
  // ========================================
  
  // Register registry itself as singleton
  globalContainer.registerSingleton('extensionRegistry', () => extensionRegistry);
  
  // Register default event publisher
  globalContainer.registerSingleton('eventPublisher', () => 
    extensionRegistry.getDefaultEventPublisher()
  );
  
  // Register decision engine (future)
  // globalContainer.registerSingleton('decisionEngine', (c) => 
  //   new DecisionEngine(extensionRegistry.getAllDecisionProviders())
  // );
  
  // Register workflow engine (future)
  // globalContainer.registerSingleton('workflowEngine', (c) => {
  //   const actions = new Map();
  //   for (const action of extensionRegistry.getAllWorkflowActions()) {
  //     actions.set(action.actionType, action);
  //   }
  //   return new WorkflowEngine(actions);
  // });
  
  console.log('[Bootstrap] Extensions initialized successfully');
  console.log('[Bootstrap] Stats:', extensionRegistry.getStats());
}

/**
 * Cleanup all extensions on app shutdown
 */
export async function cleanupExtensions(): Promise<void> {
  console.log('[Bootstrap] Cleaning up extensions...');
  
  await extensionRegistry.dispose();
  await globalContainer.dispose();
  
  console.log('[Bootstrap] Cleanup complete');
}

/**
 * Get extension registry stats
 */
export function getExtensionStats() {
  return {
    extensions: extensionRegistry.getStats(),
    services: globalContainer.getServiceKeys()
  };
}
