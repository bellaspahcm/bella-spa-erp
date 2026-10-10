type QualityDisposition =
  | 'accepted'
  | 'conditional_accept'
  | 'rework'
  | 'scrap'
  | 'discard_reject'
  | 'pending';

type SourceQuantityType = 'accepted' | 'rejected' | 'scrap' | 'pending';

interface QualityDispositionCommand {
  tenantId: string;
  factoryOrgUnitId: string;
  productionOrderLineId: string;
  productionExecutionId: string;
  sourceQuantityType: SourceQuantityType;
  disposition: QualityDisposition;
  quantity: number;
  acceptedOutputQuantity: number;
  reasonCode?: string;
  evidenceReference?: string;
  finalHandlingDecision?: boolean;
  conditionalAcceptPolicyApproved?: boolean;
  decidedBy: string;
  decidedAt: string;
  idempotencyKey: string;
}

interface QualityDispositionContext {
  tenantId: string;
  factoryOrgUnitId: string;
  productionOrderLineId: string;
  productionExecutionId: string;
  quantities: Record<SourceQuantityType, number>;
}

interface QualityDispositionEvidence extends QualityDispositionCommand {
  id: string;
  terminal: boolean;
}

class ContractBoundaryError extends Error {}

class QualityDispositionContractHarness {
  private readonly records = new Map<string, QualityDispositionEvidence>();
  private readonly idempotency = new Map<string, { payloadHash: string; result: QualityDispositionEvidence }>();
  private readonly inFlight = new Map<string, Promise<QualityDispositionEvidence>>();
  private nextId = 1;

  async record(
    context: QualityDispositionContext,
    command: QualityDispositionCommand
  ): Promise<QualityDispositionEvidence> {
    const idempotencyScope = `${command.tenantId}:manufacturing.quality_disposition.record:${command.idempotencyKey}`;
    const payloadHash = JSON.stringify(command);
    const stored = this.idempotency.get(idempotencyScope);
    if (stored) {
      if (stored.payloadHash !== payloadHash) {
        throw new ContractBoundaryError('IDEMPOTENCY_PAYLOAD_CONFLICT');
      }
      return stored.result;
    }

    const pending = this.inFlight.get(idempotencyScope);
    if (pending) {
      return pending;
    }

    const promise = Promise.resolve().then(() => {
      const existing = this.idempotency.get(idempotencyScope);
      if (existing) {
        if (existing.payloadHash !== payloadHash) {
          throw new ContractBoundaryError('IDEMPOTENCY_PAYLOAD_CONFLICT');
        }
        return existing.result;
      }

      const result = this.evaluate(context, command);
      this.idempotency.set(idempotencyScope, { payloadHash, result });
      this.records.set(result.id, result);
      return result;
    }).finally(() => {
      this.inFlight.delete(idempotencyScope);
    });

    this.inFlight.set(idempotencyScope, promise);
    return promise;
  }

  canComplete(evidence: QualityDispositionEvidence[]): boolean {
    return evidence.every((item) => item.terminal);
  }

  countRecords(): number {
    return this.records.size;
  }

  private evaluate(
    context: QualityDispositionContext,
    command: QualityDispositionCommand
  ): QualityDispositionEvidence {
    if (command.tenantId !== context.tenantId || command.factoryOrgUnitId !== context.factoryOrgUnitId) {
      throw new ContractBoundaryError('TENANT_OR_FACTORY_MISMATCH');
    }
    if (
      command.productionOrderLineId !== context.productionOrderLineId ||
      command.productionExecutionId !== context.productionExecutionId
    ) {
      throw new ContractBoundaryError('PRODUCTION_EVIDENCE_MISMATCH');
    }
    if (!Number.isFinite(command.quantity) || command.quantity <= 0) {
      throw new ContractBoundaryError('INVALID_QUANTITY');
    }
    if (!command.decidedBy.trim() || !command.decidedAt.trim()) {
      throw new ContractBoundaryError('DECISION_ACTOR_AND_TIME_REQUIRED');
    }
    if (command.quantity > context.quantities[command.sourceQuantityType]) {
      throw new ContractBoundaryError('DISPOSITION_QUANTITY_EXCEEDS_SOURCE');
    }

    const terminal = this.resolveTerminal(command);
    return {
      ...command,
      id: `quality-disposition-${this.nextId++}`,
      terminal,
    };
  }

