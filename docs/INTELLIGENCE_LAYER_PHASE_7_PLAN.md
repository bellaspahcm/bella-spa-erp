# Intelligence Layer Phase 7 - Forecast & Recommendation Plan

**Phase**: 7 of 8  
**Status**: ⏳ PENDING  
**Duration**: 6 weeks (Tuần 27-32)  
**Start Date**: TBD  
**Completion Target**: TBD

---

## 🎯 **OBJECTIVES**

1. Implement **Forecast Intelligence Module** with 3 forecast models:
   - Revenue Forecast (Time Series - ARIMA/Prophet)
   - Churn Forecast (Logistic Regression)
   - Demand Forecast (Time Series - Seasonal ARIMA)

2. Implement **Recommendation Engine** with 2 algorithms:
   - Service Recommendations (Collaborative Filtering)
   - Upsell Opportunities (Market Basket Analysis - Association Rules)

3. Integrate with existing Intelligence Layer infrastructure:
   - Materialized Views (if needed)
   - Caching strategy (12-24h TTL)
   - API endpoints
   - UI dashboards

---

## 📅 **TIMELINE**

### **Week 1-2: Revenue Forecast Model**

**Deliverables:**
1. Database schema for forecast storage
2. Revenue forecast TypeScript implementation
3. API endpoint: `GET /api/intelligence/forecast/revenue`
4. UI: Revenue Forecast Dashboard

**Tasks:**
- [ ] Create `forecasts` table schema
- [ ] Implement Time Series model (ARIMA or Prophet via Python microservice)
- [ ] Build forecast service with historical data pipeline
- [ ] Create API route handler
- [ ] Build Recharts forecast visualization
- [ ] Write unit tests (forecast accuracy ≥ 85%)
- [ ] Write integration tests

**Technical Stack:**
- Model: ARIMA (statsmodels) or Prophet (Facebook)
- Language: Python (microservice) or TypeScript (simple moving average fallback)
- Data: Monthly revenue from `mv_monthly_pnl`

---

### **Week 3: Churn Forecast Model**

**Deliverables:**
1. Churn risk prediction model
2. API endpoint: `GET /api/intelligence/forecast/churn`
3. UI: Churn Risk Forecast Chart (add to Customer Intelligence Dashboard)

**Tasks:**
- [ ] Extend `mv_customer_activity_summary` with churn labels
- [ ] Implement Logistic Regression model (training pipeline)
- [ ] Build churn prediction service
- [ ] Create API route handler
- [ ] Add chart to existing Customer Dashboard
- [ ] Write unit tests (accuracy ≥ 80%)
- [ ] Write integration tests

**Technical Stack:**
- Model: Logistic Regression (scikit-learn) or Rule-based heuristic
- Features: Recency, Frequency Decline, Revenue Decline, Satisfaction
- Training: Monthly batch job (cron)

---

### **Week 4: Demand Forecast Model**

**Deliverables:**
1. Demand forecast model (inventory planning)
2. API endpoint: `GET /api/intelligence/forecast/demand`
3. UI: Demand Forecast Chart (add to Operational Intelligence Dashboard)

**Tasks:**
- [ ] Create `demand_history` materialized view
- [ ] Implement Seasonal ARIMA model
- [ ] Build demand forecast service
- [ ] Create API route handler
- [ ] Add chart to Inventory Dashboard
- [ ] Write unit tests
- [ ] Write integration tests

**Technical Stack:**
- Model: Seasonal ARIMA (SARIMA)
- Data: Daily product sales + service sessions from `session_logs` & `product_sales`
- Seasonality: Weekly + Monthly patterns

---

### **Week 5: Recommendation Engine - Service Recommendations**

**Deliverables:**
1. Collaborative Filtering algorithm
2. API endpoint: `GET /api/intelligence/recommendation/services`
3. UI: Recommended Services Widget (Customer Detail Page)

