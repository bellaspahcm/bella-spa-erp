# Decision Engine Operations Console - Implementation Checklist

> **Evidence Console** - Chứng minh Bella EIP thực sự đang vận hành
> 
> Document này cung cấp lộ trình chi tiết theo từng Sprint để xây dựng Operations Console cho Decision Engine, tập trung vào việc chứng minh giá trị với CTO và nhà đầu tư thông qua dữ liệu vận hành thực tế.

---

## Tổng Quan Lộ Trình

### Mục Tiêu Chính

Bella EIP không chỉ là một **Decision Engine**, mà là một **Business Decision Intelligence Platform** với 5 năng lực cốt lõi:

- ✅ **Transparency** - Mọi quyết định đều giải trình được
- ✅ **Observability** - Theo dõi health và performance real-time  
- ✅ **Intelligence** - Phân tích coverage, shadow rules, và policy dependencies
- ✅ **Time Travel** - Replay decisions và compare policy versions (killer feature)
- ✅ **Evidence-Based** - Chứng minh bằng dữ liệu thực tế, không phải marketing

### Enterprise-Grade Enhancements (vs Standard Rule Engines)

**Bella EIP có, nhưng Drools/AWS Rules Engine/LaunchDarkly không có**:
1. **Decision Time Machine** - Replay decisions với policy version cũ/mới, so sánh diff
2. **Shadow Rules Detection** - Tự động phát hiện rules bị che bởi rules khác
3. **Full Version Snapshot** - Lưu Engine/Policy/Rule/Provider version cho mọi decision
4. **Distributed Correlation Trace** - Track decisions xuyên suốt workflow (OpenTelemetry-style)
5. **Business KPI Integration** - Không chỉ technical metrics mà còn business outcomes
6. **AI Explainability** - Audit AI provider decisions với prompt/model/reasoning

### Giá Trị Với Nhà Đầu Tư

Thay vì chỉ nói "Engine chạy nhanh", bạn có thể **chứng minh bằng metrics**:
- Số lượng decisions đã xử lý
- Thời gian thực thi trung bình và percentile
- Tỷ lệ thành công/thất bại
- Khả năng audit và giải trình từng quyết định
- Policy coverage và rule effectiveness

---

## REVISED: Sprint Priority Order (Enterprise-First)

**Original roadmap was UI-first. This revision prioritizes operational infrastructure.**

### Sprint 1: Core Evidence (MVP) - 1.5 tuần
**Mục tiêu**: Chứng minh transparency + reproducibility (killer combo)

1. **Decision Audit Trail** ⭐⭐⭐⭐⭐
2. **Decision Detail Drawer** ⭐⭐⭐⭐⭐
3. **Decision History Timeline** ⭐⭐⭐⭐☆
4. **Decision Replay & Time Machine** ⭐⭐⭐⭐⭐ (NEW - killer feature)
5. **Correlation & Distributed Trace** ⭐⭐⭐⭐☆ (NEW)

### Sprint 2: Operations & Observability - 1.5 tuần
**Mục tiêu**: Health monitoring + cost tracking

1. **Metrics Dashboard** ⭐⭐⭐⭐⭐
2. **Performance Heatmap** ⭐⭐⭐⭐☆
3. **Decision Cost Tracking** ⭐⭐⭐⭐☆ (NEW - CPU/Memory/DB/API calls)
4. **Trace Viewer** ⭐⭐⭐⭐☆ (NEW - OpenTelemetry-style)
5. **Confidence Tracker** ⭐⭐⭐☆☆

### Sprint 3: Policy Intelligence - 1.5 tuần
**Mục tiêu**: Advanced analytics mà enterprise rule engines thiếu

1. **Policy Coverage Dashboard** ⭐⭐⭐⭐⭐
2. **Shadow Rules Detection** ⭐⭐⭐⭐⭐ (NEW - golden feature)
3. **Rule Conflict Analysis** ⭐⭐⭐⭐☆ (NEW)
4. **Policy Dependency Graph** ⭐⭐⭐⭐☆ (NEW - visual graph)
5. **Policy Registry Viewer** ⭐⭐⭐⭐☆
6. **Rule Explorer** ⭐⭐⭐☆☆

### Sprint 4: Business Intelligence - 1 tuần
**Mục tiêu**: Business outcomes + AI explainability

1. **Business KPI Dashboard** ⭐⭐⭐⭐⭐ (NEW - CEO-friendly metrics)
2. **AI Explainability** ⭐⭐⭐⭐☆ (NEW - audit AI decisions)
3. **Export & Reporting** ⭐⭐⭐☆☆
4. **Saved Views** ⭐⭐⭐☆☆
5. **Platform Analytics** ⭐⭐⭐☆☆

---

## Sprint 1: Core Evidence (MVP) - 1.5 tuần

**Mục tiêu**: Chứng minh tính minh bạch (transparency) - mọi quyết định đều giải trình được

### 1.1 Decision Audit Trail ⭐⭐⭐⭐⭐

**Backend Tasks**:


- [ ] **API: Get Decision Audit List**
  - Endpoint: `GET /api/decision-engine/audit`
  - Query params: `tenantId`, `dateFrom`, `dateTo`, `decisionType`, `provider`, `status`, `page`, `limit`
  - Response: Paginated list với columns:
    - `decision_id`, `decision_type`, `provider`, `execution_time_ms`, `matched_rules_count`, `tenant_id`, `created_at`, `status`
  - Database: Query từ `decision_audit_log` table
  - Performance: Index on `(tenant_id, created_at DESC, decision_type)`

- [ ] **API: Get Decision Detail**
  - Endpoint: `GET /api/decision-engine/audit/:decisionId`
  - Response: Full decision detail với structure:
    ```typescript
    {
      id: string;
      type: string; // 'payroll' | 'booking' | 'procurement'
      provider: string;
      executionTimeMs: number;
      status: 'success' | 'error' | 'warning';
      inputContext: Record<string, any>;
      policiesExecuted: string[];
      matchedRules: Array<{
        ruleId: string;
        ruleName: string;
        priority: number;
        matchedConditions: string[];
      }>;
      output: Record<string, any>;
      auditLog: Array<{
        timestamp: string;
        level: 'info' | 'warn' | 'error';
        message: string;
      }>;
      metadata: {
        tenantId: string;
        userId?: string;
        createdAt: string;
      };
    }
    ```


- [ ] **Database Schema Validation**
  - Verify `decision_audit_log` table exists with required columns
  - If missing, create migration for audit log table:
    ```sql
    CREATE TABLE decision_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      decision_id TEXT NOT NULL,
      decision_type TEXT NOT NULL,
      provider TEXT NOT NULL,
      execution_time_ms INTEGER NOT NULL,
      status TEXT NOT NULL,
      input_context JSONB NOT NULL,
      policies_executed TEXT[] NOT NULL,
      matched_rules JSONB NOT NULL,
      output JSONB NOT NULL,
      audit_log JSONB NOT NULL,
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      user_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_audit_tenant_created ON decision_audit_log(tenant_id, created_at DESC);
    CREATE INDEX idx_audit_decision_type ON decision_audit_log(decision_type);
    CREATE INDEX idx_audit_provider ON decision_audit_log(provider);
    ```

**Frontend Tasks**:

- [ ] **Page: Decision Audit Trail**
  - Route: `/dashboard/decision-engine/audit`
  - Layout: Data table với columns: Decision ID, Type, Provider, Execution Time, Status, Tenant, Created At
  - Features:
    - Filter by date range (date picker)
    - Filter by decision type (dropdown: All, Payroll, Booking, Procurement)
    - Filter by provider (dropdown: All, + dynamic list from API)
    - Filter by status (dropdown: All, Success, Error, Warning)
    - Search by decision ID (text input with debounce)
    - Pagination (10/25/50/100 per page)
    - Click row → open Decision Detail drawer


- [ ] **Component: Decision Detail Drawer**
  - Slide-out panel từ bên phải
  - Sections (vertical flow):
    1. **Header**: Decision ID, Type badge, Status badge, Timestamp
    2. **Input Context**: JSON viewer (collapsible, syntax-highlighted)
    3. **Policies Executed**: List of policy names với checkmark icons
    4. **Matched Rules**: Expandable list, mỗi rule hiển thị:
       - Rule ID + Name
       - Priority badge
       - Matched conditions (list with green checkmarks)
    5. **Output**: JSON viewer (collapsible, syntax-highlighted)
    6. **Audit Log**: Timeline-style list:
       - Timestamp (relative time)
       - Level badge (info/warn/error with colors)
       - Message
    7. **Metadata**: Tenant name, User name (if available), Execution time badge
  - Actions: Close button, Copy JSON button, Export button (future)

**Acceptance Criteria**:

- [ ] Admin có thể xem list tất cả decisions trong tenant
- [ ] Filter hoạt động đúng với từng loại (type, provider, status, date range)
- [ ] Click vào decision mở drawer với đầy đủ thông tin
- [ ] Audit log hiển thị đúng thứ tự thời gian
- [ ] Matched rules hiển thị rõ ràng conditions nào pass
- [ ] Performance: Load list < 500ms, load detail < 200ms

**Success Metrics**:

- CTO/Investor có thể trace một quyết định cụ thể từ input → policies → rules → output
- Không còn câu hỏi "tại sao hệ thống quyết định như vậy?"

---

### 1.2 Decision History Timeline ⭐⭐⭐⭐☆

**Mục tiêu**: "Git History cho Business Decision" - trace workflow của một entity (booking, payroll, etc.)

**Backend Tasks**:

