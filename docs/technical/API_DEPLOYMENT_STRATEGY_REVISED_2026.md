# KẾ HOẠCH TRIỂN KHAI API - PHIÊN BẢN THỰC CHIẾN

**Ngày cập nhật**: 17/06/2026  
**Phiên bản**: 2.0 (Revised based on practical considerations)  
**Tác giả**: Kiro AI Agent + User Strategic Input

---

## 🎯 TRIẾT LÝ TRIỂN KHAI MỚI

### Nguyên Tắc Cốt Lõi

> **"Nền móng vững thì mới xây cao được. API Gateway không chắc thì không mở tích hợp lớn."**

**3 Nguyên Tắc Vàng:**

1. **Security First**: Tenant isolation và API security phải hoàn hảo trước khi mở rộng
2. **Money Safety**: Mọi luồng liên quan tiền phải có manual review gate ở giai đoạn đầu
3. **Incremental Rollout**: Mỗi phase phải stable 100% trước khi sang phase tiếp theo

### So Sánh Kế Hoạch Cũ vs Mới

| Khía Cạnh | Kế Hoạch Cũ | Kế Hoạch Mới (Thực Chiến) |
|-----------|-------------|---------------------------|
| **Phase 1** | API Gateway basic | **API Gateway Core + Partner Management** |
| **Focus** | Nhiều tính năng song song | **Từng phase chắc chắn 100%** |
| **Payment** | Webhook đơn giản | **Webhook + Reconciliation Dashboard** |
| **Risk** | Đề cập chung chung | **5 rủi ro critical + mitigation chi tiết** |
| **Testing** | Staging cơ bản | **Partner Sandbox bắt buộc** |
| **Rollout** | Tất cả tenants cùng lúc | **Pilot → Limited → General Availability** |

---


## 📊 PHÂN TÍCH ĐỀ XUẤT CỦA USER

### ✅ Điểm Mạnh Của Đề Xuất

#### 1. **Tái Cấu Trúc Phases Thực Tế Hơn**

**Đánh giá**: ⭐⭐⭐⭐⭐ (5/5)

Kế hoạch cũ có vấn đề:
- Phase 1 quá mỏng (chỉ có basic API Gateway)
- Phase 2-5 overlap quá nhiều tính năng
- Không rõ dependency giữa các phases

Kế hoạch mới khắc phục:
```
Phase 1: API Gateway Core (Nền Móng)
    ↓ (Chắc 100%)
Phase 2: Payment Webhook + Reconciliation
    ↓ (Chắc 100%)
Phase 3: Zalo/SMS Notification
    ↓ (Chắc 100%)
Phase 4: Hóa Đơn Điện Tử
    ↓ (Chắc 100%)
Phase 5: POS/HR Partner Platform
```

**Lợi ích**:
- Mỗi phase có **gate rõ ràng** (không pass thì không sang phase sau)
- Dễ **track progress** (ví dụ: "Đang ở Phase 2, 70% done")
- Giảm **risk cascading** (lỗi phase 2 không ảnh hưởng phase 3)

#### 2. **Phase 1 Đủ Chi Tiết và Quan Trọng Đúng**

**Đánh giá**: ⭐⭐⭐⭐⭐ (5/5)

Kế hoạch cũ thiếu:
- ❌ API key cho partners
- ❌ Partner management UI
- ❌ Sandbox environment
- ❌ Idempotency key enforcement
- ❌ Response standardization

Kế hoạch mới bổ sung đầy đủ:
```
✅ API key / partner key riêng
✅ Tenant mapping rõ ràng
✅ Rate limiting
✅ Request validation
✅ Response chuẩn hóa
✅ Audit log đầy đủ
✅ Idempotency key
✅ Error code chuẩn
✅ API versioning: /api/v1/...
✅ Partner sandbox environment
```

**Quan điểm đúng**: "Làm chưa chắc thì không nên mở tích hợp lớn."


#### 3. **Phase 2 Payment Thêm Reconciliation Dashboard**

**Đánh giá**: ⭐⭐⭐⭐⭐ (5/5)

**Insight quan trọng**: 
> "Phase này nên làm thật chắc vì nó đụng trực tiếp tiền."

Kế hoạch cũ chỉ có:
- ❌ Webhook endpoint
- ❌ Auto-create revenue

Kế hoạch mới thêm:
```
✅ Chuẩn hóa webhook Casso, SePay, PayOS
✅ Mapping mã thanh toán với booking/order/customer
✅ Chống ghi trùng giao dịch
✅ Cơ chế pending/manual review nếu không match được
✅ Tự tạo revenue entry/accounting entry sau khi xác nhận chắc chắn
✅ Dashboard đối soát:
   - Payment nhận được
   - Booking matched
   - Booking unmatched
   - Giao dịch nghi ngờ
```

**Gap trong hệ thống hiện tại**:

Theo `docs/api-reference.md`, webhook hiện tại:
```typescript
// src/app/api/webhooks/payment/route.ts
// Có idempotency ✅
// Có auto-reconcile theo pattern BELLA... ✅
// NHƯNG:
// ❌ Không có manual review flow
// ❌ Không có dashboard unmatched payments
// ❌ Không có suspicious transaction detection
```

**Action Required**:
1. Tạo table `payment_reconciliation_queue`
2. Tạo UI `/admin/payments/reconciliation`
3. Thêm status: `matched`, `unmatched`, `suspicious`, `manual_reviewed`

#### 4. **Phase 3 Zalo/SMS Không Làm Quá Sớm**

**Đánh giá**: ⭐⭐⭐⭐ (4/5)

**Lý do hợp lý**:
- Notification ít rủi ro tài chính hơn Payment
- Nhưng ảnh hưởng trải nghiệm khách hàng
- Không nên làm trước khi payment ổn

**Ghi chú**: Hiện tại đã có `zalo-reminders` cron job, nên phase này có thể nhanh hơn dự kiến.


#### 5. **Phase 4 Hóa Đơn Điện Tử - Checkpoints Chi Tiết**

**Đánh giá**: ⭐⭐⭐⭐⭐ (5/5)

**Insight xuất sắc**:
> "Mảng này không nên làm quá sớm nếu luồng payment/accounting chưa ổn."

**7 Checkpoints Cần Chuẩn** (từ đề xuất):

```
1. Khi nào được phép xuất hóa đơn?
   → Chỉ khi payment confirmed + accounting entry posted

2. Hủy/điều chỉnh hóa đơn xử lý ra sao?
   → Cần workflow: request → approve → reverse accounting

3. Đồng bộ với kế toán thế nào?
   → Hai chiều: invoice → accounting, accounting → invoice

4. Một booking nhiều lần thanh toán thì xuất hóa đơn theo lần hay theo hợp đồng?
   → Policy: Theo từng lần payment hoặc tổng kết (tenant config)

5. Ai được quyền phát hành hóa đơn?
   → RBAC: accountant, admin, authorized_staff

6. Log toàn bộ trạng thái gửi/nhận từ nhà cung cấp hóa đơn
   → Table: invoice_provider_logs (request, response, status)

7. Xử lý lỗi từ provider
   → Retry queue, manual intervention UI
```

