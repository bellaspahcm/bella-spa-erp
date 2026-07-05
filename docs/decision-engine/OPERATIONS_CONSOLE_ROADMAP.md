# Decision Engine Operations Console - Implementation Roadmap

**Objective:** Build an "Evidence Console" to prove Bella EIP is a production-ready Business Decision Intelligence Platform.

**Timeline:** 4 sprints (4 weeks)

**Target Audience:** 
- Internal operations team (troubleshooting)
- CTO evaluation (technical due diligence)
- Investors (proof of intelligence)

---

## 🎯 Success Criteria

After completing this roadmap, we should be able to demonstrate:

✅ **Transparency:** Every decision can be audited and explained  
✅ **Intelligence:** System knows which rules work and which don't  
✅ **Performance:** System identifies and highlights bottlenecks  
✅ **Explainability:** Business users understand why decisions were made  
✅ **Reliability:** System tracks confidence and success rates  

---

## Sprint 1: Decision Audit Trail (MVP)

**Duration:** 1 week (June 24-28, 2026)

**Goal:** Prove that every decision is traceable and explainable.

### Backend Tasks

- [ ] **API: Get audit trail list** (`GET /api/decision/audit`)
  - [ ] Support pagination (page, limit)
  - [ ] Support filters: decisionType, tenantId, dateRange, provider, status
  - [ ] Support sorting: timestamp DESC by default
  - [ ] Return: decisionId, decisionType, timestamp, provider, executionTime, confidence, status
  - [ ] Test with 1000+ records

- [ ] **API: Get decision detail** (`GET /api/decision/audit/:decisionId`)
  - [ ] Return full DecisionContext (input)
  - [ ] Return full DecisionResult (output)
  - [ ] Return matched rules with priorities
  - [ ] Return metadata (timestamp, provider, executionTime)
  - [ ] Return actions taken
  - [ ] Test with complex decisions (multiple rules)

- [ ] **RPC: Get audit trail with filters**
  - [ ] Create `get_decision_audit_trail` RPC in Supabase
  - [ ] Add indexes on: timestamp, decisionType, tenantId, provider
  - [ ] Optimize query for large datasets (100k+ records)

### Frontend Tasks

- [ ] **Page: `/dashboard/decision-engine`**
  - [ ] Create new route
  - [ ] Add to sidebar navigation (icon: brain/circuit)
  - [ ] Page title: "Decision Engine Operations"

- [ ] **Component: AuditTrailTable**
  - [ ] Table columns: Decision ID, Type, Tenant, Provider, Time, Confidence, Status, Actions
  - [ ] Row click → open detail modal
  - [ ] Support sorting by column
  - [ ] Support pagination (20 records per page)
  - [ ] Loading state skeleton
  - [ ] Empty state message

- [ ] **Component: DecisionDetailModal**
  - [ ] Header: Decision ID, Type, Timestamp
  - [ ] Section 1: **Input Context** (JSON viewer with syntax highlight)
  - [ ] Section 2: **Matched Rules** (list with priorities)
  - [ ] Section 3: **Output Decision** (approved/rejected + reason)
  - [ ] Section 4: **Actions Taken** (what happened after decision)
  - [ ] Section 5: **Metadata** (executionTime, provider, confidence)
  - [ ] Copy button for JSON
  - [ ] Close button

- [ ] **Component: AuditFilters**
  - [ ] Filter by Decision Type (dropdown: all, booking, payroll, discount, procurement)
  - [ ] Filter by Date Range (date picker: last 7 days, last 30 days, custom)
  - [ ] Filter by Provider (dropdown: all, RuleProvider, BIProvider, AIProvider)
  - [ ] Filter by Status (dropdown: all, success, error, fallback)
  - [ ] "Apply Filters" button
  - [ ] "Reset Filters" button

### Testing

- [ ] Test with 0 decisions (empty state)
- [ ] Test with 1000+ decisions (pagination)
- [ ] Test filters combinations
- [ ] Test modal with complex decision (booking with multiple rules)
- [ ] Test modal with simple decision (payroll single rule)
- [ ] Test on mobile (responsive)

### Documentation

- [ ] Add user guide: "How to use Decision Audit Trail"
- [ ] Add troubleshooting guide: "How to debug a failed decision"

---

## Sprint 2: Observability Dashboard

**Duration:** 1 week (July 1-5, 2026)

**Goal:** Provide real-time visibility into Decision Engine health and performance.

### Backend Tasks

