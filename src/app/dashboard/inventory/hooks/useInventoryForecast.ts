/**
 * Inventory Forecast Hook
 * 
 * Fetches projected inventory shortages based on upcoming bookings.
 * 
 * **Usage:**
 * ```tsx
 * const { forecast, loading, error, refresh } = useInventoryForecast(30);
 * 
 * if (forecast.length > 0) {
 *   <Badge color="red">{forecast.length} items sắp hết</Badge>
 * }
 * ```
 */

import { useEffect, useState, useCallback } from 'react';

export interface ForecastItem {
  productId: string;
  productName: string;
  currentStock: number;
  projectedUsage: number;
  shortage: number;
  daysUntilShortage: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

interface ForecastResponse {
  success: boolean;
  forecast: ForecastItem[];
  totalBookings: number;
  forecastPeriodDays: number;
  error?: string;
}

export function useInventoryForecast(days: number = 30) {
  const [forecast, setForecast] = useState<ForecastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{ totalBookings: number; forecastPeriodDays: number } | null>(null);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/inventory/forecast?days=${days}`);
      const data: ForecastResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (data.success) {
        setForecast(data.forecast);
        setMetadata({
          totalBookings: data.totalBookings,
          forecastPeriodDays: data.forecastPeriodDays,
        });
        setError(null);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: unknown) {
      console.error('[useInventoryForecast] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch forecast');
      setForecast([]);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void fetchForecast();
  }, [fetchForecast]);

  return {
    forecast,
    loading,
    error,
    metadata,
    refresh: fetchForecast,
    
    // Computed values
    totalShortage: forecast.reduce((sum, item) => sum + item.shortage, 0),
    criticalCount: forecast.filter(item => item.urgency === 'critical').length,
    highCount: forecast.filter(item => item.urgency === 'high').length,
  };
}
