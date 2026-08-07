/**
 * Data helpers — fetch test data từ Supabase + utilities sinh data tạm.
 */

import http from "k6/http";
import { ENV } from "../config/env.js";
import { serviceHeaders } from "./auth.js";

/** Tìm tenant HQ id (Bella Spa Headquarter). */
export function getHqTenantId() {
  const res = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/tenants?select=id&name=eq.Bella%20Spa%20Headquarter&limit=1`,
    { headers: serviceHeaders(), tags: { name: "setup.tenant" } },
  );
  if (res.status !== 200) {
    throw new Error(`getHqTenantId failed: ${res.status} ${res.body}`);
  }
  const arr = JSON.parse(res.body);
  if (!arr.length) throw new Error("Không tìm thấy tenant HQ");
  return arr[0].id;
}

/** Tìm admin user trong tenant HQ. */
export function getAdminUser() {
  const tid = getHqTenantId();
  const res = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/users?select=id,email&tenant_id=eq.${tid}&role=eq.admin&limit=1`,
    { headers: serviceHeaders(), tags: { name: "setup.admin_user" } },
  );
  const arr = JSON.parse(res.body);
  if (!arr.length) throw new Error("Không có admin user nào trong tenant HQ");
  return arr[0];
}

/** Lấy 1 KTV bất kỳ. */
export function getAnyKtv() {
  const tid = getHqTenantId();
  const res = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/users?select=id,email&tenant_id=eq.${tid}&role=in.(ktv,ktv_lead)&limit=1`,
    { headers: serviceHeaders(), tags: { name: "setup.ktv_user" } },
  );
  const arr = JSON.parse(res.body);
  return arr.length ? arr[0] : null;
}

/** Lấy 1 package bất kỳ. */
export function getAnyPackage() {
  const tid = getHqTenantId();
  const res = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/packages?select=id,name,price&tenant_id=eq.${tid}&limit=1`,
    { headers: serviceHeaders(), tags: { name: "setup.package" } },
  );
  const arr = JSON.parse(res.body);
  return arr.length ? arr[0] : null;
}

/** Phone hợp lệ 10 số không trùng (cho insert customer). */
export function randomVnPhone() {
  // VN mobile prefixes: 03/05/07/08/09
  const prefixes = ["032", "033", "034", "035", "070", "079", "081", "082", "086", "088", "098", "097"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const tail = String(Math.floor(Math.random() * 10000000)).padStart(7, "0");
  return prefix + tail;
}

/** Random booking_number không trùng cho load test. */
export function randomBookingNumber() {
  return `LOAD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** Lấy ID tenant y tế/medical. */
export function getMedicalTenantId() {
  const res = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/tenants?select=id&name=eq.Bella%20Medical%20Clinic&limit=1`,
    { headers: serviceHeaders(), tags: { name: "setup.medical_tenant" } }
  );
  if (res.status !== 200) {
    throw new Error(`getMedicalTenantId failed: ${res.status} ${res.body}`);
  }
  const arr = JSON.parse(res.body);
  if (!arr.length) {
    return "88888888-8888-8888-8888-888888888888";
  }
  return arr[0].id;
}

/** Lấy 1 Doctor Party ID bất kỳ trong tenant. */
export function getAnyDoctorPartyId(tenantId) {
  const res = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/party_parties?select=id&tenant_id=eq.${tenantId}&party_type=eq.person&limit=1`,
    { headers: serviceHeaders(), tags: { name: "setup.doctor_party" } }
  );
  if (res.status !== 200) {
    throw new Error(`getAnyDoctorPartyId failed: ${res.status} ${res.body}`);
  }
  const arr = JSON.parse(res.body);
  return arr.length ? arr[0].id : null;
}

/** Lấy 1 Care Journey ID bất kỳ trong tenant. */
export function getAnyCareJourneyId(tenantId) {
  const res = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/journey_journeys?select=id&tenant_id=eq.${tenantId}&vertical=eq.healthcare&limit=1`,
    { headers: serviceHeaders(), tags: { name: "setup.care_journey" } }
  );
  if (res.status !== 200) {
    throw new Error(`getAnyCareJourneyId failed: ${res.status} ${res.body}`);
  }
  const arr = JSON.parse(res.body);
  return arr.length ? arr[0].id : null;
}
