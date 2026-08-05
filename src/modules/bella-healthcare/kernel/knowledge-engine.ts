import { knowledgeEngine, type KnowledgeSearchResult, type InferenceCheckResult } from '@/platform';

export class HealthcareKnowledgeEngine {
  /**
   * Tra cứu bệnh lý hoặc chẩn đoán lâm sàng theo ICD-10 nha khoa bằng công cụ tìm kiếm ngữ nghĩa.
   */
  async searchIcd10Diseases(
    tenantId: string,
    query: string,
    limit = 10
  ): Promise<KnowledgeSearchResult[]> {
    return knowledgeEngine.search(tenantId, 'healthcare', query, limit);
  }

  /**
   * Tra cứu chi tiết một loại thuốc theo mã hoạt chất ATC hoặc tên thuốc.
   */
  async lookupDrugFact(tenantId: string, drugCode: string) {
    return knowledgeEngine.lookupFact(tenantId, 'healthcare', 'drug_atc', drugCode);
  }

  /**
   * Kiểm tra an toàn kê đơn lâm sàng (Prescription Clinical Audit).
   * Kiểm tra dị ứng thuốc của bệnh nhân và tương tác chéo giữa các hoạt chất kê trong đơn.
   */
  async checkPrescriptionSafety(
    tenantId: string,
    patientAllergies: string[],
    prescribedDrugCodes: string[]
  ): Promise<InferenceCheckResult> {
    const facts = {
      allergies: patientAllergies,
      prescribed_drugs: prescribedDrugCodes,
    };

    // Gọi Rule Inference Engine từ Knowledge Engine của Platform để đánh giá
    return knowledgeEngine.evaluateRules(tenantId, 'healthcare', facts);
  }
}

export const healthcareKnowledgeEngine = new HealthcareKnowledgeEngine();
