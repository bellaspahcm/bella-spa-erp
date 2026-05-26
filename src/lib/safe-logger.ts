/**
 * Safe Logger
 *
 * Wrapper quanh console với PII redaction tự động.
 *
 * Cách dùng:
 *   import { logger } from '@/lib/safe-logger'
 *   logger.error('Booking failed', { phone: '0912345678', error })
 *
 * Sẽ in ra: 'Booking failed { phone: "091****678", error: ... }'
 *
 * KHÔNG dùng console.log/error trực tiếp ở server actions hoặc API routes
 * khi log có thể chứa input của khách hàng (phone, email, address...).
 */

import { redact, redactString } from "./log-redactor";

type LogLevel = "debug" | "info" | "warn" | "error";

function format(args: unknown[]): unknown[] {
  return args.map((a) => {
    if (typeof a === "string") return redactString(a);
    if (a instanceof Error) {
      return {
        name: a.name,
        message: redactString(a.message),
        stack: a.stack ? redactString(a.stack) : undefined,
      };
    }
    return redact(a);
  });
}

function emit(level: LogLevel, args: unknown[]): void {
  const safe = format(args);
  switch (level) {
    case "debug":
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug(...safe);
      }
      break;
    case "info":
      // eslint-disable-next-line no-console
      console.info(...safe);
      break;
    case "warn":
      // eslint-disable-next-line no-console
      console.warn(...safe);
      break;
    case "error":
      // eslint-disable-next-line no-console
      console.error(...safe);
      break;
  }
}

export const logger = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};
