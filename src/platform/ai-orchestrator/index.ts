/**
 * @fileoverview Platform AI Orchestrator
 *
 * Central coordination layer for AI-powered features across Bella ERP:
 * - AI agent registration and routing
 * - Prompt pipeline management
 * - Model adapter pattern (swap LLM backends)
 * - Structured output extraction
 * - AI task queue with retry
 * - Usage/cost tracking per tenant
 *
 * @module platform/ai-orchestrator
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AiModel =
  | 'gemini-2.0-flash'
  | 'gemini-2.5-pro'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'claude-3-5-sonnet'
  | string;

export type AiTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type AiAgentType =
  | 'lead_qualifier'         // CRM lead scoring
  | 'contract_reviewer'      // Real estate contract analysis
  | 'salary_explainer'       // HR salary explanation
  | 'document_summarizer'    // Document summarization
  | 'data_extractor'         // Structured data extraction from text
  | 'kpi_analyst'            // KPI trend analysis
  | 'customer_intent'        // Customer intent detection
  | 'anomaly_detector'       // Financial anomaly detection
  | string;

// ─────────────────────────────────────────────────────────────────────────────
// Model Adapter Contract
// ─────────────────────────────────────────────────────────────────────────────

export interface AiCompletionRequest {
  model: AiModel;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  tools?: AiTool[];
}

export interface AiCompletionResponse {
  content: string;
  model: AiModel;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'tool_call' | 'error';
  rawResponse?: unknown;
}

export interface AiTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface IAiModelAdapter {
  readonly model: AiModel;
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Agent Definition
// ─────────────────────────────────────────────────────────────────────────────

export interface AiAgentDefinition<TInput = Record<string, unknown>, TOutput = unknown> {
  type: AiAgentType;
  name: string;
  description: string;
  /** Preferred model for this agent */
  preferredModel: AiModel;
  /** Fallback model if preferred is unavailable */
  fallbackModel?: AiModel;
  /** System prompt template (supports {{variable}} interpolation) */
  systemPrompt: string;
  /** User prompt template */
  userPromptTemplate: string;
  /** Parse the AI response into structured output */
  parseOutput?: (response: string, input: TInput) => TOutput;
  /** Max attempts on failure */
  maxAttempts?: number;
  /** Temperature (0=deterministic, 1=creative) */
  temperature?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Task
// ─────────────────────────────────────────────────────────────────────────────

export interface AiTask<TInput = Record<string, unknown>, TOutput = unknown> {
  id: string;
  agentType: AiAgentType;
  tenantId: string;
  input: TInput;
  status: AiTaskStatus;
  attempt: number;
  maxAttempts: number;
  output?: TOutput;
  rawResponse?: string;
  error?: string;
  model?: AiModel;
  usage?: AiCompletionResponse['usage'];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage Tracker
// ─────────────────────────────────────────────────────────────────────────────

interface UsageRecord {
  tenantId: string;
  agentType: AiAgentType;
  model: AiModel;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template interpolation
// ─────────────────────────────────────────────────────────────────────────────

function interpolatePrompt(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\S+?)\}\}/g, (_m, key) => {
    const parts = key.split('.');
    let val: unknown = data;
    for (const p of parts) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        val = (val as Record<string, unknown>)[p];
      } else { val = undefined; break; }
    }
    return val !== undefined && val !== null ? String(val) : '';
  });
}

