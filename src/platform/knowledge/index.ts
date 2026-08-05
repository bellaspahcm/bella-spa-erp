/**
 * @fileoverview Knowledge Engine — 5-Layer AI RAG Runtime
 *
 * The Knowledge Engine is NOT a simple CRUD database.
 * It is an AI Runtime that:
 *
 * Layer 1: Knowledge Sources   — Raw materials (SOP docs, ICD catalog, drug ATC)
 * Layer 2: Knowledge Graph     — Entity relationships (Drug-Disease-Procedure)
 * Layer 3: Knowledge Index     — Vector embeddings (pgvector) for semantic search
 * Layer 4: Knowledge Runtime   — RAG query executor: retrieves + ranks + prompts
 * Layer 5: Knowledge Ontology  — Semantic domain model (Healthcare/Auto/Real Estate ontologies)
 *
 * Key features:
 * - Versioning: Every entry has version + effective_from/to for audit replay
 * - Facts vs Inference: Separates static knowledge from reasoning rules
 * - Prompt Templates: Pre-built AI prompts using retrieved knowledge
 * - Ontology: Domain semantic model for AI contextual understanding
 *
 * @module platform/knowledge
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type KnowledgeDomain =
  | 'icd10'          // Disease classification
  | 'drug_atc'       // Drug catalog (WHO ATC codes)
  | 'sop'            // Standard Operating Procedures
  | 'clinical_rule'  // Clinical evidence-based rules
  | 'treatment_template' // Pre-built treatment plans
  | 'auto_repair'    // Auto repair procedures
  | 'legal_doc'      // Real estate legal documents
  | 'business_rule'  // Cross-vertical business rules
  | string;

export type InferenceTriggerType =
  | 'if_then'         // "If allergy to Penicillin THEN block Amoxicillin"
  | 'risk_score'      // "If age > 65 AND diabetes THEN high_risk_anesthesia"
  | 'constraint'      // "Prescription cannot exceed X mg/day for Y drug"
  | 'workflow_gate'   // "Implant surgery requires CT scan first"
  | string;

/** Layer 1: Raw knowledge fact (ICD code, drug, SOP, etc.) */
export interface KnowledgeEntry {
  readonly id: string;
  readonly tenantId: string;
  readonly vertical: string;
  readonly domain: KnowledgeDomain;
  readonly code: string;
  readonly label: string;
  readonly description?: string;
  // Versioning
  readonly version: string;
  readonly effectiveFrom: Date;
  readonly effectiveTo?: Date;
  readonly source?: string;
  readonly approvedBy?: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
}

/** Layer 2: Knowledge Graph edge — entity relationship */
export interface KnowledgeGraphEdge {
  readonly sourceCode: string;
  readonly sourceType: KnowledgeDomain;
  readonly targetCode: string;
  readonly targetType: KnowledgeDomain;
  readonly relationshipType: string; // 'contraindicated_with', 'requires', 'treats', 'causes'
  readonly strength?: number;       // confidence score 0-1
  readonly evidenceSource?: string;
}

/** Layer 1b: Inference Rule (Facts → Reasoning → Action) */
export interface InferenceRule {
  readonly id: string;
  readonly tenantId: string;
  readonly vertical: string;
  readonly code: string;
  readonly name: string;
  readonly triggerType: InferenceTriggerType;
  readonly conditions: Array<{
    readonly field: string;
    readonly operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'in' | 'not_in';
    readonly value: unknown;
  }>;
  readonly action: {
    readonly type: 'block' | 'warn' | 'require' | 'suggest' | 'calculate';
    readonly payload: Record<string, unknown>;
  };
  readonly version: string;
  readonly effectiveFrom: Date;
  readonly effectiveTo?: Date;
  readonly createdAt: Date;
}

/** Layer 4: Prompt Template for AI RAG */
export interface PromptTemplate {
  readonly id: string;
  readonly tenantId: string;
  readonly vertical: string;
  readonly code: string;
  readonly name: string;
  readonly systemPrompt: string;
  readonly userPromptTemplate: string;  // Mustache-style {{variable}} placeholders
  readonly requiredContext: string[];   // List of context keys needed
  readonly aiModel?: string;
  readonly version: string;
  readonly createdAt: Date;
}

/** Layer 5: Ontology term (semantic entity definition) */
export interface OntologyTerm {
  readonly id: string;
  readonly vertical: string;
  readonly termCode: string;
  readonly termLabel: string;
  readonly definition: string;
  readonly parentTermCode?: string;
  readonly synonyms: string[];
  readonly properties: Record<string, string>; // e.g. { 'dataType': 'date', 'unit': 'mg' }
  readonly createdAt: Date;
}

/** Semantic search result */
export interface KnowledgeSearchResult {
  readonly entry: KnowledgeEntry;
  readonly score: number;       // Cosine similarity 0-1
  readonly highlights?: string[];
}

