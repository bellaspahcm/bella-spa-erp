# Bella Auto - TODO List Triển Khai
**Ngày bắt đầu:** 04/08/2026  
**Deadline:** 11/08/2026 (1 tuần)

---

## 🚨 P0 - KHẨN CẤP: Booking & Đặt Cọc Hub (6 giờ)

### Phase 1: Database & API (2 giờ)
- [x] ✅ Verify `auto_bookings` table exists
- [x] ✅ Create `auto_deposits` table migration
- [x] ✅ Create API route: `/api/bella-auto/bookings/[id]/confirm-deposit/route.ts`
- [ ] Deploy migration: `supabase db push`
- [ ] Test API với real data

### Phase 2: UI Components (3 giờ)
- [x] ✅ Create `src/components/bella-auto/BookingStats.tsx`
- [x] ✅ Create `src/components/bella-auto/BookingListTable.tsx`
- [x] ✅ Helper components: `StatCard`, `FilterTab`, `DepositStatusBadge`
- [x] ✅ Loading skeletons

### Phase 3: Page & Integration (1 giờ)
- [x] ✅ Create `src/app/dashboard/bella-auto/bookings/page.tsx`
- [x] ✅ Update `src/modules/bella-auto/manifest.ts` (add menu)
- [ ] 🔄 Deploy migration and test
- [ ] Test with real data in `bella_auto_demo` tenant
- [ ] Screenshot for documentation

---

## ⭐ P1 - CAO: Dashboard Analytics (4 giờ)

### Phase 1: Database RPCs (2 giờ)
- [ ] Create migration `supabase/migrations/20260804300000_analytics_rpcs.sql`
- [ ] Write RPC: `get_auto_inventory_trend(p_tenant_id)`
- [ ] Write RPC: `get_auto_top_models(p_tenant_id, p_limit)`
- [ ] Write RPC: `get_auto_revenue_by_month(p_tenant_id)`
- [ ] Deploy: `supabase db push`
- [ ] Test RPCs in SQL Editor

### Phase 2: Component Update (2 giờ)
- [ ] Update `src/components/bella-auto/BellaAutoAnalyticsDashboard.tsx`
- [ ] Replace all `generateXXX()` mock functions with RPC calls
- [ ] Add error handling for RPC failures
- [ ] Test with production data
- [ ] Verify numbers with accounting team

---

## 📝 Progress Tracking

**Booking Hub:** 9/12 tasks (75%) ⚡ IN PROGRESS  
**Dashboard Analytics:** 0/10 tasks (0%)  
**Overall:** 9/22 tasks (41%)

---

## 🎯 Success Criteria

### Booking Hub
- [ ] Sales có thể xem danh sách booking chưa cọc
- [ ] Kế toán có thể confirm cọc đã nhận
- [ ] Thống kê hiển thị đúng số tiền cọc đã thu/chưa thu
- [ ] Filter hoạt động (all/unpaid/partial/full)

### Dashboard Analytics
- [ ] Tất cả biểu đồ hiển thị dữ liệu thật (không còn random)
- [ ] Số liệu khớp với database
- [ ] Performance tốt (<2s load time)
- [ ] Không có lỗi console

---

**Last Updated:** 04/08/2026 23:50
