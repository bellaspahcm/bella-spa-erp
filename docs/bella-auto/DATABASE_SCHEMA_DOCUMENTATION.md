# Bella Auto - Database Schema Documentation

**Version:** 1.0  
**Last Updated:** 2026-08-04  
**Module:** Bella Auto (Vehicle Management & Sales)  
**Database:** PostgreSQL 15+ (Supabase)

---

## Table of Contents

1. [Overview](#overview)
2. [Schema Architecture](#schema-architecture)
3. [Core Tables](#core-tables)
4. [Phase-by-Phase Breakdown](#phase-by-phase-breakdown)
5. [Relationships & Foreign Keys](#relationships--foreign-keys)
6. [Indexes & Performance](#indexes--performance)
7. [RLS Policies](#rls-policies)
8. [Migration History](#migration-history)

---

## Overview

Bella Auto schema consists of **30+ tables** organized into 15 phases:

- **Phase 0**: Foundation (Brands, Models, Variants)
- **Phase 1**: Vehicle Inventory (VIN Management)
- **Phase 2**: Customer Extensions
- **Phase 3**: Customer Journey Tracking
- **Phase 4**: Lead & Booking Management
- **Phase 5**: NPS & CSI (Customer Satisfaction)
- **Phase 6**: Workshop & Service Center
- **Phase 7**: Trade-In Center
- **Phase 8**: Finance Center
- **Phase 9**: AI Center (Recommendations)
- **Phase 10**: Mobile Workforce
- **Phase 11**: Business Rollback (Event Sourcing)
- **Phase 12**: Temporal History (Audit Trail)
- **Phase 13**: Rule Engine
- **Phase 14**: Marketplace Integration
- **Phase 15**: Rollup Analytics

**Key Design Principles:**
1. ✅ **Fully Additive** - No modifications to core Bella ERP tables
2. ✅ **Zero Regression** - All tables prefixed with `auto_`
3. ✅ **Tenant Isolation** - RLS enabled on all tables
4. ✅ **Audit Trail** - created_at, updated_at, created_by, updated_by
5. ✅ **Immutable History** - Service history & event logs are append-only

---

## Schema Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CORE BELLA ERP                          │
│   (tenants, users, customers, inventory, revenue, etc.)     │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ FK References (READ ONLY)
                          │
┌─────────────────────────────────────────────────────────────┐
│                    BELLA AUTO SCHEMA                        │
├─────────────────────────────────────────────────────────────┤
│  Phase 0: Foundation                                        │
│    • auto_brands (Thương hiệu xe)                          │
│    • auto_models (Dòng xe)                                 │
│    • auto_variants (Phiên bản)                             │
├─────────────────────────────────────────────────────────────┤
│  Phase 1: Vehicle Inventory                                 │
│    • auto_vehicles (Kho VIN)                               │
│    • auto_vehicle_status_logs (Lịch sử trạng thái)        │
├─────────────────────────────────────────────────────────────┤
│  Phase 4: Sales                                             │
│    • auto_leads (Cơ hội bán hàng)                          │
│    • auto_bookings (Hợp đồng đặt cọc)                      │
│    • auto_deposits (Lịch sử đặt cọc)                       │
├─────────────────────────────────────────────────────────────┤
│  Phase 6: Workshop & Service                                │
│    • auto_service_packages                                  │
│    • auto_service_appointments (Lịch hẹn bảo dưỡng)        │
│    • auto_repair_orders (Phiếu sửa chữa)                   │
│    • auto_repair_order_items (Chi tiết sửa chữa)          │
│    • auto_service_history (Lịch sử bảo dưỡng - IMMUTABLE) │
│    • auto_warranty_claims (Yêu cầu bảo hành)              │
│    • auto_technician_time_logs (Chấm công kỹ thuật viên)  │
├─────────────────────────────────────────────────────────────┤
│  Phase 7: Trade-In Center                                   │
│    • auto_trade_in_appraisals (Định giá xe cũ)            │
│    • auto_trade_in_photos (Hình ảnh định giá)             │
│    • auto_market_valuations (Giá thị trường)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Tables

### Phase 0: Foundation Tables

#### `auto_brands` - Thương hiệu xe

Stores vehicle brand information (Toyota, Honda, Mercedes, BMW, etc.)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `tenant_id` | UUID | NOT NULL, FK → tenants(id) | Tenant isolation |
| `name` | TEXT | NOT NULL | Brand name (e.g., "Toyota") |
| `country_of_origin` | TEXT | | Country (e.g., "Japan") |
| `is_active` | BOOLEAN | NOT NULL DEFAULT true | Active flag |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

**Constraints:**
- UNIQUE (tenant_id, name)

**Indexes:**
- `idx_auto_brands_tenant` ON (tenant_id)

---

#### `auto_models` - Dòng xe

Stores vehicle models (Camry, Civic, E-Class, etc.)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `tenant_id` | UUID | NOT NULL, FK → tenants(id) | Tenant isolation |
| `brand_id` | UUID | NOT NULL, FK → auto_brands(id) | Parent brand |
| `name` | TEXT | NOT NULL | Model name (e.g., "Camry") |
| `segment` | TEXT | | Sedan, SUV, Crossover, MPV, Hatchback |
| `is_active` | BOOLEAN | NOT NULL DEFAULT true | Active flag |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

**Constraints:**
- UNIQUE (tenant_id, brand_id, name)

**Indexes:**
- `idx_auto_models_lookup` ON (tenant_id, brand_id)

---

#### `auto_variants` - Phiên bản xe

Stores specific vehicle variants (2024 Camry 2.5Q, 2023 Civic RS, etc.)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `tenant_id` | UUID | NOT NULL, FK → tenants(id) | Tenant isolation |
| `model_id` | UUID | NOT NULL, FK → auto_models(id) | Parent model |
| `name` | TEXT | NOT NULL | Variant name (e.g., "2.5Q", "RS") |
| `year` | INTEGER | NOT NULL | Model year (e.g., 2024) |
| `fuel_type` | TEXT | | Gasoline, Diesel, EV, Hybrid |
| `transmission` | TEXT | | Automatic, Manual |
| `specs_json` | JSONB | NOT NULL DEFAULT '{}' | Technical specifications |
| `is_active` | BOOLEAN | NOT NULL DEFAULT true | Active flag |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

**Constraints:**
- UNIQUE (tenant_id, model_id, name, year)

**Indexes:**
- `idx_auto_variants_lookup` ON (tenant_id, model_id)

---

### Phase 1: Vehicle Inventory

#### `auto_vehicles` - Kho xe theo VIN

Main inventory table tracking individual vehicles by VIN.

**Key Fields:**

| Column | Type | Description |
|--------|------|-------------|
| `vin` | TEXT(17) | Vehicle Identification Number (UNIQUE per tenant) |
| `chassis_number` | TEXT | Số khung |
| `engine_number` | TEXT | Số máy |
| `status` | auto_vehicle_status | ENUM: in_transit, warehouse, showroom, allocated, delivered, returned, scrapped |
| `color_exterior` | TEXT | Exterior color |
| `list_price` | NUMERIC(18,0) | Giá niêm yết (VND) |
| `cost_price` | NUMERIC(18,0) | Giá vốn nhập |
| `allocated_to_contract_id` | UUID | FK → auto_bookings(id) when status = 'allocated' |
| `delivered_at` | TIMESTAMPTZ | Timestamp when delivered to customer |

**Status State Machine:**
```
in_transit → warehouse → showroom → allocated → delivered
                  ↓         ↓
              returned  ← scrapped
```

**Indexes:**
- `idx_auto_vehicles_vin` ON (tenant_id, vin) - UNIQUE
- `idx_auto_vehicles_status` ON (tenant_id, status)

---

#### `auto_vehicle_status_logs` - Lịch sử trạng thái (Immutable)

Audit trail of vehicle status changes.

| Column | Type | Description |
|--------|------|-------------|
| `vehicle_id` | UUID | FK → auto_vehicles(id) |
| `from_status` | auto_vehicle_status | Previous status |
| `to_status` | auto_vehicle_status | New status |
| `changed_by_user_id` | UUID | User who made the change |
| `reason` | TEXT | Change reason |

**No UPDATE/DELETE** - Append-only table for audit compliance.

---

### Phase 4: Lead & Booking Management

#### `auto_leads` - Cơ hội bán hàng

Sales lead tracking from first contact to won/lost.

| Column | Type | Description |
|--------|------|-------------|
| `customer_id` | UUID | FK → customers(id) |
| `source` | TEXT | facebook_ads, google_ads, website, showroom, referral, direct |
| `preferred_variant_id` | UUID | FK → auto_variants(id) |
| `budget_limit` | NUMERIC(18,0) | Customer budget |
| `assigned_sales_agent_id` | UUID | FK → users(id) - Nhân viên bán hàng |
| `status` | TEXT | new, contacted, test_drive, negotiating, won, lost |
| `lost_reason` | TEXT | Why lead was lost (if status = 'lost') |

**Indexes:**
- `idx_auto_leads_sales_agent` ON (assigned_sales_agent_id)
- `idx_auto_leads_customer` ON (customer_id)

---

#### `auto_bookings` - Hợp đồng đặt cọc

Sales contracts with deposit tracking.

| Column | Type | Description |
|--------|------|-------------|
| `booking_number` | TEXT | UNIQUE booking reference (e.g., BK20260804-0001) |
| `customer_id` | UUID | FK → customers(id) |
| `variant_id` | UUID | FK → auto_variants(id) |
| `vehicle_id` | UUID | FK → auto_vehicles(id) - Allocated VIN |
| `total_price` | NUMERIC(18,0) | Negotiated sale price |
| `deposit_amount` | NUMERIC(18,0) | Required deposit amount |
| `deposit_paid` | NUMERIC(18,0) | Actual deposit paid |
| `payment_status` | TEXT | unpaid, partially_paid, fully_paid, refunded |
| `status` | TEXT | pending, confirmed, completed, cancelled |

**Indexes:**
- `idx_auto_bookings_number` ON (tenant_id, booking_number) - UNIQUE
- `idx_auto_bookings_vehicle` ON (vehicle_id)

---

#### `auto_deposits` - Lịch sử đặt cọc

Tracks deposit payment history for bookings.

| Column | Type | Description |
|--------|------|-------------|
| `booking_id` | UUID | FK → auto_bookings(id) ON DELETE CASCADE |
| `amount` | NUMERIC(18,0) | Deposit amount received |
| `payment_method` | TEXT | cash, bank_transfer, credit_card |
| `payment_date` | DATE | Date payment received |
| `reference_number` | TEXT | Transaction reference |
| `confirmed_by` | UUID | FK → users(id) - Staff who confirmed |
| `notes` | TEXT | Payment notes |

**Indexes:**
- `idx_auto_deposits_booking` ON (booking_id)
- `idx_auto_deposits_date` ON (tenant_id, payment_date)

---

### Phase 6: Workshop & Service Center

#### `auto_service_appointments` - Lịch hẹn bảo dưỡng/sửa chữa

Service appointment booking system.

**Key Fields (NEW schema after migration 20260804360000):**

| Column | Type | Description |
|--------|------|-------------|
| `appointment_number` | TEXT | UNIQUE (e.g., APT20260804-0001) |
| `customer_id` | UUID | FK → customers(id) |
| `vehicle_id` | UUID | FK → auto_vehicles(id) |
| `scheduled_date` | TIMESTAMPTZ | **NEW** Combined date + time |
| `customer_name` | TEXT | **NEW** Denormalized for fast display |
| `customer_phone` | TEXT | **NEW** Denormalized |
| `vehicle_info` | TEXT | **NEW** Denormalized (e.g., "2024 Toyota Camry - 30A12345") |
| `service_type` | TEXT | routine_maintenance, major_service, minor_service, inspection, repair |
| `description` | TEXT | **NEW** Service description |
| `estimated_duration_hours` | NUMERIC(4,2) | **NEW** Duration in hours |
| `assigned_technician_id` | UUID | **NEW** FK → users(id) |
| `status` | TEXT | scheduled, confirmed, checked_in, in_progress, completed, cancelled, no_show |
| `notes` | TEXT | **NEW** Combined internal + customer notes |

**OLD columns kept for backward compatibility:**
- `appointment_date` (DATE)
- `appointment_time` (TIME)
- `internal_notes` (TEXT)
- `customer_notes` (TEXT)

**Indexes:**
- `idx_auto_service_appointments_scheduled` ON (scheduled_date)
- `idx_auto_service_appointments_status` ON (status)

---

#### `auto_repair_orders` - Phiếu sửa chữa / Job Card

Work orders for repairs and maintenance.

**Key Fields (NEW schema after migration 20260804360000):**

| Column | Type | Description |
|--------|------|-------------|
| `order_number` | TEXT | UNIQUE (e.g., RO20260804-0001) |
| `customer_name` | TEXT | **NEW** Denormalized |
| `customer_phone` | TEXT | **NEW** Denormalized |
| `vehicle_info` | TEXT | **NEW** Denormalized |
| `order_type` | TEXT | maintenance, repair, warranty, recall |
| `mileage_in` | INTEGER | Mileage when vehicle checked in |
| `work_description` | TEXT | Work to be performed |
| `status` | TEXT | open, diagnosed, approved, in_progress, quality_check, completed, invoiced, delivered, cancelled |
| `estimated_total` | NUMERIC(15,2) | Estimated cost |
| `actual_total` | NUMERIC(15,2) | Final cost |
| `is_warranty_work` | BOOLEAN | Whether covered by warranty |

**Status Workflow:**
```
open → diagnosed → approved → in_progress → quality_check → completed → invoiced → delivered
```

**Indexes:**
- `idx_auto_repair_orders_status` ON (status)
- `idx_auto_repair_orders_date` ON (order_date)

---

#### `auto_service_history` - Lịch sử bảo dưỡng (IMMUTABLE)

**⚠️ CRITICAL: This table is APPEND-ONLY. No updates or deletes allowed.**

Permanent service history linked to VIN for:
- Warranty validation
- Resale value assessment
- Customer trust

| Column | Type | Description |
|--------|------|-------------|
| `vehicle_id` | UUID | FK → auto_vehicles(id) ON DELETE RESTRICT |
| `vin` | TEXT(17) | Denormalized VIN for safety |
| `service_date` | DATE | Date service performed |
| `service_type` | TEXT | Service category |
| `mileage` | INTEGER | Mileage at service |
| `services_performed` | JSONB | Array of service items |
| `parts_replaced` | JSONB | Array of parts with details |
| `total_cost` | NUMERIC(15,2) | Historical cost |
| `is_locked` | BOOLEAN | DEFAULT true - Cannot modify |

**RLS Policies:**
- NO UPDATE allowed
- NO DELETE allowed
- INSERT only

---

### Phase 7: Trade-In Center

#### `auto_trade_in_appraisals` - Định giá xe cũ

Trade-in vehicle appraisal with comprehensive checklist.

**Key Features:**
- 18 photo categories (exterior, interior, engine, damage, etc.)
- Technical condition JSONB checklists
- Market valuation integration
- Approval workflow

| Column | Type | Description |
|--------|------|-------------|
| `appraisal_number` | TEXT | UNIQUE (e.g., TI20260804-0001) |
| `vin` | TEXT | VIN of trade-in vehicle |
| `make` | TEXT | Brand (e.g., "Honda") |
| `model` | TEXT | Model (e.g., "Civic") |
| `year` | INTEGER | Model year |
| `mileage` | INTEGER | Current mileage |
| `engine_condition` | JSONB | Checklist (starts_easily, no_smoke, etc.) |
| `transmission_condition` | JSONB | Checklist (shifts_smoothly, no_slipping, etc.) |
| `exterior_condition` | JSONB | Checklist (paint, scratches, dents, rust, etc.) |
| `interior_condition` | JSONB | Checklist (seats, dashboard, AC, audio, etc.) |
| `overall_condition` | TEXT | excellent, good, fair, poor, very_poor |
| `offered_trade_in_value` | NUMERIC(12,2) | Initial offer |
| `final_trade_in_value` | NUMERIC(12,2) | Negotiated final value |
| `status` | TEXT | draft, pending_approval, approved, offer_sent, accepted, rejected, expired, completed, cancelled |

**Status Workflow:**
```
draft → pending_approval → approved → offer_sent → accepted/rejected
                                                      ↓
                                                 completed
```

**Indexes:**
- `idx_auto_trade_in_appraisals_number` ON (tenant_id, appraisal_number) - UNIQUE
- `idx_auto_trade_in_appraisals_status` ON (tenant_id, status)

---

#### `auto_trade_in_photos` - Hình ảnh định giá

Multi-angle photo storage for trade-in appraisals.

**Photo Categories (18 types):**
- Exterior: front, rear, left_side, right_side, 4 angles
- Interior: dashboard, front_seats, rear_seats, trunk
- Technical: engine_bay, odometer, vin_plate
- Documentation: documents
- Damage: damage_specific
- Other: other

| Column | Type | Description |
|--------|------|-------------|
| `appraisal_id` | UUID | FK → auto_trade_in_appraisals(id) ON DELETE CASCADE |
| `photo_category` | TEXT | See above 18 categories |
| `photo_url` | TEXT | Supabase Storage URL |
| `photo_thumbnail_url` | TEXT | Thumbnail URL |
| `damage_markers` | JSONB | Array of {x, y, label, severity} for UI overlay |
| `is_primary` | BOOLEAN | Whether this is the primary photo |

**Indexes:**
- `idx_auto_trade_in_photos_appraisal` ON (appraisal_id)
- `idx_auto_trade_in_photos_category` ON (appraisal_id, photo_category)

---

## Relationships & Foreign Keys

### Core Relationships

```
tenants (1) ─────┬─────── (N) auto_brands
                 │
                 └─────── (N) auto_vehicles
                 │
                 └─────── (N) auto_bookings

auto_brands (1) ──────── (N) auto_models

auto_models (1) ──────── (N) auto_variants

auto_variants (1) ───┬─── (N) auto_vehicles
                     │
                     └─── (N) auto_bookings

customers (1) ────┬────── (N) auto_leads
                  │
                  └────── (N) auto_bookings
                  │
                  └────── (N) auto_service_appointments

auto_vehicles (1) ─┬───── (N) auto_service_appointments
                   │
                   └───── (N) auto_repair_orders
                   │
                   └───── (N) auto_service_history (IMMUTABLE)

auto_bookings (1) ────── (N) auto_deposits
```

### Cascade Rules

**DELETE CASCADE:**
- auto_brands → auto_models → auto_variants
- auto_bookings → auto_deposits
- auto_trade_in_appraisals → auto_trade_in_photos

**DELETE RESTRICT:**
- auto_vehicles → auto_service_history (CANNOT delete vehicle if has service history)
- auto_variants → auto_vehicles (CANNOT delete variant if vehicles exist)

**DELETE SET NULL:**
- auto_leads → auto_bookings (Booking survives even if lead deleted)
- auto_service_appointments → auto_repair_orders (RO survives if appointment deleted)

---

## Indexes & Performance

### Primary Indexes (Automatically Created)

All tables have:
- PRIMARY KEY on `id` (UUID)
- UNIQUE constraint on tenant_id + business key (e.g., `booking_number`, `vin`)

### Secondary Indexes (Manually Created)

**Lookup Indexes:**
```sql
idx_auto_vehicles_vin           ON (tenant_id, vin)        -- VIN search
idx_auto_bookings_number        ON (tenant_id, booking_number)  -- Booking search
idx_auto_service_appointments_scheduled ON (scheduled_date)     -- Calendar queries
```

**Foreign Key Indexes:**
```sql
idx_auto_models_lookup          ON (tenant_id, brand_id)   -- Cascading dropdown
idx_auto_variants_lookup        ON (tenant_id, model_id)   -- Cascading dropdown
idx_auto_vehicles_status        ON (tenant_id, status)     -- Inventory filtering
```

**Date Range Indexes:**
```sql
idx_auto_deposits_date          ON (tenant_id, payment_date)  -- Financial reports
idx_auto_repair_orders_date     ON (order_date)                -- Workshop analytics
```

### Composite Indexes (Phase 15: Rollup Analytics)

```sql
idx_auto_vehicles_status_date   ON (tenant_id, status, created_at)
idx_auto_bookings_status_date   ON (tenant_id, status, created_at)
```

---

## RLS Policies

All tables have **Row-Level Security (RLS)** enabled with tenant isolation.

### Standard Tenant Isolation Policy

```sql
CREATE POLICY "Tenant view auto_[TABLE]" ON auto_[TABLE]
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
```

### Special RLS Policies

**auto_service_history (IMMUTABLE):**
```sql
CREATE POLICY "auto_service_history_no_update" ON auto_service_history
  FOR UPDATE USING (false);  -- NO UPDATES ALLOWED

CREATE POLICY "auto_service_history_no_delete" ON auto_service_history
  FOR DELETE USING (false);  -- NO DELETES ALLOWED
```

**Service Role Bypass:**
```sql
-- Service role can bypass RLS for background jobs
-- SET ROLE service_role; -- Full access
```

---

## Migration History

| Timestamp | Phase | Description | Tables Added |
|-----------|-------|-------------|--------------|
| 20260803200800 | Phase 0 | Foundation | auto_brands, auto_models, auto_variants |
| 20260803210000 | Phase 1 | Vehicle Inventory | auto_vehicles, auto_vehicle_status_logs |
| 20260803240000 | Phase 4 | Lead & Booking | auto_leads, auto_bookings |
| 20260803260000 | Phase 6 | Workshop | auto_service_appointments, auto_repair_orders, auto_service_history, auto_warranty_claims, auto_technician_time_logs |
| 20260803270000 | Phase 7 | Trade-In Center | auto_trade_in_appraisals, auto_trade_in_photos, auto_market_valuations |
| 20260804310000 | Deposits | Deposit Tracking | auto_deposits |
| 20260804320000 | Analytics | Analytics RPCs | 4 RPC functions |
| 20260804360000 | Workshop Migration | Schema Update | Added denormalized columns to appointments & repair orders |

**Total Tables:** 15+ core tables  
**Total RPCs:** 10+ functions  
**Total Indexes:** 40+ indexes

---

## Next Steps

1. **For Developers:** Read [API Documentation](./API_DOCUMENTATION.md)
2. **For DBAs:** Follow [Migration Guide](./MIGRATION_GUIDE.md)
3. **For QA:** Review test scenarios in `__tests__/` folders
4. **For Operators:** Set up monitoring for RLS policy violations

---

**Last Updated:** 2026-08-04  
**Maintainer:** Bella ERP Development Team  
**Questions:** Contact tech-team@bella-erp.com
