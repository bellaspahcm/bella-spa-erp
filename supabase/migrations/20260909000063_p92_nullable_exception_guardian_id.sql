-- Bella Preschool OS — Make guardian_party_id nullable in edu_comm_exceptions
-- Migration: 20260909000063_p92_nullable_exception_guardian_id.sql
-- Enables operational/facility exception projections (SAFETY_DEFECT, OVERDUE_INSPECTION) that are not tied to a parent guardian.

ALTER TABLE edu_comm_exceptions ALTER COLUMN guardian_party_id DROP NOT NULL;
