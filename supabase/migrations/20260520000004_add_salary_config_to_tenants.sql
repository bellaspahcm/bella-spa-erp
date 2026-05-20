-- Migration to add salary_config JSONB column to tenants
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS salary_config JSONB DEFAULT '{"bonus_5_star": 50000, "bonus_4_5_star": 30000, "bonus_4_star": 10000, "kpi_target_sessions": 30, "kpi_bonus_amount": 1000000}'::jsonb;
