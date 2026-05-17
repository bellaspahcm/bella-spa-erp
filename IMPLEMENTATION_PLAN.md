# Bella Spa ERP - Roadmap & Implementation Plan (Post-Purge)

Status: 🟢 Standardization Complete | 🟡 Phase 1 Starting

## 🟢 Phase 0: The Great Purge (Completed)
- [x] Remove all RealEstate legacy tables and columns.
- [x] Normalize `bookings` and `customers` schemas.
- [x] Consolidate `employees` into role-based `users`.
- [x] Hardened data integrity with strict constraints.

## 🟢 Phase 1: Financial Automation & Deep Reporting (Completed)
### 17. Quản lý Kho & Vật tư (v2.1)
- **Cấu trúc**: `inventory_items`, `package_materials`, `inventory_logs`.
- **Tự động hóa**: Trigger `trigger_deduct_inventory_on_session_complete` tự động trừ kho dựa trên định mức gói dịch vụ.
- **Cảnh báo**: Tích hợp thông báo tồn kho thấp vào Dashboard Admin và RPC `get_important_alerts`.
- [x] **Profit & Loss (P&L) Engine**: Implement logic to calculate Net Profit by subtracting KTV Salary and operating Expenses from Revenue.
- [x] **Monthly Dashboard**: Create a high-level visual summary of P&L trends.
- [x] **Service ROI Analysis**: Track profitability per service package.
- [x] **Automated Monthly Closing**: Lock financial records at the end of each month to prevent retrospective changes.

## 🟢 Phase 2: KTV Mobile-First Experience (Completed)
- [x] **Quick Session Log**: Mobile-optimized interface for KTV check-in/out.
- [x] **Real-time Commission Dashboard**: Allow KTVs to see their earnings live.
- [x] Phase 1: Tài chính tự động
- [x] Phase 2: KTV Mobile Experience
- [x] Phase 3: Customer Portal & Loyalty
- [x] Phase 4: Quản lý Kho & Vật tư tiêu hao (Completed)
- [x] **KTV Leaderboard**: Performance-based gamification for staff.

## 🟢 Phase 3: Customer Portal & Loyalty (Completed)
- [x] **Treatment Progress Tracking**: QR-based portal for customers to see remaining sessions.
- [x] **Automated Rating System**: Post-session feedback triggers linked to KTV performance bonuses.
- [x] **Loyalty Points**: Reward system for repeat bookings and referrals.

## 🟢 Phase 4: Inventory & Supply Chain (Completed)
- [x] **Material Consumption Logic**: Auto-deduct supplies (oils, towels, etc.) upon session completion.
- [x] **Low Stock Alerts**: Automated notifications for reordering.

## ⚪ Phase 5: CRM & Zalo Integration
- [ ] **Automated Reminders**: Appointment alerts 2 hours before session.
- [ ] **Marketing Automation**: Birthday greetings and targeted voucher campaigns.

## 🟢 Phase 6: Messaging Center & Communication (Completed)
- [x] **Internal & Customer Chat**: Built and stabilized the real-time chat module for administrative coordination.
- [x] **Customer Portal UI/UX**: Enhanced the customer treatment tracking portal with improved styling and official social media integrations.
- [x] **Client-side Fetching Optimization**: Refactored real-time connections to bypass server-action bottlenecks.
