/**
 * Form validators — VN-specific.
 *
 * Tất cả validator đều thuần (pure) — không gọi DB, không phụ thuộc Supabase.
 * Trả về `ValidationResult` chuẩn để form gọi trực tiếp:
 *
 *   const r = validateVnPhone(input);
 *   if (!r.ok) setError(r.error);
 *
 * Hoặc trả về boolean nhanh qua `is*` helpers:
 *
 *   if (isVnPhone(input)) ...
 */

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// 1. Số điện thoại Việt Nam
// ─────────────────────────────────────────────────────────────────────────────
// VN mobile: 0xx xxx xxxx (10 digits) — đầu 03/05/07/08/09 hoặc +84 / 84 prefix.
// VN landline: 0xx xxxx xxxx (10–11 digits) — đầu 02xx.

const VN_PHONE_REGEX = /^(?:\+?84|0)(3[2-9]|5[2|5|6|8|9]|7[06-9]|8[1-689]|9[0-46-9])\d{7}$/;
const VN_LANDLINE_REGEX = /^(?:\+?84|0)2\d{8,9}$/;

/** Strip space, dot, dash from a phone input. */
export function normalizePhone(input: string): string {
  return (input ?? "").replace(/[\s.\-()]/g, "");
}

/** True if input is a valid VN mobile number (03/05/07/08/09 prefixes). */
export function isVnMobile(input: string): boolean {
  return VN_PHONE_REGEX.test(normalizePhone(input));
}

/** True if input is a valid VN landline (02x prefix). */
export function isVnLandline(input: string): boolean {
  return VN_LANDLINE_REGEX.test(normalizePhone(input));
}

/** True if mobile OR landline. */
export function isVnPhone(input: string): boolean {
  return isVnMobile(input) || isVnLandline(input);
}

