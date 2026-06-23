# Production Pilot Guide — Real KTV Testing
**Date:** 2026-06-22  
**Duration:** 2-3 days  
**Participants:** 2-3 real KTVs from Bella Spa  
**Purpose:** Validate mobile app in real-world production environment before Week 4

---

## 🎯 PILOT OBJECTIVES

### Primary Goals
1. **Verify KTV stats accuracy** in real production data
2. **Validate user experience** with real KTVs (not testers)
3. **Identify usability issues** early
4. **Build confidence** before wider rollout

### Success Criteria
- ✅ All pilot users can login successfully
- ✅ KTV dashboard shows correct session counts (not all spa sessions)
- ✅ No crashes or blank screens reported
- ✅ Realtime updates work in production
- ✅ Positive feedback from at least 2/3 pilot users

---

## 👥 PILOT USER SELECTION

### Criteria for Pilot Users

**Select KTVs who are:**
- ✅ Tech-savvy (comfortable with apps)
- ✅ Active (work 4-5 days/week)
- ✅ Communicative (can provide feedback via Telegram/Zalo)
- ✅ Patient (understand this is early testing)
- ✅ Representative of typical users

**Do NOT select:**
- ❌ Users with very old devices (iOS <15, Android <10)
- ❌ Users who are not working this week
- ❌ Users who are too busy to provide feedback

---

### Recommended Pilot Group

**Pilot User #1: KTV Lead**
- Role: Senior KTV
- Why: Experienced, can spot issues quickly
- Device: iPhone preferred

**Pilot User #2: Regular KTV**
- Role: Mid-level KTV
- Why: Representative of typical user
- Device: Android preferred

**Pilot User #3: New KTV (optional)**
- Role: Recently joined
- Why: Fresh perspective, typical new user experience
- Device: Either iPhone or Android

---

## 📋 PRE-PILOT PREPARATION

### Step 1: Get Device Information (1 day before)

**Contact each pilot user and ask:**

```
Xin chào [Name],

Chúng tôi đang triển khai ứng dụng mobile mới cho KTV và muốn mời bạn 
tham gia pilot test trong 2-3 ngày tới.

Để chuẩn bị, vui lòng cho biết:

1. Loại điện thoại: iPhone / Samsung / Other?
2. Phiên bản: iOS mấy? / Android mấy?
3. Số điện thoại đăng ký: +84...

Cảm ơn bạn!
```

**Document responses in table:**

| Name | Role | Phone | Device | OS Version |
|------|------|-------|--------|-----------|
| [KTV 1] | KTV Lead | +84... | iPhone 13 | iOS 16.5 |
| [KTV 2] | KTV | +84... | Samsung S21 | Android 12 |
| [KTV 3] | KTV | +84... | iPhone 12 | iOS 15.7 |

---

### Step 2: Prepare Production Environment

**Verify checklist:**
- [ ] RPC migrations deployed to production
- [ ] Functions verified working (run test queries)
- [ ] No production errors in last 24 hours
- [ ] Monitoring enabled (Sentry if available)

**Test with your own account:**
- [ ] Login to production app works
- [ ] Dashboard loads data
- [ ] Pull-to-refresh works
- [ ] No console errors

---

### Step 3: Create Pilot Build

**Option A: Expo Go (Fastest)**
```bash
# Development build
npm run mobile:dev
# Share QR code with pilot users
```

**Option B: Internal TestFlight (iOS)**
```bash
# Build for TestFlight
eas build --platform ios --profile preview
eas submit --platform ios --profile preview

# Invite pilot users via TestFlight
```

**Option C: Internal Testing (Android)**
```bash
# Build for Google Play
eas build --platform android --profile preview
eas submit --platform android --profile preview

# Invite pilot users via Google Play Console
```

**Recommended:** Start with Expo Go for fastest iteration

---

### Step 4: Prepare Support Materials

**Create:**

