/**
 * @fileoverview Inference Engine
 * 
 * Generates Business Truth proposals from synthesized evidence.
 * 
 * CRITICAL: All outputs are PROPOSED, never APPROVED or CANONICAL.
 * 
 * @module platform/business-truth/research/inference-engine
 */

import type { BusinessTruth, Evidence } from '../types/business-truth';
import type { SynthesisResult, ResearchIntent } from './types';

/**
 * Inference Engine.
 * 
 * Generates PROPOSED Business Truths from evidence and synthesis.
 */
export class InferenceEngine {
  /**
   * Generate Business Truth proposals from synthesis.
   * 
   * @param intent - Research intent
   * @param evidence - Collected evidence
   * @param synthesis - Synthesis result
   * @returns Business Truth proposals (all PROPOSED)
   */
  infer(
    intent: ResearchIntent,
    evidence: Evidence[],
    synthesis: SynthesisResult
  ): BusinessTruth[] {
    const truths: BusinessTruth[] = [];
    
    // Generate entity proposals
    const entityProposals = this.inferEntities(intent, evidence, synthesis);
    truths.push(...entityProposals);
    
    // Generate process proposals (if focus includes processes)
    if (!intent.focus || intent.focus.includes('processes')) {
      const processProposals = this.inferProcesses(intent, evidence, synthesis);
      truths.push(...processProposals);
    }
    
    return truths;
  }
  
  /**
   * Infer core entities from evidence.
   */
  private inferEntities(
    intent: ResearchIntent,
    evidence: Evidence[],
    synthesis: SynthesisResult
  ): BusinessTruth[] {
    const truths: BusinessTruth[] = [];
    const now = new Date();
    
    // Infer primary entity based on industry
    const entityName = this.inferPrimaryEntityName(intent.industry);
    
    truths.push({
      id: `inference-entity-${entityName}-${now.getTime()}`,
      version: 1,
      createdAt: now,
      updatedAt: now,
      contentType: 'ENTITY',
      content: {
        name: entityName,
        description: `Core ${entityName} entity for ${intent.industry} industry`,
        attributes: this.inferEntityAttributes(entityName, intent, evidence)
      },
      epistemicStatus: 'INFERENCE',  // AI inferred from evidence
      status: 'PROPOSED',  // NOT APPROVED, NOT CANONICAL
      authority: {
        source: 'AI',
        type: 'PROPOSED',  // Research proposal
        approvedBy: null,  // NO approval
        approvedAt: null
      },
      provenance: {
        sources: evidence,
        reasoning: `Inferred from ${evidence.length} evidence source(s). ${synthesis.patterns.join('; ')}`,
        alternatives: synthesis.alternatives,
        conflicts: synthesis.conflicts
      },
      confidence: {
        score: synthesis.confidenceScore,
        basis: `Synthesized from ${evidence.length} sources with ${synthesis.patterns.length} patterns identified`,
        assumptions: synthesis.assumptions
      }
    });
    
    return truths;
  }
  
  /**
   * Infer primary entity name from industry.
   */
  private inferPrimaryEntityName(industry: string): string {
    const normalized = industry.toLowerCase();
    
    // Simple heuristic mapping
    if (normalized.includes('restaurant') || normalized.includes('food')) {
      return 'MenuItem';
    }
    if (normalized.includes('hotel') || normalized.includes('hospitality')) {
      return 'Room';
    }
    if (normalized.includes('retail') || normalized.includes('shop')) {
      return 'Product';
    }
    if (normalized.includes('healthcare') || normalized.includes('medical')) {
      return 'Patient';
    }
    if (normalized.includes('education') || normalized.includes('school')) {
      return 'Student';
    }
    
    // Default: generic service
    return 'ServiceItem';
  }
  
  /**
   * Infer entity attributes based on evidence.
   */
  private inferEntityAttributes(
    entityName: string,
    intent: ResearchIntent,
    evidence: Evidence[]
  ): Array<{ name: string; type: string; required?: boolean }> {
    // Common attributes for most entities
    const attributes: Array<{ name: string; type: string; required?: boolean }> = [
      { name: 'id', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'description', type: 'string' },
      { name: 'createdAt', type: 'date', required: true },
      { name: 'updatedAt', type: 'date', required: true }
    ];
    
    // Add industry-specific attributes based on entity type
    if (entityName.includes('Item') || entityName.includes('Product')) {
      attributes.push({ name: 'price', type: 'number' });
      attributes.push({ name: 'available', type: 'boolean' });
    }
    
    return attributes;
  }
  
  /**
   * Infer core processes from evidence.
   */
  private inferProcesses(
    intent: ResearchIntent,
    evidence: Evidence[],
    synthesis: SynthesisResult
  ): BusinessTruth[] {
    const truths: BusinessTruth[] = [];
    const now = new Date();
    
    // Infer primary process
    const processName = this.inferPrimaryProcessName(intent.industry);
    
    truths.push({
      id: `inference-process-${processName}-${now.getTime()}`,
      version: 1,
      createdAt: now,
      updatedAt: now,
      contentType: 'PROCESS',
      content: {
        name: processName,
        description: `Core ${processName} process for ${intent.industry} operations`,
        steps: this.inferProcessSteps(processName, intent),
        rules: []
      },
      epistemicStatus: 'INFERENCE',
      status: 'PROPOSED',
      authority: {
        source: 'AI',
        type: 'PROPOSED',
        approvedBy: null,
        approvedAt: null
      },
      provenance: {
        sources: evidence,
        reasoning: `Inferred from industry patterns. ${synthesis.patterns.join('; ')}`,
        alternatives: synthesis.alternatives,
        conflicts: synthesis.conflicts
      },
      confidence: {
        score: synthesis.confidenceScore * 0.9,  // Slightly lower for processes
        basis: `Process inference from ${evidence.length} sources`,
        assumptions: [...synthesis.assumptions, 'Standard workflow assumed']
      }
    });
    
    return truths;
  }
  
  /**
   * Infer primary process name from industry.
   */
  private inferPrimaryProcessName(industry: string): string {
    const normalized = industry.toLowerCase();
    
    if (normalized.includes('restaurant') || normalized.includes('food')) {
      return 'OrderFulfillment';
    }
    if (normalized.includes('hotel')) {
      return 'Reservation';
    }
    if (normalized.includes('retail')) {
      return 'SalesTransaction';
    }
    
    return 'ServiceDelivery';
  }
  
  /**
   * Infer process steps.
   */
  private inferProcessSteps(
    processName: string,
    intent: ResearchIntent
  ): Array<{ order: number; name: string; description?: string }> {
    // Generic workflow steps
    return [
      { order: 1, name: 'Initiate', description: `Start ${processName}` },
      { order: 2, name: 'Process', description: `Execute ${processName}` },
      { order: 3, name: 'Complete', description: `Finalize ${processName}` }
    ];
  }
}