- [ ] **API: Get Decision History by Entity**
  - Endpoint: `GET /api/decision-engine/history/:entityType/:entityId`
  - Example: `GET /api/decision-engine/history/booking/booking_123`
  - Response: Timeline of all decisions related to this entity:
    ```typescript
    {
      entityType: string;
      entityId: string;
      timeline: Array<{
        decisionId: string;
        decisionType: string;
        provider: string;
        timestamp: string;
        status: 'success' | 'error' | 'warning';
        summary: string; // e.g. "Eligibility check passed"
        outcomeType: 'approved' | 'rejected' | 'modified' | 'info';
      }>;
    }
    ```
  - Logic: Query `decision_audit_log` where `input_context` hoặc `output` contains entity ID

**Frontend Tasks**:

- [ ] **Component: Decision History Timeline**
  - Vertical timeline với nodes
  - Mỗi node hiển thị:
    - Icon theo outcome type (✅ approved, ❌ rejected, ℹ️ info)
    - Decision type badge
    - Provider name
    - Summary text
    - Relative timestamp
    - Click → open Decision Detail drawer
  - Visual flow: Line connecting nodes, với màu sắc theo status


- [ ] **Integration: Link từ Entity Detail Pages**
  - Booking detail page: Add "Decision History" tab
  - Payroll record page: Add "Decision History" tab
  - Show timeline component trong tab

**Acceptance Criteria**:

- [ ] Từ booking detail, có thể xem tất cả decisions liên quan (eligibility, discount, recommendation, approval)
- [ ] Timeline hiển thị đúng thứ tự thời gian
- [ ] Visual cues giúp dễ dàng identify decisions passed vs rejected
- [ ] Click vào timeline node mở Decision Detail drawer

**Success Metrics**:

- Debug time giảm 80% - không cần đọc code, chỉ cần nhìn timeline
- Business users có thể tự trả lời "tại sao booking bị reject?"

---

### 1.4 Decision Replay & Time Machine ⭐⭐⭐⭐⭐ (KILLER FEATURE)

**Mục tiêu**: Reproduce past decisions + compare policy versions - tính năng mà enterprise rule engines không có

**Backend Tasks**:

**Mục tiêu**: Health monitoring - theo dõi performance và reliability của Decision Engine

### 2.1 Metrics Dashboard ⭐⭐⭐⭐⭐

**Backend Tasks**:

- [ ] **API: Get Real-Time Metrics**
  - Endpoint: `GET /api/decision-engine/metrics/realtime`
  - Query params: `tenantId`, `timeRange` (1h, 24h, 7d, 30d)
  - Response:
    ```typescript
    {
      timeRange: string;
      totalDecisions: number;
      avgExecutionMs: number;
      p95ExecutionMs: number;
      p99ExecutionMs: number;
      errorRate: number; // percentage
      successRate: number; // percentage
      topProviders: Array<{
        provider: string;
        count: number;
        percentage: number;
      }>;
      topDecisionTypes: Array<{
        type: string;
        count: number;
        percentage: number;
      }>;
    }
    ```


- [ ] **API: Get Trend Data**
  - Endpoint: `GET /api/decision-engine/metrics/trends`
  - Query params: `tenantId`, `timeRange`, `interval` (hourly, daily)
  - Response: Time-series data for charts
    ```typescript
    {
      dataPoints: Array<{
        timestamp: string;
        totalDecisions: number;
        avgExecutionMs: number;
        errorCount: number;
        successCount: number;
      }>;
    }
    ```
  - Implementation: Aggregate from `decision_audit_log` grouped by time interval

**Frontend Tasks**:

- [ ] **Page: Observability Dashboard**
  - Route: `/dashboard/decision-engine/observability`
  - Layout: Grid of cards

- [ ] **Card: Key Metrics (4 stat cards)**
  - Total Decisions Today (big number + trend ↗️↘️)
  - Average Execution Time (with percentile badges)
  - Error Rate (percentage with red/green indicator)
  - Success Rate (percentage with progress ring)

- [ ] **Card: Trend Charts (2 line charts)**
  - Chart 1: Decisions Over Time (line chart, 24h/7d/30d toggle)
  - Chart 2: Execution Time Trends (line chart với avg + p95 + p99)

- [ ] **Card: Top Providers (horizontal bar chart)**
  - X-axis: Decision count
  - Y-axis: Provider names
  - Color-coded bars
  - Click bar → filter audit trail by provider


- [ ] **Card: Top Decision Types (donut chart)**
  - Show distribution: Payroll, Booking, Procurement, Others
  - Click segment → filter audit trail by type

**Acceptance Criteria**:

- [ ] Dashboard trả lời được 5 câu hỏi:
  - Hôm nay xử lý bao nhiêu decisions?
  - Provider nào chạy nhiều nhất?
  - Provider nào chậm nhất?
  - Decision nào lỗi?
  - Tenant nào sử dụng nhiều nhất?
- [ ] Real-time data refresh every 30s (optional: manual refresh button)
- [ ] Charts responsive và load nhanh (< 1s)

**Success Metrics**:

- Ops team có thể phát hiện performance degradation ngay lập tức
- Business có thể thấy adoption metrics (얼마나 nhiều decisions đang chạy)

---

### 2.3 Decision Cost Tracking ⭐⭐⭐⭐☆ (NEW)

**Mục tiêu**: Track resource consumption - không chỉ execution time mà còn CPU, Memory, DB, API calls

**Backend Tasks**:

- [ ] **Add Resource Metrics to Audit Log**
  - Extend `decision_audit_log` schema:
    ```sql
    ALTER TABLE decision_audit_log ADD COLUMN resource_metrics JSONB;
    ```
  - Structure:
    ```typescript
    resource_metrics: {
      cpuTimeMs: number;
      memoryUsedMB: number;
      dbQueries: {
        count: number;
        totalTimeMs: number;
        queries: Array<{ query: string; timeMs: number }>;
      };
      remoteApiCalls: {
        count: number;
        totalTimeMs: number;
        calls: Array<{ endpoint: string; timeMs: number; statusCode: number }>;
      };
      cacheHits: number;
      cacheMisses: number;
    }
    ```

- [ ] **API: Get Cost Analysis**
  - Endpoint: `GET /api/decision-engine/metrics/cost-analysis`
  - Response:
    ```typescript
    {
      byProvider: Array<{
        provider: string;
        avgCpuMs: number;
        avgMemoryMB: number;
        avgDbQueries: number;
        avgApiCalls: number;
        cacheHitRate: number; // percentage
        costScore: number; // composite score 0-100
      }>;
      mostExpensive: Array<{ decisionId: string; costScore: number }>;
      recommendations: string[]; // e.g., "Add caching to RuleProvider"
    }
    ```

**Frontend Tasks**:

- [ ] **Card: Resource Consumption Dashboard**
  - Layout: Grid of metric cards
  - Cards:
    1. **CPU Time** (line chart over time)
    2. **Memory Usage** (line chart over time)
    3. **DB Query Count** (bar chart by provider)
    4. **API Call Count** (bar chart by provider)
    5. **Cache Hit Rate** (donut chart: hits vs misses)
  - Each card clickable → drill down to specific decisions

- [ ] **Component: Cost Heatmap by Provider**
  - Table layout:
    | Provider | Avg CPU | Avg Memory | DB Queries | API Calls | Cache Hit % | Cost Score |
    |----------|---------|------------|------------|-----------|-------------|------------|
    | RuleProvider | 5ms | 0.5MB | 0 | 0 | 100% | 🟢 Low |
    | AIProvider | 1200ms | 50MB | 0 | 2 | 0% | 🔴 High |
    | BIProvider | 18ms | 2MB | 3 | 0 | 80% | 🟡 Medium |
  - Color coding: Green (low cost) → Yellow (medium) → Red (high cost)
  - Sort by cost score (descending) to prioritize optimization targets

**Acceptance Criteria**:

- [ ] Dashboard hiển thị resource consumption per provider
- [ ] Có thể identify providers tốn CPU/Memory nhất
- [ ] Cache hit rate giúp evaluate caching effectiveness
- [ ] Recommendations actionable (e.g., "Add index on table X")

**Success Metrics**:

- Identify optimization opportunities trong < 30 giây
- Reduce infrastructure cost bằng cách optimize high-cost providers
- Justify infrastructure investment với data (e.g., "Caching saves $X/month")

---

### 2.4 Trace Viewer (OpenTelemetry-Style) ⭐⭐⭐⭐☆

**Mục tiêu**: Visualize distributed traces - giống Jaeger/Zipkin UI

**Frontend Tasks**:

- [ ] **Page: Trace Viewer**
  - Route: `/dashboard/decision-engine/traces`
  - Features:
    - Search by traceId, entity type, entity ID
    - Filter by date range, status
    - List view: Recent traces với summary (total duration, decision count, status)
  - Click trace → open Trace Detail page

- [ ] **Page: Trace Detail**
  - Route: `/dashboard/decision-engine/traces/:traceId`
  - **Waterfall Chart** (main visualization):
    - Timeline on X-axis
    - Decisions as bars (width = duration)
    - Nested structure (parent-child indentation)
    - Color by status
    - Hover → tooltip với summary
    - Click → open Decision Detail drawer
  - **Summary Stats Panel**:
    - Total duration
    - Decision count
    - Error count
    - Critical path duration
    - Parallelization opportunities
  - **Span Details Table**:
    - Columns: Decision Type, Provider, Duration, Status, Timestamp
    - Sort by duration (descending) to identify bottlenecks

**Acceptance Criteria**:

