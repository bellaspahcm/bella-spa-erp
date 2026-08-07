/**
 * Event Wiring: Nursing Engine → AI Critical Alerts
 * Wire VitalsRecorded event to check critical thresholds and trigger AI alerts
 */

import { eventBus } from '../event-bus.service';
import { VitalsRecordedPayload } from '../types';
import { createClient } from '@/lib/supabase/client';

// Critical thresholds (TODO: Move to tenant config)
const CRITICAL_THRESHOLDS = {
  bloodPressureSystolic: { min: 90, max: 180 },
  bloodPressureDiastolic: { min: 60, max: 120 },
  heartRate: { min: 50, max: 120 },
  temperature: { min: 35.5, max: 39.0 },
  respiratoryRate: { min: 12, max: 25 },
  oxygenSaturation: { min: 90, max: 100 },
};

interface CriticalFinding {
  vital: string;
  value: number;
  threshold: string;
  severity: 'warning' | 'critical';
}

/**
 * When vitals are recorded, check for critical values and create AI alerts
 */
export function wireVitalsToAIAlerts(): () => void {
  return eventBus.subscribe<VitalsRecordedPayload>(
    'VitalsRecorded',
    async (event) => {
      console.log('[Wiring] VitalsRecorded → AI Alerts: Checking thresholds', {
        patientId: event.payload.patientId,
        vitals: event.payload,
      });

      try {
        // Check for critical values
        const criticalFindings: CriticalFinding[] = [];

        // Blood Pressure Systolic
        if (event.payload.bloodPressureSystolic) {
          const value = event.payload.bloodPressureSystolic;
          if (value < CRITICAL_THRESHOLDS.bloodPressureSystolic.min) {
            criticalFindings.push({
              vital: 'Blood Pressure (Systolic)',
              value,
              threshold: `< ${CRITICAL_THRESHOLDS.bloodPressureSystolic.min} mmHg`,
              severity: value < 80 ? 'critical' : 'warning',
            });
          } else if (value > CRITICAL_THRESHOLDS.bloodPressureSystolic.max) {
            criticalFindings.push({
              vital: 'Blood Pressure (Systolic)',
              value,
              threshold: `> ${CRITICAL_THRESHOLDS.bloodPressureSystolic.max} mmHg`,
              severity: value > 200 ? 'critical' : 'warning',
            });
          }
        }

        // Blood Pressure Diastolic
        if (event.payload.bloodPressureDiastolic) {
          const value = event.payload.bloodPressureDiastolic;
          if (value < CRITICAL_THRESHOLDS.bloodPressureDiastolic.min) {
            criticalFindings.push({
              vital: 'Blood Pressure (Diastolic)',
              value,
              threshold: `< ${CRITICAL_THRESHOLDS.bloodPressureDiastolic.min} mmHg`,
              severity: 'warning',
            });
          } else if (value > CRITICAL_THRESHOLDS.bloodPressureDiastolic.max) {
            criticalFindings.push({
              vital: 'Blood Pressure (Diastolic)',
              value,
              threshold: `> ${CRITICAL_THRESHOLDS.bloodPressureDiastolic.max} mmHg`,
              severity: 'critical',
            });
          }
        }

        // Heart Rate
        if (event.payload.heartRate) {
          const value = event.payload.heartRate;
          if (value < CRITICAL_THRESHOLDS.heartRate.min) {
            criticalFindings.push({
              vital: 'Heart Rate',
              value,
              threshold: `< ${CRITICAL_THRESHOLDS.heartRate.min} bpm`,
              severity: value < 40 ? 'critical' : 'warning',
            });
          } else if (value > CRITICAL_THRESHOLDS.heartRate.max) {
            criticalFindings.push({
              vital: 'Heart Rate',
              value,
              threshold: `> ${CRITICAL_THRESHOLDS.heartRate.max} bpm`,
              severity: value > 140 ? 'critical' : 'warning',
            });
          }
        }

        // Temperature
        if (event.payload.temperature) {
          const value = event.payload.temperature;
          if (value < CRITICAL_THRESHOLDS.temperature.min) {
            criticalFindings.push({
              vital: 'Temperature',
              value,
              threshold: `< ${CRITICAL_THRESHOLDS.temperature.min}°C`,
              severity: value < 35 ? 'critical' : 'warning',
            });
          } else if (value > CRITICAL_THRESHOLDS.temperature.max) {
            criticalFindings.push({
              vital: 'Temperature',
              value,
              threshold: `> ${CRITICAL_THRESHOLDS.temperature.max}°C`,
              severity: value > 40 ? 'critical' : 'warning',
            });
          }
        }

        // Respiratory Rate
        if (event.payload.respiratoryRate) {
          const value = event.payload.respiratoryRate;
          if (value < CRITICAL_THRESHOLDS.respiratoryRate.min) {
            criticalFindings.push({
              vital: 'Respiratory Rate',
              value,
              threshold: `< ${CRITICAL_THRESHOLDS.respiratoryRate.min} breaths/min`,
              severity: 'warning',
            });
          } else if (value > CRITICAL_THRESHOLDS.respiratoryRate.max) {
            criticalFindings.push({
              vital: 'Respiratory Rate',
              value,
              threshold: `> ${CRITICAL_THRESHOLDS.respiratoryRate.max} breaths/min`,
              severity: 'critical',
            });
          }
        }

        // Oxygen Saturation
        if (event.payload.oxygenSaturation) {
          const value = event.payload.oxygenSaturation;
          if (value < CRITICAL_THRESHOLDS.oxygenSaturation.min) {
            criticalFindings.push({
              vital: 'Oxygen Saturation',
              value,
              threshold: `< ${CRITICAL_THRESHOLDS.oxygenSaturation.min}%`,
              severity: value < 85 ? 'critical' : 'warning',
            });
          }
        }

        // If no critical findings, exit
        if (criticalFindings.length === 0) {
          console.log('[Wiring] No critical findings - vitals within normal range');
          return;
        }

        // Create AI alert for critical findings
        const supabase = createClient();

        const alertMessage = criticalFindings
          .map((f) => `${f.vital}: ${f.value} (${f.threshold})`)
          .join(', ');

        const highestSeverity = criticalFindings.some((f) => f.severity === 'critical')
          ? 'critical'
          : 'warning';

        const { data, error } = await supabase
          .from('ai_alerts')
          .insert({
            tenant_id: event.tenantId,
            patient_id: event.payload.patientId,
            encounter_id: event.payload.encounterId,
            alert_type: 'critical_vitals',
            severity: highestSeverity,
            title: 'Critical Vitals Detected',
            message: `${criticalFindings.length} critical vital sign(s) detected: ${alertMessage}`,
            source: 'NursingEngine',
            metadata: {
              vitalsId: event.payload.vitalsId,
              findings: criticalFindings,
              recordedBy: event.payload.recordedBy,
              recordedAt: event.payload.recordedAt,
              eventId: event.eventId,
            },
            status: 'active',
            requires_action: highestSeverity === 'critical',
          })
          .select()
          .single();

        if (error) {
          console.error('[Wiring] Failed to create AI alert:', error);
          return;
        }

        console.log(`[Wiring] AI alert created (${highestSeverity}):`, data.id);

        // TODO: Publish CriticalAlertCreated event to notify nursing staff
      } catch (error) {
        console.error('[Wiring] Error in VitalsRecorded → AI Alerts wiring:', error);
      }
    }
  );
}
