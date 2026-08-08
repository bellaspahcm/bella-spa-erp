-- Seed script generated automatically from: docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md
-- Generated at: 2026-08-08T03:04:38.712Z
-- Generator Version: 1.0.0

TRUNCATE TABLE capability_risk_registry CASCADE;

INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-001', 'Patient Registration', 'Core', 2, 2, 2, 8, 'T1', 'None', 'T1', 'v1.0', 'Generic', 'Approved', 'Administrative entry point', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-002', 'Patient Identity & Demographics', 'Core', 3, 2, 3, 18, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Identity data', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-003', 'Patient Merge / Identity Resolution', 'Core', 3, 3, 4, 36, 'T3', 'Patient Identity Safety', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Wrong identity can affect care', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-004', 'Encounter Management', 'Core', 3, 3, 3, 27, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Encounter lifecycle', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-005', 'Consent Management', 'Core', 3, 3, 3, 27, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Consent workflow', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-006', 'Emergency Contact Management', 'Core', 2, 2, 2, 8, 'T1', 'None', 'T1', 'v1.0', 'Generic', 'Approved', 'Administrative support', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-007', 'OPD Scheduling', 'Clinical Ops', 3, 2, 2, 12, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Non-urgent outpatient', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-008', 'Queue / Calling', 'Clinical Ops', 3, 2, 2, 12, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Patient flow', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-009', 'Doctor Consultation Workflow', 'Clinical Ops', 3, 3, 3, 27, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Clinical workflow', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-010', 'Ward Management', 'Clinical Ops', 3, 3, 2, 18, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Inpatient operations', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-011', 'Bed Management', 'Clinical Ops', 3, 3, 3, 27, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Bed allocation', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-012', 'Nursing Workflow', 'Clinical Ops', 3, 3, 4, 36, 'T3', 'None', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Nursing execution', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-013', 'Discharge Management', 'Clinical Ops', 3, 3, 3, 27, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Discharge workflow', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-014', 'Referral / Transfer', 'Clinical Ops', 3, 3, 3, 27, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Care transition', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-015', 'Emergency Triage', 'Safety-Critical', 3, 5, 5, 75, 'T3', 'C=5+B=5', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Life/death decisions', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-016', 'ICU Monitoring', 'Safety-Critical', 3, 4, 5, 60, 'T3', 'C≥4+B≥4', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Missed alert = severe harm', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-017', 'Medication Ordering', 'Safety-Critical', 3, 5, 5, 75, 'T3', 'C=5+B=5', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Wrong drug/dose', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-018', 'Medication Administration', 'Safety-Critical', 3, 5, 5, 75, 'T3', 'C=5+B=5', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Direct patient safety', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-019', 'Anesthesia Records', 'Safety-Critical', 3, 5, 5, 75, 'T3', 'C=5+B=5', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Airway / anesthesia', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-020', 'Perioperative Platform', 'Safety-Critical', 4, 5, 5, 100, 'T3', 'C=5+B=5', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Highest-risk capability', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-021', 'Surgical Safety Workflow', 'Safety-Critical', 3, 5, 5, 75, 'T3', 'C=5+B=5', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Wrong-site / surgical safety', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-022', 'Blood Bank Management', 'Safety-Critical', 3, 5, 5, 75, 'T3', 'C=5+B=5', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Wrong blood type', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-023', 'Critical Lab Alerting', 'Safety-Critical', 3, 4, 5, 60, 'T3', 'C≥4+B≥4', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Missed critical values', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-024', 'Clinical Critical Alerts', 'Safety-Critical', 3, 4, 5, 60, 'T3', 'C≥4+B≥4', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Safety alert delivery', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-025', 'Laboratory Orders', 'Diagnostics', 3, 2, 3, 18, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Diagnostic workflow', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-026', 'Laboratory Results', 'Diagnostics', 3, 3, 4, 36, 'T3', 'None', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Result integrity', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-027', 'Critical Laboratory Results', 'Diagnostics', 3, 4, 5, 60, 'T3', 'C≥4+B≥4', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Life-threatening values', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-028', 'Imaging Orders', 'Diagnostics', 3, 2, 3, 18, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Imaging workflow', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-029', 'Imaging Results', 'Diagnostics', 3, 3, 4, 36, 'T3', 'None', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Diagnostic result integrity', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-030', 'Pharmacy Management', 'Pharmacy', 3, 3, 3, 27, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Pharmacy operations', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-031', 'Prescription Management', 'Pharmacy', 3, 3, 3, 27, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Prescription lifecycle', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-032', 'Drug Dispensing', 'Pharmacy', 3, 4, 4, 48, 'T3', 'C≥4+B≥4', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Dispensing safety', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-033', 'Drug Inventory', 'Pharmacy', 3, 3, 3, 27, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Inventory control', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-034', 'Medical Records', 'Clinical Records', 3, 3, 4, 36, 'T3', 'None', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Clinical record integrity', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-035', 'Clinical Documentation', 'Clinical Records', 3, 3, 4, 36, 'T3', 'None', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Clinical documentation', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-036', 'Vital Signs', 'Clinical Records', 3, 4, 5, 60, 'T3', 'C≥4+B≥4', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Patient monitoring', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-037', 'Allergy Management', 'Clinical Records', 3, 4, 5, 60, 'T3', 'C≥4+B≥4', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Allergy information', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-038', 'Diagnosis Management', 'Clinical Records', 3, 3, 4, 36, 'T3', 'None', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Clinical decision support input', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-039', 'Procedure / Treatment Records', 'Clinical Records', 3, 3, 4, 36, 'T3', 'None', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Treatment history', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-040', 'Care Plan', 'Clinical Records', 3, 3, 4, 36, 'T3', 'None', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Care coordination', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-041', 'Clinical History', 'Clinical Records', 3, 3, 4, 36, 'T3', 'None', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Longitudinal clinical data', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-042', 'Healthcare Billing', 'Administrative', 3, 2, 3, 18, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Financial integrity', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-043', 'Insurance Management', 'Administrative', 3, 2, 3, 18, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Insurance workflow', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-044', 'Claims Management', 'Administrative', 3, 2, 3, 18, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Claims', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-045', 'Pricing Management', 'Administrative', 3, 2, 3, 18, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Healthcare pricing', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-046', 'Revenue Management', 'Administrative', 3, 2, 3, 18, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Revenue lifecycle', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-047', 'Healthcare Inventory', 'Administrative', 3, 2, 3, 18, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Enterprise inventory', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-048', 'Procurement', 'Administrative', 3, 1, 3, 9, 'T1', 'None', 'T1', 'v1.0', 'Generic', 'Approved', 'Procurement operations', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-049', 'Healthcare HR', 'Administrative', 3, 1, 3, 9, 'T1', 'None', 'T1', 'v1.0', 'Generic', 'Approved', 'Workforce administration', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-050', 'Compliance / Audit', 'Administrative', 4, 2, 4, 32, 'T3', 'None', 'T3', 'v1.1', 'Clinical Safety', 'Approved', 'Cross-system audit integrity', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-051', 'Healthcare Reporting', 'Administrative', 3, 2, 3, 18, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Operational reporting', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);
INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    'HC-052', 'Medical Statistics', 'Administrative', 3, 2, 3, 18, 'T2', 'None', 'T2', 'v1.0+HC', 'Healthcare Operational', 'Approved', 'Aggregate analytics', 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md', '1.0', '08ef32c509717619640fc026a04841240e1fc0ad20f2903a622c856c80a546e0', '59b156eac4ee8179d23d7dbe0cc3f8ddbe4ac7b53f2817e79278cef9ea100c2cc216d3fad5e2c1173a3e76138c2dbbaa92f09a549b2495036de7bc2d221f815e095f3c6c3d88f9f10b68eaca65ef29a35fa2189c9f521c7ff79c0e1adf26fbc41dd25a9ea4f692ddcd15c7cfd92066e35968175f85468c788be9c39a579c7a40e105e4c8616bead7b96a069219d574ae29cafc095e7fa921a1c834ce5a1f3e70d2db01707953c246a9b06953ba7d42e64a0cbc0ec054fbb1a2f8c44f1073f523e609727de8c2063a2642a660b18220551f796d4bf64f81d222bb3f5836fd665c728cdfce1b8a934ac01fe93908b6ea72cac93780d5821d164a1030ee947f013f', '{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb, '2026-08-08T00:00:00Z'::timestamptz, '1.0.0'
);