- [ ] Waterfall chart rõ ràng, dễ đọc (giống Chrome DevTools)
- [ ] Critical path highlighted
- [ ] Có thể zoom in/out timeline
- [ ] Mobile-responsive (fallback to list view)

---

### 2.5 Performance Heatmap ⭐⭐⭐⭐☆

**Backend Tasks**:

- [ ] **API: Get Provider Performance**
  - Endpoint: `GET /api/decision-engine/metrics/provider-performance`
  - Response:
    ```typescript
    {
      providers: Array<{
        name: string;
        avgExecutionMs: number;
        p95ExecutionMs: number;
        totalCalls: number;
        errorRate: number;
      }>;
    }
    ```

**Frontend Tasks**:

- [ ] **Component: Performance Heatmap**
  - Horizontal bar chart với execution time
  - Bars màu gradient: green (fast) → yellow (medium) → red (slow)
  - Tooltip hiển thị: avg, p95, total calls, error rate
  - Visual thresholds: < 10ms (fast), 10-50ms (medium), > 50ms (slow)


**Acceptance Criteria**:

- [ ] Lập tức identify provider nào đang chậm nhất
- [ ] Visual thresholds giúp dễ dàng spot performance issues
- [ ] Click provider → navigate to filtered audit trail

**Success Metrics**:

- Performance bottleneck được phát hiện trong < 5 giây khi nhìn dashboard

---

### 2.6 Confidence Tracker ⭐⭐⭐☆☆

**Mục tiêu**: Chứng minh epistemic humility - hệ thống biết khi nào không chắc chắn

**Backend Tasks**:

- [ ] **API: Get Confidence Metrics**
  - Endpoint: `GET /api/decision-engine/metrics/confidence`
  - Response:
    ```typescript
    {
      avgConfidence: number; // 0-1
      lowConfidenceCount: number; // decisions với confidence < 0.6
      confidenceDistribution: {
        high: number; // > 0.8
        medium: number; // 0.6 - 0.8
        low: number; // < 0.6
      };
      recentLowConfidenceDecisions: Array<{
        decisionId: string;
        type: string;
        confidence: number;
        reason: string;
      }>;
    }
    ```

**Frontend Tasks**:

- [ ] **Component: Confidence Distribution Chart**
  - Stacked bar hoặc donut chart: High / Medium / Low confidence
  - List recent low-confidence decisions với warning badges
  - Click → open decision detail

**Acceptance Criteria**:

- [ ] Dashboard hiển thị % decisions với low confidence
- [ ] Alert when confidence drops below threshold
- [ ] Business có thể review low-confidence decisions manually

---

## Sprint 3: Policy Intelligence - 1.5 tuần

**Mục tiêu**: Advanced policy analytics - Shadow Rules, Conflicts, Dependencies - features mà enterprise engines thiếu

### 3.1 Policy Coverage Dashboard ⭐⭐⭐⭐⭐

**Mục tiêu**: Identify dead rules, unused policies, coverage gaps

**Backend Tasks**:

- [ ] **API: Get Policy Coverage Stats**
  - Endpoint: `GET /api/decision-engine/policies/coverage`
  - Query params: `tenantId`, `timeRange` (7d, 30d, 90d, all-time)
  - Response:
    ```typescript
    {
      policies: Array<{
        policyId: string;
        policyName: string;
        domain: string;
        totalRules: number;
        executedRules: number;
        neverExecutedRules: Array<{
          ruleId: string;
          ruleName: string;
          priority: number;
        }>;
        hitRate: number; // percentage
        avgHitCount: number;
        ruleStats: Array<{
          ruleId: string;
          ruleName: string;
          hitCount: number;
          hitPercentage: number;
          lastHit: string | null;
        }>;
      }>;
    }
    ```
  - Logic: 
    - Join `policy_registry` với `decision_audit_log.matched_rules`
    - Count hit frequency per rule
    - Identify rules never hit in time range

**Frontend Tasks**:

- [ ] **Page: Policy Coverage Dashboard**
  - Route: `/dashboard/decision-engine/policies/coverage`
  - Time range selector: 7d / 30d / 90d / All time


- [ ] **Component: Policy Coverage Table**
  - Columns: Policy Name, Domain, Total Rules, Hit Rate (%), Never Executed, Status Badge
  - Status badges:
    - 🟢 Healthy (> 80% coverage)
    - 🟡 Warning (50-80% coverage)
    - 🔴 Critical (< 50% coverage)
    - ⚠️ Dead Policy (0% coverage in time range)
  - Click row → expand to show rule-level stats

- [ ] **Component: Rule Hit Distribution (per policy)**
  - Horizontal bar chart: rule name vs hit count
  - Color coding:
    - Green: high usage (> 10% of total hits)
    - Yellow: medium usage (1-10%)
    - Red: low usage (< 1%)
    - Gray: never executed (⚠️ marker)
  - Sort options: By hit count (desc), By priority, By last hit

- [ ] **Component: Dead Rules Alert Card**
  - Summary: "X rules have never been executed in the last 30 days"
  - List top 10 dead rules with recommendation:
    - "Consider removing or reviewing these rules"
    - "May indicate missing test coverage or outdated logic"
  - Click rule → show rule detail + example test cases

**Acceptance Criteria**:

- [ ] Admin có thể identify rules chưa bao giờ chạy trong 30 ngày
- [ ] Visual indicators giúp dễ dàng spot coverage issues
- [ ] Có actionable insights (nên xóa, review, hoặc test rules nào)

**Success Metrics**:

- Policy maintainability tăng 10x - biết rule nào còn dùng, rule nào chết
- AI có thể đọc dashboard này để recommend policy optimizations
- Đây là tính năng "golden" mà ngay cả Drools, AWS Rules Engine cũng không có

---

### 3.2 Shadow Rules Detection ⭐⭐⭐⭐⭐ (GOLDEN FEATURE)

**Mục tiêu**: Tự động phát hiện rules bị "che" bởi rules khác - tính năng mà ngay cả Drools cũng không có

**Problem**: Rule B có priority thấp hơn Rule A, và conditions của B là subset của A → Rule B never executes (shadow rule)

**Example**:
```
Rule A (priority 100): if (age > 18 && vip) → approve
Rule B (priority 50):  if (age > 18) → review

→ Rule B is shadowed because Rule A matches first for all VIP customers
```

**Backend Tasks**:

- [ ] **API: Analyze Shadow Rules**
  - Endpoint: `POST /api/decision-engine/policies/analyze-shadows`
  - Request body: `{ policyId: string }`
  - Logic:
    1. Get all rules in policy sorted by priority
    2. For each rule pair (Ri, Rj) where priority(Ri) > priority(Rj):
       - Parse conditions using AST
       - Check if conditions(Rj) ⊆ conditions(Ri) (subset check)
       - If yes AND actions differ → Mark Rj as "shadowed by Ri"
    3. Cross-reference với audit log: If rule never hit in 90 days → Confirm shadow status
  - Response:
    ```typescript
    {
      shadowedRules: Array<{
        ruleId: string;
        ruleName: string;
        shadowedBy: {
          ruleId: string;
          ruleName: string;
          priority: number;
        };
        reason: string; // e.g., "Conditions are subset of Rule A"
        lastHit: string | null;
        recommendation: 'remove' | 'merge' | 'adjust_priority' | 'review';
      }>;
      conflictingRules: Array<{
        rule1: string;
        rule2: string;
        conflictType: 'same_priority_overlapping_conditions' | 'contradictory_actions';
        severity: 'high' | 'medium' | 'low';
      }>;
    }
    ```

- [ ] **Logic: Condition Subset Analysis**
  - Parse rule conditions into AST (Abstract Syntax Tree)
  - Implement subset checking algorithm:
    ```typescript
    function isSubset(conditionsA: AST, conditionsB: AST): boolean {
      // If B's conditions are more specific than A's, B is subset of A
      // Example: (age > 18) is subset of (age > 18 && vip)
      // Use Z3 solver or custom logic
    }
    ```

**Frontend Tasks**:

- [ ] **Page: Shadow Rules Analysis**
  - Route: `/dashboard/decision-engine/policies/:policyId/shadows`
  - **Summary Card**:
    - X rules detected as shadows
    - Y rules have conflicts
    - Z recommendations for optimization
  - **Shadow Rules Table**:
    - Columns: Rule Name, Shadowed By, Reason, Last Hit, Recommendation, Actions
    - Color coding: 🔴 Never hit (90d), 🟡 Rarely hit (< 1%), 🟢 Active
    - Actions: "Remove", "Merge with parent", "Adjust priority", "Review manually"
  - **Conflict Rules Table**:
    - Columns: Rule 1, Rule 2, Conflict Type, Severity, Actions
    - Expandable row shows details + suggested resolution

- [ ] **Component: Rule Dependency Graph**
  - Visual graph showing rule relationships:
    - Nodes: Rules (size = hit count)
    - Edges: "Shadows" relationships (red arrows)
    - Conflicts: Yellow dashed lines
  - Interactive: Click node → show rule detail
  - Highlight cluster of related rules

**Acceptance Criteria**:

- [ ] Algorithm correctly identifies shadow rules (validate với manual review)
- [ ] False positive rate < 5% (rules marked as shadow but actually active)
- [ ] Recommendations actionable và safe (không suggest xóa critical rules)
- [ ] Graph visualization giúp understand policy structure nhanh hơn

**Success Metrics**:

- **Policy Cleanup**: Identify 20-30% rules có thể remove/merge safely
- **Conflict Prevention**: Catch conflicting rules trước khi deploy
- **Unique Selling Point**: Không có rule engine nào có tính năng này out-of-the-box
- **CTO/Investor Wow Factor**: Demo live shadow detection là killer feature