function generateTaskId(): string {
  return `aitask_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

class AiOrchestratorClass {
  private readonly adapters = new Map<AiModel, IAiModelAdapter>();
  private readonly agents = new Map<AiAgentType, AiAgentDefinition>();
  private readonly taskStore = new Map<string, AiTask>();
  private readonly usageLog: UsageRecord[] = [];

  /** Default model to use when preferred/fallback is unavailable */
  private defaultModel: AiModel = 'gemini-2.0-flash';

  // ── Setup ─────────────────────────────────────────────────────────────────

  /** Register a model adapter */
  registerAdapter(adapter: IAiModelAdapter): void {
    this.adapters.set(adapter.model, adapter);
  }

  /** Set the default model */
  setDefaultModel(model: AiModel): void {
    this.defaultModel = model;
  }

  /** Register an AI agent definition */
  registerAgent<TInput = Record<string, unknown>, TOutput = unknown>(
    agent: AiAgentDefinition<TInput, TOutput>
  ): void {
    this.agents.set(agent.type, agent as AiAgentDefinition);
  }

  // ── Task Execution ────────────────────────────────────────────────────────

  /**
   * Execute an AI agent task synchronously.
   * Returns the completed AiTask with output.
   */
  async run<TInput extends Record<string, unknown> = Record<string, unknown>, TOutput = unknown>(params: {
    agentType: AiAgentType;
    tenantId: string;
    input: TInput;
    overrideModel?: AiModel;
  }): Promise<AiTask<TInput, TOutput>> {
    const agent = this.agents.get(params.agentType);
    if (!agent) throw new Error(`[AiOrchestrator] Agent not found: ${params.agentType}`);

    const task: AiTask<TInput, TOutput> = {
      id: generateTaskId(),
      agentType: params.agentType,
      tenantId: params.tenantId,
      input: params.input,
      status: 'pending',
      attempt: 0,
      maxAttempts: agent.maxAttempts ?? 3,
      createdAt: new Date().toISOString(),
    };
    this.taskStore.set(task.id, task as AiTask);

    // Resolve model
    const model = params.overrideModel
      ?? (this.adapters.has(agent.preferredModel) ? agent.preferredModel : null)
      ?? (agent.fallbackModel && this.adapters.has(agent.fallbackModel) ? agent.fallbackModel : null)
      ?? this.defaultModel;

    const adapter = this.adapters.get(model);
    if (!adapter) {
      task.status = 'failed';
      task.error = `No adapter registered for model: ${model}`;
      return task;
    }

    task.model = model;
    task.status = 'running';
    task.startedAt = new Date().toISOString();

    const startMs = Date.now();

    while (task.attempt < task.maxAttempts) {
      task.attempt += 1;
      try {
        const userPrompt = interpolatePrompt(
          agent.userPromptTemplate,
          { ...params.input, tenantId: params.tenantId }
        );
        const systemPrompt = agent.systemPrompt
          ? interpolatePrompt(agent.systemPrompt, { ...params.input, tenantId: params.tenantId })
          : undefined;

        const response = await adapter.complete({
          model,
          systemPrompt,
          userPrompt,
          temperature: agent.temperature ?? 0.2,
          responseFormat: agent.parseOutput ? 'json' : 'text',
        });

        task.rawResponse = response.content;
        task.usage = response.usage;

        // Track usage
        this.usageLog.push({
          tenantId: params.tenantId,
          agentType: params.agentType,
          model,
          ...response.usage,
          timestamp: new Date().toISOString(),
        });

        // Parse output
        if (agent.parseOutput) {
          try {
            task.output = agent.parseOutput(response.content, params.input) as TOutput;
          } catch {
            // Try JSON parse as fallback
            try {
              task.output = JSON.parse(response.content) as TOutput;
            } catch {
              task.output = response.content as unknown as TOutput;
            }
          }
        } else {
          task.output = response.content as unknown as TOutput;
        }

        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        task.durationMs = Date.now() - startMs;
        break;

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        task.error = errMsg;
        console.error('[AiOrchestrator] Task %s attempt %d failed: %s', task.id, task.attempt, errMsg);

        if (task.attempt >= task.maxAttempts) {
          task.status = 'failed';
          task.completedAt = new Date().toISOString();
          task.durationMs = Date.now() - startMs;
        } else {
          // Brief backoff before retry
          await new Promise((r) => setTimeout(r, 1000 * task.attempt));
        }
      }
    }

    return task;
  }

  /**
   * Enqueue a task for async processing (returns task ID immediately).
   */
  enqueue<TInput extends Record<string, unknown> = Record<string, unknown>>(params: {
    agentType: AiAgentType;
    tenantId: string;
    input: TInput;
    overrideModel?: AiModel;
  }): string {
    const taskId = generateTaskId();
    const task: AiTask<TInput> = {
      id: taskId,
      agentType: params.agentType,
      tenantId: params.tenantId,
      input: params.input,
      status: 'pending',
      attempt: 0,
      maxAttempts: this.agents.get(params.agentType)?.maxAttempts ?? 3,
      createdAt: new Date().toISOString(),
    };
    this.taskStore.set(taskId, task as AiTask);

    // Non-blocking execution
    this.run(params).catch((err) => {
      console.error('[AiOrchestrator] Async task failed: %s', err);
    });

    return taskId;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  getTask(taskId: string): AiTask | undefined {
    return this.taskStore.get(taskId);
  }

  listTasks(filter?: { tenantId?: string; agentType?: AiAgentType; status?: AiTaskStatus; limit?: number }): AiTask[] {
    let tasks = Array.from(this.taskStore.values());
    if (filter?.tenantId) tasks = tasks.filter((t) => t.tenantId === filter.tenantId);
    if (filter?.agentType) tasks = tasks.filter((t) => t.agentType === filter.agentType);
    if (filter?.status) tasks = tasks.filter((t) => t.status === filter.status);
    return tasks
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, filter?.limit ?? 50);
  }

  /** Get usage stats for a tenant */
  getUsageStats(tenantId: string): {
    totalTasks: number;
    totalTokens: number;
    byAgent: Record<AiAgentType, { tasks: number; tokens: number }>;
    byModel: Record<AiModel, { tasks: number; tokens: number }>;
  } {
    const tenantLogs = this.usageLog.filter((u) => u.tenantId === tenantId);
    const byAgent: Record<string, { tasks: number; tokens: number }> = {};
    const byModel: Record<string, { tasks: number; tokens: number }> = {};
    let totalTokens = 0;

    for (const log of tenantLogs) {
      totalTokens += log.totalTokens;
      if (!byAgent[log.agentType]) byAgent[log.agentType] = { tasks: 0, tokens: 0 };
      byAgent[log.agentType].tasks++;
      byAgent[log.agentType].tokens += log.totalTokens;
      if (!byModel[log.model]) byModel[log.model] = { tasks: 0, tokens: 0 };
      byModel[log.model].tasks++;
      byModel[log.model].tokens += log.totalTokens;
    }

    return {
      totalTasks: tenantLogs.length,
      totalTokens,
      byAgent,
      byModel,
    };
  }

  listAgents(): AiAgentDefinition[] {
    return Array.from(this.agents.values());
  }

  listAdapters(): AiModel[] {
    return Array.from(this.adapters.keys());
  }
}

export const aiOrchestrator = new AiOrchestratorClass();

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Agent Definitions
// ─────────────────────────────────────────────────────────────────────────────

aiOrchestrator.registerAgent<{ leadId: string; leadData: string }, { score: number; reason: string; nextAction: string }>({
  type: 'lead_qualifier',
  name: 'Lead Qualifier Agent',
  description: 'Scores and qualifies CRM leads using AI analysis',
  preferredModel: 'gemini-2.0-flash',
  temperature: 0.1,
  maxAttempts: 2,
  systemPrompt: `Bạn là chuyên gia phân tích leads bất động sản. Phân tích thông tin khách hàng và trả về JSON.`,
  userPromptTemplate: `Phân tích lead sau và trả về JSON với format:
{"score": 0-100, "reason": "lý do ngắn gọn", "nextAction": "hành động tiếp theo"}

Thông tin lead:
{{leadData}}`,
  parseOutput: (response) => {
    const match = response.match(/\{[\s\S]*\}/);
    if (!match) return { score: 50, reason: 'Không thể phân tích', nextAction: 'Liên hệ trực tiếp' };
    return JSON.parse(match[0]);
  },
});

aiOrchestrator.registerAgent<{ documentText: string; documentType?: string }, string>({
  type: 'document_summarizer',
  name: 'Document Summarizer',
  description: 'Summarizes business documents in Vietnamese',
  preferredModel: 'gemini-2.0-flash',
  temperature: 0.3,
  systemPrompt: `Bạn là trợ lý tóm tắt tài liệu chuyên nghiệp. Tóm tắt ngắn gọn, chính xác bằng tiếng Việt.`,
  userPromptTemplate: `Tóm tắt tài liệu {{documentType}} sau trong 3-5 câu ngắn gọn:

{{documentText}}`,
  parseOutput: (response) => response.trim(),
});

aiOrchestrator.registerAgent<{ salaryData: string; employeeName: string }, string>({
  type: 'salary_explainer',
  name: 'Salary Explainer',
  description: 'Explains salary calculations to employees in plain language',
  preferredModel: 'gemini-2.0-flash',
  temperature: 0.4,
  systemPrompt: `Bạn là chuyên viên nhân sự. Giải thích bảng lương cho nhân viên bằng tiếng Việt dễ hiểu, thân thiện.`,
  userPromptTemplate: `Giải thích bảng lương tháng này cho {{employeeName}} dựa trên dữ liệu sau:
{{salaryData}}

Giải thích từng khoản một cách dễ hiểu.`,
  parseOutput: (response) => response.trim(),
});
