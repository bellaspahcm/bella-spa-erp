/**
 * Tests cho Zod schemas trong src/lib/validations.ts.
 * Đảm bảo validation contract giữa form + server action ổn định.
 */

import { customerSchema, bookingSchema } from "@/lib/validations";

// ═════════════════════════════════════════════════════════════════════════════
// customerSchema
// ═════════════════════════════════════════════════════════════════════════════
describe("validations: customerSchema", () => {
  it("ok with minimum required (phone + name_mother)", () => {
    const r = customerSchema.safeParse({
      phone: "0912345678",
      name_mother: "Nguyễn Thị An",
    });
    expect(r.success).toBe(true);
  });

  it("rejects when phone too short", () => {
    const r = customerSchema.safeParse({
      phone: "091234",
      name_mother: "Nguyễn Thị An",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/không hợp lệ/);
      expect(r.error.issues[0].path).toEqual(["phone"]);
    }
  });

  it("rejects when name_mother too short (< 2 chars)", () => {
    const r = customerSchema.safeParse({
      phone: "0912345678",
      name_mother: "A",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/Tên mẹ/);
      expect(r.error.issues[0].path).toEqual(["name_mother"]);
    }
  });

  it("rejects when phone missing", () => {
    const r = customerSchema.safeParse({ name_mother: "Nguyễn Thị An" } as any);
    expect(r.success).toBe(false);
  });

  it("rejects when name_mother missing", () => {
    const r = customerSchema.safeParse({ phone: "0912345678" } as any);
    expect(r.success).toBe(false);
  });

  it("accepts optional fields (baby info, address, notes)", () => {
    const r = customerSchema.safeParse({
      phone: "0912345678",
      name_mother: "Nguyễn Thị An",
      name_baby: "Bé Bo",
      address: "123 Trần Hưng Đạo, Q1, HCM",
      notes: "Dị ứng tinh dầu sả",
      dob_baby: "2025-12-25",
      dob_expected: "2026-08-15",
      gender_baby: "boy",
    });
    expect(r.success).toBe(true);
  });

  it("accepts deposit_amount as string or number", () => {
    expect(
      customerSchema.safeParse({
        phone: "0912345678",
        name_mother: "An",
        deposit_amount: "5000000",
      }).success,
    ).toBe(true);
    expect(
      customerSchema.safeParse({
        phone: "0912345678",
        name_mother: "An",
        deposit_amount: 5_000_000,
      }).success,
    ).toBe(true);
  });

  it("accepts long address (no max enforced)", () => {
    const r = customerSchema.safeParse({
      phone: "0912345678",
      name_mother: "An",
      address: "x".repeat(2000),
    });
    expect(r.success).toBe(true);
  });

  it("ignores unknown fields silently (default Zod behavior)", () => {
    const r = customerSchema.safeParse({
      phone: "0912345678",
      name_mother: "An",
      foo_bar_baz: "extra field that schema doesn't define",
    } as Record<string, unknown>);
    expect(r.success).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// bookingSchema
// ═════════════════════════════════════════════════════════════════════════════
describe("validations: bookingSchema", () => {
  const baseValid = {
    customer_id: "cust-001",
    full_price: 21_000_000,
    deposit_amount: 5_000_000,
    total_sessions: 21,
  };

  it("ok with minimum required fields", () => {
    const r = bookingSchema.safeParse(baseValid);
    expect(r.success).toBe(true);
  });

  it("coerces string numbers (full_price, deposit, sessions)", () => {
    const r = bookingSchema.safeParse({
      customer_id: "cust-001",
      full_price: "21000000",
      deposit_amount: "5000000",
      total_sessions: "21",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.full_price).toBe(21_000_000);
      expect(r.data.deposit_amount).toBe(5_000_000);
      expect(r.data.total_sessions).toBe(21);
    }
  });

  it("rejects negative full_price", () => {
    const r = bookingSchema.safeParse({ ...baseValid, full_price: -1 });
    expect(r.success).toBe(false);
  });

  it("rejects negative deposit_amount", () => {
    const r = bookingSchema.safeParse({ ...baseValid, deposit_amount: -500_000 });
    expect(r.success).toBe(false);
  });

  it("allows deposit = 0 (lead inquiry no deposit yet)", () => {
    const r = bookingSchema.safeParse({ ...baseValid, deposit_amount: 0 });
    expect(r.success).toBe(true);
  });

  it("rejects total_sessions < 1", () => {
    const r = bookingSchema.safeParse({ ...baseValid, total_sessions: 0 });
    expect(r.success).toBe(false);
  });

  it("rejects non-integer total_sessions", () => {
    const r = bookingSchema.safeParse({ ...baseValid, total_sessions: 5.5 });
    expect(r.success).toBe(false);
  });

  it("defaults total_sessions to 15 when omitted", () => {
    const r = bookingSchema.safeParse({
      customer_id: "cust-001",
      full_price: 21_000_000,
      deposit_amount: 5_000_000,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.total_sessions).toBe(15);
  });

  it("accepts customer_id as number (legacy support)", () => {
    const r = bookingSchema.safeParse({ ...baseValid, customer_id: 42 });
    expect(r.success).toBe(true);
  });

  it("rejects missing customer_id", () => {
    const r = bookingSchema.safeParse({
      full_price: 21_000_000,
      deposit_amount: 5_000_000,
    } as any);
    expect(r.success).toBe(false);
  });

  it("accepts optional ktv_commission, discount_percent", () => {
    const r = bookingSchema.safeParse({
      ...baseValid,
      ktv_commission: "150000",
      discount_percent: "10",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.ktv_commission).toBe(150_000);
      expect(r.data.discount_percent).toBe(10);
    }
  });

  it("rejects discount_percent outside the 0-100 range", () => {
    expect(bookingSchema.safeParse({ ...baseValid, discount_percent: -1 }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...baseValid, discount_percent: 101 }).success).toBe(false);
  });

  it("rejects non-numeric full_price", () => {
    const r = bookingSchema.safeParse({ ...baseValid, full_price: "abc" });
    expect(r.success).toBe(false);
  });

  it("accepts optional preferred_time as string", () => {
    const r = bookingSchema.safeParse({ ...baseValid, preferred_time: "09:00" });
    expect(r.success).toBe(true);
  });
});
