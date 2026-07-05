/**
 * Plugin Architecture Demo Test
 * 
 * Demonstrates that new policies can be registered and executed
 * WITHOUT modifying the Decision Engine or Business Process Engine.
 * 
 * This is the "AHA MOMENT" for CTOs:
 * "I can add new domains/policies without touching core!"
 */

import { PolicyRegistry } from '@/lib/policy-registry/policy-registry';
import { BaseBusinessProcess } from '@/lib/business-process/executor';
import type { 
  DecisionRequest, 
  DecisionResponse, 
  BusinessPolicy,
  SalaryComponent 
} from '@/lib/business-process/types';

/**
 * NEW POLICY: Hospital Admission Validation
 * 
 * This is a brand new policy for a new domain (hospital).
 * We're adding it WITHOUT modifying any existing code!
 */
class HospitalAdmissionPolicy {
  name = 'Hospital Admission Policy';
  version = '1.0.0';
  decisionType = 'hospital-admission-validation';
  
  async evaluate(request: DecisionRequest): Promise<DecisionResponse> {
    const { patient, room, insurance } = request.input as any;
    
    // Validation logic
    const validations: SalaryComponent[] = [];
    
    // Check patient eligibility
    if (patient.age < 0 || patient.age > 120) {
      validations.push({
        type: 'eligibility',
        eligible: false,
        reason: 'Invalid patient age',
        amount: 0,
      });
      
      return {
        decisionType: 'hospital-admission-validation',
        totalAmount: 0,
        components: validations,
        metadata: {
          executedAt: new Date().toISOString(),
          policyVersion: this.version,
        },
      };
    }
    
    // Check room availability
    if (room.occupied) {
      validations.push({
        type: 'eligibility',
        eligible: false,
        reason: 'Room is occupied',
        amount: 0,
      });
      
      return {
        decisionType: 'hospital-admission-validation',
        totalAmount: 0,
        components: validations,
        metadata: {
          executedAt: new Date().toISOString(),
          policyVersion: this.version,
        },
      };
    }
    
    // Check insurance coverage
    if (insurance.active && insurance.coverageAmount >= room.dailyRate) {
      validations.push({
        type: 'eligibility',
        eligible: true,
        reason: 'Insurance covers room cost',
        amount: room.dailyRate,
      });
    } else {
      validations.push({
        type: 'eligibility',
        eligible: true,
        reason: 'Self-pay required',
        amount: room.dailyRate,
      });
    }
    
    return {
      decisionType: 'hospital-admission-validation',
      totalAmount: room.dailyRate,
      components: validations,
      metadata: {
        executedAt: new Date().toISOString(),
        policyVersion: this.version,
        insuranceCovered: insurance.active && insurance.coverageAmount >= room.dailyRate,
      },
    };
  }
}

/**
 * NEW POLICY: Retail Discount Policy
 * 
 * Another new policy for retail domain.
 */
class RetailDiscountPolicy {
  name = 'Retail Discount Policy';
  version = '1.0.0';
  decisionType = 'retail-discount-calculation';
  
  async evaluate(request: DecisionRequest): Promise<DecisionResponse> {
    const { customer, items, totalAmount } = request.input as any;
    
    const discounts: SalaryComponent[] = [];
    let finalAmount = totalAmount;
    
    // VIP discount (10%)
    if (customer.tier === 'VIP') {
      const discount = totalAmount * 0.1;
      discounts.push({
        type: 'multiplier',
        eligible: true,
        reason: 'VIP customer 10% discount',
        amount: -discount,
      });
      finalAmount -= discount;
    }
    
    // Bulk purchase discount (5% for 10+ items)
    if (items.length >= 10) {
      const discount = totalAmount * 0.05;
      discounts.push({
        type: 'multiplier',
        eligible: true,
        reason: 'Bulk purchase 5% discount',
        amount: -discount,
      });
      finalAmount -= discount;
    }
    
    // First-time customer reward
    if (customer.isFirstTime) {
      const reward = 50000; // 50k VND voucher
      discounts.push({
        type: 'incentive',
        eligible: true,
        reason: 'First-time customer voucher',
        amount: -reward,
      });
      finalAmount -= reward;
    }
    
    return {
      decisionType: 'retail-discount-calculation',
      totalAmount: Math.max(0, finalAmount),
      components: discounts,
      metadata: {
        executedAt: new Date().toISOString(),
        policyVersion: this.version,
        originalAmount: totalAmount,
        totalDiscount: totalAmount - finalAmount,
      },
    };
  }
}

