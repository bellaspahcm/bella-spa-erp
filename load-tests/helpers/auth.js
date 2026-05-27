/**
 * Auth helper cho k6 — login Bella ERP và lưu cookie jar cho subsequent requests.
 *
 * Lưu ý: Bella dùng Supabase Auth — login trả về session JWT lưu trong cookie.
 * Sau khi login thành công, các request tiếp theo (vào /dashboard, /api, ...) sẽ
 * tự gửi cookie và authenticated.
 */

import http from "k6/http";
import { check } from "k6";
import { ENV } from "../config/env.js";

/**
 * Login qua Supabase Auth REST endpoint trực tiếp.
 * Trả về { access_token, refresh_token, user } hoặc null nếu fail.
 *
 * Cách này nhanh hơn UI flow (không cần render Next.js) — phù hợp load test
 * vì mỗi VU mất ~50ms login thay vì 2s flow UI đầy đủ.
 */
export function loginViaApi(email, password) {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    throw new Error("Thiếu SUPABASE_URL/SUPABASE_ANON_KEY — không thể login trực tiếp.");
  }

  const url = `${ENV.SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const res = http.post(
    url,
    JSON.stringify({ email, password }),
    {
      headers: {
        "Content-Type": "application/json",
        apikey: ENV.SUPABASE_ANON_KEY,
      },
      tags: { name: "auth.login" },
    },
  );

  const ok = check(res, {
    "login status 200": (r) => r.status === 200,
    "login has access_token": (r) => {
      try {
        return !!JSON.parse(r.body).access_token;
      } catch {
        return false;
      }
    },
  });

  if (!ok) return null;
  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

/**
 * Trả về headers ready-to-use cho subsequent Supabase REST calls.
 * Bao gồm: apikey, Authorization Bearer JWT.
 */
export function authHeaders(accessToken) {
  return {
    apikey: ENV.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

/**
 * Service-role headers — bypass RLS. CHỈ dùng trong setup/teardown,
 * KHÔNG dùng trong VU iteration loop để giữ test realistic.
 */
export function serviceHeaders() {
  if (!ENV.SUPABASE_SERVICE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_KEY chưa được set — cần cho service-role calls.",
    );
  }
  return {
    apikey: ENV.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${ENV.SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}