1. **Installation Instructions** (see section below)
2. **Quick Start Guide** (see section below)
3. **Feedback Form** (Google Form or simple doc)
4. **Support Contact** (Telegram group or Zalo)

---

## 📱 PILOT USER INSTRUCTIONS

### Installation Instructions (Send to Pilot Users)

```markdown
# Cách Cài Đặt Bella ERP Mobile (Pilot)

## Bước 1: Cài đặt Expo Go

**iPhone:**
1. Mở App Store
2. Tìm "Expo Go"
3. Nhấn "Tải"

**Android:**
1. Mở Google Play Store
2. Tìm "Expo Go"
3. Nhấn "Cài đặt"

---

## Bước 2: Mở Ứng Dụng Bella ERP

**Cách 1: Quét QR Code**
- iPhone: Mở Camera → Quét mã QR
- Android: Mở Expo Go → Scan QR code

[Đính kèm ảnh QR code]

**Cách 2: Nhập URL**
- Mở Expo Go
- Nhập: exp://[your-url]

---

## Bước 3: Đăng Nhập

1. Nhập số điện thoại: +84...
2. Nhấn "Gửi mã OTP"
3. Nhập mã 6 số từ SMS
4. Nhấn "Xác nhận"

---

## Nếu Gặp Vấn Đề

Liên hệ:
- Telegram: @[your-handle]
- Zalo: [phone-number]
- Hoặc nhắn tin trong group
```

---

### Quick Start Guide (Send After Login)

```markdown
# Hướng Dẫn Sử Dụng Nhanh

## Dashboard (Màn Hình Chính)

**Thống kê hôm nay:**
- 📋 Tổng ca: Tổng số ca được giao
- ✅ Hoàn thành: Số ca đã hoàn thành
- ⏰ Còn lại: Số ca chưa làm

**Lịch của tôi hôm nay:**
- Danh sách các ca được giao cho bạn
- Bao gồm: tên khách, tên bé, gói dịch vụ

---

## Làm Mới Dữ Liệu

- Kéo màn hình xuống → Thả ra
- Dữ liệu sẽ cập nhật tự động

---

## Điều Quan Trọng

❗ **Số liệu bạn thấy là THỰC**
- Tổng ca = chỉ ca của BẠN (không phải tất cả KTV)
- Nếu thấy số liệu sai → BÁO NGAY

---

## Cần Trợ Giúp?

Nhắn tin trong group hoặc liên hệ trực tiếp
```

---

## 📊 PILOT MONITORING PLAN

### Daily Check-ins (2-3 days)

**Day 1 - Morning (9 AM):**
- [ ] Send installation instructions to all pilot users
- [ ] Create Telegram/Zalo support group
- [ ] Verify all users received message

**Day 1 - Afternoon (2 PM):**
- [ ] Check: How many users installed app?
- [ ] Check: Any installation issues?
- [ ] Provide 1-on-1 support if needed

**Day 1 - Evening (6 PM):**
- [ ] Check: How many users logged in successfully?
- [ ] Check: Any login issues?
- [ ] Quick feedback: "App hoạt động ổn không?"

---

**Day 2 - Morning (9 AM):**
- [ ] Check app usage logs (who opened, when)
- [ ] Check for errors in production logs
- [ ] Send reminder: "Hôm nay thử dùng app xem stats nhé"

**Day 2 - Afternoon (3 PM):**
- [ ] Reach out individually: "App thấy số liệu đúng không?"
- [ ] Ask: "Số ca hôm nay app hiện bao nhiêu? Đúng không?"
- [ ] Document responses

**Day 2 - Evening (6 PM):**
- [ ] Collect initial feedback
- [ ] Address any bugs found
- [ ] Plan fixes if needed

---

**Day 3 - Morning (9 AM):**
- [ ] Final check: Any outstanding issues?
- [ ] Verify KTV stats are accurate (compare with web dashboard)

**Day 3 - Afternoon (3 PM):**
- [ ] Send feedback form to all users
- [ ] Schedule individual calls if needed