**Gap trong kế hoạch cũ**:
- ❌ Không có checkpoints này
- ❌ Chỉ nói "tích hợp VNPT/Viettel/MISA"
- ❌ Không nói rõ business logic

#### 6. **Phase 5 POS/HR Platform - Định Vị Chiến Lược Đúng**

**Đánh giá**: ⭐⭐⭐⭐⭐ (5/5)

**Insight chiến lược**:
> "Bella không cần ôm retail trước, nhưng phải sở hữu lớp dữ liệu vận hành, kế toán, nhân sự và phân tích."

**Vai trò mới của Bella**:

```
┌─────────────────────────────────────────────┐
│  Partner POS (KiotViet, MISA, Sapo)        │
│  • Bán hàng                                 │
│  • Quản lý kho                              │
│  • In hóa đơn                               │
└──────────────────┬──────────────────────────┘
                   │ API Integration
                   ↓
┌─────────────────────────────────────────────┐
│  Bella ERP - Data & Analytics Platform     │
│  ✅ Nhận doanh thu từ POS                   │
│  ✅ Nhận ca làm/chấm công từ HR/POS         │
│  ✅ Đồng bộ vào kế toán                     │
│  ✅ Tính lương/hoa hồng/KPI                 │
│  ✅ AI Analytics                            │
│  ✅ Báo cáo quản trị tập trung              │
└─────────────────────────────────────────────┘
```

**Lợi thế của cách tiếp cận này**:
1. Không phải build POS from scratch (tiết kiệm 12-18 tháng)
2. Tận dụng POS market leaders có sẵn
3. Focus vào **value-add**: Analytics, AI, Multi-location management
4. Dễ scale sang ngành mới (chỉ cần adapter mới, không cần rebuild POS)


---

## ⚠️ 5 RỦI RO CRITICAL & GIẢI PHÁP

### Rủi Ro #1: Sai Tenant Khi Đối Tác Gọi API

**Mức Độ**: 🔴 **CRITICAL** (Risk Level 10/10)

**Kịch Bản Thảm Họa**:
```typescript
// Partner A gọi API với tenant_id của Partner B
POST /api/orders
{
  "tenantId": "tenant_B",  // ❌ Partner A tự inject
  "customerId": "...",
  ...
}
// → Partner A có thể đọc/ghi dữ liệu của Partner B
```

**Hậu Quả**:
- 💰 Mất dữ liệu khách hàng → kiện tụng
- 💰 Vi phạm GDPR/PDPA
- 💰 Mất niềm tin → churn toàn bộ partners
- 💰 Shutdown service khẩn cấp

**Root Cause trong Hệ Thống Hiện Tại**:

Theo `docs/api/phase-3-api-reference.md`:
```typescript
// TenantContext được inject từ session token ✅
// NHƯNG: Nếu có API cho partner (không qua session)?
// → Cần partner_key → tenant_id mapping
```

**Giải Pháp 5 Lớp**:

```typescript
// Layer 1: API Key → Tenant Mapping (Database)
table: api_partners {
  api_key: string (unique, indexed)
  tenant_id: string (foreign key)
  partner_name: string
  allowed_scopes: string[]
  is_active: boolean
}

// Layer 2: Middleware Validation
function apiKeyMiddleware(req) {
  const apiKey = req.headers['x-api-key'];
  const partner = await getPartnerByApiKey(apiKey);
  
  if (!partner || !partner.is_active) {
    throw new Error('Invalid API key');
  }
  
  // ✅ Tenant KHÔNG được truyền từ client
  req.tenantContext = {
    tenantId: partner.tenant_id,  // Resolved từ API key
    partnerId: partner.id,
    allowedScopes: partner.allowed_scopes
  };
  
  // ✅ Block nếu client cố inject tenant_id
  if (req.body.tenantId && req.body.tenantId !== partner.tenant_id) {
    throw new Error('Tenant ID mismatch - potential security breach');
  }
}

// Layer 3: RLS at Database Level
-- PostgreSQL RLS Policy
CREATE POLICY tenant_isolation ON orders
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

// Layer 4: Integration Tests
describe('Tenant Isolation', () => {
  it('Partner A cannot access Partner B data', async () => {
    const partnerA_key = 'key_A';
    const partnerB_key = 'key_B';
    
    // Partner A tạo order
    const orderA = await createOrder(partnerA_key, { ... });
    
    // Partner B TRY đọc order của A
    const attempt = await getOrder(partnerB_key, orderA.id);
    
    expect(attempt).toThrow('Order not found');  // ✅ Should fail
  });
});

// Layer 5: Audit Logging
// Log mọi API call với tenant_id, partner_id, endpoint
// Alert nếu có pattern suspicious (e.g., partner A query nhiều tenant_id khác nhau)
```

**Checklist Bắt Buộc Trước Khi Launch**:
- [ ] API key → tenant mapping table created
- [ ] Middleware blocks client-provided tenant_id
- [ ] RLS policies enabled on all tables
- [ ] Integration tests cover cross-tenant scenarios (100+ cases)
- [ ] Audit logging tracks every API call
- [ ] Security review by external auditor


---

### Rủi Ro #2: Webhook Bị Gửi Lặp

**Mức Độ**: 🟠 **HIGH** (Risk Level 8/10)

**Kịch Bản**:
```
13:00:00 - Casso gửi webhook payment_1 → Bella tạo revenue_1 ✅
13:00:05 - Casso timeout, retry payment_1 → Bella tạo revenue_2 ❌ (TRÙNG!)
13:00:15 - Casso retry lần 3 payment_1 → Bella tạo revenue_3 ❌ (TRÙNG!)

Kết quả: Doanh thu bị ghi TRIPLE!
```

**Hậu Quả**:
- 💰 Báo cáo tài chính sai (inflated revenue)
- 💰 Thuế nộp sai
- 💰 Audit fail
- 💰 KPI sai → bonus sai

**Giải Pháp Hiện Tại**:

Theo code hiện tại (`/api/webhooks/payment`):
```typescript
// ✅ Có check metadata
// ✅ Có check notes cũ
// ❌ NHƯNG: Chưa có idempotency key standard
```

**Giải Pháp Chuẩn**:

```typescript
// Table: payment_webhook_logs
table: webhook_idempotency {
  id: uuid
  idempotency_key: string (unique, indexed)  // external_txn_id
  tenant_id: uuid
  provider: string  // 'casso', 'sepay', 'payos'
  payload: jsonb
  status: enum('processing', 'completed', 'failed')
  created_revenue_id: uuid (nullable)
  processed_at: timestamp
  created_at: timestamp
}

// Webhook Handler với Idempotency
async function handlePaymentWebhook(req) {
  const { transaction_id, amount, content, provider } = req.body;
  
  // Step 1: Generate idempotency key
  const idempotencyKey = `${provider}_${transaction_id}`;
  
  // Step 2: Check if already processed
  const existing = await getByIdempotencyKey(idempotencyKey);
  
  if (existing) {
    if (existing.status === 'completed') {
      // ✅ Already processed, return same result
      return { 
        success: true, 
        revenueId: existing.created_revenue_id,
        message: 'Already processed (idempotent)'
      };
    }
    
    if (existing.status === 'processing') {
      // 🔄 Still processing, ask to retry later
      return { 
        success: false, 
        message: 'Processing in progress, please retry in 5s' 
      };
    }
  }
  
  // Step 3: Create idempotency record with 'processing' status
  await createIdempotencyRecord({
    idempotencyKey,
    tenantId: getTenantFromContent(content),
    provider,
    payload: req.body,
    status: 'processing'
  });
  
  try {
    // Step 4: Process payment
    const revenue = await createRevenue({ amount, content, ... });
    await createAccountingEntry({ ... });
    
    // Step 5: Mark as completed
    await updateIdempotencyRecord(idempotencyKey, {
      status: 'completed',
      created_revenue_id: revenue.id,
      processed_at: new Date()
    });
    
    return { success: true, revenueId: revenue.id };
    
  } catch (error) {
    // Step 6: Mark as failed (can retry)
    await updateIdempotencyRecord(idempotencyKey, {
      status: 'failed',
      error: error.message
    });
    throw error;
  }
}
```

**Checklist**:
- [ ] `webhook_idempotency` table created
- [ ] All webhook handlers use idempotency pattern
- [ ] Test: Send same webhook 10 times → only 1 revenue created
- [ ] Monitoring: Alert if processing > 30s (likely stuck)


---

### Rủi Ro #3: Dữ Liệu Từ POS Đối Tác Không Sạch

**Mức Độ**: 🟡 **MEDIUM** (Risk Level 6/10)

**Kịch Bản**:
```
KiotViet gửi:
{
  "order_id": "POS_123",
  "branch_code": "HN999",  // ❌ Không tồn tại trong Bella
  "sku": "PRODUCT_XYZ",     // ❌ Không map được
  "staff_id": "STAFF_000",  // ❌ Không tồn tại
  "amount": -500000,        // ❌ Số âm (!?)
  "status": "UNKNOWN"       // ❌ Enum không hợp lệ
}
```

**Nếu ghi thẳng vào database**:
- ❌ Foreign key violation
- ❌ Data integrity broken
- ❌ Reports corrupted
- ❌ Accounting mismatch

**Giải Pháp: Staging + Validation Pipeline**

```typescript
// Table: pos_sync_staging
table: pos_sync_staging {
  id: uuid
  partner_id: uuid
  external_order_id: string
  raw_payload: jsonb
  status: enum('pending', 'matched', 'rejected', 'manual_review')
  validation_errors: jsonb[]
  mapped_data: jsonb (nullable)
  processed_at: timestamp (nullable)
  created_at: timestamp
}

// Validation Pipeline
async function processPOSOrder(payload, partnerId) {
  // Step 1: Save to staging
  const staging = await createStaging({
    partnerId,
    external_order_id: payload.order_id,
    raw_payload: payload,
    status: 'pending'
  });
  
  // Step 2: Validation
  const errors = [];
  
  // Validate branch
  const branch = await findBranchByCode(payload.branch_code);
  if (!branch) {
    errors.push({ 
      field: 'branch_code', 
      message: `Branch ${payload.branch_code} not found` 
    });
  }
  
  // Validate SKU
  const product = await findProductBySKU(payload.sku);
  if (!product) {
    errors.push({ 
      field: 'sku', 
      message: `Product SKU ${payload.sku} not mapped` 
    });
  }
  
  // Validate amount
  if (payload.amount <= 0) {
    errors.push({ 
      field: 'amount', 
      message: 'Amount must be positive' 
    });
  }
  
  // Validate status
  const validStatuses = ['COMPLETED', 'CANCELLED', 'REFUNDED'];
  if (!validStatuses.includes(payload.status)) {
    errors.push({ 
      field: 'status', 
      message: `Invalid status: ${payload.status}` 
    });
  }
  
  // Step 3: Decide status
  if (errors.length === 0) {
    // ✅ All good → matched
    await updateStaging(staging.id, {
      status: 'matched',
      mapped_data: {
        branch_id: branch.id,
        product_id: product.id,
        amount: payload.amount,
        status: mapStatus(payload.status)
      }
    });
    
    // Auto-process (hoặc wait manual approval)
    await createOrderFromStaging(staging.id);
    
  } else if (errors.length <= 2 && !isCriticalError(errors)) {
    // 🟡 Minor issues → manual review
    await updateStaging(staging.id, {
      status: 'manual_review',
      validation_errors: errors
    });
    
    // Notify admin
    await notifyAdmin('POS data needs review', staging.id);
    
  } else {
    // ❌ Too many errors → rejected
    await updateStaging(staging.id, {
      status: 'rejected',
      validation_errors: errors
    });
  }
}

// Admin UI: /admin/pos-sync-queue
// - Tab "Pending": chờ xử lý
// - Tab "Manual Review": cần duyệt tay
// - Tab "Rejected": bị từ chối (có thể retry sau khi fix mapping)
```

**Checklist**:
- [ ] Staging table created
- [ ] Validation rules cover 100% fields
- [ ] Admin UI for manual review
- [ ] Alerting for high rejection rate (>10%)


---

### Rủi Ro #4: Tự Động Hạch Toán Quá Sớm

**Mức Độ**: 🟠 **HIGH** (Risk Level 7/10)

**Kịch Bản**:
```
Payment received → Revenue created → Accounting entry posted
    ↓                    ↓                    ↓
  Auto               Auto                  Auto
  
→ Nếu logic sai → Báo cáo tài chính sai → Không rollback được
```

**Ví dụ Thực Tế**:
1. Webhook nhận payment 5,000,000đ
2. Auto-create revenue với category "Dịch vụ spa"
3. Auto-post accounting entry: Debit 1121, Credit 5111
4. **Sau đó phát hiện**: Payment này là deposit cho tháng sau (chưa phải revenue!)
5. **Vấn đề**: Đã post vào accounting → phải reverse → báo cáo tháng này sai

**Giải Pháp: Giai Đoạn Bán Tự Động**

