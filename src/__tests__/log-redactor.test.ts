import {
  redact,
  redactString,
  safeStringify,
  sentryBeforeSend,
} from "@/lib/log-redactor";

describe("log-redactor: redactString", () => {
  it("masks Vietnamese mobile numbers (0xx prefix)", () => {
    const out = redactString("Khách hàng số 0912345678 đặt lịch");
    expect(out).not.toContain("0912345678");
    expect(out).toMatch(/091\*+\d{3}/);
  });

  it("masks Vietnamese mobile with +84 prefix", () => {
    const out = redactString("Hotline +84912345678");
    expect(out).not.toContain("912345678");
  });

  it("masks Vietnamese mobile with spaces and dashes", () => {
    const out = redactString("SĐT: 091-234 5678");
    expect(out).not.toContain("091-234 5678");
  });

  it("masks emails", () => {
    const out = redactString("Mẹ bé liên hệ: nguyenthi.an@gmail.com");
    expect(out).not.toContain("nguyenthi.an@gmail.com");
    expect(out).toMatch(/n\*+n?@gmail\.com/);
  });

  it("masks CCCD (12 digits)", () => {
    const out = redactString("CCCD 001234567890 đã xác minh");
    expect(out).not.toContain("001234567890");
    expect(out).toContain("001******90");
  });

  it("masks CMND (9 digits)", () => {
    const out = redactString("CMND 012345678 cấp năm 2015");
    expect(out).not.toContain("012345678");
  });

  it("masks long bank account numbers", () => {
    const out = redactString("STK: 0123456789012345 ngân hàng VCB");
    expect(out).not.toContain("0123456789012345");
    expect(out).toMatch(/0123\*+2345/);
  });

  it("masks JWT tokens", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const out = redactString(`Authorization: Bearer ${jwt}`);
    expect(out).not.toContain(jwt);
    expect(out).toContain("[REDACTED_JWT]");
  });

  it("returns empty/undefined safely", () => {
    expect(redactString("")).toBe("");
    // @ts-expect-error testing runtime guard
    expect(redactString(undefined)).toBe(undefined);
  });
});

describe("log-redactor: redact (deep)", () => {
  it("masks sensitive keys entirely", () => {
    const out = redact({
      password: "supersecret",
      api_key: "abc",
      authorization: "Bearer x",
      nested: { otp: "123456", clean: "ok" },
    });
    expect(out.password).toBe("[REDACTED]");
    expect(out.api_key).toBe("[REDACTED]");
    expect(out.authorization).toBe("[REDACTED]");
    expect(out.nested.otp).toBe("[REDACTED]");
    expect(out.nested.clean).toBe("ok");
  });

  it("masks keys matching heuristic (case-insensitive)", () => {
    const out = redact({
      MyPassword: "x",
      accessToken: "y",
      SECRET_KEY: "z",
    });
    expect(out.MyPassword).toBe("[REDACTED]");
    expect(out.accessToken).toBe("[REDACTED]");
    expect(out.SECRET_KEY).toBe("[REDACTED]");
  });

  it("masks operational secret fields used by integrations", () => {
    const out = redact({
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_live_123456789",
      PAYMENT_WEBHOOK_SECRET: "webhook-secret-value",
      TELEGRAM_WEBHOOK_SECRET: "telegram-secret-value",
      telegram_bot_token: "123456789:AAExampleTelegramBotToken",
      nested: {
        client_secret: "client-secret-value",
        refresh_token: "refresh-token-value",
      },
    });

    expect(out.SUPABASE_SERVICE_ROLE_KEY).toBe("[REDACTED]");
    expect(out.PAYMENT_WEBHOOK_SECRET).toBe("[REDACTED]");
    expect(out.TELEGRAM_WEBHOOK_SECRET).toBe("[REDACTED]");
    expect(out.telegram_bot_token).toBe("[REDACTED]");
    expect(out.nested.client_secret).toBe("[REDACTED]");
    expect(out.nested.refresh_token).toBe("[REDACTED]");
  });

  it("walks arrays and redacts string values", () => {
    const out = redact({
      bookings: [
        { phone: "0912345678", note: "ok" },
        { phone: "0987654321", note: "VIP" },
      ],
    });
    expect(JSON.stringify(out)).not.toContain("0912345678");
    expect(JSON.stringify(out)).not.toContain("0987654321");
    expect(out.bookings[1].note).toBe("VIP");
  });

  it("handles circular references", () => {
    const a: any = { name: "loop" };
    a.self = a;
    expect(() => redact(a)).not.toThrow();
  });

  it("safeStringify produces valid JSON without PII", () => {
    const s = safeStringify({
      customer: { phone: "0912345678", email: "a@b.com" },
    });
    expect(() => JSON.parse(s)).not.toThrow();
    expect(s).not.toContain("0912345678");
    expect(s).not.toContain("a@b.com");
  });
});

describe("log-redactor: sentryBeforeSend", () => {
  it("strips user PII fields", () => {
    const ev: any = {
      user: { id: "u1", email: "a@b.com", ip_address: "1.2.3.4", phone: "0912345678" },
    };
    const out = sentryBeforeSend(ev);
    expect(out.user.id).toBe("u1");
    expect(out.user.email).toBeUndefined();
    expect(out.user.ip_address).toBeUndefined();
    expect(out.user.phone).toBeUndefined();
  });

  it("redacts request headers and cookies", () => {
    const ev: any = {
      request: {
        headers: {
          authorization: "Bearer abcdef1234567890",
          "x-api-key": "secret-key",
          "user-agent": "Mozilla/5.0",
        },
        cookies: "session=xyz",
        query_string: "phone=0912345678&id=1",
        data: { password: "x", phone: "0912345678" },
      },
    };
    const out = sentryBeforeSend(ev);
    expect(out.request.headers.authorization).toBe("[REDACTED]");
    expect(out.request.headers["x-api-key"]).toBe("[REDACTED]");
    expect(out.request.cookies).toBe("[REDACTED]");
    expect(out.request.query_string).not.toContain("0912345678");
    expect(out.request.data.password).toBe("[REDACTED]");
    expect(JSON.stringify(out.request.data)).not.toContain("0912345678");
  });

  it("redacts exception messages", () => {
    const ev: any = {
      exception: {
        values: [
          { value: "Failed booking for 0912345678 / a@b.com" },
        ],
      },
    };
    const out = sentryBeforeSend(ev);
    expect(out.exception.values[0].value).not.toContain("0912345678");
    expect(out.exception.values[0].value).not.toContain("a@b.com");
  });

  it("never throws on malformed events", () => {
    expect(() => sentryBeforeSend({} as any)).not.toThrow();
    expect(() => sentryBeforeSend({ message: "hello" } as any)).not.toThrow();
  });
});
