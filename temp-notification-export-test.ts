// Temporary test file to verify notification exports
import type { 
  NotificationEvent, 
  RecipientType, 
  NotificationChannel, 
  NotificationPriority 
} from './src/core/types';

// Test that types are correctly exported and usable
const testNotification: NotificationEvent = {
  id: 'test-id',
  tenantId: 'tenant-id',
  moduleId: 'spa',
  type: 'booking_confirmed',
  recipientId: 'recipient-id',
  recipientType: 'customer' as RecipientType,
  channels: ['in_app', 'email'] as NotificationChannel[],
  priority: 'high' as NotificationPriority,
  title: 'Test Notification',
  message: 'This is a test',
  metadata: {},
  createdAt: new Date().toISOString(),
};

console.log('Notification exports verified:', testNotification);
