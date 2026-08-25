/**
 * G11: AI Deployment Boundary Guard
 * 
 * Multi-layered protection against AI deployment:
 * - Layer 1: Constructor check (application-level)
 * - Layer 2: Credential access check (infrastructure-level)
 * - Layer 3: Deployment method check (runtime-level)
 * - Layer 4: Audit trail (evidence-level)
 * 
 * AI can PROPOSE. AI cannot DEPLOY.
 */

export interface ActorContext {
  type: 'AI_AGENT' | 'DEVELOPER' | 'DEPLOYMENT_ENGINE';
  id: string;
  hasDeploymentApproval: boolean;
  source: 'detected' | 'explicit';
}

export class AIDeploymentGuard {
  
  /**
   * Detect actor context
   * 
   * Multiple detection methods to prevent bypass
   */
  static detectActor(): ActorContext {
    // Detection Method 1: Kiro agent flag
    if (process.env.KIRO_AGENT === 'true') {
      return {
        type: 'AI_AGENT',
        id: 'kiro',
        hasDeploymentApproval: false,
        source: 'detected'
      };
    }
    
    // Detection Method 2: Anthropic API key presence
    if (process.env.ANTHROPIC_API_KEY !== undefined) {
      return {
        type: 'AI_AGENT',
        id: 'claude',
        hasDeploymentApproval: false,
        source: 'detected'
      };
    }
    
    // Detection Method 3: OpenAI API key presence
    if (process.env.OPENAI_API_KEY !== undefined) {
      return {
        type: 'AI_AGENT',
        id: 'openai',
        hasDeploymentApproval: false,
        source: 'detected'
      };
    }
    
    // Detection Method 4: Deployment engine service flag
    if (process.env.DEPLOYMENT_ENGINE_SERVICE === 'true') {
      return {
        type: 'DEPLOYMENT_ENGINE',
        id: 'bella_deployment_engine',
        hasDeploymentApproval: true,
        source: 'explicit'
      };
    }
    
    // Detection Method 5: Human developer (default)
    return {
      type: 'DEVELOPER',
      id: process.env.USER || process.env.USERNAME || 'unknown',
      hasDeploymentApproval: false,
      source: 'detected'
    };
  }
  
  /**
   * Enforce deployment boundary
   * 
   * Throws if AI attempts deployment
   */
  static enforceDeploymentBoundary(actor: ActorContext): void {
    if (actor.type === 'AI_AGENT') {
      this.blockAIDeployment(actor);
    }
    
    if (actor.type === 'DEVELOPER' && !actor.hasDeploymentApproval) {
      this.blockUnauthorizedDeployment(actor);
    }
    
    if (actor.type === 'DEPLOYMENT_ENGINE' && actor.source !== 'explicit') {
      throw new Error(
        'SECURITY VIOLATION: Deployment engine context must be explicitly set. ' +
        'Set DEPLOYMENT_ENGINE_SERVICE=true to enable deployment.'
      );
    }
  }
  
  private static blockAIDeployment(actor: ActorContext): never {
    const errorMessage = `
╔════════════════════════════════════════════════════════════════╗
║                  AI DEPLOYMENT BLOCKED                         ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  Actor: ${actor.id.padEnd(58)}║
║  Type:  AI_AGENT                                               ║
║                                                                ║
║  GOVERNANCE RULE:                                              ║
║  AI agents can PROPOSE migrations but cannot DEPLOY.          ║
║                                                                ║
║  WHY THIS BOUNDARY EXISTS:                                     ║
║  - Production database is critical infrastructure              ║
║  - AI cannot verify real-world impact                          ║
║  - Human judgment required for deployment decisions            ║
║  - Recovery strategies need human approval                     ║
║                                                                ║
║  WHAT YOU CAN DO:                                              ║
║  ✓ Propose migration files                                     ║
║  ✓ Run preflight validation                                    ║
║  ✓ Generate deployment evidence                                ║
║  ✓ Document recovery procedures                                ║
║                                                                ║
║  WHAT YOU CANNOT DO:                                           ║
║  ✗ Execute migrations                                          ║
║  ✗ Access production credentials                               ║
║  ✗ Modify schema_migrations                                    ║
║  ✗ Bypass governance gates                                     ║
║                                                                ║
║  TO DEPLOY:                                                    ║
║  Human operator must run deployment through authorized         ║
║  deployment engine service with explicit approval.             ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`;
    
    throw new Error(errorMessage);
  }
  
  private static blockUnauthorizedDeployment(actor: ActorContext): never {
    throw new Error(
      `AUTHORIZATION VIOLATION: User '${actor.id}' does not have deployment approval. ` +
      `Only authorized deployment operators can execute migrations. ` +
      `Request deployment approval from platform administrator.`
    );
  }
  
  /**
   * Test bypass attempts (for testing fail-closed behavior)
   */
  static testBypassAttempts(): {
    attempt: string;
    blocked: boolean;
    reason: string;
  }[] {
    const results = [];
    
    // Attempt 1: Direct constructor call
    try {
      const fakeContext: ActorContext = {
        type: 'DEPLOYMENT_ENGINE',
        id: 'fake',
        hasDeploymentApproval: true,
        source: 'detected' // Not 'explicit'
      };
      this.enforceDeploymentBoundary(fakeContext);
      results.push({
        attempt: 'Fake deployment engine (detected source)',
        blocked: false,
        reason: 'SECURITY BREACH: Fake context accepted'
      });
    } catch (error) {
      results.push({
        attempt: 'Fake deployment engine (detected source)',
        blocked: true,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Attempt 2: AI with approval flag
    try {
      const aiWithApproval: ActorContext = {
        type: 'AI_AGENT',
        id: 'malicious_ai',
        hasDeploymentApproval: true,
        source: 'explicit'
      };
      this.enforceDeploymentBoundary(aiWithApproval);
      results.push({
        attempt: 'AI with hasDeploymentApproval: true',
        blocked: false,
        reason: 'SECURITY BREACH: AI with approval flag accepted'
      });
    } catch (error) {
      results.push({
        attempt: 'AI with hasDeploymentApproval: true',
        blocked: true,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Attempt 3: Developer without approval
    try {
      const devWithoutApproval: ActorContext = {
        type: 'DEVELOPER',
        id: 'unauthorized_dev',
        hasDeploymentApproval: false,
        source: 'detected'
      };
      this.enforceDeploymentBoundary(devWithoutApproval);
      results.push({
        attempt: 'Developer without approval',
        blocked: false,
        reason: 'SECURITY BREACH: Unauthorized developer accepted'
      });
    } catch (error) {
      results.push({
        attempt: 'Developer without approval',
        blocked: true,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
    
    return results;
  }
}
