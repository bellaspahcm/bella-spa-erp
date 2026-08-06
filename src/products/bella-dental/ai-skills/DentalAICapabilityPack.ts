import type { AICapabilityPack } from '@/core/plugins/ai-capability-pack';

export const dentalAICapabilityPack: AICapabilityPack = {
  id: 'dental_ai_pack',
  name: 'Bella Dental AI Odontogram & Implant Copilot',
  knowledgeDomain: 'Odontogram Interpretation, Invisalign & Implant Surgical Planning',
  prompts: {
    odontogram_analysis: 'Phân tích tình trạng sơ đồ răng 32/20, phát hiện răng sâu, mất răng và răng ngầm.',
    implant_bone_assessment: 'Đánh giá mật độ xương hàm qua phim X-quang/CBCT cho cấy ghép Implant.',
  },
  decisionRules: {
    min_bone_density_hu: 400,
    max_tooth_mobility_grade: 3,
  },
  tools: [
    {
      id: 'analyze_odontogram_chart',
      name: 'Analyze Odontogram Chart',
      description: 'Phân tích sơ đồ răng và đưa ra lộ trình điều trị nha khoa',
      parametersSchema: {
        toothNumber: { type: 'number', description: 'Số hiệu răng (ví dụ: 11, 21, 36, 46)' },
        condition: { type: 'string', description: 'Tình trạng răng (caries, missing, crown, implant)' },
      },
      execute: async (params: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const toothNumber = Number(params.toothNumber || 0);
        const condition = String(params.condition || '');
        return {
          toothNumber,
          condition,
          treatmentPlan: `Khuyên dùng thủ thuật hàn răng Composite hoặc bọc sứ cho răng ${toothNumber}`,
        };
      },
    },
  ],
};
