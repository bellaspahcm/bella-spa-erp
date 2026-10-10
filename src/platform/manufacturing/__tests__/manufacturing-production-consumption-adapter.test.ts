import {
  LogisticsProductionConsumptionIssueAdapter,
  type ProductionConsumptionIssueRequest,
} from '../ports';

describe('LogisticsProductionConsumptionIssueAdapter', () => {
  it('maps Manufacturing production consumption to the public Logistics stock-out contract', async () => {
    const execute = jest.fn(async () => ({
      ok: true as const,
      value: {
        tenantId: 'tenant-a',
        issueDocumentId: 'issue-1',
        lines: [],
      },
    }));
    const adapter = new LogisticsProductionConsumptionIssueAdapter({ execute });
    const request: ProductionConsumptionIssueRequest = {
      tenantId: 'tenant-a',
      actorId: 'planner-1',
      correlationId: 'corr-1',
      productionOrderId: 'po-1',
      productionOrderLineId: 'po-line-1',
      idempotencyKey: 'consume-po-line-1',
      issueDocumentId: 'issue-1',
      issueDocumentNumber: 'PC-001',
      warehouseSkuId: 'warehouse-sku-1',
      warehouseBinId: 'warehouse-bin-1',
      itemId: 'component-a',
      locationId: 'location-a',
      quantity: 3,
      unitOfMeasure: 'EA',
      materialRequirementId: 'req-1',
    };

    const result = await adapter.issue(request);

    expect(result.ok).toBe(true);
    expect(execute).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      actorId: 'planner-1',
      correlationId: 'corr-1',
      issueDocument: {
        id: 'issue-1',
        number: 'PC-001',
        type: 'production_consumption',
      },
      productionConsumptionReference: {
        productionOrderId: 'po-1',
        productionOrderLineId: 'po-line-1',
        idempotencyKey: 'consume-po-line-1',
      },
      lines: [
        {
          warehouseSkuId: 'warehouse-sku-1',
          warehouseBinId: 'warehouse-bin-1',
          itemId: 'component-a',
          locationId: 'location-a',
          quantity: 3,
          unitOfMeasure: 'EA',
          reason: 'production_consumption',
          lotNumber: undefined,
          serialNumbers: undefined,
          sourceLineId: 'req-1',
          metadata: {
            production_order_id: 'po-1',
            production_order_line_id: 'po-line-1',
            material_requirement_id: 'req-1',
          },
        },
      ],
    });
  });
});
