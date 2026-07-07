# Production Readiness Checklist

## ❌ NOT Ready Until These Pass

### Manual Integration Test (Real Data)
- [ ] KTV thật tạo đơn nghỉ
- [ ] Supervisor thật nhận notification
- [ ] Decision Engine đưa ra recommendation
- [ ] Supervisor approve/reject
- [ ] Database được update đúng
- [ ] Audit log ghi lại đầy đủ

### Observability
- [ ] Structured logs với requestId, employeeId, outcome, reason
- [ ] Query duration tracking
- [ ] Policy execution metrics

### Production Soak (3-5 days minimum)
- [ ] Chạy với traffic thật
- [ ] Quan sát override rate
- [ ] Thu thập feedback từ supervisor
- [ ] Xác định rule nào cần điều chỉnh
- [ ] Fix bugs phát hiện trong thực tế

---

## ✅ Only After Above Pass

- [ ] Document findings from production soak
- [ ] Adjust rules if needed
- [ ] Update policy version if changed
- [ ] **Then and only then** → Start Sprint 3 (Booking)

---

**Philosophy:** Don't add policy #2 until policy #1 is battle-tested in production.
