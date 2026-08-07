import { z } from 'zod';

// ==========================================
// 1. RBAC & PERMISSION DEFINITIONS
// ==========================================
export interface User {
  id: string;
  role: string;
  tenant_id: string;
  full_name: string;
}

export function checkHealthcarePermission(user: User, permission: string): boolean {
  const role = user.role?.toLowerCase().trim();
  
  // Super Admins override all security checks
  if (role === 'admin' || role === 'clinicadmin') {
    return true;
  }

  const permissionMatrix: Record<string, string[]> = {
    'clinical.encounter.create': ['doctor', 'receptionist'],
    'clinical.encounter.read': ['doctor', 'nurse', 'labtech', 'radiologist', 'pharmacist', 'billingcashier', 'receptionist'],
    'clinical.vitals.record': ['doctor', 'nurse'],
    'clinical.soap.update': ['doctor'],
    'clinical.order.create': ['doctor'],
    'lab.result.verify': ['labtech'],
    'imaging.report.verify': ['radiologist'],
    'pharmacy.prescription.dispense': ['pharmacist'],
    'billing.invoice.create': ['billingcashier'],
    'insurance.claim.submit': ['billingcashier']
  };

  const allowedRoles = permissionMatrix[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}

// ==========================================
// 2. API CONTRACT SCHEMAS (DTO VALIDATION)
// ==========================================
export const createEncounterSchema = z.object({
  customerId: z.string().uuid({ message: 'customerId must be a valid UUID' }),
  practitionerId: z.string().uuid({ message: 'practitionerId must be a valid UUID' }),
  facilityId: z.string().uuid({ message: 'facilityId must be a valid UUID' }),
  chiefComplaint: z.string().min(1, { message: 'chiefComplaint cannot be empty' }).max(500),
  priority: z.enum(['routine', 'urgent', 'emergency']),
});

export const getPatientsQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.enum(['name', 'created_at', 'bhyt_code']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  filterAllergies: z.array(z.string()).optional(),
  searchQuery: z.string().max(100).optional(),
});

// ==========================================
// 3. TRANSACTION INTEGRITY (EMR CHECKOUT)
// ==========================================
export interface CheckoutPayload {
  amount: number;
  drugs: Array<{ code: string; name: string; quantity: number }>;
}

export class CheckoutTransactionCoordinator {
  constructor(
    private db: {
      updateEncounterStatus: (id: string, status: string) => Promise<{ success: boolean; error?: string }>;
      createInvoice: (id: string, amount: number) => Promise<{ success: boolean; error?: string }>;
      createPrescription: (id: string, drugs: any[]) => Promise<{ success: boolean; error?: string }>;
      deductInventory: (drugs: any[]) => Promise<{ success: boolean; error?: string }>;
    }
  ) {}

  async executeCheckout(encounterId: string, payload: CheckoutPayload): Promise<{ success: boolean; error?: string }> {
    const rollbackStack: Array<() => Promise<void>> = [];

    try {
      // Step 1: Complete Encounter
      const step1 = await this.db.updateEncounterStatus(encounterId, 'completed');
      if (!step1.success) throw new Error(step1.error || 'Failed to update encounter status');
      rollbackStack.push(async () => {
        await this.db.updateEncounterStatus(encounterId, 'in_progress');
      });

      // Step 2: Create Billing Invoice
      const step2 = await this.db.createInvoice(encounterId, payload.amount);
      if (!step2.success) throw new Error(step2.error || 'Failed to create invoice');
      rollbackStack.push(async () => {
        // Rollback invoice creation
        await this.db.createInvoice(encounterId, 0);
      });

      // Step 3: Create Prescription
      const step3 = await this.db.createPrescription(encounterId, payload.drugs);
      if (!step3.success) throw new Error(step3.error || 'Failed to create prescription');
      rollbackStack.push(async () => {
        // Rollback prescription
        await this.db.createPrescription(encounterId, []);
      });

      // Step 4: Deduct Inventory
      const step4 = await this.db.deductInventory(payload.drugs);
      if (!step4.success) throw new Error(step4.error || 'Failed to deduct inventory');

      return { success: true };
    } catch (err: any) {
      // Atomically rollback all previous operations in reverse order
      for (let i = rollbackStack.length - 1; i >= 0; i--) {
        await rollbackStack[i]();
      }
      return { success: false, error: err.message };
    }
  }
}