```typescript
// Phase 2A (Launch): Manual Approval Required
async function handlePaymentWebhook(req) {
  // Step 1: Tạo payment record ✅
  const payment = await createPayment({ ... });
  
  // Step 2: Match với booking (nếu có) ✅
  const booking = await matchBooking(payment.content);
  
  // Step 3: Tạo DRAFT revenue (chưa confirm) ⚠️
  const revenue = await createRevenue({
    ...payment,
    status: 'draft',  // ← Key: chưa confirm
    needs_approval: true
  });
  
  // Step 4: AI đề xuất bút toán (chưa post) ⚠️
  const suggestedEntry = await aiSuggestAccountingEntry(revenue);
  
  // Step 5: Tạo accounting entry với status PENDING
  const entry = await createAccountingEntry({
    ...suggestedEntry,
    status: 'pending_approval',  // ← Key: chưa post
    suggested_by: 'ai',
    requires_review: true
  });
  
  // Step 6: Notify accountant
  await notifyAccountant({
    type: 'payment_received',
    payment_id: payment.id,
    revenue_id: revenue.id,
    accounting_entry_id: entry.id,
    action_required: 'review_and_approve'
  });
  
  return { 
    success: true, 
    status: 'pending_approval',
    message: 'Payment received, waiting for accountant approval'
  };
}

// Accountant Approval UI: /admin/accounting/pending
function AccountingApprovalUI() {
  const pendingEntries = usePendingAccountingEntries();
  
  return (
    <div>
      <h2>Pending Accounting Entries ({pendingEntries.length})</h2>
      {pendingEntries.map(entry => (
        <EntryCard key={entry.id}>
          <AIConfidence score={entry.ai_confidence} />
          <DebitCredit debit={entry.debit} credit={entry.credit} />
          <Buttons>
            <button onClick={() => approve(entry.id)}>
              ✅ Approve & Post
            </button>
            <button onClick={() => edit(entry.id)}>
              ✏️ Edit Entry
            </button>
            <button onClick={() => reject(entry.id)}>
              ❌ Reject
            </button>
          </Buttons>
        </EntryCard>
      ))}
      
      <BatchApprove>
        {/* Approve multiple entries at once if AI confidence > 95% */}
        <button onClick={batchApproveHighConfidence}>
          ✅ Batch Approve (Confidence > 95%)
        </button>
      </BatchApprove>
    </div>
  );
}

// Phase 2B (After 3 Months): Auto-post nếu AI confidence > 98%
async function handlePaymentWebhook_Mature(req) {
  // ... same steps ...
  
  // Step 7: Check AI confidence
  if (suggestedEntry.ai_confidence > 0.98 && booking.is_matched) {
    // ✅ High confidence → auto-post
    await postAccountingEntry(entry.id);
    revenue.status = 'confirmed';
    entry.status = 'posted';
  } else {
    // ⚠️ Low confidence → manual review
    entry.status = 'pending_approval';
  }
}
```

**Rollout Plan**:
- **Month 1-3**: 100% manual approval
- **Month 4-6**: Auto-post if AI confidence > 98% + matched booking
- **Month 7+**: Auto-post if AI confidence > 95%

**Checklist**:
- [ ] Draft/pending status for revenue & accounting entries
- [ ] Accountant approval UI built
- [ ] Batch approval support
- [ ] AI confidence tracking
- [ ] Monthly review of AI accuracy


---

### Rủi Ro #5: API Versioning Không Rõ

**Mức Độ**: 🟡 **MEDIUM** (Risk Level 5/10)

**Kịch Bản**:
```
Tháng 1: Partner A tích hợp với API /api/orders (không version)
Tháng 6: Bella đổi field `customer_id` thành `customerId`
→ Partner A app crash ❌
```

**Giải Pháp Đã Có**:

Theo `docs/api-versioning-policy.md`:
```
✅ Có policy: /api/v1/...
✅ Có deprecation 30 ngày
✅ Có migration notes
```

**NHƯNG: Thiếu CI Enforcement**

**Giải Pháp Bổ Sung: CI Check**

```typescript
// scripts/check-api-versioning.ts
import { readdir } from 'fs/promises';
import { join } from 'path';

async function checkAPIVersioning() {
  const apiDir = 'src/app/api';
  const routes = await findAllRouteFiles(apiDir);
  
  const violations = [];
  
  for (const route of routes) {
    // Allowed patterns:
    // ✅ /api/v1/...
    // ✅ /api/webhooks/...
    // ✅ /api/cron/...
    // ✅ /api/test-upcoming (dev only)
    
    const allowedPrefixes = [
      '/api/v1/',
      '/api/webhooks/',
      '/api/cron/',
      '/api/test-upcoming'
    ];
    
    const isAllowed = allowedPrefixes.some(prefix => 
      route.startsWith(prefix)
    );
    
    if (!isAllowed) {
      violations.push({
        route,
        message: `Route must start with /api/v1/ or /api/webhooks/ or /api/cron/`
      });
    }
  }
  
  if (violations.length > 0) {
    console.error('❌ API Versioning Violations Found:');
    violations.forEach(v => {
      console.error(`  - ${v.route}: ${v.message}`);
    });
    process.exit(1);  // ← Block CI
  }
  
  console.log('✅ All API routes follow versioning policy');
}

checkAPIVersioning();
```

**GitHub Actions Workflow**:

```yaml
# .github/workflows/api-versioning-check.yml
name: API Versioning Check

on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run check:api-versioning  # ← Block merge if fail
```

**Changelog Management**:

```markdown
# API_CHANGELOG.md

## v1.1.0 (2026-07-01)

### Added
- `POST /api/v1/invoices` - Create e-invoice
- `GET /api/v1/invoices/:id` - Get invoice details

### Changed
- `GET /api/v1/orders` - Added `invoice_id` field (optional)

### Deprecated
- None

### Removed
- None

### Migration Guide
No breaking changes. Backward compatible.

---

## v1.0.0 (2026-06-01)

Initial release.
```

**Checklist**:
- [ ] CI script `check-api-versioning.ts` created
- [ ] GitHub Actions workflow added
- [ ] `API_CHANGELOG.md` maintained
- [ ] Deprecation notices in API responses:
  ```json
  {
    "data": { ... },
    "deprecation": {
      "endpoint": "/api/bookings",
      "message": "This endpoint is deprecated. Use /api/v1/orders instead.",
      "sunset_date": "2026-12-31"
    }
  }
  ```


---

## 🔧 6 MỤC BỔ SUNG VÀO HỆ THỐNG

### Bổ Sung #1: Partner Management System

**Mục đích**: Quản lý tập trung tất cả đối tác tích hợp

**Database Schema**:

```sql
-- Table: api_partners
CREATE TABLE api_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Partner Info
  partner_name VARCHAR(255) NOT NULL,
  partner_type VARCHAR(50) NOT NULL, -- 'pos', 'payment', 'invoice', 'franchise'
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  
  -- API Credentials
  api_key VARCHAR(255) UNIQUE NOT NULL,
  api_secret VARCHAR(255),  -- For HMAC signing (nullable)
  webhook_url TEXT,         -- For outbound webhooks
  webhook_secret VARCHAR(255),
  
  -- Access Control
  allowed_scopes TEXT[],    -- ['payment:read', 'order:write', etc.]
  is_active BOOLEAN DEFAULT TRUE,
  is_sandbox BOOLEAN DEFAULT FALSE,
  
  -- Rate Limiting
  rate_limit_per_minute INT DEFAULT 100,
  rate_limit_per_day INT DEFAULT 5000,
  
  -- Monitoring
  last_request_at TIMESTAMP,
  total_requests_count BIGINT DEFAULT 0,
  failed_requests_count BIGINT DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_partners_api_key ON api_partners(api_key);
CREATE INDEX idx_api_partners_tenant_id ON api_partners(tenant_id);

-- Table: api_request_logs
CREATE TABLE api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES api_partners(id),
  tenant_id UUID REFERENCES tenants(id),
  
  -- Request Info
  method VARCHAR(10) NOT NULL,
  endpoint TEXT NOT NULL,
  request_body JSONB,
  request_headers JSONB,
  
  -- Response Info
  status_code INT NOT NULL,
  response_body JSONB,
  response_time_ms INT,
  
  -- Error Tracking
  is_error BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  error_code VARCHAR(50),
  
  -- Audit
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_request_logs_partner_id ON api_request_logs(partner_id);
CREATE INDEX idx_api_request_logs_created_at ON api_request_logs(created_at);
```

