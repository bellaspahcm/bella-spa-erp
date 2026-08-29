-- Test Migration 01
-- Phase 4B.2 Test Harness - Multiple migrations scenario
-- DO NOT execute against production database

BEGIN;

CREATE TABLE test_table_01 (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

COMMIT;