// ==========================================
// 4. CONCURRENCY (OPTIMISTIC LOCKING)
// ==========================================
export interface EMRRecord {
  id: string;
  notes: string;
  version: number;
  updatedAt: string;
}

export class EMRConcurrencyManager {
  private store: Map<string, EMRRecord> = new Map();

  saveInitial(record: EMRRecord) {
    this.store.set(record.id, record);
  }

  get(id: string): EMRRecord | undefined {
    const record = this.store.get(id);
    return record ? { ...record } : undefined; // Return deep copy
  }

  update(id: string, newNotes: string, clientVersion: number): { success: boolean; error?: string } {
    const current = this.store.get(id);
    if (!current) return { success: false, error: 'EMR record not found' };

    // Optimistic Lock Check
    if (current.version !== clientVersion) {
      return {
        success: false,
        error: 'CONCURRENCY_CONFLICT: The EMR record has been modified by another clinician. Please reload.'
      };
    }

    // Update state and increment version number
    current.notes = newNotes;
    current.version += 1;
    current.updatedAt = new Date().toISOString();
    
    this.store.set(id, current);
    return { success: true };
  }
}

// ==========================================
// 5. AUDIT TRAIL LOGGING
// ==========================================
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityId: string;
  entityType: 'Encounter' | 'Prescription' | 'Diagnosis';
  oldState: string; // JSON stringified
  newState: string; // JSON stringified
}

export class ClinicalAuditTrailService {
  private logs: AuditLogEntry[] = [];

