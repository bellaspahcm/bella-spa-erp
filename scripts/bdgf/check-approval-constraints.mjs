#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;
const dbUrl = process.env.DATABASE_URL;
const match = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
const [, user, password, host, port, database] = match;

const client = new Client({ host, port: parseInt(port), database, user, password, ssl: { rejectUnauthorized: false } });

await client.connect();

const result = await client.query(`
  SELECT conname, pg_get_constraintdef(oid) as definition
  FROM pg_constraint
  WHERE conrelid = 'bella_migration_approval'::regclass
    AND contype = 'c'
`);

console.log('CHECK CONSTRAINTS on bella_migration_approval:\n');
result.rows.forEach(row => {
  console.log(`Constraint: ${row.conname}`);
  console.log(`Definition: ${row.definition}\n`);
});

await client.end();
