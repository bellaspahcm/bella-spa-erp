#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const { Client } = pg;
const dbUrl = process.env.DATABASE_URL;
const match = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
const [, user, password, host, port, database] = match;

const client = new Client({ host, port: parseInt(port), database, user, password, ssl: { rejectUnauthorized: false } });

await client.connect();

console.log('Dropping old status constraint...\n');

await client.query(`
  ALTER TABLE bella_migration_approval 
    DROP CONSTRAINT IF EXISTS bella_migration_approval_status_check
`);

console.log('✅ Old constraint dropped\n');

const result = await client.query(`
  SELECT conname, pg_get_constraintdef(oid) as definition
  FROM pg_constraint
  WHERE conrelid = 'bella_migration_approval'::regclass
    AND contype = 'c'
    AND conname LIKE '%status%'
`);

console.log('Status constraints after fix:\n');
result.rows.forEach(row => {
  console.log(`${row.conname}:`);
  console.log(`  ${row.definition}\n`);
});

await client.end();