- [ ] **API: Get decision metrics** (`GET /api/decision/metrics`)
  - [ ] Return: totalDecisions (24h, 7d, 30d)
  - [ ] Return: avgExecutionTime, p50, p95, p99
  - [ ] Return: successRate, errorRate, fallbackRate
  - [ ] Return: topProviders (name, count, avgTime)
  - [ ] Return: topDecisionTypes (name, count, avgTime)
  - [ ] Cache results (5 minutes TTL)

- [ ] **API: Get decision stats by time** (`GET /api/decision/stats/timeline`)
  - [ ] Support granularity: hour, day, week
  - [ ] Return time series data for charts
  - [ ] Return: timestamp, count, avgExecutionTime, errorRate
  - [ ] Support date range filter

- [ ] **API: Get performance heatmap** (`GET /api/decision/performance-heatmap`)
  - [ ] Group by: decisionType + provider
  - [ ] Return: count, avgTime, minTime, maxTime, p95Time
  - [ ] Sort by avgTime DESC (slowest first)

- [ ] **API: Get confidence distribution** (`GET /api/decision/confidence-distribution`)
  - [ ] Group decisions by confidence ranges: high (>0.9), medium (0.7-0.9), low (<0.7)
  - [ ] Return: range, count, percentage
  - [ ] Support filter by decisionType

### Frontend Tasks

- [ ] **Page: `/dashboard/decision-engine/metrics`**
  - [ ] Create route (tab under Decision Engine)
  - [ ] Page title: "Decision Engine Metrics"

- [ ] **Component: MetricsOverview**
  - [ ] Card 1: **Total Decisions** (24h / 7d / 30d with trend)
  - [ ] Card 2: **Avg Execution Time** (with p95 and p99)
  - [ ] Card 3: **Success Rate** (percentage with trend)
  - [ ] Card 4: **Error Rate** (percentage with alert if >5%)
  - [ ] Use recharts for mini sparklines

- [ ] **Component: DecisionTimeline**
  - [ ] Line chart: Decisions over time (24h view)
  - [ ] X-axis: Hour
  - [ ] Y-axis: Decision count
  - [ ] Multiple lines: success, error, fallback
  - [ ] Tooltips on hover

- [ ] **Component: PerformanceHeatmap**
  - [ ] Table with color-coded cells
  - [ ] Rows: Decision Types (booking, payroll, discount)
  - [ ] Columns: Providers (RuleProvider, BIProvider)
  - [ ] Cell color: green (<10ms), yellow (10-50ms), red (>50ms)
  - [ ] Cell content: avg time + count
  - [ ] Click cell → show detail breakdown

- [ ] **Component: ConfidenceTracker**
  - [ ] Pie chart: High / Medium / Low confidence
  - [ ] Legend with counts and percentages
  - [ ] Warning badge if low confidence >5%
  - [ ] Click slice → show decisions with that confidence

- [ ] **Component: TopProviders**
  - [ ] Bar chart: Provider usage
  - [ ] X-axis: Provider name
  - [ ] Y-axis: Decision count
  - [ ] Tooltip: avg execution time

- [ ] **Component: TopDecisionTypes**
  - [ ] Bar chart: Decision type usage
  - [ ] X-axis: Decision type
  - [ ] Y-axis: Decision count
  - [ ] Tooltip: avg execution time

### Testing

- [ ] Test with no data (show "0" instead of errors)
- [ ] Test with large datasets (100k decisions)
- [ ] Test real-time updates (data refreshes every 30s)
- [ ] Test charts on mobile (responsive)
- [ ] Test performance (page load <2s)

### Documentation

- [ ] Add metrics glossary (what is p95? what is confidence?)
- [ ] Add troubleshooting: "What to do when error rate is high?"

---

## Sprint 3: Intelligence Dashboard

**Duration:** 1 week (July 8-12, 2026)

**Goal:** Prove system intelligence by showing policy coverage and decision patterns.

### Backend Tasks

- [ ] **API: Get policy coverage** (`GET /api/decision/policy-coverage`)
  - [ ] Group by: policyId, ruleId
  - [ ] Return: ruleId, ruleName, hitCount, percentage, lastExecuted
  - [ ] Sort by hitCount DESC
  - [ ] Flag rules with 0 hits (dead rules)
  - [ ] Support filter by date range

- [ ] **API: Get decision history for entity** (`GET /api/decision/history/:entityType/:entityId`)
  - [ ] Support entityType: booking, customer, employee
  - [ ] Return timeline of all decisions for that entity
  - [ ] Return: timestamp, decisionType, result, reason
  - [ ] Sort by timestamp DESC