export function validateVnPhone(input: string): ValidationResult {
  const norm = normalizePhone(input);
  if (!norm) return { ok: false, error: "Số điện thoại không được để trống." };
  if (norm.length < 10) return { ok: false, error: "Số điện thoại quá ngắn (tối thiểu 10 số)." };
  if (norm.length > 12) return { ok: false, error: "Số điện thoại quá dài." };
  if (!/^[\d+]+$/.test(norm)) return { ok: false, error: "Số điện thoại chỉ chứa số." };
  if (!isVnPhone(input)) return { ok: false, error: "Số điện thoại VN không hợp lệ." };
  // Normalize về dạng 0xxxxxxxxx (bỏ +84)
  let value = norm;
  if (value.startsWith("+84")) value = "0" + value.slice(3);
  else if (value.startsWith("84") && value.length === 11) value = "0" + value.slice(2);
  return { ok: true, value };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CCCD / CMND
// ─────────────────────────────────────────────────────────────────────────────
// CCCD = 12 digits (cấp từ 2016). CMND cũ = 9 digits.

export function isCccd(input: string): boolean {
  return /^\d{12}$/.test((input ?? "").replace(/\s/g, ""));
}
export function isCmnd(input: string): boolean {
  return /^\d{9}$/.test((input ?? "").replace(/\s/g, ""));
}
export function isCccdOrCmnd(input: string): boolean {
  return isCccd(input) || isCmnd(input);
}

export function validateCccd(input: string): ValidationResult {
  const norm = (input ?? "").replace(/\s/g, "");
  if (!norm) return { ok: false, error: "CCCD/CMND không được để trống." };
  if (!/^\d+$/.test(norm)) return { ok: false, error: "CCCD/CMND chỉ chứa số." };
  if (!isCccdOrCmnd(norm))
    return { ok: false, error: "CCCD phải 12 số hoặc CMND cũ phải 9 số." };
  return { ok: true, value: norm };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Email
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_REGEX =
  /^[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9.\-]{1,253}\.[A-Za-z]{2,24}$/;

export function isEmail(input: string): boolean {
  return EMAIL_REGEX.test((input ?? "").trim());
}

export function validateEmail(input: string): ValidationResult {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return { ok: false, error: "Email không được để trống." };
  if (trimmed.length > 320) return { ok: false, error: "Email quá dài." };
  if (!isEmail(trimmed)) return { ok: false, error: "Email không đúng định dạng." };
  return { ok: true, value: trimmed.toLowerCase() };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Số tài khoản ngân hàng VN
// ─────────────────────────────────────────────────────────────────────────────
// VN bank accounts: 8–19 digits tuỳ NH. Vietcombank/Techcom/MB đa số 10–14.

export function isVnBankAccount(input: string): boolean {
  const norm = (input ?? "").replace(/[\s.\-]/g, "");
  return /^\d{8,19}$/.test(norm);
}

export function validateVnBankAccount(input: string): ValidationResult {
  const norm = (input ?? "").replace(/[\s.\-]/g, "");
  if (!norm) return { ok: false, error: "Số tài khoản không được để trống." };
  if (!/^\d+$/.test(norm)) return { ok: false, error: "Số tài khoản chỉ chứa số." };
  if (norm.length < 8) return { ok: false, error: "Số tài khoản quá ngắn (tối thiểu 8 số)." };
  if (norm.length > 19) return { ok: false, error: "Số tài khoản quá dài (tối đa 19 số)." };
  return { ok: true, value: norm };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Số tiền VND
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a VND-formatted string ("1.000.000" or "1,000,000" or "1000000") to number. */
export function parseVnd(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const digits = String(input).replace(/[^\d-]/g, "");
  if (!digits || digits === "-") return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

export interface AmountValidationOpts {
  min?: number;
  max?: number;
  allowZero?: boolean;
  allowNegative?: boolean;
  label?: string;
}

export function validateAmount(
  input: string | number,
  opts: AmountValidationOpts = {},
): ValidationResult {
  const label = opts.label ?? "Số tiền";
  const n = parseVnd(input);
  if (n === null) return { ok: false, error: `${label} không hợp lệ.` };
  if (!opts.allowNegative && n < 0) return { ok: false, error: `${label} không được âm.` };
  if (!opts.allowZero && n === 0) return { ok: false, error: `${label} phải lớn hơn 0.` };
  if (opts.min !== undefined && n < opts.min)
    return { ok: false, error: `${label} tối thiểu ${opts.min.toLocaleString("vi-VN")}đ.` };
  if (opts.max !== undefined && n > opts.max)
    return { ok: false, error: `${label} tối đa ${opts.max.toLocaleString("vi-VN")}đ.` };
  return { ok: true, value: String(n) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Ngày tháng (date)
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true if ISO YYYY-MM-DD string is a valid calendar date. */
export function isIsoDate(input: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  const d = new Date(input + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  // Reject months >12, days >31, leap-year edge cases handled by Date()
  const [y, m, dd] = input.split("-").map(Number);
  return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === dd;
}

export interface DateValidationOpts {
  /** Date must be strictly in the past (e.g. DOB). */
  pastOnly?: boolean;
  /** Date must be strictly in the future (e.g. due date). */
  futureOnly?: boolean;
  /** Min ISO date inclusive. */
  min?: string;
  /** Max ISO date inclusive. */
  max?: string;
  /** Custom reference date for "today" — useful for tests. */
  today?: Date;
  label?: string;
}

export function validateDate(input: string, opts: DateValidationOpts = {}): ValidationResult {
  const label = opts.label ?? "Ngày";
  if (!input) return { ok: false, error: `${label} không được để trống.` };
  if (!isIsoDate(input)) return { ok: false, error: `${label} không đúng định dạng (YYYY-MM-DD).` };
  const today = opts.today ?? new Date();
  const todayIso = today.toISOString().slice(0, 10);
  if (opts.pastOnly && input > todayIso)
    return { ok: false, error: `${label} không được ở tương lai.` };
  if (opts.futureOnly && input <= todayIso)
    return { ok: false, error: `${label} phải ở tương lai.` };
  if (opts.min && input < opts.min)
    return { ok: false, error: `${label} không sớm hơn ${opts.min}.` };
  if (opts.max && input > opts.max)
    return { ok: false, error: `${label} không muộn hơn ${opts.max}.` };
  return { ok: true, value: input };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Mật khẩu (password strength)
// ─────────────────────────────────────────────────────────────────────────────

export interface PasswordStrengthOpts {
  /** Minimum length (default 8). */
  min?: number;
  /** Require at least 1 uppercase letter (default true). */
  requireUpper?: boolean;
  /** Require at least 1 lowercase letter (default true). */
  requireLower?: boolean;
  /** Require at least 1 digit (default true). */
  requireDigit?: boolean;
  /** Require at least 1 special character (default false). */
  requireSpecial?: boolean;
}

export function validatePassword(
  input: string,
  opts: PasswordStrengthOpts = {},
): ValidationResult {
  const min = opts.min ?? 8;
  const requireUpper = opts.requireUpper ?? true;
  const requireLower = opts.requireLower ?? true;
  const requireDigit = opts.requireDigit ?? true;
  const requireSpecial = opts.requireSpecial ?? false;

  if (!input) return { ok: false, error: "Mật khẩu không được để trống." };
  if (input.length < min)
    return { ok: false, error: `Mật khẩu tối thiểu ${min} ký tự.` };
  if (requireUpper && !/[A-Z]/.test(input))
    return { ok: false, error: "Mật khẩu phải có ít nhất 1 chữ hoa." };
  if (requireLower && !/[a-z]/.test(input))
    return { ok: false, error: "Mật khẩu phải có ít nhất 1 chữ thường." };
  if (requireDigit && !/\d/.test(input))
    return { ok: false, error: "Mật khẩu phải có ít nhất 1 chữ số." };
  if (requireSpecial && !/[^A-Za-z0-9]/.test(input))
    return { ok: false, error: "Mật khẩu phải có ít nhất 1 ký tự đặc biệt." };
  return { ok: true, value: input };
}

/** Rough strength score 0–4 (0 = empty, 4 = strong). For UI meters. */
export function passwordStrengthScore(input: string): number {
  if (!input) return 0;
  let score = 0;
  if (input.length >= 8) score++;
  if (input.length >= 12) score++;
  if (/[A-Z]/.test(input) && /[a-z]/.test(input)) score++;
  if (/\d/.test(input) && /[^A-Za-z0-9]/.test(input)) score++;
  return Math.min(score, 4);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Mã OTP / TOTP 6 digits
// ─────────────────────────────────────────────────────────────────────────────

export function isOtpCode(input: string): boolean {
  return /^\d{6}$/.test((input ?? "").trim());
}

export function validateOtpCode(input: string): ValidationResult {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return { ok: false, error: "Mã xác minh không được để trống." };
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: "Mã xác minh chỉ chứa chữ số." };
  if (!isOtpCode(trimmed))
    return { ok: false, error: "Mã xác minh phải gồm đúng 6 chữ số." };
  return { ok: true, value: trimmed };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Auto-trim & whitespace
// ─────────────────────────────────────────────────────────────────────────────

/** Trim + collapse multiple internal spaces to single. */
export function tidyText(input: string | null | undefined): string {
  if (!input) return "";
  return String(input).replace(/\s+/g, " ").trim();
}

/** Required text field with min/max length. */
export function validateRequiredText(
  input: string,
  opts: { min?: number; max?: number; label?: string } = {},
): ValidationResult {
  const label = opts.label ?? "Trường";
  const min = opts.min ?? 1;
  const max = opts.max ?? 500;
  const tidy = tidyText(input);
  if (!tidy) return { ok: false, error: `${label} không được để trống.` };
  if (tidy.length < min) return { ok: false, error: `${label} tối thiểu ${min} ký tự.` };
  if (tidy.length > max) return { ok: false, error: `${label} tối đa ${max} ký tự.` };
  return { ok: true, value: tidy };
}