  private resolveTerminal(command: QualityDispositionCommand): boolean {
    switch (command.disposition) {
      case 'accepted':
        if (command.acceptedOutputQuantity !== command.quantity) {
          throw new ContractBoundaryError('ACCEPTED_OUTPUT_MUST_MATCH_ACCEPTED_DISPOSITION');
        }
        return true;
      case 'conditional_accept':
        if (!command.conditionalAcceptPolicyApproved || !command.evidenceReference) {
          throw new ContractBoundaryError('CONDITIONAL_ACCEPT_POLICY_REQUIRED');
        }
        if (command.acceptedOutputQuantity < 0 || command.acceptedOutputQuantity > command.quantity) {
          throw new ContractBoundaryError('INVALID_CONDITIONAL_ACCEPT_OUTPUT');
        }
        return true;
      case 'rework':
        if (command.acceptedOutputQuantity !== 0) {
          throw new ContractBoundaryError('REWORK_IS_NOT_ACCEPTED_OUTPUT');
        }
        return false;
      case 'scrap':
        this.requireReasonAndEvidence(command, 'SCRAP_EVIDENCE_REQUIRED');
        if (command.acceptedOutputQuantity !== 0) {
          throw new ContractBoundaryError('SCRAP_IS_NOT_ACCEPTED_OUTPUT');
        }
        return true;
      case 'discard_reject':
        this.requireReasonAndEvidence(command, 'DISCARD_REJECT_EVIDENCE_REQUIRED');
        if (!command.finalHandlingDecision) {
          throw new ContractBoundaryError('DISCARD_REJECT_FINAL_DECISION_REQUIRED');
        }
        if (command.acceptedOutputQuantity !== 0) {
          throw new ContractBoundaryError('DISCARD_REJECT_IS_NOT_ACCEPTED_OUTPUT');
        }
        return true;
      case 'pending':
        if (command.acceptedOutputQuantity !== 0) {
          throw new ContractBoundaryError('PENDING_IS_NOT_ACCEPTED_OUTPUT');
        }
        return false;
    }
  }

  private requireReasonAndEvidence(command: QualityDispositionCommand, errorCode: string): void {
    if (!command.reasonCode || !command.evidenceReference) {
      throw new ContractBoundaryError(errorCode);
    }
  }
}

function createContext(overrides: Partial<QualityDispositionContext> = {}): QualityDispositionContext {
  return {
    tenantId: 'tenant-a',
    factoryOrgUnitId: 'factory-a',
    productionOrderLineId: 'po-line-1',
    productionExecutionId: 'execution-1',
    quantities: {
      accepted: 8,
      rejected: 1,
      scrap: 1,
      pending: 1,
    },
    ...overrides,
  };
}

function createCommand(overrides: Partial<QualityDispositionCommand> = {}): QualityDispositionCommand {
  return {
    tenantId: 'tenant-a',
    factoryOrgUnitId: 'factory-a',
    productionOrderLineId: 'po-line-1',
    productionExecutionId: 'execution-1',
    sourceQuantityType: 'accepted',
    disposition: 'accepted',
    quantity: 8,
    acceptedOutputQuantity: 8,
    decidedBy: 'quality-operator-1',
    decidedAt: '2026-10-10T00:00:00.000Z',
    idempotencyKey: 'quality-disposition-1',
    ...overrides,
  };
}

