-- Test Migration 02
-- Phase 4B.2 Test Harness - Multiple migrations scenario
-- DO NOT execute against production database

BEGIN;

CREATE TABLE test_table_02 (
  id SERIAL PRIMARY KEY,
  value INTEGER NOT NULL
);

COMMIT;
