/**
 * AI Capability Pack Contract
 * Encapsulates Prompts, Decision Trees, Knowledge Domains, and Agent Tools per Product Plugin.
 * ZERO `any` allowed.
 */

export interface AIToolDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly parametersSchema: Readonly<Record<string, unknown>>;
  readonly execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export interface AICapabilityPack {
  readonly id: string;
  readonly name: string;
  readonly knowledgeDomain: string;
  readonly prompts: Readonly<Record<string, string>>;
  readonly decisionRules?: Readonly<Record<string, unknown>>;
  readonly tools: readonly AIToolDefinition[];
}
