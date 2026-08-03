/**
 * Bella Auto - Capability Marketplace
 * Phase 14: Browse and install reusable capabilities
 */

'use client';

import { useState, useEffect } from 'react';
import { Package, Star, Download, CheckCircle, Filter, Search } from 'lucide-react';

export interface Capability {
  id: string;
  code: string;
  name: string;
  description: string;
  category: 'engine' | 'workflow' | 'integration' | 'analytics';
  provider: string;
  iconUrl?: string;
  isPublic: boolean;
  isVerified: boolean;
  pricingModel: 'free' | 'one_time' | 'subscription' | 'usage_based';
  basePrice?: number;
  installCount: number;
  ratingAvg?: number;
  ratingCount: number;
}

export interface CapabilityMarketplaceProps {
  onInstall: (capabilityId: string) => void;
  installedCapabilityIds?: string[];
}

const CATEGORY_INFO = {
  engine: { label: 'Engine', icon: '⚙️', color: 'blue' },
  workflow: { label: 'Workflow', icon: '🔄', color: 'purple' },
  integration: { label: 'Integration', icon: '🔗', color: 'green' },
  analytics: { label: 'Analytics', icon: '📊', color: 'orange' },
};

export function CapabilityMarketplace({
  onInstall,
  installedCapabilityIds = [],
}: CapabilityMarketplaceProps) {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'rating'>('popular');

  useEffect(() => {
    fetchCapabilities();
  }, []);

  const fetchCapabilities = async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/bella-auto/marketplace/capabilities');
      // const data = await response.json();

      // Mock data (seeded capabilities)
      const mockCapabilities: Capability[] = [
        {
          id: '1',
          code: 'journey_engine',
          name: 'Customer Journey Engine',
          description: 'Track customer lifecycle from lead to delivery with stage-based workflows',
          category: 'engine',
          provider: 'bella_auto',
          isPublic: true,
          isVerified: true,
          pricingModel: 'free',
          installCount: 150,
          ratingAvg: 4.8,
          ratingCount: 42,
        },
        {
          id: '2',
          code: 'vehicle_lifecycle',
          name: 'Vehicle Lifecycle Management',
          description: 'Manage vehicle inventory from acquisition to sale with status tracking',
          category: 'engine',
          provider: 'bella_auto',
          isPublic: true,
          isVerified: true,
          pricingModel: 'free',
          installCount: 120,
          ratingAvg: 4.7,
          ratingCount: 35,
        },
        {
          id: '3',
          code: 'tradein_appraisal',
          name: 'Trade-In Appraisal System',
          description: 'Automated vehicle valuation with market price integration',
          category: 'workflow',
          provider: 'bella_auto',
          isPublic: true,
          isVerified: true,
          pricingModel: 'subscription',
          basePrice: 99000,
          installCount: 85,
          ratingAvg: 4.9,
          ratingCount: 28,
        },
        {
          id: '4',
          code: 'customer_experience',
          name: 'Customer Experience Management',
          description: 'Drive satisfaction with feedback collection and NPS tracking',
          category: 'analytics',
          provider: 'bella_auto',
          isPublic: true,
          isVerified: true,
          pricingModel: 'free',
          installCount: 200,
          ratingAvg: 4.6,
          ratingCount: 67,
        },
        {
          id: '5',
          code: 'rule_engine',
          name: 'Business Rule Engine',
          description: 'No-code rule builder with approval workflows',
          category: 'engine',
          provider: 'bella_auto',
          isPublic: true,
          isVerified: true,
          pricingModel: 'subscription',
          basePrice: 149000,
          installCount: 95,
          ratingAvg: 5.0,
          ratingCount: 18,
        },
        {
          id: '6',
          code: 'business_rollback',
          name: 'Business Transaction Rollback',
          description: 'Undo complex multi-table operations safely',
          category: 'workflow',
          provider: 'bella_auto',
          isPublic: true,
          isVerified: true,
          pricingModel: 'subscription',
          basePrice: 129000,
          installCount: 72,
          ratingAvg: 4.8,
          ratingCount: 15,
        },
        {
          id: '7',
          code: 'temporal_history',
          name: 'Temporal History Tracking',
          description: 'Time-travel queries and compliance snapshots',
          category: 'analytics',
          provider: 'bella_auto',
          isPublic: true,
          isVerified: true,
          pricingModel: 'subscription',
          basePrice: 179000,
          installCount: 58,
          ratingAvg: 4.9,
          ratingCount: 12,
        },
      ];

      setCapabilities(mockCapabilities);
    } catch (error) {
      console.error('Failed to fetch capabilities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCapabilities = capabilities
    .filter((cap) => {
      if (selectedCategory !== 'all' && cap.category !== selectedCategory) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          cap.name.toLowerCase().includes(query) ||
          cap.description.toLowerCase().includes(query) ||
          cap.code.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'popular') return b.installCount - a.installCount;
      if (sortBy === 'rating') return (b.ratingAvg || 0) - (a.ratingAvg || 0);
      return 0; // newest - would use created_at in real implementation
    });

  const isInstalled = (capabilityId: string) => installedCapabilityIds.includes(capabilityId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Đang tải marketplace...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Capability Marketplace</h2>
        <p className="text-sm text-gray-600 mt-1">
          Cài đặt capabilities từ marketplace để mở rộng tính năng
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm capability..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md"
          />
        </div>

        {/* Category */}
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md bg-white"
          >
            <option value="all">Tất cả</option>
            {Object.entries(CATEGORY_INFO).map(([key, info]) => (
              <option key={key} value={key}>
                {info.icon} {info.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-md bg-white"
        >
          <option value="popular">Phổ biến nhất</option>
          <option value="rating">Đánh giá cao</option>
          <option value="newest">Mới nhất</option>
        </select>
      </div>

      {/* Capability Grid */}
      {filteredCapabilities.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
          <p className="text-gray-500">Không tìm thấy capability phù hợp</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCapabilities.map((capability) => {
            const categoryInfo = CATEGORY_INFO[capability.category];
            const installed = isInstalled(capability.id);

            return (
              <div
                key={capability.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{categoryInfo.icon}</div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{capability.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded bg-${categoryInfo.color}-100 text-${categoryInfo.color}-800`}>
                        {categoryInfo.label}
                      </span>
                    </div>
                  </div>
                  {capability.isVerified && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {capability.description}
                </p>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm mb-4">
                  <div className="flex items-center gap-1 text-gray-600">
                    <Download className="w-4 h-4" />
                    {capability.installCount.toLocaleString()}
                  </div>
                  {capability.ratingAvg && (
                    <div className="flex items-center gap-1 text-yellow-600">
                      <Star className="w-4 h-4 fill-current" />
                      {capability.ratingAvg.toFixed(1)} ({capability.ratingCount})
                    </div>
                  )}
                </div>

                {/* Price */}
                <div className="mb-4">
                  {capability.pricingModel === 'free' ? (
                    <span className="text-green-600 font-semibold">Miễn phí</span>
                  ) : (
                    <span className="text-gray-900">
                      {capability.basePrice?.toLocaleString('vi-VN')} VND
                      <span className="text-gray-500 text-sm">
                        {capability.pricingModel === 'subscription' ? '/tháng' : ''}
                      </span>
                    </span>
                  )}
                </div>

                {/* Install Button */}
                {installed ? (
                  <button
                    disabled
                    className="w-full py-2 bg-gray-100 text-gray-500 rounded-md cursor-not-allowed"
                  >
                    ✓ Đã cài đặt
                  </button>
                ) : (
                  <button
                    onClick={() => onInstall(capability.id)}
                    className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <Package className="inline w-4 h-4 mr-2" />
                    Cài đặt
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>{filteredCapabilities.length}</strong> capabilities
          {selectedCategory !== 'all' && ` trong ${CATEGORY_INFO[selectedCategory as keyof typeof CATEGORY_INFO]?.label}`}
          {' • '}
          <strong>{installedCapabilityIds.length}</strong> đã cài đặt
        </p>
      </div>
    </div>
  );
}
