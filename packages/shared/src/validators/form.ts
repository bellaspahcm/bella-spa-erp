/**
 * Form validators — platform-neutral
 * Di chuyển từ src/lib/form-validators.ts
 */

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

const VN_PHONE_REGEX = /^(?:\+?84|0)(3[2-9]|5[2|5|6|8|9]|7[06-9]|8[1-689]|9[0-46-9])\d{7}$/;
const EMAIL_REGEX = /^[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9.\-]{1,253}\.[A-Za-z]{2,24}$/;

export function normalizePhone(input: string): string {
  return (input ?? "").replace(/[\s.\-()]/g, "");
}

export function isVnPhone(input: string): boolean {
  return VN_PHONE_REGEX.test(normalizePhone(input));
}

export function validateVnPhone(input: string): ValidationResult {
  const norm = normalizePhone(input);
  if (!norm) return { ok: false, error: "Số điện thoại không được để trống." };
  if (norm.length < 10) return { ok: false, error: "Số điện thoại quá ngắn (tối thiểu 10 số)." };
  if (norm.length > 12) return { ok: false, error: "Số điện thoại quá dài." };
  if (!/^[\d+]+$/.test(norm)) return { ok: false, error: "Số điện thoại chỉ chứa số." };
  if (!isVnPhone(input)) return { ok: false, error: "Số điện thoại VN không hợp lệ." };
  
  let value = norm;
  if (value.startsWith("+84")) value = "0" + value.slice(3);
  else if (value.startsWith("84") && value.length === 11) value = "0" + value.slice(2);
  return { ok: true, value };
}

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

export interface PasswordStrengthOpts {
  min?: number;
  requireUpper?: boolean;
  requireLower?: boolean;
  requireDigit?: boolean;
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
  if (input.length < min) return { ok: false, error: `Mật khẩu tối thiểu ${min} ký tự.` };
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

export function parseVnd(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const digits = String(input).replace(/[^\d-]/g, "");
  if (!digits || digits === "-") return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}
