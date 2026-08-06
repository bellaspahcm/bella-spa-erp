import { ToothState } from './domain-models';

// 1. Safety Engine (Contraindications)
export class SafetyEngine {
  public evaluatePrescriptionSafety(allergies: string[], selectedDrugs: string[]): { triggered: boolean; blockers: string[] } {
    const containsPenicillin = allergies.includes('penicillin');
    const prescribingAmoxicillin = selectedDrugs.includes('J01CA04') || selectedDrugs.includes('J01CR02');

    if (containsPenicillin && prescribingAmoxicillin) {
      return {
        triggered: true,
        blockers: ['Bệnh nhân dị ứng với kháng sinh nhóm Penicillin. Augmentin/Amoxicillin chống chỉ định tuyệt đối! Vui lòng chọn kháng sinh thay thế (ví dụ: Clindamycin).'],
      };
    }
    return { triggered: false, blockers: [] };
  }
}

// 2. Guideline Engine (ADA/FDI Guidelines)
export class GuidelineEngine {
  public getAdaGuidelines(toothNumber: string, status: ToothState['status']): string[] {
    if (status === 'decayed') {
      return ['Theo ADA: Khuyên dùng bảo tồn ngà răng bằng thủ thuật hàn trám composite hoặc RCT tùy độ sâu.'];
    }
    if (status === 'missing') {
      return ['Theo FDI: Cân nhắc cấy ghép trụ phục hình Implant hoặc làm cầu răng sứ thẩm mỹ để bảo vệ lực nhai toàn hàm.'];
    }
    return ['Duy trì vệ sinh khoang miệng và kiểm tra định kỳ mỗi 6 tháng.'];
  }
}

// 3. Recommendation Engine (3-Tier Protocol Suggestions)
export interface ProtocolSuggestion {
  readonly stepNumber: number;
  readonly actionName: string;
  readonly durationText?: string;
}

export class RecommendationEngine {
  public getClinicalProtocol(toothNumber: string, status: ToothState['status']): ProtocolSuggestion[] {
    if (status === 'decayed') {
      return [
        { stepNumber: 1, actionName: 'Điều trị tủy (RCT - Root Canal Treatment)', durationText: 'Hôm nay' },
        { stepNumber: 2, actionName: 'Bọc mão răng sứ thẩm mỹ Cercon (Crown)', durationText: 'Sau 7 ngày' },
        { stepNumber: 3, actionName: 'Lịch tái khám kiểm tra định kỳ (Recall 6 tháng)', durationText: 'Sau 6 tháng' }
      ];
    }
    if (status === 'missing') {
      return [
        { stepNumber: 1, actionName: 'Chụp phim CBCT khảo sát xương hàm', durationText: 'Hôm nay' },
        { stepNumber: 2, actionName: 'Phẫu thuật cấy ghép trụ Implant Nobel', durationText: 'Tuần sau' },
        { stepNumber: 3, actionName: 'Tích hợp xương & Phục hình mão sứ', durationText: 'Sau 3 tháng' }
      ];
    }
    return [];
  }
}

// 4. Prediction Engine (Capacity & Utilization Forecasting)
export class PredictionEngine {
  public forecastUtilization(currentOccupancy: number): { forecastedOccupancy: number; bottleneckRisk: 'critical' | 'moderate' | 'low'; warningText?: string } {
    const forecasted = Math.min(100, Math.round(currentOccupancy * 1.18));
    const risk = forecasted > 90 ? 'critical' : forecasted > 70 ? 'moderate' : 'low';
    
    return {
      forecastedOccupancy: forecasted,
      bottleneckRisk: risk,
      warningText: risk === 'critical' ? `⚠️ Dự báo lúc 13:00 công suất ghế sẽ đạt ${forecasted}% (Quá tải). Gợi ý điều phối lịch hẹn giãn ca.` : undefined
    };
  }
}

// --- CENTRAL AI ENGINE REGISTRY ---
export class AiEngineRegistry {
  private static instance: AiEngineRegistry;
  
  public readonly safety = new SafetyEngine();
  public readonly guideline = new GuidelineEngine();
  public readonly recommendation = new RecommendationEngine();
  public readonly prediction = new PredictionEngine();

  private constructor() {}

  public static getInstance(): AiEngineRegistry {
    if (!AiEngineRegistry.instance) {
      AiEngineRegistry.instance = new AiEngineRegistry();
    }
    return AiEngineRegistry.instance;
  }
}
export const aiRegistry = AiEngineRegistry.getInstance();
