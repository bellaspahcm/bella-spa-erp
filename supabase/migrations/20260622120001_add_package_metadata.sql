-- =============================================================================
-- Migration: Add Package Metadata for Multi-Domain Support
-- Date: 2026-06-22
-- Purpose:
--   1. Add metadata columns to packages table for domain-specific attributes
--   2. Support future AI Scheduling, Workforce Planning, Auto Assignment
--   3. Make package model extensible without schema changes
-- =============================================================================

-- Add metadata columns to packages table
ALTER TABLE public.packages 
ADD COLUMN IF NOT EXISTS complexity TEXT CHECK (complexity IN ('LOW', 'MEDIUM', 'HIGH'));

ALTER TABLE public.packages 
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER; -- in minutes

ALTER TABLE public.packages 
ADD COLUMN IF NOT EXISTS required_workers INTEGER DEFAULT 1;

ALTER TABLE public.packages 
ADD COLUMN IF NOT EXISTS recommended_area_min INTEGER; -- in square meters

ALTER TABLE public.packages 
ADD COLUMN IF NOT EXISTS recommended_area_max INTEGER; -- in square meters

-- Add comments to document usage
COMMENT ON COLUMN public.packages.complexity IS 
'Service complexity level: LOW (basic tasks), MEDIUM (specialized skills), HIGH (certifications/equipment required). 
Used for: staff assignment, training requirements, quality control standards.';

COMMENT ON COLUMN public.packages.estimated_duration IS 
'Estimated duration per session in minutes. 
Used for: scheduling, resource planning, time-based pricing.
Example: 240 = 4 hours, 480 = 8 hours';

COMMENT ON COLUMN public.packages.required_workers IS 
'Number of workers required to complete one session. 
Used for: workforce planning, auto-assignment, capacity calculation.
Example: 1 = solo work, 2 = team of 2, 4 = large crew';

COMMENT ON COLUMN public.packages.recommended_area_min IS 
'Minimum recommended service area in square meters. 
Used for: quotation, pricing guidance, capacity planning.
NULL means no specific area requirement.';

COMMENT ON COLUMN public.packages.recommended_area_max IS 
'Maximum recommended service area in square meters. 
Used for: quotation, pricing guidance, capacity planning.
NULL means no upper limit.';

-- Update session_multiplier comment to clarify relationship with metadata
COMMENT ON COLUMN public.packages.session_multiplier IS 
'Session multiplier for salary calculation. Represents workload/difficulty factor for KTV commission.
Examples:
- 1.0 = Basic workload (~4 hours, 1 worker, LOW complexity)
- 1.5 = Medium workload (~6 hours OR 1.5x difficulty, MEDIUM complexity)
- 2.0 = High workload (~8 hours OR 2 workers OR HIGH complexity)

Calculation guideline:
  multiplier ≈ (estimated_duration / 240) * (required_workers) * complexity_factor
  where complexity_factor: LOW=1.0, MEDIUM=1.25, HIGH=1.5

This is a Version 1 compatibility shim. In future versions, this will be replaced with proper WorkUnit abstraction.';