---

### 3.3 Rule Conflict Analysis ⭐⭐⭐⭐☆

**Mục tiêu**: Detect conflicting rules - same priority nhưng contradictory actions

**Backend Tasks**:

- [ ] **Conflict Detection Logic**
  - Types of conflicts:
    1. **Same Priority + Overlapping Conditions**: Two rules có cùng priority và overlapping conditions → non-deterministic behavior
    2. **Contradictory Actions**: Rule A says "approve", Rule B says "reject" cho cùng conditions
    3. **Dead Code After Reject**: Rule A rejects, nhưng có rules B, C sau đó (will never execute)
  - Integrate vào shadow analysis API

**Frontend Tasks**:

- [ ] **Conflict Severity Badges**
  - 🔴 High: Contradictory actions (approve vs reject)
  - 🟡 Medium: Same priority + overlap (non-deterministic)
  - 🟢 Low: Dead code (unreachable rules)

- [ ] **Conflict Resolution Wizard**
  - Step 1: Show conflict details
  - Step 2: Suggest resolutions:
    - Adjust priorities
    - Merge conditions
    - Split into separate policies
  - Step 3: Preview impact (how many past decisions would change)
  - Step 4: Apply fix (update policy)

**Acceptance Criteria**:

- [ ] Detect all conflict types
- [ ] Severity classification helps prioritize fixes
- [ ] Resolution wizard giúp non-technical users fix conflicts

---

### 3.4 Policy Dependency Graph ⭐⭐⭐⭐☆

**Mục tiêu**: Visualize policy dependencies - CTO rất thích kiểu này

**Backend Tasks**:

- [ ] **API: Get Policy Dependencies**
  - Endpoint: `GET /api/decision-engine/policies/dependency-graph`
  - Response:
    ```typescript
    {
      nodes: Array<{
        id: string;
        name: string;
        type: 'policy' | 'provider' | 'decision_type';
        stats: { hitCount: number; lastUsed: string };
      }>;
      edges: Array<{
        from: string;
        to: string;
        relationship: 'depends_on' | 'calls' | 'provides_data';
      }>;
    }
    ```

**Frontend Tasks**:

- [ ] **Component: Interactive Policy Graph**
  - Library: react-flow or d3.js
  - Features:
    - Nodes color-coded by type
    - Node size proportional to usage
    - Click node → highlight connected nodes
    - Drag to rearrange layout
    - Zoom/pan controls
  - Layouts:
    - Hierarchical (top-down)
    - Force-directed (organic clustering)
    - Circular (show cycles)

**Acceptance Criteria**:

- [ ] Graph accurately represents policy dependencies
- [ ] Performance OK với 50+ policies (< 2s load time)
- [ ] Click node navigates to policy detail

---

### 3.5 Policy Registry Viewer ⭐⭐⭐⭐☆

**Mục tiêu**: Read-only view of all registered policies - chứng minh Bella là "Policy Platform"

**Backend Tasks**:

- [ ] **API: Get Policy List**
  - Endpoint: `GET /api/decision-engine/policies`
  - Query params: `tenantId`, `domain`, `status`, `search`
  - Response: List of policies từ `policy_registry`:
    ```typescript
    {
      policies: Array<{
        id: string;
        name: string;
        version: string;
        domain: string;
        status: 'active' | 'deprecated' | 'draft';
        tags: string[];
        providers: string[];
        ruleCount: number;
        createdAt: string;
        updatedAt: string;
      }>;
    }
    ```

- [ ] **API: Get Policy Detail**
  - Endpoint: `GET /api/decision-engine/policies/:policyId`
  - Response: Full policy definition:
    ```typescript
    {
      id: string;
      name: string;
      version: string;
      domain: string;
      description: string;
      status: string;
      tags: string[];
      metadata: Record<string, any>;
      providers: string[];
      rules: Array<{
        id: string;
        name: string;
        priority: number;
        description: string;
        conditions: string; // human-readable
        actions: string; // human-readable
      }>;
      dependencies: string[]; // other policy IDs
      examples: Array<{
        input: Record<string, any>;
        expectedOutput: Record<string, any>;
      }>;
    }
    ```


**Frontend Tasks**:

- [ ] **Page: Policy Registry**
  - Route: `/dashboard/decision-engine/policies`
  - Layout: Data table với columns: Name, Domain, Version, Status, Tags, Providers, Rules Count
  - Filters:
    - Domain (dropdown)
    - Status (active/deprecated/draft)
    - Search by name or tags
  - Click row → open Policy Detail page

- [ ] **Page: Policy Detail (Read-Only)**
  - Route: `/dashboard/decision-engine/policies/:policyId`
  - Sections:
    1. **Header**: Name, Version badge, Status badge, Domain badge
    2. **Metadata**: Description, Tags (chips), Created/Updated dates
    3. **Providers**: List of providers sử dụng policy này
    4. **Rules**: Accordion list, mỗi rule expandable để xem:
       - Priority badge
       - Conditions (code block hoặc pseudo-code)
       - Actions (code block hoặc pseudo-code)
       - Hit count badge (from coverage stats)
    5. **Dependencies**: Link to other policies
    6. **Examples**: Input/Output test cases (JSON viewers)

**Acceptance Criteria**:

- [ ] Business users có thể browse all policies
- [ ] Policy detail đủ rõ ràng để non-technical people hiểu logic
- [ ] Link từ coverage dashboard → policy detail hoạt động

**Success Metrics**:

- Nhà đầu tư nhìn vào thấy Bella thực sự là "Policy Platform", không chỉ là code logic
- Policy documentation tự động từ code (living documentation)

---

### 3.6 Rule Explorer ⭐⭐⭐☆☆

**Mục tiêu**: Xem chi tiết từng rule, không cần edit (chưa cần Visual Rule Builder)

**Backend Tasks**:

- [ ] **API: Get Rule Detail**
  - Endpoint: `GET /api/decision-engine/rules/:ruleId`
  - Response:
    ```typescript
    {
      id: string;
      name: string;
      priority: number;
      policyId: string;
      policyName: string;
      description: string;
      conditions: {
        raw: string; // code
        humanReadable: string; // pseudo-code
        ast: any; // optional: AST for future visual editor
      };
      actions: {
        raw: string;
        humanReadable: string;
      };
      metadata: {
        createdAt: string;
        updatedAt: string;
        author: string;
      };
      stats: {
        hitCount: number;
        lastHit: string | null;
        avgExecutionMs: number;
      };
      testCases: Array<{
        input: Record<string, any>;
        expectedMatch: boolean;
        expectedOutput: Record<string, any>;
      }>;
    }
    ```

**Frontend Tasks**:

- [ ] **Page: Rule Detail (Read-Only)**
  - Route: `/dashboard/decision-engine/rules/:ruleId`
  - Sections:
    1. **Header**: Rule name, Priority badge, Hit count badge
    2. **Belongs to Policy**: Link to policy detail
    3. **Conditions**: Code block + Human-readable explanation
    4. **Actions**: Code block + Human-readable explanation
    5. **Statistics**: Hit count chart (over time), Avg execution time, Last hit timestamp
    6. **Test Cases**: Table với input → expected match → expected output


**Acceptance Criteria**:

- [ ] Business users có thể đọc rule logic mà không cần hiểu code
- [ ] Stats giúp evaluate rule effectiveness
- [ ] Test cases giúp hiểu use cases của rule

**Success Metrics**:

- Business có thể tự document business logic mà không cần developer giải thích
- Onboarding time giảm - new team members có thể tự học policies

---

## Sprint 4: Business Intelligence - 1 tuần

**Mục tiêu**: Business outcomes + AI explainability - CEO-friendly metrics, không chỉ technical

### 4.1 Business KPI Dashboard ⭐⭐⭐⭐⭐ (NEW)

**Mục tiêu**: Track business outcomes - không chỉ "얼마나 nhanh" mà "얼마나hiệu quả"

**Backend Tasks**:

- [ ] **API: Get Business KPIs**
  - Endpoint: `GET /api/decision-engine/metrics/business-kpis`
  - Query params: `tenantId`, `timeRange`, `decisionType`
  - Response:
    ```typescript
    {
      bookingKPIs: {
        approvalRate: number; // % bookings approved
        avgDiscountGiven: number; // Average discount percentage
        recommendationAcceptanceRate: number; // % recommendations accepted by staff
        revenueImpact: number; // Estimated revenue from approved bookings
      };
      payrollKPIs: {
        autoApprovalRate: number; // % payroll auto-approved without manual review
        avgProcessingTime: number; // Time from calculation to approval
        discrepancyRate: number; // % records with AI ≠ Legacy salary
        costSavings: number; // Estimated time saved vs manual processing
      };
      procurementKPIs: {
        autoApprovalRate: number;
        avgOrderValue: number;
        complianceRate: number; // % orders meeting policy requirements
      };
      overallKPIs: {
        decisionAutomationRate: number; // % decisions auto vs manual
        errorRate: number;
        userSatisfaction: number; // If có feedback system
      };
    }
    ```

- [ ] **Logic: Business Outcome Tracking**
  - Link decisions to business outcomes:
    - Booking decision → revenue (from booking.total_amount)
    - Payroll decision → cost savings (estimated manual processing time)
    - Procurement decision → order value
  - Store outcome data in audit log:
    ```typescript
    business_outcome: {
      outcomeType: 'approved' | 'rejected' | 'modified';
      revenueImpact?: number;
      costImpact?: number;
      timeImpact?: number;
    }
    ```

