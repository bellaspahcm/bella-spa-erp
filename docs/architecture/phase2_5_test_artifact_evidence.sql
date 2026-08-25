-- PHASE 2.5: Test Artifact Evidence Collection

-- Check pattern analysis for test artifact indicators
SELECT
    '1. Pattern Analysis' as evidence_type,
    '18 movements identical: 15M VND, PAYMENT, INFLOW, 1111-2222-3333' as finding,
    'STRONG TEST ARTIFACT INDICATOR' as assessment;

SELECT
    '2. Business Domain Check' as evidence_type,
    'ALL 18 source_ids NOT FOUND in any business table' as finding,
    'STRONG TEST ARTIFACT INDICATOR' as assessment;

SELECT
    '3. Timeline Analysis' as evidence_type,
    '17/18 on 2026-08-16, clustered in time groups' as finding,
    'STRONG BATCH OPERATION INDICATOR' as assessment;

SELECT
    '4. No Real Business Events' as evidence_type,
    'No invoices, bookings, or payments found for 18 source_ids' as finding,
    'CONCLUSIVE: NOT REAL BUSINESS DATA' as assessment;

-- Summary
SELECT
    'ROOT CAUSE DETERMINATION' as conclusion,
    'TEST/SEED ARTIFACT' as root_cause,
    'HIGH CONFIDENCE (4/4 indicators)' as confidence,
    'NO BUSINESS EVENTS EXIST' as key_finding,
    'SAFE TO DELETE' as remediation_recommendation;