**Admin UI Features** (`/admin/partners`):

```typescript
// Partner Management UI
function PartnerManagementPage() {
  return (
    <Layout>
      <PageHeader>
        <h1>API Partners</h1>
        <Button onClick={createNewPartner}>+ New Partner</Button>
      </PageHeader>
      
      <PartnersTable>
        <Columns>
          <Column>Partner Name</Column>
          <Column>Type</Column>
          <Column>API Key</Column>
          <Column>Status</Column>
          <Column>Last Request</Column>
          <Column>Actions</Column>
        </Columns>
        
        <Rows>
          {partners.map(p => (
            <Row key={p.id}>
              <Cell>{p.partner_name}</Cell>
              <Cell><Badge>{p.partner_type}</Badge></Cell>
              <Cell>
                <Code>{p.api_key.slice(0, 12)}...</Code>
                <CopyButton value={p.api_key} />
              </Cell>
              <Cell>
                <StatusBadge active={p.is_active} />
                {p.is_sandbox && <Badge>Sandbox</Badge>}
              </Cell>
              <Cell>{formatDate(p.last_request_at)}</Cell>
              <Cell>
                <IconButton onClick={() => viewLogs(p.id)}>
                  📊 Logs
                </IconButton>
                <IconButton onClick={() => editPartner(p.id)}>
                  ✏️ Edit
                </IconButton>
                <IconButton onClick={() => regenerateKey(p.id)}>
                  🔄 Rotate Key
                </IconButton>
              </Cell>
            </Row>
          ))}
        </Rows>
      </PartnersTable>
      
      <PartnerDetails selectedPartnerId={selectedId}>
        <Tabs>
          <Tab>Overview</Tab>
          <Tab>Scopes</Tab>
          <Tab>Rate Limits</Tab>
          <Tab>Request Logs</Tab>
          <Tab>Webhooks</Tab>
        </Tabs>
        
        <TabPanel name="Overview">
          <MetricCards>
            <Card>
              <Label>Total Requests (30d)</Label>
              <Value>{stats.total_requests}</Value>
            </Card>
            <Card>
              <Label>Success Rate</Label>
              <Value>{stats.success_rate}%</Value>
            </Card>
            <Card>
              <Label>Avg Response Time</Label>
              <Value>{stats.avg_response_ms}ms</Value>
            </Card>
          </MetricCards>
          
          <Chart>
            <RequestsOverTimeChart partnerId={selectedId} />
          </Chart>
        </TabPanel>
        
        <TabPanel name="Scopes">
          <ScopeEditor 
            scopes={selectedPartner.allowed_scopes}
            onSave={updateScopes}
          />
        </TabPanel>
        
        {/* ... other tabs ... */}
      </PartnerDetails>
    </Layout>
  );
}
```

**Checklist**:
- [ ] `api_partners` & `api_request_logs` tables created
- [ ] Partner management UI at `/admin/partners`
- [ ] API key generation/rotation
- [ ] Scope management UI
- [ ] Request logs viewer with filters


---

### Bổ Sung #2: API Scope System

**Mục đích**: Fine-grained access control cho partners

**Scope Design**:

```typescript
// Scope Format: <resource>:<action>
type APIScope = 
  // Orders
  | 'order:read'
  | 'order:write'
  | 'order:complete'
  | 'order:cancel'
  // Payments
  | 'payment:read'
  | 'payment:write'
  | 'payment:refund'
  // Invoices
  | 'invoice:read'
  | 'invoice:create'
  | 'invoice:cancel'
  // POS Sync
  | 'pos:sync'
  | 'pos:read'
  // HR Sync
  | 'hr:sync'
  | 'hr:read'
  // Analytics (read-only)
  | 'analytics:read'
  // Webhooks
  | 'webhook:subscribe'
  | 'webhook:read';

// Middleware: Check Scope
function requireScope(requiredScope: APIScope) {
  return (req, res, next) => {
    const partner = req.partner;  // From apiKeyMiddleware
    
    if (!partner.allowed_scopes.includes(requiredScope)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'SCOPE_ERROR',
        message: `This API key does not have '${requiredScope}' scope`,
        required_scope: requiredScope,
        your_scopes: partner.allowed_scopes
      });
    }
    
    next();
  };
}

// Usage in Route
app.post('/api/v1/orders',
  apiKeyMiddleware,
  requireScope('order:write'),  // ← Check scope
  async (req, res) => {
    // ... create order ...
  }
);
```

**Preset Scope Bundles**:

```typescript
const SCOPE_PRESETS = {
  // Basic partner (read-only)
  'basic': [
    'order:read',
    'payment:read',
    'analytics:read'
  ],
  
  // POS integration
  'pos_integration': [
    'order:read',
    'order:write',
    'payment:read',
    'payment:write',
    'pos:sync',
    'pos:read'
  ],
  
  // Payment gateway
  'payment_gateway': [
    'order:read',
    'payment:read',
    'payment:write',
    'webhook:subscribe'
  ],
  
  // HR platform
  'hr_platform': [
    'hr:sync',
    'hr:read',
    'order:read',
    'analytics:read'
  ],
  
  // E-Invoice provider
  'invoice_provider': [
    'invoice:read',
    'invoice:create',
    'invoice:cancel',
    'order:read',
    'payment:read'
  ],
  
  // Full access (admin)
  'admin': [
    'order:*',
    'payment:*',
    'invoice:*',
    'pos:*',
    'hr:*',
    'analytics:*',
    'webhook:*'
  ]
};
```

**Checklist**:
- [ ] Scope system implemented
- [ ] Middleware `requireScope()` added
- [ ] All endpoints protected with scope checks
- [ ] UI to assign scopes to partners
- [ ] Documentation of all available scopes


---

### Bổ Sung #3: Sandbox/Test Environment

**Mục đích**: Cho partners test integration trước khi lên production

**Architecture**:

```
┌────────────────────────────────────────┐
│  Production Environment                │
│  • Real tenants                        │
│  • Real money                          │
│  • API key: pk_live_...                │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  Sandbox Environment                   │
│  • Test tenants                        │
│  • Fake money                          │
│  • API key: pk_test_...                │
│  • Same API endpoints                  │
│  • Separate database                   │
└────────────────────────────────────────┘
```

