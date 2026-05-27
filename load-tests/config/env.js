/**
 * Shared environment config cho k6 scripts.
 *
 * k6 đọc env vars qua __ENV. Truyền vào CLI với:
 *   k6 run -e BASE_URL=http://localhost:3000 -e SUPABASE_URL=... script.js
 *
 * Hoặc export trong shell:
 *   export BASE_URL=http://localhost:3000
 *   k6 run script.js
 *
 * Mặc định: localhost:3000 cho Bella dev server.
 */

export const ENV = {
  BASE_URL: __ENV.BASE_URL || "http://localhost:3000",
  SUPABASE_URL: __ENV.SUPABASE_URL || __ENV.NEXT_PUBLIC_SUPABASE_URL || "",
  SUPABASE_ANON_KEY:
    __ENV.SUPABASE_ANON_KEY || __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  SUPABASE_SERVICE_KEY: __ENV.SUPABASE_SERVICE_KEY || "",

  // Test admin credentials — dev bypass password
  ADMIN_EMAIL: __ENV.ADMIN_EMAIL || "admin@bellaspa.com.vn",
  ADMIN_PASSWORD: __ENV.ADMIN_PASSWORD || "password123",

  // Tag cho metrics (filter trong dashboard)
  ENVIRONMENT: __ENV.ENVIRONMENT || "local",
};

export function assertEnv() {
  const missing = [];
  if (!ENV.BASE_URL) missing.push("BASE_URL");
  if (missing.length) {
    throw new Error(`Thiếu env vars: ${missing.join(", ")}`);
  }
}
