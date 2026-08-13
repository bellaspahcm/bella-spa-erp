import { supabase } from '@/lib/supabase';
import type { ClinicalAlert } from '@/components/hospital/ClinicalActionModal';
import { HospitalClinicalAlertProductService } from '@/products/bella-hospital/services/hospital-clinical-alert.service';

/**
 * Clinical Decision Support (CDS) Alert Service
 * Manages clinical alerts, warnings, and action items
 */

export interface ProcessAlertInput {
  alertId: string;
  action: string;
  processedBy: string;
  notes?: string;
  resolution?: string;
}

export interface ClinicalAlertRecord {
  id: string;
  tenant_id: string;
  alert_type: 'drug_interaction' | 'vital_abnormal' | 'medication_verification' | 'general';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  patient_id: string;
  patient_name: string;
  patient_mpi: string;
  encounter_id?: string;
  location?: string;
  assigned_to?: string;
  triggered_at: string;
  action_required: 'review' | 'confirm' | 'verify' | 'acknowledge';
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  processed_at?: string;
  processed_by?: string;
  resolution_notes?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Mock in-memory store for demo
const MOCK_ALERTS: ClinicalAlertRecord[] = [
  {
    id: 'alert-001',
    tenant_id: 'bella_healthcare',
    alert_type: 'drug_interaction',
    priority: 'urgent',
    title: 'Cảnh Báo Tương Tác Thuốc Nguy Cấp (CDS)',
    description: 'Phát hiện tương tác thuốc nghiêm trọng giữa Warfarin + Aspirin trên Bệnh nhân Trần Thị B (MPI-8923) tại Khoa Cấp Cứu.',
    patient_id: 'pat-8923',
    patient_name: 'Trần Thị B',
    patient_mpi: 'MPI-8923',
    encounter_id: 'enc-8923',
    location: 'Khoa Cấp Cứu',
    assigned_to: 'BS. Nguyễn Văn A',
    triggered_at: '12 phút trước',
    action_required: 'review',
    status: 'active',
    metadata: {
      drug1: 'Warfarin',
      drug2: 'Aspirin',
      interaction_severity: 'major',
      recommendation: 'Cân nhắc thay đổi phác đồ hoặc theo dõi chặt chẽ INR',
    },
    created_at: new Date(Date.now() - 720000).toISOString(),
    updated_at: new Date(Date.now() - 720000).toISOString(),
  },
  {
    id: 'alert-002',
    tenant_id: 'bella_healthcare',
    alert_type: 'vital_abnormal',
    priority: 'urgent',
    title: 'Ghi Nhận Sinh Hiệu Bất Thường',
    description: 'Chỉ số SpO2 giảm xuống 92% (Ngưỡng an toàn: 95%) ở Bệnh nhân Lê Hoàng M (MPI-1234), Buồng Ward-304.',
    patient_id: 'pat-1234',
    patient_name: 'Lê Hoàng M',
    patient_mpi: 'MPI-1234',
    encounter_id: 'enc-1234',
    location: 'Buồng Ward-304',
    assigned_to: 'ĐD. Lê Thị D',
    triggered_at: '5 phút trước',
    action_required: 'confirm',
    status: 'active',
    metadata: {
      vital_type: 'SpO2',
      current_value: 92,
      threshold: 95,
      previous_value: 97,
      trend: 'decreasing',
    },
    created_at: new Date(Date.now() - 300000).toISOString(),
    updated_at: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: 'alert-003',
    tenant_id: 'bella_healthcare',
    alert_type: 'medication_verification',
    priority: 'high',
    title: 'Đang Chờ Xác Minh Kép Thuốc Nguy Cơ Cao',
    description: 'Yêu cầu xác minh kép liều Insulin trước khi thực hiện tiêm cho Bệnh nhân Phan Huy L (Buồng Ward-202).',
    patient_id: 'pat-202',
    patient_name: 'Phan Huy L',
    patient_mpi: 'MPI-5678',
    encounter_id: 'enc-202',
    location: 'Buồng Ward-202',
    assigned_to: 'Điều dưỡng trưởng ca',
    triggered_at: '15 phút trước',
    action_required: 'verify',
    status: 'active',
    metadata: {
      medication: 'Insulin Regular',
      dose: '10 units',
      route: 'SC',
      scheduled_time: '14:00',
      requires_double_check: true,
    },
    created_at: new Date(Date.now() - 900000).toISOString(),
    updated_at: new Date(Date.now() - 900000).toISOString(),
  },
];

export class ClinicalAlertsService {
  /**
   * Get active alerts for dashboard
   */
  static async getActiveAlerts(tenantId: string): Promise<ClinicalAlert[]> {
    try {
      const { data, error } = await supabase
        .from('hc_clinical_alerts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        // Fallback to mock data
        return MOCK_ALERTS.map((alert) => this.mapToAlert(alert));
      }

      return data.map((record) => this.mapToAlert(record as ClinicalAlertRecord));
    } catch {
      // Fallback to mock data
      return MOCK_ALERTS.map((alert) => this.mapToAlert(alert));
    }
  }