**Tasks:**
- [ ] Create `customer_service_history` materialized view
- [ ] Implement User-Based Collaborative Filtering
- [ ] Build recommendation service
- [ ] Create API route handler
- [ ] Build recommendation UI widget
- [ ] Write unit tests (relevance ≥ 70%)
- [ ] Write integration tests

**Technical Stack:**
- Algorithm: Cosine Similarity (User-User CF)
- Data: `bookings` + `booking_service_items` (customer-service matrix)
- Output: Top 5 recommended services per customer

---

### **Week 6: Recommendation Engine - Upsell Opportunities**

**Deliverables:**
1. Market Basket Analysis algorithm
2. API endpoint: `GET /api/intelligence/recommendation/upsell`
3. API endpoint: `GET /api/intelligence/recommendation/packages`
4. UI: Upsell Suggestions Widget (Booking Detail Page)

**Tasks:**
- [ ] Implement Apriori algorithm (Association Rules)
- [ ] Build upsell recommendation service
- [ ] Build package recommendation service
- [ ] Create API route handlers (2 endpoints)
- [ ] Build upsell UI widget
- [ ] Write unit tests
- [ ] Write integration tests

**Technical Stack:**
- Algorithm: Apriori (mlxtend) or FP-Growth
- Metrics: Support, Confidence, Lift
- Data: `booking_service_items` (frequent itemsets)
- Output: Top 3 upsell products/services per booking

---

## 🗂️ **FILE STRUCTURE**

```
src/services/intelligence/forecast/
├── index.ts                      # Exports
├── types.ts                      # TypeScript types
├── revenue-forecast.ts           # Revenue model
├── churn-forecast.ts             # Churn model
└── demand-forecast.ts            # Demand model

src/services/intelligence/recommendation/
├── index.ts                      # Exports
├── types.ts                      # TypeScript types
├── service-recommendation.ts     # Collaborative Filtering
└── upsell-recommendation.ts      # Market Basket Analysis

src/app/api/intelligence/forecast/
├── revenue/route.ts
├── churn/route.ts
└── demand/route.ts

src/app/api/intelligence/recommendation/
├── services/route.ts
├── upsell/route.ts
└── packages/route.ts

src/hooks/intelligence/
├── use-forecast.ts               # React Query hooks
└── use-recommendation.ts         # React Query hooks

src/components/intelligence/
├── RevenueForecastChart.tsx
├── ChurnForecastChart.tsx
├── DemandForecastChart.tsx
├── ServiceRecommendationWidget.tsx
└── UpsellSuggestionWidget.tsx

supabase/migrations/
├── YYYYMMDDHHMMSS_create_forecasts_table.sql
├── YYYYMMDDHHMMSS_create_demand_history_mv.sql
└── YYYYMMDDHHMMSS_create_customer_service_history_mv.sql
```

---

## 🎯 **SUCCESS CRITERIA**

### **Forecast Accuracy**
- [ ] Revenue Forecast: Mean Absolute Percentage Error (MAPE) < 15%
- [ ] Churn Forecast: Accuracy ≥ 80%, Precision ≥ 75%, Recall ≥ 70%
- [ ] Demand Forecast: MAPE < 20%

### **Recommendation Relevance**
- [ ] Service Recommendations: Click-through rate ≥ 15% (A/B test)
- [ ] Upsell Recommendations: Conversion rate ≥ 10% (A/B test)

### **Performance**
- [ ] Response time < 100ms (cached)
- [ ] Response time < 500ms (uncached, real-time calculation)
- [ ] Cache hit rate ≥ 95%

### **Testing**
- [ ] Unit test coverage ≥ 80%
- [ ] Integration test coverage ≥ 90%
- [ ] All tests passing

---

## 🔧 **TECHNICAL DECISIONS**

### **Decision 1: Python Microservice vs TypeScript Implementation**

**Options:**
1. **Python Microservice** (statsmodels, Prophet, scikit-learn, mlxtend)
   - ✅ Pro: Industry-standard ML libraries
   - ✅ Pro: Better accuracy
   - ❌ Con: Additional infrastructure (Docker, API)
   - ❌ Con: Deployment complexity

