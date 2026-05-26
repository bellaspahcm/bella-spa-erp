/**
 * PII Redactor
 *
 * Tự động che dữ liệu cá nhân (PII) khỏi log, Sentry events, console output
 * trước khi rời máy server. Bắt buộc theo Nghị định 13/2023 và 53/2022 về
 * bảo vệ dữ liệu cá nhân tại Việt Nam.
 *
 * Phạm vi che:
 *   - Số điện thoại VN (10 số, có/không 84/+84/0)
 *   - Email
 *   - CCCD / CMND (9 hoặc 12 số)
 *   - Số tài khoản ngân hàng (8-19 số liên tiếp ở vị trí "account-like")
 *   - Mã thẻ tín dụng (Luhn-ish patterns)
 *   - JWT token, Bearer token, API key có prefix
 *   - Tên trường nhạy cảm (password, secret, otp, token, authorization)
 *
 * Cách dùng:
 *   import { redact, safeStringify } from '@/lib/log-redactor'
 *   console.log(safeStringify({ phone: '0912345678' }))
 *   // -> '{"phone":"091****678"}'
 */

// IMPORTANT: order matters. Specific/long patterns must run BEFORE the generic
// phone pattern, otherwise "0123456789012345" (bank) gets mauled into a phone.
const PII_PATTERNS: Array<{ name: string; pattern: RegExp; replacer: (m: string) => string }> = [
  // JWT (3 base64 segments separated by dots) — very specific, run first
  {
    name: "jwt",
    pattern: /\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\b/g,
    replacer: () => "[REDACTED_JWT]",
  },
  // Bearer / API keys with common prefixes
  {
    name: "bearer",
    pattern: /\b(Bearer|Basic|Token|sk-|pk-|sbp_|sbu_|sk_live_|sk_test_)[\s]?[A-Za-z0-9_\-\.=]{16,}/gi,
    replacer: (m) => {
      const prefix = m.split(/[\s_\-]/)[0];
      return `${prefix} [REDACTED_KEY]`;
    },
  },
  // Email
  {
    name: "email",
    pattern: /([A-Za-z0-9._%+\-]{1,64})@([A-Za-z0-9.\-]{1,255}\.[A-Za-z]{2,24})/g,
    replacer: (_m) => {
      const parts = _m.split("@");
      const [local, domain] = parts;
      if (!local || !domain) return _m;
      const head = local.slice(0, 1);
      const tail = local.length > 2 ? local.slice(-1) : "";
      return `${head}***${tail}@${domain}`;
    },
  },
  // Bank account / long numeric (13-19 digits) — run BEFORE phone & CCCD
  // so it consumes long digit runs first.
  {
    name: "bank_account",
    pattern: /(?<!\d)\d{13,19}(?!\d)/g,
    replacer: (m) => `${m.slice(0, 4)}****${m.slice(-4)}`,
  },
  // CCCD 12 digits / CMND 9 digits, with no-digit boundary so they don't
  // overlap with bank account or longer numbers.
  {
    name: "cccd_cmnd",
    pattern: /(?<!\d)(\d{9}|\d{12})(?!\d)/g,
    replacer: (m) => {
      if (m.length === 9) return `${m.slice(0, 3)}***${m.slice(-2)}`;
      if (m.length === 12) return `${m.slice(0, 3)}******${m.slice(-2)}`;
      return m;
    },
  },
  // Vietnamese phone: +84 / 84 / 0 prefix + 9 digits. Boundary lookarounds
  // prevent matching inside longer numeric strings (bank/CCCD already handled
  // above but boundaries make this regex safe in isolation too).
  {
    name: "vn_phone",
    pattern: /(?<![\d])(?:\+?84|0)[\s.\-]?(\d{2,3})[\s.\-]?(\d{3,4})[\s.\-]?(\d{3,4})(?![\d])/g,
    replacer: (m) => {
      const digits = m.replace(/\D/g, "");
      if (digits.length < 9 || digits.length > 12) return m;
      const tail = digits.slice(-3);
      const head = digits.slice(0, 3);
      return `${head}****${tail}`;
    },
  },
];

