import type { AICapabilityPack } from '@/core/plugins/ai-capability-pack';

export const medicalAICapabilityPack: AICapabilityPack = {
  id: 'medical_ai_pack',
  name: 'Bella Medical AI Clinical Copilot',
  knowledgeDomain: 'General Internal Medicine & ICD-10 Diagnosis',
  prompts: {
    icd10_recommendation: 'Dựa trên triệu chứng cơ năng và chỉ số sinh hiệu, gợi ý mã chẩn đoán ICD-10 tương ứng.',
    drug_interaction_check: 'Kiểm tra tương tác thuốc trong đơn thuốc kê cho bệnh nhân.',
  },
  decisionRules: {
    fever_threshold_celsius: 38.5,
    bp_hypertension_systolic: 140,
  },
  tools: [
    {
      id: 'search_icd10_catalog',
      name: 'Search ICD-10 Catalog',
      description: 'Tra cứu mã ICD-10 theo từ khóa chẩn đoán y khoa',
      parametersSchema: {
        keyword: { type: 'string', description: 'Từ khóa chẩn đoán' },
      },
      execute: async (params: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const keyword = String(params.keyword || '');
        return {
          query: keyword,
          results: [
            { code: 'J00', title: 'Viêm mũi họng cấp (Cảm lạnh thông thường)' },
            { code: 'I10', title: 'Tăng huyết áp vô căn (nguyên phát)' },
          ],
        };
      },
    },
  ],
};
