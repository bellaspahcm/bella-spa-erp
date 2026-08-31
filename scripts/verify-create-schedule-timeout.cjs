const { performance } = require('node:perf_hooks');
require('ts-node/register/transpile-only');
require('tsconfig-paths/register');

const {
  withCreateScheduleConflictTimeout,
} = require('../src/app/dashboard/bookings/utils/createScheduleDecisionTimeout');

async function measure(label, operation) {
  const start = performance.now();
  const result = await operation();
  const durationMs = Math.round(performance.now() - start);
  console.log(JSON.stringify({ label, durationMs, result }));
  return { durationMs, result };
}

async function main() {
  const fastReject = await measure('fast-conflict-reject', () =>
    withCreateScheduleConflictTimeout(
      async () => ({
        decision: 'REJECT',
        message: 'KTV da co lich trung thoi gian',
        context: { conflicts: [{ type: 'ktv_double_booking' }] },
      }),
      1200,
    ),
  );

  if (fastReject.result.decision !== 'REJECT') {
    throw new Error('Fast conflict was not preserved as REJECT');
  }

  const timeoutOpen = await measure('slow-conflict-timeout-fail-open', () =>
    withCreateScheduleConflictTimeout(
      () => new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            decision: 'REJECT',
            message: 'Late conflict result should not block critical save path',
          });
        }, 500);
      }),
      50,
    ),
  );

  if (timeoutOpen.result.decision !== 'APPROVE') {
    throw new Error('Timeout did not fail open to APPROVE');
  }

  if (timeoutOpen.durationMs > 250) {
    throw new Error(`Timeout took too long: ${timeoutOpen.durationMs}ms`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
