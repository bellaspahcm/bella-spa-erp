import { describe, it, expect, beforeEach } from '@jest/globals';
import { createClient } from '@/lib/supabase-server';
import { ContractRegistryService } from '@/platform/host/contract-registry/contract-registry.service';
import { bootstrapHealthcarePlatform } from '../healthcare-platform.bootstrap';
import {
  createClinicalOrderService,
  getClinicalOrderService,
  ClinicalOrderService,
  ORDER_ENGINE_CONTRACT,
} from '../engines/order-engine';
import {
  getEncounterEngine,
  EncounterEngineContract,
} from '../engines/encounter-engine';
import { PHARMACY_ENGINE_CONTRACT } from '../contracts/pharmacy-engine.contract';

describe('Healthcare Platform Bootstrap & Wiring (STEP 8)', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let contractRegistry: ContractRegistryService;

  beforeEach(async () => {
    supabase = await createClient();
    contractRegistry = ContractRegistryService.getInstance();
    contractRegistry.clear();
  });

  it('should successfully run bootstrap without breaking or throwing errors', async () => {
    // Run bootstrap
    await expect(bootstrapHealthcarePlatform(contractRegistry)).resolves.not.toThrow();
  });

  it('should register Encounter, Order, and Pharmacy engine contracts in Contract Registry', async () => {
    await bootstrapHealthcarePlatform(contractRegistry);

    // Verify Order Engine Contract
    const orderContract = contractRegistry.getContract(
      ORDER_ENGINE_CONTRACT.name,
      ORDER_ENGINE_CONTRACT.version
    );
    expect(orderContract).toBeDefined();
    expect(orderContract?.name).toBe('order-engine');
    expect(orderContract?.version).toBe('1.0.0');

    // Verify Encounter Engine Contract
    const encounterContract = contractRegistry.getContract(
      EncounterEngineContract.engineId,
      EncounterEngineContract.version
    );
    expect(encounterContract).toBeDefined();
    expect(encounterContract?.name).toBe('encounter-engine');
    expect(encounterContract?.version).toBe('1.0.0');

    // Verify Pharmacy Engine Contract
    const pharmacyContract = contractRegistry.getContract(
      PHARMACY_ENGINE_CONTRACT.name,
      PHARMACY_ENGINE_CONTRACT.version
    );
    expect(pharmacyContract).toBeDefined();
    expect(pharmacyContract?.name).toBe('pharmacy-engine');
    expect(pharmacyContract?.version).toBe('1.0.0');
  });

  it('should create ClinicalOrderService with correct dependencies via factory', () => {
    const service = createClinicalOrderService(supabase);
    expect(service).toBeInstanceOf(ClinicalOrderService);

    // Verify singleton behavior
    const singleton1 = getClinicalOrderService(supabase);
    const singleton2 = getClinicalOrderService(supabase);
    expect(singleton1).toBe(singleton2);
  });

  it('should resolve and create EncounterEngine via factory', () => {
    const encounterEngine = getEncounterEngine(supabase);
    expect(encounterEngine).toBeDefined();
  });
});