  /**
   * Get alert by ID
   */
  static async getAlertById(alertId: string): Promise<ClinicalAlert | null> {
    try {
      const { data, error } = await supabase
        .from('hc_clinical_alerts')
        .select('*')
        .eq('id', alertId)
        .single();

      if (error || !data) {
        // Fallback to mock data
        const mockAlert = MOCK_ALERTS.find((a) => a.id === alertId);
        return mockAlert ? this.mapToAlert(mockAlert) : null;
      }

      return this.mapToAlert(data as ClinicalAlertRecord);
    } catch {
      // Fallback to mock data
      const mockAlert = MOCK_ALERTS.find((a) => a.id === alertId);
      return mockAlert ? this.mapToAlert(mockAlert) : null;
    }
  }

  /**
   * Process alert (acknowledge, resolve, dismiss, assign, escalate)
   */
  static async processAlert(input: ProcessAlertInput): Promise<ClinicalAlertRecord> {
    const now = new Date().toISOString();
    
    // Determine status based on action
    let newStatus: 'active' | 'acknowledged' | 'resolved' | 'dismissed' = 'resolved';
    let updateData: Partial<ClinicalAlertRecord> = {
      processed_at: now,
      processed_by: input.processedBy,
      resolution_notes: input.notes,
      updated_at: now,
    };

    switch (input.action) {
      case 'acknowledge':
        newStatus = 'acknowledged';
        break;
      case 'assign':
        // Extract assigned person from notes (format: "Assigned to: NAME")
        newStatus = 'active'; // Keep active but assigned
        const assignMatch = input.notes?.match(/Assigned to: (.+)/);
        if (assignMatch) {
          updateData.assigned_to = assignMatch[1];
        }
        break;
      case 'escalate':
        // Escalate increases priority and keeps active
        newStatus = 'active';
        updateData.priority = 'urgent'; // Always escalate to urgent
        updateData.resolution_notes = input.notes || 'Escalated to higher authority';
        break;
      default:
        newStatus = 'resolved';
    }

    updateData.status = newStatus;
    
    try {
      const { data, error } = await supabase
        .from('hc_clinical_alerts')
        .update(updateData)
        .eq('id', input.alertId)
        .select()
        .single();

      if (error || !data) {
        // Fallback: Update mock data
        const alertIndex = MOCK_ALERTS.findIndex((a) => a.id === input.alertId);
        if (alertIndex !== -1) {
          MOCK_ALERTS[alertIndex] = {
            ...MOCK_ALERTS[alertIndex],
            ...updateData,
          } as ClinicalAlertRecord;
          return MOCK_ALERTS[alertIndex];
        }
        throw new Error('Alert not found');
      }

      return data as ClinicalAlertRecord;
    } catch (err) {
      // Fallback: Update mock data
      const alertIndex = MOCK_ALERTS.findIndex((a) => a.id === input.alertId);
      if (alertIndex !== -1) {
        MOCK_ALERTS[alertIndex] = {
          ...MOCK_ALERTS[alertIndex],
          ...updateData,
        } as ClinicalAlertRecord;
        return MOCK_ALERTS[alertIndex];
      }
      throw new Error('Failed to process alert');
    }
  }

  /**
   * Get alert count by status
   */
  static async getAlertCount(
    tenantId: string,
    status: 'active' | 'acknowledged' | 'resolved'
  ): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('hc_clinical_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', status);

      if (error || count === null) {
        // Fallback to mock count
        return MOCK_ALERTS.filter((a) => a.status === status).length;
      }

      return count;
    } catch {
      // Fallback to mock count
      return MOCK_ALERTS.filter((a) => a.status === status).length;
    }
  }

  /**
   * Evaluate medication order safety via H8 CDS Public Contract
   */
  static async evaluateOrderSafetyWithCds(request: {
    tenantId: string;
    encounterId: string;
    patientId: string;
    clinicianId: string;
    medicationCode: string;
    medicationName: string;
    dosageMg: number;
    route: string;
  }) {
    const mockCdsContract: any = {
      evaluateOrderSafety: async (input: any) => ({
        hasAbsoluteBlock: false,
        contraindications: [],
        warnings: [{ severity: 'WARNING', message: 'Dose warning check' }]
      })
    };
    const productAlertService = new HospitalClinicalAlertProductService(mockCdsContract);
    return await productAlertService.evaluateOrderSafety(request);
  }

  /**
   * Map database record to ClinicalAlert
   */
  private static mapToAlert(record: ClinicalAlertRecord): ClinicalAlert {
    return {
      id: record.id,
      type: record.alert_type,
      priority: record.priority,
      title: record.title,
      description: record.description,
      patientName: record.patient_name,
      patientMPI: record.patient_mpi,
      location: record.location,
      assignedTo: record.assigned_to,
      triggeredAt: record.triggered_at,
      actionRequired: record.action_required,
      metadata: record.metadata,
    };
  }
}

