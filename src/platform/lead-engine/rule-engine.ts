import { LeadRuleConfig, ManagedLead, LeadOutcome } from './types';

/**
 * Default Rule Configuration for Bella EIP Lead Engine
 */
export const DEFAULT_LEAD_RULE_CONFIG: LeadRuleConfig = {
  acceptWindowMinutes: 30,       // 30 phút chờ nhận lead
  followup1WindowHours: 2,       // 2 giờ cho Follow-up #1
  followup2WindowHours: 24,      // 24 giờ cho Follow-up #2
  maxNoAnswerAttempts: 2,       // 2 lần NO_ANSWER liên tiếp -> Rotate
  maxRotations: 3,              // Tối đa 3 vòng xoay Sale
  reminderBeforeMinutes: 10,     // Cảnh báo trước 10 phút
  autoRotateOnTimeout: true,
  escalateToManagerOnMaxRotations: true,
};

export class LeadRuleEngine {
  private config: LeadRuleConfig;

  constructor(customConfig?: Partial<LeadRuleConfig>) {
    this.config = { ...DEFAULT_LEAD_RULE_CONFIG, ...customConfig };
  }

  public getConfig(): LeadRuleConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<LeadRuleConfig>): LeadRuleConfig {
    this.config = { ...this.config, ...newConfig };
    return this.getConfig();
  }

  /**
   * Tính deadline ISO cho giai đoạn Accept (30 phút mặc định)
   */
  public calculateAcceptDeadline(startTimeISO: string): string {
    const start = new Date(startTimeISO).getTime();
    const deadline = start + this.config.acceptWindowMinutes * 60 * 1000;
    return new Date(deadline).toISOString();
  }

  /**
   * Tính deadline ISO cho Follow-up #1 (2 giờ mặc định)
   */
  public calculateFollowup1Deadline(startTimeISO: string): string {
    const start = new Date(startTimeISO).getTime();
    const deadline = start + this.config.followup1WindowHours * 60 * 60 * 1000;
    return new Date(deadline).toISOString();
  }

  /**
   * Tính deadline ISO cho Follow-up #2 (24 giờ mặc định)
   */
  public calculateFollowup2Deadline(startTimeISO: string): string {
    const start = new Date(startTimeISO).getTime();
    const deadline = start + this.config.followup2WindowHours * 60 * 60 * 1000;
    return new Date(deadline).toISOString();
  }

  /**
   * Kiểm tra xem Lead có cần Rotate hay không dựa trên Outcome và số lần thất bại
   */
  public shouldRotateOnOutcome(outcome: LeadOutcome, consecutiveNoAnswers: number): boolean {
    if (outcome === 'NO_ANSWER' && consecutiveNoAnswers >= this.config.maxNoAnswerAttempts) {
      return true;
    }
    return false;
  }

  /**
   * Kiểm tra xem lead đã vượt quá giới hạn số vòng xoay (Max Rotations) chưa
   */
  public isMaxRotationsReached(currentRotationCount: number): boolean {
    return currentRotationCount >= this.config.maxRotations;
  }

  /**
   * Kiểm tra xem Outcome có phải là kết quả kết thúc thành công (Stop SLA) hay không
   */
  public isTerminalOutcome(outcome: LeadOutcome): boolean {
    return ['BOOKING', 'LOST', 'WRONG_NUMBER', 'NOT_INTERESTED', 'INVALID', 'BLACKLIST'].includes(outcome);
  }
}