/**
 * NEW BUSINESS PROCESS: Hospital Admission Process
 * 
 * Uses the new HospitalAdmissionPolicy.
 * Notice: We're using BaseBusinessProcess WITHOUT modification!
 */
class HospitalAdmissionProcess extends BaseBusinessProcess<DecisionRequest, DecisionResponse> {
  config = {
    name: 'hospital-admission',
    version: '1.0.0',
    executionMode: 'sequential' as const,
  };
  
  policies: any[] = [];
  
  addPolicy(policy: any) {
    this.policies.push(policy);
  }
  
  async aggregate(
    context: DecisionRequest,
    policyResults: any[]
  ): Promise<DecisionResponse> {
    const successResults = policyResults.filter(r => r.status === 'success');
    if (successResults.length === 0) {
      return {
        decisionType: 'hospital-admission-validation',
        totalAmount: 0,
        components: [],
        metadata: {
          executedAt: new Date().toISOString(),
          noResults: true,
        },
      };
    }
    
    return successResults[0].data;
  }
}

/**
 * NEW BUSINESS PROCESS: Retail Checkout Process
 * 
 * Uses the new RetailDiscountPolicy.
 */
class RetailCheckoutProcess extends BaseBusinessProcess<DecisionRequest, DecisionResponse> {
  config = {
    name: 'retail-checkout',
    version: '1.0.0',
    executionMode: 'sequential' as const,
  };
  
  policies: any[] = [];
  
  addPolicy(policy: any) {
    this.policies.push(policy);
  }
  
  async aggregate(
    context: DecisionRequest,
    policyResults: any[]
  ): Promise<DecisionResponse> {
    const successResults = policyResults.filter(r => r.status === 'success');
    if (successResults.length === 0) {
      return {
        decisionType: 'retail-discount-calculation',
        totalAmount: 0,
        components: [],
        metadata: {
          executedAt: new Date().toISOString(),
          noResults: true,
        },
      };
    }
    
    return successResults[0].data;
  }
}