- [ ] **RPC: Get policy registry** (`SELECT * FROM policy_registry`)
  - [ ] Return all registered policies
  - [ ] Include: id, name, domain, category, status, tags
  - [ ] Filter by status: active, deprecated, experimental

- [ ] **API: Get rule explorer data** (`GET /api/decision/rules`)
  - [ ] Group by policy/domain
  - [ ] Return: ruleId, description, priority, conditions, actions
  - [ ] Support search by keyword

### Frontend Tasks

- [ ] **Page: `/dashboard/decision-engine/intelligence`**
  - [ ] Create route (tab under Decision Engine)
  - [ ] Page title: "Decision Intelligence"

- [ ] **Component: PolicyCoverageTable**
  - [ ] Table columns: Rule ID, Rule Name, Hit Count, Coverage %, Last Used, Status
  - [ ] Color code: green (>10%), yellow (1-10%), red (0% - dead rule)
  - [ ] Badge for dead rules: ⚠️ Never Executed
  - [ ] Sort by coverage DESC by default
  - [ ] Filter by date range

- [ ] **Component: CoverageSummary**
  - [ ] Card 1: **Total Rules** (count)
  - [ ] Card 2: **Active Rules** (hit count >0)
  - [ ] Card 3: **Dead Rules** (hit count = 0)
  - [ ] Card 4: **Avg Rule Coverage** (percentage)

- [ ] **Component: DecisionHistoryTimeline**
  - [ ] Vertical timeline (like GitHub commits)
  - [ ] Each node: decision icon + type + result + timestamp
  - [ ] Click node → expand to show full details
  - [ ] Support pagination (show last 20)
  - [ ] Empty state: "No decisions yet"

- [ ] **Component: PolicyRegistryViewer**
  - [ ] Table columns: Policy, Domain, Category, Status, Tags, Rules Count
  - [ ] Click row → expand to show rules
  - [ ] Filter by domain (dropdown)
  - [ ] Filter by status (active/deprecated/experimental)
  - [ ] Search by name or tag

- [ ] **Component: RuleExplorer**
  - [ ] Tree view: Policy → Rules
  - [ ] Click rule → show detail panel
  - [ ] Detail panel: ID, Description, Priority, Conditions (JSON), Actions (JSON)
  - [ ] Read-only (no edit)

### Testing

- [ ] Test policy coverage with 100% covered rules
- [ ] Test policy coverage with dead rules (0%)
- [ ] Test decision history with empty entity
- [ ] Test decision history with 50+ decisions
- [ ] Test policy registry with 20+ policies
- [ ] Test rule explorer search

### Documentation

- [ ] Add guide: "How to identify dead rules"
- [ ] Add guide: "How to interpret policy coverage"
- [ ] Add guide: "How to use Decision History for debugging"

---

## Sprint 4: Polish & Advanced Features

**Duration:** 1 week (July 15-19, 2026)

**Goal:** Make Operations Console production-ready with advanced features.

### Backend Tasks

