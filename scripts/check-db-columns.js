const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkColumns() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const res1 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'hc_encounters';
    `);
    console.log('Columns in hc_encounters:');
    res1.rows.forEach(r => console.log(` - ${r.column_name}: ${r.data_type}`));

    const res2 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'party_parties';
    `);
    console.log('\nColumns in party_parties:');
    res2.rows.forEach(r => console.log(` - ${r.column_name}: ${r.data_type}`));

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkColumns();
