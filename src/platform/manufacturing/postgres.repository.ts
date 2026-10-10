import type { QueryResultRow } from 'pg';

import type {
  BOMComponent,
  BOMRevision,
  CommandLogEntry,
  ManufacturingId,
  MaterialRequirement,
  ProductionOrder,
  TenantId,
} from './domain/types';
import type { ManufacturingRepository } from './ports';

export interface ManufacturingSqlClient {
  query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
}

type ProductionOrderRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  factory_org_unit_id: string;
  order_number: string;
  finished_good_item_id: string;
  target_quantity: string | number;
  uom: string;
  status: ProductionOrder['status'];
  bom_revision_id: string | null;
  created_by: string;
  created_at: string | Date;
  released_by: string | null;
  released_at: string | Date | null;
};

type BOMRevisionRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  finished_good_item_id: string;
  revision_code: string;
  status: BOMRevision['status'];
  created_by: string;
  created_at: string | Date;
  approved_by: string | null;
  approved_at: string | Date | null;
};

type BOMComponentRow = QueryResultRow & {
  id: string;
  component_item_id: string;
  quantity_per_unit: string | number;
  uom: string;
  scrap_allowance_percent: string | number | null;
};

type MaterialRequirementRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  production_order_id: string;
  bom_revision_id: string;
  component_item_id: string;
  source_location_id: string;
  required_quantity: string | number;
  available_quantity: string | number | null;
  status: MaterialRequirement['status'];
  checked_at: string | Date | null;
};

type CommandLogRow<T> = QueryResultRow & {
  tenant_id: string;
  factory_org_unit_id: string;
  operation: string;
  business_key: string;
  payload_hash: string;
  result: T;
  created_at: string | Date;
};

export class PostgresManufacturingRepository implements ManufacturingRepository {
  constructor(
    private readonly db: ManufacturingSqlClient,
    private readonly inTransaction = false
  ) {}

