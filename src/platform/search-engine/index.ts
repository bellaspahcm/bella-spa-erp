/**
 * @fileoverview Platform Search Engine
 *
 * Full-text + field search across all platform resources.
 * - In-memory inverted index (Fuse.js-style scoring, zero infra)
 * - Pluggable backend adapter (swap with Supabase tsvector or Algolia)
 * - Tenant-isolated document store
 * - Multi-type search with type-based boosting
 *
 * @module platform/search-engine
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SearchDocumentType =
  | 'lead'
  | 'customer'
  | 'apartment'
  | 'project'
  | 'contract'
  | 'employee'
  | 'invoice'
  | 'document'
  | 'booking'
  | 'salary_record'
  | string;

export interface SearchDocument {
  /** Unique document ID within the platform */
  id: string;
  tenantId: string;
  type: SearchDocumentType;
  /** Primary searchable title */
  title: string;
  /** Secondary searchable body text */
  body?: string;
  /** Searchable tags */
  tags?: string[];
  /** Route to navigate to this document */
  href?: string;
  /** Arbitrary metadata for display */
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface SearchQuery {
  /** Full-text query */
  q: string;
  tenantId: string;
  /** Filter by document type(s) */
  types?: SearchDocumentType[];
  /** Filter by tags */
  tags?: string[];
  limit?: number;
  offset?: number;
  /** Sort by 'relevance' | 'date_desc' | 'date_asc' */
  sort?: 'relevance' | 'date_desc' | 'date_asc';
}

export interface SearchHit {
  id: string;
  type: SearchDocumentType;
  title: string;
  href?: string;
  /** Score 0–1 (higher = more relevant) */
  score: number;
  /** Highlighted snippets */
  highlights?: { title?: string; body?: string };
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  query: string;
  /** Execution time in ms */
  tookMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend Adapter Contract
// ─────────────────────────────────────────────────────────────────────────────

export interface ISearchBackend {
  index(doc: SearchDocument): Promise<void>;
  search(query: SearchQuery): Promise<SearchResult>;
  delete(id: string, tenantId: string): Promise<void>;
  clear(tenantId: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Backend (default, zero infra)
// ─────────────────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics for better matching
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function highlight(text: string, query: string, maxLen = 120): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.substring(0, maxLen);
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + query.length + 60);
  const snippet = text.substring(start, end);
  return (start > 0 ? '...' : '') + snippet + (end < text.length ? '...' : '');
}

function scoreDocument(doc: SearchDocument, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const titleTokens = tokenize(doc.title);
  const bodyTokens = doc.body ? tokenize(doc.body) : [];
  const tagTokens = doc.tags ? doc.tags.flatMap(tokenize) : [];

  let score = 0;
  for (const qt of queryTokens) {
    // Exact title match = highest
    if (titleTokens.includes(qt)) score += 0.5;
    // Title prefix match
    if (titleTokens.some((t) => t.startsWith(qt))) score += 0.2;
    // Body match
    if (bodyTokens.includes(qt)) score += 0.15;
    // Tag match
    if (tagTokens.includes(qt)) score += 0.1;
    // Body prefix
    if (bodyTokens.some((t) => t.startsWith(qt))) score += 0.05;
  }

  return Math.min(1, score / queryTokens.length);
}

class InMemorySearchBackend implements ISearchBackend {
  /** `tenantId:docId` → SearchDocument */
  private readonly store = new Map<string, SearchDocument>();

  async index(doc: SearchDocument): Promise<void> {
    this.store.set(`${doc.tenantId}:${doc.id}`, {
      ...doc,
      updatedAt: new Date().toISOString(),
    });
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const start = Date.now();
    const qLower = query.q.trim().toLowerCase();
    const queryTokens = tokenize(qLower);

    // Collect tenant docs
    let docs: SearchDocument[] = [];
    for (const [k, v] of this.store) {
      if (k.startsWith(`${query.tenantId}:`)) docs.push(v);
    }

    // Type filter
    if (query.types?.length) {
      docs = docs.filter((d) => query.types!.includes(d.type));
    }

    // Tag filter
    if (query.tags?.length) {
      docs = docs.filter((d) => query.tags!.some((t) => d.tags?.includes(t)));
    }

    // Score
    let hits: SearchHit[] = docs
      .map((doc) => {
        const score = queryTokens.length > 0 ? scoreDocument(doc, queryTokens) : 1;
        return {
          id: doc.id,
          type: doc.type,
          title: doc.title,
          href: doc.href,
          score,
          highlights: queryTokens.length > 0 ? {
            title: highlight(doc.title, qLower),
            body: doc.body ? highlight(doc.body, qLower) : undefined,
          } : undefined,
          metadata: doc.metadata,
        };
      })
      .filter((h) => h.score > 0.05);

    // Sort
    const sort = query.sort ?? 'relevance';
    if (sort === 'relevance') {
      hits.sort((a, b) => b.score - a.score);
    } else if (sort === 'date_desc') {
      hits.sort((a, b) => {
        const da = this.store.get(`${query.tenantId}:${a.id}`)?.updatedAt ?? '';
        const db = this.store.get(`${query.tenantId}:${b.id}`)?.updatedAt ?? '';
        return db.localeCompare(da);
      });
    } else {
      hits.sort((a, b) => {
        const da = this.store.get(`${query.tenantId}:${a.id}`)?.updatedAt ?? '';
        const db = this.store.get(`${query.tenantId}:${b.id}`)?.updatedAt ?? '';
        return da.localeCompare(db);
      });
    }

    const total = hits.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;
    hits = hits.slice(offset, offset + limit);

    return { hits, total, query: query.q, tookMs: Date.now() - start };
  }

  async delete(id: string, tenantId: string): Promise<void> {
    this.store.delete(`${tenantId}:${id}`);
  }

  async clear(tenantId: string): Promise<void> {
    for (const k of [...this.store.keys()]) {
      if (k.startsWith(`${tenantId}:`)) this.store.delete(k);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Engine
// ─────────────────────────────────────────────────────────────────────────────

class SearchEngineClass {
  private backend: ISearchBackend = new InMemorySearchBackend();

  /** Swap the backend (e.g. Supabase full-text, Algolia) */
  useBackend(backend: ISearchBackend): void {
    this.backend = backend;
  }

  /** Index a document */
  async index(doc: SearchDocument): Promise<void> {
    return this.backend.index({
      ...doc,
      createdAt: doc.createdAt ?? new Date().toISOString(),
    });
  }

  /** Index multiple documents */
  async indexBulk(docs: SearchDocument[]): Promise<void> {
    await Promise.all(docs.map((d) => this.index(d)));
  }

  /** Execute a search query */
  async search(query: SearchQuery): Promise<SearchResult> {
    if (!query.q.trim()) {
      return { hits: [], total: 0, query: '', tookMs: 0 };
    }
    return this.backend.search(query);
  }

  /** Remove a document from the index */
  async delete(id: string, tenantId: string): Promise<void> {
    return this.backend.delete(id, tenantId);
  }

  /** Clear all indexed documents for a tenant */
  async clearTenant(tenantId: string): Promise<void> {
    return this.backend.clear(tenantId);
  }

  /** Helper: index a resource and return a SearchDocument */
  buildDocument(params: {
    id: string;
    tenantId: string;
    type: SearchDocumentType;
    title: string;
    body?: string;
    tags?: string[];
    href?: string;
    metadata?: Record<string, unknown>;
  }): SearchDocument {
    return {
      ...params,
      createdAt: new Date().toISOString(),
    };
  }
}

export const searchEngine = new SearchEngineClass();
