import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

async function main() {
  console.log('🔄 Clearing cache for hospital testing...');
  
  if (!url || !token) {
    console.log('⚠️ Redis configuration not found in .env.local, skipping L2 cache clearance.');
    return;
  }
  
  const redis = new Redis({ url, token });
  
  const tenantId = 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d';
  const tenantKey = `tenant:${tenantId}`;
  
  // Clear tenant cache
  const deletedTenant = await redis.del(tenantKey);
  console.log(`Deleted tenant cache key: ${tenantKey} (result: ${deletedTenant})`);
  
  // Clear user cache for the test admin users
  const userIds = [
    '242288f2-1246-44ed-bb5e-f1b43c0886b3', // Bác sĩ Nguyễn Văn An
    '3246c600-ff6e-4e4f-9320-8cf70d223040'  // Bella Hospital Admin (hospital.test@bellaspa.vn)
  ];
  
  for (const userId of userIds) {
    const userKey = `user:${userId}`;
    const deletedUser = await redis.del(userKey);
    console.log(`Deleted user cache key: ${userKey} (result: ${deletedUser})`);
  }
  
  console.log('✅ Cache cleared successfully.');
}

main().catch(err => {
  console.error('❌ Failed to clear cache:', err);
});
