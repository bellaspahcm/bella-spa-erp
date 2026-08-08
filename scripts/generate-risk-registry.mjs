import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Path definitions
const workspaceDir = 'd:/Antigravity/Projects/BELLA SPA ERP';
const matrixPath = path.join(workspaceDir, 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md');
const seedPath = path.join(workspaceDir, 'supabase/migrations/20260808000003_seed_capability_risk_registry.sql');

// Stable private key for RSA signing
const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQD2fTrYc1BZMzkS
j3FN/9/Jn2QGwDsm3qH0BEty8VrQVJQI2ZLmp6vkcE/JkiAoiWjh04uHZVcwLPfR
soVC7I2eN1PLzSrtbSHqC+oIq+QpXxZf5dSAsS83YGFeX99djsJJVJsLW+5Rkh3d
1Z4Jw1UwwYJwDGMRImTrXRM0x1e+t5lys3qlvSN33kiQ85wSF46JKHKRDWDXCTJr
kLt9aZi8kuiOpiF6d5WcqaqB0o7HsAT1wL5bO8xi1N6ie/DXn5I8XEm2ESGgOEPU
Bck6szZos4oMp0VHsqesqvJx5tKKBxAWipvLJ/vj6mfZazmkHgKAb08ri6aRppub
fhDHYWIPAgMBAAECggEAVkONjKMOw6kBmFVLOhkKoO1/fD1adkgENfoqzZdaSP7Q
sCg1GTQlHFWSFuFlD8rHQgFfG4uD8ABM2r63lKxlA7IpSXIMS/udmuOAjHhb6X61
veoZbNCVzbOVYAn9iiikJjXN7TPHPBT/Dtvr607JSb7vf3dWVHDNEPIJ/ralJsE6
xmDKbMZziXaZIF8cdBCHGfwsBVQlgOfKEjs5t5Wip3MYzoeAHf1PKAvNwJ0UIUtq
KHUtR64KhyVT6fOS4cByQpFv00ua+P+Z9YyuCHoGN73xX75zovekmFZrdKWVIZ7+
8A1wRSAPo5IbrGWCOyOOk1DmeqUN/6GJVSywP/FygQKBgQD8ctMbAcwrnsmlpM3w
gJtLtc4GTzuvZitk/6jC1UYy0fPZTg9nsl+LkESJcjUQdtI4UgBndUATx6Qnjs3I
sJP9mOlOBnRGQ7dKa17TU9zZAtKDAWqiALxwml0mSEwUh9P2f0sgZfY+MuwdBOAs
/pf1RN2nj1QlqZcukneJxHYpKQKBgQD59PFrXWQP3lMzf2MMl9vbfJ08SmOnYkC0
Za+Vguknn41JoY5vyV9qVauxwQG3H6vvmU/EfqKsIwFEWEMhkyQAeDDKhckqPnkV
Y5PmwPoYn5q+B2Y1yhhUXAaADTKyf7KxIT6V4unlp1SOh70oUeG8QeoffV8kWQUO
qwXuXBpAdwKBgQDPoGzKAI94rM8yIjqSfGO9QBjjjZUMLF6yYabeH2Tt9Um2RwJa
ihUVByGnXbwQ/3jkg2T7si5yVjdHpabQUZJV98aiuqI1DAqa9XX3Hzk7bpvOzYJz
HWHexsan7rxMAm6thII4ckO1YlJZh6IMv5QhUHNxFWvi0fmafzI7p857CQKBgQCf
1CIzFuqOwwjMmx4IxWnONSaNkLucIlVhhMv7fFP+BCXh+S4NCOS8J7+7z8B7CgN1
F8FL0fXOwCtlOlLiuyWAL1pzhYyWOJBQPvYpzSeeayAVdsHCj1FzT8zQQKA0RzdJ
0Aom6YvKT27gHKe1inYfXL6KGC6oHUwAjxchzT70DQKBgQDdAXcRVcVieZh0Zato
+OTfYVnnB8nURhhzOgGqPoq/M5qMLP1ZETo6ePygnf3qUICHSmSS/jeMenWlX1ep
d09QI+KB4M8tni4JEJqfdFQEMyEKGVyAgN8HuzAJFc98vXmeMyYfh8/oRkEww+3p
CZ9L3UxLxjkGt4Ps5RaTOG9oTA==
-----END PRIVATE KEY-----`;

function generateRegistry() {
  console.log('[Registry Generator] Starting...');
  
  if (!fs.existsSync(matrixPath)) {
    throw new Error(`Matrix file not found at: ${matrixPath}`);
  }

  const content = fs.readFileSync(matrixPath, 'utf8');
  
  // 1. Calculate SHA-256 hash of the frozen matrix
  const matrixHash = crypto.createHash('sha256').update(content).digest('hex');
  console.log(`[Registry Generator] Approved Matrix SHA-256 Hash: ${matrixHash}`);

  // 2. Generate Digital Signature of the hash using the private key
  const signer = crypto.createSign('sha256');
  signer.update(matrixHash);
  signer.end();
  const signature = signer.sign(PRIVATE_KEY_PEM, 'hex');
  console.log(`[Registry Generator] Cryptographic Signature generated.`);

  // 3. Parse capabilities from Markdown tables
  const lines = content.split('\n');
  const capabilities = [];

  for (const line of lines) {
    if (line.trim().startsWith('| HC-')) {
      const parts = line.split('|').map(p => p.trim());
      const id = parts[1];
      const name = parts[2];
      const domain = parts[3];
      const s = parseInt(parts[4], 10);
      const c = parseInt(parts[5], 10);
      const b = parseInt(parts[6], 10);
      const score = parseInt(parts[7], 10);
      const calcTier = parts[8];
      const override = parts[9];
      const finalTier = parts[10];
      const policy = parts[11];
      const safetyProfile = parts[12];
      const status = parts[13];
      const notes = parts[14] || '';

      capabilities.push({
        id, name, domain, s, c, b, score, calcTier, override, finalTier, policy, safetyProfile, status, notes
      });
    }
  }

  console.log(`[Registry Generator] Parsed ${capabilities.length} capabilities from matrix.`);

  if (capabilities.length !== 52) {
    throw new Error(`Validation Error: Expected exactly 52 capabilities, but found ${capabilities.length}`);
  }

  // 4. Validate capability classification logic
  for (const cap of capabilities) {
    // A. Validate score calculation
    const expectedScore = cap.s * cap.c * cap.b;
    if (cap.score !== expectedScore) {
      throw new Error(`Validation Error: ${cap.id} risk score mismatch. Found ${cap.score}, expected ${expectedScore} (${cap.s}*${cap.c}*${cap.b})`);
    }

    // B. Validate calculated tier
    let expectedCalcTier = 'T1';
    if (expectedScore >= 31) {
      expectedCalcTier = 'T3';
    } else if (expectedScore >= 11) {
      expectedCalcTier = 'T2';
    }
    if (cap.calcTier !== expectedCalcTier) {
      throw new Error(`Validation Error: ${cap.id} calculated tier mismatch. Found ${cap.calcTier}, expected ${expectedCalcTier} (score: ${expectedScore})`);
    }

    // C. Validate final tier and override logic
    let expectedFinalTier = expectedCalcTier;
    if (cap.override === 'Patient Identity Safety' || cap.override === 'C=5+B=5' || cap.override === 'C≥4+B≥4' || cap.override === 'Governance') {
      expectedFinalTier = 'T3';
    }
    if (cap.finalTier !== expectedFinalTier) {
      throw new Error(`Validation Error: ${cap.id} final tier mismatch. Found ${cap.finalTier}, expected ${expectedFinalTier} (override: ${cap.override})`);
    }

    // D. Validate status
    if (cap.status !== 'Approved') {
      throw new Error(`Validation Error: ${cap.id} is not marked as 'Approved' in risk matrix.`);
    }
  }

  console.log('[Registry Generator] Logic validation completed successfully. All rules enforced.');

  // 5. Generate seed SQL script
  const sqlLines = [];
  sqlLines.push('-- Seed script generated automatically from: docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md');
  sqlLines.push('-- Generated at: ' + new Date().toISOString());
  sqlLines.push('-- Generator Version: 1.0.0');
  sqlLines.push('');
  sqlLines.push('TRUNCATE TABLE capability_risk_registry CASCADE;');
  sqlLines.push('');

  const escapeSql = (str) => str.replace(/'/g, "''");

  for (const cap of capabilities) {
    const values = [
      `'${cap.id}'`,
      `'${escapeSql(cap.name)}'`,
      `'${cap.domain}'`,
      cap.s,
      cap.c,
      cap.b,
      cap.score,
      `'${cap.calcTier}'`,
      `'${cap.override}'`,
      `'${cap.finalTier}'`,
      `'${cap.policy}'`,
      `'${cap.safetyProfile}'`,
      `'${cap.status}'`,
      cap.notes ? `'${escapeSql(cap.notes)}'` : 'NULL',
      `'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md'`,
      `'1.0'`,
      `'${matrixHash}'`,
      `'${signature}'`,
      `'{"approvers": ["Product Owner", "Engineering Lead", "DevOps Lead", "Clinical Safety Officer", "CTO"]}'::jsonb`,
      `'2026-08-08T00:00:00Z'::timestamptz`,
      `'1.0.0'`
    ];

    sqlLines.push(`INSERT INTO capability_risk_registry (
    capability_id, capability_name, domain, scale_factor, clinical_criticality, blast_radius,
    risk_score, calculated_tier, override_rule, final_tier, rollout_policy, safety_profile,
    governance_status, notes, source_document, source_version, generated_from_hash,
    matrix_signature, approved_by, approved_at, generator_version
) VALUES (
    ${values.join(', ')}
);`);
  }

  fs.writeFileSync(seedPath, sqlLines.join('\n'), 'utf8');
  console.log(`[Registry Generator] Successfully generated seed SQL at: ${seedPath}`);
}

try {
  generateRegistry();
} catch (error) {
  console.error('[Registry Generator] FAILED:', error.message);
  process.exit(1);
}
