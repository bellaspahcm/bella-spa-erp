import { journeyEngine, type Journey, type SubJourney, type JourneyMilestone, type MilestoneStatus } from '@/platform';

export interface StartCareJourneyInput {
  readonly patientPartyId: string;
  readonly journeyType: 'implant_care' | 'orthodontics' | 'general_dental' | string;
  readonly expectedEndAt?: Date;
  readonly metadata?: Record<string, unknown>;
}

export class CareJourneyEngine {
  /**
   * Bắt đầu một hành trình điều trị y tế mới cho bệnh nhân.
   * Tự động khởi tạo các Sub-Journeys và Milestones chuẩn y khoa dựa trên loại hành trình.
   */
  async startCareJourney(
    tenantId: string,
    input: StartCareJourneyInput,
    actorId: string
  ): Promise<Journey> {
    const initialSubJourneys = [];

    // Tự động phân chia phác đồ mẫu chuẩn cho cấy Implant nha khoa
    if (input.journeyType === 'implant_care') {
      initialSubJourneys.push(
        {
          name: 'Phẫu thuật cấy ghép trụ (Surgical Stage)',
          description: 'Giai đoạn cắm chốt Implant vào xương hàm.',
          milestones: [
            { name: 'Chụp phim CBCT & Lên phác đồ' },
            { name: 'Phẫu thuật cắm trụ Implant' },
            { name: 'Cắt chỉ sau 7-10 ngày' },
          ],
        },
        {
          name: 'Chờ tích hợp xương (Osteointegration Stage)',
          description: 'Thời gian chờ trụ Implant tích hợp ổn định vào xương hàm (3-6 tháng).',
          milestones: [
            { name: 'Kiểm tra tích hợp xương' },
            { name: 'Đặt nắp lành thương (Healing Abutment)' },
          ],
        },
        {
          name: 'Lắp mão răng sứ (Prosthetic Stage)',
          description: 'Giai đoạn lắp Abutment và phục hình răng sứ lên trên.',
          milestones: [
            { name: 'Lấy dấu răng & Chế tác răng sứ' },
            { name: 'Thử răng sứ & Lắp cố định' },
            { name: 'Tái khám định kỳ sau 6 tháng' },
          ],
        }
      );
    } else {
      // Phác đồ khám tổng quát cơ bản
      initialSubJourneys.push({
        name: 'Khám và Điều trị tổng quát',
        milestones: [
          { name: 'Khám lâm sàng ban đầu' },
          { name: 'Thực hiện thủ thuật điều trị' },
          { name: 'Tái khám & Hoàn tất' },
        ],
      });
    }

    return journeyEngine.startJourney(
      tenantId,
      {
        vertical: 'healthcare',
        journeyType: input.journeyType,
        primaryPartyId: input.patientPartyId,
        expectedEndAt: input.expectedEndAt,
        metadata: input.metadata ?? {},
        initialSubJourneys,
      },
      actorId
    );
  }

  /**
   * Cập nhật trạng thái của một cột mốc điều trị (Milestone).
   */
  async updateMilestoneProgress(
    tenantId: string,
    milestoneId: string,
    status: MilestoneStatus,
    aiValidationDetails: Record<string, unknown> = {},
    actorId: string
  ): Promise<JourneyMilestone> {
    return journeyEngine.advanceMilestone(
      tenantId,
      {
        milestoneId,
        status,
        aiValidationDetails,
      },
      actorId
    );
  }

  /**
   * Lấy chi tiết toàn bộ hành trình điều trị của bệnh nhân.
   */
  async getPatientJourney(tenantId: string, journeyId: string): Promise<Journey | null> {
    return journeyEngine.getJourney(tenantId, journeyId);
  }

  /**
   * Danh sách tất cả hành trình điều trị của một bệnh nhân cụ thể.
   */
  async listPatientJourneys(tenantId: string, patientPartyId: string): Promise<Journey[]> {
    return journeyEngine.getPartysJourneys(tenantId, patientPartyId, 'healthcare');
  }
}

export const careJourneyEngine = new CareJourneyEngine();
