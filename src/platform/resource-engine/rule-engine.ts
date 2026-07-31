import { ResourceRuleConfig } from './types';

export const DEFAULT_RESOURCE_RULE_CONFIG: ResourceRuleConfig = {
  acceptWindowMinutes: 30,
  stage1WindowHours: 2,
  stage2WindowHours: 24,
  maxAttempts: 2,
  maxRotations: 3,
  reminderBeforeMinutes: 10,
  autoRotateOnTimeout: true,
  escalateOnMaxRotations: true,
};

export class ResourceRuleEngine {
  private config: ResourceRuleConfig;

  constructor(customConfig?: Partial<ResourceRuleConfig>) {
    this.config = { ...DEFAULT_RESOURCE_RULE_CONFIG, ...customConfig };
  }

  public getConfig(): ResourceRuleConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<ResourceRuleConfig>): ResourceRuleConfig {
    this.config = { ...this.config, ...newConfig };
    return this.getConfig();
  }

  public calculateAcceptDeadline(startTimeISO: string): string {
    const start = new Date(startTimeISO).getTime();
    return new Date(start + this.config.acceptWindowMinutes * 60 * 1000).toISOString();
  }

  public calculateStage1Deadline(startTimeISO: string): string {
    const start = new Date(startTimeISO).getTime();
    return new Date(start + this.config.stage1WindowHours * 60 * 60 * 1000).toISOString();
  }

  public calculateStage2Deadline(startTimeISO: string): string {
    const start = new Date(startTimeISO).getTime();
    return new Date(start + this.config.stage2WindowHours * 60 * 60 * 1000).toISOString();
  }

  public shouldRotateOnAttempts(attempts: number): boolean {
    return attempts >= this.config.maxAttempts;
  }

  public isMaxRotationsReached(currentRotations: number): boolean {
    return currentRotations >= this.config.maxRotations;
  }
}
