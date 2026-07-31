export * from './types';
export * from './rule-engine';
export * from './audit-engine';
export * from './sla-engine';
export * from './rotation-engine';
export * from './assignment-engine';
export * from './workflow-engine';

import { LeadRuleEngine } from './rule-engine';
import { LeadSLAEngine } from './sla-engine';
import { LeadRotationEngine } from './rotation-engine';
import { LeadAssignmentEngine } from './assignment-engine';
import { LeadWorkflowEngine } from './workflow-engine';
import { LeadRuleConfig } from './types';

/**
 * Unified Facade for Bella EIP Enterprise Lead Lifecycle System
 */
export class LeadEngineFacade {
  public ruleEngine: LeadRuleEngine;
  public slaEngine: LeadSLAEngine;
  public rotationEngine: LeadRotationEngine;
  public assignmentEngine: LeadAssignmentEngine;
  public workflowEngine: LeadWorkflowEngine;

  constructor(customRuleConfig?: Partial<LeadRuleConfig>) {
    this.ruleEngine = new LeadRuleEngine(customRuleConfig);
    this.slaEngine = new LeadSLAEngine(this.ruleEngine);
    this.rotationEngine = new LeadRotationEngine(this.ruleEngine);
    this.assignmentEngine = new LeadAssignmentEngine(this.slaEngine);
    this.workflowEngine = new LeadWorkflowEngine(
      this.ruleEngine,
      this.slaEngine,
      this.rotationEngine
    );
  }
}
