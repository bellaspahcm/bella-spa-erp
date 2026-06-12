/**
 * Migration script: encrypt existing plaintext Telegram bot tokens in ai_agent_configs.
 * Run once after deploying H4 fix.
 *
 * Usage: node scripts/encrypt_telegram_tokens.mjs
 *
 * Logic:
 *   - Đọc mọi row có telegram_bot_token NOT NULL
 *   - Phát hiện token format: bot tokens Telegram dạng `123456:ABC...` (có dấu `:` ở giữa)
 *   - Nếu format này (plaintext) → encrypt + update
 *   - Nếu format `hex:hex:hex` (AES output) → đã encrypted, skip
 */

import { createClient } from '@supabase/supabase-js';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { readFileSync } from 'fs';

const env = {};
readFileSync('.env.local', 'utf-8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
});

const getEncryptionKey = () => {
  const raw = env.DB_ENCRYPTION_KEY;
  if (!raw) throw new Error('DB_ENCRYPTION_KEY missing in .env.local');
  return createHash('sha256').update(raw).digest();
};

function encrypt(text) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${enc}`;
}

function isEncrypted(s) {
  // AES output format: hex:hex:hex (3 hex segments)
  const parts = s.split(':');
  return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p));
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: configs, error } = await admin
  .from('ai_agent_configs')
  .select('id, tenant_id, telegram_bot_token');

if (error) {
  console.error('❌ Failed to fetch configs:', error);
  process.exit(1);
}

let encrypted = 0;
let skipped = 0;
for (const cfg of configs || []) {
  if (!cfg.telegram_bot_token) {
    skipped++;
    continue;
  }
  if (isEncrypted(cfg.telegram_bot_token)) {
    console.log(`⏭️  ${cfg.id}: already encrypted, skip`);
    skipped++;
    continue;
  }
  const encryptedToken = encrypt(cfg.telegram_bot_token);
  const { error: updErr } = await admin
    .from('ai_agent_configs')
    .update({ telegram_bot_token: encryptedToken })
    .eq('id', cfg.id);
  if (updErr) {
    console.error('❌ %s: failed to update:', cfg.id, updErr);
  } else {
    console.log(`✅ ${cfg.id}: encrypted plaintext credential`);
    encrypted++;
  }
}

console.log(`\nDone. Encrypted: ${encrypted}, skipped (already encrypted or null): ${skipped}.`);