**Frontend Tasks**:

- [ ] **Page: Business KPI Dashboard**
  - Route: `/dashboard/decision-engine/business-kpis`
  - Layout: Executive summary style
  
- [ ] **Section 1: Key Metrics (Big Numbers)**
  - Cards with trend indicators:
    ```
    ┌─────────────────────┐  ┌─────────────────────┐
    │ Booking Approval    │  │ Revenue Impact      │
    │ 94.2%  ↗️ +2.1%     │  │ $125,400  ↗️ +8.5%  │
    └─────────────────────┘  └─────────────────────┘
    
    ┌─────────────────────┐  ┌─────────────────────┐
    │ Auto-Approval Rate  │  │ Cost Savings        │
    │ 87.5%  ↗️ +3.2%     │  │ 450 hours  ↗️ +12%  │
    └─────────────────────┘  └─────────────────────┘
    ```

- [ ] **Section 2: Trends (Line Charts)**
  - Approval rate over time (7d/30d/90d)
  - Revenue impact over time
  - Auto-approval rate trends
  - Comparison: This month vs last month

- [ ] **Section 3: Funnel Analysis**
  - Booking funnel:
    ```
    Eligibility Check → 95% pass
      ↓
    Pricing Calculation → 100% success
      ↓
    Discount Applied → 45% qualified
      ↓
    Recommendation → 88% accepted
      ↓
    Approval → 92% approved
    
    Overall Conversion: 72%
    ```

- [ ] **Section 4: ROI Calculator**
  - Input: Monthly decision volume
  - Calculate:
    - Time saved (vs manual processing)
    - Cost saved (labor hours × hourly rate)
    - Revenue enabled (approved bookings)
    - Error reduction (vs manual errors)
  - Output: ROI percentage, Payback period

**Acceptance Criteria**:

- [ ] Dashboard hiển thị business metrics, không chỉ technical metrics
- [ ] CEO có thể hiểu value proposition trong < 60 giây
- [ ] Trends show improvement over time (proof of value)
- [ ] ROI calculator helps justify platform investment

**Success Metrics**:

- **Investor Pitch**: "94% auto-approval rate, saving 450 hours/month"
- **Board Report**: Executive summary export-ready
- **Budget Approval**: ROI calculator justifies platform cost

---

### 4.2 AI Explainability ⭐⭐⭐⭐☆ (NEW - Future-Proof)

**Mục tiêu**: Audit AI provider decisions - transparency cho AI/ML models

**Backend Tasks**:

- [ ] **Extend Audit Log for AI Decisions**
  - Add `ai_metadata` field:
    ```typescript
    ai_metadata: {
      provider: string; // e.g., "OpenAI", "Anthropic", "AWS Bedrock"
      model: string; // e.g., "gpt-4", "claude-3-opus"
      prompt: string; // Full prompt sent to AI
      temperature: number;
      maxTokens: number;
      reasoning: string; // AI's chain-of-thought explanation
      confidence: number;
      tokenUsage: {
        promptTokens: number;
        completionTokens: number;
        totalCost: number; // Estimated cost in USD
      };
      fallbackUsed: boolean; // If AI failed, did we fallback to rules?
    }
    ```

- [ ] **API: Get AI Decision Detail**
  - Endpoint: `GET /api/decision-engine/ai-decisions/:decisionId`
  - Response: Full AI metadata + audit trail

**Frontend Tasks**:

- [ ] **Component: AI Decision Detail Panel**
  - Show in Decision Detail Drawer (if decision used AI provider)
  - Sections:
    1. **Model Info**: Provider badge, Model name, Temperature
    2. **Prompt**: Collapsible code block with full prompt
    3. **Reasoning**: AI's explanation (formatted markdown)
    4. **Confidence**: Progress bar (0-100%)
    5. **Token Usage**: Cost breakdown (prompt + completion tokens)
    6. **Fallback Status**: Badge showing if fallback was used

- [ ] **Card: AI Cost Tracking** (in Metrics Dashboard)
  - Total AI calls this month
  - Total cost (USD)
  - Cost per decision
  - Most expensive model
  - Trend: Cost over time

**Acceptance Criteria**:

- [ ] Mọi AI decision có full transparency (prompt, model, reasoning)
- [ ] Cost tracking giúp budget AI usage
- [ ] Reasoning explanation giúp trust AI decisions
- [ ] Fallback mechanism clearly documented

**Success Metrics**:

- **AI Governance**: Compliance-ready audit trail cho AI decisions
- **Cost Control**: Monitor và optimize AI spending
- **Trust**: Users có thể verify AI reasoning
- **Future-Proof**: Ready for AI provider expansion

---

### 4.3 Export & Reporting ⭐⭐⭐☆☆

**Backend Tasks**:

- [ ] **API: Export Audit Trail to CSV**
  - Endpoint: `POST /api/decision-engine/audit/export`
  - Request body: Same filters as audit list API
  - Response: CSV file download
  - Columns: All audit trail columns + flattened metadata

- [ ] **API: Export Coverage Report to PDF**
  - Endpoint: `POST /api/decision-engine/policies/coverage/export`
  - Generate PDF report với:
    - Summary statistics
    - Policy coverage charts
    - Dead rules list
    - Recommendations

**Frontend Tasks**:

- [ ] **Button: Export CSV** (on Audit Trail page)
- [ ] **Button: Export Coverage Report** (on Coverage Dashboard)

**Acceptance Criteria**:

- [ ] Export preserves all filters
- [ ] CSV format compatible với Excel/Google Sheets
- [ ] PDF report professional formatting

---

### 4.4 Advanced Filters & Saved Views ⭐⭐⭐☆☆

**Backend Tasks**:

- [ ] **API: Save Filter View**
  - Endpoint: `POST /api/decision-engine/views`
  - Request body: View definition (name, filters, columns)
  - Store in `user_preferences` table

- [ ] **API: Load Saved Views**
  - Endpoint: `GET /api/decision-engine/views`
  - Response: List of user's saved views

**Frontend Tasks**:

- [ ] **Component: Filter Builder**
  - Advanced filter UI với multiple conditions
  - AND/OR logic
  - Save filter as named view

- [ ] **Component: Saved Views Dropdown**
  - Quick access to saved views
  - Apply view → auto-populate filters

**Acceptance Criteria**:

- [ ] Users có thể save frequently used filter combinations
- [ ] Share views với team members (optional)

---

### 4.5 Multi-Tenant Analytics ⭐⭐⭐⭐☆

**Mục tiêu**: Platform-level analytics - cross-tenant insights

**Backend Tasks**:

- [ ] **API: Get Platform-Wide Metrics**
  - Endpoint: `GET /api/decision-engine/platform/metrics` (admin only)
  - Response:
    ```typescript
    {
      totalTenants: number;
      totalDecisions: number;
      topTenantsByUsage: Array<{
        tenantId: string;
        tenantName: string;
        decisionCount: number;
        percentage: number;
      }>;
      topPoliciesByUsage: Array<{
        policyId: string;
        policyName: string;
        hitCount: number;
      }>;
      platformHealth: {
        avgExecutionMs: number;
        errorRate: number;
      };
    }
    ```


**Frontend Tasks**:

- [ ] **Page: Platform Analytics** (super-admin only)
  - Route: `/dashboard/decision-engine/platform`
  - Cards:
    - Total tenants using Decision Engine
    - Total decisions processed
    - Top tenants by usage
    - Top policies by usage
    - Platform health indicators

**Acceptance Criteria**:

- [ ] Platform admin có thể monitor adoption across tenants
- [ ] Identify which tenants are power users
- [ ] Identify which policies are most valuable

**Success Metrics**:

- Có dữ liệu để pitch "X tenants, Y million decisions processed"
- Có insights để prioritize platform improvements

---

## Testing Strategy

### Unit Tests

- [ ] **Backend**: Test all API endpoints với mocked database
  - Audit trail API
  - Metrics API
  - Policy registry API
  - Rule detail API
- [ ] **Frontend**: Test components rendering với mocked data
  - Decision Detail Drawer
  - Timeline Component
  - Coverage Dashboard
  - Charts and visualizations

### Integration Tests

- [ ] **E2E Flow**: Decision creation → audit log → view in dashboard
- [ ] **E2E Flow**: Filter audit trail → export CSV
- [ ] **E2E Flow**: View policy → drill down to rule → view stats

### Performance Tests

- [ ] Audit trail query with 100k+ records: < 500ms
- [ ] Metrics calculation with 1M+ decisions: < 1s
- [ ] Coverage stats with 50+ policies: < 2s

---

## UI/UX Guidelines

### Design Principles

1. **Evidence-First**: Every screen phải chứng minh value bằng data thực tế
2. **Clarity over Beauty**: Prefer readability và actionable insights over fancy animations
3. **Performance**: Fast load times (< 1s for dashboards)
4. **Accessibility**: WCAG AA compliance for all components
5. **Responsive**: Mobile-friendly (but desktop-first for admin tools)

### Visual Design

