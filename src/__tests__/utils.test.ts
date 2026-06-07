/**
 * Tests cho utility functions trong src/lib/utils.ts.
 * Đây là helpers dùng xuyên suốt forms — cần ổn định 100%.
 */

import {
  cn,
  formatCurrency,
  formatMoneyInput,
  parseCurrency,
  parseIntegerInput,
  parseMoneyInput,
  parsePercentInput,
  formatNumberWithSeparator,
  resolvePackageName,
  getLocalDateString,
  getMonthStart,
  sanitizeTime,
} from "@/lib/utils";

// ═════════════════════════════════════════════════════════════════════════════
// cn — class name merger (twMerge + clsx)
// ═════════════════════════════════════════════════════════════════════════════
describe("utils: cn", () => {
  it("merges plain strings", () => {
    expect(cn("a", "b")).toBe("a b");
  });
  it("ignores falsy values", () => {
    expect(cn("a", null, undefined, false, "b")).toBe("a b");
  });
  it("conditional via object map", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });
  it("tailwind-merge dedupes conflicting classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm font-bold", "text-lg")).toBe("font-bold text-lg");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// formatCurrency — VND format
// ═════════════════════════════════════════════════════════════════════════════
describe("utils: formatCurrency", () => {
  it("formats integers with vi-VN dots", () => {
    expect(formatCurrency(1_000_000)).toBe("1.000.000");
    expect(formatCurrency(50_000)).toBe("50.000");
  });
  it("parses string input", () => {
    expect(formatCurrency("1500000")).toBe("1.500.000");
  });
  it("handles 0", () => {
    expect(formatCurrency(0)).toBe("0");
  });
  it("returns '0' for NaN", () => {
    expect(formatCurrency("abc")).toBe("0");
    expect(formatCurrency(Number.NaN)).toBe("0");
  });
  it("handles negative", () => {
    expect(formatCurrency(-500_000)).toBe("-500.000");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// parseCurrency — extract digits
// ═════════════════════════════════════════════════════════════════════════════
describe("utils: parseCurrency", () => {
  it("strips all non-digits", () => {
    expect(parseCurrency("1.000.000đ")).toBe("1000000");
    expect(parseCurrency("$1,500.50")).toBe("150050");
  });
  it("returns empty string for non-numeric", () => {
    expect(parseCurrency("abc")).toBe("");
    expect(parseCurrency("")).toBe("");
  });
  it("preserves leading zeros (string return)", () => {
    expect(parseCurrency("0.000.500")).toBe("0000500");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// parseMoneyInput / formatMoneyInput
// ═════════════════════════════════════════════════════════════════════════════
describe("utils: money input helpers", () => {
  it("parses formatted VND input into a positive integer amount", () => {
    expect(parseMoneyInput("1.500.000đ")).toBe(1_500_000);
    expect(parseMoneyInput(" 200,000 ")).toBe(200_000);
    expect(parseMoneyInput(148500.00000000006)).toBe(148_500);
  });

  it("normalizes invalid and negative money input to zero", () => {
    expect(parseMoneyInput("abc")).toBe(0);
    expect(parseMoneyInput(null)).toBe(0);
    expect(parseMoneyInput(-500_000)).toBe(0);
  });

  it("formats money input for text fields without showing zero placeholders", () => {
    expect(formatMoneyInput(1_500_000)).toBe("1.500.000");
    expect(formatMoneyInput("1500000")).toBe("1.500.000");
    expect(formatMoneyInput(0)).toBe("");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// parsePercentInput / parseIntegerInput
// ═════════════════════════════════════════════════════════════════════════════
describe("utils: percent and integer input helpers", () => {
  it("clamps percent input to the configured 0-100 range", () => {
    expect(parsePercentInput("33")).toBe(33);
    expect(parsePercentInput("-5")).toBe(0);
    expect(parsePercentInput("150")).toBe(100);
    expect(parsePercentInput("")).toBe(0);
  });

  it("supports custom percent bounds and fallback values", () => {
    expect(parsePercentInput("", { min: 1, max: 100, fallback: 10 })).toBe(10);
    expect(parsePercentInput("0", { min: 1, max: 100, fallback: 10 })).toBe(1);
  });

  it("parses integer inputs with min, max, and fallback controls", () => {
    expect(parseIntegerInput("21", { min: 1 })).toBe(21);
    expect(parseIntegerInput("5.8", { min: 1 })).toBe(5);
    expect(parseIntegerInput("", { min: 1, fallback: 1 })).toBe(1);
    expect(parseIntegerInput("150", { min: 1, max: 100 })).toBe(100);
    expect(parseIntegerInput("-3", { min: 0 })).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// formatNumberWithSeparator
// ═════════════════════════════════════════════════════════════════════════════
describe("utils: formatNumberWithSeparator", () => {
  it("formats integers", () => {
    expect(formatNumberWithSeparator(1_500_000)).toBe("1.500.000");
  });
  it("formats string input", () => {
    expect(formatNumberWithSeparator("1500000")).toBe("1.500.000");
  });
  it("rounds floating-point currency artifacts before formatting", () => {
    expect(formatNumberWithSeparator(148500.00000000006)).toBe("148.500");
    expect(formatNumberWithSeparator(301499.99999999994)).toBe("301.500");
    expect(formatNumberWithSeparator("148500.00000000006")).toBe("148.500");
  });
  it("preserves negative sign", () => {
    expect(formatNumberWithSeparator(-500_000)).toBe("-500.000");
    expect(formatNumberWithSeparator("-500000")).toBe("-500.000");
  });
  it("strips non-digits before formatting", () => {
    expect(formatNumberWithSeparator("abc1500000def")).toBe("1.500.000");
  });
  it("returns empty for null/undefined", () => {
    expect(formatNumberWithSeparator(null as any)).toBe("");
    expect(formatNumberWithSeparator(undefined as any)).toBe("");
  });
  it("returns empty for non-numeric string", () => {
    expect(formatNumberWithSeparator("abc")).toBe("");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// resolvePackageName — fallback chain
// ═════════════════════════════════════════════════════════════════════════════
describe("utils: resolvePackageName", () => {
  it("uses joined packages.name first", () => {
    const b = { packages: { name: "Gói Mẹ Sau Sinh 21 buổi" }, package_name: "legacy" };
    expect(resolvePackageName(b)).toBe("Gói Mẹ Sau Sinh 21 buổi");
  });
  it("falls back to package_name string field", () => {
    const b = { package_name: "Gói VIP" };
    expect(resolvePackageName(b)).toBe("Gói VIP");
  });
  it("ultimate fallback 'Dịch vụ lẻ'", () => {
    expect(resolvePackageName({})).toBe("Dịch vụ lẻ");
    expect(resolvePackageName(null)).toBe("Dịch vụ lẻ");
    expect(resolvePackageName(undefined)).toBe("Dịch vụ lẻ");
  });
  it("does NOT pick empty packages.name", () => {
    const b = { packages: { name: "" }, package_name: "fallback" };
    expect(resolvePackageName(b)).toBe("fallback");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getLocalDateString — Asia/Ho_Chi_Minh
// ═════════════════════════════════════════════════════════════════════════════
describe("utils: getLocalDateString", () => {
  it("returns YYYY-MM-DD format", () => {
    const out = getLocalDateString(new Date("2026-05-26T10:30:00Z"));
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("uses Asia/Ho_Chi_Minh timezone (+07)", () => {
    // 23:30 UTC on 25/05 = 06:30 +07 on 26/05
    const out = getLocalDateString(new Date("2026-05-25T23:30:00Z"));
    expect(out).toBe("2026-05-26");
  });
  it("default arg uses now() — returns string for current day", () => {
    const out = getLocalDateString();
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getMonthStart
// ═════════════════════════════════════════════════════════════════════════════
describe("utils: getMonthStart", () => {
  it("returns first day of month", () => {
    expect(getMonthStart(new Date("2026-05-26T10:00:00"))).toBe("2026-05-01");
    expect(getMonthStart(new Date("2026-01-15T00:00:00"))).toBe("2026-01-01");
  });
  it("pads single-digit month", () => {
    expect(getMonthStart(new Date("2026-03-15T00:00:00"))).toBe("2026-03-01");
  });
  it("defaults to current date", () => {
    expect(getMonthStart()).toMatch(/^\d{4}-\d{2}-01$/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// sanitizeTime — HH:MM normalization
// ═════════════════════════════════════════════════════════════════════════════
describe("utils: sanitizeTime", () => {
  it("normalizes HH:MM (zero-pad hour, 2-digit minute required)", () => {
    expect(sanitizeTime("9:00")).toBe("09:00");
    expect(sanitizeTime("14:30")).toBe("14:30");
    // Single-digit minute is rejected by strict regex — returns null
    expect(sanitizeTime("9:5")).toBeNull();
  });
  it("normalizes HH:MM:SS to HH:MM", () => {
    expect(sanitizeTime("09:30:45")).toBe("09:30");
  });
  it("extracts H:M from messy input", () => {
    expect(sanitizeTime("at 14:30 today")).toBe("14:30");
  });
  it("treats lone hour as HH:00", () => {
    expect(sanitizeTime("9")).toBe("09:00");
    expect(sanitizeTime("14")).toBe("14:00");
  });
  it("returns null for empty/invalid", () => {
    expect(sanitizeTime("")).toBeNull();
    expect(sanitizeTime(null)).toBeNull();
    expect(sanitizeTime(undefined)).toBeNull();
    expect(sanitizeTime("abc")).toBeNull();
  });
  it("handles numeric input", () => {
    expect(sanitizeTime(14)).toBe("14:00");
  });
});
