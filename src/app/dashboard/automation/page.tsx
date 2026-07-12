'use client';

import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { TemplateCard, EmptyStateCard } from '@/components/automation';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { AUTOMATION_TEMPLATES } from '@/lib/automation/templates';

// Convert templates to TemplateCard props format
const TEMPLATES_FOR_DISPLAY = AUTOMATION_TEMPLATES.map((t) => ({
  id: t.id,
  emoji: t.icon,
  title: t.name,
  description: t.description,
  usageCount: t.usageCount,
  timeSaved: t.valueProp,
  category: t.category,
}));

const FILTER_OPTIONS = [
  { value: 'all', label: '🔥 Phổ biến' },
  { value: 'promotion', label: '🎁 Khuyến mãi' },
  { value: 'booking', label: '📅 Booking' },
  { value: 'hr', label: '👩 Nhân viên' }
];

/**
 * Automation Studio Homepage - TEMPLATE GALLERY (Template-First!)
 * 
 * Design: docs/design/AUTOMATION_STUDIO_UX_DESIGN.md - Flow 1
 * Philosophy: Canva-style (show templates first, not blank canvas)
 * 
 * Features:
 * - Template gallery (sorted by popularity)
 * - Search & filter
 * - Social proof (usage count)
 * - Empty state (personality-driven)
 * - "+ Tạo từ đầu" button (secondary, bottom right)
 */
export default function AutomationStudioPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  
  // Filter templates
  const filteredTemplates = TEMPLATES_FOR_DISPLAY.filter(template => {
    const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === 'all' || template.category === selectedFilter;
    return matchesSearch && matchesFilter;
  });
  
  const handleUseTemplate = (templateId: string) => {
    router.push(`/dashboard/automation/new?template=${templateId}`);
  };
  
  const handleViewDetails = (templateId: string) => {
    // TODO: Open template detail modal
    console.log('View template details:', templateId);
  };
  
  const handleCreateFromScratch = () => {
    router.push('/dashboard/automation/new');
  };
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="text-rose-500" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">
              Automation Studio
            </h1>
          </div>
          <p className="text-gray-600">
            Tự động hóa quy trình spa của bạn trong vài phút
          </p>
        </motion.div>
        
        {/* Search & Filter */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Tìm automation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>
          
          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto">
            {FILTER_OPTIONS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setSelectedFilter(filter.value)}
                className={`
                  px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap
                  transition-all duration-200
                  ${selectedFilter === filter.value
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-rose-300'
                  }
                `}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </motion.div>
        
        {/* Template Grid or Empty State */}
        {filteredTemplates.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {filteredTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                <TemplateCard
                  {...template}
                  onUse={() => handleUseTemplate(template.id)}
                  onViewDetails={() => handleViewDetails(template.id)}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <EmptyStateCard
            icon="🔍"
            headline="Không tìm thấy automation"
            description={`Không có automation nào khớp với "${searchQuery}". Thử tìm kiếm với từ khóa khác hoặc tạo mới.`}
            primaryAction={{
              label: 'Xóa tìm kiếm',
              onClick: () => setSearchQuery('')
            }}
            secondaryAction={{
              label: 'Tạo automation mới',
              onClick: handleCreateFromScratch
            }}
          />
        )}
        
        {/* Floating "+ Tạo từ đầu" Button (Secondary, bottom right) */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCreateFromScratch}
          className="
            fixed bottom-8 right-8
            flex items-center gap-2 px-6 py-3
            text-sm font-semibold text-gray-700
            bg-white border-2 border-gray-300 rounded-full
            hover:border-rose-300 hover:bg-rose-50
            shadow-lg hover:shadow-xl
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2
          "
        >
          <span className="text-xl">+</span>
          <span>Tạo từ đầu</span>
        </motion.button>
      </div>
    </div>
  );
}
