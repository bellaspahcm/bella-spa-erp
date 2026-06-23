# 📱 BELLA SPA MOBILE - RELEASE NOTES (PILOT)

**Version**: v0.1.0-pilot  
**Release Date**: TBD  
**Build Type**: Internal Pilot (Not Production)  
**Target Audience**: 2-3 KTVs + Admin + Owner (Single Location)

---

## 🎯 WHAT IS THIS VERSION?

This is the **first pilot version** of Bella Spa Mobile App. It is designed for **internal testing** with a small group of users to validate:
- ✅ Core functionality (login, view schedule, view stats)
- ✅ Data accuracy (correct sessions, correct KTV assignments)
- ✅ App stability (no crashes, fast performance)
- ✅ User experience (easy to understand, helpful for daily work)

**This is NOT a complete app.** Many features are intentionally excluded to focus on testing the foundation first.

---

## ✅ WHAT'S INCLUDED (Available Now)

### 🔐 1. Authentication & Security
- ✅ **Login with email and password**
  - Secure authentication via Supabase Auth
  - Session management (stay logged in across app restarts)
- ✅ **Role-based access control**
  - KTVs see only their assigned sessions
  - Admins see all spa sessions
- ✅ **Tenant isolation**
  - Each spa's data is completely separated
  - No cross-spa data leakage

**What you can do**:
- Login with your provided credentials
- Stay logged in for days/weeks
- Logout when needed

**Limitations**:
- ❌ No "Forgot Password" self-service (contact admin to reset)
- ❌ No biometric login (Face ID, Fingerprint)
- ❌ No multi-factor authentication (MFA)

---

### 🏠 2. Dashboard (Home Screen)
- ✅ **Today's Sessions List**
  - See all your assigned sessions for today
  - Display: Customer name, Baby name, Package name, Time slot
  - Color-coded status: Green (in progress), Orange (pending), Blue (scheduled)
  - Shows session progress: "3/10 ca" (completed/total)
  
- ✅ **Daily Statistics**
  - Tổng ca: Total sessions assigned today
  - Hoàn thành: Completed sessions
  - Còn lại: Remaining sessions
  - Updates in real-time as work progresses

- ✅ **Pull-to-Refresh**
  - Drag down from top to reload latest data
  - Syncs with web system (updates within 30 seconds)

**What you can do**:
- Check your schedule at start of shift
- See which sessions you need to complete
- Monitor your progress throughout the day
- Refresh to see latest updates

**Limitations**:
- ❌ Only shows TODAY (no past or future days)
- ❌ Cannot filter or search sessions
- ❌ Cannot edit session details
- ❌ No notifications when sessions change

---

### 👤 3. Profile Screen
- ✅ **View Personal Information**
  - Email address
  - Full name
  - Role (Admin, KTV, etc.)
  - Branch/Spa name
  
- ✅ **Logout**
  - Clean logout with confirmation
  - Returns to login screen

**What you can do**:
- Check your account details
- Verify you're using the correct account
- Logout when needed

**Limitations**:
- ❌ Cannot edit profile (name, email)
- ❌ Cannot change password in-app
- ❌ No profile photo
- ❌ No settings or preferences

---

### 🔄 4. Data Synchronization
- ✅ **Real-time sync with web system**
  - Data updates within 30 seconds
  - Pull-to-refresh fetches latest data
  
- ✅ **Offline detection**
  - Shows clear error when no Internet
  - Prompts to check WiFi/4G connection
  
- ✅ **Error recovery**
  - Retry button when operations fail
  - Graceful degradation (no crashes)

**What you can do**:
- Use app on WiFi or 4G/5G (anywhere with Internet)
  - **NOT** limited to spa WiFi
- Refresh to get latest schedule changes
- See error messages if connection lost

**Limitations**:
- ❌ No offline mode (requires Internet to work)
- ❌ No background sync (must open app to refresh)
- ❌ No push notifications for updates

---

## ❌ WHAT'S NOT INCLUDED (Coming in Future Weeks)

### 🚧 Week 4: QR Check-in/Check-out + GPS
**Status**: In Development  
**Expected**: Week 4

