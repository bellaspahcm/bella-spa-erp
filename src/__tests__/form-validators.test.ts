import {
  // phone
  normalizePhone,
  isVnMobile,
  isVnLandline,
  isVnPhone,
  validateVnPhone,
  // cccd
  isCccd,
  isCmnd,
  isCccdOrCmnd,
  validateCccd,
  // email
  isEmail,
  validateEmail,
  // bank
  isVnBankAccount,
  validateVnBankAccount,
  // amount
  parseVnd,
  validateAmount,
  // date
  isIsoDate,
  validateDate,
  // password
  validatePassword,
  passwordStrengthScore,
  // otp
  isOtpCode,
  validateOtpCode,
  // text
  tidyText,
  validateRequiredText,
} from "@/lib/form-validators";

// ═════════════════════════════════════════════════════════════════════════════
// VN PHONE
// ═════════════════════════════════════════════════════════════════════════════
describe("form-validators: VN phone", () => {
  describe("normalizePhone", () => {
    it("strips spaces, dots, dashes, parens", () => {
      expect(normalizePhone("091 234.5678")).toBe("0912345678");
      expect(normalizePhone("(091) 234-5678")).toBe("0912345678");
      expect(normalizePhone("  0912345678  ")).toBe("0912345678");
    });
    it("handles empty/null input", () => {
      expect(normalizePhone("")).toBe("");
      // @ts-expect-error testing null guard
      expect(normalizePhone(null)).toBe("");
    });
  });

  describe("isVnMobile", () => {
    it("accepts common Viettel/Vina/Mobi prefixes", () => {
      expect(isVnMobile("0912345678")).toBe(true); // Viettel
      expect(isVnMobile("0334567890")).toBe(true); // Viettel new
      expect(isVnMobile("0987654321")).toBe(true); // Viettel
      expect(isVnMobile("0708111222")).toBe(true); // Mobi
      expect(isVnMobile("0888999000")).toBe(true); // Vina
    });
    it("accepts +84 / 84 prefix", () => {
      expect(isVnMobile("+84912345678")).toBe(true);
      expect(isVnMobile("84912345678")).toBe(true);
    });
    it("rejects invalid prefixes", () => {
      expect(isVnMobile("0112345678")).toBe(false); // 01 not assigned mobile
      expect(isVnMobile("0212345678")).toBe(false); // 02 is landline
      expect(isVnMobile("1234567890")).toBe(false);
    });
    it("rejects wrong length", () => {
      expect(isVnMobile("091234567")).toBe(false); // 9 digits
      expect(isVnMobile("09123456789")).toBe(false); // 11 digits
    });
  });

  describe("isVnLandline", () => {
    it("accepts 02xx prefix", () => {
      expect(isVnLandline("02838382828")).toBe(true);
      expect(isVnLandline("02412345678")).toBe(true);
    });
    it("rejects mobile prefixes", () => {
      expect(isVnLandline("0912345678")).toBe(false);
    });
  });

  describe("validateVnPhone", () => {
    it("ok for valid mobile", () => {
      const r = validateVnPhone("0912345678");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe("0912345678");
    });
    it("normalizes +84 to 0 prefix", () => {
      const r = validateVnPhone("+84912345678");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe("0912345678");
    });
    it("normalizes 84xxxxxxxxx to 0xxxxxxxxx", () => {
      const r = validateVnPhone("84912345678");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe("0912345678");
    });
    it("rejects empty", () => {
      const r = validateVnPhone("");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/không được để trống/);
    });
    it("rejects letters", () => {
      const r = validateVnPhone("091abc5678");
      expect(r.ok).toBe(false);
    });
    it("rejects too short", () => {
      const r = validateVnPhone("0912345");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/quá ngắn/);
    });
    it("rejects too long", () => {
      const r = validateVnPhone("091234567890");
      expect(r.ok).toBe(false);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CCCD / CMND
// ═════════════════════════════════════════════════════════════════════════════
describe("form-validators: CCCD/CMND", () => {
  it("accepts 12-digit CCCD", () => {
    expect(isCccd("001234567890")).toBe(true);
    expect(isCccd("079123456789")).toBe(true);
  });
  it("rejects non-12 lengths as CCCD", () => {
    expect(isCccd("12345678901")).toBe(false); // 11
    expect(isCccd("1234567890123")).toBe(false); // 13
  });
  it("accepts 9-digit CMND", () => {
    expect(isCmnd("012345678")).toBe(true);
  });
  it("rejects mixed/short as both", () => {
    expect(isCccdOrCmnd("12345")).toBe(false);
    expect(isCccdOrCmnd("abc123456")).toBe(false);
  });

  describe("validateCccd", () => {
    it("ok for CCCD 12 digits", () => {
      const r = validateCccd("001234567890");
      expect(r.ok).toBe(true);
    });
    it("ok for CMND 9 digits", () => {
      const r = validateCccd("012345678");
      expect(r.ok).toBe(true);
    });
    it("rejects empty", () => {
      expect(validateCccd("").ok).toBe(false);
    });
    it("rejects letters", () => {
      const r = validateCccd("abc123");
      expect(r.ok).toBe(false);
    });
    it("rejects wrong digit count", () => {
      const r = validateCccd("12345678901"); // 11
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/12 số hoặc.*9 số/);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// EMAIL
// ═════════════════════════════════════════════════════════════════════════════
describe("form-validators: email", () => {
  it.each([
    ["admin@bellaspa.vn", true],
    ["user.name+tag@gmail.com", true],
    ["x@y.io", true],
    ["info@sub.domain.com.vn", true],
  ])("accepts %s", (input, expected) => {
    expect(isEmail(input)).toBe(expected);
  });

  it.each([
    "no-at-sign.com",
    "@nothing.com",
    "spaces in@email.com",
    "missing.tld@x",
    "double@@at.com",
    "",
  ])("rejects %s", (input) => {
    expect(isEmail(input)).toBe(false);
  });

  describe("validateEmail", () => {
    it("ok and lowercases", () => {
      const r = validateEmail("Admin@Bella.VN");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe("admin@bella.vn");
    });
    it("trims whitespace", () => {
      const r = validateEmail("  user@x.com  ");
      expect(r.ok).toBe(true);
    });
    it("rejects empty", () => {
      expect(validateEmail("").ok).toBe(false);
    });
    it("rejects malformed", () => {
      expect(validateEmail("not-an-email").ok).toBe(false);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// VN BANK ACCOUNT
// ═════════════════════════════════════════════════════════════════════════════
describe("form-validators: VN bank account", () => {
  it("accepts 8–19 digits", () => {
    expect(isVnBankAccount("12345678")).toBe(true);
    expect(isVnBankAccount("0123456789012345")).toBe(true);
    expect(isVnBankAccount("1234567890123456789")).toBe(true); // 19
  });
  it("strips spaces and dashes", () => {
    expect(isVnBankAccount("0123 4567 8901 2345")).toBe(true);
    expect(isVnBankAccount("0123-4567-8901")).toBe(true);
  });
  it("rejects too short / too long / letters", () => {
    expect(isVnBankAccount("1234567")).toBe(false); // 7
    expect(isVnBankAccount("12345678901234567890")).toBe(false); // 20
    expect(isVnBankAccount("abc12345")).toBe(false);
  });
  it("validateVnBankAccount returns clear errors", () => {
    expect(validateVnBankAccount("").ok).toBe(false);
    expect(validateVnBankAccount("12abc").ok).toBe(false);
    const r = validateVnBankAccount("1234567");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/quá ngắn/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AMOUNT VND
// ═════════════════════════════════════════════════════════════════════════════
describe("form-validators: amount VND", () => {
  describe("parseVnd", () => {
    it.each([
      ["1000000", 1_000_000],
      ["1.000.000", 1_000_000],
      ["1,000,000", 1_000_000],
      ["1 000 000đ", 1_000_000],
      [1_500_000, 1_500_000],
    ])("parses %s -> %s", (input, expected) => {
      expect(parseVnd(input as any)).toBe(expected);
    });
    it("returns null for invalid", () => {
      expect(parseVnd("")).toBeNull();
      expect(parseVnd(null)).toBeNull();
      expect(parseVnd(undefined)).toBeNull();
      expect(parseVnd("abc")).toBeNull();
    });
    it("handles NaN gracefully", () => {
      expect(parseVnd(Number.NaN)).toBeNull();
    });
  });

  describe("validateAmount", () => {
    it("ok for positive", () => {
      expect(validateAmount("1.000.000").ok).toBe(true);
    });
    it("rejects negative by default", () => {
      const r = validateAmount("-500000");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/không được âm/);
    });
    it("rejects zero by default", () => {
      const r = validateAmount("0");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/lớn hơn 0/);
    });
    it("allowZero passes 0", () => {
      const r = validateAmount("0", { allowZero: true });
      expect(r.ok).toBe(true);
    });
    it("allowNegative passes -500", () => {
      const r = validateAmount("-500000", { allowNegative: true });
      expect(r.ok).toBe(true);
    });
    it("enforces min", () => {
      const r = validateAmount("100000", { min: 500_000 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/tối thiểu/);
    });
    it("enforces max", () => {
      const r = validateAmount("100000000", { max: 50_000_000 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/tối đa/);
    });
    it("uses custom label", () => {
      const r = validateAmount("-1", { label: "Tiền cọc" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/Tiền cọc/);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DATE
// ═════════════════════════════════════════════════════════════════════════════
describe("form-validators: date", () => {
  describe("isIsoDate", () => {
    it("accepts valid YYYY-MM-DD", () => {
      expect(isIsoDate("2026-05-26")).toBe(true);
      expect(isIsoDate("2000-01-01")).toBe(true);
      expect(isIsoDate("2024-02-29")).toBe(true); // leap year
    });
    it("rejects invalid format", () => {
      expect(isIsoDate("26/05/2026")).toBe(false);
      expect(isIsoDate("2026/05/26")).toBe(false);
      expect(isIsoDate("2026-5-26")).toBe(false); // not zero-padded
    });
    it("rejects invalid calendar dates", () => {
      expect(isIsoDate("2026-13-01")).toBe(false); // month 13
      expect(isIsoDate("2026-02-30")).toBe(false); // Feb 30
      expect(isIsoDate("2025-02-29")).toBe(false); // not leap year
      expect(isIsoDate("2026-04-31")).toBe(false); // Apr 31
    });
  });

  describe("validateDate", () => {
    const today = new Date("2026-05-26T00:00:00Z");

    it("ok for valid date", () => {
      expect(validateDate("2026-05-26", { today }).ok).toBe(true);
    });
    it("rejects empty", () => {
      const r = validateDate("", { today });
      expect(r.ok).toBe(false);
    });
    it("rejects wrong format", () => {
      const r = validateDate("26/05/2026", { today });
      expect(r.ok).toBe(false);
    });
    it("pastOnly: rejects future", () => {
      const r = validateDate("2026-12-31", { pastOnly: true, today });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/không được ở tương lai/);
    });
    it("pastOnly: accepts today", () => {
      expect(validateDate("2026-05-26", { pastOnly: true, today }).ok).toBe(true);
    });
    it("futureOnly: rejects past", () => {
      const r = validateDate("2024-01-01", { futureOnly: true, today });
      expect(r.ok).toBe(false);
    });
    it("futureOnly: accepts tomorrow", () => {
      expect(validateDate("2026-05-27", { futureOnly: true, today }).ok).toBe(true);
    });
    it("min/max enforced", () => {
      expect(
        validateDate("2026-01-15", { min: "2026-02-01", today }).ok,
      ).toBe(false);
      expect(
        validateDate("2026-12-31", { max: "2026-06-30", today }).ok,
      ).toBe(false);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PASSWORD
// ═════════════════════════════════════════════════════════════════════════════
describe("form-validators: password", () => {
  it("rejects empty", () => {
    expect(validatePassword("").ok).toBe(false);
  });
  it("rejects too short", () => {
    const r = validatePassword("Ab1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/tối thiểu/);
  });
  it("requires uppercase by default", () => {
    const r = validatePassword("abcd1234");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/chữ hoa/);
  });
  it("requires lowercase by default", () => {
    const r = validatePassword("ABCD1234");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/chữ thường/);
  });
  it("requires digit by default", () => {
    const r = validatePassword("Abcdefgh");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/chữ số/);
  });
  it("requires special when opted in", () => {
    const r = validatePassword("Abcd1234", { requireSpecial: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ký tự đặc biệt/);
  });
  it("ok for strong password", () => {
    expect(validatePassword("Abcd1234!").ok).toBe(true);
  });
  it("respects min override", () => {
    expect(validatePassword("Ab1cdefg", { min: 12 }).ok).toBe(false);
    expect(validatePassword("Ab1cdefghijk", { min: 12 }).ok).toBe(true);
  });

  describe("passwordStrengthScore", () => {
    it("0 for empty", () => expect(passwordStrengthScore("")).toBe(0));
    it("1 for 8+ length only", () => expect(passwordStrengthScore("abcdefgh")).toBe(1));
    it("3 for 12+ with mixed case", () =>
      expect(passwordStrengthScore("Abcdefghijkl")).toBe(3));
    it("4 for strong", () =>
      expect(passwordStrengthScore("Abcd1234!@#$")).toBe(4));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// OTP
// ═════════════════════════════════════════════════════════════════════════════
describe("form-validators: OTP", () => {
  it("accepts exactly 6 digits", () => {
    expect(isOtpCode("123456")).toBe(true);
    expect(isOtpCode("000000")).toBe(true);
  });
  it("rejects wrong length / non-digits", () => {
    expect(isOtpCode("12345")).toBe(false);
    expect(isOtpCode("1234567")).toBe(false);
    expect(isOtpCode("12ab56")).toBe(false);
    expect(isOtpCode("")).toBe(false);
  });
  it("validateOtpCode reports clear errors", () => {
    expect(validateOtpCode("").ok).toBe(false);
    expect(validateOtpCode("abc").ok).toBe(false);
    const r = validateOtpCode("12345");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/6 chữ số/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEXT
// ═════════════════════════════════════════════════════════════════════════════
describe("form-validators: text", () => {
  describe("tidyText", () => {
    it("trims and collapses spaces", () => {
      expect(tidyText("   Nguyễn   Thị   An   ")).toBe("Nguyễn Thị An");
      expect(tidyText("\t\nHello\t\nWorld")).toBe("Hello World");
    });
    it("handles null/empty", () => {
      expect(tidyText("")).toBe("");
      expect(tidyText(null)).toBe("");
      expect(tidyText(undefined)).toBe("");
    });
  });

  describe("validateRequiredText", () => {
    it("ok for non-empty", () => {
      const r = validateRequiredText("Nguyễn Thị An");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe("Nguyễn Thị An");
    });
    it("trims before validation", () => {
      const r = validateRequiredText("   Hello   ", { min: 3 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe("Hello");
    });
    it("rejects empty / whitespace-only", () => {
      expect(validateRequiredText("").ok).toBe(false);
      expect(validateRequiredText("   ").ok).toBe(false);
    });
    it("enforces min", () => {
      expect(validateRequiredText("Hi", { min: 5 }).ok).toBe(false);
    });
    it("enforces max", () => {
      const r = validateRequiredText("x".repeat(600), { max: 500 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/tối đa/);
    });
    it("uses custom label", () => {
      const r = validateRequiredText("", { label: "Tên mẹ" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/Tên mẹ/);
    });
  });
});
