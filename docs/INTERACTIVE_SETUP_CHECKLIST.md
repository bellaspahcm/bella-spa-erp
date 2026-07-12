# Interactive Setup Checklist - Decision Engine Monitoring

**Mục đích**: Hướng dẫn chi tiết từng bước để setup PagerDuty và Slack  
**Thời gian**: ~50 phút (PagerDuty 30 phút + Slack 20 phút)  
**Ngày thực hiện**: ____________  
**Người thực hiện**: ____________  

---

## 📋 CHUẨN BỊ

### Tài khoản cần có:
- [ ] Tài khoản PagerDuty (hoặc tạo trial tại: https://pagerduty.com)
- [ ] Tài khoản Slack workspace admin
- [ ] GitHub repo access với quyền thêm secrets
- [ ] Vercel project access (optional)

### Thông tin cần thu thập:
```
PagerDuty Integration Key: ________________________________
Slack Webhook URL:         ________________________________
GitHub Username:           ________________________________
```

---

## PHẦN 1: SETUP PAGERDUTY (30 phút)

### Bước 1: Tạo PagerDuty Service ⏱️ 5 phút

**1.1** Đăng nhập PagerDuty: https://app.pagerduty.com/

**1.2** Đi tới: `Services` → `Service Directory`

**1.3** Click `+ New Service`

**1.4** Điền thông tin:
```
Service Name: Decision Engine
Description:  Critical alerts for Decision Engine Platform
```

**1.5** Chọn `Events API V2` integration

**1.6** Escalation Policy: (chọn existing hoặc tạo mới ở Bước 2)

**1.7** Click `Create Service`

✅ **Checkpoint**: Service "Decision Engine" xuất hiện trong danh sách

---

### Bước 2: Tạo Escalation Policy ⏱️ 10 phút

**2.1** Đi tới: `People` → `Escalation Policies`

**2.2** Click `+ New Escalation Policy`

**2.3** Điền thông tin:
```
Name: Engineering On-Call
Description: Escalation for Decision Engine alerts
```

**2.4** Cấu hình Level 1:
```
Notify: [Chọn user hoặc schedule]
After: 0 minutes (ngay lập tức)
```

**2.5** (Optional) Thêm Level 2:
```
Notify: [Chọn manager]
After: 15 minutes (nếu Level 1 không acknowledge)
```

**2.6** Click `Save`

✅ **Checkpoint**: Escalation policy "Engineering On-Call" đã tạo

---

### Bước 3: Copy Integration Key ⏱️ 2 phút

**3.1** Quay lại: `Services` → `Decision Engine`

**3.2** Tab `Integrations`

**3.3** Tìm `Events API V2` integration

**3.4** Copy `Integration Key` (32 ký tự)
```
Integration Key: ________________________________
```

⚠️ **LƯU Ý**: Lưu key này vào password manager, bạn sẽ cần nó cho bước tiếp theo

✅ **Checkpoint**: Integration Key đã copy

---

### Bước 4: Add GitHub Secret ⏱️ 3 phút

**4.1** Mở GitHub repo: https://github.com/bellaspahcm/bella-spa-erp

**4.2** Đi tới: `Settings` → `Secrets and variables` → `Actions`

**4.3** Click `New repository secret`

**4.4** Điền:
```
Name:  PAGERDUTY_INTEGRATION_KEY
Value: [paste integration key từ Bước 3]
```

**4.5** Click `Add secret`

✅ **Checkpoint**: Secret "PAGERDUTY_INTEGRATION_KEY" xuất hiện trong danh sách

---

### Bước 5: Test Alert ⏱️ 5 phút

**5.1** Mở terminal/PowerShell

**5.2** Đi tới project directory:
```bash
cd "D:\Antigravity\Projects\BELLA SPA ERP"
```

**5.3** Chạy test script:
```bash
# Windows (PowerShell)
$env:PAGERDUTY_INTEGRATION_KEY="your-key-here"
bash scripts/test-pagerduty-alert.sh

# Hoặc dùng Git Bash
PAGERDUTY_INTEGRATION_KEY=your-key-here ./scripts/test-pagerduty-alert.sh
```

**5.4** Kiểm tra output:
```
Expected:
📤 Sending test alert to PagerDuty...
Response: {"status":"success"...}
✅ Test alert sent successfully!
```

✅ **Checkpoint**: Script báo success

---

### Bước 6: Verify Incident ⏱️ 5 phút

**6.1** Quay lại PagerDuty dashboard: https://app.pagerduty.com/incidents

**6.2** Kiểm tra incident mới:
```
Title:  [TEST] Decision Engine Alert Test
Status: Triggered (màu đỏ)
Service: Decision Engine
```

**6.3** Kiểm tra notification:
- [ ] Nhận email notification
- [ ] (Optional) Nhận SMS notification
- [ ] (Optional) Nhận push notification (PagerDuty app)

**6.4** Click incident → Click `Acknowledge`

**6.5** Verify status chuyển sang `Acknowledged` (màu cam)

**6.6** Click `Resolve`

**6.7** Verify status chuyển sang `Resolved` (màu xanh)

✅ **Checkpoint**: Incident lifecycle hoàn chỉnh (Trigger → Acknowledge → Resolve)

---

### ✅ PAGERDUTY SETUP COMPLETE!

**Tổng thời gian**: ______ phút

**Checklist hoàn thành**:
- [x] Service created
- [x] Escalation policy configured
- [x] Integration key copied
- [x] GitHub secret added
- [x] Test alert sent
- [x] Incident created & resolved
- [x] Notifications working

**Ghi chú vấn đề (nếu có)**:
```
___________________________________________________________
___________________________________________________________
```

---

## PHẦN 2: SETUP SLACK (20 phút)

### Bước 1: Tạo Slack App ⏱️ 5 phút

**1.1** Đi tới: https://api.slack.com/apps

**1.2** Click `Create New App`

**1.3** Chọn `From scratch`

**1.4** Điền thông tin:
```
App Name: Decision Engine Alerts
Workspace: [Chọn workspace của bạn]
```

**1.5** Click `Create App`

✅ **Checkpoint**: App "Decision Engine Alerts" đã tạo

---

### Bước 2: Activate Incoming Webhooks ⏱️ 3 phút

**2.1** Trong app settings, đi tới: `Features` → `Incoming Webhooks`

**2.2** Toggle `Activate Incoming Webhooks`: **ON**

**2.3** Scroll xuống → Click `Add New Webhook to Workspace`

**2.4** Chọn channel:
```
Option 1: #alerts (tạo mới nếu chưa có)
Option 2: #decision-engine-test (cho testing)
```

**2.5** Click `Allow`

**2.6** Copy `Webhook URL`:
```
Webhook URL: ________________________________
```

⚠️ **LƯU Ý**: URL dài ~100 ký tự, bắt đầu bằng `https://hooks.slack.com/services/`

✅ **Checkpoint**: Webhook URL đã copy

---

### Bước 3: Add GitHub Secret ⏱️ 2 phút

**3.1** Quay lại GitHub: https://github.com/bellaspahcm/bella-spa-erp/settings/secrets/actions

**3.2** Click `New repository secret`

**3.3** Điền:
```
Name:  SLACK_WEBHOOK_URL
Value: [paste webhook URL từ Bước 2]
```

**3.4** Click `Add secret`

✅ **Checkpoint**: Secret "SLACK_WEBHOOK_URL" xuất hiện trong danh sách

---

### Bước 4: Create Alert Channels ⏱️ 3 phút

**4.1** Mở Slack workspace

**4.2** Tạo channel `#alerts`:
```
Click + next to Channels
Name: alerts
Description: Critical warnings from Decision Engine
Privacy: Public
```

**4.3** (Optional) Tạo channel `#decision-engine`:
```
Name: decision-engine
Description: Decision Engine activity feed
Privacy: Public
```

**4.4** Invite team members:
```
/invite @backend-team @devops-team
```

**4.5** Set channel topic:
```
/topic Decision Engine Alerts | Runbook: https://docs.bella-spa.com/runbook
```

✅ **Checkpoint**: Channels created và team invited

---

### Bước 5: Test Alert ⏱️ 5 phút

**5.1** Mở terminal/PowerShell

**5.2** Đi tới project directory:
```bash
cd "D:\Antigravity\Projects\BELLA SPA ERP"
```

**5.3** Chạy test script:
```bash
# Windows (PowerShell)
$env:SLACK_WEBHOOK_URL="your-webhook-url"
bash scripts/test-slack-alert.sh

# Hoặc dùng Git Bash
SLACK_WEBHOOK_URL=your-webhook-url ./scripts/test-slack-alert.sh
```

**5.4** Kiểm tra output:
```
Expected:
📤 Sending test alert to Slack...
✅ Test alert sent successfully!
Check #alerts channel in Slack
```

✅ **Checkpoint**: Script báo success

---

### Bước 6: Verify Message ⏱️ 2 phút

**6.1** Mở Slack → Đi tới channel đã chọn (vd: `#alerts`)

**6.2** Kiểm tra message mới:
```
Expected:
🧪 Decision Engine Alert Test
━━━━━━━━━━━━━━━━━━━━━━━
This is a test alert to verify Slack integration.

Status: All systems operational
Environment: Test
...
[View Runbook] [Dashboard] (buttons)
```

**6.3** Click buttons:
- [ ] `View Runbook` button hoạt động
- [ ] `Dashboard` button hoạt động

**6.4** Kiểm tra formatting:
- [ ] Header hiển thị đúng
- [ ] Fields hiển thị đúng
- [ ] Buttons hiển thị đúng
- [ ] Colors/emojis hiển thị đúng

✅ **Checkpoint**: Message hiển thị correct formatting

---

### ✅ SLACK SETUP COMPLETE!

**Tổng thời gian**: ______ phút

**Checklist hoàn thành**:
- [x] Slack app created
- [x] Incoming webhooks activated
- [x] Webhook URL copied
- [x] GitHub secret added
- [x] Alert channels created
- [x] Test alert sent
- [x] Message delivered correctly
- [x] Buttons/links working

**Ghi chú vấn đề (nếu có)**:
```
___________________________________________________________
___________________________________________________________
```

---

## PHẦN 3: VERIFY CI/CD INTEGRATION

### GitHub Actions Test ⏱️ 10 phút

**1** Tạo test branch:
```bash
git checkout -b test-ci-cd-alerts
```

**2** Tạo file nhỏ (trigger CI):
```bash
echo "# CI/CD Test" > test-ci.md
git add test-ci.md
git commit -m "Test: Verify CI/CD alerts integration"
git push origin test-ci-cd-alerts
```

**3** Tạo Pull Request trên GitHub

**4** Kiểm tra GitHub Actions:
- [ ] Workflow `Decision Engine Deploy` triggered
- [ ] Test job passed
- [ ] Deploy Staging job triggered

**5** Sau khi merge (optional):
- [ ] Deploy Production job triggered
- [ ] Slack notification received (check #alerts)

**6** Cleanup:
```bash
git checkout main
git branch -D test-ci-cd-alerts
```

✅ **Checkpoint**: CI/CD pipeline working with alerts

---

## 📊 FINAL VERIFICATION

### All Systems Check

- [ ] ✅ **PagerDuty**: Service active, test incident resolved
- [ ] ✅ **Slack**: Webhooks working, test message received
- [ ] ✅ **GitHub Secrets**: 2/7 secrets added (PAGERDUTY_INTEGRATION_KEY, SLACK_WEBHOOK_URL)
- [ ] ✅ **CI/CD**: GitHub Actions can send notifications
- [ ] ✅ **Documentation**: Setup guides accessible

### Remaining GitHub Secrets (Optional)

**For full CI/CD automation**, thêm các secrets còn lại:

```bash
# Vercel Deployment
VERCEL_TOKEN=___________________________
VERCEL_ORG_ID=_________________________
VERCEL_PROJECT_ID=_____________________

# Production
REDIS_URL=______________________________
SUPABASE_SERVICE_ROLE_KEY=_____________
PRODUCTION_URL=https://bella-spa.vercel.app
```

**Note**: Không bắt buộc cho monitoring, chỉ cần cho auto-deployment.

---

## 🎉 SETUP COMPLETE!

**Tổng thời gian thực tế**: ______ phút

**Status**:
- ✅ PagerDuty: READY
- ✅ Slack: READY
- ✅ GitHub Secrets: CONFIGURED
- ✅ CI/CD: VERIFIED

**Next Steps**:
1. [ ] Monitor alerts trong 24 giờ đầu
2. [ ] Điều chỉnh thresholds nếu cần
3. [ ] Thêm team members vào on-call rotation
4. [ ] Setup cron jobs (metrics collection, backups)
5. [ ] Deploy to production với monitoring enabled

---

## 📞 TROUBLESHOOTING

### PagerDuty Issues

**Problem**: Test alert không tạo incident

**Solutions**:
1. Verify integration key chính xác (32 characters)
2. Check service không bị disabled
3. Verify escalation policy có ít nhất 1 user
4. Check user notification rules đã cấu hình

### Slack Issues

**Problem**: Test message không xuất hiện

**Solutions**:
1. Verify webhook URL đầy đủ (starts with https://hooks.slack.com/services/)
2. Check app chưa bị remove khỏi channel
3. Try `/invite @Decision Engine Alerts` trong channel
4. Verify workspace permissions allow app posting

### GitHub Actions Issues

**Problem**: Workflow không trigger

**Solutions**:
1. Check file path: `.github/workflows/decision-engine-deploy.yml` exists
2. Verify YAML syntax valid
3. Check branch protection rules
4. Verify secrets exist and spelled correctly

---

**Người setup**: ____________  
**Ngày hoàn thành**: ____________  
**Signature**: ____________  

**Document Version**: 1.0.0  
**Last Updated**: 2026-07-12  