- [ ] **API: Export audit trail to CSV** (`POST /api/decision/audit/export`)
  - [ ] Support same filters as audit trail
  - [ ] Generate CSV with all columns
  - [ ] Stream response (don't load all in memory)
  - [ ] Add timestamp to filename

- [ ] **API: Save custom view** (`POST /api/decision/views`)
  - [ ] Save filter combinations with name
  - [ ] Store per user
  - [ ] Return saved views list

- [ ] **API: Multi-tenant comparison** (`GET /api/decision/comparison`)
  - [ ] Compare metrics across tenants
  - [ ] Return: tenantId, name, totalDecisions, avgTime, errorRate
  - [ ] Sort by metric (configurable)

- [ ] **WebSocket: Real-time metrics** (`ws://decision-metrics`)
  - [ ] Push new decision events to connected clients
  - [ ] Update dashboard without refresh
  - [ ] Throttle updates (max 1 per second)

### Frontend Tasks

- [ ] **Feature: Export to CSV**
  - [ ] Add "Export" button to AuditTrailTable
  - [ ] Show loading spinner during export
  - [ ] Download file automatically
  - [ ] Show success toast

- [ ] **Feature: Advanced Filters**
  - [ ] Add filter by Confidence (>0.9, 0.7-0.9, <0.7)
  - [ ] Add filter by Execution Time (fast <10ms, medium 10-50ms, slow >50ms)
  - [ ] Add filter by Result (approved, rejected, manual-review)
  - [ ] Add "Save Filter" button

- [ ] **Feature: Saved Views**
  - [ ] Dropdown: "My Views"
  - [ ] List saved filter combinations
  - [ ] Click → apply filters
  - [ ] Delete view option

- [ ] **Feature: Multi-tenant Analytics**
  - [ ] New page: `/dashboard/decision-engine/tenants`
  - [ ] Table: Tenant, Decisions, Avg Time, Error Rate, Success Rate
  - [ ] Sort by any column
  - [ ] Click tenant → drill down to tenant-specific dashboard

- [ ] **Feature: Real-time Updates**
  - [ ] Connect to WebSocket on dashboard mount
  - [ ] Show toast notification for new decisions
  - [ ] Update metrics cards in real-time
  - [ ] Add "Pause Updates" toggle

- [ ] **Feature: Dark Mode Support**
  - [ ] Ensure all charts support dark mode
  - [ ] Test all pages in dark mode
  - [ ] Fix contrast issues

- [ ] **Feature: Mobile Optimization**
  - [ ] Make all tables responsive (horizontal scroll)
  - [ ] Stack metrics cards on mobile
  - [ ] Simplify charts for small screens

### Testing

- [ ] Load test: 10,000 decisions export
- [ ] Load test: 100 concurrent WebSocket connections
- [ ] Test saved views persistence
- [ ] Test multi-tenant comparison with 10+ tenants
- [ ] Test real-time updates (create decision → see it appear)
- [ ] Test on mobile devices (iOS Safari, Android Chrome)
- [ ] Test on different screen sizes (1920x1080, 1366x768, 768x1024)

### Documentation

- [ ] Create video demo: "Decision Engine Operations Console Tour" (5 minutes)
- [ ] Create investor pitch deck slides (10 slides with screenshots)
- [ ] Create technical documentation: "Architecture & Implementation"
- [ ] Create user manual: "Complete Operations Guide" (PDF)

---

## 📊 Acceptance Criteria

Before marking this roadmap as complete, verify:

### Functionality
- [ ] All API endpoints return data correctly
- [ ] All pages load within 2 seconds
- [ ] All charts render without errors
- [ ] All filters work correctly
- [ ] Export generates valid CSV
- [ ] WebSocket updates work in real-time

### Quality
- [ ] Zero TypeScript errors
- [ ] Zero ESLint warnings
- [ ] All components have loading states
- [ ] All components have empty states
- [ ] All components have error states
- [ ] All pages are responsive (mobile + desktop)

### Performance
- [ ] Dashboard loads <2s with 10k decisions
- [ ] Charts render <500ms
- [ ] Export completes <5s for 1000 records
- [ ] WebSocket latency <100ms

### Documentation
- [ ] All API endpoints documented
- [ ] All components documented (Storybook)
- [ ] User guide completed
- [ ] Troubleshooting guide completed
- [ ] Video demo recorded

### Demo-Ready for Investors
- [ ] Can show full decision audit trail
- [ ] Can show policy coverage dashboard
- [ ] Can show performance heatmap
- [ ] Can show decision history timeline
- [ ] Can explain every metric clearly
- [ ] Can demonstrate real-time updates
- [ ] Can export data to CSV

---

## 🎯 Success Metrics

After 4 weeks, we should be able to say:

✅ **100% decision transparency:** Every decision can be traced back to its rule  
✅ **Real-time observability:** We know exactly how the engine is performing  
✅ **Intelligence proof:** We can show which rules work and which don't  
✅ **Production-ready:** Operations team can debug issues without developer help  
✅ **Investor-ready:** CTO/investors can evaluate platform capability  

---

## 🚀 Next Phase (After Operations Console)

Once Operations Console is complete, consider:

1. **Phase 2.1: Rule Editor UI** (if business needs to change rules frequently)
2. **Phase 2.2: Process Designer** (if workflow complexity increases)
3. **Phase 2.3: AI Policy Recommendation** (suggest rule optimizations based on coverage data)
4. **Phase 2.4: Multi-tenant SaaS** (if expanding to multiple customers)

---

## 📝 Notes

- This roadmap assumes backend APIs (`/api/decision/*`) already exist or can be built quickly
- Timeline is aggressive (4 weeks) - adjust if needed based on team size
- Prioritize Sprint 1 & 2 for MVP - Sprint 3 & 4 can be deferred if needed
- Focus on "Evidence Console" narrative for investor pitch
- All charts should use consistent color scheme (match Bella brand)
- All timestamps should respect tenant timezone

---

**Document Version:** 1.0  
**Last Updated:** June 22, 2026  
**Owner:** Bella Platform Team  
**Status:** 🟡 Draft (Ready for Review)