describe('Manufacturing Quality Disposition contract boundary', () => {
  it('records accepted evidence as terminal and reconciles accepted output', async () => {
    const harness = new QualityDispositionContractHarness();
    const result = await harness.record(createContext(), createCommand());

    expect(result.terminal).toBe(true);
    expect(result.acceptedOutputQuantity).toBe(8);
    expect(harness.canComplete([result])).toBe(true);
  });

  it('rejects completion when pending quantity exists', async () => {
    const harness = new QualityDispositionContractHarness();
    const pending = await harness.record(
      createContext(),
      createCommand({
        sourceQuantityType: 'pending',
        disposition: 'pending',
        quantity: 1,
        acceptedOutputQuantity: 0,
      })
    );

    expect(pending.terminal).toBe(false);
    expect(harness.canComplete([pending])).toBe(false);
  });

  it('rejects completion when rework quantity remains open', async () => {
    const harness = new QualityDispositionContractHarness();
    const rework = await harness.record(
      createContext(),
      createCommand({
        sourceQuantityType: 'rejected',
        disposition: 'rework',
        quantity: 1,
        acceptedOutputQuantity: 0,
      })
    );

    expect(rework.terminal).toBe(false);
    expect(harness.canComplete([rework])).toBe(false);
  });

  it('allows scrap as terminal only with reason, quantity, actor/time, and evidence semantics', async () => {
    const harness = new QualityDispositionContractHarness();
    const context = createContext();

    await expect(
      harness.record(
        context,
        createCommand({
          sourceQuantityType: 'scrap',
          disposition: 'scrap',
          quantity: 1,
          acceptedOutputQuantity: 0,
        })
      )
    ).rejects.toThrow('SCRAP_EVIDENCE_REQUIRED');

    const scrap = await harness.record(
      context,
      createCommand({
        sourceQuantityType: 'scrap',
        disposition: 'scrap',
        quantity: 1,
        acceptedOutputQuantity: 0,
        reasonCode: 'DAMAGED_OUTPUT',
        evidenceReference: 'qc-photo-1',
        idempotencyKey: 'scrap-1',
      })
    );

    expect(scrap.terminal).toBe(true);
    expect(scrap.acceptedOutputQuantity).toBe(0);
  });

  it('allows discard/reject as terminal only with final decision, reason, and evidence', async () => {
    const harness = new QualityDispositionContractHarness();
    const context = createContext();

    await expect(
      harness.record(
        context,
        createCommand({
          sourceQuantityType: 'rejected',
          disposition: 'discard_reject',
          quantity: 1,
          acceptedOutputQuantity: 0,
          reasonCode: 'FAILED_INSPECTION',
          evidenceReference: 'qc-report-1',
        })
      )
    ).rejects.toThrow('DISCARD_REJECT_FINAL_DECISION_REQUIRED');

    const rejected = await harness.record(
      context,
      createCommand({
        sourceQuantityType: 'rejected',
        disposition: 'discard_reject',
        quantity: 1,
        acceptedOutputQuantity: 0,
        reasonCode: 'FAILED_INSPECTION',
        evidenceReference: 'qc-report-1',
        finalHandlingDecision: true,
        idempotencyKey: 'discard-1',
      })
    );

    expect(rejected.terminal).toBe(true);
    expect(rejected.acceptedOutputQuantity).toBe(0);
  });

  it('allows conditional accept as terminal only with approved accepted-output treatment', async () => {
    const harness = new QualityDispositionContractHarness();

    const conditional = await harness.record(
      createContext(),
      createCommand({
        sourceQuantityType: 'rejected',
        disposition: 'conditional_accept',
        quantity: 1,
        acceptedOutputQuantity: 1,
        conditionalAcceptPolicyApproved: true,
        evidenceReference: 'quality-manager-approval-1',
      })
    );

    expect(conditional.terminal).toBe(true);
    expect(conditional.acceptedOutputQuantity).toBe(1);
  });

  it('rejects conditional accept counted as accepted output without policy approval and evidence', async () => {
    const harness = new QualityDispositionContractHarness();

    await expect(
      harness.record(
        createContext(),
        createCommand({
          sourceQuantityType: 'rejected',
          disposition: 'conditional_accept',
          quantity: 1,
          acceptedOutputQuantity: 1,
        })
      )
    ).rejects.toThrow('CONDITIONAL_ACCEPT_POLICY_REQUIRED');
  });

  it('rejects disposition evidence outside the production order tenant or factory boundary', async () => {
    const harness = new QualityDispositionContractHarness();

    await expect(
      harness.record(createContext(), createCommand({ tenantId: 'tenant-b' }))
    ).rejects.toThrow('TENANT_OR_FACTORY_MISMATCH');

    await expect(
      harness.record(createContext(), createCommand({ factoryOrgUnitId: 'factory-b' }))
    ).rejects.toThrow('TENANT_OR_FACTORY_MISMATCH');
  });

  it('rejects disposition quantity exceeding the corresponding execution or FGR quantity', async () => {
    const harness = new QualityDispositionContractHarness();

    await expect(
      harness.record(
        createContext(),
        createCommand({
          sourceQuantityType: 'rejected',
          disposition: 'discard_reject',
          quantity: 2,
          acceptedOutputQuantity: 0,
          reasonCode: 'FAILED_INSPECTION',
          evidenceReference: 'qc-report-1',
          finalHandlingDecision: true,
        })
      )
    ).rejects.toThrow('DISPOSITION_QUANTITY_EXCEEDS_SOURCE');
  });

  it('replays the same idempotency key and same payload without duplicate evidence', async () => {
    const harness = new QualityDispositionContractHarness();
    const context = createContext();
    const command = createCommand({ idempotencyKey: 'accepted-retry-1' });

    const first = await harness.record(context, command);
    const retry = await harness.record(context, command);

    expect(retry).toBe(first);
    expect(harness.countRecords()).toBe(1);
  });

  it('rejects the same idempotency key with conflicting payload', async () => {
    const harness = new QualityDispositionContractHarness();
    const context = createContext();

    await harness.record(context, createCommand({ idempotencyKey: 'conflict-1' }));

    await expect(
      harness.record(
        context,
        createCommand({
          idempotencyKey: 'conflict-1',
          quantity: 7,
          acceptedOutputQuantity: 7,
        })
      )
    ).rejects.toThrow('IDEMPOTENCY_PAYLOAD_CONFLICT');
  });

  it('serializes concurrent duplicate commands so only one evidence record is created', async () => {
    const harness = new QualityDispositionContractHarness();
    const context = createContext();
    const command = createCommand({ idempotencyKey: 'concurrent-1' });

    const [first, duplicate] = await Promise.all([
      harness.record(context, command),
      harness.record(context, command),
    ]);

    expect(duplicate).toBe(first);
    expect(harness.countRecords()).toBe(1);
  });
});
