import { DomainEvent, PatientInfo, ChairInfo, TimelineStep, EncounterStatus } from './domain-models';

// --- PATIENT READ MODEL REPOSITORY ---
export class PatientReadRepository {
  private static instance: PatientReadRepository;
  private patients: Map<string, PatientInfo> = new Map();

  private constructor() {
    // Initial Seed
    this.patients.set('pat-01', {
      id: 'pat-01',
      recordNumber: 'BN000124',
      name: 'Nguyễn Văn Hùng',
      gender: 'male',
      dob: '1995-10-12',
      age: 31,
      bloodType: 'O+',
      allergies: ['penicillin'],
    });
    this.patients.set('pat-02', {
      id: 'pat-02',
      recordNumber: 'BN000567',
      name: 'Lê Thị Mai',
      gender: 'female',
      dob: '2001-04-20',
      age: 25,
      bloodType: 'A+',
      allergies: [],
    });
    this.patients.set('pat-03', {
      id: 'pat-03',
      recordNumber: 'BN000890',
      name: 'Trần Minh Hoàng',
      gender: 'male',
      dob: '1988-08-15',
      age: 38,
      allergies: ['aspirin'],
    });
  }

  public static getInstance(): PatientReadRepository {
    if (!PatientReadRepository.instance) {
      PatientReadRepository.instance = new PatientReadRepository();
    }
    return PatientReadRepository.instance;
  }

  public getById(id: string): PatientInfo | undefined {
    return this.patients.get(id);
  }

  public getAll(): PatientInfo[] {
    return Array.from(this.patients.values());
  }

  public update(patient: PatientInfo): void {
    this.patients.set(patient.id, patient);
  }
}

// --- CHAIR READ MODEL REPOSITORY ---
export class ChairReadRepository {
  private static instance: ChairReadRepository;
  private chairs: Map<string, ChairInfo> = new Map();

  private constructor() {
    // Initial Seed
    this.chairs.set('ch-1', { id: 'ch-1', code: 'Ghế #01', zone: 'Khu A - Ghế chính', status: 'occupied', currentPatientName: 'Nguyễn Văn Hùng', currentDoctorName: 'BS. Lê Minh', estimatedMinutesRemaining: 15 });
    this.chairs.set('ch-2', { id: 'ch-2', code: 'Ghế #02', zone: 'Khu A - Ghế chính', status: 'available' });
    this.chairs.set('ch-3', { id: 'ch-3', code: 'Ghế #03', zone: 'Khu B - Phục hình', status: 'sanitizing' });
    this.chairs.set('ch-4', { id: 'ch-4', code: 'Ghế #04', zone: 'Khu B - Phục hình', status: 'occupied', currentPatientName: 'Lê Thị Mai', currentDoctorName: 'BS. Trần Thảo', estimatedMinutesRemaining: 30 });
  }

  public static getInstance(): ChairReadRepository {
    if (!ChairReadRepository.instance) {
      ChairReadRepository.instance = new ChairReadRepository();
    }
    return ChairReadRepository.instance;
  }

  public getAll(): ChairInfo[] {
    return Array.from(this.chairs.values());
  }

  public updateStatus(id: string, status: ChairInfo['status'], patientName?: string, doctorName?: string): void {
    const chair = this.chairs.get(id);
    if (chair) {
      this.chairs.set(id, {
        ...chair,
        status,
        currentPatientName: patientName,
        currentDoctorName: doctorName,
        estimatedMinutesRemaining: status === 'occupied' ? 25 : undefined,
      });
    }
  }
}

// --- TIMELINE PROJECTION SERVICE ---
// Projects Event Sourcing stream into Timeline Read Model (No standalone timeline table)
export class TimelineProjectionService {
  public static projectTimeline(events: DomainEvent[]): TimelineStep[] {
    const steps: TimelineStep[] = [
      { id: 'ts-1', time: '09:00', title: 'Lên lịch hẹn', actor: 'Bệnh nhân (App)', status: 'completed', durationMinutes: 5 }
    ];

    events.forEach((evt) => {
      const time = evt.metadata.occurredAt.split('T')[1]?.substring(0, 5) || '09:00';
      if (evt.metadata.eventName === 'EncounterArrived.v1') {
        steps.push({
          id: `ts-arrived-${evt.metadata.eventId}`,
          time,
          title: 'Check-in Tiếp đón',
          actor: evt.metadata.userId || 'Lễ tân',
          status: 'completed',
          durationMinutes: 28,
          isBottleneck: true,
        });
      } else if (evt.metadata.eventName === 'PrescriptionCreated.v1') {
        steps.push({
          id: `ts-pres-${evt.metadata.eventId}`,
          time,
          title: 'Kê đơn & Chẩn đoán',
          actor: 'BS. Lê Minh',
          status: 'completed',
          durationMinutes: 12,
        });
      } else if (evt.metadata.eventName === 'EncounterFinished.v2') {
        steps.push({
          id: `ts-finish-${evt.metadata.eventId}`,
          time,
          title: 'Hoàn tất lượt khám',
          actor: 'Hệ thống',
          status: 'completed',
        });
      }
    });

    return steps;
  }
}
