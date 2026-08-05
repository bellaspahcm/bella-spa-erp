import { aiOrchestrator } from '@/platform';

// ═══════════════════════════════════════════════════════════════════════════
// REGISTER HEALTHCARE AI AGENTS
// ═══════════════════════════════════════════════════════════════════════════

export interface SoapNoteInput {
  readonly rawNotes: string;
}

export interface SoapNoteOutput {
  readonly subjective: string;
  readonly objective: string;
  readonly assessment: string;
  readonly plan: string;
}

export interface SafetyCheckInput {
  readonly allergies: string[];
  readonly drugs: string[];
}

export interface SafetyCheckOutput {
  readonly status: 'safe' | 'warning' | 'blocked';
  readonly messages: string[];
}

/**
 * Đăng ký các AI Agents của Healthcare vào hệ thống điều phối AI chung của Platform.
 */
export function registerHealthcareAiAgents(): void {
  // 1. SOAP Note Generator Agent
  aiOrchestrator.registerAgent<SoapNoteInput, SoapNoteOutput>({
    type: 'soap_note_generator',
    name: 'SOAP Note AI Generator',
    description: 'Chuyển đổi ghi chú khám lâm sàng thô thành SOAP Note định dạng JSON chuẩn y khoa.',
    preferredModel: 'gemini-2.0-flash',
    temperature: 0.1,
    systemPrompt: `Bạn là trợ lý y khoa AI chuyên nghiệp. Hãy chuyển đổi các ghi chép lâm sàng thô thành cấu trúc SOAP (Subjective, Objective, Assessment, Plan) bằng tiếng Việt. Trả về JSON hợp lệ với định dạng:
{"subjective": "...", "objective": "...", "assessment": "...", "plan": "..."}`,
    userPromptTemplate: `Hãy chuyển đổi ghi chép khám sau thành SOAP Note:
{{rawNotes}}`,
    parseOutput: (response) => {
      const match = response.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('Failed to find JSON response format');
      }
      return JSON.parse(match[0]);
    },
  });

  // 2. Clinical Safety Auditor Agent (CDSS)
  aiOrchestrator.registerAgent<SafetyCheckInput, SafetyCheckOutput>({
    type: 'clinical_safety_auditor',
    name: 'Clinical Prescription Safety Auditor',
    description: 'Kiểm tra tương tác chéo, dị ứng thuốc và chống chỉ định y khoa (CDSS).',
    preferredModel: 'gemini-2.0-flash',
    temperature: 0.1,
    systemPrompt: `Bạn là chuyên gia hệ thống CDSS (Hỗ trợ Quyết định Lâm sàng). Hãy phân tích thông tin dị ứng của bệnh nhân và danh sách thuốc dự kiến kê đơn (mã hoạt chất ATC) để cảnh báo an toàn.
Trả về định dạng JSON:
{"status": "safe" | "warning" | "blocked", "messages": ["chi tiết cảnh báo hoặc khuyến nghị"]}`,
    userPromptTemplate: `Đánh giá an toàn kê đơn:
- Tiền sử dị ứng bệnh nhân: {{allergies}}
- Danh sách thuốc hoạt chất ATC: {{drugs}}`,
    parseOutput: (response) => {
      const match = response.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('Failed to parse safety check response');
      }
      return JSON.parse(match[0]);
    },
  });
}

/**
 * Thực thi sinh SOAP Note qua AI Orchestrator.
 */
export async function generateSoapNoteAi(
  tenantId: string,
  rawNotes: string
): Promise<SoapNoteOutput> {
  const task = await aiOrchestrator.run<SoapNoteInput, SoapNoteOutput>({
    agentType: 'soap_note_generator',
    tenantId,
    input: { rawNotes },
  });

  if (task.status === 'failed' || !task.output) {
    throw new Error(task.error || 'AI SOAP Note generation failed');
  }

  return task.output;
}

/**
 * Thực thi kiểm tra an toàn kê đơn qua AI Orchestrator.
 */
export async function auditPrescriptionSafetyAi(
  tenantId: string,
  allergies: string[],
  drugs: string[]
): Promise<SafetyCheckOutput> {
  const task = await aiOrchestrator.run<SafetyCheckInput, SafetyCheckOutput>({
    agentType: 'clinical_safety_auditor',
    tenantId,
    input: { allergies, drugs },
  });

  if (task.status === 'failed' || !task.output) {
    throw new Error(task.error || 'AI clinical safety audit failed');
  }

  return task.output;
}