/** Inference check result */
export interface InferenceCheckResult {
  readonly triggered: boolean;
  readonly rules: Array<{
    readonly rule: InferenceRule;
    readonly action: InferenceRule['action'];
  }>;
  readonly warnings: string[];
  readonly blockers: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// KNOWLEDGE ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export interface IKnowledgeRepository {
  // Layer 1: Facts
  createEntry(entry: Omit<KnowledgeEntry, 'id' | 'createdAt'>): Promise<KnowledgeEntry>;
  findEntryByCode(tenantId: string, vertical: string, domain: KnowledgeDomain, code: string, atDate?: Date): Promise<KnowledgeEntry | null>;
  // Layer 2: Graph
  addGraphEdge(tenantId: string, edge: KnowledgeGraphEdge): Promise<void>;
  getGraphNeighbors(tenantId: string, code: string, type: KnowledgeDomain): Promise<KnowledgeGraphEdge[]>;
  // Layer 3: Index (Vector Search)
  semanticSearch(tenantId: string, vertical: string, query: string, limit?: number): Promise<KnowledgeSearchResult[]>;
  // Layer 1b: Inference
  createInferenceRule(rule: Omit<InferenceRule, 'id' | 'createdAt'>): Promise<InferenceRule>;
  evaluateInference(tenantId: string, vertical: string, facts: Record<string, unknown>): Promise<InferenceCheckResult>;
  // Layer 4: Prompts
  findPromptTemplate(tenantId: string, vertical: string, code: string): Promise<PromptTemplate | null>;
  // Layer 5: Ontology
  findOntologyTerm(vertical: string, termCode: string): Promise<OntologyTerm | null>;
  getOntologyChildren(vertical: string, parentTermCode: string): Promise<OntologyTerm[]>;
}

/**
 * KnowledgeEngine — 5-Layer AI RAG Runtime.
 *
 * The brain of the platform. Used by AI Orchestrator to:
 * - Retrieve clinical guidelines, drug information, SOPs
 * - Check inference rules (drug contraindications, age limits)
 * - Build AI prompts with retrieved context (RAG)
 * - Provide ontology context for AI reasoning
 */
class KnowledgeEngine {
  private repository: IKnowledgeRepository | null = null;

  setRepository(repo: IKnowledgeRepository): void {
    this.repository = repo;
  }

  private get repo(): IKnowledgeRepository {
    if (!this.repository) {
      throw new Error('[KnowledgeEngine] Repository not initialized. Call setRepository() first via CompositionEngine.');
    }
    return this.repository;
  }

  // ─── Layer 1: Facts ─────────────────────────────────────────────────────

  /** Seed or update a knowledge entry (ICD code, drug, SOP) */
  async seedFact(entry: Omit<KnowledgeEntry, 'id' | 'createdAt'>): Promise<KnowledgeEntry> {
    return this.repo.createEntry(entry);
  }

  /** Look up a specific knowledge entry by domain code at a point in time */
  async lookupFact(
    tenantId: string,
    vertical: string,
    domain: KnowledgeDomain,
    code: string,
    atDate?: Date
  ): Promise<KnowledgeEntry | null> {
    return this.repo.findEntryByCode(tenantId, vertical, domain, code, atDate);
  }

  // ─── Layer 2: Knowledge Graph ────────────────────────────────────────────

  /** Define a relationship between two knowledge entities */
  async addRelation(tenantId: string, edge: KnowledgeGraphEdge): Promise<void> {
    return this.repo.addGraphEdge(tenantId, edge);
  }

  /** Get related entities (e.g. drugs that interact with a given drug) */
  async getRelations(tenantId: string, code: string, type: KnowledgeDomain): Promise<KnowledgeGraphEdge[]> {
    return this.repo.getGraphNeighbors(tenantId, code, type);
  }

  // ─── Layer 3: Semantic Search (Vector Index) ─────────────────────────────

  /** Semantic search across knowledge base using vector similarity */
  async search(
    tenantId: string,
    vertical: string,
    naturalLanguageQuery: string,
    limit = 10
  ): Promise<KnowledgeSearchResult[]> {
    return this.repo.semanticSearch(tenantId, vertical, naturalLanguageQuery, limit);
  }

  // ─── Layer 1b: Inference ─────────────────────────────────────────────────

  /**
   * Register an inference rule (e.g. drug contraindication rule).
   * "If patient is allergic to Penicillin → Block Amoxicillin prescription"
   */
  async registerInference(rule: Omit<InferenceRule, 'id' | 'createdAt'>): Promise<InferenceRule> {
    return this.repo.createInferenceRule(rule);
  }

  /**
   * Evaluate inference rules against a set of facts.
   * Returns warnings and blockers for the AI or workflow to act on.
   */
  async evaluateRules(
    tenantId: string,
    vertical: string,
    facts: Record<string, unknown>
  ): Promise<InferenceCheckResult> {
    return this.repo.evaluateInference(tenantId, vertical, facts);
  }

  // ─── Layer 4: Prompt Templates ───────────────────────────────────────────

  /** Get a prompt template for AI generation tasks */
  async getPromptTemplate(tenantId: string, vertical: string, code: string): Promise<PromptTemplate | null> {
    return this.repo.findPromptTemplate(tenantId, vertical, code);
  }

  // ─── Layer 5: Ontology ───────────────────────────────────────────────────

  /** Look up an ontology term definition for AI reasoning context */
  async getOntologyTerm(vertical: string, termCode: string): Promise<OntologyTerm | null> {
    return this.repo.findOntologyTerm(vertical, termCode);
  }

  /** Traverse ontology hierarchy (find sub-concepts) */
  async getOntologyChildren(vertical: string, parentTermCode: string): Promise<OntologyTerm[]> {
    return this.repo.getOntologyChildren(vertical, parentTermCode);
  }
}

export const knowledgeEngine = new KnowledgeEngine();
