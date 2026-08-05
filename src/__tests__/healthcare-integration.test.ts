import { aiOrchestrator, compositionEngine } from '@/platform';
import { bootstrapHealthcareKernel } from '@/modules/bella-healthcare/kernel/bootstrap';
import { generateSoapNoteAi, auditPrescriptionSafetyAi } from '@/modules/bella-healthcare/kernel/ai-agents';

// Mock Supabase Server Client to isolate from actual database connections during Jest tests
jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  })),
}));

describe('Bella Healthcare Platform Integration & CDSS Verification', () => {
  const tenantId = 'test-tenant-uuid';

  beforeAll(() => {
    // 1. Bootstrap healthcare module configurations
    bootstrapHealthcareKernel();

    // 2. Register Mock AI Model Adapter to orchestrator
    const mockAiAdapter = {
      model: 'gemini-2.0-flash',
      complete: jest.fn(async (req: any) => {
        // Mock response for SOAP Note request
        if (req.userPrompt.includes('đau răng 36')) {
          return {
            content: JSON.stringify({
              subjective: 'Bệnh nhân đau buốt răng hàm dưới bên trái.',
              objective: 'Khám thấy răng #36 sâu sâu sát tủy.',
              assessment: 'Viêm tủy cấp không hồi phục răng #36.',
              plan: 'Lấy tủy buồng, đặt Ca(OH)2 diệt khuẩn.',
            }),
            model: 'gemini-2.0-flash',
            usage: { promptTokens: 120, completionTokens: 90, totalTokens: 210 },
            finishReason: 'stop' as const,
          };
        }

        // Mock response for CDSS Prescription Safety request (Allergic blocking)
        if (req.userPrompt.includes('penicillin')) {
          return {
            content: JSON.stringify({
              status: 'blocked',
              messages: ['Bệnh nhân dị ứng Penicillin. Kháng sinh Amoxicillin/Augmentin chống chỉ định!'],
            }),
            model: 'gemini-2.0-flash',
            usage: { promptTokens: 80, completionTokens: 50, totalTokens: 130 },
            finishReason: 'stop' as const,
          };
        }

        // Mock response for safe prescription request
        return {
          content: JSON.stringify({
            status: 'safe',
            messages: ['Kê đơn an toàn. Không phát hiện xung đột chéo.'],
          }),
          model: 'gemini-2.0-flash',
          usage: { promptTokens: 80, completionTokens: 30, totalTokens: 110 },
          finishReason: 'stop' as const,
        };
      }),
    };

    aiOrchestrator.registerAdapter(mockAiAdapter);
  });

  it('successfully bootstraps healthcare capabilities and vertical registry', () => {
    // Composition engine must register vertical capabilities
    const definitions = compositionEngine.listCapabilities();
    const hasOdontogram = definitions.some((c) => c.id === 'odontogram_ui' && c.vertical === 'healthcare');
    const hasSoap = definitions.some((c) => c.id === 'soap_ai' && c.vertical === 'healthcare');
    const hasRules = definitions.some((c) => c.id === 'clinical_rules' && c.vertical === 'healthcare');

    expect(hasOdontogram).toBe(true);
    expect(hasSoap).toBe(true);
    expect(hasRules).toBe(true);
  });

  it('CDSS checks and BLOCKS prescription of Amoxicillin when patient is allergic to Penicillin', async () => {
    const res = await auditPrescriptionSafetyAi(tenantId, ['penicillin'], ['J01CA04']); // Amoxicillin

    expect(res.status).toBe('blocked');
    expect(res.messages[0]).toContain('dị ứng Penicillin');
  });

  it('CDSS checks and ALLOWS non-conflicting drug prescriptions when patient has no allergies', async () => {
    const res = await auditPrescriptionSafetyAi(tenantId, [], ['M01AE01']); // Ibuprofen

    expect(res.status).toBe('safe');
    expect(res.messages[0]).toContain('Kê đơn an toàn');
  });

  it('successfully generates structured SOAP Note from raw clinical clinician notes via AI orchestrator', async () => {
    const rawNotes = 'bệnh nhân đau răng 36 khi ăn đồ nóng tối qua, khám sâu răng';
    const soap = await generateSoapNoteAi(tenantId, rawNotes);

    expect(soap.subjective).toContain('đau buốt răng hàm');
    expect(soap.objective).toContain('sâu sát tủy');
    expect(soap.assessment).toContain('Viêm tủy cấp');
    expect(soap.plan).toContain('Lấy tủy buồng');
  });
});