**Implementation Options**:

**Option 1: Separate Database (Recommended)**

```typescript
// config/database.ts
export function getDatabaseConfig(apiKey: string) {
  if (apiKey.startsWith('pk_test_')) {
    return {
      host: process.env.SANDBOX_DB_HOST,
      database: 'bella_erp_sandbox',
      // ... sandbox DB config
    };
  }
  
  return {
    host: process.env.PROD_DB_HOST,
    database: 'bella_erp_production',
    // ... production DB config
  };
}
```

**Option 2: Flag-based (Easier to implement)**

```sql
-- Add is_sandbox flag to tenants
ALTER TABLE tenants ADD COLUMN is_sandbox BOOLEAN DEFAULT FALSE;

-- Sandbox tenants have special prefix
INSERT INTO tenants (id, name, is_sandbox) VALUES
  ('sandbox_001', 'Test Spa A', TRUE),
  ('sandbox_002', 'Test Nail Salon B', TRUE);
```

**Sandbox Features**:

```typescript
// Sandbox Mode Behaviors
const SANDBOX_BEHAVIORS = {
  // 1. Payment không thực
  processPayment: async (amount) => {
    if (isSandbox()) {
      // Fake success after 2s
      await sleep(2000);
      return { success: true, transaction_id: 'test_' + randomId() };
    }
    return realPaymentGateway.process(amount);
  },
  
  // 2. Webhook gửi ngay lập tức (không đợi external service)
  sendWebhook: async (url, payload) => {
    if (isSandbox()) {
      // Log webhook để partner debug
      await logWebhook({ url, payload, is_sandbox: true });
      // Fake delivery
      return { delivered: true, delivered_at: new Date() };
    }
    return realWebhookService.send(url, payload);
  },
  
  // 3. E-Invoice không gửi thật
  createInvoice: async (data) => {
    if (isSandbox()) {
      return { 
        invoice_id: 'INV_TEST_' + randomId(),
        status: 'issued',
        pdf_url: '/sandbox/invoices/test.pdf'
      };
    }
    return vnptInvoiceAPI.create(data);
  },
  
  // 4. Zalo/SMS không gửi thật
  sendNotification: async (phone, message) => {
    if (isSandbox()) {
      await logNotification({ phone, message, is_sandbox: true });
      return { sent: true, message_id: 'test_' + randomId() };
    }
    return zaloAPI.send(phone, message);
  }
};
```

**Sandbox Dashboard** (`/sandbox/dashboard`):

```typescript
function SandboxDashboard() {
  return (
    <Layout>
      <Alert type="info">
        🧪 You are in SANDBOX mode. No real transactions will be processed.
      </Alert>
      
      <QuickActions>
        <Button onClick={createTestBooking}>
          Create Test Booking
        </Button>
        <Button onClick={simulatePayment}>
          Simulate Payment
        </Button>
        <Button onClick={triggerWebhook}>
          Trigger Test Webhook
        </Button>
      </QuickActions>
      
      <Section title="Recent API Calls">
        <RequestsList>
          {recentRequests.map(req => (
            <RequestCard key={req.id}>
              <Method>{req.method}</Method>
              <Endpoint>{req.endpoint}</Endpoint>
              <Status code={req.status_code} />
              <ViewButton onClick={() => showDetails(req)}>
                View Details
              </ViewButton>
            </RequestCard>
          ))}
        </RequestsList>
      </Section>
      
      <Section title="Webhook Logs">
        <WebhooksList>
          {webhooks.map(wh => (
            <WebhookCard key={wh.id}>
              <Timestamp>{wh.created_at}</Timestamp>
              <Event>{wh.event_type}</Event>
              <DeliveryStatus success={wh.delivered} />
              <ViewPayloadButton onClick={() => showPayload(wh)}>
                View Payload
              </ViewPayloadButton>
            </WebhookCard>
          ))}
        </WebhooksList>
      </Section>
      
      <Section title="Test Data Tools">
        <Button onClick={resetTestData}>
          🗑️ Reset All Test Data
        </Button>
        <Button onClick={generateSampleData}>
          🎲 Generate Sample Data
        </Button>
      </Section>
    </Layout>
  );
}
```

**Checklist**:
- [ ] Sandbox database or flag-based isolation
- [ ] Sandbox API keys (`pk_test_...`)
- [ ] All external calls mocked in sandbox
- [ ] Sandbox dashboard for partners
- [ ] "Reset test data" function
- [ ] Sample data generator


---

### Bổ Sung #4: Monitoring Dashboard

**Mục đích**: Giám sát real-time API health

**Key Metrics to Track**:

```typescript
// Real-time Metrics
interface APIMetrics {
  // Request Volume
  requests_per_minute: number;
  requests_today: number;
  
  // Error Rates
  error_rate: number;  // %
  errors_last_hour: number;
  top_error_codes: { code: string; count: number }[];
  
  // Performance
  avg_response_time_ms: number;
  p95_response_time_ms: number;
  p99_response_time_ms: number;
  slowest_endpoints: { endpoint: string; avg_ms: number }[];
  
  // Webhooks
  webhook_success_rate: number;
  webhook_failures_last_hour: number;
  webhook_retry_queue_size: number;
  
  // Payments
  payment_unmatched_count: number;
  payment_suspicious_count: number;
  
  // Invoices
  invoice_failed_count: number;
  
  // Partners
  top_api_consumers: { partner: string; requests: number }[];
  partners_hitting_rate_limit: string[];
}
```

**Dashboard UI** (`/admin/api-monitoring`):

```typescript
// Components: Charts, Alerts, Top Errors
function APIMonitoringDashboard() {
  const metrics = useRealTimeMetrics();  // WebSocket or polling
  
  return (
    <DashboardLayout>
      <AlertBanner>
        {metrics.critical_alerts.map(alert => (
          <Alert key={alert.id} severity="error">
            {alert.message}
          </Alert>
        ))}
      </AlertBanner>
      
      <MetricsGrid>
        <MetricCard 
          title="Requests/min" 
          value={metrics.requests_per_minute}
          trend={metrics.requests_trend}
          threshold={500}
        />
        <MetricCard 
          title="Error Rate" 
          value={`${metrics.error_rate}%`}
          status={metrics.error_rate > 5 ? 'critical' : 'ok'}
        />
        <MetricCard 
          title="Avg Response Time" 
          value={`${metrics.avg_response_time_ms}ms`}
          status={metrics.avg_response_time_ms > 500 ? 'warning' : 'ok'}
        />
        <MetricCard 
          title="Webhook Success" 
          value={`${metrics.webhook_success_rate}%`}
          status={metrics.webhook_success_rate < 95 ? 'warning' : 'ok'}
        />
      </MetricsGrid>
      
      <ChartsRow>
        <Chart title="Requests Over Time (24h)">
          <LineChart data={metrics.requests_timeline} />
        </Chart>
        <Chart title="Error Rate (24h)">
          <LineChart data={metrics.error_timeline} />
        </Chart>
      </ChartsRow>
      
      <TablesRow>
        <Table title="Top Error Endpoints">
          {metrics.top_error_endpoints.map(e => (
            <Row key={e.endpoint}>
              <Cell>{e.endpoint}</Cell>
              <Cell>{e.error_count}</Cell>
              <Cell><Button onClick={() => viewLogs(e)}>View Logs</Button></Cell>
            </Row>
          ))}
        </Table>
        
        <Table title="Slowest Endpoints">
          {metrics.slowest_endpoints.map(e => (
            <Row key={e.endpoint}>
              <Cell>{e.endpoint}</Cell>
              <Cell>{e.avg_ms}ms</Cell>
              <Cell><Button onClick={() => profile(e)}>Profile</Button></Cell>
            </Row>
          ))}
        </Table>
      </TablesRow>
    </DashboardLayout>
  );
}
```

