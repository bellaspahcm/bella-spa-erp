#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const db = new pg.Client({
  connectionString: process.env.DATABASE_EXECUTOR_URL,
  ssl: { rejectUnauthorized: false }
});

await db.connect();

const result = await db.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_name LIKE 'bella_%' 
  ORDER BY table_name
`);

console.log('\nBDGF Tables Deployed:\n');
result.rows.forEach(row => {
  console.log(`✅ ${row.table_name}`);
});

const required = ['bella_gate_approvals', 'bella_gate_tokens', 'bella_security_incidents', 'bella_recovery_actions'];
const deployed = result.rows.map(r => r.table_name);
const missing = required.filter(t => !deployed.includes(t));

if (missing.length > 0) {
  console.log('\n❌ Missing tables:\n');
  missing.forEach(t => console.log(`  - ${t}`));
  process.exit(1);
} else {
  console.log('\n✅ All BDGF tables deployed!\n');
  process.exit(0);
}

await db.end();