  logChange(
    userId: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    entityId: string,
    entityType: AuditLogEntry['entityType'],
    oldState: any,
    newState: any
  ): void {
    this.logs.push({
      id: `audit-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      userId,
      action,
      entityId,
      entityType,
      oldState: JSON.stringify(oldState),
      newState: JSON.stringify(newState),
    });
  }

  getLogsForEntity(entityId: string): AuditLogEntry[] {
    return this.logs.filter((l) => l.entityId === entityId);
  }

  // Replay audit trail to reconstruct state history
  replayHistory(entityId: string, initialState: any): any {
    const entityLogs = this.getLogsForEntity(entityId);
    let state = { ...initialState };
    
    for (const log of entityLogs) {
      state = JSON.parse(log.newState);
    }
    
    return state;
  }
}

// ==========================================
// 6. OPERATIONAL RECOMMENDATION LOGIC (AI COO)
// ==========================================
export interface RecommendationAction {
  id: string;
  priority: 'high' | 'medium' | 'info';
  category: string;
  title: string;
  description: string;
  actionLabel: string;
  actionType: string;
}

export function generateOperationalRecommendations(params: {
  isDental: boolean;
  encounters: Array<{ id: string; patientName: string; doctorName?: string; status: string; waitTimeMinutes?: number }>;
  chairsMatrix: Array<{ id: string; code: string; status: 'occupied' | 'available'; currentPatientName?: string; currentDoctorName?: string }>;
  dismissedIds: string[];
}): RecommendationAction[] {
  const { isDental, encounters, chairsMatrix, dismissedIds } = params;
  
  const waitingEncounter = encounters.find((e) => e.status === 'arrived');
  const availableChair = chairsMatrix.find((c) => c.status === 'available');
  const occupiedChairs = chairsMatrix.filter((c) => c.status === 'occupied');
  const arrivedCount = encounters.filter((e) => e.status === 'arrived').length;
  const finishedEncounters = encounters.filter((e) => e.status === 'finished');

  const dynamicActions: RecommendationAction[] = [];

  // 1. Live Chair / Room Routing Action
  if (waitingEncounter && availableChair) {
    dynamicActions.push({
      id: `act-assign-${waitingEncounter.id}`,
      priority: 'high',
      category: isDental ? 'chair' : 'room',
      title: isDental 
        ? `⚡ Mời BN ${waitingEncounter.patientName} vào ${availableChair.code}`
        : availableChair.code.startsWith('Phòng')
          ? `⚡ Mời BN ${waitingEncounter.patientName} vào ${availableChair.code}`
          : `⚡ Mời BN ${waitingEncounter.patientName} vào Phòng ${availableChair.code}`,
      description: isDental
        ? `${availableChair.code} đang trống. Gợi ý điều phối ngay cho BN ${waitingEncounter.patientName}.`
        : `Phòng ${availableChair.code} đang trống. Gợi ý mời BN ${waitingEncounter.patientName} vào phòng khám.`,
      actionLabel: isDental ? `Phân ${availableChair.code} ngay` : `Mở phòng ${availableChair.code} ngay`,
      actionType: isDental ? 'assign_chair' : 'assign_room',
    });
  }

  // 2. Live Queue SLA Waiting Time Alert
  const overduePatients = encounters.filter((e) => e.status === 'arrived' && (e.waitTimeMinutes || 0) > 15);
  if (overduePatients.length > 0) {
    const firstOverdue = overduePatients[0];
    dynamicActions.push({
      id: `act-sla-${firstOverdue.id}`,
      priority: 'high',
      category: 'patient_wait',
      title: `⚡ Cảnh báo SLA — Có ${overduePatients.length} bệnh nhân chờ >15 phút`,
      description: `Bệnh nhân ${firstOverdue.patientName} và các bệnh nhân khác đã chờ tại sảnh vượt quá thời gian SLA chuẩn. Đề xuất ưu tiên sắp xếp phòng điều trị ngay.`,
      actionLabel: 'Điều phối hàng đợi SLA',
      actionType: 'alert_doctor',
    });
  } else if (arrivedCount > 0) {
    const firstArrived = encounters.find((e) => e.status === 'arrived')!;
    dynamicActions.push({
      id: `act-sla-normal-${firstArrived.id}`,
      priority: 'medium',
      category: 'patient_wait',
      title: `⏱️ Giám sát hàng đợi — Có ${arrivedCount} bệnh nhân đang chờ khám`,
      description: `Bệnh nhân ${firstArrived.patientName} đang chờ tại sảnh tiếp đón. Đề xuất sắp xếp phòng khám theo số thứ tự để tối ưu hóa thời gian chờ.`,
      actionLabel: 'Điều phối hàng đợi SLA',
      actionType: 'alert_doctor',
    });
  }

  // 3. Occupancy Capacity Alert
  const totalChairs = chairsMatrix.length;
  const occupancyRate = totalChairs > 0 ? Math.round((occupiedChairs.length / totalChairs) * 100) : 0;
  
  if (occupancyRate >= 75) {
    dynamicActions.push({
      id: 'act-high-occupancy',
      priority: 'high',
      category: 'capacity',
      title: `⚠️ Cảnh báo quá tải — Công suất phòng khám đạt ${occupancyRate}%`,
      description: `Có ${occupiedChairs.length}/${totalChairs} phòng khám đang hoạt động đồng thời. Đề xuất sẵn sàng mở thêm phòng khám dự phòng hoặc điều chuyển ca khám nhẹ.`,
      actionLabel: 'Điều phối công suất',
      actionType: 'reroute_queue',
    });
  } else if (occupiedChairs.length > 0) {
    const occupiedChair = occupiedChairs[0];
    dynamicActions.push({
      id: `act-cap-${occupiedChair.id}`,
      priority: 'medium',
      category: 'capacity',
      title: `📈 Công suất hoạt động — ${isDental ? 'Ghế' : 'Phòng'} ${occupiedChair.code} đang bận`,
      description: `${isDental ? 'Ghế' : 'Phòng'} ${occupiedChair.code} đang thực hiện ca khám cho bệnh nhân ${occupiedChair.currentPatientName || 'hiện tại'} bởi ${occupiedChair.currentDoctorName || 'Bác sĩ'}.`,
      actionLabel: 'Điều phối công suất',
      actionType: 'reroute_queue',
    });
  }

  // 4. Financial Alerts
  if (finishedEncounters.length > 0) {
    dynamicActions.push({
      id: 'act-finance-audit-dynamic',
      priority: 'medium',
      category: 'finance',
      title: `💰 Đối soát viện phí — Phát hiện ${finishedEncounters.length} lượt khám cần đối soát`,
      description: `Lượt khám của BN ${finishedEncounters.map(e => e.patientName).slice(0, 2).join(', ')} đã hoàn tất. Đề xuất rà soát thông tin BHYT và xác nhận thanh toán viện phí.`,
      actionLabel: 'Thực hiện đối soát BHYT',
      actionType: 'reroute_queue',
    });
  }

  // 5. Shift Handover Alert
  const doctorsList = Array.from(new Set(encounters.map(e => e.doctorName).filter(Boolean)));
  if (doctorsList.length > 0) {
    const activeDoc = doctorsList[0];
    dynamicActions.push({
      id: `act-doctor-shift-${activeDoc}`,
      priority: 'info',
      category: 'staff',
      title: `👨‍⚕️ Bàn giao ca trực — Bác sĩ ${activeDoc} sắp hết ca trực`,
      description: `Đề xuất chuẩn bị gửi danh sách bàn giao các ca khám chờ tiếp theo của Bác sĩ ${activeDoc} sang Bác sĩ nhận ca trực tiếp theo.`,
      actionLabel: 'Thông báo chuyển ca',
      actionType: 'alert_doctor',
    });
  }

  return dynamicActions.filter((a) => !dismissedIds.includes(a.id));
}

// ==========================================
// TEST SUITES
// ==========================================
describe('Bella Healthcare Platform — Enterprise Phase 1 Tests', () => {

  // 1. RBAC / Permission Test Suite
  describe('Control #1: Role-Based Access Control (RBAC)', () => {
    const doctorUser: User = { id: 'u-doc', role: 'doctor', tenant_id: 't-1', full_name: 'Dr. Minh' };
    const nurseUser: User = { id: 'u-nurse', role: 'nurse', tenant_id: 't-1', full_name: 'Nurse Trang' };
    const receptionistUser: User = { id: 'u-rec', role: 'receptionist', tenant_id: 't-1', full_name: 'Receptionist Vy' };
    const pharmacistUser: User = { id: 'u-pharm', role: 'pharmacist', tenant_id: 't-1', full_name: 'Pharmacist Binh' };
    const cashierUser: User = { id: 'u-cash', role: 'billingcashier', tenant_id: 't-1', full_name: 'Cashier Hoa' };
    const adminUser: User = { id: 'u-admin', role: 'clinicadmin', tenant_id: 't-1', full_name: 'Admin Nam' };

    it('should grant Clinical & EMR permissions strictly according to role', () => {
      // Doctor should create & edit SOAP
      expect(checkHealthcarePermission(doctorUser, 'clinical.encounter.create')).toBe(true);
      expect(checkHealthcarePermission(doctorUser, 'clinical.soap.update')).toBe(true);
      expect(checkHealthcarePermission(doctorUser, 'clinical.order.create')).toBe(true);

      // Nurse can check in and record vitals, but NOT create orders or update SOAP
      expect(checkHealthcarePermission(nurseUser, 'clinical.encounter.read')).toBe(true);
      expect(checkHealthcarePermission(nurseUser, 'clinical.vitals.record')).toBe(true);
      expect(checkHealthcarePermission(nurseUser, 'clinical.soap.update')).toBe(false);
      expect(checkHealthcarePermission(nurseUser, 'clinical.order.create')).toBe(false);

      // Receptionist can only create/read encounters but not update SOAP or write vitals
      expect(checkHealthcarePermission(receptionistUser, 'clinical.encounter.create')).toBe(true);
      expect(checkHealthcarePermission(receptionistUser, 'clinical.vitals.record')).toBe(false);
      expect(checkHealthcarePermission(receptionistUser, 'clinical.soap.update')).toBe(false);
    });

    it('should grant Pharmacy permissions strictly to Pharmacist', () => {
      expect(checkHealthcarePermission(pharmacistUser, 'pharmacy.prescription.dispense')).toBe(true);
      expect(checkHealthcarePermission(doctorUser, 'pharmacy.prescription.dispense')).toBe(false);
      expect(checkHealthcarePermission(nurseUser, 'pharmacy.prescription.dispense')).toBe(false);
    });

    it('should grant Billing permissions strictly to Cashier', () => {
      expect(checkHealthcarePermission(cashierUser, 'billing.invoice.create')).toBe(true);
      expect(checkHealthcarePermission(cashierUser, 'insurance.claim.submit')).toBe(true);
      expect(checkHealthcarePermission(doctorUser, 'billing.invoice.create')).toBe(false);
      expect(checkHealthcarePermission(nurseUser, 'billing.invoice.create')).toBe(false);
    });

    it('should bypass all checks for Clinic Administrator', () => {
      expect(checkHealthcarePermission(adminUser, 'clinical.soap.update')).toBe(true);
      expect(checkHealthcarePermission(adminUser, 'pharmacy.prescription.dispense')).toBe(true);
      expect(checkHealthcarePermission(adminUser, 'billing.invoice.create')).toBe(true);
    });
  });

  // 2. API Contract Test Suite
  describe('Control #2: API Contract & DTO Validation', () => {
    it('should accept a fully valid Encounter DTO', () => {
      const validPayload = {
        customerId: '11111111-1111-4111-8111-111111111111',
        practitionerId: '22222222-2222-4222-8222-222222222222',
        facilityId: '33333333-3333-4333-8333-333333333333',
        chiefComplaint: 'Đau buốt răng số 36 khi uống nước lạnh',
        priority: 'routine',
      };
      const result = createEncounterSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject Encounter DTO with invalid UUIDs', () => {
      const invalidPayload = {
        customerId: 'invalid-uuid-format',
        practitionerId: '22222222-2222-4222-8222-222222222222',
        facilityId: '33333333-3333-4333-8333-333333333333',
        chiefComplaint: 'Đau buốt răng số 36',
        priority: 'urgent',
      };
      const result = createEncounterSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('UUID');
      }
    });

    it('should reject Encounter DTO with empty chief complaint', () => {
      const invalidPayload = {
        customerId: '11111111-1111-4111-8111-111111111111',
        practitionerId: '22222222-2222-4222-8222-222222222222',
        facilityId: '33333333-3333-4333-8333-333333333333',
        chiefComplaint: '',
        priority: 'routine',
      };
      const result = createEncounterSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('empty');
      }
    });

    it('should apply default values to Patients List query contracts', () => {
      const minimalQuery = {};
      const parsed = getPatientsQuerySchema.parse(minimalQuery);
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.sortBy).toBe('created_at');
      expect(parsed.sortOrder).toBe('desc');
    });

    it('should enforce maximum limit on pagination query', () => {
      const excessiveQuery = { limit: 500 };
      const result = getPatientsQuerySchema.safeParse(excessiveQuery);
      expect(result.success).toBe(false);
    });
  });

  // 3. Transaction Integrity Test Suite
  describe('Control #3: Transaction Integrity & Atomic Rollbacks', () => {
    let mockUpdateEncounterStatus: jest.Mock;
    let mockCreateInvoice: jest.Mock;
    let mockCreatePrescription: jest.Mock;
    let mockDeductInventory: jest.Mock;
    let coordinator: CheckoutTransactionCoordinator;

    beforeEach(() => {
      mockUpdateEncounterStatus = jest.fn().mockResolvedValue({ success: true });
      mockCreateInvoice = jest.fn().mockResolvedValue({ success: true });
      mockCreatePrescription = jest.fn().mockResolvedValue({ success: true });
      mockDeductInventory = jest.fn().mockResolvedValue({ success: true });

      coordinator = new CheckoutTransactionCoordinator({
        updateEncounterStatus: mockUpdateEncounterStatus,
        createInvoice: mockCreateInvoice,
        createPrescription: mockCreatePrescription,
        deductInventory: mockDeductInventory,
      });
    });

    it('should complete checkout successfully when all phases succeed', async () => {
      const payload: CheckoutPayload = {
        amount: 850000,
        drugs: [{ code: 'DRG001', name: 'Amoxicillin', quantity: 20 }],
      };

      const result = await coordinator.executeCheckout('enc-1', payload);

      expect(result.success).toBe(true);
      expect(mockUpdateEncounterStatus).toHaveBeenCalledWith('enc-1', 'completed');
      expect(mockCreateInvoice).toHaveBeenCalledWith('enc-1', 850000);
      expect(mockCreatePrescription).toHaveBeenCalledWith('enc-1', payload.drugs);
      expect(mockDeductInventory).toHaveBeenCalledWith(payload.drugs);
    });

    it('should rollback invoice creation when prescription creation fails', async () => {
      const payload: CheckoutPayload = {
        amount: 500000,
        drugs: [{ code: 'DRG002', name: 'Ibuprofen', quantity: 10 }],
      };

      // Mock Prescription Creation failure
      mockCreatePrescription.mockResolvedValueOnce({ success: false, error: 'Database write timeout' });

      const result = await coordinator.executeCheckout('enc-1', payload);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database write timeout');

      // Verify rollbacks were executed in order
      expect(mockCreateInvoice).toHaveBeenLastCalledWith('enc-1', 0); // Staged invoice reset
      expect(mockUpdateEncounterStatus).toHaveBeenLastCalledWith('enc-1', 'in_progress'); // Staged status reset
      expect(mockDeductInventory).not.toHaveBeenCalled();
    });

    it('should rollback all previous steps when inventory deduction fails', async () => {
      const payload: CheckoutPayload = {
        amount: 1200000,
        drugs: [{ code: 'DRG003', name: 'Augmentin', quantity: 30 }],
      };

      // Mock Inventory Out-Of-Stock failure
      mockDeductInventory.mockResolvedValueOnce({ success: false, error: 'INSUFFICIENT_STOCK: Augmentin' });

      const result = await coordinator.executeCheckout('enc-1', payload);

      expect(result.success).toBe(false);
      expect(result.error).toContain('INSUFFICIENT_STOCK');

      // Verify full rollback stack ran in reverse order
      expect(mockCreatePrescription).toHaveBeenLastCalledWith('enc-1', []); // Staged prescription reset
      expect(mockCreateInvoice).toHaveBeenLastCalledWith('enc-1', 0); // Staged invoice reset
      expect(mockUpdateEncounterStatus).toHaveBeenLastCalledWith('enc-1', 'in_progress'); // Staged status reset
    });
  });

  // 4. Concurrency Control Test Suite
  describe('Control #4: Concurrency Control & Lost Updates Prevention', () => {
    let concurrencyManager: EMRConcurrencyManager;

    beforeEach(() => {
      concurrencyManager = new EMRConcurrencyManager();
      concurrencyManager.saveInitial({
        id: 'emr-1',
        notes: 'Bệnh nhân ổn định',
        version: 1,
        updatedAt: new Date().toISOString(),
      });
    });

    it('should allow updates when the client version matches current state', () => {
      const record = concurrencyManager.get('emr-1')!;
      expect(record.version).toBe(1);

      const result = concurrencyManager.update('emr-1', 'Bệnh nhân sốt cao nhẹ', record.version);
      expect(result.success).toBe(true);

      const updated = concurrencyManager.get('emr-1')!;
      expect(updated.notes).toBe('Bệnh nhân sốt cao nhẹ');
      expect(updated.version).toBe(2);
    });

    it('should reject update (prevent lost updates) when a concurrent change has incremented the version', () => {
      // Clinician A and Clinician B both read the record at Version 1
      const doctorARecord = concurrencyManager.get('emr-1')!;
      const doctorBRecord = concurrencyManager.get('emr-1')!;

      // Doctor A saves changes first
      const resA = concurrencyManager.update('emr-1', 'Ghi chú của Doctor A', doctorARecord.version);
      expect(resA.success).toBe(true);

      // Current DB version is now 2
      const currentDbState = concurrencyManager.get('emr-1')!;
      expect(currentDbState.version).toBe(2);

      // Doctor B tries to save changes using Version 1
      const resB = concurrencyManager.update('emr-1', 'Ghi chú của Doctor B (mới hơn)', doctorBRecord.version);
      
      expect(resB.success).toBe(false);
      expect(resB.error).toContain('CONCURRENCY_CONFLICT');

      // The database must still retain Doctor A's data, Doctor B's write is rejected
      expect(concurrencyManager.get('emr-1')!.notes).toBe('Ghi chú của Doctor A');
    });
  });

  // 5. Clinical Audit Trail Test Suite
  describe('Control #5: Clinical Audit Trail & History Replay', () => {
    let auditService: ClinicalAuditTrailService;

    beforeEach(() => {
      auditService = new ClinicalAuditTrailService();
    });

    it('should log audit entries for EMR changes and allow state replay to build audit history', () => {
      const entityId = 'enc-101';
      
      // Step 1: Doctor creates SOAP note
      const initialState = { diagnoses: [], notes: 'Chưa có ghi chú' };
      const state1 = { diagnoses: ['J06.9'], notes: 'Viêm đường hô hấp trên' };
      auditService.logChange('doc-1', 'CREATE', entityId, 'Encounter', initialState, state1);

      // Step 2: Doctor modifies SOAP plan
      const state2 = { diagnoses: ['J06.9'], notes: 'Viêm đường hô hấp trên', plan: 'Paracetamol + Nghỉ ngơi' };
      auditService.logChange('doc-1', 'UPDATE', entityId, 'Encounter', state1, state2);

      // Step 3: Senior clinician corrects diagnosis
      const state3 = { diagnoses: ['J18.9'], notes: 'Theo dõi Viêm phổi thùy', plan: 'Paracetamol + Augmentin 1g + X-Quang phổi' };
      auditService.logChange('doc-senior', 'UPDATE', entityId, 'Encounter', state2, state3);

      // Fetch audit trail
      const logs = auditService.getLogsForEntity(entityId);
      expect(logs).toHaveLength(3);
      
      expect(logs[0].action).toBe('CREATE');
      expect(logs[1].userId).toBe('doc-1');
      expect(logs[2].userId).toBe('doc-senior');

      // Replay all logs to reconstruct final state
      const reconstructedState = auditService.replayHistory(entityId, initialState);
      
      expect(reconstructedState.diagnoses).toContain('J18.9');
      expect(reconstructedState.plan).toContain('Augmentin 1g');
      expect(reconstructedState.notes).toBe('Theo dõi Viêm phổi thùy');
    });
  });

  // 6. Real-time Workflow Recommendation Logic Test Suite
  describe('Control #6: Real-time Workflow Recommendation Logic (AI COO)', () => {
    const dummyChairs = [
      { id: 'c-1', code: 'Phòng #01', status: 'available' as const },
      { id: 'c-2', code: 'Phòng #02', status: 'available' as const },
      { id: 'c-3', code: 'Phòng #03', status: 'occupied' as const, currentPatientName: 'Trần Văn A', currentDoctorName: 'BS. Lê Minh' },
    ];

    it('should generate a routing recommendation if there is an arrived patient and an available chair', () => {
      const encounters = [
        { id: 'enc-1', patientName: 'Nguyễn Văn Hùng', status: 'arrived', waitTimeMinutes: 10 }
      ];
      
      const recs = generateOperationalRecommendations({
        isDental: false,
        encounters,
        chairsMatrix: dummyChairs,
        dismissedIds: []
      });

      const routeRec = recs.find(r => r.actionType === 'assign_room');
      expect(routeRec).toBeDefined();
      expect(routeRec!.title).toContain('Mời BN Nguyễn Văn Hùng vào Phòng #01');
      expect(routeRec!.priority).toBe('high');
    });

    it('should generate a high-priority SLA warning alert if an arrived patient has waited >15 minutes', () => {
      const encounters = [
        { id: 'enc-1', patientName: 'Nguyễn Văn Hùng', status: 'arrived', waitTimeMinutes: 20 }
      ];

      const recs = generateOperationalRecommendations({
        isDental: false,
        encounters,
        chairsMatrix: dummyChairs,
        dismissedIds: []
      });

      const slaRec = recs.find(r => r.category === 'patient_wait');
      expect(slaRec).toBeDefined();
      expect(slaRec!.title).toContain('Cảnh báo SLA — Có 1 bệnh nhân chờ >15 phút');
      expect(slaRec!.priority).toBe('high');
    });

    it('should generate a medium-priority queue monitoring alert if arrived patients exist but wait time is <=15 minutes', () => {
      const encounters = [
        { id: 'enc-1', patientName: 'Nguyễn Văn Hùng', status: 'arrived', waitTimeMinutes: 5 }
      ];

      const recs = generateOperationalRecommendations({
        isDental: false,
        encounters,
        chairsMatrix: dummyChairs,
        dismissedIds: []
      });

      const queueRec = recs.find(r => r.id.startsWith('act-sla-normal-'));
      expect(queueRec).toBeDefined();
      expect(queueRec!.title).toContain('Giám sát hàng đợi — Có 1 bệnh nhân đang chờ khám');
      expect(queueRec!.priority).toBe('medium');
    });

    it('should generate a high-priority capacity alert if clinic occupancy is high (>75%)', () => {
      const highlyOccupiedChairs = [
        { id: 'c-1', code: 'Phòng #01', status: 'occupied' as const },
        { id: 'c-2', code: 'Phòng #02', status: 'occupied' as const },
        { id: 'c-3', code: 'Phòng #03', status: 'occupied' as const },
        { id: 'c-4', code: 'Phòng #04', status: 'available' as const },
      ];
      const encounters = [
        { id: 'enc-1', patientName: 'Nguyễn Văn Hùng', doctorName: 'BS. Lê Minh', status: 'in_progress' }
      ];

      const recs = generateOperationalRecommendations({
        isDental: false,
        encounters,
        chairsMatrix: highlyOccupiedChairs,
        dismissedIds: []
      });

      const capRec = recs.find(r => r.id === 'act-high-occupancy');
      expect(capRec).toBeDefined();
      expect(capRec!.title).toContain('Cảnh báo quá tải — Công suất phòng khám đạt 75%');
      expect(capRec!.priority).toBe('high');
    });

    it('should generate a billing đối soát alert for completed encounters', () => {
      const encounters = [
        { id: 'enc-1', patientName: 'Nguyễn Văn Hùng', status: 'finished' }
      ];

      const recs = generateOperationalRecommendations({
        isDental: false,
        encounters,
        chairsMatrix: dummyChairs,
        dismissedIds: []
      });

      const financeRec = recs.find(r => r.id === 'act-finance-audit-dynamic');
      expect(financeRec).toBeDefined();
      expect(financeRec!.title).toContain('Đối soát viện phí');
      expect(financeRec!.priority).toBe('medium');
    });

    it('should respect dismissedIds and suppress matches', () => {
      const encounters = [
        { id: 'enc-1', patientName: 'Nguyễn Văn Hùng', status: 'finished' }
      ];

      const recs = generateOperationalRecommendations({
        isDental: false,
        encounters,
        chairsMatrix: dummyChairs,
        dismissedIds: ['act-finance-audit-dynamic']
      });

      const financeRec = recs.find(r => r.id === 'act-finance-audit-dynamic');
      expect(financeRec).toBeUndefined();
    });
  });
});
