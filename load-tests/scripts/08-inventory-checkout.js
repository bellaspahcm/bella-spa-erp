/**
 * INVENTORY CHECKOUT TRANSACTION STRESS TEST.
 *
 * Nghiệp vụ: Mô phỏng hành động KTV hoàn thành ca và trừ kho vật tư tiêu hao.
 * Script tự động khôi phục số lượng tồn kho (rollback/cleanup) trong teardown.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { ENV, assertEnv } from "../config/env.js";
import { serviceHeaders } from "../helpers/auth.js";
import { getHqTenantId } from "../helpers/data.js";

export const options = {
  stages: [
    { duration: "10s", target: 20 },
    { duration: "30s", target: 20 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<800"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
  tags: { test_type: "stress", target: "inventory" },
};

export function setup() {
  assertEnv();
  const tenantId = getHqTenantId();

  // Lấy danh sách vật tư hiện có
  const res = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/inventory_items?select=id,name,stock_level&tenant_id=eq.${tenantId}&limit=5`,
    { headers: serviceHeaders(), tags: { name: "setup.inventory_items" } }
  );

  if (res.status !== 200) {
    throw new Error(`Không thể lấy danh sách vật tư: ${res.status}`);
  }

  const items = JSON.parse(res.body);
  if (!items.length) {
    throw new Error("Không tìm thấy vật tư nào trong tenant HQ");
  }

  return { tenantId, items };
}

export default function (data) {
  const headers = serviceHeaders();
  
  // Chọn 1 vật tư ngẫu nhiên
  const item = data.items[Math.floor(Math.random() * data.items.length)];
  
  // 1) Đọc tồn kho hiện tại để lấy số liệu thực tế
  const getRes = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/inventory_items?select=stock_level&id=eq.${item.id}&tenant_id=eq.${data.tenantId}`,
    { headers, tags: { name: "inventory.get_stock" } }
  );

  const getOk = check(getRes, { "get stock status 200": (r) => r.status === 200 });
  if (!getOk || !getRes.body) {
    sleep(1);
    return;
  }

  const currentItems = JSON.parse(getRes.body);
  if (!currentItems.length) return;
  const currentStock = Number(currentItems[0].stock_level);

  // Nếu hết hàng, bỏ qua vòng này
  if (currentStock <= 0) {
    sleep(1);
    return;
  }

  const deductAmount = 1;
  const newStock = currentStock - deductAmount;

  // 2) Trừ tồn kho (PATCH)
  const patchRes = http.patch(
    `${ENV.SUPABASE_URL}/rest/v1/inventory_items?id=eq.${item.id}&tenant_id=eq.${data.tenantId}`,
    JSON.stringify({ stock_level: newStock }),
    { headers, tags: { name: "inventory.patch_stock" } }
  );

  const patchOk = check(patchRes, { "patch stock status 204/200": (r) => r.status === 200 || r.status === 204 });
  if (!patchOk) {
    sleep(1);
    return;
  }

  // 3) Ghi nhận log tiêu hao (POST)
  const logPayload = JSON.stringify({
    item_id: item.id,
    change_amount: -deductAmount,
    reason: "session_consumption",
    notes: "LOAD-TEST",
    tenant_id: data.tenantId,
  });

  const postRes = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/inventory_logs`,
    logPayload,
    { headers, tags: { name: "inventory.post_log" } }
  );

  check(postRes, { "post log status 201": (r) => r.status === 201 });

  sleep(1);
}

export function teardown(data) {
  const headers = serviceHeaders();
  console.log("[inventory] Đang tiến hành dọn dẹp và hoàn trả tồn kho...");

  // 1) Lấy danh sách log đã ghi nhận trong đợt test
  const getLogsRes = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/inventory_logs?select=id,item_id,change_amount&notes=eq.LOAD-TEST&tenant_id=eq.${data.tenantId}`,
    { headers }
  );

  if (getLogsRes.status !== 200) {
    console.error(`[inventory] Lỗi lấy log dọn dẹp: ${getLogsRes.status}`);
    return;
  }

  const logs = JSON.parse(getLogsRes.body);
  console.log(`[inventory] Phát hiện ${logs.length} logs cần dọn dẹp.`);

  for (const log of logs) {
    const amountToRestore = Math.abs(Number(log.change_amount));
    
    // 2) Lấy tồn kho hiện hành
    const getItemRes = http.get(
      `${ENV.SUPABASE_URL}/rest/v1/inventory_items?select=stock_level&id=eq.${log.item_id}&tenant_id=eq.${data.tenantId}`,
      { headers }
    );
    
    if (getItemRes.status === 200) {
      const items = JSON.parse(getItemRes.body);
      if (items.length) {
        const currentStock = Number(items[0].stock_level);
        const restoredStock = currentStock + amountToRestore;
        
        // 3) Hoàn trả số lượng vật tư
        http.patch(
          `${ENV.SUPABASE_URL}/rest/v1/inventory_items?id=eq.${log.item_id}&tenant_id=eq.${data.tenantId}`,
          JSON.stringify({ stock_level: restoredStock }),
          { headers }
        );
      }
    }

    // 4) Xóa log
    http.del(
      `${ENV.SUPABASE_URL}/rest/v1/inventory_logs?id=eq.${log.id}`,
      null,
      { headers }
    );
  }

  console.log("[inventory] Đã hoàn tất dọn dẹp kho hàng.");
}
