#!/usr/bin/env node
/**
 * R3 Secure Password Generator
 * 
 * Generates cryptographically secure passwords for credential rotation
 * Output is meant to be used once and not logged permanently
 */

import crypto from 'crypto';

function generateSecurePassword(length = 32) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

console.log('🔐 R3 Secure Password Generator\n');
console.log('Generated passwords (use immediately, do not save to files):\n');
console.log(`Password 1 (bella_developer):`);
console.log(generateSecurePassword(32));
console.log(`\nPassword 2 (bella_migration_executor):`);
console.log(generateSecurePassword(32));
console.log('\n⚠️  Copy these NOW - they will not be shown again');
console.log('⚠️  Update r3-rotate-credentials.sql with these values');
console.log('⚠️  Then run the SQL in Supabase Dashboard SQL Editor\n');