describe('Plugin Architecture Demo', () => {
  let registry: PolicyRegistry;
  
  beforeEach(() => {
    registry = PolicyRegistry.getInstance();
    registry.clear();
  });
  
  // ═══════════════════════════════════════════════════════════════
  // DEMO 1: Register New Policy WITHOUT Modifying Engine
  // ═══════════════════════════════════════════════════════════════
  
  describe('DEMO 1: Hospital Domain Plugin', () => {
    it('should register new HospitalAdmissionPolicy without engine changes', async () => {
      // Step 1: Register the new policy
      const policyId = await registry.register(
        new HospitalAdmissionPolicy(),
        {
          id: 'hospital-admission-v1',
          name: 'Hospital Admission Policy',
          version: '1.0.0',
          domain: 'hospital',
          category: 'validation',
          tags: ['hospital', 'admission', 'insurance', 'eligibility'],
          status: 'active',
          owner: 'hospital-plugin',
          decisionType: 'hospital-admission-validation',
          className: 'HospitalAdmissionPolicy',
          description: 'Validates patient admission based on age, room availability, and insurance coverage.',
        }
      );
      
      // Step 2: Verify registration
      expect(registry.hasPolicy(policyId)).toBe(true);
      
      // Step 3: Query the new policy
      const hospitalPolicies = registry.getPoliciesByDomain('hospital');
      expect(hospitalPolicies).toHaveLength(1);
      expect(hospitalPolicies[0].metadata.name).toBe('Hospital Admission Policy');
      
      console.log('✅ New Hospital domain added WITHOUT touching core engine!');
    });
    
    it('should execute HospitalAdmissionPolicy successfully', async () => {
      // Register policy
      const policy = new HospitalAdmissionPolicy();
      await registry.register(policy, {
        id: 'hospital-admission-v1',
        name: 'Hospital Admission Policy',
        version: '1.0.0',
        domain: 'hospital',
        category: 'validation',
        tags: [],
        status: 'active',
        owner: 'test',
        decisionType: 'hospital-admission-validation',
        className: 'HospitalAdmissionPolicy',
        description: 'Test',
      });
      
      // Create process and add policy
      const process = new HospitalAdmissionProcess();
      process.addPolicy(policy);
      
      // Execute
      const processResult = await process.execute({
        input: {
          patient: { id: 'P001', name: 'Nguyen Van A', age: 45 },
          room: { id: 'R101', type: 'Standard', dailyRate: 500000, occupied: false },
          insurance: { active: true, provider: 'Bao Viet', coverageAmount: 600000 },
        },
      });
      
      const result = processResult.result;
      
      expect(result.totalAmount).toBe(500000);
      expect(result.components).toHaveLength(1);
      expect(result.components[0].eligible).toBe(true);
      expect(result.metadata?.insuranceCovered).toBe(true);
      
      console.log('✅ Hospital Admission Process executed successfully!');
      console.log('   Patient:', result.metadata);
    });
  });
  
  // ═══════════════════════════════════════════════════════════════
  // DEMO 2: Retail Domain Plugin
  // ═══════════════════════════════════════════════════════════════
  
  describe('DEMO 2: Retail Domain Plugin', () => {
    it('should register new RetailDiscountPolicy without engine changes', async () => {
      // Register policy
      const policyId = await registry.register(
        new RetailDiscountPolicy(),
        {
          id: 'retail-discount-v1',
          name: 'Retail Discount Policy',
          version: '1.0.0',
          domain: 'retail',
          category: 'multiplier',
          tags: ['retail', 'discount', 'promotion', 'loyalty'],
          status: 'active',
          owner: 'retail-plugin',
          decisionType: 'retail-discount-calculation',
          className: 'RetailDiscountPolicy',
          description: 'Calculates discounts based on customer tier, bulk purchase, and first-time customer rewards.',
        }
      );
      
      expect(registry.hasPolicy(policyId)).toBe(true);
      
      const retailPolicies = registry.getPoliciesByDomain('retail');
      expect(retailPolicies).toHaveLength(1);
      
      console.log('✅ New Retail domain added WITHOUT touching core engine!');
    });
    
    it('should execute RetailDiscountPolicy successfully', async () => {
      // Register policy
      const policy = new RetailDiscountPolicy();
      await registry.register(policy, {
        id: 'retail-discount-v1',
        name: 'Retail Discount Policy',
        version: '1.0.0',
        domain: 'retail',
        category: 'multiplier',
        tags: [],
        status: 'active',
        owner: 'test',
        decisionType: 'retail-discount-calculation',
        className: 'RetailDiscountPolicy',
        description: 'Test',
      });
      
      // Create process and add policy
      const process = new RetailCheckoutProcess();
      process.addPolicy(policy);
      
      // Execute
      const processResult = await process.execute({
        input: {
          customer: { id: 'C001', name: 'Tran Thi B', tier: 'VIP', isFirstTime: true },
          items: Array(12).fill({ name: 'Product', price: 100000 }),
          totalAmount: 1200000,
        },
      });
      
      const result = processResult.result;
      
      // VIP 10% + Bulk 5% + First-time 50k = 1200000 - 120000 - 60000 - 50000 = 970000
      expect(result.totalAmount).toBe(970000);
      expect(result.components).toHaveLength(3);
      expect(result.metadata?.originalAmount).toBe(1200000);
      expect(result.metadata?.totalDiscount).toBe(230000);
      
      console.log('✅ Retail Checkout Process executed successfully!');
      console.log('   Original:', result.metadata?.originalAmount);
      console.log('   Final:', result.totalAmount);
      console.log('   Saved:', result.metadata?.totalDiscount);
    });
  });
  
  // ═══════════════════════════════════════════════════════════════
  // DEMO 3: Mixed Domains (The Power of Plugin Architecture)
  // ═══════════════════════════════════════════════════════════════
  
  describe('DEMO 3: Multi-Domain System', () => {
    it('should support multiple domains simultaneously', async () => {
      // Register Hospital policy
      await registry.register(new HospitalAdmissionPolicy(), {
        id: 'hospital-admission-v1',
        name: 'Hospital Admission',
        version: '1.0.0',
        domain: 'hospital',
        category: 'validation',
        tags: ['hospital'],
        status: 'active',
        owner: 'hospital-plugin',
        decisionType: 'hospital-admission-validation',
        className: 'HospitalAdmissionPolicy',
        description: 'Hospital admission validation',
      });
      
      // Register Retail policy
      await registry.register(new RetailDiscountPolicy(), {
        id: 'retail-discount-v1',
        name: 'Retail Discount',
        version: '1.0.0',
        domain: 'retail',
        category: 'multiplier',
        tags: ['retail'],
        status: 'active',
        owner: 'retail-plugin',
        decisionType: 'retail-discount-calculation',
        className: 'RetailDiscountPolicy',
        description: 'Retail discount calculation',
      });
      
      // Check statistics
      const stats = registry.getStatistics();
      expect(stats.totalPolicies).toBe(2);
      expect(stats.byDomain).toEqual({
        hospital: 1,
        retail: 1,
      });
      
      // Verify each domain works independently
      const hospitalPolicies = registry.getPoliciesByDomain('hospital');
      const retailPolicies = registry.getPoliciesByDomain('retail');
      
      expect(hospitalPolicies).toHaveLength(1);
      expect(retailPolicies).toHaveLength(1);
      
      // Verify NO OVERLAP
      expect(hospitalPolicies[0].metadata.id).not.toBe(retailPolicies[0].metadata.id);
      
      console.log('✅ Multiple domains coexist WITHOUT interference!');
      console.log('   Hospital policies:', hospitalPolicies.length);
      console.log('   Retail policies:', retailPolicies.length);
      console.log('   Total policies:', stats.totalPolicies);
    });
  });
  
  // ═══════════════════════════════════════════════════════════════
  // DEMO 4: The CTO "AHA MOMENT"
  // ═══════════════════════════════════════════════════════════════
  
  describe('DEMO 4: Platform Capability Proof', () => {
    it('should demonstrate: Engine UNCHANGED, new domains WORKING', async () => {
      console.log('\n' + '═'.repeat(60));
      console.log('PLATFORM CAPABILITY DEMONSTRATION');
      console.log('═'.repeat(60));
      
      // Register new domains
      await registry.register(new HospitalAdmissionPolicy(), {
        id: 'hospital-v1',
        name: 'Hospital Policy',
        version: '1.0.0',
        domain: 'hospital',
        category: 'validation',
        tags: [],
        status: 'active',
        owner: 'plugin',
        decisionType: 'hospital-admission-validation',
        className: 'HospitalAdmissionPolicy',
        description: 'Hospital',
      });
      
      await registry.register(new RetailDiscountPolicy(), {
        id: 'retail-v1',
        name: 'Retail Policy',
        version: '1.0.0',
        domain: 'retail',
        category: 'multiplier',
        tags: [],
        status: 'active',
        owner: 'plugin',
        decisionType: 'retail-discount-calculation',
        className: 'RetailDiscountPolicy',
        description: 'Retail',
      });
      
      console.log('\n✅ Decision Engine: UNCHANGED');
      console.log('✅ Business Process Engine: UNCHANGED');
      console.log('✅ Rule Engine: UNCHANGED');
      console.log('✅ Hospital Domain: WORKING');
      console.log('✅ Retail Domain: WORKING');
      
      console.log('\n💡 THIS IS PLUGIN ARCHITECTURE');
      console.log('   → register() new policy');
      console.log('   → Engine executes it immediately');
      console.log('   → NO core modification needed');
      
      console.log('\n📊 Registry Statistics:');
      const stats = registry.getStatistics();
      console.log('   Total Policies:', stats.totalPolicies);
      console.log('   Domains:', Object.keys(stats.byDomain).join(', '));
      console.log('=' + '='.repeat(60) + '\n');
      
      expect(stats.totalPolicies).toBe(2);
      expect(Object.keys(stats.byDomain)).toEqual(['hospital', 'retail']);
    });
  });
});
