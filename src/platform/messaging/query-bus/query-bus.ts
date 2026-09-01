export interface Query<TPayload = unknown> {
  readonly name: string;
  readonly payload: TPayload;
}

export type QueryHandler<TQuery extends Query = Query, TResult = unknown> = (
  query: TQuery
) => Promise<TResult> | TResult;

export class QueryBus {
  private static instance: QueryBus;
  private handlers: Map<string, QueryHandler<Query, unknown>> = new Map();

  private constructor() {}

  public static getInstance(): QueryBus {
    if (!QueryBus.instance) {
      QueryBus.instance = new QueryBus();
    }
    return QueryBus.instance;
  }

  public register<TQuery extends Query, TResult>(
    queryName: string,
    handler: QueryHandler<TQuery, TResult>
  ): () => void {
    if (this.handlers.has(queryName)) {
      throw new Error(`[QueryBus] Duplicate handler registered for query: "${queryName}"`);
    }
    this.handlers.set(queryName, handler as QueryHandler<Query, unknown>);

    return () => {
      this.handlers.delete(queryName);
    };
  }

  public async execute<TQuery extends Query, TResult = unknown>(
    query: TQuery
  ): Promise<TResult> {
    const handler = this.handlers.get(query.name);
    if (!handler) {
      throw new Error(`[QueryBus] No handler registered for query: "${query.name}"`);
    }

    try {
      return await handler(query) as TResult;
    } catch (err: unknown) {
      console.error(`[QueryBus Error] Failed executing query %s:`, query.name, err);
      throw err;
    }
  }
}

export const queryBus = QueryBus.getInstance();
