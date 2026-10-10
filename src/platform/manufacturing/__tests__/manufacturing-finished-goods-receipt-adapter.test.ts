import {
  LogisticsFinishedGoodsReceiptAdapter,
  type FinishedGoodsReceiptRequest,
} from '../ports';

describe('LogisticsFinishedGoodsReceiptAdapter', () => {
  it('maps Manufacturing finished goods receipt to the public Logistics stock-in contract', async () => {
    const execute = jest.fn(async () => ({
      ok: true as const,
      value: {
        tenantId: 'tenant-a',
        sourceDocumentId: 'fgr-1',
        lines: [],
      },
    }));
    const adapter = new LogisticsFinishedGoodsReceiptAdapter({ execute });
    const request: FinishedGoodsReceiptRequest = {
      tenantId: 'tenant-a',
      actorId: 'qa-user-1',
      correlationId: 'corr-1',
      productionOrderId: 'po-1',
      productionOrderLineId: 'po-line-1',
      idempotencyKey: 'receive-po-line-1-batch-1',
      receiptDocumentId: 'fgr-1',
      receiptDocumentNumber: 'FGR-001',
      receiptLineId: 'fgr-line-1',
      warehouseSkuId: 'warehouse-sku-fg-1',
      warehouseBinId: 'warehouse-bin-fg-1',
      itemId: 'finished-good-a',
      locationId: 'finished-goods-location-a',
      acceptedQuantity: 10,
      rejectedQuantity: 1,
      pendingQuantity: 0,
      qualityInspectionId: 'qc-1',
      unitOfMeasure: 'EA',
      lotNumber: 'LOT-FG-1',
      unitCost: 1000,
      currency: 'VND',
    };

    const result = await adapter.receive(request);

    expect(result.ok).toBe(true);
    expect(execute).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      actorId: 'qa-user-1',
      correlationId: 'corr-1',
      sourceDocument: {
        id: 'fgr-1',
        number: 'FGR-001',
        type: 'production_order',
      },
      productionOutputReference: {
        productionOrderId: 'po-1',
        productionOrderLineId: 'po-line-1',
        receiptLineId: 'fgr-line-1',
        idempotencyKey: 'receive-po-line-1-batch-1',
      },
      lines: [
        {
          warehouseSkuId: 'warehouse-sku-fg-1',
          warehouseBinId: 'warehouse-bin-fg-1',
          itemId: 'finished-good-a',
          locationId: 'finished-goods-location-a',
          quantity: 10,
          unitOfMeasure: 'EA',
          lotNumber: 'LOT-FG-1',
          serialNumbers: undefined,
          sourceLineId: 'fgr-line-1',
          unitCost: 1000,
          currency: 'VND',
          qualityDisposition: {
            acceptedQuantity: 10,
            rejectedQuantity: 1,
            pendingQuantity: 0,
            qualityInspectionId: 'qc-1',
          },
          metadata: {
            production_order_id: 'po-1',
            production_order_line_id: 'po-line-1',
            production_receipt_line_id: 'fgr-line-1',
            quality_inspection_id: 'qc-1',
          },
        },
      ],
    });
  });
});
