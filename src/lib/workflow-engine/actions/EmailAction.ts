/**
 * Email Action - Reference Implementation
 * 
 * Simple email sending implementation của IWorkflowAction.
 * Đây là reference implementation để demo cách implement interface.
 * 
 * Supports:
 * - Send email with templates
 * - HTML and plain text emails
 * - Attachments (optional)
 * - Email validation
 * 
 * @example
 * ```typescript
 * const emailAction = new EmailAction({
 *   smtpHost: 'smtp.example.com',
 *   smtpPort: 587,
 *   from: 'noreply@bella.vn'
 * });
 * 
 * const result = await emailAction.execute({
 *   executionId: 'exec-123',
 *   workflowId: 'wf-456',
 *   stepId: 'step-1',
 *   config: {
 *     actionType: 'email',
 *     to: 'customer@example.com',
 *     subject: 'Welcome to Bella ERP',
 *     body: 'Hello {{name}}, welcome aboard!',
 *     templateVars: { name: 'John' }
 *   },
 *   input: {},
 *   tenantId: 'tenant-1'
 * });
 * 
 * console.log(result.success); // true
 * console.log(result.output?.messageId); // 'msg-123'
 * ```
 */

import {
  BaseWorkflowAction,
  type WorkflowContext,
  type ActionResult,
  type ActionConfig,
  type ActionValidationResult
} from '../abstractions/IWorkflowAction';

/**
 * Email action configuration
 */
export interface EmailActionConfig extends ActionConfig {
  actionType: 'email';
  
  /** Recipient email address */
  to: string | string[];
  
  /** Email subject */
  subject: string;
  
  /** Email body (supports template variables) */
  body: string;
  
  /** CC recipients (optional) */
  cc?: string | string[];
  
  /** BCC recipients (optional) */
  bcc?: string | string[];
  
  /** Reply-To address (optional) */
  replyTo?: string;
  
  /** Whether body is HTML (default: false) */
  isHtml?: boolean;
  
  /** Template variables for interpolation */
  templateVars?: Record<string, unknown>;
  
  /** Attachments (optional) */
  attachments?: Array<{
    filename: string;
    content?: string; // Base64
    path?: string;    // File path
  }>;
}

/**
 * Email service configuration
 */
export interface EmailServiceConfig {
  /** SMTP host */
  smtpHost: string;
  
  /** SMTP port */
  smtpPort: number;
  
  /** SMTP username (optional) */
  smtpUser?: string;
  
  /** SMTP password (optional) */
  smtpPassword?: string;
  
  /** Use TLS (default: true) */
  useTLS?: boolean;
  
  /** From email address */
  from: string;
  
  /** From name (optional) */
  fromName?: string;
}

/**
 * Email Action Implementation
 * 
 * Simple email sending action.
 * Production implementation nên:
 * - Integrate với actual email service (SendGrid, AWS SES, etc.)
 * - Queue emails for batch sending
 * - Track email status (sent, delivered, bounced, opened)
 * - Support advanced templates (Handlebars, Liquid)
 * - Handle rate limiting
 */
export class EmailAction extends BaseWorkflowAction {
  readonly actionType = 'email';
  readonly version = '1.0.0';
  readonly displayName = 'Send Email';
  readonly description = 'Send email to recipients with optional templates and attachments';
  
  private serviceConfig: EmailServiceConfig;
  
  constructor(serviceConfig: EmailServiceConfig) {
    super();
    this.serviceConfig = serviceConfig;
  }
  
