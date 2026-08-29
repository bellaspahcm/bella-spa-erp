-- Test Migration: Add test column
-- Phase 4B.2 Test Harness
-- This is a mock migration file for testing purposes only
-- DO NOT execute against production database

BEGIN;

ALTER TABLE test_table 
ADD COLUMN test_column TEXT DEFAULT 'test_value';

COMMIT;