- ❌ QR code scanning to start session
- ❌ GPS verification (confirm you're at spa)
- ❌ Automatic session status updates (pending → in progress → completed)
- ❌ Check-in/check-out timestamps
- ❌ Check-in/check-out history

**Why not now?**:
- Foundation (login, data display) must be solid first
- QR + GPS require additional permissions and hardware testing
- Check-in logic requires business rule validation

**Current workaround**:
- Admin updates session status on web system
- KTVs view updated status in mobile app after refresh

---

### 🚧 Week 5: Full Calendar & Schedule Management
**Status**: Planned  
**Expected**: Week 5

- ❌ View schedule by week/month (calendar view)
- ❌ Filter sessions by status (pending, in progress, completed)
- ❌ Search sessions by customer name
- ❌ View past sessions (yesterday, last week, last month)
- ❌ View future sessions (tomorrow, next week)
- ❌ Session details page (full booking information)

**Why not now?**:
- Today-only view is sufficient for pilot testing
- Calendar UI requires more design and testing
- Filtering/search add complexity without immediate value

**Current workaround**:
- Check full schedule on web system
- Mobile app for quick daily schedule checks only

---

### 🚧 Week 6: Salary & Income Tracking
**Status**: Planned  
**Expected**: Week 6

- ❌ View monthly salary breakdown
- ❌ Session commissions detail
- ❌ KPI bonus tracking
- ❌ Deductions and adjustments
- ❌ Salary history (past months)
- ❌ Export salary reports

**Why not now?**:
- Salary calculation logic needs thorough testing
- Requires integration with accounting/payroll system
- Not critical for daily work (nice-to-have for KTVs)

**Current workaround**:
- Check salary on web system
- Ask admin for salary questions

---

### 🚧 Week 7+: Advanced Features
**Status**: Future Roadmap  
**Expected**: After Week 6

- ❌ Push notifications (session reminders, updates)
- ❌ Camera integration (take photos of work)
- ❌ Leave request submission
- ❌ Shift scheduling
- ❌ Customer notes/feedback
- ❌ Performance reports
- ❌ Chat/messaging with admin
- ❌ Dark mode
- ❌ Language selection (Vietnamese/English)

---

## ⚠️ KNOWN LIMITATIONS & ISSUES

### Technical Limitations

**1. Network Dependency**
- ⚠️ App requires Internet connection to work
- ⚠️ No cached data for offline viewing
- ⚠️ Slow network = slow app performance

**2. Real Device Testing**
- ⚠️ Tested on emulators primarily
- ⚠️ Real iPhone and Android testing ongoing
- ⚠️ May have device-specific issues

**3. Performance**
- ⚠️ First load may be slow (5-10 seconds)
- ⚠️ Dashboard load target: <3 seconds (may vary by network)
- ⚠️ No performance optimization yet applied

### Usability Limitations

**1. Minimal Error Messages**
- ⚠️ Some errors show generic messages
- ⚠️ May not explain exactly what went wrong
- ⚠️ Improving error messages in future versions

**2. No Onboarding Tutorial**
- ⚠️ Assumes users read documentation
- ⚠️ No in-app guided tour
- ⚠️ May require admin to explain features

**3. Limited Help/Support**
- ⚠️ No in-app help center
- ⚠️ No FAQ section
- ⚠️ Must contact admin or tech support for issues

---

## 🐛 HOW TO REPORT BUGS

If you encounter issues, please report them to:

**📧 Tech Support**:
- Email: support@bellaspa.vn
- Phone: _____________

**Include in your report**:
1. **What you were trying to do**: "I tried to login..."
2. **What happened**: "The app showed a blank screen..."
3. **What you expected**: "I should see the dashboard..."
4. **Screenshot** (if possible): Take photo of screen
5. **When it happened**: Date and time
6. **How often**: "Happens every time" or "Happened once"

**Bug Severity Guide**:
- 🔴 **Critical**: Cannot use app (crashes, blank screen, wrong data)
- 🟠 **High**: Feature doesn't work (login fails, refresh fails)
- 🟡 **Medium**: Slow or confusing (takes >5s, unclear message)
- 🟢 **Low**: Minor issue (typo, small UI glitch)

---

## 💡 TIPS FOR PILOT USERS

### Getting the Most Out of This Version

**DO**:
- ✅ Check your schedule every morning when you arrive at spa
- ✅ Pull-to-refresh before each session to see latest updates
- ✅ Report bugs immediately (don't wait until end of day)
- ✅ Compare app data with web system daily to verify accuracy
- ✅ Share honest feedback (good and bad)

**DON'T**:
- ❌ Rely 100% on the app (still check paper schedule as backup)
- ❌ Use the app while driving or walking
- ❌ Share your login credentials with others
- ❌ Try to "hack" or test features that aren't there
- ❌ Assume "works for me" = "works for everyone"

---

## 📊 WHAT WE'RE MEASURING DURING PILOT

Your usage helps us track:
- **Login success rate**: Are you able to login easily?
- **Performance**: How fast does the app load?
- **Stability**: Are there any crashes?
- **Data accuracy**: Do you see the correct sessions?
- **Usability**: Is the app easy to understand?

We're looking for **85%+ success rate** across all metrics to proceed to next phase.

---

## 🗓️ PILOT TIMELINE

| Phase | Duration | Focus |
|-------|----------|-------|
| **Week 1-3** | Complete | Foundation (login, data display, docs) |
| **Device Testing** | 1-2 days | Test on real iPhone + Android |
| **Pilot Launch** | Day 1 | Install, login, first impressions |
| **Pilot Testing** | Day 2-6 | Daily usage, bug reports, feedback |
| **Pilot Review** | Day 7 | Evaluate success, Go/No-Go decision |
| **Week 4** | TBD | QR Check-in + GPS (if pilot passes) |

---

## 🎯 YOUR ROLE AS PILOT USER

You are not just a "tester" - you are a **product co-creator**. Your feedback will shape the final app that all KTVs will use.

**What we need from you**:
1. **Use the app daily** (even if it seems simple)
2. **Report issues immediately** (don't wait)
3. **Be honest in feedback** (we want to know what's wrong)
4. **Suggest improvements** (what would make it better?)
5. **Be patient** (this is v0.1, not v1.0)

**What you'll get**:
- ✅ Early access to new features
- ✅ Your suggestions implemented
- ✅ Recognition as pilot program participant
- ✅ Better tool for your daily work

---

## 🚀 ROADMAP AFTER PILOT

If pilot is successful (passes all success criteria):

### Immediate Next Steps (Week 4)
- 🚀 Scale to 10-15 KTVs (Phase 2 pilot)
- 🚀 Add QR Check-in/Check-out
- 🚀 Add GPS verification
- 🚀 Deploy audit logging for monitoring

### Short Term (Week 5-6)
- 🚀 Full calendar view (week/month)
- 🚀 Salary tracking
- 🚀 Push notifications
- 🚀 Performance optimization

### Long Term (Week 7+)
- 🚀 Camera integration
- 🚀 Leave requests
- 🚀 Customer feedback
- 🚀 Advanced reporting
- 🚀 iOS App Store & Google Play release

---

## 📞 SUPPORT & FEEDBACK

### During Pilot
- **Daily check-ins**: Admin will ask about your experience
- **Mid-pilot survey**: Day 3-4 feedback collection
- **Final survey**: Day 7 comprehensive review

### After Pilot
- **Pilot report**: We'll share results with all participants
- **Feature voting**: You'll help prioritize what to build next
- **Continued involvement**: Option to join future testing

---

## ✅ CHANGELOG (This Version)

### v0.1.0-pilot (2026-06-22)
**Added**:
- ✅ Login with email/password
- ✅ Dashboard with today's sessions
- ✅ Daily statistics (Tổng ca, Hoàn thành, Còn lại)
- ✅ Pull-to-refresh
- ✅ Profile screen
- ✅ Logout functionality
- ✅ Role-based access (KTV vs Admin)
- ✅ Error handling and retry
- ✅ Offline detection

**Not Included** (See "What's Not Included" section):
- ❌ QR Check-in/Check-out
- ❌ GPS verification
- ❌ Calendar view
- ❌ Salary tracking
- ❌ Push notifications
- ❌ Advanced features

**Known Issues**:
- ⚠️ First load may be slow (5-10s)
- ⚠️ Limited error message details
- ⚠️ No offline mode
- ⚠️ Minimal real device testing completed

---

## 🙏 THANK YOU

Thank you for being part of this pilot program! Your participation is critical to building a tool that truly helps KTVs do their best work.

**Questions?** Contact your admin or tech support.

**Feedback?** We want to hear it - good, bad, and everything in between.

**Let's build something great together!** 🌸

---

*RELEASE_NOTES_PILOT.md*  
*Version 0.1.0-pilot*  
*Created: 2026-06-22*  
*Updated: TBD (after pilot feedback)*

---

## 📚 RELATED DOCUMENTS

For pilot users:
- `HUONG_DAN_CAI_DAT_CHO_KTV.md` - Installation guide
- `THE_THAM_KHAO_NHANH_KTV.md` - Quick reference card
- `PILOT_SUCCESS_CRITERIA.md` - What success looks like

For team:
- `PRODUCTION_PILOT_GUIDE.md` - How to run the pilot
- `DEVICE_TESTING_CHECKLIST.md` - Pre-pilot testing
- `RPC_PRODUCTION_REVIEW.md` - Technical readiness