  async withTransaction<T>(callback: (repository: ManufacturingRepository) => Promise<T>): Promise<T> {
    if (this.inTransaction) return callback(this);
    await this.db.query('BEGIN');
    try {
      const result = await callback(new PostgresManufacturingRepository(this.db, true));
      await this.db.query('COMMIT');
      return result;
    } catch (error) {
      await this.db.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async saveProductionOrder(order: ProductionOrder): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.manufacturing_production_orders (
          id, tenant_id, factory_org_unit_id, order_number, finished_good_item_id,
          target_quantity, uom, status, bom_revision_id, created_by, created_at,
          released_by, released_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          status = EXCLUDED.status,
          bom_revision_id = EXCLUDED.bom_revision_id,
          released_by = EXCLUDED.released_by,
          released_at = EXCLUDED.released_at,
          updated_at = NOW()
      `,
      [
        order.id,
        order.tenantId,
        order.factoryOrgUnitId,
        order.orderNumber,
        order.finishedGoodItemId,
        order.targetQuantity,
        order.uom,
        order.status,
        order.bomRevisionId ?? null,
        order.createdBy,
        order.createdAt,
        order.releasedBy ?? null,
        order.releasedAt ?? null,
      ]
    );

    await this.db.query(
      `
        INSERT INTO public.manufacturing_production_order_lines (
          tenant_id, production_order_id, finished_good_item_id, target_quantity, uom
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (tenant_id, production_order_id, finished_good_item_id)
        DO UPDATE SET
          target_quantity = EXCLUDED.target_quantity,
          uom = EXCLUDED.uom
      `,
      [order.tenantId, order.id, order.finishedGoodItemId, order.targetQuantity, order.uom]
    );
  }

  async getProductionOrder(tenantId: TenantId, id: ManufacturingId): Promise<ProductionOrder | null> {
    const result = await this.db.query<ProductionOrderRow>(
      'SELECT * FROM public.manufacturing_production_orders WHERE tenant_id = $1 AND id = $2',
      [tenantId, id]
    );
    return result.rows[0] ? this.mapProductionOrder(result.rows[0]) : null;
  }

  async findProductionOrderByNumber(tenantId: TenantId, orderNumber: string): Promise<ProductionOrder | null> {
    const result = await this.db.query<ProductionOrderRow>(
      'SELECT * FROM public.manufacturing_production_orders WHERE tenant_id = $1 AND order_number = $2',
      [tenantId, orderNumber]
    );
    return result.rows[0] ? this.mapProductionOrder(result.rows[0]) : null;
  }

  async saveBOMRevision(revision: BOMRevision): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.manufacturing_bom_revisions (
          id, tenant_id, finished_good_item_id, revision_code, status,
          created_by, created_at, approved_by, approved_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          status = EXCLUDED.status,
          approved_by = EXCLUDED.approved_by,
          approved_at = EXCLUDED.approved_at,
          updated_at = NOW()
      `,
      [
        revision.id,
        revision.tenantId,
        revision.finishedGoodItemId,
        revision.revisionCode,
        revision.status,
        revision.createdBy,
        revision.createdAt,
        revision.approvedBy ?? null,
        revision.approvedAt ?? null,
      ]
    );

    await this.db.query(
      'DELETE FROM public.manufacturing_bom_components WHERE tenant_id = $1 AND bom_revision_id = $2',
      [revision.tenantId, revision.id]
    );
    for (const component of revision.components) {
      await this.db.query(
        `
          INSERT INTO public.manufacturing_bom_components (
            id, tenant_id, bom_revision_id, component_item_id,
            quantity_per_unit, uom, scrap_allowance_percent
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          component.id,
          revision.tenantId,
          revision.id,
          component.componentItemId,
          component.quantityPerUnit,
          component.uom,
          component.scrapAllowancePercent ?? null,
        ]
      );
    }
  }

  async getBOMRevision(tenantId: TenantId, id: ManufacturingId): Promise<BOMRevision | null> {
    const revisions = await this.db.query<BOMRevisionRow>(
      'SELECT * FROM public.manufacturing_bom_revisions WHERE tenant_id = $1 AND id = $2',
      [tenantId, id]
    );
    const revision = revisions.rows[0];
    if (!revision) return null;
    return this.mapBOMRevision(revision, await this.getBOMComponents(tenantId, id));
  }

  async findBOMRevisionByCode(params: {
    tenantId: TenantId;
    finishedGoodItemId: string;
    revisionCode: string;
  }): Promise<BOMRevision | null> {
    const revisions = await this.db.query<BOMRevisionRow>(
      `
        SELECT * FROM public.manufacturing_bom_revisions
        WHERE tenant_id = $1 AND finished_good_item_id = $2 AND revision_code = $3
      `,
      [params.tenantId, params.finishedGoodItemId, params.revisionCode]
    );
    const revision = revisions.rows[0];
    if (!revision) return null;
    return this.mapBOMRevision(revision, await this.getBOMComponents(params.tenantId, revision.id));
  }

  async saveMaterialRequirements(requirements: MaterialRequirement[]): Promise<void> {
    for (const requirement of requirements) {
      await this.db.query(
        `
          INSERT INTO public.manufacturing_material_requirements (
            id, tenant_id, production_order_id, bom_revision_id, component_item_id,
            source_location_id, required_quantity, available_quantity, status, checked_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (tenant_id, id)
          DO UPDATE SET
            available_quantity = EXCLUDED.available_quantity,
            status = EXCLUDED.status,
            checked_at = EXCLUDED.checked_at,
            updated_at = NOW()
        `,
        [
          requirement.id,
          requirement.tenantId,
          requirement.productionOrderId,
          requirement.bomRevisionId,
          requirement.componentItemId,
          requirement.sourceLocationId,
          requirement.requiredQuantity,
          requirement.availableQuantity ?? null,
          requirement.status,
          requirement.checkedAt ?? null,
        ]
      );
    }
  }

  async getMaterialRequirements(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
    bomRevisionId: ManufacturingId;
  }): Promise<MaterialRequirement[]> {
    const result = await this.db.query<MaterialRequirementRow>(
      `
        SELECT * FROM public.manufacturing_material_requirements
        WHERE tenant_id = $1 AND production_order_id = $2 AND bom_revision_id = $3
        ORDER BY component_item_id
      `,
      [params.tenantId, params.productionOrderId, params.bomRevisionId]
    );
    return result.rows.map((row) => this.mapMaterialRequirement(row));
  }

  async getCommandLog<T = unknown>(params: {
    tenantId: TenantId;
    operation: string;
    businessKey: string;
  }): Promise<CommandLogEntry<T> | null> {
    const result = await this.db.query<CommandLogRow<T>>(
      `
        SELECT tenant_id, factory_org_unit_id, operation, business_key, payload_hash, result, created_at
        FROM public.manufacturing_command_idempotency
        WHERE tenant_id = $1 AND operation = $2 AND business_key = $3
      `,
      [params.tenantId, params.operation, params.businessKey]
    );
    const row = result.rows[0];
    return row
      ? {
          tenantId: row.tenant_id,
          factoryOrgUnitId: row.factory_org_unit_id,
          operation: row.operation,
          businessKey: row.business_key,
          payloadHash: row.payload_hash,
          result: row.result,
          createdAt: toTimestamp(row.created_at),
        }
      : null;
  }

  async saveCommandLog<T>(entry: CommandLogEntry<T>): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.manufacturing_command_idempotency (
          tenant_id, factory_org_unit_id, operation, business_key, payload_hash, result, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        entry.tenantId,
        entry.factoryOrgUnitId,
        entry.operation,
        entry.businessKey,
        entry.payloadHash,
        JSON.stringify(entry.result),
        entry.createdAt,
      ]
    );
  }

  private async getBOMComponents(tenantId: TenantId, bomRevisionId: ManufacturingId): Promise<BOMComponent[]> {
    const result = await this.db.query<BOMComponentRow>(
      `
        SELECT id, component_item_id, quantity_per_unit, uom, scrap_allowance_percent
        FROM public.manufacturing_bom_components
        WHERE tenant_id = $1 AND bom_revision_id = $2
        ORDER BY component_item_id
      `,
      [tenantId, bomRevisionId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      componentItemId: row.component_item_id,
      quantityPerUnit: toNumber(row.quantity_per_unit),
      uom: row.uom,
      scrapAllowancePercent:
        row.scrap_allowance_percent === null ? undefined : toNumber(row.scrap_allowance_percent),
    }));
  }

  private mapProductionOrder(row: ProductionOrderRow): ProductionOrder {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      factoryOrgUnitId: row.factory_org_unit_id,
      orderNumber: row.order_number,
      finishedGoodItemId: row.finished_good_item_id,
      targetQuantity: toNumber(row.target_quantity),
      uom: row.uom,
      status: row.status,
      bomRevisionId: row.bom_revision_id ?? undefined,
      createdBy: row.created_by,
      createdAt: toTimestamp(row.created_at),
      releasedBy: row.released_by ?? undefined,
      releasedAt: row.released_at ? toTimestamp(row.released_at) : undefined,
    };
  }

  private mapBOMRevision(row: BOMRevisionRow, components: BOMComponent[]): BOMRevision {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      finishedGoodItemId: row.finished_good_item_id,
      revisionCode: row.revision_code,
      status: row.status,
      components,
      createdBy: row.created_by,
      createdAt: toTimestamp(row.created_at),
      approvedBy: row.approved_by ?? undefined,
      approvedAt: row.approved_at ? toTimestamp(row.approved_at) : undefined,
    };
  }

  private mapMaterialRequirement(row: MaterialRequirementRow): MaterialRequirement {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      productionOrderId: row.production_order_id,
      bomRevisionId: row.bom_revision_id,
      componentItemId: row.component_item_id,
      sourceLocationId: row.source_location_id,
      requiredQuantity: toNumber(row.required_quantity),
      availableQuantity: row.available_quantity === null ? undefined : toNumber(row.available_quantity),
      status: row.status,
      checkedAt: row.checked_at ? toTimestamp(row.checked_at) : undefined,
    };
  }
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function toTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
