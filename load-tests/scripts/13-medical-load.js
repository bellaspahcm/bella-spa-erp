/**
 * MEDICAL TENANT LOAD TEST — Test phân hệ Healthcare y tế độc lập.
 *
 * Nghiệp vụ mô phỏng:
 *   1. Đón tiếp bệnh nhân y tế (tạo party_parties & customers)
 *   2. Tạo hồ sơ bệnh nhân (patient_profiles)
 *   3. Khởi động Care Journey (journey_journeys)
 *   4. Bắt đầu lượt khám Encounter (hc_encounters)
 *   5. Tạo y lệnh cận lâm sàng (hc_clinical_orders & hc_lab_orders)
 *   6. Phân luồng xếp hàng (hc_patient_queues)
 *
 * Mọi hành động chỉ tác động trên tenant y tế, bảo đảm an toàn cho các phân hệ khác.
 * Tự động cleanup toàn bộ dữ liệu test sau khi hoàn tất.
 *
 * Chạy:
 *   k6 run -e PROFILE=smoke load-tests/scripts/13-medical-load.js
 *   k6 run -e PROFILE=200 load-tests/scripts/13-medical-load.js
 *   k6 run -e PROFILE=500 load-tests/scripts/13-medical-load.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { ENV, assertEnv } from "../config/env.js";
import { RELAXED_THRESHOLDS } from "../config/thresholds.js";
import { serviceHeaders } from "../helpers/auth.js";
import {
  getMedicalTenantId,
  getAnyDoctorPartyId,
  randomVnPhone,
} from "../helpers/data.js";

// Cấu hình stages linh hoạt theo PROFILE truyền vào qua ENV
export const options = {
  stages: getStages(),
  thresholds: Object.assign({}, RELAXED_THRESHOLDS, {
    "checks{check:encounter_started}": ["rate>0.95"],
    "checks{check:lab_order_created}": ["rate>0.95"],
  }),
  tags: { test_type: "load", target: "medical" },
};

function getStages() {
  const profile = __ENV.PROFILE || "smoke";
  if (profile === "200") {
    return [
      { duration: "10s", target: 50 },
      { duration: "20s", target: 200 },
      { duration: "30s", target: 200 },
      { duration: "10s", target: 0 },
    ];
  } else if (profile === "500") {
    return [
      { duration: "15s", target: 100 },
      { duration: "30s", target: 500 },
      { duration: "45s", target: 500 },
      { duration: "15s", target: 0 },
    ];
  } else {
    // default/smoke
    return [
      { duration: "10s", target: 1 },
    ];
  }
}

export function setup() {
  assertEnv();
  if (!ENV.SUPABASE_SERVICE_KEY) {
    throw new Error("Cần SUPABASE_SERVICE_KEY để bypass RLS y tế.");
  }
  const tenantId = getMedicalTenantId();
  let doctorId = getAnyDoctorPartyId(tenantId);
  
  if (!doctorId) {
    // Dự phòng nếu chưa seed bác sĩ y tế
    console.log("[medical] Chưa có bác sĩ, tạo bác sĩ giả lập...");
    const headers = serviceHeaders();
    const res = http.post(
      `${ENV.SUPABASE_URL}/rest/v1/party_parties`,
      JSON.stringify({
        tenant_id: tenantId,
        party_type: "person",
        display_name: "BS. Lâm Nguyễn (Load Test)",
      }),
      { headers }
    );
    const body = JSON.parse(res.body);
    doctorId = body[0].id;
  }

  console.log(`[medical] Sẵn sàng test trên tenant: ${tenantId}, Doctor Party ID: ${doctorId}`);
  return { tenantId, doctorId };
}

export default function (data) {
  const headers = serviceHeaders();
  const phone = randomVnPhone();

  // 1. Đón tiếp bệnh nhân (Tạo party_parties)
  let res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/party_parties`,
    JSON.stringify({
      tenant_id: data.tenantId,
      party_type: "person",
      display_name: `LOAD-MED-PAT-${phone}`,
    }),
    { headers, tags: { name: "medical.insert_party" } }
  );

  const partyCreated = check(res, {
    "party created status 201": (r) => r.status === 201,
  });
  if (!partyCreated) {
    sleep(1);
    return;
  }
  const partyId = JSON.parse(res.body)[0].id;

  // 2. Tạo customer
  res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/customers`,
    JSON.stringify({
      tenant_id: data.tenantId,
      phone: phone,
      name_mother: `LOAD-MED-CUST-${phone}`,
      status: "active",
    }),
    { headers, tags: { name: "medical.insert_customer" } }
  );

  const customerCreated = check(res, {
    "customer created status 201": (r) => r.status === 201,
  });
  if (!customerCreated) {
    sleep(1);
    return;
  }
  const customerId = JSON.parse(res.body)[0].id;

  // 3. Tạo patient_profile
  res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/patient_profiles`,
    JSON.stringify({
      id: partyId,
      tenant_id: data.tenantId,
      customer_id: customerId,
      blood_type: "O+",
      known_allergies: ["penicillin"],
      bhyt_code: `DN401${phone}`,
      bhyt_benefit_rate: 80,
    }),
    { headers, tags: { name: "medical.insert_profile" } }
  );

  check(res, {
    "patient profile created status 201": (r) => r.status === 201,
  });

  // 4. Tạo journey_journeys (Care Journey)
  res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/journey_journeys`,
    JSON.stringify({
      tenant_id: data.tenantId,
      primary_party_id: partyId,
      vertical: "healthcare",
      journey_type: "outpatient",
      status: "active",
    }),
    { headers, tags: { name: "medical.insert_journey" } }
  );
  
  const journeyCreated = check(res, {
    "care journey created status 201": (r) => r.status === 201,
  });
  if (!journeyCreated) {
    sleep(1);
    return;
  }
  const journeyId = JSON.parse(res.body)[0].id;

  // 5. Tạo Encounter (Khám bệnh)
  res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/hc_encounters`,
    JSON.stringify({
      tenant_id: data.tenantId,
      care_journey_id: journeyId,
      patient_party_id: partyId,
      doctor_party_id: data.doctorId,
      encounter_class: "walk_in",
      status: "in_progress",
      chief_complaint: "Sốt cao 38.5°C, ho khan kéo dài 3 ngày (Load test)",
      notes: "SOAP: S = Sốt ho; O = Phổi thông khí rõ; A = Viêm hô hấp cấp; P = Kê đơn Paracetamol.",
      queue_number: Math.floor(Math.random() * 1000),
    }),
    { headers, tags: { name: "medical.insert_encounter" } }
  );

  const encounterStarted = check(res, {
    "encounter_started": (r) => r.status === 201,
  });
  if (!encounterStarted) {
    sleep(1);
    return;
  }
  const encounterId = JSON.parse(res.body)[0].id;

  // 6. Tạo clinical_order (Chỉ định CLS)
  res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/hc_clinical_orders`,
    JSON.stringify({
      tenant_id: data.tenantId,
      encounter_id: encounterId,
      customer_id: customerId,
      order_type: "laboratory",
      status: "placed",
    }),
    { headers, tags: { name: "medical.insert_clinical_order" } }
  );

  const clinicalOrderCreated = check(res, {
    "clinical order created status 201": (r) => r.status === 201,
  });
  if (!clinicalOrderCreated) {
    sleep(1);
    return;
  }
  const clinicalOrderId = JSON.parse(res.body)[0].id;

  // 7. Tạo lab_order (Chi tiết XN)
  res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/hc_lab_orders`,
    JSON.stringify({
      tenant_id: data.tenantId,
      clinical_order_id: clinicalOrderId,
      encounter_id: encounterId,
      test_code: "CBC-01",
      test_name: "Tổng phân tích tế bào máu ngoại vi (24 thông số)",
      sample_type: "Máu EDTA",
      tube_color: "Tím",
      reference_range: "4.0 - 10.0 G/L",
      result_value: "WBC 11.5 G/L",
      result_unit: "G/L",
      is_panic_value: false,
      is_abnormal: false,
    }),
    { headers, tags: { name: "medical.insert_lab_order" } }
  );

  check(res, {
    "lab_order_created": (r) => r.status === 201,
  });

  // 8. Đưa vào Queue Gọi số (Xếp hàng)
  res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/hc_patient_queues`,
    JSON.stringify({
      tenant_id: data.tenantId,
      encounter_id: encounterId,
      patient_name: `LOAD-MED-PAT-${phone}`,
      ticket_number: `STT-${phone.slice(-3)}`,
      queue_type: "service",
      current_station: "consultation",
      status: "waiting",
    }),
    { headers, tags: { name: "medical.insert_queue" } }
  );

  check(res, {
    "patient queue created status 201": (r) => r.status === 201,
  });

  // Mô phỏng thời gian chờ ngẫu nhiên giữa các VU
  sleep(Math.random() * 0.5 + 0.5);
}

export function teardown(data) {
  console.log(`[medical] Đang tiến hành dọn dẹp dữ liệu test trên tenant: ${data.tenantId}...`);
  const headers = serviceHeaders();

  // 1. Xóa các hàng đợi queue có tên prefix "LOAD-MED-PAT-"
  const delQueue = http.del(
    `${ENV.SUPABASE_URL}/rest/v1/hc_patient_queues?patient_name=like.LOAD-MED-PAT-*&tenant_id=eq.${data.tenantId}`,
    null,
    { headers }
  );
  
  // 2. Xóa các lab_orders của tenant
  const delLab = http.del(
    `${ENV.SUPABASE_URL}/rest/v1/hc_lab_orders?test_code=eq.CBC-01&tenant_id=eq.${data.tenantId}`,
    null,
    { headers }
  );

  // 3. Xóa clinical_orders
  const delClin = http.del(
    `${ENV.SUPABASE_URL}/rest/v1/hc_clinical_orders?order_type=eq.laboratory&tenant_id=eq.${data.tenantId}`,
    null,
    { headers }
  );

  // 4. Xóa encounters có SOAP notes test
  const delEnc = http.del(
    `${ENV.SUPABASE_URL}/rest/v1/hc_encounters?chief_complaint=like.Sốt%20cao*&tenant_id=eq.${data.tenantId}`,
    null,
    { headers }
  );

  // 5. Xóa care journeys
  const delJour = http.del(
    `${ENV.SUPABASE_URL}/rest/v1/journey_journeys?journey_type=eq.outpatient&tenant_id=eq.${data.tenantId}`,
    null,
    { headers }
  );

  // 6. Xóa patient_profiles
  const delProf = http.del(
    `${ENV.SUPABASE_URL}/rest/v1/patient_profiles?bhyt_code=like.DN401*&tenant_id=eq.${data.tenantId}`,
    null,
    { headers }
  );

  // 7. Xóa customers
  const delCust = http.del(
    `${ENV.SUPABASE_URL}/rest/v1/customers?name_mother=like.LOAD-MED-CUST-*&tenant_id=eq.${data.tenantId}`,
    null,
    { headers }
  );

  // 8. Xóa parties
  const delParty = http.del(
    `${ENV.SUPABASE_URL}/rest/v1/party_parties?display_name=like.LOAD-MED-PAT-*&tenant_id=eq.${data.tenantId}`,
    null,
    { headers }
  );

  console.log(`[medical] Hoàn tất dọn dẹp dữ liệu test.`);
}
