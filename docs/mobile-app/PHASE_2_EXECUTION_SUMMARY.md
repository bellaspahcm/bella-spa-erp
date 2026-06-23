# Phase 2: Deploy RPC - Tóm Tắt Thực Hiện

**Ngày bắt đầu:** 2026-06-22  
**Status:** 🟡 IN PROGRESS  
**Thời gian ước tính:** 30-45 phút  

---

## 📋 NHỮNG GÌ CẦN LÀM

### 1️⃣ Deploy 2 RPCs lên Production (30-45 phút)

**Tài liệu chi tiết:** `docs/mobile-app/RPC_DEPLOY_VIA_DASHBOARD.md`

**Các bước:**
1. Mở Supabase Dashboard → SQL Editor
2. Copy-paste SQL từ file hướng dẫn
3. Run và verify
4. Test với real data
5. Monitor logs

**Kết quả mong đợi:**
- ✅ Function `rpc_mobile_today_sessions` created
- ✅ Function `rpc_ktv_dashboard_stats` created
- ✅ Tests PASS
- ✅ No errors in logs

---

## 🚀 BẮT ĐẦU NGAY

### Chuẩn bị trước khi bắt đầu:

1. **Mở tài liệu hướng dẫn:**
   ```
   File: docs/mobile-app/RPC_DEPLOY_VIA_DASHBOARD.md
   ```

2. **Mở Supabase Dashboard:**
   ```
   URL: https://supabase.com/dashboard
   Project: [CHỌN PRODUCTION PROJECT]
   ```

3. **Chuẩn bị editor để ghi notes:**
   - Backup ID
   - Test results
   - Any issues encountered

---

### Thực hiện theo thứ tự:

**BƯỚC 1: BACKUP (5 phút)**
- [ ] Vào Settings → Database → Backups
- [ ] Verify có backup hôm nay
- [ ] Lưu Backup ID: `_______________________`

**BƯỚC 2: DEPLOY RPCs (15 phút)**
- [ ] SQL Editor → New Query
- [ ] Copy SQL từ section 2.2 trong hướng dẫn
- [ ] Run RPC #1: `rpc_mobile_today_sessions`
- [ ] Verify: See function in result
- [ ] Copy SQL từ section 2.3
- [ ] Run RPC #2: `rpc_ktv_dashboard_stats`
- [ ] Verify: See function in result

**BƯỚC 3: TEST (10 phút)**
- [ ] Get tenant ID và KTV ID từ production
- [ ] Test Admin mode (NULL ktv_id)
- [ ] Test KTV mode (với ktv_id)
- [ ] Test cross-KTV isolation 🔴 **CRITICAL**
- [ ] Verify: Kết quả khác nhau cho 2 KTVs

**BƯỚC 4: MONITOR (10 phút)**
- [ ] Check Logs → Database → Last 30 minutes
- [ ] Check Reports → Database → Query Performance
- [ ] Verify: No errors, performance < 500ms

---

## ✅ COMPLETION CRITERIA

**Deploy thành công khi:**
- ✅ 2 RPCs created và verified
- ✅ All tests PASS
- ✅ Cross-KTV isolation PASS (mỗi KTV chỉ thấy data của mình)
- ✅ No errors in logs
- ✅ Performance < 500ms

**Nếu PASS tất cả → Chuyển sang testing trên mobile app local**

---

## 🆘 NẾU GẶP LỖI

### Scenario 1: SQL Error khi chạy CREATE FUNCTION

**Lỗi có thể gặp:**
```
ERROR: relation "session_logs" does not exist
```

**Nguyên nhân:** Sai database hoặc schema

**Giải pháp:**
1. Verify bạn đang ở **production project** (không phải staging)
2. Check table exists:
   ```sql
   SELECT tablename FROM pg_tables WHERE schemaname = 'public';
   ```
3. Nếu không thấy `session_logs` → SAI DATABASE, đổi project!

---

### Scenario 2: Test trả về 0 rows

**Lỗi:**
```sql
SELECT * FROM rpc_mobile_today_sessions(...);
-- Returns: 0 rows
```

**Nguyên nhân:** Không có sessions hôm nay trong production

**Giải pháp:**
1. **Option A:** Đổi ngày test sang hôm qua hoặc hôm có data:
   ```sql
   SELECT * FROM rpc_mobile_today_sessions(
     '<tenant_id>'::UUID,
     '2026-06-21'::DATE,  -- Thử ngày khác
     NULL
   );
   ```

2. **Option B:** Tạo test data:
   ```sql
   -- Insert 1 booking và session để test
   -- (Xem test-data-generator.sql)
   ```

---

### Scenario 3: Cross-KTV test trả về kết quả giống nhau

**Lỗi:** KTV A và KTV B có cùng `total_sessions` và `completed_sessions`

**Nguyên nhân:** 
- Option 1: Cả 2 KTV thực sự có cùng số sessions (ngẫu nhiên)
- Option 2: Logic filter sai (DATA LEAK - nghiêm trọng!)