**Color Palette**:
- Primary: Pink (#E91E63) - Brand color, use for CTAs
- Success: Green (#4CAF50) - Approved, passed, healthy
- Warning: Orange (#FF9800) - Medium priority, warnings
- Error: Red (#EF4444) - Failed, rejected, critical
- Info: Blue (#2196F3) - Informational
- Text: Dark gray (#333) - Primary text
- Text Secondary: Medium-dark gray (#374151) - Labels, captions

**Typography**:
- Headings: Bold, 18-24px
- Body: Regular, 14-16px
- Captions: Regular, 12-14px
- Code blocks: Monospace, 12-14px

**Spacing**:
- Card padding: 24px
- Section margin: 24px
- Element spacing: 8px, 16px, 24px (8px base unit)

### Components Library

Reuse existing Bella ERP components:
- `DataTable` - For audit trail, policy list
- `StatCard` - For metrics dashboard
- `Drawer` - For decision detail
- `Badge` - For status, tags, priorities
- `Chart` (from recharts) - For trends, distributions
- `JSONViewer` - For input/output display
- `Timeline` - For decision history

---

## Database Schema Requirements

### Required Tables

#### `decision_audit_log` (main audit table) - EXTENDED

```sql
CREATE TABLE decision_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT NOT NULL,
  decision_type TEXT NOT NULL, -- 'payroll' | 'booking' | 'procurement'
  provider TEXT NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  status TEXT NOT NULL, -- 'success' | 'error' | 'warning'
  
  -- Decision data (JSONB for flexibility)
  input_context JSONB NOT NULL,
  policies_executed TEXT[] NOT NULL,
  matched_rules JSONB NOT NULL, -- Array of { ruleId, ruleName, priority, conditions }
  output JSONB NOT NULL,
  audit_log JSONB NOT NULL, -- Array of { timestamp, level, message }
  
  -- Metadata
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  confidence_score NUMERIC(3,2), -- 0.00 - 1.00
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- NEW: Correlation & Tracing (Sprint 1)
  correlation_id UUID,
  trace_id TEXT,
  span_id TEXT,
  parent_span_id TEXT,
  
  -- NEW: Version Snapshot (Sprint 1)
  version_snapshot JSONB, -- { engineVersion, policyVersions, ruleVersions, providerVersions }
  
  -- NEW: Resource Metrics (Sprint 2)
  resource_metrics JSONB, -- { cpuTimeMs, memoryUsedMB, dbQueries, remoteApiCalls, cacheHits, cacheMisses }
  
  -- NEW: Business Outcome (Sprint 4)
  business_outcome JSONB, -- { outcomeType, revenueImpact, costImpact, timeImpact }
  
  -- NEW: AI Metadata (Sprint 4)
  ai_metadata JSONB, -- { provider, model, prompt, temperature, reasoning, confidence, tokenUsage, fallbackUsed }
  
  CONSTRAINT decision_audit_log_pkey PRIMARY KEY (id)
);

-- Performance indexes
CREATE INDEX idx_audit_tenant_created ON decision_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_decision_type ON decision_audit_log(decision_type);
CREATE INDEX idx_audit_provider ON decision_audit_log(provider);
CREATE INDEX idx_audit_status ON decision_audit_log(status);
CREATE INDEX idx_audit_confidence ON decision_audit_log(confidence_score) WHERE confidence_score IS NOT NULL;

-- NEW: Correlation & Tracing indexes
CREATE INDEX idx_audit_correlation ON decision_audit_log(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_audit_trace ON decision_audit_log(trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX idx_audit_span ON decision_audit_log(span_id) WHERE span_id IS NOT NULL;

-- GIN index for JSONB queries (finding decisions by entity ID)
CREATE INDEX idx_audit_input_context ON decision_audit_log USING GIN(input_context);
CREATE INDEX idx_audit_output ON decision_audit_log USING GIN(output);
```

---

#### `policy_versions` (for Time Machine) - NEW

```sql
CREATE TABLE policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES policy_registry(id),
  version TEXT NOT NULL,
  definition JSONB NOT NULL, -- Full policy snapshot
  changelog TEXT, -- Optional: What changed in this version
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(policy_id, version),
  CONSTRAINT version_format_check CHECK (version ~ '^v[0-9]+$') -- e.g., "v1", "v7"
);

CREATE INDEX idx_policy_versions_policy ON policy_versions(policy_id, version DESC);
```

---

#### `policy_registry` (already exists - verify schema)

```sql
-- Verify this table has required columns:
-- id, name, version, domain, status, tags, metadata, providers, rules, dependencies, examples
-- If missing, add migration
```

#### `user_preferences` (for saved views - optional Sprint 4)

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  preference_type TEXT NOT NULL, -- 'decision_engine_view'
  preference_name TEXT NOT NULL,
  preference_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, preference_type, preference_name)
);
```

---

## Integration Points

### Decision Engine Core Integration

**Requirement**: Decision Engine core MUST log to `decision_audit_log` after every decision

**Implementation**: Modify `DecisionEngine.execute()` method

```typescript
// src/lib/decision-engine/DecisionEngine.ts
async execute(context: DecisionContext): Promise<DecisionResult> {
  const startTime = Date.now();
  const providers = this.policyRegistry.getProvidersForContext(context);
  
  let result: DecisionResult;
  let status: 'success' | 'error' | 'warning' = 'success';
  let auditLog: Array<{ timestamp: string; level: string; message: string }> = [];
  
  try {
    // Execute decision logic
    result = await this.executeProviders(providers, context);
    
    // Determine status from result
    if (result.errors && result.errors.length > 0) {
      status = 'error';
    } else if (result.warnings && result.warnings.length > 0) {
      status = 'warning';
    }
    
  } catch (error) {
    status = 'error';
    // Handle error...
  } finally {
    const executionTimeMs = Date.now() - startTime;
    
    // Log to audit table
    await this.logDecision({
      decisionId: result.decisionId || generateId(),
      decisionType: context.type,
      provider: providers.map(p => p.name).join(','),
      executionTimeMs,
      status,
      inputContext: context,
      policiesExecuted: result.policiesApplied || [],
      matchedRules: result.matchedRules || [],
      output: result,
      auditLog,
      tenantId: context.tenantId,
      userId: context.userId,
      confidenceScore: result.confidence,
    });
  }
  
  return result;
}
```

---

### Navigation Integration

**Add to Main Admin Navigation**:

```typescript
// src/lib/constants/routes.ts
export const ROUTES = {
  // ... existing routes
  DECISION_ENGINE: {
    ROOT: '/dashboard/decision-engine',
    AUDIT: '/dashboard/decision-engine/audit',
    OBSERVABILITY: '/dashboard/decision-engine/observability',
    POLICIES: '/dashboard/decision-engine/policies',
    POLICY_DETAIL: '/dashboard/decision-engine/policies/:id',
    RULE_DETAIL: '/dashboard/decision-engine/rules/:id',
    COVERAGE: '/dashboard/decision-engine/policies/coverage',
    PLATFORM: '/dashboard/decision-engine/platform', // super-admin only
  },
};
```

**Admin Sidebar Menu**:

```tsx
// Add to src/components/AdminSidebar.tsx
{
  label: 'Decision Engine',
  icon: <BrainIcon />,
  items: [
    { label: 'Audit Trail', href: ROUTES.DECISION_ENGINE.AUDIT },
    { label: 'Observability', href: ROUTES.DECISION_ENGINE.OBSERVABILITY },
    { label: 'Policies', href: ROUTES.DECISION_ENGINE.POLICIES },
    { label: 'Coverage', href: ROUTES.DECISION_ENGINE.COVERAGE },
  ],
}
```

---

## Tech Stack

### Backend
- **Framework**: Next.js App Router API routes
- **Database**: PostgreSQL (Supabase)
- **ORM**: Supabase client with TypeScript types
- **Validation**: Zod schemas

### Frontend
- **Framework**: Next.js 15 + React 19
- **Styling**: Tailwind CSS
- **Charts**: Recharts or Chart.js
- **Tables**: TanStack Table (React Table v8)
- **JSON Viewer**: react-json-view or custom component
- **Date Picker**: react-datepicker or shadcn/ui date picker
- **State Management**: React Context + SWR for data fetching

---

## Deployment Checklist

### Sprint 1 Deployment
- [ ] Migration: Create `decision_audit_log` table
- [ ] Code: Integrate audit logging into DecisionEngine.execute()
- [ ] Code: Implement audit trail API endpoints
- [ ] Code: Build Decision Audit Trail page
- [ ] Code: Build Decision Detail Drawer
- [ ] Code: Build Decision History Timeline
- [ ] Test: Verify audit log writes correctly
- [ ] Test: Verify UI displays audit data
- [ ] Deploy: Push to staging
- [ ] QA: Full smoke test
- [ ] Deploy: Push to production
- [ ] Monitor: Check for errors in production logs

### Sprint 2 Deployment
- [ ] Code: Implement metrics API endpoints
- [ ] Code: Build Observability Dashboard
- [ ] Code: Build Performance Heatmap
- [ ] Code: Build Confidence Tracker
- [ ] Test: Load test with 100k+ audit records
- [ ] Deploy: Push to staging
- [ ] QA: Performance validation
- [ ] Deploy: Push to production

### Sprint 3 Deployment
- [ ] Code: Implement policy coverage API
- [ ] Code: Build Coverage Dashboard
- [ ] Code: Build Policy Registry Viewer
- [ ] Code: Build Rule Explorer
- [ ] Test: Verify coverage calculations correct
- [ ] Deploy: Push to staging
- [ ] QA: Validate with real policies
- [ ] Deploy: Push to production

### Sprint 4 Deployment
- [ ] Code: Implement export APIs
- [ ] Code: Build export UI components
- [ ] Code: Implement saved views
- [ ] Code: Build platform analytics (if needed)
- [ ] Test: Export functionality
- [ ] Deploy: Push to staging
- [ ] QA: Full regression test
- [ ] Deploy: Push to production

---

## Success Criteria Summary

### Sprint 1 Success Criteria
✅ **Decision Transparency + Reproducibility Achieved**:
- Mọi quyết định có thể trace từ input → policies → rules → output
- **Decision Time Machine**: Replay decisions với policy versions khác nhau
- **Distributed Tracing**: Track decisions xuyên suốt workflow
- CTO có thể giải thích "tại sao hệ thống quyết định như vậy?" trong < 30 giây
- CTO có thể replay 100 decisions và estimate impact của policy change
- Không còn câu hỏi "hệ thống này là hộp đen"

### Sprint 2 Success Criteria
✅ **Operational Excellence + Resource Awareness**:
- Ops team phát hiện performance issues trong < 5 giây
- **Cost Tracking**: Biết chính xác CPU, Memory, DB, API costs per provider
- **Trace Visualization**: Identify bottlenecks trong workflows
- Business thấy adoption metrics: "X decisions processed today"
- Performance bottlenecks được identify và fix nhanh hơn 80%
- Infrastructure cost optimization được data-driven

### Sprint 3 Success Criteria
✅ **Policy Intelligence + Conflict Prevention**:
- **Shadow Rules Detection**: Tự động phát hiện rules chết hoặc bị che
- **Rule Conflicts**: Catch conflicting rules trước khi deploy
- **Policy Dependency Graph**: Visualize policy relationships
- Admin biết chính xác rules nào đang hoạt động, rules nào chết
- Policy maintainability tăng 10x
- Có "golden features" mà các enterprise rule engines thiếu

### Sprint 4 Success Criteria
✅ **Business Value + AI Governance**:
- **Business KPIs**: CEO/CFO có thể xem ROI và business impact
- **AI Explainability**: Full transparency cho AI decisions
- Export reports để share với stakeholders
- Saved views giúp frequent tasks nhanh hơn
- Platform-level analytics cho multi-tenant insights
- AI cost tracking và governance-ready audit trail

---

## Competitive Comparison: Bella EIP vs Enterprise Rule Engines

| Feature | Bella EIP | Drools | AWS Rules Engine | LaunchDarkly | Fico Decision Mgmt |
|---------|-----------|--------|------------------|--------------|-------------------|
| **Decision Audit Trail** | ✅ Full | ✅ Basic | ✅ Basic | ⚠️ Limited | ✅ Full |
| **Decision Time Machine** | ✅ **YES** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Shadow Rules Detection** | ✅ **YES** | ❌ No | ❌ No | ❌ No | ⚠️ Manual |
| **Rule Conflict Analysis** | ✅ Automated | ⚠️ Manual | ❌ No | ❌ No | ⚠️ Manual |
| **Policy Coverage Dashboard** | ✅ **Real-time** | ⚠️ Reports only | ❌ No | ⚠️ Basic | ⚠️ Basic |
| **Distributed Tracing** | ✅ OpenTelemetry-style | ❌ No | ⚠️ CloudWatch | ❌ No | ❌ No |
| **Resource Cost Tracking** | ✅ CPU/Mem/DB/API | ❌ No | ⚠️ AWS only | ❌ No | ❌ No |
| **Business KPI Integration** | ✅ **Built-in** | ❌ No | ❌ No | ⚠️ Via Analytics | ⚠️ Custom |
| **AI Explainability** | ✅ **Full** | ❌ No | ⚠️ ML only | ❌ No | ⚠️ Limited |
| **Policy Dependency Graph** | ✅ Visual | ❌ No | ❌ No | ❌ No | ⚠️ Text only |
| **Version Snapshot** | ✅ Full | ⚠️ Git-based | ❌ No | ✅ Yes | ✅ Yes |
| **Price** | SaaS | Open Source | Pay-per-use | $$$ | $$$$ |

**Legend**:
- ✅ Full support out-of-the-box
- ⚠️ Partial support or requires custom development
- ❌ Not available

**Unique Selling Points** (Bella EIP has, competitors don't):
1. ⭐ **Decision Time Machine** - Compare policy versions on real decisions
2. ⭐ **Shadow Rules Detection** - Auto-identify dead/shadowed rules
3. ⭐ **Policy Coverage Real-time** - Live analytics mà không cần chạy reports
4. ⭐ **AI Explainability** - Full transparency cho AI provider decisions
5. ⭐ **Business KPI Integration** - Không chỉ technical metrics mà còn business outcomes

---

## Risks & Mitigation

### Risk 1: Audit Log Volume Quá Lớn
**Problem**: 1M decisions/month = 1M rows → query chậm

**Mitigation**:
- Partition table by month (PostgreSQL table partitioning)
- Archive old audit logs sang cold storage (S3) sau 90 ngày
- Aggregate stats vào `decision_metrics_daily` table
- Use materialized views for common queries

### Risk 2: Performance Impact Khi Log Audit
**Problem**: Thêm audit logging có thể làm chậm decision execution

**Mitigation**:
- Log async (fire-and-forget) - không block decision execution
- Use background job queue (BullMQ) cho audit logging
- Batch inserts nếu có nhiều decisions cùng lúc
- Monitor execution time before/after audit logging


### Risk 3: UI Performance Với Large Datasets
**Problem**: Render 10k rows trong table làm browser lag

**Mitigation**:
- Server-side pagination (API trả max 100 rows/page)
- Virtual scrolling nếu cần scroll infinite
- Lazy load charts (load on viewport visible)
- Debounce search/filter inputs

### Risk 4: Security - Sensitive Data in Audit Logs
**Problem**: Input context có thể chứa sensitive data (salary, personal info)

**Mitigation**:
- Mask sensitive fields trước khi log (e.g., `salary: "***"`)
- Row-level security: Users chỉ xem audit logs của tenant họ
- Admin role check cho platform analytics
- Audit log của audit trail (meta-audit) - log who viewed what

---

## Future Enhancements (Post-Launch)

### Phase 2: Configuration UI (When product-market fit achieved)
- Visual Rule Builder (drag-drop conditions)
- Policy Editor (WYSIWYG interface)
- Process Designer (flowchart-style orchestration)
- A/B Testing Framework (compare policy versions live)
- Policy Simulation Sandbox ("What if" analysis)

### Phase 3: Advanced AI Features
- Anomaly detection (unusual decision patterns using ML)
- Auto-suggest rule optimizations (AI analyzes coverage data)
- Natural language query ("Show me all rejected bookings last week where...")
- Policy generation from examples (AI learns patterns from decisions)
- Predictive impact analysis ("If we change Rule X, Y decisions will be affected")

### Phase 4: Enterprise Integrations
- Predictive analytics (forecast decision trends)
- Business impact analysis (revenue impact of policy changes)
- Cohort analysis (compare decision outcomes by customer segment)
- Integration với BI tools (Metabase, Tableau, Power BI)
- Webhook notifications (alert on anomalies, policy changes)
- GraphQL API (alternative to REST for complex queries)

### Phase 5: Advanced Governance (Compliance-heavy industries)
- Policy approval workflows (require approval before activating policy changes)
- Role-based access control (who can view/edit policies)
- Policy change audit trail (Git-style diffs for policy changes)
- Compliance reports (GDPR, SOC2, HIPAA-ready exports)
- Data retention policies (auto-archive old audit logs)
- Encryption at rest (PII protection in audit logs)

---

## References

### Internal Documentation
- `docs/KIEN_TRUC_BELLA_TONG_QUAN.md` - Tổng quan kiến trúc Bella
- `docs/decision-engine/OPERATIONS_CONSOLE_ROADMAP.md` - Strategic roadmap
- `docs/decision-engine/PAYROLL_PROVIDERS_CHECKLIST.md` - Payroll implementation reference
- `src/lib/decision-engine/README.md` - Decision Engine technical docs

### External Inspiration
- **AWS IoT Rules Engine**: Decision audit và rule coverage insights
- **Drools Workbench**: Policy management UI patterns
- **LaunchDarkly**: Feature flag analytics và confidence tracking
- **Metabase**: Self-service analytics UX patterns
- **Datadog**: Observability dashboard design

### API Design Patterns
- REST conventions: GET for reads, POST for writes/exports
- Pagination: `page`, `limit`, `total`, `hasMore`
- Filtering: Query params với consistent naming
- Sorting: `sortBy`, `sortOrder` (asc/desc)
- Error responses: Consistent `{ error: { code, message, details } }`

---

## Document Changelog

| Date       | Version | Changes                                                               | Author |
|------------|---------|-----------------------------------------------------------------------|--------|
| 2026-06-22 | 1.0     | Initial checklist creation (UI-first approach)                        | Kiro   |
| 2026-06-22 | 2.0     | **MAJOR REVISION** - Enterprise-first approach với 10 năng lực bổ sung:| Kiro   |
|            |         | 1. Decision Replay & Time Machine (killer feature)                    |        |
|            |         | 2. Version Snapshot (Engine/Policy/Rule/Provider versions)            |        |
|            |         | 3. Correlation & Distributed Trace (OpenTelemetry-style)              |        |
|            |         | 4. Shadow Rules Detection (golden feature)                            |        |
|            |         | 5. Rule Conflict Analysis                                             |        |
|            |         | 6. Policy Dependency Graph (visual)                                   |        |
|            |         | 7. Decision Cost Tracking (CPU/Memory/DB/API)                         |        |
|            |         | 8. Business KPI Dashboard (CEO-friendly metrics)                      |        |
|            |         | 9. AI Explainability (prompt/model/reasoning audit)                   |        |
|            |         | 10. Competitive comparison table added                                |        |
|            |         | Sprint priorities reordered: Core Evidence → Ops → Intelligence → BI  |        |
|            |         | Database schema extended với correlation, versioning, cost tracking   |        |
| TBD        | 2.1     | Update after Sprint 1 completion (MVP evidence console)               |        |
| TBD        | 2.2     | Update after Sprint 2 completion (Observability + cost tracking)      |        |
| TBD        | 2.3     | Update after Sprint 3 completion (Policy intelligence)                |        |
| TBD        | 3.0     | Final version after all sprints completed                             |        |

**Version 2.0 Key Changes**:
- Shifted from **UI-first** to **Enterprise operational infrastructure-first**
- Added **Decision Time Machine** - replay và compare policy versions (unique to Bella)
- Added **Shadow Rules Detection** - tự động identify dead/shadowed rules (not in Drools/AWS)
- Added **Business KPIs** - CEO/investor-friendly metrics alongside technical metrics
- Added **AI Explainability** - future-proof cho AI provider expansion
- Competitive comparison table chứng minh Bella EIP có features mà competitors thiếu

**Rationale for Changes** (from expert feedback):
> "Roadmap rất mạnh về product nhưng nếu mục tiêu là enterprise-level thì cần ưu tiên operational infrastructure trước UI. Điểm còn thiếu không phải UI mà là năng lực vận hành cốt lõi: Replay, Version Snapshot, Correlation Trace, Shadow Detection, Business KPIs."

---

## Contact & Support

**Questions about implementation?**
- Check `docs/decision-engine/` for technical details
- Review existing Decision Engine tests in `__tests__/decision-engine/`
- Ask team lead for clarification on business requirements

**Found issues during implementation?**
- Document in this file under "Risks & Mitigation"
- Update acceptance criteria if requirements change
- Keep checklist status updated as you complete tasks

---

**End of Document**


- [ ] **API: Replay Decision**
  - Endpoint: `POST /api/decision-engine/replay/:decisionId`
  - Request body:
    ```typescript
    {
      policyVersion?: string; // If null, use current version
      compareWithOriginal?: boolean; // Return diff
    }
    ```
  - Response:
    ```typescript
    {
      decisionId: string;
      originalResult: DecisionResult;
      replayedResult: DecisionResult;
      diff: {
        outputChanged: boolean;
        changedFields: Array<{
          field: string;
          oldValue: any;
          newValue: any;
        }>;
        rulesChanged: {
          addedRules: string[];
          removedRules: string[];
          modifiedRules: Array<{
            ruleId: string;
            changeType: 'priority' | 'condition' | 'action';
            oldValue: any;
            newValue: any;
          }>;
        };
        confidenceChanged: {
          old: number;
          new: number;
          delta: number;
        };
        executionTimeChanged: {
          old: number;
          new: number;
          delta: number;
        };
      };
      snapshot: {
        originalPolicyVersion: string;
        replayedPolicyVersion: string;
        originalEngineVersion: string;
        replayedEngineVersion: string;
      };
    }
    ```

- [ ] **Logic: Version Snapshot Storage**
  - Modify audit log to include version metadata:
    ```typescript
    version_snapshot: {
      engineVersion: string; // e.g., "1.8.2"
      policyVersions: Record<string, string>; // { "payroll-policy": "v7" }
      ruleVersions: Record<string, string>; // { "rule-128": "v2" }
      providerVersions: Record<string, string>; // { "RuleProvider": "2.1" }
    }
    ```

- [ ] **Logic: Policy Version Registry**
  - Add `policy_versions` table:
    ```sql
    CREATE TABLE policy_versions (
      id UUID PRIMARY KEY,
      policy_id UUID NOT NULL REFERENCES policy_registry(id),
      version TEXT NOT NULL,
      definition JSONB NOT NULL, -- Full policy snapshot
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by UUID REFERENCES users(id),
      UNIQUE(policy_id, version)
    );
    ```
  - On policy update, insert new version row
  - Replay uses `policy_versions.definition` for specific version


**Frontend Tasks**:

- [ ] **Component: Time Machine Interface**
  - Located in Decision Detail Drawer
  - UI Elements:
    - **Original Decision Card**: Show original output + timestamp + policy version
    - **Replay Button**: "Replay with Current Policy" (primary CTA)
    - **Version Selector**: Dropdown list of policy versions (optional)
    - **Replay Result Card**: Show new output after replay
    - **Diff Viewer**: Side-by-side comparison với highlights:
      - Green: Added/Improved
      - Red: Removed/Degraded
      - Yellow: Modified
    - **Metadata Comparison Table**:
      | Aspect | Original | Replayed | Change |
      |--------|----------|----------|--------|
      | Policy Version | v5 | v8 | ⬆️ +3 |
      | Matched Rules | R1, R17 | R1, R25 | R17→R25 |
      | Confidence | 0.82 | 0.94 | ⬆️ +0.12 |
      | Execution Time | 9ms | 7ms | ⬇️ -2ms |
      | Outcome | Approve | Reject | ⚠️ Changed |

- [ ] **Component: Decision Diff Viewer**
  - JSON diff với color coding
  - Expandable sections per field
  - Highlight critical changes (outcome, approval status, amounts)
  - Download diff as JSON/PDF

**Acceptance Criteria**:

- [ ] Admin có thể replay bất kỳ decision nào với policy version hiện tại
- [ ] Admin có thể chọn policy version cụ thể để replay (time travel)
- [ ] Diff viewer hiển thị rõ ràng thay đổi gì, tại sao outcome khác
- [ ] Metadata comparison giúp hiểu performance/confidence impact
- [ ] Replay không modify original audit log (read-only operation)

**Success Metrics**:

- **Technical Due Diligence**: CTO có thể replay 10 decisions ngẫu nhiên và verify consistency
- **Policy Migration Confidence**: Trước khi deploy policy mới, replay 100 decisions để estimate impact
- **Debugging Speed**: Giảm 90% thời gian debug "tại sao kết quả thay đổi sau update policy?"
- **Investor Demo**: Wow factor khi demo "time machine" - không ai có tính năng này

---

### 1.5 Correlation & Distributed Trace ⭐⭐⭐⭐☆

**Mục tiêu**: Track decisions xuyên suốt workflow - giống OpenTelemetry cho business logic

**Backend Tasks**:

- [ ] **Add Correlation Fields to Audit Log**
  - Modify `decision_audit_log` schema:
    ```sql
    ALTER TABLE decision_audit_log ADD COLUMN correlation_id UUID;
    ALTER TABLE decision_audit_log ADD COLUMN trace_id TEXT;
    ALTER TABLE decision_audit_log ADD COLUMN span_id TEXT;
    ALTER TABLE decision_audit_log ADD COLUMN parent_span_id TEXT;
    CREATE INDEX idx_audit_correlation ON decision_audit_log(correlation_id);
    CREATE INDEX idx_audit_trace ON decision_audit_log(trace_id);
    ```

- [ ] **API: Get Decision Trace**
  - Endpoint: `GET /api/decision-engine/trace/:traceId`
  - Response:
    ```typescript
    {
      traceId: string;
      rootEntity: { type: string; id: string }; // e.g., { type: 'booking', id: '123' }
      timeline: Array<{
        spanId: string;
        parentSpanId: string | null;
        decisionId: string;
        decisionType: string;
        provider: string;
        timestamp: string;
        duration: number;
        status: 'success' | 'error';
        summary: string;
      }>;
      totalDuration: number;
      criticalPath: string[]; // Array of spanIds on critical path
    }
    ```

- [ ] **Logic: Auto-Generate Trace IDs**
  - Modify DecisionEngine.execute() to accept correlation context:
    ```typescript
    interface CorrelationContext {
      correlationId?: string;
      traceId?: string;
      parentSpanId?: string;
    }
    
    async execute(
      context: DecisionContext,
      correlation?: CorrelationContext
    ): Promise<DecisionResult> {
      const traceId = correlation?.traceId || generateTraceId();
      const spanId = generateSpanId();
      // ... log with correlation metadata
    }
    ```


**Frontend Tasks**:

- [ ] **Component: Distributed Trace Viewer**
  - Waterfall chart (giống Chrome DevTools Network tab):
    - X-axis: Time
    - Y-axis: Decision types
    - Bars: Duration của mỗi decision
    - Color: Status (green/red/yellow)
  - Click bar → open Decision Detail Drawer
  - Highlight critical path (longest chain)
  - Show parallel vs sequential decisions

- [ ] **Integration: Booking/Payroll Detail Pages**
  - Add "Decision Trace" tab
  - Show full trace timeline for entity
  - Example flow:
    ```
    Booking Created (event)
      ├─ Eligibility Check (decision, 5ms)
      ├─ Pricing Calculation (decision, 12ms)
      │   └─ Discount Eligibility (decision, 3ms)
      ├─ Recommendation (decision, 8ms)
      └─ Approval (decision, 4ms)
    Total: 32ms (critical path: Booking → Pricing → Discount → Approval)
    ```

**Acceptance Criteria**:

- [ ] Tất cả decisions trong cùng workflow có chung `traceId`
- [ ] Waterfall chart hiển thị rõ dependencies (parent-child relationships)
- [ ] Critical path được highlight để identify bottleneck
- [ ] Có thể drill down từ trace → individual decision detail

**Success Metrics**:

- Identify workflow bottlenecks trong < 10 giây
- Debug cross-decision issues (e.g., "pricing OK nhưng approval fail") nhanh hơn 80%
- Enterprise architects thích pattern này (giống distributed tracing họ đã biết)

---

## Sprint 2: Operations & Observability - 1.5 tuần

**Mục tiêu**: Health monitoring + cost/resource tracking - không chỉ execution time

