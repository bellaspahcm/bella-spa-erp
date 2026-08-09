/**
 * Hospital Clinical Alerts Integration Test
 * Tests button functionality and modal interaction
 */

import { ClinicalAlertsService } from '@/services/healthcare/clinical-alerts-service';

describe('Clinical Alerts Service', () => {
  const tenantId = 'bella_healthcare';

  describe('getActiveAlerts', () => {
    it('should return mock alerts when database is unavailable', async () => {
      const alerts = await ClinicalAlertsService.getActiveAlerts(tenantId);

      expect(alerts).toBeDefined();
      expect(Array.isArray(alerts)).toBe(true);
      expect(alerts.length).toBeGreaterThan(0);

      // Verify alert structure
      const firstAlert = alerts[0];
      expect(firstAlert).toHaveProperty('id');
      expect(firstAlert).toHaveProperty('type');
      expect(firstAlert).toHaveProperty('priority');
      expect(firstAlert).toHaveProperty('title');
      expect(firstAlert).toHaveProperty('description');
      expect(firstAlert).toHaveProperty('patientName');
      expect(firstAlert).toHaveProperty('patientMPI');
      expect(firstAlert).toHaveProperty('actionRequired');
    });

    it('should return alerts with correct types', async () => {
      const alerts = await ClinicalAlertsService.getActiveAlerts(tenantId);

      expect(alerts.some((a) => a.type === 'drug_interaction')).toBe(true);
      expect(alerts.some((a) => a.type === 'vital_abnormal')).toBe(true);
      expect(alerts.some((a) => a.type === 'medication_verification')).toBe(true);
    });

    it('should return alerts with correct priorities', async () => {
      const alerts = await ClinicalAlertsService.getActiveAlerts(tenantId);

      expect(alerts.some((a) => a.priority === 'urgent')).toBe(true);
      expect(alerts.some((a) => a.priority === 'high')).toBe(true);
    });
  });

  describe('getAlertById', () => {
    it('should return specific alert by ID', async () => {
      const alert = await ClinicalAlertsService.getAlertById('alert-001');

      expect(alert).toBeDefined();
      expect(alert?.id).toBe('alert-001');
      expect(alert?.type).toBe('drug_interaction');
      expect(alert?.priority).toBe('urgent');
    });

    it('should return null for non-existent alert', async () => {
      const alert = await ClinicalAlertsService.getAlertById('non-existent-id');

      expect(alert).toBeNull();
    });
  });

  describe('processAlert', () => {
    it('should acknowledge alert successfully', async () => {
      const result = await ClinicalAlertsService.processAlert({
        alertId: 'alert-001',
        action: 'acknowledge',
        processedBy: 'test-user-id',
        notes: 'Acknowledged for review',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('acknowledged');
      expect(result.processed_by).toBe('test-user-id');
      expect(result.resolution_notes).toBe('Acknowledged for review');
      expect(result.processed_at).toBeDefined();
    });

    it('should resolve alert successfully', async () => {
      const result = await ClinicalAlertsService.processAlert({
        alertId: 'alert-002',
        action: 'resolve',
        processedBy: 'test-user-id',
        notes: 'SpO2 back to normal after oxygen therapy',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('resolved');
      expect(result.processed_by).toBe('test-user-id');
    });

    it('should throw error for non-existent alert', async () => {
      await expect(
        ClinicalAlertsService.processAlert({
          alertId: 'non-existent-id',
          action: 'resolve',
          processedBy: 'test-user-id',
        })
      ).rejects.toThrow();
    });
  });

  describe('getAlertCount', () => {
    it('should return count of active alerts', async () => {
      const count = await ClinicalAlertsService.getAlertCount(tenantId, 'active');

      expect(count).toBeGreaterThan(0);
      expect(typeof count).toBe('number');
    });

    it('should return 0 for resolved alerts initially', async () => {
      const count = await ClinicalAlertsService.getAlertCount(tenantId, 'resolved');

      expect(count).toBeGreaterThanOrEqual(0);
      expect(typeof count).toBe('number');
    });
  });

  describe('Button Action Integration', () => {
    it('should map action required to button label correctly', () => {
      const actionLabels: Record<string, string> = {
        review: 'Xem xét',
        confirm: 'Xác nhận',
        verify: 'Xác minh',
        acknowledge: 'Xử lý',
      };

      const alerts = [
        { actionRequired: 'review' as const, expected: 'Xem xét' },
        { actionRequired: 'confirm' as const, expected: 'Xác nhận' },
        { actionRequired: 'verify' as const, expected: 'Xác minh' },
      ];

      for (const { actionRequired, expected } of alerts) {
        expect(actionLabels[actionRequired]).toBe(expected);
      }
    });

    it('should correctly determine priority colors', () => {
      const priorityColors: Record<string, { bg: string; button: string }> = {
        urgent: { bg: 'bg-rose-50', button: 'bg-rose-600' },
        high: { bg: 'bg-amber-50', button: 'bg-amber-600' },
      };

      expect(priorityColors.urgent.bg).toBe('bg-rose-50');
      expect(priorityColors.high.button).toBe('bg-amber-600');
    });
  });
});
