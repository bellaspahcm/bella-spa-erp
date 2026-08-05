import { compositionEngine } from '@/platform';
import { registerHealthcareAiAgents } from './ai-agents';
import {
  SupabasePartyRepository,
  SupabaseJourneyRepository,
  SupabaseTimelineRepository,
  SupabaseAssetRepository,
  SupabaseContractRepository,
  SupabaseKnowledgeRepository,
} from './repositories/supabase-repositories';

/**
 * Đăng ký tất cả capabilities của Healthcare Platform vào Composition Engine.
 */
export function registerHealthcareCapabilities(): void {
  // 1. Odontogram UI Capability
  compositionEngine.registerCapability({
    id: 'odontogram_ui',
    name: 'Lược đồ răng lâm sàng (Odontogram)',
    version: '1.0.0',
    vertical: 'healthcare',
    category: 'ui',
    dependsOn: [],
    optionalDependencies: [],
    conflictsWith: [],
  });

  // 2. SOAP Note AI Assistant
  compositionEngine.registerCapability({
    id: 'soap_ai',
    name: 'Trợ lý ghi chép SOAP Note tự động',
    version: '1.0.0',
    vertical: 'healthcare',
    category: 'ai',
    dependsOn: ['care_journey'],
    optionalDependencies: [],
    conflictsWith: [],
  });

  // 3. Cổng liên kết BHYT Quốc gia
  compositionEngine.registerCapability({
    id: 'bhyt_connector',
    name: 'Cổng liên kết Bảo hiểm y tế quốc gia',
    version: '1.0.0',
    vertical: 'healthcare',
    category: 'connector',
    dependsOn: [],
    optionalDependencies: [],
    conflictsWith: [],
  });

  // 4. Care Journey Engine
  compositionEngine.registerCapability({
    id: 'care_journey',
    name: 'Quản lý hành trình điều trị y khoa',
    version: '1.0.0',
    vertical: 'healthcare',
    category: 'business',
    dependsOn: [],
    optionalDependencies: [],
    conflictsWith: [],
  });

  // 5. Clinical Safety Rules
  compositionEngine.registerCapability({
    id: 'clinical_rules',
    name: 'Kiểm tra an toàn kê đơn và chẩn đoán',
    version: '1.0.0',
    vertical: 'healthcare',
    category: 'workflow',
    dependsOn: [],
    optionalDependencies: [],
    conflictsWith: [],
  });
}

/**
 * Khởi động và ghép nối (bootstrap) các repositories Supabase
 * của Healthcare Kernel vào Platform Engines.
 */
export function bootstrapHealthcareKernel(): void {
  // 1. Đăng ký capabilities
  registerHealthcareCapabilities();

  // 1b. Đăng ký AI Agents y tế
  registerHealthcareAiAgents();

  // 2. Khởi tạo các repositories Supabase thực tế
  const partyRepository = new SupabasePartyRepository();
  const journeyRepository = new SupabaseJourneyRepository();
  const timelineRepository = new SupabaseTimelineRepository();
  const assetRepository = new SupabaseAssetRepository();
  const contractRepository = new SupabaseContractRepository();
  const knowledgeRepository = new SupabaseKnowledgeRepository();

  // 3. Ghép nối (DI) vào Platform Engines
  compositionEngine.bootstrapVertical({
    verticalKey: 'bella_healthcare',
    partyRepository,
    journeyRepository,
    timelineRepository,
    assetRepository,
    contractRepository,
    knowledgeRepository,
  });
}
