/**
 * Bella AutoMove — Action Tests
 *
 * Tests Product-level server actions for correct structure and validation.
 */

import {
  listVehiclesAction,
  getVehicleAction,
  createVehicleAction,
  updateVehicleAction,
} from '../actions/vehicle-actions';

import {
  listAppointmentsAction,
  getAppointmentAction,
  createAppointmentAction,
  updateAppointmentStatusAction,
} from '../actions/appointment-actions';

import {
  listRepairOrdersAction,
  getRepairOrderAction,
  createRepairOrderAction,
  addRepairOrderItemAction,
  updateRepairOrderStatusAction,
} from '../actions/repair-order-actions';

import {
  generateInvoiceAction,
  listInvoicesAction,
  getInvoiceAction,
} from '../actions/invoice-actions';

// Mock auth to return no user (will fail auth checks)
jest.mock('@/services/user-actions', () => ({
  getCurrentUser: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(),
}));

describe('Bella AutoMove — Actions', () => {
  describe('Vehicle Actions', () => {
    it('should export listVehiclesAction', () => {
      expect(typeof listVehiclesAction).toBe('function');
    });

    it('should export getVehicleAction', () => {
      expect(typeof getVehicleAction).toBe('function');
    });

    it('should export createVehicleAction', () => {
      expect(typeof createVehicleAction).toBe('function');
    });

    it('should export updateVehicleAction', () => {
      expect(typeof updateVehicleAction).toBe('function');
    });

    it('should require authentication for listVehicles', async () => {
      const result = await listVehiclesAction();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    it('should require authentication for getVehicle', async () => {
      const result = await getVehicleAction('test-id');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    it('should require authentication for createVehicle', async () => {
      const result = await createVehicleAction({
        vin: 'TEST12345678901234',
        make: 'Toyota',
        model: 'Camry',
        year: 2024,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });
  });

  describe('Appointment Actions', () => {
    it('should export listAppointmentsAction', () => {
      expect(typeof listAppointmentsAction).toBe('function');
    });

    it('should export getAppointmentAction', () => {
      expect(typeof getAppointmentAction).toBe('function');
    });

    it('should export createAppointmentAction', () => {
      expect(typeof createAppointmentAction).toBe('function');
    });

    it('should export updateAppointmentStatusAction', () => {
      expect(typeof updateAppointmentStatusAction).toBe('function');
    });

    it('should require authentication for listAppointments', async () => {
      const result = await listAppointmentsAction();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });
  });

  describe('Repair Order Actions', () => {
    it('should export listRepairOrdersAction', () => {
      expect(typeof listRepairOrdersAction).toBe('function');
    });

    it('should export getRepairOrderAction', () => {
      expect(typeof getRepairOrderAction).toBe('function');
    });

    it('should export createRepairOrderAction', () => {
      expect(typeof createRepairOrderAction).toBe('function');
    });

    it('should export addRepairOrderItemAction', () => {
      expect(typeof addRepairOrderItemAction).toBe('function');
    });

    it('should export updateRepairOrderStatusAction', () => {
      expect(typeof updateRepairOrderStatusAction).toBe('function');
    });

    it('should require authentication for listRepairOrders', async () => {
      const result = await listRepairOrdersAction();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });
  });

  describe('Invoice Actions', () => {
    it('should export generateInvoiceAction', () => {
      expect(typeof generateInvoiceAction).toBe('function');
    });

    it('should export listInvoicesAction', () => {
      expect(typeof listInvoicesAction).toBe('function');
    });

    it('should export getInvoiceAction', () => {
      expect(typeof getInvoiceAction).toBe('function');
    });

    it('should require authentication for generateInvoice', async () => {
      const result = await generateInvoiceAction('test-order-id');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });
  });

  describe('Action Result Types', () => {
    it('should return structured ActionResult on auth failure', async () => {
      const result = await listVehiclesAction();
      
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      
      if (!result.success) {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      }
    });
  });
});
