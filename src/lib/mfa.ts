/**
 * MFA / 2FA helpers — TOTP via Supabase Auth.
 *
 * Yêu cầu Supabase project bật MFA (Auth → Providers → MFA → TOTP enabled).
 * Tài liệu: https://supabase.com/docs/guides/auth/auth-mfa/totp
 *
 * Vòng đời:
 *   1. enrollTotp()          -> trả về { factorId, qrSvg, secret }
 *   2. verifyEnrollment()    -> user nhập 6 số từ Authenticator
 *   3. listFactors()         -> liệt kê factor đã enrol (để hiển thị/unenrol)
 *   4. challengeAndVerify()  -> dùng khi đăng nhập sau khi đã có TOTP
 *   5. unenrollTotp()        -> xoá factor
 *
 * AAL (Authenticator Assurance Level):
 *   - AAL1: chỉ password
 *   - AAL2: password + TOTP
 *   Một số role (HQ Owner, Admin, Finance) NÊN bị ép AAL2 ở middleware.
 */

import { getSupabase } from "./supabase-client";

export type EnrollResult =
  | { ok: true; factorId: string; qrSvg: string; secret: string; uri: string }
  | { ok: false; error: string };

export type VerifyResult = { ok: true } | { ok: false; error: string };

export interface MfaFactor {
  id: string;
  friendlyName: string | null;
  factorType: "totp" | "phone";
  status: "unverified" | "verified";
  createdAt: string;
}

/**
 * Bắt đầu enrol TOTP. Trả về QR code (SVG inline) và secret để user lưu vào
 * app authenticator (Google Authenticator, Authy, 1Password...).
 *
 * Sau bước này phải gọi verifyEnrollment(factorId, code6) trong vòng vài phút
 * — nếu không factor sẽ ở trạng thái "unverified" và bị tự xoá.
 */
export async function enrollTotp(friendlyName = "Bella ERP"): Promise<EnrollResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  });

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Không nhận được dữ liệu enrol từ Supabase." };

  return {
    ok: true,
    factorId: data.id,
    qrSvg: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

/**
 * Xác minh mã 6 số từ app authenticator để hoàn tất enrol.
 * Sau khi thành công, factor chuyển trạng thái sang "verified" và phiên hiện
 * tại được nâng lên AAL2.
 */
export async function verifyEnrollment(
  factorId: string,
  code: string,
): Promise<VerifyResult> {
  const supabase = getSupabase();

  // Challenge first, then verify (Supabase TOTP flow)
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) return { ok: false, error: challenge.error.message };

  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });
  if (verify.error) return { ok: false, error: verify.error.message };

  return { ok: true };
}

/**
 * Liệt kê các factor MFA đã enrol cho user hiện tại.
 */
export async function listFactors(): Promise<MfaFactor[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return [];

  const all = [...(data.totp ?? []), ...(data.all ?? [])];
  // De-duplicate by id
  const map = new Map<string, MfaFactor>();
  for (const f of all) {
    if (map.has(f.id)) continue;
    map.set(f.id, {
      id: f.id,
      friendlyName: f.friendly_name ?? null,
      factorType: f.factor_type as "totp" | "phone",
      status: f.status as "unverified" | "verified",
      createdAt: f.created_at,
    });
  }
  return Array.from(map.values());
}

/**
 * Gỡ một factor (TOTP) khỏi tài khoản. User sẽ trở về AAL1 ở lần đăng nhập sau.
 */
export async function unenrollTotp(factorId: string): Promise<VerifyResult> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Sau bước signInWithPassword, gọi hàm này nếu phiên cần được nâng lên AAL2.
 * Tự động tìm factor "verified" đầu tiên, challenge, rồi verify với mã 6 số.
 */
export async function challengeAndVerify(code: string): Promise<VerifyResult> {
  const supabase = getSupabase();
  const factors = await listFactors();
  const verified = factors.find((f) => f.status === "verified" && f.factorType === "totp");
  if (!verified) return { ok: false, error: "Chưa có TOTP factor nào được kích hoạt." };

  const challenge = await supabase.auth.mfa.challenge({ factorId: verified.id });
  if (challenge.error) return { ok: false, error: challenge.error.message };

  const verify = await supabase.auth.mfa.verify({
    factorId: verified.id,
    challengeId: challenge.data.id,
    code,
  });
  if (verify.error) return { ok: false, error: verify.error.message };

  return { ok: true };
}

/**
 * Trả về AAL hiện tại của phiên. Dùng để biết user có cần challenge MFA hay không.
 *   - 'aal1': mới login bằng password
 *   - 'aal2': đã pass TOTP challenge trong phiên hiện tại
 */
export async function getAal(): Promise<"aal1" | "aal2" | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return null;
  // currentLevel | nextLevel
  return (data.currentLevel as "aal1" | "aal2" | null) ?? null;
}

/**
 * True khi user vừa đăng nhập bằng password nhưng có TOTP factor verified
 * → phải nhập mã MFA mới được vào dashboard.
 */
export async function needsMfaChallenge(): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.currentLevel === "aal1" && data.nextLevel === "aal2";
}
