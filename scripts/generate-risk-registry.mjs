import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Path definitions
const workspaceDir = 'd:/Antigravity/Projects/BELLA SPA ERP';
const matrixPath = path.join(workspaceDir, 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md');
const seedPath = path.join(workspaceDir, 'supabase/migrations/20260808000003_seed_capability_risk_registry.sql');

function loadSigningPrivateKey() {
  if (process.env.CAPABILITY_RISK_REGISTRY_PRIVATE_KEY_PEM) {
    return process.env.CAPABILITY_RISK_REGISTRY_PRIVATE_KEY_PEM.replace(/\\n/g, '\n');
  }

  if (process.env.CAPABILITY_RISK_REGISTRY_PRIVATE_KEY_PATH) {
    return fs.readFileSync(process.env.CAPABILITY_RISK_REGISTRY_PRIVATE_KEY_PATH, 'utf8');
  }

  throw new Error(
    'Missing signing key. Set CAPABILITY_RISK_REGISTRY_PRIVATE_KEY_PEM or CAPABILITY_RISK_REGISTRY_PRIVATE_KEY_PATH.'
  );
}

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
  const signature = signer.sign(loadSigningPrivateKey(), 'hex');
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
