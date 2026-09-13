"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Loader2, RefreshCw, Calendar, Building,
  User, DollarSign, FileText, X, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import {
  createReservationAction,
  fetchReservationsAction,
  cancelReservationAction
} from "@/modules/real_estate/actions/reservationActions";
import { fetchProductsAction } from "@/modules/real_estate/actions/productActions";
import { fetchCustomersAction } from "@/modules/real_estate/actions/customerActions";
import { fetchProjectsAction } from "@/modules/real_estate/actions/projectActions";
import { Database } from "@/types/database.types";

type ReservationRow = Database["public"]["Tables"]["re_reservations"]["Row"];
type ProductRow = Database["public"]["Tables"]["real_estate_products"]["Row"];
type CustomerRow = Database["public"]["Tables"]["re_customers"]["Row"];
type ProjectRow = Database["public"]["Tables"]["real_estate_projects"]["Row"];

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    project_id: "",
    product_id: "",
    customer_id: "",
    deposit_amount: "",
    notes: ""
  });

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [reservationsResult, projectsResult, customersResult] = await Promise.all([
        fetchReservationsAction(),
        fetchProjectsAction(),
        fetchCustomersAction()
      ]);

      if (reservationsResult.success && reservationsResult.data) {
        setReservations(reservationsResult.data);
      }

      if (projectsResult.success && projectsResult.data) {
        setProjects(projectsResult.data);
      }

      if (customersResult.success && customersResult.data) {
        setCustomers(customersResult.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Load products when project selected
  const loadProductsForProject = async (projectId: string) => {
    if (!projectId) {
      setProducts([]);
      return;
    }

    setLoadingProducts(true);
    try {
      const result = await fetchProductsAction(projectId);
      if (result.success && result.data) {
        setProducts(Array.isArray(result.data) ? result.data.filter(p => p.status === 'available') : []);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
      toast.error('Failed to load products');
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Load products when project changes
  useEffect(() => {
    if (formData.project_id) {
      loadProductsForProject(formData.project_id);
      // Reset product selection when project changes
      setFormData(prev => ({ ...prev, product_id: "" }));
    }
  }, [formData.project_id]);

  const handleCreate = async () => {
    if (!formData.project_id) {
      toast.error('Please select a project');
      return;
    }
    if (!formData.product_id || !formData.customer_id || !formData.deposit_amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCreating(true);
    try {
      const result = await createReservationAction({
        product_id: formData.product_id,
        customer_id: formData.customer_id,
        deposit_amount: parseFloat(formData.deposit_amount),
        notes: formData.notes || null
      });

      if (result.success) {
        toast.success('Reservation created successfully');
        setShowCreateModal(false);
        setFormData({
          project_id: "",
          product_id: "",
          customer_id: "",
          deposit_amount: "",
          notes: ""
        });
        setProducts([]); // Clear products
        loadData();
      } else {
        toast.error(result.error || 'Failed to create reservation');
      }
    } catch (error) {
      console.error('Failed to create reservation:', error);
      toast.error('Unexpected error');
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (reservationId: string) => {
    if (!confirm('Are you sure you want to cancel this reservation?')) {
      return;
    }

    try {
      const result = await cancelReservationAction(reservationId);
      if (result.success) {
        toast.success('Reservation cancelled');
        loadData();
      } else {
        toast.error(result.error || 'Failed to cancel');
      }
    } catch (error) {
      console.error('Failed to cancel:', error);
      toast.error('Unexpected error');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      pending_deposit: { label: 'Chờ đặt cọc', className: 'bg-amber-100 text-amber-800 border-amber-300' },
      deposited: { label: 'Đã đặt cọc', className: 'bg-orange-100 text-orange-800 border-orange-300' },
      converted_to_contract: { label: 'Đã chuyển HĐ', className: 'bg-purple-100 text-purple-800 border-purple-300' },
      cancelled: { label: 'Đã hủy', className: 'bg-rose-100 text-rose-800 border-rose-300' }
    };

    const statusInfo = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-300' };

    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Đặt chỗ / Reservations
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage property reservations
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Reservation
          </button>
        </div>
      </div>

      {/* Reservations List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {reservations.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No reservations found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first reservation
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Deposit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {reservations.map((reservation) => (
                  <tr key={reservation.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {reservation.product?.product_code || reservation.product_id}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {reservation.customer?.name || 'N/A'}
                          </div>
                          {reservation.customer?.phone && (
                            <div className="text-xs text-gray-500">
                              {reservation.customer.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(reservation.deposit_amount)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(reservation.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(reservation.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      {reservation.status !== 'cancelled' && reservation.status !== 'converted_to_contract' && (
                        <button
                          onClick={() => handleCancel(reservation.id)}
                          className="text-rose-600 hover:text-rose-700 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Create New Reservation
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Project Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.project_name}
                    </option>
                  ))}
                </select>
                {projects.length === 0 && (
                  <p className="mt-1 text-sm text-amber-600">No projects found</p>
                )}
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Product <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  disabled={!formData.project_id || loadingProducts}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {loadingProducts ? 'Loading products...' : 'Select a product'}
                  </option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.product_code} - {product.product_type} ({product.area}m²)
                    </option>
                  ))}
                </select>
                {!formData.project_id && (
                  <p className="mt-1 text-sm text-gray-500">Please select a project first</p>
                )}
                {formData.project_id && products.length === 0 && !loadingProducts && (
                  <p className="mt-1 text-sm text-amber-600">No available products found in this project</p>
                )}
              </div>

              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Customer <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.phone}
                    </option>
                  ))}
                </select>
                {customers.length === 0 && (
                  <p className="mt-1 text-sm text-amber-600">No customers found</p>
                )}
              </div>

              {/* Deposit Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Deposit Amount (VND) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.deposit_amount}
                  onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                  placeholder="50000000"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Create Reservation
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
