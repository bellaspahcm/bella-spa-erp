/**
 * Circuit Breaker Pattern
 * 
 * Protects Decision Engine from cascading failures when audit DB is down.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failure threshold reached, requests fail fast
 * - HALF_OPEN: Testing if service recovered
 * 
 * Behavior:
 * - If audit DB fails repeatedly, open circuit
 * - Skip audit logging while circuit is open
 * - Business decisions continue normally
 * - Periodically test if DB recovered (half-open state)
 */

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerOptions {
  failureThreshold?: number; // Failures before opening circuit
  successThreshold?: number; // Successes to close circuit (from half-open)
  timeout?: number; // Time to wait before trying half-open (ms)
  monitoringWindowMs?: number; // Rolling window for failure tracking
}

interface CircuitMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  openedAt: number | null;
  halfOpenAt: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private openedAt: number | null = null;
  private halfOpenAt: number | null = null;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private failureTimestamps: number[] = [];

  constructor(private options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 10000, // 10 seconds
      monitoringWindowMs: 60000, // 1 minute
      ...options,
    };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      // Check if timeout elapsed
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenAt = Date.now();
        console.log('Circuit breaker: OPEN → HALF_OPEN (testing recovery)');
      } else {
        // Circuit still open, fail fast
        throw new CircuitBreakerOpenError(
          `Circuit breaker is OPEN. Last failure: ${this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : 'unknown'}`
        );
      }
    }

    // Attempt execution
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record successful execution
   */
  private onSuccess(): void {
    this.successes++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = Date.now();
    this.totalSuccesses++;

    if (this.state === CircuitState.HALF_OPEN) {
      // Check if enough successes to close circuit
      if (this.consecutiveSuccesses >= this.options.successThreshold!) {
        this.state = CircuitState.CLOSED;
        this.openedAt = null;
        this.halfOpenAt = null;
        this.consecutiveFailures = 0;
        console.log('Circuit breaker: HALF_OPEN → CLOSED (service recovered)');
      }
    }
  }

  /**
   * Record failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = Date.now();
    this.totalFailures++;

    // Track failures in rolling window
    this.failureTimestamps.push(Date.now());
    this.cleanupOldFailures();

    if (this.state === CircuitState.HALF_OPEN) {
      // Test failed, reopen circuit
      this.state = CircuitState.OPEN;
      this.openedAt = Date.now();
      this.halfOpenAt = null;
      console.warn('Circuit breaker: HALF_OPEN → OPEN (recovery test failed)');
    } else if (this.state === CircuitState.CLOSED) {
      // Check if threshold reached
      const recentFailures = this.getRecentFailureCount();
      if (recentFailures >= this.options.failureThreshold!) {
        this.state = CircuitState.OPEN;
        this.openedAt = Date.now();
        console.error(
          `Circuit breaker: CLOSED → OPEN (${recentFailures} failures in last ${this.options.monitoringWindowMs}ms)`
        );
      }
    }
  }

  /**
   * Check if circuit should attempt reset (OPEN → HALF_OPEN)
   */
  private shouldAttemptReset(): boolean {
    if (!this.openedAt) return false;
    const elapsed = Date.now() - this.openedAt;
    return elapsed >= this.options.timeout!;
  }

  /**
   * Get failure count in monitoring window
   */
  private getRecentFailureCount(): number {
    this.cleanupOldFailures();
    return this.failureTimestamps.length;
  }

  /**
   * Remove failures outside monitoring window
   */
  private cleanupOldFailures(): void {
    const cutoff = Date.now() - this.options.monitoringWindowMs!;
    this.failureTimestamps = this.failureTimestamps.filter((t) => t >= cutoff);
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Check if circuit is closed (healthy)
   */
  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Get metrics
   */
  getMetrics(): CircuitMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openedAt: this.openedAt,
      halfOpenAt: this.halfOpenAt,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Manually reset circuit (for testing or admin intervention)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.openedAt = null;
    this.halfOpenAt = null;
    this.failureTimestamps = [];
    console.log('Circuit breaker manually reset to CLOSED');
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    state: CircuitState;
    failureRate: number;
    recentFailures: number;
  } {
    const recentFailures = this.getRecentFailureCount();
    const failureRate =
      this.totalRequests > 0 ? (this.totalFailures / this.totalRequests) * 100 : 0;

    return {
      healthy: this.state === CircuitState.CLOSED,
      state: this.state,
      failureRate: parseFloat(failureRate.toFixed(2)),
      recentFailures,
    };
  }
}

/**
 * Custom error for circuit breaker open state
 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}