**Giải pháp:**
1. Verify bằng query thủ công:
   ```sql
   SELECT COUNT(*) 
   FROM session_logs sl
   JOIN bookings b ON b.id = sl.booking_id
   WHERE b.assigned_ktv_id = '<KTV_A_ID>'
   AND sl.scheduled_date = CURRENT_DATE;
   
   SELECT COUNT(*) 
   FROM session_logs sl
   JOIN bookings b ON b.id = sl.booking_id
   WHERE b.assigned_ktv_id = '<KTV_B_ID>'
   AND sl.scheduled_date = CURRENT_DATE;
   ```

2. Nếu 2 queries trên trả về số khác nhau NHƯNG RPC trả về giống nhau → **DATA LEAK! ROLLBACK NGAY!**

3. Nếu 2 queries trả về giống nhau → OK, chỉ là trùng hợp ngẫu nhiên, thử với KTVs khác

---

### Scenario 4: Performance chậm (>1 giây)

**Lỗi:** Query execution time >1000ms

**Nguyên nhân:** Thiếu indexes hoặc data volume lớn

**Giải pháp:**
1. Note lại execution time: `_____ms`
2. Check số rows trong bảng:
   ```sql
   SELECT 
     (SELECT COUNT(*) FROM session_logs) as sessions_count,
     (SELECT COUNT(*) FROM bookings) as bookings_count;
   ```

3. Nếu >10,000 rows → Cần add indexes (thực hiện sau pilot)
4. Nếu <10,000 rows và vẫn chậm → Check network/server load

**⚠️ Tạm thời:** Performance <1s là chấp nhận được cho pilot phase

---

## 📞 CONTACTS & ESCALATION

**Nếu cần hỗ trợ khẩn cấp:**

| Vấn đề | Liên hệ |
|--------|---------|
| SQL errors, cannot deploy | Dev Team Lead |
| Production database access | DevOps/Admin |
| Data leak detected | **CTO - NGAY LẬP TỨC** |
| Unsure how to proceed | Project Manager |

**Kênh liên lạc:**
- Telegram/Zalo group: [PROJECT_GROUP]
- Email: [TEAM_EMAIL]
- Phone (emergency only): [PHONE]

---

## 📝 POST-DEPLOYMENT CHECKLIST

**Sau khi deploy xong, làm các việc sau:**

### 1. Update documentation

- [ ] Điền test results vào `RPC_DEPLOY_VIA_DASHBOARD.md`
- [ ] Update `WEEK_3_POST_REVIEW_ACTION_PLAN.md`:
  ```
  Phase 2: Deploy RPC
  ✅ COMPLETED on [DATE] by [NAME]
  - rpc_mobile_today_sessions: ✅
  - rpc_ktv_dashboard_stats: ✅
  - All tests: PASS
  ```

### 2. Notify team

```
📢 RPC Deployment Complete

✅ 2 RPCs deployed to production
✅ All tests PASS
✅ Cross-KTV isolation verified
⏱️ Performance: <500ms

Next: Test mobile app with production RPCs
```

### 3. Commit documentation updates

```bash
git add docs/mobile-app/*.md
git commit -m "docs(mobile): Phase 2 RPC deployment complete"
git push origin main
```

---

## 🎯 NEXT STEPS (after RPC deploy)

**Sau khi RPCs đã live:**

### Immediate (today):

1. **Test mobile app locally với production RPCs:**
   ```bash
   cd apps/mobile
   # Verify .env.local points to production
   cat .env.local
   # Should see production Supabase URL
   
   npx expo start
   ```

2. **Verify app calls RPCs successfully:**
   - Open app on simulator/Expo Go
   - Login với test account
   - Dashboard should load with real production data
   - Check Network tab: See `rpc_mobile_today_sessions` calls

### Tomorrow (Day 2):

3. **Device testing preparation:**
   - Follow `PRE_WEEK_4_EXECUTION_CHECKLIST.md` Bước 2
   - Setup iPhone + Android devices
   - Prepare test accounts
   - Create test report template

### This week (Day 2-3):

4. **Device testing execution:**
   - Full test suite on both platforms
   - Verify KTV isolation
   - Test offline behavior
   - Collect screenshots

### Next week:

5. **Production pilot:**
   - Recruit 2-3 real KTVs
   - Build production app (EAS Build)
   - Monitor for 2-3 days
   - Collect feedback

---

## 📊 SUCCESS METRICS

**Phase 2 considered successful when:**

| Metric | Target | Status |
|--------|--------|--------|
| RPCs deployed | 2/2 | ⏳ In Progress |
| Deployment time | <1 hour | ⏳ |
| SQL errors | 0 | ⏳ |
| Test PASS rate | 100% | ⏳ |
| Cross-KTV isolation | PASS | ⏳ |
| Performance | <500ms | ⏳ |

**Overall Phase 2 Status:** 🟡 IN PROGRESS

---

**Document created:** 2026-06-22  
**Last updated:** 2026-06-22  
**Next update:** After deployment complete
