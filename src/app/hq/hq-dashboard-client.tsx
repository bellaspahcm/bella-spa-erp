'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Lock, 
  RefreshCw, 
  Percent,
  CreditCard,
  X,
  Truck,
  Crown,
  Award,
  Sparkles,
  Info,
  Plus,
  Send,
  Package,
  Check
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
import {
  HqDashboardHeader,
  HqDashboardTabs,
  type HqDashboardTab,
} from './components/HqDashboardChrome';
import { HqBranchKpiCards } from './components/HqBranchKpiCards';
import { HqBranchAnalyticsPanel } from './components/HqBranchAnalyticsPanel';
import { HqSubscriptionPackageReference } from './components/HqSubscriptionPackageReference';
import { HqBranchFilters } from './components/HqBranchFilters';
import { HqBranchTable } from './components/HqBranchTable';
import { HqFranchiseRoyaltyStats } from './components/HqFranchiseRoyaltyStats';
import { HqFranchiseConfigLedger } from './components/HqFranchiseConfigLedger';
import { HqRoyaltyInvoiceLedger } from './components/HqRoyaltyInvoiceLedger';
import { HqClearingStats } from './components/HqClearingStats';
import { HqClearingRateLedger } from './components/HqClearingRateLedger';
import { HqClearingRecordsLedger } from './components/HqClearingRecordsLedger';
import { HqTransferStats } from './components/HqTransferStats';
import { HqTransferFilters } from './components/HqTransferFilters';
import { HqTransferOrdersLedger } from './components/HqTransferOrdersLedger';
import { HqAuditStats } from './components/HqAuditStats';
import { HqAuditFilters } from './components/HqAuditFilters';
import { HqAuditLogLedger } from './components/HqAuditLogLedger';

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

  const [compareMetric, setCompareMetric] = useState<'revenue' | 'customers'>('revenue');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'direct' | 'franchise'>('all');
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Tab System
  const [activeTab, setActiveTab] = useState<HqDashboardTab>('branches');
  
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

  // Sync data manually
  const refreshData = async () => {
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
    setLoadingAudit(true);
    try {
      const logs = await getHqAuditLogs({
        tenantId: selectedTenant,
        userId: selectedUser,
        action: (selectedAction === 'INSERT' || selectedAction === 'UPDATE' || selectedAction === 'DELETE' ? selectedAction : '') as 'INSERT' | 'UPDATE' | 'DELETE' | '',
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

  // Filtered tenants displayed in the branch registry.
  // Keep HQ visible here because the table has explicit HQ status/badge/actions.
  const filteredTenants = tenants.filter(t => {
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
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#11100F] pb-20 font-sans antialiased text-slate-800 dark:text-[#EFE9E1] transition-colors duration-300">
      <HqDashboardHeader
        currentUser={currentUser}
        loading={loading}
        onRefresh={refreshData}
        onLogout={handleLogout}
      />

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

        <HqDashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'branches' ? (
          <>
            <HqBranchKpiCards stats={stats} />

            <HqBranchAnalyticsPanel
              stats={stats}
              tenants={tenants}
              maxGrowth={maxGrowth}
              compareMetric={compareMetric}
              onCompareMetricChange={setCompareMetric}
            />

            <HqSubscriptionPackageReference />

            <HqBranchFilters
              searchTerm={searchTerm}
              typeFilter={typeFilter}
              statusFilter={statusFilter}
              onSearchTermChange={setSearchTerm}
              onTypeFilterChange={setTypeFilter}
              onStatusFilterChange={setStatusFilter}
            />

            <HqBranchTable
              tenants={filteredTenants}
              updatingId={updatingId}
              onToggleStatus={handleToggleStatus}
              getTierBadge={getTierBadge}
              getExpirationInfo={getExpirationInfo}
            />
          </>
        ) : activeTab === 'franchise' ? (
          /* FRANCHISE AGREEMENT & ROYALTY LEDGER TAB */
          <div className="space-y-8">
            <HqFranchiseRoyaltyStats
              totalProjectedFees={totalProjectedFees}
              totalCollectedFees={totalCollectedFees}
              totalOutstandingFees={totalOutstandingFees}
            />

            <HqFranchiseConfigLedger
              tenants={tenants}
              onOpenConfig={handleOpenConfig}
            />

            <HqRoyaltyInvoiceLedger
              invoices={invoices}
              loading={loadingRoyalty}
              onReconcileInvoice={handleReconcileInvoice}
            />
          </div>
        ) : activeTab === 'clearing' ? (
          /* INTER-BRANCH CLEARING TAB */
          <div className="space-y-8 text-left">
            <HqClearingStats records={clearingRecords} />

            <HqClearingRateLedger
              tenants={tenants}
              onOpenClearingRate={handleOpenClearingRate}
            />

            <HqClearingRecordsLedger
              records={clearingRecords}
              loading={loadingClearing}
              onClearRecord={handleClearRecord}
            />
          </div>
        ) : activeTab === 'transfers' ? (
          /* CUNG ỨNG & CHUYỂN KHO (TRANSFERS) TAB */
          <div className="space-y-8 text-left">
            <HqTransferStats orders={transferOrders} />

            <HqTransferFilters
              tenants={tenants}
              filterStatus={transferFilterStatus}
              filterBranch={transferFilterBranch}
              onFilterStatusChange={setTransferFilterStatus}
              onFilterBranchChange={setTransferFilterBranch}
            />

            <HqTransferOrdersLedger
              orders={transferOrders}
              loading={loadingTransfers}
              filterStatus={transferFilterStatus}
              filterBranch={transferFilterBranch}
              onOpenCancelModal={handleOpenCancelModal}
              onOpenShipModal={handleOpenShipModal}
            />
          </div>
        ) : activeTab === 'audit' ? (
          /* NHẬT KÝ KIỂM TOÁN (AUDIT) TAB */
          <div className="space-y-8 text-left">
            <HqAuditStats logs={auditLogs} tables={auditTables} />

            <HqAuditFilters
              tenants={tenants}
              users={auditUsers}
              tables={auditTables}
              selectedTenant={selectedTenant}
              selectedUser={selectedUser}
              selectedAction={selectedAction}
              selectedTable={selectedTable}
              startDate={startDate}
              endDate={endDate}
              onSelectedTenantChange={setSelectedTenant}
              onSelectedUserChange={setSelectedUser}
              onSelectedActionChange={setSelectedAction}
              onSelectedTableChange={setSelectedTable}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />

            <HqAuditLogLedger
              logs={auditLogs}
              loading={loadingAudit}
              currentPage={currentPage}
              onInspectLog={(log) => {
                setSelectedAuditLog(log);
                setShowAuditDetailModal(true);
                setShowRawJson(false);
              }}
              onPreviousPage={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              onNextPage={() => setCurrentPage(prev => prev + 1)}
            />
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
                          ? 'bg-primary/5 text-primary border-primary shadow-sm shadow-pink-100 dark:shadow-none'
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
                          ? 'bg-primary/5 text-primary border-primary shadow-sm shadow-pink-100 dark:shadow-none'
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
                    className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-100 dark:shadow-none"
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
