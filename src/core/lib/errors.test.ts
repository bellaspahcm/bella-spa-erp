import {
  AppError,
  BookingError,
  PaymentError,
  InventoryError,
  SalaryError,
  ValidationError,
} from './errors';

describe('Error Hierarchy', () => {
  describe('AppError', () => {
    it('should create an instance with message and code', () => {
      const error = new AppError('Test error', 'TEST_CODE');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('AppError');
      expect(error.details).toBeUndefined();
    });

    it('should create an instance with message, code, and details', () => {
      const details = { userId: 123, action: 'create' };
      const error = new AppError('Test error', 'TEST_CODE', details);
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual(details);
    });

    it('should serialize to JSON correctly without details', () => {
      const error = new AppError('Test error', 'TEST_CODE');
      const json = error.toJSON();
      
      expect(json).toEqual({
        name: 'AppError',
        message: 'Test error',
        code: 'TEST_CODE',
        details: undefined,
      });
    });

    it('should serialize to JSON correctly with details', () => {
      const details = { userId: 123, timestamp: '2024-01-15T10:00:00Z' };
      const error = new AppError('Test error', 'TEST_CODE', details);
      const json = error.toJSON();
      
      expect(json).toEqual({
        name: 'AppError',
        message: 'Test error',
        code: 'TEST_CODE',
        details,
      });
    });

    it('should have a proper stack trace', () => {
      const error = new AppError('Test error', 'TEST_CODE');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new AppError('Test error', 'TEST_CODE');
      }).toThrow(AppError);
      
      expect(() => {
        throw new AppError('Test error', 'TEST_CODE');
      }).toThrow('Test error');
    });
  });

  describe('BookingError', () => {
    it('should create an instance and inherit from AppError', () => {
      const error = new BookingError('Booking failed', 'BOOKING_FAILED');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(BookingError);
      expect(error.name).toBe('BookingError');
      expect(error.message).toBe('Booking failed');
      expect(error.code).toBe('BOOKING_FAILED');
    });

    it('should support details in constructor', () => {
      const details = { bookingId: 456, resourceId: 789 };
      const error = new BookingError('Resource unavailable', 'RESOURCE_UNAVAILABLE', details);
      
      expect(error.details).toEqual(details);
    });

    it('should serialize to JSON with correct name', () => {
      const error = new BookingError('Booking failed', 'BOOKING_FAILED');
      const json = error.toJSON();
      
      expect(json.name).toBe('BookingError');
      expect(json.message).toBe('Booking failed');
      expect(json.code).toBe('BOOKING_FAILED');
    });
  });

  describe('PaymentError', () => {
    it('should create an instance and inherit from AppError', () => {
      const error = new PaymentError('Payment declined', 'PAYMENT_DECLINED');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(PaymentError);
      expect(error.name).toBe('PaymentError');
      expect(error.message).toBe('Payment declined');
      expect(error.code).toBe('PAYMENT_DECLINED');
    });

    it('should support details in constructor', () => {
      const details = { transactionId: 'txn_123', amount: 50000 };
      const error = new PaymentError('Insufficient funds', 'INSUFFICIENT_FUNDS', details);
      
      expect(error.details).toEqual(details);
    });

    it('should serialize to JSON with correct name', () => {
      const error = new PaymentError('Payment declined', 'PAYMENT_DECLINED');
      const json = error.toJSON();
      
      expect(json.name).toBe('PaymentError');
    });
  });

  describe('InventoryError', () => {
    it('should create an instance and inherit from AppError', () => {
      const error = new InventoryError('Out of stock', 'OUT_OF_STOCK');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(InventoryError);
      expect(error.name).toBe('InventoryError');
      expect(error.message).toBe('Out of stock');
      expect(error.code).toBe('OUT_OF_STOCK');
    });

    it('should support details in constructor', () => {
      const details = { productId: 789, requested: 10, available: 5 };
      const error = new InventoryError('Insufficient stock', 'INSUFFICIENT_STOCK', details);
      
      expect(error.details).toEqual(details);
    });

    it('should serialize to JSON with correct name', () => {
      const error = new InventoryError('Out of stock', 'OUT_OF_STOCK');
      const json = error.toJSON();
      
      expect(json.name).toBe('InventoryError');
    });
  });

  describe('SalaryError', () => {
    it('should create an instance and inherit from AppError', () => {
      const error = new SalaryError('Calculation failed', 'CALCULATION_FAILED');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(SalaryError);
      expect(error.name).toBe('SalaryError');
      expect(error.message).toBe('Calculation failed');
      expect(error.code).toBe('CALCULATION_FAILED');
    });

    it('should support details in constructor', () => {
      const details = { ktvId: 15, month: '2024-01', missingDays: 5 };
      const error = new SalaryError('Incomplete data', 'INCOMPLETE_ATTENDANCE', details);
      
      expect(error.details).toEqual(details);
    });

    it('should serialize to JSON with correct name', () => {
      const error = new SalaryError('Calculation failed', 'CALCULATION_FAILED');
      const json = error.toJSON();
      
      expect(json.name).toBe('SalaryError');
    });
  });

  describe('ValidationError', () => {
    it('should create an instance and inherit from AppError', () => {
      const error = new ValidationError('Invalid input', 'INVALID_INPUT');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('INVALID_INPUT');
    });

    it('should support details in constructor', () => {
      const details = { field: 'email', value: 'invalid-email' };
      const error = new ValidationError('Invalid email', 'INVALID_EMAIL', details);
      
      expect(error.details).toEqual(details);
    });

    it('should serialize to JSON with correct name', () => {
      const error = new ValidationError('Invalid input', 'INVALID_INPUT');
      const json = error.toJSON();
      
      expect(json.name).toBe('ValidationError');
    });
  });

  describe('Error inheritance chain', () => {
    it('should maintain proper instanceof checks for all error types', () => {
      const errors = [
        new BookingError('msg', 'code'),
        new PaymentError('msg', 'code'),
        new InventoryError('msg', 'code'),
        new SalaryError('msg', 'code'),
        new ValidationError('msg', 'code'),
      ];

      errors.forEach((error) => {
        expect(error instanceof Error).toBe(true);
        expect(error instanceof AppError).toBe(true);
      });
    });

    it('should differentiate between error types', () => {
      const bookingError = new BookingError('msg', 'code');
      const paymentError = new PaymentError('msg', 'code');

      expect(bookingError instanceof BookingError).toBe(true);
      expect(bookingError instanceof PaymentError).toBe(false);
      expect(paymentError instanceof PaymentError).toBe(true);
      expect(paymentError instanceof BookingError).toBe(false);
    });
  });

  describe('Error details edge cases', () => {
    it('should handle empty details object', () => {
      const error = new AppError('Test', 'CODE', {});
      expect(error.details).toEqual({});
      expect(error.toJSON().details).toEqual({});
    });

    it('should handle nested details', () => {
      const details = {
        user: { id: 123, name: 'Test User' },
        metadata: { timestamp: Date.now(), source: 'api' },
      };
      const error = new AppError('Test', 'CODE', details);
      
      expect(error.details).toEqual(details);
      expect(error.toJSON().details).toEqual(details);
    });

    it('should handle details with null and undefined values', () => {
      const details = { value1: null, value2: undefined, value3: 'valid' };
      const error = new AppError('Test', 'CODE', details);
      
      expect(error.details).toEqual(details);
    });
  });

  describe('Error code and message properties', () => {
    it('should preserve code property as public', () => {
      const error = new AppError('Test', 'TEST_CODE');
      error.code = 'MODIFIED_CODE';
      
      expect(error.code).toBe('MODIFIED_CODE');
    });

    it('should preserve message from Error base class', () => {
      const error = new AppError('Original message', 'CODE');
      
      expect(error.message).toBe('Original message');
      expect(Object.getOwnPropertyDescriptor(error, 'message')).toBeDefined();
    });
  });
});
