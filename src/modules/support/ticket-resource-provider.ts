/**
 * Bella EIP — Customer Support Ticket Resource Provider
 * Demonstrates 100% Reusability of Capability Platform (Zero Engine Code Modification)
 */

import {
  AssignableResource,
  TypedResourceDefinition,
  UniversalExecutionContext,
  WorkflowResource,
} from '@/platform/capability-platform/types';
import { resourceRegistry } from '@/platform/capability-platform/resource-registry';
import { resourceDBService } from '@/platform/capability-platform/resource-db-service';

export interface SupportTicketItem {
  id: string;
  tenantId: string;
  ticketNumber: string;
  customerName: string;
  customerPhone: string;
  subject: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'SERVICE_QUALITY' | 'BILLING' | 'TECHNICAL' | 'GENERAL';
  state: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  assignedToId?: string;
  assignedToName?: string;
  noAnswerCount: number;
  createdAt: string;
  updatedAt: string;
}

export const TICKET_RESOURCE_TYPE = 'ticket';

/**
 * 1. Define Support Ticket Resource Definition
 */
export const ticketResourceDefinition: TypedResourceDefinition = {
  resourceType: TICKET_RESOURCE_TYPE,
  label: 'Customer Support Ticket',
  schemaVersion: '1.0.0',
  defaultVersionBinding: {
    workflowVersion: 'v1.0',
    ruleVersion: 'v1.0',
    slaVersion: 'v1.0',
  },
  providers: new Map([
    [
      'assignment',
      {
        create: (ctx: UniversalExecutionContext) => ({
          assignTicket: async (ticket: SupportTicketItem, agentId: string, agentName: string) => {
            const resourceRef = {
              tenantId: ctx.tenant.id,
              resourceType: TICKET_RESOURCE_TYPE,
              resourceId: ticket.id,
            };

            await resourceDBService.logAssignment(
              resourceRef,
              agentId,
              agentName,
              ctx.actor.userId,
              ctx.actor.userName || 'System Admin',
              'PENDING_ACCEPTANCE'
            );

            await resourceDBService.logAuditEvent(
              resourceRef,
              'resource.assigned.v1',
              ctx.actor.userId,
              ctx.actor.userName || 'System Admin',
              `Assigned Ticket ${ticket.ticketNumber} to support agent ${agentName}`
            );

            return { ...ticket, state: 'ASSIGNED' as const, assignedToId: agentId, assignedToName: agentName };
          },
        }),
      },
    ],
    [
      'workflow',
      {
        create: (ctx: UniversalExecutionContext) => ({
          transition: async (ticket: SupportTicketItem, toState: SupportTicketItem['state']) => {
            const resourceRef = {
              tenantId: ctx.tenant.id,
              resourceType: TICKET_RESOURCE_TYPE,
              resourceId: ticket.id,
            };

            await resourceDBService.logAuditEvent(
              resourceRef,
              'resource.workflow.updated.v1',
              ctx.actor.userId,
              ctx.actor.userName || 'Support Agent',
              `Updated Ticket ${ticket.ticketNumber} state from ${ticket.state} to ${toState}`
            );

            return { ...ticket, state: toState, updatedAt: new Date().toISOString() };
          },
        }),
      },
    ],
  ]),
};

/**
 * Register Ticket Resource into Resource Registry
 */
export function registerTicketResourceProvider(): void {
  resourceRegistry.register({
    resourceType: TICKET_RESOURCE_TYPE,
    label: ticketResourceDefinition.label,
    schemaVersion: ticketResourceDefinition.schemaVersion,
    defaultVersionBinding: ticketResourceDefinition.defaultVersionBinding,
    providers: ticketResourceDefinition.providers,
  });
}