const SENSITIVE_KEYS = new Set([
  "password",
  "pwd",
  "passwd",
  "secret",
  "api_key",
  "apikey",
  "access_token",
  "refresh_token",
  "id_token",
  "authorization",
  "auth",
  "token",
  "otp",
  "totp",
  "mfa_code",
  "verification_code",
  "credit_card",
  "card_number",
  "cvv",
  "cvc",
  "ssn",
  "cccd",
  "cmnd",
  "bank_account",
  "account_number",
  "service_role_key",
  "private_key",
  "client_secret",
  "supabase_service_role_key",
  "next_public_supabase_anon_key",
]);

/**
 * Apply regex-based PII redaction on a string.
 */
export function redactString(input: string): string {
  if (typeof input !== "string" || input.length === 0) return input;
  let out = input;
  for (const { pattern, replacer } of PII_PATTERNS) {
    out = out.replace(pattern, replacer);
  }
  return out;
}

/**
 * Deep-redact an object/array. Sensitive keys are masked entirely; string
 * values pass through regex redaction. Cycles are detected with a WeakSet.
 */
export function redact<T>(value: T, _seen: WeakSet<object> = new WeakSet()): T {
  if (value == null) return value;

  if (typeof value === "string") {
    return redactString(value) as unknown as T;
  }

  if (typeof value !== "object") return value;

  if (_seen.has(value as object)) {
    return "[Circular]" as unknown as T;
  }
  _seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => redact(v, _seen)) as unknown as T;
  }

  // Plain object
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const lk = k.toLowerCase();
    if (SENSITIVE_KEYS.has(lk)) {
      out[k] = "[REDACTED]";
      continue;
    }
    // Heuristic: any key containing "password"/"secret"/"token"
    if (/password|secret|token|api[_-]?key|authorization/i.test(k)) {
      out[k] = "[REDACTED]";
      continue;
    }
    out[k] = redact(v, _seen);
  }
  return out as unknown as T;
}

/**
 * JSON.stringify replacement that also redacts PII.
 */
export function safeStringify(value: unknown, space?: number): string {
  try {
    return JSON.stringify(redact(value), null, space);
  } catch {
    return "[Unserializable]";
  }
}

/**
 * Sentry beforeSend hook. Redacts PII from event message, breadcrumbs,
 * extra, contexts, request body/headers/cookies/query, and user fields.
 */
// Loose typing: Sentry Event has many optional fields with union/literal types
// that conflict with generic narrowing. Using `any` here is intentional and
// safe because the function only mutates known fields and is wrapped in try.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sentryBeforeSend<T extends Record<string, any> = any>(event: T): T {
  const ev = event as any;
  try {
    // Strip user PII entirely
    if (ev.user && typeof ev.user === "object") {
      delete ev.user.email;
      delete ev.user.ip_address;
      delete ev.user.phone;
      // Keep only id + username
      const allow = new Set(["id", "username"]);
      for (const k of Object.keys(ev.user)) {
        if (!allow.has(k)) delete ev.user[k];
      }
    }

    if (typeof ev.message === "string") {
      ev.message = redactString(ev.message);
    }

    // Request: headers, cookies, query, data
    if (ev.request && typeof ev.request === "object") {
      const req = ev.request;
      if (req.headers) {
        for (const h of Object.keys(req.headers)) {
          if (/authorization|cookie|x-api-key|x-supabase/i.test(h)) {
            req.headers[h] = "[REDACTED]";
          } else if (typeof req.headers[h] === "string") {
            req.headers[h] = redactString(req.headers[h]);
          }
        }
      }
      if (req.cookies) req.cookies = "[REDACTED]";
      if (typeof req.query_string === "string") {
        req.query_string = redactString(req.query_string);
      }
      if (req.data !== undefined) req.data = redact(req.data);
    }

    if (Array.isArray(ev.breadcrumbs)) {
      ev.breadcrumbs = ev.breadcrumbs.map((b: any) => {
        if (b && typeof b === "object") {
          if (typeof b.message === "string") b.message = redactString(b.message);
          if (b.data) b.data = redact(b.data);
        }
        return b;
      });
    }

    if (ev.extra) ev.extra = redact(ev.extra);
    if (ev.contexts) ev.contexts = redact(ev.contexts);
    if (ev.tags) ev.tags = redact(ev.tags);

    if (ev.exception && typeof ev.exception === "object") {
      const values = ev.exception.values;
      if (Array.isArray(values)) {
        for (const ex of values) {
          if (ex && typeof ex.value === "string") {
            ex.value = redactString(ex.value);
          }
        }
      }
    }
  } catch {
    // Never crash the logger
  }
  return event;
}
