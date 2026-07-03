/**
 * Clear Intelligence Layer cache
 * Force refresh all cached data
 */

console.log('🗑️  Clearing Intelligence Layer cache...\n');

// In production, this would call:
// POST /api/intelligence/admin/clear-cache

// For now, just restart dev server to clear Memory cache
console.log('✅ To clear cache:');
console.log('   1. Restart dev server (Ctrl+C then npm run dev)');
console.log('   2. OR wait 2.5 minutes for Memory cache to expire');
console.log('   3. OR click "Làm mới" button on dashboard');
console.log('\n💡 Redis cache will auto-expire or can be flushed with: redis-cli FLUSHDB');