  /**
   * Execute email action
   */
  async execute(context: WorkflowContext): Promise<ActionResult> {
    const config = context.config as EmailActionConfig;
    
    try {
      // Validate configuration
      const validation = this.validate(config);
      if (!validation.valid) {
        return this.failure(
          `Invalid configuration: ${validation.errors?.join(', ')}`,
          false
        );
      }
      
      // Prepare email data
      const emailData = this.prepareEmailData(config, context);
      
      // Send email (mock implementation - production would use real service)
      const messageId = await this.sendEmail(emailData);
      
      // Return success result
      return this.success({
        messageId,
        to: emailData.to,
        subject: emailData.subject,
        sentAt: new Date().toISOString()
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Determine if retryable (network errors, rate limits)
      const retryable = this.isRetryableError(error);
      
      return this.failure(
        `Failed to send email: ${errorMessage}`,
        retryable
      );
    }
  }
  
  /**
   * Validate email action configuration
   */
  validate(config: ActionConfig): ActionValidationResult {
    // Call base validation
    const baseValidation = super.validate(config);
    if (!baseValidation.valid) {
      return baseValidation;
    }
    
    const emailConfig = config as EmailActionConfig;
    const errors: string[] = [];
    
    // Validate required fields
    if (!emailConfig.to) {
      errors.push('Recipient email (to) is required');
    } else {
      // Validate email format
      const recipients = Array.isArray(emailConfig.to) ? emailConfig.to : [emailConfig.to];
      for (const email of recipients) {
        if (!this.isValidEmail(email)) {
          errors.push(`Invalid email address: ${email}`);
        }
      }
    }
    
    if (!emailConfig.subject) {
      errors.push('Email subject is required');
    }
    
    if (!emailConfig.body) {
      errors.push('Email body is required');
    }
    
    // Validate optional CC/BCC emails
    if (emailConfig.cc) {
      const ccEmails = Array.isArray(emailConfig.cc) ? emailConfig.cc : [emailConfig.cc];
      for (const email of ccEmails) {
        if (!this.isValidEmail(email)) {
          errors.push(`Invalid CC email address: ${email}`);
        }
      }
    }
    
    if (emailConfig.bcc) {
      const bccEmails = Array.isArray(emailConfig.bcc) ? emailConfig.bcc : [emailConfig.bcc];
      for (const email of bccEmails) {
        if (!this.isValidEmail(email)) {
          errors.push(`Invalid BCC email address: ${email}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
  
  /**
   * Rollback email action
   * (Cannot unsend email, so this is a no-op)
   */
  async rollback(context: WorkflowContext): Promise<void> {
    // Cannot rollback sent email
    // In production, might:
    // - Send cancellation/correction email
    // - Log rollback attempt
    // - Update email tracking status
    console.warn(`Cannot rollback email action for execution ${context.executionId}`);
  }
  
  /**
   * Get action configuration schema
   */
  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        actionType: { type: 'string', const: 'email' },
        to: {
          oneOf: [
            { type: 'string', format: 'email' },
            { type: 'array', items: { type: 'string', format: 'email' } }
          ],
          description: 'Recipient email address(es)'
        },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (supports template variables)' },
        cc: {
          oneOf: [
            { type: 'string', format: 'email' },
            { type: 'array', items: { type: 'string', format: 'email' } }
          ],
          description: 'CC recipients (optional)'
        },
        bcc: {
          oneOf: [
            { type: 'string', format: 'email' },
            { type: 'array', items: { type: 'string', format: 'email' } }
          ],
          description: 'BCC recipients (optional)'
        },
        replyTo: { type: 'string', format: 'email', description: 'Reply-To address' },
        isHtml: { type: 'boolean', default: false, description: 'Whether body is HTML' },
        templateVars: { type: 'object', description: 'Template variables' }
      },
      required: ['actionType', 'to', 'subject', 'body']
    };
  }
  
  /**
   * Prepare email data with template interpolation
   */
  private prepareEmailData(config: EmailActionConfig, context: WorkflowContext) {
    // Interpolate template variables in subject and body
    const subject = this.interpolateTemplate(config.subject, config.templateVars, context);
    const body = this.interpolateTemplate(config.body, config.templateVars, context);
    
    return {
      to: Array.isArray(config.to) ? config.to : [config.to],
      cc: config.cc ? (Array.isArray(config.cc) ? config.cc : [config.cc]) : [],
      bcc: config.bcc ? (Array.isArray(config.bcc) ? config.bcc : [config.bcc]) : [],
      replyTo: config.replyTo,
      subject,
      body,
      isHtml: config.isHtml ?? false,
      attachments: config.attachments || [],
      from: this.serviceConfig.fromName 
        ? `${this.serviceConfig.fromName} <${this.serviceConfig.from}>`
        : this.serviceConfig.from
    };
  }
  
  /**
   * Interpolate template variables
   * Supports {{variable}} syntax
   */
  private interpolateTemplate(
    template: string,
    vars?: Record<string, unknown>,
    context?: WorkflowContext
  ): string {
    let result = template;
    
    // Interpolate config vars
    if (vars) {
      for (const [key, value] of Object.entries(vars)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        result = result.replace(regex, String(value));
      }
    }
    
    // Interpolate context vars (workflow data)
    if (context?.input) {
      for (const [key, value] of Object.entries(context.input)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        result = result.replace(regex, String(value));
      }
    }
    
    return result;
  }
  
  /**
   * Send email (mock implementation)
   * Production would integrate with SendGrid, AWS SES, etc.
   */
  private async sendEmail(emailData: {
    to: string[];
    cc: string[];
    bcc: string[];
    replyTo?: string;
    subject: string;
    body: string;
    isHtml: boolean;
    attachments: unknown[];
    from: string;
  }): Promise<string> {
    // Mock implementation - just log and return fake message ID
    console.log('[EmailAction] Sending email:', {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      bodyPreview: emailData.body.substring(0, 50) + '...'
    });
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Return mock message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return messageId;
    
    /* Production implementation would look like:
    
    const transporter = nodemailer.createTransport({
      host: this.serviceConfig.smtpHost,
      port: this.serviceConfig.smtpPort,
      secure: this.serviceConfig.useTLS,
      auth: this.serviceConfig.smtpUser ? {
        user: this.serviceConfig.smtpUser,
        pass: this.serviceConfig.smtpPassword
      } : undefined
    });
    
    const info = await transporter.sendMail({
      from: emailData.from,
      to: emailData.to.join(', '),
      cc: emailData.cc.join(', '),
      bcc: emailData.bcc.join(', '),
      replyTo: emailData.replyTo,
      subject: emailData.subject,
      text: emailData.isHtml ? undefined : emailData.body,
      html: emailData.isHtml ? emailData.body : undefined,
      attachments: emailData.attachments
    });
    
    return info.messageId;
    */
  }
  
  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    
    // Network errors are retryable
    if (error.message.includes('ETIMEDOUT') || 
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')) {
      return true;
    }
    
    // Rate limit errors are retryable
    if (error.message.includes('rate limit') || 
        error.message.includes('429')) {
      return true;
    }
    
    // Other errors (invalid email, auth failure) are not retryable
    return false;
  }
}

/**
 * Helper function to create email action config
 * 
 * @example
 * ```typescript
 * const config = createEmailActionConfig({
 *   to: 'customer@example.com',
 *   subject: 'Welcome {{name}}!',
 *   body: 'Hello {{name}}, welcome to Bella ERP!',
 *   templateVars: { name: 'John Doe' },
 *   isHtml: false
 * });
 * ```
 */
export function createEmailActionConfig(
  options: Omit<EmailActionConfig, 'actionType'>
): EmailActionConfig {
  return {
    ...options,
    actionType: 'email'
  } as EmailActionConfig;
}
