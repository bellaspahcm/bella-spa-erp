type ConflictDecision = {
  decision: 'APPROVE' | 'REJECT' | 'APPROVE_WITH_WARNING';
  message: string;
  context?: Record<string, unknown>;
};

export const CREATE_SCHEDULE_CONFLICT_TIMEOUT_MS = 1200;

export async function withCreateScheduleConflictTimeout<TDecision extends ConflictDecision>(
  operation: () => Promise<TDecision>,
  timeoutMs = CREATE_SCHEDULE_CONFLICT_TIMEOUT_MS,
): Promise<TDecision> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      operation(),
      new Promise<TDecision>((resolve) => {
        timeoutId = setTimeout(() => {
          resolve({
            decision: 'APPROVE',
            message: 'Booking approved (conflict check timeout fail-open)',
            context: {
              timeoutMs,
              operation: 'checkBookingConflicts',
            },
          } as TDecision);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
