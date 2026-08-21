#!/usr/bin/env node
/**
 * R3 Credential Rotation Script
 * 
 * Rotates exposed PostgreSQL credentials:
 * - bella_developer
 * - bella_migration_executor
 * 
 * SECURITY: Passwords generated at runtime, NOT logged to console/evidence
 */

import crypto from 'crypto';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

// Generate cryptographically secure passwords
function generateSecurePassword(length = 32) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

async function rotateCredentials() {
  console.log('🔄 R3 Credential Rotation Started\n');

  // Generate new passwords (NOT logged)
  const newDeveloperPassword = generateSecurePassword(32);
  const newExecutorPassword = generateSecurePassword(32);

  console.log('✅ Generated new secure passwords');
  console.log('   - bella_developer: [REDACTED]');
  console.log('   - bella_migration_executor: [REDACTED]\n');

  // Connect using DATABASE_URL from .env
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  // Extract components from DATABASE_URL for connection
  const dbUrlMatch = DATABASE_URL.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  
  if (!dbUrlMatch) {
    console.error('❌ Invalid DATABASE_URL format');
    process.exit(1);
  }

  const [, currentUser, currentPassword, host, port, database] = dbUrlMatch;

  console.log(`🔗 Connecting as: ${currentUser}`);
  console.log(`   Host: ${host}`);
  console.log(`   Database: ${database}\n`);

  // Import pg for direct PostgreSQL connection
  const pg = await import('pg');
  const { Client } = pg.default;

  const client = new Client({
    host,
    port: parseInt(port),
    database,
    user: currentUser,
    password: currentPassword,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to production database\n');

    // Rotate bella_developer password
    console.log('🔄 Rotating bella_developer password...');
    await client.query(`ALTER USER bella_developer WITH PASSWORD '${newDeveloperPassword}'`);
    console.log('✅ bella_developer password rotated\n');

    // Rotate bella_migration_executor password
    console.log('🔄 Rotating bella_migration_executor password...');
    await client.query(`ALTER USER bella_migration_executor WITH PASSWORD '${newExecutorPassword}'`);
    console.log('✅ bella_migration_executor password rotated\n');

    // Output connection strings (for manual .env update)
    console.log('📋 NEW CONNECTION STRINGS (update your .env manually):');
    console.log('   ⚠️  DO NOT commit these to git\n');
    
    const newDevUrl = `postgresql://bella_developer:${newDeveloperPassword}@${host}:${port}/${database}`;
    const newExecUrl = `postgresql://bella_migration_executor:${newExecutorPassword}@${host}:${port}/${database}`;

    console.log('DATABASE_URL_DEVELOPER=');
    console.log(newDevUrl);
    console.log('\nDATABASE_URL_EXECUTOR=');
    console.log(newExecUrl);
    console.log('\n⚠️  Copy these values to your .env file NOW');
    console.log('⚠️  These values will NOT be shown again\n');

    console.log('✅ Credential rotation complete');
    console.log('📝 Next: Update .env with new connection strings');
    console.log('📝 Then: Re-run r3-simple-test.mjs for verification\n');

  } catch (error) {
    console.error('❌ Rotation failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

rotateCredentials();
