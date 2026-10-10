export class ManufacturingError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ManufacturingError';
  }
}

export class ManufacturingAuthorizationError extends ManufacturingError {
  constructor(message = 'Manufacturing actor is not authorized for this operation') {
    super(message, 'MANUFACTURING_AUTHORIZATION_DENIED');
  }
}

export class ManufacturingValidationError extends ManufacturingError {
  constructor(message: string) {
    super(message, 'MANUFACTURING_VALIDATION_FAILED');
  }
}

export class ManufacturingNotFoundError extends ManufacturingError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, 'MANUFACTURING_NOT_FOUND');
  }
}

export class ManufacturingStateError extends ManufacturingError {
  constructor(message: string) {
    super(message, 'MANUFACTURING_INVALID_STATE_TRANSITION');
  }
}

export class ManufacturingIdempotencyConflictError extends ManufacturingError {
  constructor() {
    super(
      'Idempotency key was already used with a different payload',
      'MANUFACTURING_IDEMPOTENCY_CONFLICT'
    );
  }
}
