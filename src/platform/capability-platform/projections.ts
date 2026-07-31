import { ResourceEvent } from './types';
import { eventBus } from './event-bus';

export interface DashboardReadModel {
  totalAssigned: number;
  totalRotated: number;
  totalConverted: number;
  totalBreached: number;
  lastUpdated: string;
}

/**
 * Projection Engine for fast dashboard read models (CQRS-Lite)
 */
export class ProjectionEngine {
  private static instance: ProjectionEngine;
  private readModel: DashboardReadModel = {
    totalAssigned: 0,
    totalRotated: 0,
    totalConverted: 0,
    totalBreached: 0,
    lastUpdated: new Date().toISOString(),
  };

  private constructor() {
    eventBus.subscribe('resource.assigned', () => {
      this.readModel.totalAssigned += 1;
      this.readModel.lastUpdated = new Date().toISOString();
    });

    eventBus.subscribe('resource.rotated', () => {
      this.readModel.totalRotated += 1;
      this.readModel.lastUpdated = new Date().toISOString();
    });

    eventBus.subscribe('resource.workflow_transition', (event: ResourceEvent) => {
      const payload = event.payload as { toState?: string };
      if (payload.toState === 'converted' || payload.toState === 'resolved') {
        this.readModel.totalConverted += 1;
        this.readModel.lastUpdated = new Date().toISOString();
      }
    });
  }

  public static getInstance(): ProjectionEngine {
    if (!ProjectionEngine.instance) {
      ProjectionEngine.instance = new ProjectionEngine();
    }
    return ProjectionEngine.instance;
  }

  public getDashboardProjection(): DashboardReadModel {
    return { ...this.readModel };
  }
}

export const projectionEngine = ProjectionEngine.getInstance();