2. **TypeScript Implementation** (simple-statistics, ml.js, regression.js)
   - ✅ Pro: No additional infrastructure
   - ✅ Pro: Simpler deployment
   - ❌ Con: Limited ML library support
   - ❌ Con: May need fallback to simpler models

**Recommendation**: Start with **TypeScript simple models** (moving average, linear regression, rule-based CF) for MVP. Add Python microservice if accuracy requirements not met.

### **Decision 2: Real-time vs Batch Forecasting**

**Recommendation**: **Batch forecasting** (daily/weekly refresh via cron job)
- Revenue: Daily refresh at 2:00 AM
- Churn: Weekly refresh (Sunday 3:00 AM)
- Demand: Daily refresh at 1:00 AM

**Rationale**: Forecasts are strategic (not operational), don't need real-time updates.

### **Decision 3: Storage Strategy**

**Recommendation**: Store forecasts in `forecasts` table + cache API responses
- Table: `forecasts(id, tenant_id, forecast_type, period, value, confidence, generated_at)`
- Cache TTL: 24 hours (forecasts don't change frequently)
- Invalidate: On manual refresh or new training

---

## 🚨 **RISKS & MITIGATION**

### **Risk 1: Model Accuracy Below Target**
- **Impact**: High (inaccurate forecasts → bad business decisions)
- **Probability**: Medium
- **Mitigation**:
  - Start with simple baselines (moving average)
  - A/B test model vs baseline
  - Add Python microservice if needed
  - Provide confidence intervals in UI

### **Risk 2: Training Data Insufficient**
- **Impact**: High (cannot train models)
- **Probability**: Medium (new tenants have < 6 months data)
- **Mitigation**:
  - Require minimum 6 months historical data
  - Use industry benchmarks as fallback
  - Show "Insufficient Data" message in UI

### **Risk 3: Performance Degradation**
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**:
  - Aggressive caching (24h TTL)
  - Precompute forecasts via cron (don't compute on-demand)
  - Monitor response times

---

## 📊 **DELIVERABLES SUMMARY**

| Deliverable | Lines of Code (Est.) | Status |
|-------------|---------------------|--------|
| Database migrations (3 files) | ~400 lines | ⏳ TODO |
| Forecast module (3 models) | ~900 lines | ⏳ TODO |
| Recommendation module (2 algorithms) | ~800 lines | ⏳ TODO |
| API routes (6 endpoints) | ~500 lines | ⏳ TODO |
| React Query hooks (2 files) | ~400 lines | ⏳ TODO |
| UI components (5 charts/widgets) | ~800 lines | ⏳ TODO |
| Unit tests | ~600 lines | ⏳ TODO |
| Integration tests | ~500 lines | ⏳ TODO |
| Documentation (README) | ~600 lines | ⏳ TODO |
| **TOTAL** | **~5,500 lines** | **0% Complete** |

---

## 📝 **NEXT STEPS**

### **Before Starting Phase 7:**
1. [ ] Review Phase 0-6 completion reports
2. [ ] Set up Python microservice infrastructure (if needed)
3. [ ] Prepare training datasets (export from database)
4. [ ] Align with stakeholders on accuracy targets

### **Week 1 Kickoff:**
1. [ ] Create Phase 7 task tracker (Notion/Jira)
2. [ ] Assign tasks to team members
3. [ ] Setup CI/CD pipeline for forecast service
4. [ ] Create `forecasts` table migration

---

## 🔗 **RELATED DOCUMENTS**

- `INTELLIGENCE_LAYER_ROADMAP.md` - Overall roadmap
- `INTELLIGENCE_LAYER_ARCHITECTURE.md` - System architecture
- `BI_PROVIDER_GUIDE.md` - Decision Engine integration
- `INTELLIGENCE_LAYER_PHASE_6_TASK_SUMMARY.md` - Previous phase (Customer Intelligence)

---

**Last Updated**: 2026-06-22  
**Author**: AI Agent (Kiro)  
**Status**: Draft - Awaiting approval to start