**Day 3 - Evening (6 PM):**
- [ ] Compile all feedback
- [ ] Create summary report
- [ ] Decide: Proceed to Week 4 or fix issues first?

---

### Monitoring Checklist (Each Day)

**Technical Monitoring:**
- [ ] Check Supabase logs for errors
- [ ] Check RPC call counts (should see activity)
- [ ] Check error rate (<1% is acceptable)
- [ ] Check average response time (<200ms)

**User Monitoring:**
- [ ] How many users opened app today?
- [ ] How many users logged in?
- [ ] How many pull-to-refresh actions?
- [ ] Any crashes reported?

**Data Accuracy:**
- [ ] Compare KTV stats (app vs web dashboard)
- [ ] Verify session counts are correct
- [ ] Check for "seeing all spa sessions" bug

---

## 💬 FEEDBACK COLLECTION

### In-App Feedback Questions

**Daily Quick Check (via Telegram/Zalo):**
1. "App mở được không? Có bị lỗi gì không?"
2. "Số liệu hiện đúng không? Số ca hôm nay bao nhiêu?"
3. "Có điều gì khó hiểu không?"

---

### End-of-Pilot Survey

**Create Google Form with these questions:**

**Section 1: Installation & Login**
1. Cài đặt app dễ hay khó? (1-5 stars)
2. Đăng nhập có gặp vấn đề gì không?
3. Thời gian đăng nhập: Nhanh / Chậm / Rất chậm

**Section 2: Dashboard & Data**
4. Dashboard dễ hiểu không? (1-5 stars)
5. Số liệu hiển thị đúng không? (Yes / No / Not sure)
6. Nếu số liệu SAI, bạn thấy số nào sai?

**Section 3: User Experience**
7. App sử dụng có mượt không? (1-5 stars)
8. Có điều gì khó hiểu hoặc khó sử dụng không?
9. Bạn có muốn tiếp tục dùng app không? (Yes / No / Maybe)

**Section 4: Open Feedback**
10. Điểm mạnh của app (gì bạn thích)?
11. Điểm yếu của app (gì cần cải thiện)?
12. Tính năng nào bạn mong muốn nhất?

---

### Individual Interviews (Optional)

**If time permits, schedule 15-min calls:**

**Questions to ask:**
1. "Kể cho tôi nghe trải nghiệm sử dụng app trong 3 ngày qua"
2. "Có lúc nào bạn thấy app không hoạt động đúng không?"
3. "So với xem trên web, app có thuận tiện hơn không?"
4. "Nếu thêm QR check-in, bạn có dùng không?"
5. "Bạn có giới thiệu app cho KTV khác không?"

---

## 🐛 ISSUE TRIAGE DURING PILOT

### Critical Issues (Fix Immediately)

**If ANY pilot user reports:**
- ❌ App crashes on launch
- ❌ Can't login
- ❌ Dashboard blank/won't load
- ❌ KTV sees all spa sessions (not just theirs)
- ❌ Numbers completely wrong

**Action:**
1. Reproduce issue immediately
2. Create hotfix branch
3. Fix and deploy within 2-4 hours
4. Re-test with pilot user
5. Continue pilot

---

### High Priority Issues (Fix Before Week 4)

**If pilot users report:**
- ⚠️ Slow loading (>5 seconds)
- ⚠️ Realtime doesn't work
- ⚠️ Offline mode crashes
- ⚠️ UI is confusing
- ⚠️ Numbers sometimes wrong

**Action:**
1. Document issue clearly
2. Plan fix for after pilot
3. Fix before starting Week 4
4. Inform pilot users of timeline

---

### Low Priority Issues (Defer)

**If pilot users report:**
- 🟢 Minor UI issues (text alignment, colors)
- 🟢 Feature requests
- 🟢 Nice-to-have improvements

**Action:**
1. Document for future
2. Add to backlog
3. Don't block Week 4

---

## ✅ PILOT COMPLETION CRITERIA