---

### Bổ Sung #5: Data Contract Documentation

**Mục đích**: Mỗi integration có contract rõ ràng

**Contract Format**:

```yaml
# contracts/pos_integration.yml
name: POS Integration
version: 1.0.0
description: Integration contract for POS systems (KiotViet, MISA, Sapo)

endpoints:
  - endpoint: POST /api/v1/pos/orders
    description: Sync order from POS to Bella ERP
    
    request:
      content_type: application/json
      required_fields:
        - name: external_order_id
          type: string
          description: Order ID from POS system
          example: "ORDER_12345"
          
        - name: branch_code
          type: string
          description: Branch code (must be pre-registered in Bella)
          example: "HN001"
          
        - name: order_date
          type: string
          format: ISO 8601
          description: Order date and time
          example: "2026-06-17T14:30:00Z"
          
        - name: items
          type: array
          description: Order items
          items:
            - sku: string (required)
            - quantity: number (required, > 0)
            - unit_price: number (required, >= 0)
            
        - name: total_amount
          type: number
          description: Total order amount
          minimum: 0
          example: 500000
          
      optional_fields:
        - name: customer_phone
          type: string
          pattern: "^0[0-9]{9,10}$"
          example: "0987654321"
          
        - name: notes
          type: string
          max_length: 500
          
    response:
      success:
        status_code: 201
        body:
          bella_order_id: string
          status: string (enum: "matched", "pending_review")
          mapped_data: object
          
      error:
        status_codes: [400, 404, 422, 500]
        body:
          error: string
          code: string
          details: object
          
    business_rules:
      - rule: branch_code must exist in Bella tenants
        error_code: "BRANCH_NOT_FOUND"
        
      - rule: All SKUs must be pre-registered
        error_code: "SKU_NOT_MAPPED"
        
      - rule: total_amount must equal sum of (quantity * unit_price)
        error_code: "AMOUNT_MISMATCH"
        
    mapping:
      bella_field: pos_field
      branch_id: resolved from branch_code
      customer_id: resolved from customer_phone (or create new)
      order_items: mapped from items with SKU lookup
```

---

### Bổ Sung #6: Comprehensive Test Suite

**Test Coverage Requirements**:

```typescript
// 1. Unit Tests (Services, Utilities)
describe('Payment Reconciliation Service', () => {
  it('should match payment to booking by BELLA pattern', ...);
  it('should handle duplicate payment webhook', ...);
  it('should create revenue only after confirmation', ...);
});

// 2. Integration Tests (API Endpoints)
describe('POST /api/v1/orders', () => {
  it('should create order with valid data', ...);
  it('should reject order with invalid tenant', ...);
  it('should enforce API scope', ...);
  it('should rate limit after threshold', ...);
});

// 3. Security Tests (Tenant Isolation)
describe('Tenant Isolation', () => {
  it('Partner A cannot read Partner B orders', ...);
  it('API key from Tenant A cannot access Tenant B', ...);
  it('Malicious tenant_id injection should fail', ...);
});

// 4. Load Tests (Performance)
describe('API Load Tests', () => {
  it('should handle 1000 req/min', ...);
  it('should maintain <200ms response under load', ...);
});

// 5. E2E Tests (Full Workflows)
describe('Payment Webhook → Revenue Flow', () => {
  it('should auto-create revenue for matched payment', ...);
  it('should queue unmatched payment for review', ...);
  it('should not duplicate revenue on webhook retry', ...);
});
```

**Checklist**:
- [ ] Unit test coverage > 90%
- [ ] Integration tests for all API endpoints
- [ ] Security tests for tenant isolation
- [ ] Load tests passing (1000 req/min sustained)
- [ ] E2E tests for critical workflows


---

## 📅 TIMELINE THỰC CHIẾN (REVISED)

### Phase 1: API Gateway Core (6-8 tuần)

**Mục tiêu**: Nền móng vững chắc 100% trước khi mở tích hợp

**Week 1-2: Partner Management**
- [ ] Database schema (`api_partners`, `api_request_logs`)
- [ ] API key generation & rotation
- [ ] Admin UI `/admin/partners`
- [ ] API key → tenant mapping middleware

**Week 3-4: API Scope & Security**
- [ ] Scope system implementation
- [ ] Middleware `requireScope()`
- [ ] Tenant isolation tests (100+ cases)
- [ ] Security audit by external auditor

**Week 5-6: Rate Limiting & Validation**
- [ ] Redis-based rate limiter
- [ ] Request validation middleware
- [ ] Response standardization
- [ ] Error code catalog

**Week 7-8: Sandbox & Documentation**
- [ ] Sandbox environment setup
- [ ] Test data generator
- [ ] Partner API documentation
- [ ] Postman collection v2

**Gate để sang Phase 2**:
- ✅ Security audit PASSED
- ✅ 100+ tenant isolation tests PASSED
- ✅ Rate limiting working under load test
- ✅ At least 1 pilot partner completed sandbox testing

---

### Phase 2: Payment Webhook + Reconciliation (4-6 tuần)

**Mục tiêu**: Luồng tiền chắc chắn, không mất doanh thu, không ghi trùng

**Week 1-2: Idempotency & Staging**
- [ ] `webhook_idempotency` table
- [ ] `payment_reconciliation_queue` table
- [ ] Idempotency middleware for all webhooks
- [ ] Webhook retry logic with exponential backoff

**Week 3-4: Reconciliation Dashboard**
- [ ] UI `/admin/payments/reconciliation`
- [ ] Matched/unmatched/suspicious tabs
- [ ] Manual review workflow
- [ ] Batch approval support

**Week 5-6: AI & Automation**
- [ ] AI confidence scoring for auto-match
- [ ] Pattern detection (BELLA..., SUB...)
- [ ] Suspicious transaction detection
- [ ] Monitoring dashboard

**Rollout Plan**:
- **Week 1-4**: 100% manual approval
- **Week 5-6**: Pilot with 2 tenants (auto-post if confidence > 98%)
- **Week 7-8**: Expand to 10 tenants
- **Week 9+**: General availability

