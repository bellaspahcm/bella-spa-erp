/**
 * Service History Service
 * Manages IMMUTABLE service history records linked to VIN
 * Automatically created when repair orders are completed
 * 
 * @module bella-auto/services/ServiceHistoryService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type ServiceHistory = Database['public']['Tables']['auto_service_history']['Row'];
type ServiceHistoryInsert = Database['public']['Tables']['auto_service_history']['Insert'];

interface VehicleJoinRow {
  id: string;
  vin: string | null;
  license_plate: string | null;
  make: string;
  model: string;
  year: number;
}

interface CustomerJoinRow {
  id: string;
  name: string;
}

interface PartItem {
  partNumber: string | null;
  partName: string;
  quantity: number;
  isWarrantyCovered: boolean | null;
}

interface ExportResult {
  headers: string[];
  rows: (string | number | boolean | null)[][];
}

export interface ServiceHistoryQuery {
  vin?: string;
  vehicleId?: string;
  startDate?: Date;
  endDate?: Date;
  serviceType?: string;
  limit?: number;
}

export class ServiceHistoryService {
  /**
   * Create immutable service history record
   * Called automatically when repair order is completed
   */
  static async createServiceHistoryRecord(
    tenantId: string,
    repairOrderId: string
  ): Promise<ServiceHistory> {
    const supabase = getPrimaryClient();

    // Get repair order details
    const { data: repairOrder, error: roError } = await supabase
      .from('auto_repair_orders')
      .select(`
        *,
        auto_vehicles!inner(
          id,
          vin,
          license_plate,
          make,
          model,
          year
        ),
        customers!inner(
          id,
          name
        )
      `)
      .eq('id', repairOrderId)
      .eq('tenant_id', tenantId)
      .single();

    if (roError || !repairOrder) {
      throw new Error(`Repair order not found: ${roError?.message}`);
    }

    // Get all line items
    const { data: items } = await supabase
      .from('auto_repair_order_items')
      .select('*')
      .eq('repair_order_id', repairOrderId)
      .eq('tenant_id', tenantId);

    // Prepare service history data
    const vehicle = repairOrder.auto_vehicles as unknown as VehicleJoinRow;
    const customer = repairOrder.customers as unknown as CustomerJoinRow;

    const historyData: ServiceHistoryInsert = {
      tenant_id: tenantId,
      vin: vehicle.vin,
      vehicle_id: repairOrder.vehicle_id,
      license_plate: vehicle.license_plate,
      vehicle_make: vehicle.make,
      vehicle_model: vehicle.model,
      vehicle_year: vehicle.year,
      customer_id: repairOrder.customer_id,
      customer_name: customer.name,
      repair_order_id: repairOrder.id,
      repair_order_number: repairOrder.order_number,
      service_date: repairOrder.order_date,
      service_type: repairOrder.order_type,
      mileage: repairOrder.mileage_in,
      work_description: repairOrder.work_description,
      diagnosis_notes: repairOrder.diagnosis_notes,
      technician_notes: repairOrder.technician_notes,
      primary_technician_id: repairOrder.primary_technician_id,
      service_advisor_id: repairOrder.service_advisor_id,
      service_items: items?.map(item => ({
        type: item.item_type,
        code: item.item_code,
        name: item.item_name,
        description: item.description,
        quantity: item.quantity,
        laborHours: item.labor_hours,
        partNumber: item.part_number,
        isWarrantyCovered: item.is_warranty_covered,
      })) as ServiceHistoryInsert['service_items'],
      parts_replaced: items
        ?.filter(item => item.item_type === 'part')
        ?.map(item => ({
          partNumber: item.part_number,
          partName: item.item_name,
          quantity: item.quantity,
          isWarrantyCovered: item.is_warranty_covered,
        })) as ServiceHistoryInsert['parts_replaced'],
      labor_hours: repairOrder.actual_hours,
      labor_cost: Number(repairOrder.actual_labor_cost || 0),
      parts_cost: Number(repairOrder.actual_parts_cost || 0),
      total_cost: Number(repairOrder.actual_total || 0),
      warranty_work: repairOrder.is_warranty_work || false,
      warranty_claim_id: repairOrder.warranty_claim_id,
      quality_check_passed: repairOrder.quality_check_passed,
      quality_checked_by: repairOrder.quality_checked_by,
      quality_check_notes: repairOrder.quality_check_notes,
      customer_complaints: repairOrder.customer_complaints as ServiceHistoryInsert['customer_complaints'],
      is_locked: true, // IMMUTABLE by default
    };

    const { data: history, error } = await supabase
      .from('auto_service_history')
      .insert(historyData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create service history: ${error.message}`);
    }

    return history;
  }

  /**
   * Get service history by VIN
   * Primary method for vehicle history lookup
   */
  static async getServiceHistoryByVIN(
    tenantId: string,
    vin: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      serviceType?: string;
      limit?: number;
    }
  ): Promise<ServiceHistory[]> {
    const supabase = getPrimaryClient();

    let query = supabase
      .from('auto_service_history')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('vin', vin)
      .order('service_date', { ascending: false });

    if (options?.startDate) {
      query = query.gte('service_date', options.startDate.toISOString().split('T')[0]);
    }

    if (options?.endDate) {
      query = query.lte('service_date', options.endDate.toISOString().split('T')[0]);
    }

    if (options?.serviceType) {
      query = query.eq('service_type', options.serviceType);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get service history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get service history by vehicle ID
   */
  static async getServiceHistoryByVehicle(
    tenantId: string,
    vehicleId: string,
    limit?: number
  ): Promise<ServiceHistory[]> {
    const supabase = getPrimaryClient();

    let query = supabase
      .from('auto_service_history')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('vehicle_id', vehicleId)
      .order('service_date', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get service history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get complete vehicle history (for vehicle reports)
   */
  static async getCompleteVehicleHistory(
    tenantId: string,
    vin: string
  ): Promise<{
    totalServices: number;
    totalSpent: number;
    totalLaborHours: number;
    lastServiceDate: string | null;
    lastServiceMileage: number | null;
    servicesByType: Record<string, number>;
    commonParts: Array<{ partName: string; count: number }>;
    history: ServiceHistory[];
  }> {
    const history = await this.getServiceHistoryByVIN(tenantId, vin);

    if (history.length === 0) {
      return {
        totalServices: 0,
        totalSpent: 0,
        totalLaborHours: 0,
        lastServiceDate: null,
        lastServiceMileage: null,
        servicesByType: {},
        commonParts: [],
        history: [],
      };
    }

    const totalServices = history.length;
    const totalSpent = history.reduce((sum, h) => sum + Number(h.total_cost || 0), 0);
    const totalLaborHours = history.reduce((sum, h) => sum + Number(h.labor_hours || 0), 0);
    const lastServiceDate = history[0].service_date;
    const lastServiceMileage = history[0].mileage;

    // Count services by type
    const servicesByType: Record<string, number> = {};
    history.forEach(h => {
      servicesByType[h.service_type] = (servicesByType[h.service_type] || 0) + 1;
    });

    // Count common parts
    const partsCount: Record<string, number> = {};
    history.forEach(h => {
      const parts = (h.parts_replaced as PartItem[]) || [];
      parts.forEach((part: PartItem) => {
        const partName = part.partName || 'Unknown';
        partsCount[partName] = (partsCount[partName] || 0) + 1;
      });
    });

    const commonParts = Object.entries(partsCount)
      .map(([partName, count]) => ({ partName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalServices,
      totalSpent,
      totalLaborHours,
      lastServiceDate,
      lastServiceMileage,
      servicesByType,
      commonParts,
      history,
    };
  }

  /**
   * Get maintenance schedule recommendations based on history
   */
  static async getMaintenanceRecommendations(
    tenantId: string,
    vehicleId: string,
    currentMileage: number
  ): Promise<Array<{
    serviceType: string;
    reason: string;
    urgency: 'overdue' | 'due_soon' | 'upcoming';
    lastPerformedDate?: string;
    lastPerformedMileage?: number;
    recommendedMileage: number;
  }>> {
    const history = await this.getServiceHistoryByVehicle(tenantId, vehicleId);

    const recommendations: Array<{
      serviceType: string;
      reason: string;
      urgency: 'overdue' | 'due_soon' | 'upcoming';
      lastPerformedDate?: string;
      lastPerformedMileage?: number;
      recommendedMileage: number;
    }> = [];

    // Standard maintenance intervals (in km)
    const intervals = {
      'Oil Change': 5000,
      'Tire Rotation': 10000,
      'Brake Inspection': 20000,
      'Air Filter': 15000,
      'Transmission Service': 50000,
      'Coolant Flush': 50000,
    };

    for (const [serviceType, interval] of Object.entries(intervals)) {
      const lastService = history.find(h => 
        h.service_type === serviceType || 
        h.work_description?.toLowerCase().includes(serviceType.toLowerCase())
      );

      const lastMileage = lastService?.mileage || 0;
      const mileageSinceLastService = currentMileage - lastMileage;
      const recommendedMileage = lastMileage + interval;

      let urgency: 'overdue' | 'due_soon' | 'upcoming' = 'upcoming';
      let reason = '';

      if (mileageSinceLastService >= interval) {
        urgency = 'overdue';
        reason = `${serviceType} is overdue by ${mileageSinceLastService - interval} km`;
      } else if (mileageSinceLastService >= interval * 0.9) {
        urgency = 'due_soon';
        reason = `${serviceType} is due soon (${interval - mileageSinceLastService} km remaining)`;
      } else if (mileageSinceLastService >= interval * 0.7) {
        urgency = 'upcoming';
        reason = `${serviceType} is upcoming (${interval - mileageSinceLastService} km remaining)`;
      } else {
        continue; // Skip if not due yet
      }

      recommendations.push({
        serviceType,
        reason,
        urgency,
        lastPerformedDate: lastService?.service_date,
        lastPerformedMileage: lastService?.mileage,
        recommendedMileage,
      });
    }

    // Sort by urgency
    const urgencyOrder = { overdue: 0, due_soon: 1, upcoming: 2 };
    recommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return recommendations;
  }

  /**
   * Export service history for vehicle report (PDF, Excel)
   */
  static async exportServiceHistory(
    tenantId: string,
    vin: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<ServiceHistory[] | ExportResult> {
    const history = await this.getServiceHistoryByVIN(tenantId, vin);

    if (format === 'csv') {
      // Convert to CSV format
      const headers = [
        'Service Date',
        'Order Number',
        'Service Type',
        'Mileage',
        'Work Description',
        'Labor Hours',
        'Total Cost',
        'Warranty Work',
      ];

      const rows = history.map(h => [
        h.service_date,
        h.repair_order_number,
        h.service_type,
        h.mileage,
        h.work_description,
        h.labor_hours,
        h.total_cost,
        h.warranty_work ? 'Yes' : 'No',
      ]);

      return { headers, rows };
    }

    return history;
  }

  /**
   * Search service history (for reports and analysis)
   */
  static async searchServiceHistory(
    tenantId: string,
    query: ServiceHistoryQuery
  ): Promise<ServiceHistory[]> {
    const supabase = getPrimaryClient();

    let dbQuery = supabase
      .from('auto_service_history')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('service_date', { ascending: false });

    if (query.vin) {
      dbQuery = dbQuery.eq('vin', query.vin);
    }

    if (query.vehicleId) {
      dbQuery = dbQuery.eq('vehicle_id', query.vehicleId);
    }

    if (query.serviceType) {
      dbQuery = dbQuery.eq('service_type', query.serviceType);
    }

    if (query.startDate) {
      dbQuery = dbQuery.gte('service_date', query.startDate.toISOString().split('T')[0]);
    }

    if (query.endDate) {
      dbQuery = dbQuery.lte('service_date', query.endDate.toISOString().split('T')[0]);
    }

    if (query.limit) {
      dbQuery = dbQuery.limit(query.limit);
    }

    const { data, error } = await dbQuery;

    if (error) {
      throw new Error(`Failed to search service history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get warranty-covered services
   */
  static async getWarrantyServices(
    tenantId: string,
    vehicleId: string
  ): Promise<ServiceHistory[]> {
    const supabase = getPrimaryClient();

    const { data, error } = await supabase
      .from('auto_service_history')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('vehicle_id', vehicleId)
      .eq('warranty_work', true)
      .order('service_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to get warranty services: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Validate service history integrity
   * Ensures no duplicate records for same repair order
   */
  static async validateHistoryIntegrity(
    tenantId: string,
    repairOrderId: string
  ): Promise<boolean> {
    const supabase = getPrimaryClient();

    const { data, error } = await supabase
      .from('auto_service_history')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('repair_order_id', repairOrderId);

    if (error) {
      throw new Error(`Failed to validate history: ${error.message}`);
    }

    // Should have exactly 1 record (or 0 if not created yet)
    return (data?.length || 0) <= 1;
  }
}
