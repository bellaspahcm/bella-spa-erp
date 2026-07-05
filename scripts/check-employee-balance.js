#!/usr/bin/env node
const { Client } = require('pg');

async function checkBalance() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await c.connect();
  
  const { rows } = await c.query(`
    SELECT id, email, full_name, leave_balance 
    FROM users 
    WHERE id IN ('a3a4f261-506e-4fb7-bd38-d245a3a1fea7', 'f3e5e94b-8683-4832-ad39-383c8804751c')
    ORDER BY leave_balance DESC
  `);
  
  console.log('📊 Employee Leave Balances:');
  rows.forEach(r => {
    console.log(`  ${r.full_name}: ${r.leave_balance} days`);
    console.log(`    Email: ${r.email}`);
    console.log(`    ID: ${r.id}`);
  });
  
  await c.end();
}

checkBalance();
