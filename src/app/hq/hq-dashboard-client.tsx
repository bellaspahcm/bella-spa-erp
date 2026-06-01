'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { 
  Crown,
  Award,
  Sparkles,
  Info
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
  InventoryTransferOrder
} from '@/services/inventory-transfer-actions';
import { createClient } from '@/lib/supabase-client';
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
import { HqServiceStats } from './components/HqServiceStats';
import { HqServiceTemplateList } from './components/HqServiceTemplateList';
import { HqServiceDistributionMatrix } from './components/HqServiceDistributionMatrix';
import { HqRoyaltyConfigModal } from './components/HqRoyaltyConfigModal';
import { HqClearingRateModal } from './components/HqClearingRateModal';
import { HqTransferShipModal } from './components/HqTransferShipModal';
import { HqTransferCancelModal } from './components/HqTransferCancelModal';
import { HqAuditDetailModal } from './components/HqAuditDetailModal';
import { HqServiceTemplateModal } from './components/HqServiceTemplateModal';
import { HqServiceDistributionModal } from './components/HqServiceDistributionModal';
import { HqSubscriptionQuotaConsole } from './components/HqSubscriptionQuotaConsole';

interface HqDashboardClientProps {
  initialStats: HqDashboardStats;
  initialTenants: HqTenantRecord[];
  currentUser: CurrentUser;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Lỗi không xác định';
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
  const [subscriptionRefreshSignal, setSubscriptionRefreshSignal] = useState(0);
  
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
      } else if (activeTab === 'subscriptions') {
        setSubscriptionRefreshSignal(prev => prev + 1);
      } else if (activeTab === 'services') {
        await loadServicesData();
      }
      
      toast.success('Đồng bộ dữ liệu Bella HQ thành công!');
    } catch (err) {
      toast.error('Lỗi khi tải lại dữ liệu: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadRoyaltyData = async () => {
    setLoadingRoyalty(true);
    try {
      const data = await getFranchiseRoyaltyInvoices();
      setInvoices(data);
    } catch (err) {
      toast.error('Không thể tải hóa đơn nhượng quyền: ' + getErrorMessage(err));
    } finally {
      setLoadingRoyalty(false);
    }
  };

  const loadClearingData = async () => {
    setLoadingClearing(true);
    try {
      const data = await getInterBranchClearingRecords();
      setClearingRecords(data);
    } catch (err) {
      toast.error('Không thể tải đối soát liên chi nhánh: ' + getErrorMessage(err));
    } finally {
      setLoadingClearing(false);
    }
  };

  const loadTransferData = async () => {
    setLoadingTransfers(true);
    try {
      const data = await getInventoryTransferOrders();
      setTransferOrders(data);
    } catch (err) {
      toast.error('Không thể tải danh sách chuyển kho: ' + getErrorMessage(err));
    } finally {
      setLoadingTransfers(false);
    }
  };

  const loadAuditData = useCallback(async (page: number = 1) => {
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
    } catch (err) {
      toast.error('Không thể tải nhật ký kiểm toán: ' + getErrorMessage(err));
    } finally {
      setLoadingAudit(false);
    }
  }, [
    auditTables.length,
    auditUsers.length,
    endDate,
    selectedAction,
    selectedTable,
    selectedTenant,
    selectedUser,
    startDate,
  ]);

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
    } catch (err) {
      toast.error('Lỗi: ' + getErrorMessage(err));
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
    } catch (err) {
      toast.error('Lỗi: ' + getErrorMessage(err));
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
    } catch (err) {
      toast.error('Lỗi: ' + getErrorMessage(err));
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
    } catch (err) {
      toast.error('Lỗi: ' + getErrorMessage(err));
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
    } catch (err) {
      toast.error('Không thể tải danh sách liệu trình và ma trận phân phối: ' + getErrorMessage(err));
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
    } catch (err) {
      toast.error('Lỗi lưu liệu trình: ' + getErrorMessage(err));
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
    } catch (err) {
      toast.error('Lỗi khi xóa: ' + getErrorMessage(err));
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
    } catch (err) {
      toast.error('Lỗi phân phối: ' + getErrorMessage(err));
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
  }, [activeTab, currentPage, loadAuditData]);

  const handleTenantSubscriptionChanged = async () => {
    const [freshStats, freshTenants] = await Promise.all([
      getHqDashboardStats(),
      getAllTenants(),
    ]);
    setStats(freshStats);
    setTenants(freshTenants as unknown as HqTenantRecord[]);
  };

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
      toast.error('Có lỗi xảy ra: ' + getErrorMessage(err));
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
    } catch (err) {
      toast.error('Lỗi lưu cấu hình: ' + getErrorMessage(err));
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
    } catch (err) {
      toast.error('Lỗi khi đối soát: ' + getErrorMessage(err));
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
              onSelectedTenantChange={(value) => {
                setSelectedTenant(value);
                setCurrentPage(1);
              }}
              onSelectedUserChange={(value) => {
                setSelectedUser(value);
                setCurrentPage(1);
              }}
              onSelectedActionChange={(value) => {
                setSelectedAction(value);
                setCurrentPage(1);
              }}
              onSelectedTableChange={(value) => {
                setSelectedTable(value);
                setCurrentPage(1);
              }}
              onStartDateChange={(value) => {
                setStartDate(value);
                setCurrentPage(1);
              }}
              onEndDateChange={(value) => {
                setEndDate(value);
                setCurrentPage(1);
              }}
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
        ) : activeTab === 'subscriptions' ? (
          <HqSubscriptionQuotaConsole
            refreshSignal={subscriptionRefreshSignal}
            onTenantSubscriptionChanged={handleTenantSubscriptionChanged}
          />
        ) : (
          /* LIỆU TRÌNH CHUẨN (SERVICES) TAB PANEL */
          <div className="space-y-8 text-left">
            <HqServiceStats
              templates={templates}
              distributedList={distributedList}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <HqServiceTemplateList
                templates={templates}
                loading={loadingServices}
                onOpenTemplate={handleOpenTemplateModal}
                onOpenDistribution={handleOpenDistributionModal}
                onDeleteTemplate={handleDeleteTemplate}
              />

              <HqServiceDistributionMatrix
                templates={templates}
                distributedList={distributedList}
                loading={loadingServices}
              />
            </div>
          </div>
        )}

      </main>

      {/* Configuration Modal */}
      <AnimatePresence>
        <HqRoyaltyConfigModal
          tenant={editingTenant}
          royaltyType={royaltyType}
          royaltyRate={royaltyRate}
          royaltyFixedAmount={royaltyFixedAmount}
          submitting={submittingConfig}
          onClose={() => setEditingTenant(null)}
          onRoyaltyTypeChange={setRoyaltyType}
          onRoyaltyRateChange={setRoyaltyRate}
          onRoyaltyFixedAmountChange={setRoyaltyFixedAmount}
          onSubmit={handleSaveConfig}
        />

        <HqClearingRateModal
          tenant={editingClearingRateTenant}
          rate={newClearingRate}
          submitting={submittingClearingRate}
          onClose={() => setEditingClearingRateTenant(null)}
          onRateChange={setNewClearingRate}
          onSubmit={handleSaveClearingRate}
        />

        <HqTransferShipModal
          transfer={showShipModal ? selectedTransfer : null}
          shippingCarrier={shippingCarrier}
          trackingNumber={trackingNumber}
          submitting={submittingTransferAction}
          onClose={() => {
            setShowShipModal(false);
            setSelectedTransfer(null);
          }}
          onShippingCarrierChange={setShippingCarrier}
          onTrackingNumberChange={setTrackingNumber}
          onSubmit={handleApproveAndShip}
        />

        <HqTransferCancelModal
          transfer={showCancelModal ? selectedTransfer : null}
          refusingReason={refusingReason}
          submitting={submittingTransferAction}
          onClose={() => {
            setShowCancelModal(false);
            setSelectedTransfer(null);
          }}
          onRefusingReasonChange={setRefusingReason}
          onSubmit={handleCancelOrder}
        />

        <HqAuditDetailModal
          log={showAuditDetailModal ? selectedAuditLog : null}
          showRawJson={showRawJson}
          onClose={() => {
            setShowAuditDetailModal(false);
            setSelectedAuditLog(null);
          }}
          onShowRawJsonChange={setShowRawJson}
        />

        <HqServiceTemplateModal
          open={showTemplateModal}
          editingTemplate={editingTemplate}
          templateName={templateName}
          templatePrice={templatePrice}
          templateDuration={templateDuration}
          templateTotalSessions={templateTotalSessions}
          templateKtvCommission={templateKtvCommission}
          templatePriceFloor={templatePriceFloor}
          templatePriceCap={templatePriceCap}
          templateAllowedOverride={templateAllowedOverride}
          templateDetails={templateDetails}
          newDetailText={newDetailText}
          templateOffer={templateOffer}
          submitting={submittingTemplate}
          onClose={() => setShowTemplateModal(false)}
          onSubmit={handleSaveTemplate}
          onTemplateNameChange={setTemplateName}
          onTemplatePriceChange={setTemplatePrice}
          onTemplateDurationChange={setTemplateDuration}
          onTemplateTotalSessionsChange={setTemplateTotalSessions}
          onTemplateKtvCommissionChange={setTemplateKtvCommission}
          onTemplatePriceFloorChange={setTemplatePriceFloor}
          onTemplatePriceCapChange={setTemplatePriceCap}
          onTemplateAllowedOverrideChange={setTemplateAllowedOverride}
          onTemplateOfferChange={setTemplateOffer}
          onNewDetailTextChange={setNewDetailText}
          onAddDetailStep={addDetailStep}
          onRemoveDetailStep={removeDetailStep}
        />

        <HqServiceDistributionModal
          open={showDistributionModal}
          template={selectedTemplateForDist}
          tenants={matrixTenants}
          selectedTenantIds={selectedTenantIds}
          submitting={submittingDistribution}
          onClose={() => setShowDistributionModal(false)}
          onSelectedTenantIdsChange={setSelectedTenantIds}
          onSubmit={handleDistributeTemplate}
        />
      </AnimatePresence>

    </div>
  );
}
