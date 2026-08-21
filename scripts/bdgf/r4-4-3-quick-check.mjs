#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';
const { Client } = pg;
dotenv.config();

const db = new Client({
  connectionString: process.env.DATABASE_EXECUTOR_URL,
  ssl: { rejectUnauthorized: false }
});

await db.connect();

const incidents = await db.query('SELECT COUNT(*) FROM bella_security_incidents');
const recoveries = await db.query('SELECT COUNT(*) FROM bella_recovery_actions');
const verified = await db.query('SELECT COUNT(*) FROM bella_recovery_actions WHERE verified = true');

console.log('\n=== R4.4.3 AUDIT QUICK CHECK ===');
console.log(`Incidents: ${incidents.rows[0].count}`);
console.log(`Recovery Actions: ${recoveries.rows[0].count}`);
console.log(`Verified: ${verified.rows[0].count}`);

const pass = parseInt(incidents.rows[0].count) > 0 && 
             parseInt(recoveries.rows[0].count) > 0 &&
             parseInt(verified.rows[0].count) > 0;

console.log(`\nStatus: ${pass ? 'PASS ✅' : 'FAIL ❌'}\n`);

await db.end();
process.exit(pass ? 0 : 1);
