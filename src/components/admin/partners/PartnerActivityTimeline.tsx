'use client';

import { useState, useEffect } from 'react';
import { 
  Activity, 
  Key, 
  Settings, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  TrendingUp,
  RefreshCw,
  Download,
  Search,
  Filter,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type EventType = 'api_call' | 'key_rotation' | 'config_change' | 'scope_update' | 'error' | 'webhook' | 'all';

interface ActivityEvent {
  id: string;
  event_type: EventType;
  timestamp: Date;
  title: string;
  description: string;
  status: 'success' | 'warning' | 'error' | 'info';
  metadata?: {
    method?: string;
    endpoint?: string;
    status_code?: number;
    response_time_ms?: number;
    old_value?: string;
    new_value?: string;
    user?: string;
    [key: string]: unknown;
  };
}

interface ActivityStats {
  total_events: number;
  success_count: number;
  error_count: number;
  success_rate: number;
}

interface PartnerActivityTimelineProps {
  partnerId: string;
  partnerName: string;
  maxHeight?: string;
}

export function PartnerActivityTimeline({
  partnerId,
  partnerName,
  maxHeight = '600px',
}: PartnerActivityTimelineProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [stats, setStats] = useState<ActivityStats>({
    total_events: 0,
    success_count: 0,
    error_count: 0,
    success_rate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState<EventType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  // Fetch activity data
  const fetchActivity = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (eventTypeFilter !== 'all') params.set('event_type', eventTypeFilter);
      if (dateRange !== 'all') params.set('date_range', dateRange);
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/admin/partners/${partnerId}/activity?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch activity');
      }

      const data = await response.json();
      
      // Convert date strings to Date objects
      const parsedEvents: ActivityEvent[] = data.data.events.map((event: unknown) => ({
        ...event,
        timestamp: new Date(event.timestamp),
      }));

      setEvents(parsedEvents);
      setStats(data.data.stats);
    } catch (error) {
      console.error('Fetch activity error:', error);
      toast.error('Không thể tải activity timeline', {
        description: 'Vui lòng thử lại sau',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, [partnerId, eventTypeFilter, dateRange, searchQuery]);

  // Export to CSV
  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (eventTypeFilter !== 'all') params.set('event_type', eventTypeFilter);
      if (dateRange !== 'all') params.set('date_range', dateRange);
      
      const response = await fetch(`/api/admin/partners/${partnerId}/activity/export?${params}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${partnerName}-activity-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Activity timeline đã được export');
    } catch (error) {
      toast.error('Không thể export timeline');
    }
  };

  // Get event icon
  const getEventIcon = (eventType: EventType, status: string) => {
    switch (eventType) {
      case 'api_call':
        return status === 'error' ? (
          <XCircle className="w-4 h-4" />
        ) : (
          <Activity className="w-4 h-4" />
        );
      case 'key_rotation':
        return <Key className="w-4 h-4" />;
      case 'config_change':
        return <Settings className="w-4 h-4" />;
      case 'scope_update':
        return <Shield className="w-4 h-4" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4" />;
      case 'webhook':
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900';
      case 'warning':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900';
      case 'error':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900';
      default:
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900';
    }
  };

  // Get event type label
  const getEventTypeLabel = (eventType: EventType) => {
    switch (eventType) {
      case 'api_call':
        return 'API Call';
      case 'key_rotation':
        return 'Key Rotation';
      case 'config_change':
        return 'Config Change';
      case 'scope_update':
        return 'Scope Update';
      case 'error':
        return 'Error';
      case 'webhook':
        return 'Webhook';
      default:
        return 'Activity';
    }
  };

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const dateKey = format(event.timestamp, 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, ActivityEvent[]>);

  const sortedDates = Object.keys(groupedEvents).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            Activity Timeline
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Theo dõi tất cả hoạt động của <span className="font-medium">{partnerName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchActivity}
            disabled={loading}
            className="h-9 rounded-xl border-gray-200 dark:border-gray-800"
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
            Làm mới
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            className="h-9 rounded-xl border-gray-200 dark:border-gray-800"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards - Bella ERP Style */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Tổng Events</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {stats.total_events}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Thành công</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {stats.success_count}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 border border-red-200 dark:border-red-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Lỗi</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {stats.error_count}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border border-blue-200 dark:border-blue-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Success Rate</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {stats.success_rate.toFixed(1)}%
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters - Bella ERP Style */}
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Tìm kiếm activity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-lg border-gray-200 dark:border-gray-800"
            />
          </div>

          {/* Event Type Filter */}
          <Select value={eventTypeFilter} onValueChange={(value) => setEventTypeFilter(value as EventType)}>
            <SelectTrigger className="w-full lg:w-[180px] h-10 rounded-lg border-gray-200 dark:border-gray-800">
              <SelectValue placeholder="Loại event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả events</SelectItem>
              <SelectItem value="api_call">API Calls</SelectItem>
              <SelectItem value="key_rotation">Key Rotations</SelectItem>
              <SelectItem value="config_change">Config Changes</SelectItem>
              <SelectItem value="scope_update">Scope Updates</SelectItem>
              <SelectItem value="webhook">Webhooks</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <Select value={dateRange} onValueChange={(value) => setDateRange(value as unknown)}>
            <SelectTrigger className="w-full lg:w-[150px] h-10 rounded-lg border-gray-200 dark:border-gray-800">
              <SelectValue placeholder="Khoảng thời gian" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 giờ qua</SelectItem>
              <SelectItem value="7d">7 ngày qua</SelectItem>
              <SelectItem value="30d">30 ngày qua</SelectItem>
              <SelectItem value="all">Tất cả</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Timeline */}
      <div
        className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm overflow-y-auto"
        style={{ maxHeight }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải activity...</p>
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Activity className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Không có activity nào</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Thử thay đổi bộ lọc hoặc khoảng thời gian
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((dateKey) => (
              <div key={dateKey}>
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-900 rounded-lg">
                    <CalendarIcon className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {format(new Date(dateKey), 'dd/MM/yyyy', { locale: vi })}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                </div>

                {/* Events for this date */}
                <div className="space-y-3 relative">
                  {/* Vertical timeline line */}
                  <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-800" />

                  {groupedEvents[dateKey].map((event, index) => (
                    <div key={event.id} className="relative pl-12">
                      {/* Timeline node */}
                      <div
                        className={cn(
                          'absolute left-2.5 top-2 w-5 h-5 rounded-full border-2 flex items-center justify-center',
                          getStatusColor(event.status)
                        )}
                      >
                        {getEventIcon(event.event_type, event.status)}
                      </div>

                      {/* Event card */}
                      <div
                        className={cn(
                          'p-3 rounded-lg border hover:shadow-md transition-all',
                          getStatusColor(event.status)
                        )}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-semibold">{event.title}</h4>
                              <span className="text-xs px-2 py-0.5 bg-white dark:bg-gray-900 rounded">
                                {getEventTypeLabel(event.event_type)}
                              </span>
                            </div>
                            <p className="text-xs opacity-90">{event.description}</p>
                          </div>
                          <span className="text-xs opacity-75 shrink-0 ml-3">
                            {format(event.timestamp, 'HH:mm:ss')}
                          </span>
                        </div>

                        {/* Metadata */}
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <div className="mt-2 pt-2 border-t border-current/10">
                            <div className="flex flex-wrap gap-2 text-xs">
                              {event.metadata.method && (
                                <span className="px-2 py-1 bg-white dark:bg-gray-900 rounded">
                                  {event.metadata.method}
                                </span>
                              )}
                              {event.metadata.endpoint && (
                                <span className="px-2 py-1 bg-white dark:bg-gray-900 rounded font-mono">
                                  {event.metadata.endpoint}
                                </span>
                              )}
                              {event.metadata.status_code && (
                                <span className="px-2 py-1 bg-white dark:bg-gray-900 rounded">
                                  Status: {event.metadata.status_code}
                                </span>
                              )}
                              {event.metadata.response_time_ms && (
                                <span className="px-2 py-1 bg-white dark:bg-gray-900 rounded">
                                  {event.metadata.response_time_ms}ms
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Relative time */}
                        <div className="mt-2 text-xs opacity-75">
                          {formatDistanceToNow(event.timestamp, { addSuffix: true, locale: vi })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