**Pilot is SUCCESSFUL when:**

### Must Have (All ✅)
- [x] All pilot users installed and logged in
- [x] No critical bugs found
- [x] KTV stats are accurate (verified)
- [x] At least 2/3 users give positive feedback
- [x] No data accuracy issues reported

### Should Have
- [x] Realtime works for all users
- [x] App performance is acceptable
- [x] Users understand how to use app
- [x] Users want to continue using app

### Decision
- [ ] ✅ **PROCEED to Week 4** - Pilot successful
- [ ] 🔴 **FIX ISSUES FIRST** - Pilot found blockers
- [ ] 🔄 **EXTEND PILOT** - Need more time/users

---

## 📝 PILOT COMPLETION REPORT TEMPLATE

```markdown
# Production Pilot Completion Report

**Dates:** [Start] to [End]
**Participants:** [X] users

## Summary
[Brief 2-3 sentence summary of pilot outcome]

## Participation
- Invited: [X] users
- Installed: [X] users ([X]%)
- Logged in: [X] users ([X]%)
- Completed survey: [X] users ([X]%)

## Critical Metrics
- KTV stats accuracy: ✅ Correct / ❌ Issues found
- Crashes reported: [X]
- Login success rate: [X]%
- Average user rating: [X]/5

## Key Findings

### Positive Feedback
1. [Feedback point 1]
2. [Feedback point 2]

### Issues Found
1. [Issue 1] - Severity: Critical/High/Low
2. [Issue 2] - Severity: Critical/High/Low

### User Quotes
> "[Quote from pilot user 1]"

> "[Quote from pilot user 2]"

## Technical Observations
- Error rate: [X]%
- Average load time: [X]s
- RPC calls: [X] total
- Realtime events: [X] delivered

## Recommendations
1. [Recommendation 1]
2. [Recommendation 2]

## Decision
✅ Approved for Week 4 / 🔴 Must fix issues first

**Signed:**
- Pilot Coordinator: _________ Date: _____
- Product Manager: _________ Date: _____
```

---

## 🎉 POST-PILOT ACTIONS

### If Pilot is Successful

1. **Thank pilot users**
   ```
   Cảm ơn [Name] đã tham gia pilot test!
   
   App sẽ được cải thiện dựa trên feedback của bạn.
   Trong thời gian tới, bạn sẽ thấy thêm nhiều tính năng mới.
   
   Cảm ơn!
   ```

2. **Document lessons learned**
   - Update AGENTS.md with pilot insights
   - Create PILOT_LESSONS_LEARNED.md

3. **Plan Week 4 rollout**
   - Gradually expand to more users
   - Start Week 4 feature development (QR Check-in)

---

### If Issues Found

1. **Categorize all issues**
   - Critical → Fix immediately
   - High → Fix before Week 4
   - Low → Add to backlog

2. **Create fix plan**
   - Timeline for each issue
   - Responsible person
   - Re-test plan

3. **Consider extended pilot**
   - Fix issues
   - Deploy fixes
   - Re-pilot for 1-2 more days

---

## 📞 SUPPORT CONTACTS

**During Pilot:**
- Primary Contact: [Name] - [Phone/Telegram]
- Technical Lead: [Name] - [Phone/Telegram]
- On-call (emergencies): [Name] - [Phone]

**Escalation Path:**
1. Pilot user reports issue
2. Primary contact triages
3. If critical → Technical lead notified immediately
4. If blocker → Product manager notified

---

## 🎯 SUCCESS METRICS

**Pilot is successful if:**
- Installation rate: >80%
- Login success rate: >95%
- KTV stats accuracy: 100%
- User satisfaction: >4/5 stars
- Would recommend: >70%
- Critical bugs: 0
- High-priority bugs: <3

**Current Status:** [Update after pilot]

---

**Document Owner:** Mobile Product Team  
**Version:** 1.0  
**Last Updated:** 2026-06-22  
**Status:** Ready for use
