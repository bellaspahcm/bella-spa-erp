/**
 * AI COO ASSISTANT ORCHESTRATOR STRESS TEST.
 *
 * Nghiệp vụ: CEO hoặc Kế toán trưởng gửi câu lệnh ngôn ngữ tự nhiên
 * tới AI COO Agent. Hệ thống tự động định tuyến (routedAgent) và truy vấn
 * các báo cáo nghiệp vụ tương ứng (chấm công, quỹ lương, bảng cân đối phát sinh).
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { ENV, assertEnv } from "../config/env.js";
import { loginViaApi, authHeaders } from "../helpers/auth.js";

export const options = {
  stages: [
    { duration: "10s", target: 5 },  // Vì AI điều phối nặng hơn bình thường, tải tăng dần lên 5 VUs
    { duration: "30s", target: 5 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"], // AI Route có định tuyến và query DB nhiều bảng nên cho phép 2s
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
  tags: { test_type: "stress", target: "ai_assistant" },
};

export function setup() {
  assertEnv();
  
  // Login một lần ở setup để lấy token sử dụng xuyên suốt test
  const session = loginViaApi(ENV.ADMIN_EMAIL, ENV.ADMIN_PASSWORD);
  if (!session || !session.access_token) {
    throw new Error("Không thể đăng nhập tài khoản Admin trong setup.");
  }
  
  return { accessToken: session.access_token };
}

export default function (data) {
  const headers = authHeaders(data.accessToken);
  const url = `${ENV.BASE_URL}/api/v1/ai/coo-orchestrator`;

  // Danh sách các lệnh thực tế của CEO để kiểm tra bộ định tuyến (Intent Router)
  const commands = [
    "Phân tích chấm công và tính lương KTV tháng này",
    "Xuất bảng cân đối phát sinh",
    "Đối soát sổ cái và sổ quỹ"
  ];
  
  const randomCommand = commands[Math.floor(Math.random() * commands.length)];
  
  const payload = JSON.stringify({
    command: randomCommand,
    monthYear: new Date().toISOString().split("T")[0] // Lấy ngày hôm nay
  });

  const res = http.post(url, payload, {
    headers,
    tags: { name: "ai.coo_orchestrator" },
  });

  check(res, {
    "AI status is 200": (r) => r.status === 200,
    "routed agent exists": (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.routedAgent === "string" && body.routedAgent.length > 0;
      } catch (e) {
        return false;
      }
    },
    "audit log was recorded": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === "success" && body.sender.includes("AI COO Agent");
      } catch (e) {
        return false;
      }
    }
  });

  sleep(2); // Giãn cách ca gọi để tránh spam quá nhanh
}

export function teardown() {
  console.log("[ai] Hoàn tất stress test AI COO orchestrator.");
}