**Gate để sang Phase 3**:
- ✅ 0 duplicate revenue incidents trong 4 tuần
- ✅ Unmatched rate < 5%
- ✅ Manual review time < 2 phút/payment
- ✅ Webhook success rate > 98%

---

### Phase 3: Zalo & SMS Notification (3-4 tuần)

**Mục tiêu**: Giao tiếp tự động với khách hàng

**Week 1: Zalo OA Integration**
- [ ] Zalo OA API wrapper
- [ ] Template approval workflow
- [ ] Message queue system

**Week 2: SMS Gateway**
- [ ] VNPT/Viettel/Mobifone adapters
- [ ] Fallback logic (Zalo fail → SMS)
- [ ] Cost tracking per message

**Week 3: Notification Triggers**
- [ ] Booking confirmed → Zalo
- [ ] Payment received → Zalo
- [ ] Session reminder (24h before) → Zalo/SMS
- [ ] Package expiring → Zalo

**Week 4: Testing & Rollout**
- [ ] Sandbox testing
- [ ] Pilot with 5 tenants
- [ ] Opt-in/opt-out management

**Gate để sang Phase 4**:
- ✅ Message delivery rate > 95%
- ✅ Customer opt-out rate < 2%
- ✅ No spam complaints
- ✅ Cost per message within budget

---

### Phase 4: Hóa Đơn Điện Tử (4-6 tuần)

**Mục tiêu**: Tự động xuất hóa đơn, đồng bộ kế toán

**Week 1-2: VNPT Invoice Pilot**
- [ ] VNPT Invoice API integration
- [ ] Invoice issuance workflow
- [ ] Approval gates (who can issue)

**Week 3: Cancel/Adjust Invoice**
- [ ] Invoice cancellation workflow
- [ ] Reverse accounting entry logic
- [ ] Admin approval for adjustments

**Week 4: Accounting Sync**
- [ ] Bi-directional sync (invoice ↔ accounting)
- [ ] Reconciliation reports
- [ ] Audit trail

**Week 5-6: Expand to Viettel/MISA**
- [ ] Viettel eSinvoice adapter
- [ ] MISA eFast adapter
- [ ] Provider failover logic

**Rollout Plan**:
- **Week 1-3**: VNPT only, 2 pilot tenants
- **Week 4-6**: Add Viettel/MISA, 10 tenants
- **Week 7+**: General availability

**Gate để sang Phase 5**:
- ✅ Invoice issuance success rate > 99%
- ✅ Accounting sync 100% accurate
- ✅ No tax compliance issues
- ✅ Provider response time < 5s

---

### Phase 5: POS/HR Partner Platform (8-12 tuần)

**Mục tiêu**: Bella trở thành data & analytics hub, không ôm POS

**Week 1-4: KiotViet Pilot**
- [ ] KiotViet API adapter
- [ ] POS data staging & validation
- [ ] Manual review UI
- [ ] Mapping tools (SKU, branch, staff)

**Week 5-8: HR Data Sync**
- [ ] Attendance sync from POS
- [ ] Salary calculation integration
- [ ] KPI sync from POS sessions
- [ ] Commission calculation

**Week 9-12: Analytics & Reporting**
- [ ] Multi-location dashboard
- [ ] AI Analytics on POS + HR data
- [ ] Consolidated P&L reports
- [ ] Cross-brand insights

**Pilot Partners**:
1. KiotViet (POS) - 2 F&B tenants
2. MISA (POS + HR) - 1 retail tenant
3. Internal Bella POS (for spa/nail/hair) - 5 beauty tenants

**Gate để complete Phase 5**:
- ✅ 3 pilot partners live and stable
- ✅ Data accuracy > 98%
- ✅ Sync latency < 5 minutes
- ✅ Partner satisfaction score > 4/5

---

## 🎯 KẾT LUẬN & KHUYẾN NGHỊ

### Điểm Mạnh Của Kế Hoạch Mới

1. ✅ **Phase 1 đủ mạnh**: Partner management, sandbox, scope system
2. ✅ **Phase 2 an toàn**: Manual approval → semi-auto → auto
3. ✅ **5 Rủi ro critical có giải pháp cụ thể**: Code + UI + Tests
4. ✅ **6 Bổ sung quan trọng**: Partner mgmt, scope, sandbox, monitoring, contract, tests
5. ✅ **Timeline thực tế**: 22-36 tuần (5-9 tháng) cho full rollout

### So Sánh Với Kế Hoạch Cũ

| Khía Cạnh | Kế Hoạch Cũ | Kế Hoạch Mới |
|-----------|-------------|--------------|
| **Phase 1** | 2 tuần | 6-8 tuần (vững hơn) |
| **Payment Safety** | Auto ngay | Manual → Semi-auto → Auto |
| **Tenant Isolation** | Chung chung | 100+ tests + external audit |
| **Sandbox** | Không có | Bắt buộc |
| **Monitoring** | Không có | Real-time dashboard |
| **Total Timeline** | 12-18 tháng | 22-36 tuần = 5-9 tháng (nhanh hơn vì focus đúng) |

### Khuyến Nghị Ưu Tiên Cao

**Critical (Làm ngay - Tuần này)**:
1. ✅ Tạo `api_partners` table
2. ✅ Implement API key middleware
3. ✅ Viết 100+ tenant isolation tests
4. ✅ Schedule security audit với external auditor

**High (Làm trong 2 tuần)**:
5. ✅ Build partner management UI
6. ✅ Implement scope system
7. ✅ Setup sandbox environment
8. ✅ Create idempotency table & logic

**Medium (Làm trong 1 tháng)**:
9. ✅ Payment reconciliation dashboard
10. ✅ Webhook retry queue
11. ✅ Monitoring dashboard
12. ✅ Data contract documentation

### Success Metrics (OKRs)

**Q3 2026** (Phase 1-2 Complete):
- ✅ API Gateway security audit PASSED
- ✅ 5 pilot partners onboarded
- ✅ 0 tenant data leakage incidents
- ✅ 0 duplicate payment incidents
- ✅ Webhook success rate > 98%

**Q4 2026** (Phase 3-4 Complete):
- ✅ 20 partners using API Gateway
- ✅ Zalo delivery rate > 95%
- ✅ E-Invoice issuance success > 99%
- ✅ Payment reconciliation time < 2 min

**Q1 2027** (Phase 5 Complete):
- ✅ 50+ partners integrated
- ✅ 3 POS partners live (KiotViet, MISA, Internal)
- ✅ Revenue from API platform: $50K/month
- ✅ Ready to scale to 10+ industries

---

**Tài liệu này thay thế**: `docs/plans/bella-api-gateway-plan.html`

**Next Actions**:
1. Review với leadership team
2. Approve budget & resources
3. Kick off Phase 1 Week 1
4. Schedule security audit

**Người chịu trách nhiệm**: CTO + Engineering Lead  
**Review cycle**: Bi-weekly  
**Decision point**: End of each phase (go/no-go gate)

---

*Document Version: 2.0*  
*Last Updated: 17/06/2026*  
*Status: **APPROVED FOR EXECUTION***

