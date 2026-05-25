'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Store, 
  DollarSign, 
  Activity, 
  MessageSquare, 
  Search, 
  Users, 
  MapPin, 
  Phone, 
  Lock, 
  Unlock, 
  RefreshCw, 
  LogOut, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Percent,
  CreditCard,
  CheckCircle2,
  X,
  Edit,
  Settings,
  AlertCircle,
  Calendar,
  ArrowLeftRight,
  Truck,
  Ban,
  Crown,
  Award,
  Sparkles,
  Info,
  ShieldCheck,
  Plus,
  Trash,
  Send,
  Package,
  Eye,
  Check,
  PieChart
} from 'lucide-react';
import { toggleTenantStatus, getHqDashboardStats, getAllTenants } from '@/services/hq-actions';
import { 
  getFranchiseRoyaltyInvoices, 
  updateFranchiseRoyaltyConfig, 
  payFranchiseRoyaltyInvoice,
  FranchiseRoyaltyInvoice
} from '@/services/franchise-actions';
import {
  getInterBranchClearingRecords,
  clearInterBranchRecord,
  updateTenantClearingRate,
  InterBranchClearingRecord
} from '@/services/clearing-actions';
import {
  getInventoryTransferOrders,
  approveAndShipTransfer,
  cancelTransferOrder,
  InventoryTransferOrder,
  TransferOrderItem
} from '@/services/inventory-transfer-actions';
import { createClient } from '@/lib/supabase-client';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { HqDashboardStats, HqTenantRecord, CurrentUser, HqAuditLogRecord, HqPackageTemplate } from '@/types/domain';
import { getHqAuditLogs, getAuditTables, getAuditUsers } from '@/services/audit-actions';
import { 
  getHqPackageTemplates, 
  createHqPackageTemplate, 
  updateHqPackageTemplate, 
  deleteHqPackageTemplate, 
  distributeTemplateToTenants, 
  getBrandDistributionMatrix 
} from '@/services/brand-service-actions';

interface HqDashboardClientProps {
  initialStats: HqDashboardStats;
  initialTenants: HqTenantRecord[];
  currentUser: CurrentUser;
}

