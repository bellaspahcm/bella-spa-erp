/**
 * @fileoverview Bella Evidence Collector
 * 
 * Inspects existing Bella kernels/patterns for reusable evidence.
 * 
 * @module platform/business-truth/research/collectors/bella-collector
 */

import type { Evidence } from '../../types/business-truth';
import type { EvidenceCollection, ResearchIntent } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Bella pattern locations to inspect.
 */
const BELLA_KERNEL_PATHS = [
  'src/platform/spa',           // Spa Kernel
  'src/platform/finance',       // Finance Kernel
  'src/platform/healthcare',    // Healthcare Kernel
  'src/platform/real-estate',   // Real-Estate Kernel
  'src/platform/education',     // Education Kernel
];

/**
 * Bella Evidence Collector.
 * 
 * Inspects existing Bella kernels for reusable patterns.
 */
export class BellaCollector {
  private workspaceRoot: string;
  
  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }
  
  /**
   * Collect evidence from Bella kernels.
   * 
   * @param intent - Research intent
   * @returns Evidence collection
   */
  async collect(intent: ResearchIntent): Promise<EvidenceCollection> {
    const evidence: Evidence[] = [];
    const collectedAt = new Date();
    
    // Check which kernels exist
    for (const kernelPath of BELLA_KERNEL_PATHS) {
      const fullPath = path.join(this.workspaceRoot, kernelPath);
      
      if (!fs.existsSync(fullPath)) {
        continue;
      }
      
      // Check if kernel is relevant to intent
      const kernelName = path.basename(kernelPath);
      if (this.isKernelRelevant(kernelName, intent)) {
        // Inspect kernel structure
        const kernelEvidence = this.inspectKernel(fullPath, kernelName);
        evidence.push(...kernelEvidence);
      }
    }
    
    return {
      evidence,
      collectedAt,
      collectorType: 'BELLA'
    };
  }
  
  /**
   * Check if kernel is relevant to research intent.
   */
  private isKernelRelevant(kernelName: string, intent: ResearchIntent): boolean {
    const industry = intent.industry.toLowerCase();
    const kernel = kernelName.toLowerCase();
    
    // Direct match (e.g., "healthcare" intent → healthcare kernel)
    if (industry.includes(kernel) || kernel.includes(industry)) {
      return true;
    }
    
    // Spa kernel is relevant for service-based industries
    if (kernel === 'spa' && (
      industry.includes('service') ||
      industry.includes('appointment') ||
      industry.includes('booking')
    )) {
      return true;
    }
    
    // Finance kernel is relevant for transaction-based industries
    if (kernel === 'finance' && (
      industry.includes('transaction') ||
      industry.includes('payment') ||
      industry.includes('accounting')
    )) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Inspect kernel and extract evidence.
   */
  private inspectKernel(kernelPath: string, kernelName: string): Evidence[] {
    const evidence: Evidence[] = [];
    
    try {
      // Check for key directories
      const hasDomain = fs.existsSync(path.join(kernelPath, 'domain'));
      const hasContracts = fs.existsSync(path.join(kernelPath, 'contracts'));
      const hasEngines = fs.existsSync(path.join(kernelPath, 'engines'));
      
      // Create evidence for kernel existence
      evidence.push({
        id: `bella-${kernelName}-${Date.now()}`,
        type: 'BELLA_KERNEL',
        source: kernelPath,
        strength: 'STRONG',  // Existing Bella patterns are strong evidence
        timestamp: new Date(),
        content: {
          kernelName,
          structure: {
            hasDomain,
            hasContracts,
            hasEngines
          }
        }
      });
      
    } catch (error) {
      // Inspection failed - return empty evidence
      console.warn(`Failed to inspect kernel ${kernelName}:`, error);
    }
    
    return evidence;
  }
}
