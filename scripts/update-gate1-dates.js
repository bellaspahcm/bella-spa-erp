#!/usr/bin/env node
const { Client } = require('pg');

async function updateDates() {
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await client.connect();
  
  console.log('📅 Updating leave request dates (avoid high season)...');
  
  // Update success scenario - move to November
  await client.query(`
    UPDATE leave_requests 
    SET start_date = CURRENT_DATE + INTERVAL '180 days', 
        end_date = CURRENT_DATE + INTERVAL '184 days'
    WHERE id = 'req-gate1-success'
  `);
  
  // Update reject scenario - move to March 2027 (avoid Tet + high season)
  await client.query(`
    UPDATE leave_requests 
    SET start_date = '2027-03-15'::date, 
        end_date = '2027-03-19'::date
    WHERE id = 'req-gate1-reject'
  `);
  
  const { rows } = await client.query(`
    SELECT id, start_date, end_date, TO_CHAR(start_date, 'Mon DD') as start_formatted
    FROM leave_requests 
    WHERE id LIKE 'req-gate1%'
  `);
  
  console.log('✅ Updated:');
  rows.forEach(r => console.log(`   ${r.id}: ${r.start_formatted}`));
  
  await client.end();
}

updateDates();