export default function HqDashboardClient({ 
  initialStats, 
  initialTenants, 
  currentUser 
}: HqDashboardClientProps) {
  const [stats, setStats] = useState<HqDashboardStats>(initialStats);
  const [tenants, setTenants] = useState<HqTenantRecord[]>(initialTenants);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [compareMetric, setCompareMetric] = useState<'revenue' | 'customers'>('revenue');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'direct' | 'franchise'>('all');
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Tab System
  const [activeTab, setActiveTab] = useState<'branches' | 'franchise' | 'clearing' | 'transfers' | 'audit' | 'services'>('branches');
  
  // Inventory Transfer States
  const [transferOrders, setTransferOrders] = useState<InventoryTransferOrder[]>([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<InventoryTransferOrder | null>(null);
  const [shippingCarrier, setShippingCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [refusingReason, setRefusingReason] = useState('');
  const [submittingTransferAction, setSubmittingTransferAction] = useState(false);
  const [transferFilterStatus, setTransferFilterStatus] = useState<'all' | 'pending' | 'shipped' | 'completed' | 'cancelled'>('all');
  const [transferFilterBranch, setTransferFilterBranch] = useState('all');
  const [showShipModal, setShowShipModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  // Franchise States
  const [invoices, setInvoices] = useState<FranchiseRoyaltyInvoice[]>([]);
  const [loadingRoyalty, setLoadingRoyalty] = useState(false);
  const [editingTenant, setEditingTenant] = useState<HqTenantRecord | null>(null);
  
  // Agreement Config Form States
  const [royaltyType, setRoyaltyType] = useState<'fixed' | 'percentage'>('percentage');
  const [royaltyRate, setRoyaltyRate] = useState<string>('0');
  const [royaltyFixedAmount, setRoyaltyFixedAmount] = useState<string>('0');
  const [submittingConfig, setSubmittingConfig] = useState(false);
 
  // Inter-branch Clearing States
  const [clearingRecords, setClearingRecords] = useState<InterBranchClearingRecord[]>([]);
  const [loadingClearing, setLoadingClearing] = useState(false);
  const [editingClearingRateTenant, setEditingClearingRateTenant] = useState<HqTenantRecord | null>(null);
  const [newClearingRate, setNewClearingRate] = useState<string>('150000');
  const [submittingClearingRate, setSubmittingClearingRate] = useState(false);
 
  // Audit Logs States
  const [auditLogs, setAuditLogs] = useState<HqAuditLogRecord[]>([]);
  const [auditTables, setAuditTables] = useState<string[]>([]);
  const [auditUsers, setAuditUsers] = useState<{ id: string; name: string }[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  
  // Filter options
  const [selectedTenant, setSelectedTenant] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedTable, setSelectedTable] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAuditLog, setSelectedAuditLog] = useState<HqAuditLogRecord | null>(null);
  const [showAuditDetailModal, setShowAuditDetailModal] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  // Standard Service & Templates States (Phase 2)
  const [templates, setTemplates] = useState<HqPackageTemplate[]>([]);
  const [distributedList, setDistributedList] = useState<{
    id: string;
    name: string;
    price: number;
    tenant_id: string;
    tenant_name: string;
    template_id: string;
    status: string;
  }[]>([]);
  const [matrixTenants, setMatrixTenants] = useState<{ id: string; name: string }[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<HqPackageTemplate | null>(null);

  // Form states for template creation/edit
  const [templateName, setTemplateName] = useState('');
  const [templatePrice, setTemplatePrice] = useState('0');
  const [templateDuration, setTemplateDuration] = useState('90 phút/buổi');
  const [templateTotalSessions, setTemplateTotalSessions] = useState('10');
  const [templateKtvCommission, setTemplateKtvCommission] = useState('150000');
  const [templatePriceFloor, setTemplatePriceFloor] = useState('0');
  const [templatePriceCap, setTemplatePriceCap] = useState('0');
  const [templateAllowedOverride, setTemplateAllowedOverride] = useState(true);
  const [templateDetails, setTemplateDetails] = useState<string[]>([]);
  const [newDetailText, setNewDetailText] = useState('');
  const [templateOffer, setTemplateOffer] = useState('');
  
  // Selection state for distribution
  const [selectedTemplateForDist, setSelectedTemplateForDist] = useState<HqPackageTemplate | null>(null);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [submittingDistribution, setSubmittingDistribution] = useState(false);
  const [submittingTemplate, setSubmittingTemplate] = useState(false);

  const handleToggleDemo = (enable: boolean) => {
    if (enable) {
      setIsDemoMode(true);
      // Mock stats
      setStats({
        totalSpas: 5,
        activeSpas: 4,
        suspendedSpas: 1,
        totalRevenue: 8450000000,
        totalSessions: 24500,
        zaloSmsUsed: 942,
        spaGrowthData: [
          { month: 'T1', spas: 1 },
          { month: 'T2', spas: 2 },
          { month: 'T3', spas: 3 },
          { month: 'T4', spas: 4 },
          { month: 'T5', spas: 5 },
        ]
      });

      // Mock tenants
      setTenants([
        {
          id: 'tenant-q1',
          name: 'Bella Spa Quận 1 - Premium',
          contact_phone: '0902222222',
          email: 'quan1@bellaspa.vn',
          status: 'active',
          logo_url: null,
          created_at: '2025-01-15T00:00:00Z',
          updated_at: '2026-05-22T00:00:00Z',
          address: '150 Lê Thị Riêng, Quận 1, TP.HCM',
          staffCount: 18,
          customerCount: 1240,
          revenueSum: 4800000000,
          royalty_type: 'percentage',
          royalty_rate: 5,
          royalty_fixed_amount: 0,
          internal_clearing_rate: 150000,
          subscription_tier: 'enterprise',
          subscription_expires_at: null,
          franchise_agreement_date: '2025-01-15T00:00:00Z'
        },
        {
          id: 'tenant-q3',
          name: 'Bella Spa Quận 3 - Elite',
          contact_phone: '0903333333',
          email: 'quan3@bellaspa.vn',
          status: 'active',
          logo_url: null,
          created_at: '2025-03-20T00:00:00Z',
          updated_at: '2026-05-22T00:00:00Z',
          address: '240 Cao Thắng, Quận 3, TP.HCM',
          staffCount: 12,
          customerCount: 820,
          revenueSum: 2150000000,
          royalty_type: 'percentage',
          royalty_rate: 8,
          royalty_fixed_amount: 0,
          internal_clearing_rate: 150050,
          subscription_tier: 'pro',
          subscription_expires_at: '2027-12-31T00:00:00Z',
          franchise_agreement_date: '2025-03-20T00:00:00Z'
        },
        {
          id: 'tenant-thuduc',
          name: 'Bella Spa Thủ Đức - Family',
          contact_phone: '0904444444',
          email: 'thuduc@bellaspa.vn',
          status: 'active',
          logo_url: null,
          created_at: '2025-06-10T00:00:00Z',
          updated_at: '2026-05-22T00:00:00Z',
          address: '45 Võ Văn Ngân, Thủ Đức, TP.HCM',
          staffCount: 10,
          customerCount: 610,
          revenueSum: 1500000000,
          royalty_type: 'fixed',
          royalty_rate: 0,
          royalty_fixed_amount: 15000000,
          internal_clearing_rate: 160000,
          subscription_tier: 'pro',
          subscription_expires_at: '2026-12-31T00:00:00Z',
          franchise_agreement_date: '2025-06-10T00:00:00Z'
        },
        {
          id: 'tenant-danang',
          name: 'Bella Spa Đà Nẵng - Tourist',
          contact_phone: '0905555555',
          email: 'danang@bellaspa.vn',
          status: 'active',
          logo_url: null,
          created_at: '2025-11-01T00:00:00Z',
          updated_at: '2026-05-22T00:00:00Z',
          address: '90 Võ Nguyên Giáp, Ngũ Hành Sơn, Đà Nẵng',
          staffCount: 8,
          customerCount: 450,
          revenueSum: 900000000,
          royalty_type: 'percentage',
          royalty_rate: 4,
          royalty_fixed_amount: 0,
          internal_clearing_rate: 140000,
          subscription_tier: 'basic',
          subscription_expires_at: '2026-11-01T00:00:00Z',
          franchise_agreement_date: '2025-11-01T00:00:00Z'
        },
        {
          id: 'tenant-cantho',
          name: 'Bella Spa Cần Thơ - Mekong',
          contact_phone: '0906666666',
          email: 'cantho@bellaspa.vn',
          status: 'suspended',
          logo_url: null,
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-22T00:00:00Z',
          address: '120 Nguyễn Văn Cừ, Ninh Kiều, Cần Thơ',
          staffCount: 5,
          customerCount: 150,
          revenueSum: 150000000,
          royalty_type: 'percentage',
          royalty_rate: 5,
          royalty_fixed_amount: 0,
          internal_clearing_rate: 150000,
          subscription_tier: 'free_trial',
          subscription_expires_at: '2026-06-01T00:00:00Z',
          franchise_agreement_date: '2026-05-01T00:00:00Z'
        }
      ]);

      // Mock Royalty invoices
      setInvoices([
        {
          id: 'inv-demo-1',
          tenant_id: 'tenant-q1',
          invoice_number: 'FR-202604-001',
          month_year: '2026-04',
          gross_revenue: 1200000000,
          calculated_amount: 60000000,
          royalty_type: 'percentage',
          royalty_rate: 5,
          royalty_fixed_amount: 0,
          status: 'paid',
          created_at: '2026-05-01T00:00:00Z',
          paid_at: '2026-05-05T10:00:00Z',
          payment_method: 'VietQR Webhook',
          notes: 'Đã gạch nợ thành công qua VietQR Webhook',
          tenants: { id: 'tenant-q1', name: 'Bella Spa Quận 1 - Premium' }
        },
        {
          id: 'inv-demo-2',
          tenant_id: 'tenant-q3',
          invoice_number: 'FR-202604-002',
          month_year: '2026-04',
          gross_revenue: 850000000,
          calculated_amount: 68000000,
          royalty_type: 'percentage',
          royalty_rate: 8,
          royalty_fixed_amount: 0,
          status: 'pending',
          created_at: '2026-05-01T00:00:00Z',
          paid_at: null,
          payment_method: null,
          notes: null,
          tenants: { id: 'tenant-q3', name: 'Bella Spa Quận 3 - Elite' }
        },
        {
          id: 'inv-demo-3',
          tenant_id: 'tenant-thuduc',
          invoice_number: 'FR-202604-003',
          month_year: '2026-04',
          gross_revenue: 600000000,
          calculated_amount: 15000000,
          royalty_type: 'fixed',
          royalty_rate: 0,
          royalty_fixed_amount: 15000000,
          status: 'pending',
          created_at: '2026-05-01T00:00:00Z',
          paid_at: null,
          payment_method: null,
          notes: null,
          tenants: { id: 'tenant-thuduc', name: 'Bella Spa Thủ Đức - Family' }
        }
      ]);

      // Mock clearing records
      setClearingRecords([
        {
          id: 'clear-demo-1',
          clearing_number: 'CLR-202605-001',
          month_year: '2026-05',
          debtor_tenant_id: 'tenant-q1',
          creditor_tenant_id: 'tenant-thuduc',
          session_count: 8,
          clearing_rate: 150000,
          calculated_amount: 1200000,
          status: 'cleared',
          created_at: '2026-05-18T14:00:00Z',
          cleared_at: '2026-05-20T08:30:00Z',
          payment_method: 'HQ Auto',
          notes: 'Tự động tổng hợp đối soát bù trừ',
          debtor: { id: 'tenant-q1', name: 'Bella Spa Quận 1 - Premium' },
          creditor: { id: 'tenant-thuduc', name: 'Bella Spa Thủ Đức - Family' }
        },
        {
          id: 'clear-demo-2',
          clearing_number: 'CLR-202605-002',
          month_year: '2026-05',
          debtor_tenant_id: 'tenant-q3',
          creditor_tenant_id: 'tenant-thuduc',
          session_count: 5,
          clearing_rate: 150000,
          calculated_amount: 750000,
          status: 'pending',
          created_at: '2026-05-21T09:30:00Z',
          cleared_at: null,
          payment_method: null,
          notes: null,
          debtor: { id: 'tenant-q3', name: 'Bella Spa Quận 3 - Elite' },
          creditor: { id: 'tenant-thuduc', name: 'Bella Spa Thủ Đức - Family' }
        },
        {
          id: 'clear-demo-3',
          clearing_number: 'CLR-202605-003',
          month_year: '2026-05',
          debtor_tenant_id: 'tenant-q1',
          creditor_tenant_id: 'tenant-danang',
          session_count: 3,
          clearing_rate: 140000,
          calculated_amount: 420000,
          status: 'pending',
          created_at: '2026-05-22T10:00:00Z',
          cleared_at: null,
          payment_method: null,
          notes: null,
          debtor: { id: 'tenant-q1', name: 'Bella Spa Quận 1 - Premium' },
          creditor: { id: 'tenant-danang', name: 'Bella Spa Đà Nẵng - Tourist' }
        }
      ]);

      // Mock transfer orders
      setTransferOrders([
        {
          id: 'tr-demo-1',
          order_number: 'TO-202605-001',
          requester_tenant_id: 'tenant-danang',
          status: 'pending',
          shipping_carrier: null,
          tracking_number: null,
          notes: 'Xin cấp khẩn cấp dầu massage Lavender chuẩn bị mùa du lịch hè',
          rejection_reason: null,
          created_at: '2026-05-20T09:00:00Z',
          updated_at: '2026-05-20T09:00:00Z',
          approved_at: null,
          shipped_at: null,
          completed_at: null,
          cancelled_at: null,
          requester: { id: 'tenant-danang', name: 'Bella Spa Đà Nẵng - Tourist' },
          items: [
            { name: 'Dầu massage Lavender 500ml', sku: 'SKU-LAV-500', qty: 50, unit: 'chai' },
            { name: 'Khăn cotton cao cấp', sku: 'SKU-COT-TOWEL', qty: 100, unit: 'cái' }
          ]
        },
        {
          id: 'tr-demo-2',
          order_number: 'TO-202605-002',
          requester_tenant_id: 'tenant-thuduc',
          status: 'shipped',
          shipping_carrier: 'Giao Hàng Nhanh (GHN)',
          tracking_number: 'GHN884210953',
          notes: 'Cấp bù vật tư định kỳ tháng 5',
          rejection_reason: null,
          created_at: '2026-05-18T14:30:00Z',
          updated_at: '2026-05-19T10:00:00Z',
          approved_at: '2026-05-19T09:00:00Z',
          shipped_at: '2026-05-19T10:00:00Z',
          completed_at: null,
          cancelled_at: null,
          requester: { id: 'tenant-thuduc', name: 'Bella Spa Thủ Đức - Family' },
          items: [
            { name: 'Tinh dầu sả chanh 100ml', sku: 'SKU-LEM-100', qty: 20, unit: 'chai' },
            { name: 'Nước xịt sát khuẩn tay', sku: 'SKU-SAN-HAND', qty: 30, unit: 'chai' }
          ]
        },
        {
          id: 'tr-demo-3',
          order_number: 'TO-202605-003',
          requester_tenant_id: 'tenant-q3',
          status: 'completed',
          shipping_carrier: 'Viettel Post',
          tracking_number: 'VTP99382109',
          notes: 'Cấp bù vật tư đợt khai trương phòng xông hơi mới',
          rejection_reason: null,
          created_at: '2026-05-15T08:00:00Z',
          updated_at: '2026-05-17T15:00:00Z',
          approved_at: '2026-05-16T08:00:00Z',
          shipped_at: '2026-05-16T09:00:00Z',
          completed_at: '2026-05-17T15:00:00Z',
          cancelled_at: null,
          requester: { id: 'tenant-q3', name: 'Bella Spa Quận 3 - Elite' },
          items: [
            { name: 'Muối khoáng Himalaya 1kg', sku: 'SKU-HIM-SALT', qty: 10, unit: 'túi' }
          ]
        }
      ]);

      // Mock audit logs
      setAuditLogs([
        {
          id: 'log-demo-1',
          tenant_name: 'Bella Spa Quận 1 - Premium',
          user_name: 'Admin Q1 (Nguyễn Hồng)',
          changed_by_id: 'user-demo-1',
          action: 'UPDATE',
          table_name: 'bookings',
          record_id: 'bk-202',
          old_data: { status: 'booked' },
          new_data: { status: 'confirmed', note: 'Đối soát QR động Casso thành công' },
          tenant_id: 'tenant-q1',
          created_at: new Date(Date.now() - 5 * 60000).toISOString()
        },
        {
          id: 'log-demo-2',
          tenant_name: 'Bella Spa Thủ Đức - Family',
          user_name: 'KTV Trưởng (Lê Hạnh)',
          changed_by_id: 'user-demo-2',
          action: 'INSERT',
          table_name: 'attendance',
          record_id: 'att-998',
          old_data: null,
          new_data: { ktv_id: 'ktv-4', check_in_time: '2026-05-22T08:00:00Z', status: 'present' },
          tenant_id: 'tenant-thuduc',
          created_at: new Date(Date.now() - 15 * 60000).toISOString()
        },
        {
          id: 'log-demo-3',
          tenant_name: 'Bella Spa Quận 3 - Elite',
          user_name: 'HQ Super Admin',
          changed_by_id: 'user-demo-3',
          action: 'UPDATE',
          table_name: 'franchise_agreements',
          record_id: 'fa-q3',
          old_data: { royalty_rate: 6 },
          new_data: { royalty_rate: 8, reason: 'Điều chỉnh theo quy mô chi nhánh' },
          tenant_id: 'tenant-q3',
          created_at: new Date(Date.now() - 60 * 60000).toISOString()
        }
      ]);

      // Mock templates
      setTemplates([
        {
          id: 'tpl-demo-1',
          name: 'Liệu trình Bầu Rạng Rỡ 10 buổi',
          price: 5500000,
          duration: '90 phút/buổi',
          total_sessions: 10,
          ktv_commission: 150000,
          price_floor: 4500000,
          price_cap: 6500000,
          allowed_franchise_override: true,
          details: ['Massage bầu chuyên sâu', 'Thảo dược ngâm chân', 'Mặt nạ thiên nhiên'],
          offer: 'Tặng 1 buổi chăm sóc da mặt miễn phí',
          is_hq_template: true,
          created_at: new Date().toISOString()
        },
        {
          id: 'tpl-demo-2',
          name: 'Liệu trình Bé Khỏe Bé Ngoan 5 buổi',
          price: 1800000,
          duration: '60 phút/buổi',
          total_sessions: 5,
          ktv_commission: 80000,
          price_floor: 1500000,
          price_cap: 2200000,
          allowed_franchise_override: false,
          details: ['Tắm bé chuẩn y khoa', 'Massage kích thích vận động', 'Chăm sóc rốn'],
          offer: 'Tặng bộ sữa tắm thảo dược',
          is_hq_template: true,
          created_at: new Date().toISOString()
        }
      ]);

      setDistributedList([
        {
          id: 'dist-demo-1',
          name: 'Liệu trình Bầu Rạng Rỡ 10 buổi',
          price: 5500000,
          tenant_id: 'tenant-q1',
          tenant_name: 'Bella Spa Quận 1 - Premium',
          template_id: 'tpl-demo-1',
          status: 'active'
        },
        {
          id: 'dist-demo-2',
          name: 'Liệu trình Bầu Rạng Rỡ 10 buổi',
          price: 5800000,
          tenant_id: 'tenant-q3',
          tenant_name: 'Bella Spa Quận 3 - Elite',
          template_id: 'tpl-demo-1',
          status: 'active'
        },
        {
          id: 'dist-demo-3',
          name: 'Liệu trình Bé Khỏe Bé Ngoan 5 buổi',
          price: 1800000,
          tenant_id: 'tenant-thuduc',
          tenant_name: 'Bella Spa Thủ Đức - Family',
          template_id: 'tpl-demo-2',
          status: 'active'
        }
      ]);

      setAuditTables(['bookings', 'attendance', 'franchise_agreements', 'inventory_transfers']);
      setAuditUsers([
        { id: 'usr-1', name: 'Admin Q1 (Nguyễn Hồng)' },
        { id: 'usr-2', name: 'KTV Trưởng (Lê Hạnh)' },
        { id: 'usr-3', name: 'HQ Super Admin' }
      ]);

      toast.success('Đã kích hoạt CHẾ ĐỘ DEMO mô phỏng chuỗi! Dữ liệu ảo được tải an toàn và cách ly.');
    } else {
      setIsDemoMode(false);
      setStats(initialStats);
      setTenants(initialTenants);
      setInvoices([]);
      setClearingRecords([]);
      setTransferOrders([]);
      setAuditLogs([]);
      setTemplates([]);
      setDistributedList([]);
      toast.success('Đã tắt Chế độ Demo. Đang nạp lại dữ liệu thực tế từ cơ sở dữ liệu...');
      // Reload actual db data
      setTimeout(() => {
        setLoading(true);
        getHqDashboardStats()
          .then(freshStats => setStats(freshStats as HqDashboardStats))
          .catch(() => {});
        getAllTenants()
          .then(freshTenants => setTenants(freshTenants as unknown as HqTenantRecord[]))
          .catch(() => {})
          .finally(() => setLoading(false));
      }, 500);
    }
  };

  // Sync data manually
  const refreshData = async () => {
    if (isDemoMode) {
      toast.info('Bạn đang ở chế độ Demo mô phỏng. Vui lòng tắt chế độ Demo để nạp dữ liệu thực tế.');
      return;
    }
    setLoading(true);
    try {
      const freshStats = await getHqDashboardStats() as HqDashboardStats;
      const freshTenants = await getAllTenants() as unknown as HqTenantRecord[];
      setStats(freshStats);
      setTenants(freshTenants);
      
      if (activeTab === 'franchise') {
        await loadRoyaltyData();
      } else if (activeTab === 'clearing') {
        await loadClearingData();
      } else if (activeTab === 'transfers') {
        await loadTransferData();
      } else if (activeTab === 'audit') {
        await loadAuditData(currentPage);
      } else if (activeTab === 'services') {
        await loadServicesData();
      }
      
      toast.success('Đồng bộ dữ liệu Bella HQ thành công!');
    } catch (err) {
      const errorObj = err as Error;
      toast.error('Lỗi khi tải lại dữ liệu: ' + errorObj.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRoyaltyData = async () => {
    if (isDemoMode) return;
    setLoadingRoyalty(true);
    try {
      const data = await getFranchiseRoyaltyInvoices();
      setInvoices(data);
    } catch (err: any) {
      toast.error('Không thể tải hóa đơn nhượng quyền: ' + err.message);
    } finally {
      setLoadingRoyalty(false);
    }
  };

  const loadClearingData = async () => {
    if (isDemoMode) return;
    setLoadingClearing(true);
    try {
      const data = await getInterBranchClearingRecords();
      setClearingRecords(data);
    } catch (err: any) {
      toast.error('Không thể tải đối soát liên chi nhánh: ' + err.message);
    } finally {
      setLoadingClearing(false);
    }
  };

  const loadTransferData = async () => {
    if (isDemoMode) return;
    setLoadingTransfers(true);
    try {
      const data = await getInventoryTransferOrders();
      setTransferOrders(data);
    } catch (err: any) {
      toast.error('Không thể tải danh sách chuyển kho: ' + err.message);
    } finally {
      setLoadingTransfers(false);
    }
  };

  const loadAuditData = async (page: number = 1) => {
    if (isDemoMode) return;
    setLoadingAudit(true);
    try {
      const logs = await getHqAuditLogs({
        tenantId: selectedTenant,
        userId: selectedUser,
        action: selectedAction as any,
        tableName: selectedTable,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit: 15
      });
      setAuditLogs(logs);
      
      // Load tables and users dropdown lists if empty
      if (auditTables.length === 0) {
        const tables = await getAuditTables();
        setAuditTables(tables);
      }
      if (auditUsers.length === 0) {
        const users = await getAuditUsers();
        setAuditUsers(users);
      }
    } catch (err: any) {
      toast.error('Không thể tải nhật ký kiểm toán: ' + err.message);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleOpenShipModal = (order: InventoryTransferOrder) => {
    setSelectedTransfer(order);
    setShippingCarrier('Giao Hàng Nhanh (GHN)');
    setTrackingNumber('');
    setShowShipModal(true);
  };

  const handleOpenCancelModal = (order: InventoryTransferOrder) => {
    setSelectedTransfer(order);
    setRefusingReason('');
    setShowCancelModal(true);
  };

  const handleApproveAndShip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransfer) return;
    if (!shippingCarrier.trim() || !trackingNumber.trim()) {
      toast.error('Vui lòng nhập đầy đủ thông tin đơn vị vận chuyển và mã vận đơn');
      return;
    }

    if (isDemoMode) {
      toast.success(`Đã duyệt và giao hàng thành công đơn ${selectedTransfer.order_number} (Demo Mode)!`);
      setTransferOrders(prev => prev.map(to => 
        to.id === selectedTransfer.id ? { 
          ...to, 
          status: 'shipped', 
          shipping_carrier: shippingCarrier, 
          tracking_number: trackingNumber,
          shipped_at: new Date().toISOString()
        } : to
      ));
      setShowShipModal(false);
      setSelectedTransfer(null);
      return;
    }

    setSubmittingTransferAction(true);
    try {
      const res = await approveAndShipTransfer(selectedTransfer.id, shippingCarrier, trackingNumber);
      if (res.success) {
        toast.success(`Đã duyệt và giao hàng thành công đơn ${selectedTransfer.order_number}!`);
        setShowShipModal(false);
        setSelectedTransfer(null);
        await loadTransferData();
      } else {
        toast.error(res.error || 'Duyệt giao hàng thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setSubmittingTransferAction(false);
    }
  };

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransfer) return;

    if (isDemoMode) {
      toast.success(`Đã từ chối cấp hàng cho đơn ${selectedTransfer.order_number} (Demo Mode)`);
      setTransferOrders(prev => prev.map(to => 
        to.id === selectedTransfer.id ? { 
          ...to, 
          status: 'cancelled', 
          rejection_reason: refusingReason || 'Tổng bộ từ chối cấp hàng'
        } : to
      ));
      setShowCancelModal(false);
      setSelectedTransfer(null);
      return;
    }

    setSubmittingTransferAction(true);
    try {
      const res = await cancelTransferOrder(selectedTransfer.id, refusingReason || 'Tổng bộ từ chối cấp hàng');
      if (res.success) {
        toast.success(`Đã từ chối cấp hàng cho đơn ${selectedTransfer.order_number}`);
        setShowCancelModal(false);
        setSelectedTransfer(null);
        await loadTransferData();
      } else {
        toast.error(res.error || 'Từ chối cấp hàng thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setSubmittingTransferAction(false);
    }
  };

  const handleClearRecord = async (recordId: string, clearingNumber: string) => {
    if (!window.confirm(`Xác nhận GẠCH NỢ nội bộ cho đối soát ${clearingNumber}? Hành động này sẽ chuyển trạng thái sang Đã thanh toán.`)) return;
    
    if (isDemoMode) {
      toast.success(`Đã gạch nợ đối soát ${clearingNumber} thành công (Demo Mode)!`);
      setClearingRecords(prev => prev.map(cr => 
        cr.id === recordId ? { ...cr, status: 'cleared', cleared_at: new Date().toISOString(), payment_method: 'HQ Manual (Demo)' } : cr
      ));
      return;
    }

    try {
      const res = await clearInterBranchRecord(recordId, 'HQ Manual');
      if (res.success) {
        toast.success(`Đã gạch nợ đối soát ${clearingNumber} thành công!`);
        await loadClearingData();
      } else {
        toast.error(res.error || 'Thao tác gạch nợ thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    }
  };

  const handleOpenClearingRate = (tenant: HqTenantRecord) => {
    setEditingClearingRateTenant(tenant);
    setNewClearingRate(String(tenant.internal_clearing_rate ?? 150000));
  };

  const handleSaveClearingRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClearingRateTenant) return;

    const rateNum = parseFloat(newClearingRate) || 0;

    if (isDemoMode) {
      toast.success(`Đã cấu hình đơn giá đối soát bù trừ nội bộ cho ${editingClearingRateTenant.name} (Demo Mode)!`);
      setTenants(prev => prev.map(t => 
        t.id === editingClearingRateTenant.id ? { ...t, internal_clearing_rate: rateNum } : t
      ));
      setEditingClearingRateTenant(null);
      return;
    }

    setSubmittingClearingRate(true);
    try {
      const res = await updateTenantClearingRate(editingClearingRateTenant.id, rateNum);
      if (res.success) {
        toast.success(`Đã cấu hình đơn giá đối soát bù trừ nội bộ cho ${editingClearingRateTenant.name}!`);
        setEditingClearingRateTenant(null);
        const freshTenants = await getAllTenants() as unknown as HqTenantRecord[];
        setTenants(freshTenants);
      } else {
        toast.error(res.error || 'Cập nhật thất bại.');
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setSubmittingClearingRate(false);
    }
  };

  // Standard Service & Templates loaders & handlers (Phase 2)
  const loadServicesData = async () => {
    if (isDemoMode) return;
    setLoadingServices(true);
    try {
      const tList = await getHqPackageTemplates();
      setTemplates(tList);

      const matrix = await getBrandDistributionMatrix();
      setDistributedList(matrix.distributed);
      // Exclude HQ branch itself when listing target branches to distribute
      const filteredTenantsForMatrix = matrix.tenants.filter((t: { id: string; name: string }) => t.name !== 'Bella Spa Headquarter');
      setMatrixTenants(filteredTenantsForMatrix);
    } catch (err: any) {
      toast.error('Không thể tải danh sách liệu trình và ma trận phân phối: ' + err.message);
    } finally {
      setLoadingServices(false);
    }
  };

  const handleOpenTemplateModal = (template: HqPackageTemplate | null = null) => {
    setEditingTemplate(template);
    if (template) {
      setTemplateName(template.name);
      setTemplatePrice(String(template.price));
      setTemplateDuration(template.duration ?? '');
      setTemplateTotalSessions(String(template.total_sessions));
      setTemplateKtvCommission(String(template.ktv_commission));
      setTemplatePriceFloor(String(template.price_floor ?? template.price));
      setTemplatePriceCap(String(template.price_cap ?? template.price));
      setTemplateAllowedOverride(template.allowed_franchise_override);
      setTemplateDetails(template.details || []);
      setTemplateOffer(template.offer || '');
    } else {
      setTemplateName('');
      setTemplatePrice('500000');
      setTemplateDuration('90 phút/buổi');
      setTemplateTotalSessions('10');
      setTemplateKtvCommission('150000');
      setTemplatePriceFloor('400000');
      setTemplatePriceCap('600000');
      setTemplateAllowedOverride(true);
      setTemplateDetails([]);
      setTemplateOffer('');
    }
    setNewDetailText('');
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      toast.error('Vui lòng điền tên liệu trình');
      return;
    }

    const priceNum = parseFloat(templatePrice) || 0;
    const totalSessionsNum = parseInt(templateTotalSessions) || 1;
    const commissionNum = parseFloat(templateKtvCommission) || 0;
    const floorNum = parseFloat(templatePriceFloor) || 0;
    const capNum = parseFloat(templatePriceCap) || 0;

    const data = {
      name: templateName,
      price: priceNum,
      duration: templateDuration,
      total_sessions: totalSessionsNum,
      ktv_commission: commissionNum,
      price_floor: floorNum || priceNum,
      price_cap: capNum || priceNum,
      allowed_franchise_override: templateAllowedOverride,
      details: templateDetails,
      offer: templateOffer || null
    };

    if (isDemoMode) {
      if (editingTemplate) {
        toast.success(`Đã cập nhật liệu trình chuẩn ${templateName} thành công (Demo Mode)!`);
        setTemplates(prev => prev.map(t => 
          t.id === editingTemplate.id ? { ...t, ...data } : t
        ));
      } else {
        toast.success(`Đã thêm mới liệu trình chuẩn ${templateName} thành công (Demo Mode)!`);
        const newTpl: HqPackageTemplate = {
          id: 'tpl-demo-' + Math.random().toString(36).substr(2, 9),
          ...data,
          is_hq_template: true,
          created_at: new Date().toISOString()
        };
        setTemplates(prev => [newTpl, ...prev]);
      }
      setShowTemplateModal(false);
      return;
    }

    setSubmittingTemplate(true);
    try {
      if (editingTemplate) {
        const res = await updateHqPackageTemplate(editingTemplate.id, data);
        if (res.success) {
          toast.success(`Đã cập nhật liệu trình chuẩn ${templateName} thành công!`);
          setShowTemplateModal(false);
          await loadServicesData();
        } else {
          toast.error(res.error || 'Cập nhật thất bại');
        }
      } else {
        const res = await createHqPackageTemplate(data);
        if (res.success) {
          toast.success(`Đã thêm mới liệu trình chuẩn ${templateName} thành công!`);
          setShowTemplateModal(false);
          await loadServicesData();
        } else {
          toast.error(res.error || 'Thêm mới thất bại');
        }
      }
    } catch (err: any) {
      toast.error('Lỗi lưu liệu trình: ' + err.message);
    } finally {
      setSubmittingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa liệu trình chuẩn "${name}"? Hành động này sẽ chỉ xóa gói mẫu tại HQ và không tự động xóa các gói đã phân phối ở chi nhánh con để tránh mất dữ liệu vận hành.`)) return;
    
    if (isDemoMode) {
      toast.success(`Đã xóa liệu trình chuẩn ${name} thành công (Demo Mode)!`);
      setTemplates(prev => prev.filter(t => t.id !== id));
      return;
    }

    try {
      const res = await deleteHqPackageTemplate(id);
      if (res.success) {
        toast.success(`Đã xóa liệu trình chuẩn ${name} thành công!`);
        await loadServicesData();
      } else {
        toast.error(res.error || 'Xóa thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi khi xóa: ' + err.message);
    }
  };

  const handleOpenDistributionModal = (template: HqPackageTemplate) => {
    setSelectedTemplateForDist(template);
    setSelectedTenantIds([]);
    setShowDistributionModal(true);
  };

  const handleDistributeTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateForDist) return;
    if (selectedTenantIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một chi nhánh để phân phối');
      return;
    }

    if (isDemoMode) {
      toast.success(`Đã phân phối liệu trình "${selectedTemplateForDist.name}" đến ${selectedTenantIds.length} chi nhánh thành công (Demo Mode)!`);
      const newDists = selectedTenantIds.map(tid => {
        const targetTenant = tenants.find(t => t.id === tid);
        return {
          id: 'dist-demo-' + Math.random().toString(36).substr(2, 9),
          name: selectedTemplateForDist.name,
          price: selectedTemplateForDist.price,
          tenant_id: tid,
          tenant_name: targetTenant ? targetTenant.name : 'Unknown Branch',
          template_id: selectedTemplateForDist.id,
          status: 'active'
        };
      });
      setDistributedList(prev => [...newDists, ...prev]);
      setShowDistributionModal(false);
      setSelectedTenantIds([]);
      return;
    }

    setSubmittingDistribution(true);
    try {
      const res = await distributeTemplateToTenants(selectedTemplateForDist.id, selectedTenantIds);
      if (res.success) {
        toast.success(`Đã phân phối liệu trình "${selectedTemplateForDist.name}" đến ${selectedTenantIds.length} chi nhánh thành công!`);
        setShowDistributionModal(false);
        setSelectedTenantIds([]);
        await loadServicesData();
      } else {
        toast.error(res.error || 'Phân phối thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi phân phối: ' + err.message);
    } finally {
      setSubmittingDistribution(false);
    }
  };

  const addDetailStep = () => {
    if (newDetailText.trim()) {
      setTemplateDetails([...templateDetails, newDetailText.trim()]);
      setNewDetailText('');
    }
  };

  const removeDetailStep = (index: number) => {
    setTemplateDetails(templateDetails.filter((_, idx) => idx !== index));
  };

  const getDiffs = (oldObj: any, newObj: any) => {
    const keys = Array.from(new Set([
      ...Object.keys(oldObj || {}),
      ...Object.keys(newObj || {})
    ]));
    
    return keys.map(key => {
      const oldVal = oldObj ? oldObj[key] : undefined;
      const newVal = newObj ? newObj[key] : undefined;
      const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);
      
      let type: 'insert' | 'delete' | 'update' | 'unchanged' = 'unchanged';
      if (oldVal === undefined && newVal !== undefined) type = 'insert';
      else if (oldVal !== undefined && newVal === undefined) type = 'delete';
      else if (isChanged) type = 'update';
      
      return { key, oldVal, newVal, type };
    }).filter(d => d.type !== 'unchanged');
  };

  useEffect(() => {
    // Default to live database view on mount. No auto-toggle demo.
  }, []);

  useEffect(() => {
    if (activeTab === 'franchise') {
      loadRoyaltyData();
    } else if (activeTab === 'clearing') {
      loadClearingData();
    } else if (activeTab === 'transfers') {
      loadTransferData();
    } else if (activeTab === 'audit') {
      loadAuditData(currentPage);
    } else if (activeTab === 'services') {
      loadServicesData();
    }
  }, [activeTab, currentPage]);

  useEffect(() => {
    if (activeTab === 'audit') {
      setCurrentPage(1);
      loadAuditData(1);
    }
  }, [selectedTenant, selectedUser, selectedAction, selectedTable, startDate, endDate]);

  const handleToggleStatus = async (tenantId: string, currentStatus: 'active' | 'suspended') => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const confirmMsg = newStatus === 'suspended' 
      ? 'Bạn có chắc chắn muốn TẠM NGƯNG chi nhánh này? Toàn bộ nhân sự và KTV của chi nhánh sẽ bị chặn truy cập ngay lập tức!'
      : 'Kích hoạt lại chi nhánh này để cho phép truy cập hoạt động bình thường?';

    if (!window.confirm(confirmMsg)) return;

    if (isDemoMode) {
      toast.success(newStatus === 'suspended' ? 'Đã khóa chi nhánh thành công (Demo Mode)!' : 'Đã mở khóa chi nhánh thành công (Demo Mode)!');
      
      // Update local state instantly
      setTenants(prev => prev.map(t => 
        t.id === tenantId ? { ...t, status: newStatus } : t
      ));
      
      // Refresh mock stats
      setStats(prev => ({
        ...prev,
        activeSpas: newStatus === 'active' ? prev.activeSpas + 1 : prev.activeSpas - 1,
        suspendedSpas: newStatus === 'suspended' ? prev.suspendedSpas + 1 : prev.suspendedSpas - 1
      }));
      return;
    }

    setUpdatingId(tenantId);
    try {
      const res = await toggleTenantStatus(tenantId, newStatus);
      if (res.success) {
        toast.success(newStatus === 'suspended' ? 'Đã khóa chi nhánh thành công!' : 'Đã mở khóa chi nhánh thành công!');
        
        // Update local state instantly
        setTenants(prev => prev.map(t => 
          t.id === tenantId ? { ...t, status: newStatus } : t
        ));
        
        // Refresh full stats
        const freshStats = await getHqDashboardStats() as HqDashboardStats;
        setStats(freshStats);
      } else {
        toast.error(res.error || 'Thao tác thất bại');
      }
    } catch (err) {
      const errorObj = err as Error;
      toast.error('Có lỗi xảy ra: ' + errorObj.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenConfig = (tenant: HqTenantRecord) => {
    setEditingTenant(tenant);
    setRoyaltyType(tenant.royalty_type || 'percentage');
    setRoyaltyRate(String(tenant.royalty_rate ?? 0));
    setRoyaltyFixedAmount(String(tenant.royalty_fixed_amount ?? 0));
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    
    const rateNum = parseFloat(royaltyRate) || 0;
    const amountNum = parseFloat(royaltyFixedAmount) || 0;

    if (isDemoMode) {
      toast.success(`Đã cấu hình chính sách phí nhượng quyền cho ${editingTenant.name} (Demo Mode)!`);
      setTenants(prev => prev.map(t => 
        t.id === editingTenant.id ? { 
          ...t, 
          royalty_type: royaltyType, 
          royalty_rate: rateNum, 
          royalty_fixed_amount: amountNum 
        } : t
      ));
      setEditingTenant(null);
      return;
    }

    setSubmittingConfig(true);
    try {
      const res = await updateFranchiseRoyaltyConfig(
        editingTenant.id,
        royaltyType,
        rateNum,
        amountNum
      );
      
      if (res.success) {
        toast.success(`Đã cấu hình chính sách phí nhượng quyền cho ${editingTenant.name}!`);
        setEditingTenant(null);
        
        // Refresh local tenants data
        const freshTenants = await getAllTenants() as unknown as HqTenantRecord[];
        setTenants(freshTenants);
      } else {
        toast.error(res.error || 'Cập nhật chính sách thất bại.');
      }
    } catch (err: any) {
      toast.error('Lỗi lưu cấu hình: ' + err.message);
    } finally {
      setSubmittingConfig(false);
    }
  };

  const handleReconcileInvoice = async (invoiceNumber: string) => {
    if (!window.confirm(`Xác nhận DUYỆT THANH TOÁN (đối soát tiền mặt/chuyển khoản thủ công) cho hóa đơn nhượng quyền ${invoiceNumber}?`)) return;
    
    if (isDemoMode) {
      toast.success(`Hóa đơn ${invoiceNumber} đã được gạch nợ thành công (Demo Mode)!`);
      setInvoices(prev => prev.map(inv => 
        inv.invoice_number === invoiceNumber ? { 
          ...inv, 
          status: 'paid', 
          paid_at: new Date().toISOString(), 
          payment_method: 'HQ Reconciled (Demo)',
          notes: 'Đã gạch nợ thủ công bởi Trụ sở (Demo)'
        } : inv
      ));
      return;
    }

    setLoadingRoyalty(true);
    try {
      const res = await payFranchiseRoyaltyInvoice(invoiceNumber, 'HQ Reconciled');
      if (res.success) {
        toast.success(`Hóa đơn ${invoiceNumber} đã được gạch nợ thành công!`);
        await loadRoyaltyData();
      } else {
        toast.error(res.error || 'Gạch nợ thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi khi đối soát: ' + err.message);
    } finally {
      setLoadingRoyalty(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        document.cookie = 'mock_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success('Đăng xuất thành công');
      window.location.href = '/login';
    } catch (e) {
      console.error('Logout error:', e);
      window.location.href = '/login';
    }
  };

  // Filtered tenants (excluding Headquarter itself)
  const filteredTenants = tenants.filter(t => {
    if (t.name === 'Bella Spa Headquarter') return false;
    const matchSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (t.contact_phone && t.contact_phone.includes(searchTerm)) ||
                        (t.email && t.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    
    const isFranchise = t.franchise_agreement_date !== null || t.royalty_type !== null;
    const matchType = typeFilter === 'all' || 
                      (typeFilter === 'direct' && !isFranchise) || 
                      (typeFilter === 'franchise' && isFranchise);
                      
    return matchSearch && matchStatus && matchType;
  });

  const getTierBadge = (tier?: string | null) => {
    const activeTier = tier || 'free_trial';
    switch (activeTier) {
      case 'enterprise':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-500 text-white shadow-md shadow-purple-100 border border-white/20 select-none animate-pulse">
            <Crown size={10} className="text-yellow-300 fill-yellow-300" />
            Diamond / Franchise
          </span>
        );
      case 'pro':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 shadow-sm shadow-yellow-100 border border-amber-300/30 select-none">
            <Award size={10} className="fill-amber-950/20 text-amber-950" />
            Gold / Pro
          </span>
        );
      case 'basic':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-slate-200 to-slate-300 text-slate-800 border border-slate-350 select-none">
            <Sparkles size={10} className="text-slate-600 fill-slate-600/10" />
            Silver / Basic
          </span>
        );
      case 'free_trial':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200/50 select-none">
            <Info size={10} className="text-slate-400" />
            Dùng thử
          </span>
        );
    }
  };

  const getExpirationInfo = (expiryStr?: string | null, tier?: string | null) => {
    if (tier === 'enterprise') return <span className="text-[9px] text-slate-400 font-bold block mt-0.5 select-none">Không thời hạn</span>;
    if (!expiryStr) return <span className="text-[9px] text-slate-400 font-bold block mt-0.5 select-none">Không giới hạn</span>;
    const date = new Date(expiryStr);
    const isExpired = date < new Date();
    return (
      <span className={`text-[9px] font-bold block mt-0.5 select-none ${isExpired ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`}>
        Hạn: {date.toLocaleDateString('vi-VN')} {isExpired && '(Hết hạn)'}
      </span>
    );
  };

  // Calculate dynamic stats for SVG growth chart
  const maxGrowth = Math.max(...(stats.spaGrowthData || []).map((d) => d.spas), 1);

  // Franchise Billing aggregates
  const totalProjectedFees = invoices.reduce((acc, inv) => acc + Number(inv.calculated_amount), 0);
  const totalCollectedFees = invoices.filter(inv => inv.status === 'paid').reduce((acc, inv) => acc + Number(inv.calculated_amount), 0);
  const totalOutstandingFees = invoices.filter(inv => inv.status === 'pending').reduce((acc, inv) => acc + Number(inv.calculated_amount), 0);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 font-sans antialiased text-slate-800">
      {/* Super Top Premium Navigation Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/70 border-b border-slate-100 px-6 py-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="drop-shadow-lg"
          >
            <img src="/logo.png" alt="Bella Spa Logo" className="h-10 w-auto object-contain" />
          </motion.div>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <h1 className="text-sm font-black text-slate-900 tracking-wider uppercase flex items-center gap-1.5">
              Bella Spa Headquarter 
              <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase">HQ Portal</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Hệ thống Quản trị Cấp cao</p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Active Admin Profile */}
          <div className="flex items-center gap-3 bg-white/90 border border-slate-100 rounded-full py-1.5 pl-3 pr-4 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center font-black text-xs text-primary">
              {currentUser.full_name?.charAt(0) || 'A'}
            </div>
            <div className="text-left leading-none">
              <p className="text-[11px] font-black text-slate-800">{currentUser.full_name || 'Super Admin'}</p>
              <span className="text-[8px] font-black text-primary uppercase tracking-widest">Cấp cao</span>
            </div>
          </div>

          {/* Phase 29.3 — Multi-branch Financial Overview */}
          <a
            href="/hq/financial-overview"
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-full shadow-md hover:shadow-emerald-100 transition-all active:scale-95 cursor-pointer"
          >
            <PieChart size={12} />
            Tổng quan Tài chính
          </a>

          {/* Sign Up Chi Nhánh Button */}
          <a
            href="/signup"
            className="flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-full shadow-md hover:shadow-rose-100 transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={12} />
            Đăng ký Chi Nhánh
          </a>

          {/* Regular Dashboard Redirect */}
          <a 
            href="/dashboard"
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <ExternalLink size={12} />
            Hồ sơ Spa Trụ sở
          </a>

          {/* Demo Mode Toggle Button */}
          <button
            onClick={() => handleToggleDemo(!isDemoMode)}
            className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-full shadow-md transition-all active:scale-95 cursor-pointer ${
              isDemoMode 
                ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-rose-200 border border-rose-400/20 animate-pulse' 
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
            }`}
            title={isDemoMode ? 'Đang bật mô phỏng chuỗi chi nhánh' : 'Bật chế độ mô phỏng demo chuỗi'}
          >
            <Sparkles size={12} className={isDemoMode ? 'text-yellow-250 fill-yellow-200 animate-spin' : 'text-slate-400'} />
            {isDemoMode ? 'Demo Mode Active' : 'Chạy Demo Chuỗi'}
          </button>

          {/* Sync Button */}
          <button
            onClick={refreshData}
            disabled={loading}
            className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-primary transition-all active:scale-95 disabled:opacity-50 shadow-sm"
            title="Đồng bộ lại"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-primary' : ''} />
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-10 h-10 rounded-full border border-rose-100 bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-500 transition-all active:scale-95 shadow-sm"
            title="Đăng xuất"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8 space-y-8">
        
        {/* Welcome Section */}
        <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-[3rem] p-8 md:p-12 text-white shadow-xl shadow-slate-200/50 relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-20%] left-[-10%] w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
          
          <div className="relative z-10 max-w-2xl space-y-3">
            <span className="bg-primary/20 text-rose-300 border border-primary/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest inline-block animate-pulse">
              HỆ THỐNG ĐIỀU HÀNH HOẠT ĐỘNG TOÀN SÀN
            </span>
            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight leading-none !text-white" style={{ color: '#ffffff' }}>
              Xin chào, {currentUser.full_name || 'Super Admin'}
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed font-medium">
              Chào mừng bạn đến với Tổng bộ Quản trị Cấp cao Bella HQ. Nơi bạn giám sát doanh số, cấu hình thỏa thuận tài chính nhượng quyền thương mại (franchise), duyệt đối soát royalty, và quản trị an toàn bảo mật toàn sàn.
            </p>
          </div>
        </section>

        {/* Tab Selection Navigation */}
        <div className="flex justify-center w-full px-4 sm:px-6">
          <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] bg-white/95 border border-slate-100 backdrop-blur-md rounded-[2rem] md:rounded-3xl p-1.5 shadow-sm max-w-7xl w-full gap-1 sm:gap-1.5 whitespace-nowrap scroll-smooth">
            <button
              onClick={() => setActiveTab('branches')}
              className={`flex-1 shrink-0 py-2.5 px-2.5 sm:px-4 lg:px-5 rounded-2xl font-black text-[9px] sm:text-[10px] lg:text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap text-center ${
                activeTab === 'branches'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Chi nhánh Spa
            </button>
            <button
              onClick={() => setActiveTab('franchise')}
              className={`flex-1 shrink-0 py-2.5 px-2.5 sm:px-4 lg:px-5 rounded-2xl font-black text-[9px] sm:text-[10px] lg:text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap text-center ${
                activeTab === 'franchise'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Nhượng quyền & Royalty
            </button>
            <button
              onClick={() => setActiveTab('clearing')}
              className={`flex-1 shrink-0 py-2.5 px-2.5 sm:px-4 lg:px-5 rounded-2xl font-black text-[9px] sm:text-[10px] lg:text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap text-center ${
                activeTab === 'clearing'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Bù trừ liên chi nhánh
            </button>
            <button
              onClick={() => setActiveTab('transfers')}
              className={`flex-1 shrink-0 py-2.5 px-2.5 sm:px-4 lg:px-5 rounded-2xl font-black text-[9px] sm:text-[10px] lg:text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap text-center ${
                activeTab === 'transfers'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Cung ứng & Chuyển kho
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex-1 shrink-0 py-2.5 px-2.5 sm:px-4 lg:px-5 rounded-2xl font-black text-[9px] sm:text-[10px] lg:text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap text-center ${
                activeTab === 'audit'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Nhật ký hệ thống
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className={`flex-1 shrink-0 py-2.5 px-2.5 sm:px-4 lg:px-5 rounded-2xl font-black text-[9px] sm:text-[10px] lg:text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap text-center ${
                activeTab === 'services'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Liệu trình chuẩn
            </button>
          </div>
        </div>

        {activeTab === 'branches' ? (
          <>
            {/* 4 Cards KPI Stats Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* SPA Count */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-primary shrink-0">
                  <Store size={26} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Số chi nhánh Spa</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{stats.totalSpas} Spa</h3>
                  <p className="text-[10px] text-slate-500 font-bold">
                    <span className="text-emerald-600 font-black">{stats.activeSpas} Hoạt động</span> | <span>{stats.suspendedSpas} Khóa</span>
                  </p>
                </div>
              </div>

              {/* System Revenue */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                  <DollarSign size={26} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Doanh thu toàn sàn</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{formatCurrency(stats.totalRevenue)}</h3>
                  <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                    <span className="text-emerald-600 font-black">100% Thực thu đối soát</span>
                  </p>
                </div>
              </div>

              {/* System Total Treatment sessions */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                  <Activity size={26} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tổng ca liệu trình</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{stats.totalSessions} Ca</h3>
                  <p className="text-[10px] text-slate-500 font-bold">Lưu lượng liệu trình thực tế</p>
                </div>
              </div>

              {/* Zalo SMS usage */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
                  <MessageSquare size={26} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Zalo SMS tiêu thụ</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{stats.zaloSmsUsed} Tin</h3>
                  <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                    <span className="text-blue-600 font-black">ZNS Smart Reminders</span>
                  </p>
                </div>
              </div>
            </section>

            {/* Growth visualization (SVG chart) & Quick System Integrity Status */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Spa Growth Chart */}
              <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest text-left">
                    Xu hướng phát triển chi nhánh
                  </h4>
                  <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-emerald-500" />
                    +Tăng trưởng hữu cơ
                  </span>
                </div>

                {/* Premium Custom SVG Bar Chart */}
                <div className="h-64 flex items-end justify-between gap-4 pt-6 px-4">
                  {(stats.spaGrowthData || []).map((data, idx) => {
                    const percentage = (data.spas / maxGrowth) * 80 + 20; // safe scale
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-3 group h-full justify-end">
                        <div className="relative w-full flex justify-center items-end h-full">
                          {/* Tooltip on hover */}
                          <div className="absolute top-[-30px] opacity-0 group-hover:opacity-100 bg-slate-900 text-white font-black text-[9px] px-2 py-1 rounded-lg transition-all scale-95 group-hover:scale-100 z-10 uppercase tracking-widest">
                            {data.spas} Spa
                          </div>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${percentage}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.1, ease: 'easeOut' }}
                            className={`w-full max-w-[40px] rounded-t-xl transition-all ${
                              idx === (stats.spaGrowthData || []).length - 1 
                                ? 'bg-gradient-to-t from-primary to-secondary shadow-lg shadow-pink-200' 
                                : 'bg-slate-100 group-hover:bg-indigo-50'
                            }`}
                          />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-center truncate w-full">
                          {data.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Branch Analytics Comparison Card */}
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 text-left flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      Hiệu năng các chi nhánh
                    </h4>
                    
                    {/* Tiny premium switcher */}
                    <div className="flex bg-slate-100 border border-slate-200/50 rounded-xl p-0.5">
                      <button
                        onClick={() => setCompareMetric('revenue')}
                        className={`px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer ${
                          compareMetric === 'revenue'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Doanh thu
                      </button>
                      <button
                        onClick={() => setCompareMetric('customers')}
                        className={`px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer ${
                          compareMetric === 'customers'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Khách hàng
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-4">
                    {compareMetric === 'revenue' ? 'So sánh tổng doanh số thực thu tích lũy' : 'Tổng số lượng tệp khách hàng đăng ký'}
                  </p>

                  <div className="space-y-4">
                    {tenants
                      .filter(t => t.name !== 'Bella Spa Headquarter')
                      .sort((a, b) => {
                        if (compareMetric === 'revenue') {
                          return (b.revenueSum || 0) - (a.revenueSum || 0);
                        } else {
                          return (b.customerCount || 0) - (a.customerCount || 0);
                        }
                      })
                      .slice(0, 5) // Top 5
                      .map((branch, index) => {
                        const cleanName = branch.name.replace('Bella Spa ', '');
                        const val = compareMetric === 'revenue' ? (branch.revenueSum || 0) : (branch.customerCount || 0);
                        const maxVal = compareMetric === 'revenue' 
                          ? Math.max(...tenants.filter(t => t.name !== 'Bella Spa Headquarter').map(t => t.revenueSum || 0), 1)
                          : Math.max(...tenants.filter(t => t.name !== 'Bella Spa Headquarter').map(t => t.customerCount || 0), 1);
                        
                        const ratio = (val / maxVal) * 100;
                        const rankColor = index === 0 
                          ? 'text-yellow-500' 
                          : index === 1 
                            ? 'text-slate-400' 
                            : index === 2 
                              ? 'text-amber-600' 
                              : 'text-slate-300';
                              
                        return (
                          <div key={branch.id} className="space-y-1.5 group">
                            <div className="flex justify-between items-center text-xs font-bold">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`font-black text-[11px] ${rankColor}`}>#{index + 1}</span>
                                <span className="text-slate-800 truncate" title={branch.name}>{cleanName}</span>
                              </div>
                              <span className="font-black text-slate-900 shrink-0">
                                {compareMetric === 'revenue' ? formatCurrency(val) : `${val.toLocaleString('vi-VN')} khách`}
                              </span>
                            </div>
                            
                            {/* Premium Progress Bar */}
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative shadow-inner">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${ratio}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                className={`h-full rounded-full bg-gradient-to-r ${
                                  compareMetric === 'revenue' 
                                    ? 'from-rose-500 via-purple-600 to-indigo-500 shadow-md shadow-purple-200' 
                                    : 'from-sky-400 via-blue-500 to-indigo-600 shadow-md shadow-blue-200'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-50 mt-4 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest select-none">
                  <span>* Dữ liệu thời gian thực</span>
                  <span className="text-emerald-500 animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Đã đồng bộ
                  </span>
                </div>
              </div>
            </section>

            {/* Subscription packages reference box */}
            <section className="bg-gradient-to-br from-white to-slate-50 border border-slate-100 rounded-[3rem] p-6 shadow-sm text-left">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-rose-50 text-primary rounded-xl flex items-center justify-center">
                  <Crown size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">
                    Thông tin Gói dịch vụ & Định mức Hệ thống
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">
                    Mỗi chi nhánh hoạt động theo giới hạn tài nguyên của gói dịch vụ đã đăng ký.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Free Trial */}
                <div className="bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl p-4 space-y-2 shadow-xs">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-slate-100 text-slate-500">
                      Free Trial
                    </span>
                    <span className="text-[10px] font-black text-slate-400">Dùng thử</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-600 flex justify-between">
                      <span>Kỹ thuật viên:</span> <span className="font-black text-slate-800">Tối đa 1 KTV</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 flex justify-between">
                      <span>Khách hàng:</span> <span className="font-black text-slate-800">Tối đa 15</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 flex justify-between">
                      <span>Zalo SMS:</span> <span className="font-black text-slate-800">Tối đa 20</span>
                    </p>
                  </div>
                </div>

                {/* Basic */}
                <div className="bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl p-4 space-y-2 shadow-xs">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-gradient-to-r from-slate-200 to-slate-300 text-slate-800 border border-slate-350">
                      Silver / Basic
                    </span>
                    <span className="text-[10px] font-black text-slate-500">Cơ bản</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-600 flex justify-between">
                      <span>Kỹ thuật viên:</span> <span className="font-black text-slate-800">Tối đa 3 KTV</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 flex justify-between">
                      <span>Khách hàng:</span> <span className="font-black text-slate-800">Tối đa 50</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 flex justify-between">
                      <span>Zalo SMS:</span> <span className="font-black text-slate-800">Tối đa 100</span>
                    </p>
                  </div>
                </div>

                {/* Pro */}
                <div className="bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl p-4 space-y-2 shadow-xs">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 border border-amber-300/30">
                      Gold / Pro
                    </span>
                    <span className="text-[10px] font-black text-amber-600">Chuyên nghiệp</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-600 flex justify-between">
                      <span>Kỹ thuật viên:</span> <span className="font-black text-slate-800">Tối đa 10 KTV</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 flex justify-between">
                      <span>Khách hàng:</span> <span className="font-black text-slate-800">Tối đa 500</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 flex justify-between">
                      <span>Zalo SMS:</span> <span className="font-black text-slate-800">Tối đa 500</span>
                    </p>
                  </div>
                </div>

                {/* Enterprise */}
                <div className="bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl p-4 space-y-2 shadow-xs">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-500 text-white border border-white/20 animate-pulse">
                      Diamond / Enterprise
                    </span>
                    <span className="text-[10px] font-black text-rose-500">Nhượng quyền</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-600 flex justify-between">
                      <span>Kỹ thuật viên:</span> <span className="font-black text-rose-600">Không giới hạn</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 flex justify-between">
                      <span>Khách hàng:</span> <span className="font-black text-rose-600">Không giới hạn</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 flex justify-between">
                      <span>Zalo SMS:</span> <span className="font-black text-rose-600">Tối đa 2000</span>
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex items-start gap-2 bg-indigo-50/50 border border-indigo-100/40 rounded-xl p-3 text-[11px] text-slate-500 font-bold">
                <Info size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                <p>
                  <span className="text-slate-700 font-black">Hướng dẫn kiểm tra:</span> Chủ chi nhánh (Branch Admin) có thể kiểm tra định mức tài nguyên đã dùng, số KTV đang hoạt động, và gia hạn nâng cấp các gói dịch vụ này trực tiếp trong phần <span className="text-slate-900 font-black">"Cấu hình hệ thống" → Tab "Gói dịch vụ"</span> của trang quản lý chi nhánh. Tổng bộ HQ có thể theo dõi phân loại gói của từng chi nhánh ngay tại danh sách bên dưới.
                </p>
              </div>
            </section>

            {/* Filters and Search Area */}
            <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 text-left">
              <div className="relative w-full xl:max-w-md group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-slate-700 placeholder:text-slate-400 text-sm font-medium"
                  placeholder="Tìm kiếm theo Tên Spa, hotline, email..."
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center w-full xl:w-auto">
                {/* Type Filter */}
                <div className="flex flex-col gap-1 flex-1 sm:flex-initial">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Phân loại mô hình</span>
                  <div className="flex bg-slate-50 border border-slate-200/50 rounded-xl p-1 shrink-0">
                    {([
                      { label: 'Tất cả', value: 'all' },
                      { label: 'Trực thuộc', value: 'direct' },
                      { label: 'Nhượng quyền', value: 'franchise' }
                    ] as const).map((btn) => (
                      <button
                        key={btn.value}
                        onClick={() => setTypeFilter(btn.value)}
                        className={`px-4 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                          typeFilter === btn.value
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Filter */}
                <div className="flex flex-col gap-1 flex-1 sm:flex-initial">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Trạng thái vận hành</span>
                  <div className="flex bg-slate-50 border border-slate-200/50 rounded-xl p-1 shrink-0">
                    {([
                      { label: 'Tất cả', value: 'all' },
                      { label: 'Hoạt động', value: 'active' },
                      { label: 'Tạm khóa', value: 'suspended' }
                    ] as const).map((btn) => (
                      <button
                        key={btn.value}
                        onClick={() => setStatusFilter(btn.value)}
                        className={`px-4 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                          statusFilter === btn.value
                            ? 'bg-primary text-white shadow-sm shadow-pink-100'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Tenant branches list Table */}
            <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden text-left">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Danh sách chi nhánh Spa Hệ thống ({filteredTenants.length})
                </h4>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase hidden sm:inline-block">
                    Hệ thống Multi-Tenant
                  </span>
                  <a 
                    href="/signup"
                    className="flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-pink-650 hover:from-rose-600 hover:to-pink-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-md hover:shadow-rose-100 transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus size={12} />
                    Đăng ký Chi Nhánh mới
                  </a>
                </div>
              </div>

              <div className="overflow-x-auto">
                {filteredTenants.length === 0 ? (
                  <div className="p-12 text-center">
                    <span className="text-3xl mb-3 block">🏢</span>
                    <p className="text-slate-400 font-bold text-sm italic">Không tìm thấy chi nhánh nào phù hợp</p>
                  </div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th scope="col" className="px-8 py-5">Tên chi nhánh Spa</th>
                        <th scope="col" className="px-6 py-5">Phân loại & Gói</th>
                        <th scope="col" className="px-6 py-5">Liên hệ & Địa chỉ</th>
                        <th scope="col" className="px-6 py-5 text-center">Nhân sự</th>
                        <th scope="col" className="px-6 py-5 text-center">Khách hàng</th>
                        <th scope="col" className="px-6 py-5 text-right">Doanh thu chi nhánh</th>
                        <th scope="col" className="px-6 py-5 text-center">Trạng thái</th>
                        <th scope="col" className="px-8 py-5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {filteredTenants.map((t) => {
                        const isHeadquarter = t.name === 'Bella Spa Headquarter';
                        const isFranchise = t.franchise_agreement_date !== null || t.royalty_type !== null;
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                            {/* Spa Name & Logo Initial */}
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs uppercase shrink-0 ${
                                  isHeadquarter 
                                    ? 'bg-indigo-950 text-white' 
                                    : 'bg-rose-50 text-primary border border-rose-100'
                                }`}>
                                  {t.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <h5 className="font-black text-slate-900 truncate max-w-[200px] flex items-center gap-1.5">
                                    {t.name}
                                    {isHeadquarter && (
                                      <span className="bg-indigo-100 text-indigo-700 text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0">HQ</span>
                                    )}
                                  </h5>
                                  <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                                    Ngày tham gia: {t.created_at ? new Date(t.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Classification & Subscription package */}
                            <td className="px-6 py-5">
                              <div className="flex flex-col gap-1 items-start text-xs">
                                {isHeadquarter ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-900 text-white border border-slate-700 select-none">
                                    Trụ sở chính
                                  </span>
                                ) : isFranchise ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100 select-none">
                                    Nhượng quyền
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100 select-none">
                                    Trực thuộc
                                  </span>
                                )}
                                <div className="mt-1 flex flex-col items-start gap-0.5">
                                  {getTierBadge(t.subscription_tier)}
                                  {getExpirationInfo(t.subscription_expires_at, t.subscription_tier)}
                                </div>
                              </div>
                            </td>

                            {/* Contact & Address */}
                            <td className="px-6 py-5">
                              <div className="space-y-1 text-xs">
                                <p className="flex items-center gap-1.5 text-slate-600 truncate max-w-[220px]">
                                  <MapPin size={12} className="text-slate-400 shrink-0" />
                                  <span>{t.address || 'Chưa cập nhật'}</span>
                                </p>
                                <p className="flex items-center gap-1.5 text-slate-500 font-bold">
                                  <Phone size={12} className="text-slate-400 shrink-0" />
                                  <span>{t.contact_phone || 'Chưa cập nhật'}</span>
                                </p>
                              </div>
                            </td>

                            {/* Staff count */}
                            <td className="px-6 py-5 text-center font-black text-slate-800">
                              {t.staffCount}
                            </td>

                            {/* Customer count */}
                            <td className="px-6 py-5 text-center font-black text-slate-800">
                              {t.customerCount}
                            </td>

                            {/* Branch Revenue */}
                            <td className="px-6 py-5 text-right font-black text-emerald-600 text-sm">
                              {formatCurrency(t.revenueSum)}
                            </td>

                            {/* Status Badge */}
                            <td className="px-6 py-5 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                t.status === 'active' 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                  : 'bg-rose-50 text-rose-600 border border-rose-100'
                              }`}>
                                {t.status === 'active' ? 'Hoạt động' : 'Tạm khóa'}
                              </span>
                            </td>

                            {/* Toggle Suspend Action */}
                            <td className="px-8 py-5 text-right">
                              {isHeadquarter ? (
                                <span className="text-[10px] text-slate-400 font-bold italic">Không thể khóa</span>
                              ) : (
                                <button
                                  onClick={() => handleToggleStatus(t.id, t.status === 'suspended' ? 'suspended' : 'active')}
                                  disabled={updatingId === t.id}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 cursor-pointer ${
                                    t.status === 'active'
                                      ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100/50'
                                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100/50'
                                  }`}
                                >
                                  {updatingId === t.id ? (
                                    <RefreshCw size={12} className="animate-spin" />
                                  ) : t.status === 'active' ? (
                                    <>
                                      <Lock size={12} />
                                      Khóa
                                    </>
                                  ) : (
                                    <>
                                      <Unlock size={12} />
                                      Mở khóa
                                    </>
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        ) : activeTab === 'franchise' ? (
          /* FRANCHISE AGREEMENT & ROYALTY LEDGER TAB */
          <div className="space-y-8">
            {/* Franchise Premium Quick Stats Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Projected royalty fee */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                  <DollarSign size={26} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Dự thu Royalty (Cộng dồn)</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">{formatCurrency(totalProjectedFees)}</h3>
                  <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Tổng hóa đơn phát sinh</span>
                </div>
              </div>

              {/* Collected royalty fee */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                  <CheckCircle2 size={26} className="text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Đã thu về HQ</p>
                  <h3 className="text-2xl font-black text-emerald-600 leading-none mb-1">{formatCurrency(totalCollectedFees)}</h3>
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Doanh thu đã đối soát gạch nợ</span>
                </div>
              </div>

              {/* Outstanding royalty fee */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                  <AlertCircle size={26} className="text-amber-500" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Còn nợ chờ thu</p>
                  <h3 className="text-2xl font-black text-amber-600 leading-none mb-1">{formatCurrency(totalOutstandingFees)}</h3>
                  <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Hóa đơn chưa thanh toán</span>
                </div>
              </div>
            </section>

            {/* Franchise Branch configuration ledger */}
            <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden text-left">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Cấu hình chính sách thu phí nhượng quyền ({tenants.filter(t => t.name !== 'Bella Spa Headquarter').length})
                </h4>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase flex items-center gap-1">
                  <Settings size={10} /> Thỏa thuận kinh doanh
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th scope="col" className="px-8 py-5">Chi nhánh</th>
                      <th scope="col" className="px-6 py-5">Phương thức tính phí</th>
                      <th scope="col" className="px-6 py-5 text-right">Phí cố định hàng tháng</th>
                      <th scope="col" className="px-6 py-5 text-center">Tỷ lệ trích % doanh thu</th>
                      <th scope="col" className="px-8 py-5 text-right">Thiết lập</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {tenants
                      .filter(t => t.name !== 'Bella Spa Headquarter')
                      .map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xs uppercase shrink-0">
                                {t.name.charAt(0)}
                              </div>
                              <div>
                                <h5 className="font-black text-slate-900">{t.name}</h5>
                                <span className="text-[9px] text-slate-400 block mt-0.5">ID: {t.id.slice(0, 8)}...</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            {t.royalty_type === 'fixed' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase tracking-wider border border-indigo-100">
                                <CreditCard size={10} /> Cố định hàng tháng
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-primary text-[9px] font-black uppercase tracking-wider border border-rose-100">
                                <Percent size={10} /> Trích % Doanh thu
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-5 text-right font-black text-slate-900">
                            {t.royalty_fixed_amount ? formatCurrency(t.royalty_fixed_amount) : '0đ'}
                          </td>
                          <td className="px-6 py-5 text-center font-black text-primary">
                            {t.royalty_rate ? `${t.royalty_rate}%` : '0%'}
                          </td>
                          <td className="px-8 py-5 text-right">
                            <button
                              onClick={() => handleOpenConfig(t)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm"
                            >
                              <Edit size={12} />
                              Cấu hình
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Royalty Invoices Ledger */}
            <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden text-left">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Sổ cái hóa đơn phí nhượng quyền (Royalty Invoices Ledger)
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Hóa đơn công nợ nhượng quyền được tự động trích xuất khi chi nhánh khóa sổ tháng.</p>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase">
                  HQ Financial Audit
                </span>
              </div>

              {loadingRoyalty ? (
                <div className="p-16 text-center space-y-3">
                  <RefreshCw size={24} className="animate-spin text-primary mx-auto" />
                  <p className="text-xs text-slate-400 font-bold italic">Đang đồng bộ hóa đơn từ máy chủ...</p>
                </div>
              ) : invoices.length === 0 ? (
                <div className="p-16 text-center">
                  <span className="text-4xl mb-3 block">📄</span>
                  <p className="text-slate-400 font-bold text-sm italic">Chưa có hóa đơn phí nhượng quyền nào được phát sinh.</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">Khi quản trị viên chi nhánh thực hiện Khóa sổ tài chính tháng (lockMonth), hóa đơn nhượng quyền tự động sẽ xuất hiện tại đây.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th scope="col" className="px-8 py-5">Mã hóa đơn</th>
                        <th scope="col" className="px-6 py-5">Chi nhánh</th>
                        <th scope="col" className="px-6 py-5 text-center">Tháng đối soát</th>
                        <th scope="col" className="px-6 py-5 text-right">Doanh thu tháng</th>
                        <th scope="col" className="px-6 py-5">Phương thức tính</th>
                        <th scope="col" className="px-6 py-5 text-right">Phải thu HQ</th>
                        <th scope="col" className="px-6 py-5 text-center">Trạng thái</th>
                        <th scope="col" className="px-8 py-5 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {invoices.map((inv) => {
                        const monthDate = new Date(inv.month_year);
                        const formattedMonth = `Tháng ${monthDate.getMonth() + 1}/${monthDate.getFullYear()}`;
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-5 font-black text-slate-900 font-mono tracking-tight">
                              {inv.invoice_number}
                            </td>
                            <td className="px-6 py-5 font-bold text-slate-800">
                              {inv.tenants?.name || 'Chi nhánh'}
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                                <Calendar size={11} className="text-slate-400" />
                                {formattedMonth}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-right font-black text-slate-800">
                              {formatCurrency(inv.gross_revenue)}
                            </td>
                            <td className="px-6 py-5 text-xs">
                              {inv.royalty_type === 'percentage' ? (
                                <span className="text-rose-500 font-black">
                                  Trích % Doanh thu ({inv.royalty_rate}%)
                                </span>
                              ) : (
                                <span className="text-indigo-600 font-black">
                                  Cố định ({formatCurrency(inv.royalty_fixed_amount)})
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-5 text-right font-black text-emerald-600 text-sm">
                              {formatCurrency(inv.calculated_amount)}
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                inv.status === 'paid'
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                  : inv.status === 'cancelled'
                                  ? 'bg-slate-100 text-slate-400'
                                  : 'bg-amber-50 text-amber-600 border border-amber-100'
                              }`}>
                                {inv.status === 'paid' ? 'Đã thu tiền' : inv.status === 'cancelled' ? 'Hủy bỏ' : 'Chờ đối soát'}
                              </span>
                            </td>
                            <td className="px-8 py-5 text-right">
                              {inv.status === 'pending' ? (
                                <button
                                  onClick={() => handleReconcileInvoice(inv.invoice_number)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm shadow-emerald-50"
                                >
                                  <CheckCircle2 size={12} />
                                  Duyệt thu
                                </button>
                              ) : inv.status === 'paid' ? (
                                <div className="text-left text-[9px] leading-tight text-slate-400">
                                  <p className="font-bold">Giao dịch thành công</p>
                                  <p className="font-mono text-[8px]">{inv.payment_method || 'VietQR'}</p>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-bold italic">Bị hủy</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        ) : activeTab === 'clearing' ? (
          /* INTER-BRANCH CLEARING TAB */
          <div className="space-y-8 text-left">
            {/* Quick Stats for Clearing */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Total projected transfer fees */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                  <ArrowLeftRight size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tổng bù trừ liên chi nhánh</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">
                    {formatCurrency(clearingRecords.reduce((acc, r) => acc + Number(r.calculated_amount), 0))}
                  </h3>
                  <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    {clearingRecords.length} Giao dịch công nợ
                  </span>
                </div>
              </div>

              {/* Settled fees */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                  <CheckCircle2 size={26} className="text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Đã gạch nợ bù trừ</p>
                  <h3 className="text-2xl font-black text-emerald-600 leading-none mb-1">
                    {formatCurrency(clearingRecords.filter(r => r.status === 'cleared').reduce((acc, r) => acc + Number(r.calculated_amount), 0))}
                  </h3>
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Đã thanh lý công nợ nội bộ
                  </span>
                </div>
              </div>

              {/* Pending fees */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                  <AlertCircle size={26} className="text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Dư nợ đang chờ</p>
                  <h3 className="text-2xl font-black text-amber-600 leading-none mb-1">
                    {formatCurrency(clearingRecords.filter(r => r.status === 'pending').reduce((acc, r) => acc + Number(r.calculated_amount), 0))}
                  </h3>
                  <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Đang đợi chi nhánh thanh toán
                  </span>
                </div>
              </div>
            </section>

            {/* Clearing configuration ledger */}
            <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Cấu hình Đơn giá Đối soát Liệu trình Nội bộ ({tenants.filter(t => t.name !== 'Bella Spa Headquarter').length})
                </h4>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase flex items-center gap-1">
                  <Settings size={10} /> Đơn giá hoàn lại creditor
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th scope="col" className="px-8 py-5">Chi nhánh</th>
                      <th scope="col" className="px-6 py-5 text-right">Đơn giá đối soát liệu trình liên chi nhánh</th>
                      <th scope="col" className="px-8 py-5 text-right">Thiết lập</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {tenants
                      .filter(t => t.name !== 'Bella Spa Headquarter')
                      .map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xs uppercase shrink-0">
                                {t.name.charAt(0)}
                              </div>
                              <div>
                                <h5 className="font-black text-slate-900">{t.name}</h5>
                                <span className="text-[9px] text-slate-400 block mt-0.5">ID: {t.id.slice(0, 8)}...</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right font-black text-slate-900">
                            {formatCurrency(t.internal_clearing_rate ?? 150000)} / ca điều trị hoàn thành
                          </td>
                          <td className="px-8 py-5 text-right">
                            <button
                              onClick={() => handleOpenClearingRate(t)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm"
                            >
                              <Edit size={12} />
                              Thay đổi đơn giá
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Inter-branch Clearing Records Ledger */}
            <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Sổ cái bù trừ nội bộ liên chi nhánh (Inter-branch Clearing Ledger)
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    Hóa đơn bù trừ tự động được trích xuất khi chi nhánh bán (Debtor) và chi nhánh làm liệu trình (Creditor) phát sinh ca liệu trình liên chi nhánh trong tháng.
                  </p>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase">
                  HQ Clearing Audit
                </span>
              </div>

              {loadingClearing ? (
                <div className="p-16 text-center space-y-3">
                  <RefreshCw size={24} className="animate-spin text-primary mx-auto" />
                  <p className="text-xs text-slate-400 font-bold italic">Đang đồng bộ hóa đơn bù trừ...</p>
                </div>
              ) : clearingRecords.length === 0 ? (
                <div className="p-16 text-center">
                  <span className="text-4xl mb-3 block">🔄</span>
                  <p className="text-slate-400 font-bold text-sm italic">Chưa có công nợ liên chi nhánh nào phát sinh.</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Khi khách hàng mua liệu trình tại Spa A nhưng thực hiện ca liệu trình thành công tại Spa B, hệ thống sẽ tự động tổng hợp bù trừ khi chi nhánh thực hiện khóa sổ tháng.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th scope="col" className="px-8 py-5">Mã bù trừ</th>
                        <th scope="col" className="px-6 py-5">Bên mua nợ (Debtor)</th>
                        <th scope="col" className="px-6 py-5">Bên làm thu (Creditor)</th>
                        <th scope="col" className="px-6 py-5 text-center">Tháng đối soát</th>
                        <th scope="col" className="px-6 py-5 text-center">Số ca liên chi nhánh</th>
                        <th scope="col" className="px-6 py-5 text-right">Đơn giá áp dụng</th>
                        <th scope="col" className="px-6 py-5 text-right">Số tiền bù trừ</th>
                        <th scope="col" className="px-6 py-5 text-center">Trạng thái</th>
                        <th scope="col" className="px-8 py-5 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {clearingRecords.map((rec) => {
                        const monthDate = new Date(rec.month_year);
                        const formattedMonth = `Tháng ${monthDate.getMonth() + 1}/${monthDate.getFullYear()}`;
                        return (
                          <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-5 font-black text-slate-900 font-mono tracking-tight text-xs animate-fade-in">
                              {rec.clearing_number}
                            </td>
                            <td className="px-6 py-5 font-bold text-slate-800">
                              {rec.debtor?.name || 'Chi nhánh A'}
                            </td>
                            <td className="px-6 py-5 font-bold text-slate-800">
                              {rec.creditor?.name || 'Chi nhánh B'}
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                                <Calendar size={11} className="text-slate-400" />
                                {formattedMonth}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-center font-black text-slate-800">
                              {rec.session_count} ca
                            </td>
                            <td className="px-6 py-5 text-right text-slate-600">
                              {formatCurrency(rec.clearing_rate)}
                            </td>
                            <td className="px-6 py-5 text-right font-black text-emerald-600 text-sm">
                              {formatCurrency(rec.calculated_amount)}
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                rec.status === 'cleared'
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                  : 'bg-amber-50 text-amber-600 border border-amber-100'
                              }`}>
                                {rec.status === 'cleared' ? 'Đã bù trừ' : 'Chờ xử lý'}
                              </span>
                            </td>
                            <td className="px-8 py-5 text-right">
                              {rec.status === 'pending' ? (
                                <button
                                  onClick={() => handleClearRecord(rec.id, rec.clearing_number)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm shadow-emerald-50"
                                >
                                  <CheckCircle2 size={12} />
                                  HQ Gạch nợ
                                </button>
                              ) : (
                                <div className="text-left text-[9px] leading-tight text-slate-400">
                                  <p className="font-bold">Đã gạch nợ thành công</p>
                                  <p className="font-mono text-[8px]">{rec.payment_method || 'HQ Manual'}</p>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        ) : activeTab === 'transfers' ? (
          /* CUNG ỨNG & CHUYỂN KHO (TRANSFERS) TAB */
          <div className="space-y-8 text-left">
            {/* Quick Stats for Transfers */}
            <section className="grid grid-cols-1 sm:grid-cols-4 gap-6">
              {/* Total transfer requests */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                  <ArrowLeftRight size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tổng lệnh chuyển kho</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">
                    {transferOrders.length} Lệnh
                  </h3>
                  <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Toàn hệ thống
                  </span>
                </div>
              </div>

              {/* Pending requests */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-primary shrink-0">
                  <AlertCircle size={26} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Yêu cầu chờ duyệt</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">
                    {transferOrders.filter(o => o.status === 'pending').length} Yêu cầu
                  </h3>
                  <span className="text-[9px] bg-rose-50 text-primary px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Cần HQ xử lý
                  </span>
                </div>
              </div>

              {/* Shipped / Transit requests */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
                  <Truck size={26} className="text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Đang vận chuyển</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">
                    {transferOrders.filter(o => o.status === 'shipped').length} Đơn
                  </h3>
                  <span className="text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Chờ chi nhánh nhận
                  </span>
                </div>
              </div>

              {/* Completed requests */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                  <CheckCircle2 size={26} className="text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Đã hoàn tất</p>
                  <h3 className="text-2xl font-black text-emerald-600 leading-none mb-1">
                    {transferOrders.filter(o => o.status === 'completed').length} Đơn
                  </h3>
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Cập nhật kho thành công
                  </span>
                </div>
              </div>
            </section>

            {/* Filters and Search for Transfers */}
            <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex gap-4 w-full md:max-w-xl">
                {/* Status Filter */}
                <div className="flex-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Trạng thái đơn</label>
                  <select
                    value={transferFilterStatus}
                    onChange={(e) => setTransferFilterStatus(e.target.value as any)}
                    className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="pending">Chờ duyệt cấp hàng</option>
                    <option value="shipped">Đang vận chuyển</option>
                    <option value="completed">Đã nhận hàng (Hoàn tất)</option>
                    <option value="cancelled">Đã từ chối / Hủy đơn</option>
                  </select>
                </div>

                {/* Branch Filter */}
                <div className="flex-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Chi nhánh yêu cầu</label>
                  <select
                    value={transferFilterBranch}
                    onChange={(e) => setTransferFilterBranch(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
                  >
                    <option value="all">Tất cả chi nhánh</option>
                    {tenants
                      .filter(t => t.name !== 'Bella Spa Headquarter')
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full font-black uppercase tracking-wider">
                Tổng bộ điều phối kho vận
              </span>
            </section>

            {/* Inventory Transfer Orders Ledger Table */}
            <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Sổ cái lệnh chuyển kho cung ứng nội bộ
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    Các chi nhánh không được tùy ý điều chỉnh tồn kho vật tư mà phải thông qua lệnh yêu cầu cấp kho dưới đây.
                  </p>
                </div>
                <span className="text-[10px] bg-rose-50 text-primary px-3 py-1 rounded-full font-black uppercase border border-rose-100">
                  HQ Logistics Portal
                </span>
              </div>

              {loadingTransfers ? (
                <div className="p-16 text-center space-y-3">
                  <RefreshCw size={24} className="animate-spin text-primary mx-auto" />
                  <p className="text-xs text-slate-400 font-bold italic">Đang tải danh sách lệnh chuyển kho...</p>
                </div>
              ) : transferOrders.length === 0 ? (
                <div className="p-16 text-center">
                  <span className="text-4xl mb-3 block">📦</span>
                  <p className="text-slate-400 font-bold text-sm italic">Chưa có lệnh chuyển kho nào được tạo.</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Các chi nhánh có thể gửi yêu cầu xin cấp vật tư từ Tổng bộ trực tiếp từ trang quản lý kho của họ.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-sm text-left">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th scope="col" className="px-8 py-5">Mã lệnh</th>
                        <th scope="col" className="px-6 py-5">Chi nhánh yêu cầu</th>
                        <th scope="col" className="px-6 py-5">Danh sách vật tư y/c</th>
                        <th scope="col" className="px-6 py-5">Ghi chú chi nhánh</th>
                        <th scope="col" className="px-6 py-5">Thông tin vận chuyển</th>
                        <th scope="col" className="px-6 py-5 text-center">Trạng thái</th>
                        <th scope="col" className="px-8 py-5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {transferOrders
                        .filter(rec => {
                          const matchStatus = transferFilterStatus === 'all' || rec.status === transferFilterStatus;
                          const matchBranch = transferFilterBranch === 'all' || rec.requester_tenant_id === transferFilterBranch;
                          return matchStatus && matchBranch;
                        })
                        .map((rec) => {
                          const orderItems = (rec.items || []) as TransferOrderItem[];
                          return (
                            <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                              {/* Order Number & Time */}
                              <td className="px-8 py-5">
                                <div className="font-black text-slate-900 font-mono text-xs">
                                  {rec.order_number}
                                </div>
                                <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                                  {rec.created_at ? new Date(rec.created_at).toLocaleString('vi-VN') : 'N/A'}
                                </span>
                              </td>

                              {/* Branch Name */}
                              <td className="px-6 py-5 font-black text-slate-800">
                                {rec.requester?.name || 'Chi nhánh'}
                              </td>

                              {/* Items Requested */}
                              <td className="px-6 py-5">
                                <div className="space-y-1.5 max-w-md">
                                  {orderItems.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center gap-4 bg-slate-50/80 border border-slate-100 rounded-xl px-3 py-1.5 text-xs">
                                      <div className="min-w-0">
                                        <p className="font-black text-slate-800 truncate max-w-[180px]">{item.name}</p>
                                        <p className="font-mono text-[9px] text-slate-400 font-bold uppercase">{item.sku}</p>
                                      </div>
                                      <span className="font-black text-primary bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg shrink-0">
                                        SL: {item.qty} {item.unit || 'cái'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>

                              {/* Notes */}
                              <td className="px-6 py-5 text-xs text-slate-600 max-w-[200px] truncate" title={rec.notes || ''}>
                                {rec.notes || <span className="text-slate-400 font-bold italic">Không có ghi chú</span>}
                              </td>

                              {/* Shipping Details */}
                              <td className="px-6 py-5 text-xs">
                                {rec.status === 'shipped' || rec.status === 'completed' ? (
                                  <div className="space-y-1 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-2.5 max-w-[240px]">
                                    <p className="font-black text-slate-800 flex items-center gap-1.5">
                                      <Truck size={12} className="text-indigo-500" />
                                      {rec.shipping_carrier}
                                    </p>
                                    <p className="font-mono text-[9px] text-slate-500 font-black flex items-center gap-1.5 uppercase">
                                      <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-md font-bold shrink-0">TRACKING</span>
                                      {rec.tracking_number}
                                    </p>
                                    {rec.shipped_at && (
                                      <p className="text-[9px] text-slate-400 font-bold">
                                        Xuất kho: {new Date(rec.shipped_at).toLocaleString('vi-VN')}
                                      </p>
                                    )}
                                  </div>
                                ) : rec.status === 'cancelled' ? (
                                  <div className="bg-slate-100 rounded-2xl p-2.5 max-w-[240px] text-slate-500 leading-tight">
                                    <p className="font-black text-[10px] text-slate-700 flex items-center gap-1">
                                      <Ban size={10} className="text-slate-400" /> Lý do hủy:
                                    </p>
                                    <p className="text-[10px] font-bold italic mt-0.5">{rec.rejection_reason || 'Không nêu lý do'}</p>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-bold italic">Chưa giao hàng</span>
                                )}
                              </td>

                              {/* Status Badge */}
                              <td className="px-6 py-5 text-center">
                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  rec.status === 'completed'
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                    : rec.status === 'shipped'
                                    ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                    : rec.status === 'cancelled'
                                    ? 'bg-slate-100 text-slate-400'
                                    : 'bg-amber-50 text-amber-600 border border-amber-100'
                                }`}>
                                  {rec.status === 'completed' 
                                    ? 'Hoàn tất' 
                                    : rec.status === 'shipped' 
                                    ? 'Đang vận chuyển' 
                                    : rec.status === 'cancelled' 
                                    ? 'Từ chối' 
                                    : 'Chờ duyệt'}
                                </span>
                              </td>

                              {/* Action buttons */}
                              <td className="px-8 py-5 text-right">
                                {rec.status === 'pending' ? (
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => handleOpenCancelModal(rec)}
                                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-500 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer border border-rose-100/50"
                                    >
                                      Từ chối
                                    </button>
                                    <button
                                      onClick={() => handleOpenShipModal(rec)}
                                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm"
                                    >
                                      Giao hàng (Ship)
                                    </button>
                                  </div>
                                ) : rec.status === 'shipped' ? (
                                  <span className="text-[10px] text-slate-400 font-bold italic">Đang đợi chi nhánh nhận hàng...</span>
                                ) : rec.status === 'completed' ? (
                                  <div className="text-right text-[9px] leading-tight text-slate-400">
                                    <p className="font-bold">Đã nhận hàng</p>
                                    {rec.completed_at && (
                                      <p className="font-mono text-[8px]">{new Date(rec.completed_at).toLocaleDateString('vi-VN')}</p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-bold italic">Đã hủy bỏ</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        ) : activeTab === 'audit' ? (
          /* NHẬT KÝ KIỂM TOÁN (AUDIT) TAB */
          <div className="space-y-8 text-left">
            {/* Security KPIs Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-4 gap-6">
              {/* Total activities in page */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                  <Activity size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tổng số tác vụ</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">
                    {auditLogs.length === 15 ? '15+' : auditLogs.length} Ghi nhận
                  </h3>
                  <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Đợt tải hiện tại
                  </span>
                </div>
              </div>

              {/* Active users */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-primary shrink-0">
                  <Users size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Quản trị viên thao tác</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">
                    {new Set(auditLogs.map(l => l.user_name)).size} Tài khoản
                  </h3>
                  <span className="text-[9px] bg-rose-50 text-primary px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Hoạt động gần đây
                  </span>
                </div>
              </div>

              {/* Touched branches */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
                  <Store size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Chi nhánh phát sinh log</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mb-1">
                    {new Set(auditLogs.map(l => l.tenant_name)).size} Chi nhánh
                  </h3>
                  <span className="text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Toàn hệ thống
                  </span>
                </div>
              </div>

              {/* System Table Count */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                  <ShieldCheck size={26} className="text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Danh mục giám sát</p>
                  <h3 className="text-2xl font-black text-emerald-600 leading-none mb-1">
                    {auditTables.length} Bảng dữ liệu
                  </h3>
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Cơ sở dữ liệu an toàn
                  </span>
                </div>
              </div>
            </section>

            {/* Filter and Search Panel - Glassmorphic design */}
            <section className="bg-white/80 border border-slate-200/60 backdrop-blur-md rounded-[2.5rem] shadow-sm p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white shrink-0">
                  <Search size={14} />
                </div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Bộ lọc nhật ký nâng cao</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                {/* Branch filter */}
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Chi nhánh</label>
                  <select
                    value={selectedTenant}
                    onChange={(e) => setSelectedTenant(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
                  >
                    <option value="all">Tất cả chi nhánh</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {/* User filter */}
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Người thực hiện</label>
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
                  >
                    <option value="all">Tất cả người dùng</option>
                    {auditUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                {/* Action filter */}
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Loại tác vụ</label>
                  <select
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
                  >
                    <option value="">Tất cả tác vụ</option>
                    <option value="INSERT">Thêm mới (INSERT)</option>
                    <option value="UPDATE">Cập nhật (UPDATE)</option>
                    <option value="DELETE">Xóa bỏ (DELETE)</option>
                  </select>
                </div>

                {/* Table filter */}
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Bảng dữ liệu</label>
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
                  >
                    <option value="all">Tất cả bảng</option>
                    {auditTables.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Từ ngày</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="block w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Đến ngày</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="block w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-bold text-slate-700"
                  />
                </div>
              </div>
            </section>

            {/* Audit Logs Table Ledger - Metallic design */}
            <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Nhật ký kiểm toán thời gian thực (Super Admin Security Audit Log)
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    Ghi lại mọi hoạt động nghiệp vụ nhạy cảm, chỉnh sửa hợp đồng, điều phối vật tư của toàn chuỗi spa Bella.
                  </p>
                </div>
                <span className="text-[10px] bg-indigo-50 text-indigo-650 px-3 py-1 rounded-full font-black uppercase border border-indigo-100">
                  SYSTEM SECURITY AUDIT
                </span>
              </div>

              {loadingAudit ? (
                <div className="p-16 text-center space-y-3">
                  <RefreshCw size={24} className="animate-spin text-primary mx-auto" />
                  <p className="text-xs text-slate-400 font-bold italic">Đang trích xuất dữ liệu nhật ký kiểm toán...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="p-16 text-center">
                  <span className="text-4xl mb-3 block">🔒</span>
                  <p className="text-slate-400 font-bold text-sm italic">Chưa có nhật ký hoạt động nào phù hợp bộ lọc.</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Hệ thống tự động ghi nhận mọi lệnh thao tác dữ liệu nhạy cảm. Thử xóa bớt bộ lọc để hiển thị nhiều dữ liệu hơn.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th scope="col" className="px-8 py-5">Thời gian</th>
                        <th scope="col" className="px-6 py-5">Chi nhánh</th>
                        <th scope="col" className="px-6 py-5">Người thực hiện</th>
                        <th scope="col" className="px-6 py-5 text-center">Tác vụ</th>
                        <th scope="col" className="px-6 py-5">Bảng dữ liệu</th>
                        <th scope="col" className="px-6 py-5">Mã dòng (Record ID)</th>
                        <th scope="col" className="px-8 py-5 text-right">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          {/* Time */}
                          <td className="px-8 py-5 text-slate-500 font-mono text-[11px]">
                            {new Date(log.created_at).toLocaleString('vi-VN')}
                          </td>

                          {/* Tenant */}
                          <td className="px-6 py-5 font-black text-slate-900">
                            {log.tenant_name || 'Tổng bộ HQ'}
                          </td>

                          {/* Changed By User */}
                          <td className="px-6 py-5 font-black text-slate-700">
                            {log.user_name}
                          </td>

                          {/* Action Badge */}
                          <td className="px-6 py-5 text-center">
                            {log.action === 'INSERT' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                                Thêm (INSERT)
                              </span>
                            ) : log.action === 'UPDATE' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100">
                                Sửa (UPDATE)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100">
                                Xóa (DELETE)
                              </span>
                            )}
                          </td>

                          {/* Table Name */}
                          <td className="px-6 py-5 font-mono text-xs text-indigo-600 font-black">
                            {log.table_name}
                          </td>

                          {/* Record ID */}
                          <td className="px-6 py-5 font-mono text-[10px] text-slate-400 select-all" title={log.record_id}>
                            {log.record_id.slice(0, 8)}...
                          </td>

                          {/* Action detail button */}
                          <td className="px-8 py-5 text-right">
                            <button
                              onClick={() => {
                                setSelectedAuditLog(log);
                                setShowAuditDetailModal(true);
                                setShowRawJson(false);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm"
                            >
                              <ShieldCheck size={12} />
                              Đối soát thay đổi
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination controls */}
              <div className="px-8 py-5 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                <span className="text-xs text-slate-500 font-bold">
                  Trang {currentPage} | Hiển thị tối đa 15 bản ghi
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || loadingAudit}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all active:scale-95 cursor-pointer"
                  >
                    Trang trước
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={auditLogs.length < 15 || loadingAudit}
                    className="px-4 py-2 bg-slate-900 border border-slate-900 rounded-xl text-xs font-black uppercase tracking-wider text-white hover:bg-slate-800 disabled:opacity-40 transition-all active:scale-95 cursor-pointer"
                  >
                    Trang sau
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : (
          /* LIỆU TRÌNH CHUẨN (SERVICES) TAB PANEL */
          <div className="space-y-8 text-left">
            {/* KPIs Bar */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex gap-4 items-center">
                <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-primary shrink-0">
                  <Package size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tổng số gói mẫu</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none">{templates.length} Gói mẫu</h3>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex gap-4 items-center">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                  <Send size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Chi nhánh áp dụng</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none">
                    {new Set(distributedList.map(d => d.tenant_id)).size} Chi nhánh
                  </h3>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex gap-4 items-center">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                  <Activity size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Bản ghi phân phối</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none">{distributedList.length} Bản ghi</h3>
                </div>
              </div>
            </section>

            {/* Double Panel Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: HQ Templates List (5 cols) */}
              <div className="lg:col-span-5 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-slate-50 pb-4">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Liệu trình thương hiệu</h4>
                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">Danh mục mẫu chuẩn Bella HQ</p>
                  </div>
                  <button
                    onClick={() => handleOpenTemplateModal(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Plus size={12} />
                    Thêm mới
                  </button>
                </div>

                {loadingServices ? (
                  <div className="py-12 text-center">
                    <RefreshCw size={20} className="animate-spin text-primary mx-auto" />
                  </div>
                ) : templates.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-8">Chưa có liệu trình chuẩn nào.</p>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                    {templates.map(t => (
                      <div key={t.id} className="bg-slate-50/50 border border-slate-100 rounded-3xl p-4 space-y-3 hover:bg-slate-50 transition-colors text-left">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <h5 className="font-black text-slate-900 text-xs truncate" title={t.name}>{t.name}</h5>
                            <p className="text-[10px] text-slate-400 font-bold block mt-0.5">{t.duration} &bull; {t.total_sessions} buổi</p>
                          </div>
                          <span className="text-[11px] font-black text-primary shrink-0">{formatCurrency(t.price)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-white rounded-2xl border border-slate-100/50 p-2.5 text-[9px] font-bold text-slate-500">
                          <div>
                            <p className="text-slate-400">Giá sàn / trần</p>
                            <p className="font-black text-slate-800">{formatCurrency(t.price_floor ?? t.price)} - {formatCurrency(t.price_cap ?? t.price)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">KTV hoa hồng</p>
                            <p className="font-black text-slate-800">{formatCurrency(t.ktv_commission ?? 0)} / buổi</p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[9px] font-bold bg-white rounded-xl border border-slate-100/50 px-2.5 py-1">
                          <span className="text-slate-400">Cho phép tự sửa giá</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                            t.allowed_franchise_override 
                              ? 'bg-emerald-50 text-emerald-600' 
                              : 'bg-rose-50 text-rose-600'
                          }`}>
                            {t.allowed_franchise_override ? 'BẬT (BIÊN ĐỘ)' : 'KHÓA CỐ ĐỊNH'}
                          </span>
                        </div>

                        {t.offer && (
                          <div className="bg-rose-50/40 border border-rose-100/30 rounded-xl px-2.5 py-1.5 text-[9px] font-bold text-primary flex items-start gap-1">
                            <Sparkles size={10} className="shrink-0 mt-0.5 text-primary" />
                            <span>Ưu đãi: {t.offer}</span>
                          </div>
                        )}

                        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100/50">
                          <button
                            onClick={() => handleOpenDistributionModal(t)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase tracking-wider transition-all"
                          >
                            Phân phối
                          </button>
                          <button
                            onClick={() => handleOpenTemplateModal(t)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] font-black uppercase tracking-wider transition-all"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(t.id, t.name)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-[9px] font-black uppercase tracking-wider transition-all"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Distribution Matrix Grid (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
                <div className="border-b border-slate-50 pb-4">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                    Ma trận phân phối & Giá bán chi nhánh đại lý
                  </h4>
                  <p className="text-[9px] text-slate-400 font-bold mt-0.5">Giám sát giá bán thực tế và biên độ tự quyết tại chi nhánh nhượng quyền</p>
                </div>

                {loadingServices ? (
                  <div className="py-12 text-center">
                    <RefreshCw size={20} className="animate-spin text-primary mx-auto" />
                  </div>
                ) : distributedList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-8">Chưa có liệu trình nào được phân phối xuống chi nhánh.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-xs text-left">
                      <thead className="text-[9px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3">Chi nhánh</th>
                          <th className="px-4 py-3">Liệu trình</th>
                          <th className="px-4 py-3 text-right">Giá áp dụng</th>
                          <th className="px-4 py-3 text-center">Biên độ kiểm soát</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {distributedList.map(item => {
                          const template = templates.find(t => t.id === item.template_id);
                          const floor = template?.price_floor ?? item.price;
                          const cap = template?.price_cap ?? item.price;
                          const localPrice = item.price;
                          
                          // Calculate graphical slider percentage
                          const sliderRange = cap - floor;
                          const sliderPercentage = sliderRange > 0 
                            ? Math.min(Math.max(((localPrice - floor) / sliderRange) * 100, 0), 100)
                            : 50;

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                              <td className="px-4 py-3 font-black text-slate-900">{item.tenant_name}</td>
                              <td className="px-4 py-3">
                                <p className="font-bold text-slate-800 text-[11px]">{item.name}</p>
                                <span className="text-[8px] bg-slate-100 text-slate-400 font-bold px-1.5 py-0.2 rounded uppercase">
                                  ID: {item.id.slice(0, 5)}...
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-black text-emerald-600 text-[11px]">{formatCurrency(localPrice)}</td>
                              <td className="px-4 py-3">
                                {/* Interactive Visual Price Boundary Slider */}
                                <div className="space-y-1 max-w-[200px] mx-auto text-left">
                                  <div className="flex justify-between text-[8px] font-mono text-slate-400">
                                    <span>Sàn: {floor / 1000}k</span>
                                    <span>Trần: {cap / 1000}k</span>
                                  </div>
                                  <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                    <div 
                                      className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-indigo-500 to-primary rounded-full transition-all"
                                      style={{ width: `${sliderPercentage}%` }}
                                    />
                                    {/* Center tick indicator for standard price */}
                                    {template && template.price > floor && template.price < cap && (
                                      <div 
                                        className="absolute top-0 bottom-0 w-0.5 bg-slate-350"
                                        style={{ left: `${((template.price - floor) / sliderRange) * 100}%` }}
                                        title="Giá chuẩn HQ"
                                      />
                                    )}
                                  </div>
                                  <p className="text-[8px] text-center font-bold text-slate-400 italic">
                                    {localPrice === template?.price ? 'Chuẩn giá thương hiệu' : localPrice > (template?.price ?? 0) ? 'Đắt hơn tiêu chuẩn' : 'Rẻ hơn tiêu chuẩn'}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Configuration Modal */}
      <AnimatePresence>
        {editingTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden text-left"
            >
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-8 py-6 text-white flex justify-between items-center">
                <div>
                  <span className="text-[9px] bg-primary/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-primary/20">THỎA THUẬN ROYALTY</span>
                  <h3 className="text-lg font-black uppercase tracking-tight mt-1 truncate max-w-[320px]">{editingTenant.name}</h3>
                </div>
                <button 
                  onClick={() => setEditingTenant(null)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
                >
                  <X size={16} />
                </button>
              </div>
              
              <form onSubmit={handleSaveConfig} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loại phí nhượng quyền</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setRoyaltyType('percentage')}
                      className={`py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        royaltyType === 'percentage'
                          ? 'bg-primary/5 text-primary border-primary shadow-sm shadow-pink-100'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Percent size={14} />
                      % Doanh thu
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoyaltyType('fixed')}
                      className={`py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        royaltyType === 'fixed'
                          ? 'bg-primary/5 text-primary border-primary shadow-sm shadow-pink-100'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <CreditCard size={14} />
                      Phí cố định
                    </button>
                  </div>
                </div>

                {royaltyType === 'percentage' ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tỷ lệ phí nhượng quyền (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={royaltyRate}
                        onChange={(e) => setRoyaltyRate(e.target.value)}
                        className="block w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-black text-lg transition-all"
                        placeholder="Ví dụ: 3.5"
                        required
                      />
                      <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none font-black text-slate-400">%</div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold italic mt-1">* Tự động trích theo phần trăm tổng doanh thu thực thu hàng tháng khi khóa sổ.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mức phí cố định tháng (VND)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={royaltyFixedAmount}
                        onChange={(e) => setRoyaltyFixedAmount(e.target.value)}
                        className="block w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-black text-lg transition-all"
                        placeholder="Ví dụ: 5000000"
                        required
                      />
                      <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none font-black text-slate-400">đ</div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold italic mt-1">* Áp dụng mức phí cố định cố định hàng tháng không đổi bất kể doanh thu của chi nhánh.</p>
                  </div>
                )}

                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingTenant(null)}
                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submittingConfig}
                    className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submittingConfig ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : 'Lưu cấu hình'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {editingClearingRateTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden text-left"
            >
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-8 py-6 text-white flex justify-between items-center">
                <div>
                  <span className="text-[9px] bg-primary/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-primary/20">CẤU HÌNH ĐỐI SOÁT LIỆU TRÌNH</span>
                  <h3 className="text-lg font-black uppercase tracking-tight mt-1 truncate max-w-[320px]">{editingClearingRateTenant.name}</h3>
                </div>
                <button 
                  onClick={() => setEditingClearingRateTenant(null)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
                >
                  <X size={16} />
                </button>
              </div>
              
              <form onSubmit={handleSaveClearingRate} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đơn giá bù trừ nội bộ (VND / ca điều trị)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={newClearingRate}
                      onChange={(e) => setNewClearingRate(e.target.value)}
                      className="block w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-black text-lg transition-all"
                      placeholder="Ví dụ: 150000"
                      required
                    />
                    <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none font-black text-slate-400">đ</div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold italic mt-1">* Đây là số tiền chi nhánh bán gói (debtor) phải bù đắp cho chi nhánh này (creditor) trên mỗi ca phục vụ khách liên chi nhánh hoàn thành.</p>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingClearingRateTenant(null)}
                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submittingClearingRate}
                    className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submittingClearingRate ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : 'Lưu cấu hình'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showShipModal && selectedTransfer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden text-left"
            >
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-8 py-6 text-white flex justify-between items-center">
                <div>
                  <span className="text-[9px] bg-primary/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-primary/20">QUY TRÌNH XUẤT KHO CUNG ỨNG</span>
                  <h3 className="text-lg font-black uppercase tracking-tight mt-1 truncate max-w-[320px]">Đơn {selectedTransfer.order_number}</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowShipModal(false);
                    setSelectedTransfer(null);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
                >
                  <X size={16} />
                </button>
              </div>
              
              <form onSubmit={handleApproveAndShip} className="p-8 space-y-6">
                <div className="bg-rose-50/50 border border-rose-100/50 rounded-3xl p-4 space-y-3">
                  <h5 className="text-[10px] font-black text-primary uppercase tracking-widest">Danh sách xuất cấp từ kho Tổng bộ:</h5>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {((selectedTransfer.items || []) as TransferOrderItem[]).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center gap-2 bg-white rounded-xl border border-slate-100 px-3 py-2 text-xs">
                        <div>
                          <p className="font-black text-slate-800">{item.name}</p>
                          <p className="font-mono text-[9px] text-slate-400 font-bold uppercase">{item.sku}</p>
                        </div>
                        <span className="font-black text-primary bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">
                          SL: {item.qty} {item.unit || 'cái'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đơn vị vận chuyển</label>
                    <input
                      type="text"
                      value={shippingCarrier}
                      onChange={(e) => setShippingCarrier(e.target.value)}
                      className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-xs transition-all"
                      placeholder="Ví dụ: Giao Hàng Nhanh, Viettel Post..."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mã vận đơn (Tracking Number)</label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-mono text-xs font-black transition-all"
                      placeholder="Nhập mã vận đơn bưu cục"
                      required
                    />
                    <p className="text-[9px] text-slate-400 font-bold italic mt-1">* Khi duyệt giao hàng, hệ thống sẽ tự động trừ số lượng tồn kho tương ứng tại Tổng bộ.</p>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowShipModal(false);
                      setSelectedTransfer(null);
                    }}
                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTransferAction}
                    className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    {submittingTransferAction ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <>
                        <Truck size={14} />
                        Duyệt & Giao hàng
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showCancelModal && selectedTransfer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden text-left"
            >
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-8 py-6 text-white flex justify-between items-center">
                <div>
                  <span className="text-[9px] bg-rose-500/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-rose-500/20">TỪ CHỐI CẤP VẬT TƯ</span>
                  <h3 className="text-lg font-black uppercase tracking-tight mt-1 truncate max-w-[320px]">Đơn {selectedTransfer.order_number}</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowCancelModal(false);
                    setSelectedTransfer(null);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
                >
                  <X size={16} />
                </button>
              </div>
              
              <form onSubmit={handleCancelOrder} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lý do từ chối cung ứng</label>
                  <textarea
                    rows={4}
                    value={refusingReason}
                    onChange={(e) => setRefusingReason(e.target.value)}
                    className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-xs transition-all resize-none"
                    placeholder="Nhập lý do từ chối cấp hàng cho chi nhánh (ví dụ: Tồn kho Tổng bộ đang cạn, sản phẩm tạm ngừng sản xuất...)"
                    required
                  />
                  <p className="text-[9px] text-slate-400 font-bold italic mt-1">* Lý do từ chối sẽ hiển thị trực tiếp cho quản trị viên chi nhánh được biết.</p>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCancelModal(false);
                      setSelectedTransfer(null);
                    }}
                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                  >
                    Quay lại
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTransferAction}
                    className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-100"
                  >
                    {submittingTransferAction ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : 'Xác nhận từ chối'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showAuditDetailModal && selectedAuditLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-4xl overflow-hidden text-left"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-8 py-6 text-white flex justify-between items-center">
                <div>
                  <span className="text-[9px] bg-primary/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-primary/20">
                    ĐỐI SOÁT THAO TÁC HỆ THỐNG
                  </span>
                  <h3 className="text-lg font-black uppercase tracking-tight mt-1 truncate max-w-[500px]" style={{ color: '#ffffff' }}>
                    {selectedAuditLog.tenant_name} &bull; {selectedAuditLog.table_name}
                  </h3>
                </div>
                <button 
                  onClick={() => {
                    setShowAuditDetailModal(false);
                    setSelectedAuditLog(null);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="p-8 space-y-6">
                {/* Meta details */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 border border-slate-100 rounded-3xl p-4 text-xs font-bold text-slate-700">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Người thực hiện</p>
                    <p className="text-slate-900 text-sm font-black">{selectedAuditLog.user_name}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Thời gian thực hiện</p>
                    <p className="text-slate-900 font-mono">{new Date(selectedAuditLog.created_at).toLocaleString('vi-VN')}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Loại tác vụ</p>
                    {selectedAuditLog.action === 'INSERT' ? (
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">Thêm mới</span>
                    ) : selectedAuditLog.action === 'UPDATE' ? (
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-700">Cập nhật</span>
                    ) : (
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700">Xóa bỏ</span>
                    )}
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Record ID</p>
                    <p className="text-slate-500 font-mono break-all select-all" title={selectedAuditLog.record_id}>
                      {selectedAuditLog.record_id}
                    </p>
                  </div>
                </div>

                {/* Tab selector */}
                <div className="flex border-b border-slate-100 pb-px">
                  <button
                    type="button"
                    onClick={() => setShowRawJson(false)}
                    className={`pb-3 px-4 font-black text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                      !showRawJson
                        ? 'border-primary text-primary font-black'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Đối soát trực quan
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRawJson(true)}
                    className={`pb-3 px-4 font-black text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                      showRawJson
                        ? 'border-primary text-primary font-black'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Dữ liệu nguồn (JSON)
                  </button>
                </div>

                {/* Dynamic Content */}
                <div className="max-h-[400px] overflow-y-auto pr-1">
                  {!showRawJson ? (
                    /* Interactive structural Diff */
                    <div className="space-y-4">
                      {getDiffs(selectedAuditLog.old_data, selectedAuditLog.new_data).length === 0 ? (
                        <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <p className="text-slate-400 font-bold text-sm italic">
                            Không phát hiện trường thay đổi, hoặc thao tác không ảnh hưởng đến nội dung bảng.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {getDiffs(selectedAuditLog.old_data, selectedAuditLog.new_data).map((diff) => (
                            <div 
                              key={diff.key}
                              className="bg-slate-50 border border-slate-100 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-7 gap-4 items-center text-xs"
                            >
                              {/* Field Key */}
                              <div className="md:col-span-2 min-w-0">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Trường dữ liệu</p>
                                <p className="font-mono font-black text-slate-800 break-all select-all">{diff.key}</p>
                              </div>

                              {/* Old Value */}
                              <div className="md:col-span-2 min-w-0 bg-white rounded-xl border border-slate-100 p-2.5 min-h-[50px] flex flex-col justify-center">
                                <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">Dữ liệu cũ (-)</p>
                                {diff.oldVal !== undefined ? (
                                  <pre className="text-[10px] text-rose-650 bg-rose-50/50 p-1.5 rounded-lg font-mono break-all whitespace-pre-wrap select-all">
                                    {typeof diff.oldVal === 'object' ? JSON.stringify(diff.oldVal) : String(diff.oldVal)}
                                  </pre>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-bold italic">N/A</span>
                                )}
                              </div>

                              {/* Action Arrow */}
                              <div className="flex justify-center text-slate-350 font-black text-lg">
                                &rarr;
                              </div>

                              {/* New Value */}
                              <div className="md:col-span-2 min-w-0 bg-white rounded-xl border border-slate-100 p-2.5 min-h-[50px] flex flex-col justify-center">
                                <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">Dữ liệu mới (+)</p>
                                {diff.newVal !== undefined ? (
                                  <pre className="text-[10px] text-emerald-650 bg-emerald-50/50 p-1.5 rounded-lg font-mono break-all whitespace-pre-wrap select-all">
                                    {typeof diff.newVal === 'object' ? JSON.stringify(diff.newVal) : String(diff.newVal)}
                                  </pre>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-bold italic">N/A</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Raw Source Logs */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Old raw JSON */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Toàn bộ dữ liệu cũ (Old Object)
                        </label>
                        <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl overflow-auto text-xs font-mono max-h-[300px] border border-slate-800 select-all">
                          {selectedAuditLog.old_data 
                            ? JSON.stringify(selectedAuditLog.old_data, null, 2)
                            : '// Không có dữ liệu cũ (INSERT hoặc không ghi nhận)'}
                        </pre>
                      </div>

                      {/* New raw JSON */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Toàn bộ dữ liệu mới (New Object)
                        </label>
                        <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl overflow-auto text-xs font-mono max-h-[300px] border border-slate-800 select-all">
                          {selectedAuditLog.new_data 
                            ? JSON.stringify(selectedAuditLog.new_data, null, 2)
                            : '// Không có dữ liệu mới (DELETE hoặc không ghi nhận)'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer buttons */}
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAuditDetailModal(false);
                      setSelectedAuditLog(null);
                    }}
                    className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer shadow-md"
                  >
                    Đóng đối soát
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Template Form Modal */}
        {showTemplateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-8 py-6 text-white flex justify-between items-center shrink-0">
                <div>
                  <span className="text-[9px] bg-primary/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-primary/20">QUẢN TRỊ DANH MỤC</span>
                  <h3 className="text-lg font-black uppercase tracking-tight mt-1">{editingTemplate ? 'Cập nhật Liệu trình Chuẩn' : 'Thêm mới Liệu trình Chuẩn'}</h3>
                </div>
                <button 
                  onClick={() => setShowTemplateModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto">
                <form id="templateForm" onSubmit={handleSaveTemplate} className="space-y-6 text-left">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tên liệu trình *</label>
                    <input
                      type="text"
                      required
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      placeholder="VD: Chăm sóc da chuyên sâu VIP"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-bold text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Giá chuẩn HQ (VNĐ) *</label>
                      <input
                        type="number"
                        required
                        value={templatePrice}
                        onChange={e => setTemplatePrice(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">KTV Hoa hồng/buổi (VNĐ)</label>
                      <input
                        type="number"
                        value={templateKtvCommission}
                        onChange={e => setTemplateKtvCommission(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Thời lượng (VD: 90 phút)</label>
                      <input
                        type="text"
                        value={templateDuration}
                        onChange={e => setTemplateDuration(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Số buổi liệu trình</label>
                      <input
                        type="number"
                        value={templateTotalSessions}
                        onChange={e => setTemplateTotalSessions(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                        <Lock size={12} className="text-slate-400" />
                        Quản trị giá bán & Phân phối
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Cho phép Đại lý tự đổi giá</span>
                        <input 
                          type="checkbox"
                          checked={templateAllowedOverride}
                          onChange={e => setTemplateAllowedOverride(e.target.checked)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                        />
                      </label>
                    </div>

                    <div className={`grid grid-cols-2 gap-4 transition-all ${!templateAllowedOverride ? 'opacity-40 pointer-events-none' : ''}`}>
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Giá sàn (Tối thiểu)</label>
                        <input
                          type="number"
                          value={templatePriceFloor}
                          onChange={e => setTemplatePriceFloor(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Giá trần (Tối đa)</label>
                        <input
                          type="number"
                          value={templatePriceCap}
                          onChange={e => setTemplatePriceCap(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                        />
                      </div>
                    </div>
                    {!templateAllowedOverride && (
                      <p className="text-[10px] text-slate-500 font-bold italic">
                        Khi tắt tùy chọn này, các chi nhánh nhượng quyền sẽ bị khóa giá bán lẻ chính xác theo Giá chuẩn HQ.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Ưu đãi / Ghi chú</label>
                    <input
                      type="text"
                      value={templateOffer}
                      onChange={e => setTemplateOffer(e.target.value)}
                      placeholder="VD: Tặng kèm voucher 200k"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Các bước quy trình (Chuẩn hóa)</label>
                    <div className="space-y-2 mb-3">
                      {templateDetails.map((detail, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
                          <span className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-[9px] font-black text-slate-400 shrink-0 shadow-sm">{idx + 1}</span>
                          <span className="text-xs font-bold text-slate-700 flex-1">{detail}</span>
                          <button
                            type="button"
                            onClick={() => removeDetailStep(idx)}
                            className="text-slate-400 hover:text-rose-500 p-1"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newDetailText}
                        onChange={e => setNewDetailText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDetailStep())}
                        placeholder="Thêm bước thực hiện..."
                        className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-primary transition-all"
                      />
                      <button
                        type="button"
                        onClick={addDetailStep}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                      >
                        Thêm
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  form="templateForm"
                  disabled={submittingTemplate}
                  className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {submittingTemplate ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  Lưu Gói Mẫu
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Distribution Checklist Modal */}
        {showDistributionModal && selectedTemplateForDist && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] text-left"
            >
              <div className="bg-gradient-to-r from-indigo-900 to-slate-900 px-8 py-6 text-white flex justify-between items-center shrink-0">
                <div>
                  <span className="text-[9px] bg-white/20 text-indigo-200 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/10">TRIỂN KHAI MẪU</span>
                  <h3 className="text-lg font-black uppercase tracking-tight mt-1 truncate max-w-[300px]">{selectedTemplateForDist.name}</h3>
                </div>
                <button 
                  onClick={() => setShowDistributionModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-6">
                <div className="bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-2xl flex items-start gap-3 text-indigo-700">
                  <Info size={20} className="shrink-0 mt-0.5" />
                  <p className="text-xs font-bold leading-relaxed">
                    Chọn các chi nhánh để đẩy cấu hình liệu trình chuẩn này xuống. Nếu chi nhánh đã có gói này, hệ thống sẽ <strong>ghi đè & cập nhật</strong> lại quy trình/thời lượng chuẩn.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Danh sách chi nhánh</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedTenantIds.length === matrixTenants.length) {
                          setSelectedTenantIds([]);
                        } else {
                          setSelectedTenantIds(matrixTenants.map(t => t.id));
                        }
                      }}
                      className="text-[10px] font-black text-primary uppercase tracking-wider hover:underline"
                    >
                      {selectedTenantIds.length === matrixTenants.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2">
                    {matrixTenants.map(tenant => {
                      const isChecked = selectedTenantIds.includes(tenant.id);
                      return (
                        <label 
                          key={tenant.id} 
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isChecked ? 'bg-rose-50/50 border-primary shadow-sm' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                          }`}
                        >
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTenantIds([...selectedTenantIds, tenant.id]);
                              } else {
                                setSelectedTenantIds(selectedTenantIds.filter(id => id !== tenant.id));
                              }
                            }}
                            className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                          />
                          <span className={`text-sm font-bold ${isChecked ? 'text-slate-900' : 'text-slate-600'}`}>
                            {tenant.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDistributionModal(false)}
                  className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleDistributeTemplate}
                  disabled={submittingDistribution || selectedTenantIds.length === 0}
                  className="px-6 py-3 bg-primary hover:bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-primary/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {submittingDistribution ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  Tiến hành phân phối
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
