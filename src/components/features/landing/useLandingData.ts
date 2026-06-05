'use client';

import { useEffect, useMemo, useState } from 'react';

import { createClient as createBrowserClient } from '@/lib/supabase-client';
import { filterActivePromotions, type Promotion } from '@/lib/promotions';

import {
  DEFAULT_SERVICE_CATEGORIES,
  cloneLandingCategories,
  createEmptyLandingCategories,
  getLandingCategoryForPackage,
  type LandingCategories,
  type LandingCategory,
  type LandingCategoryKey,
  type PackageRow,
} from './landing-data';

export type LandingDataLoadStatus = 'loaded' | 'fallback';

export function useLandingPackages() {
  const serviceCategories = DEFAULT_SERVICE_CATEGORIES;
  const [categories, setCategories] = useState<LandingCategories | null>(null);
  const [dataStatus, setDataStatus] = useState<LandingDataLoadStatus>('loaded');
  const [dataError, setDataError] = useState<string | null>(null);

  const serviceOptions = useMemo(() => {
    const activeCategories = categories || serviceCategories;
    return Object.values(activeCategories).flatMap((cat) => {
      return cat.packages.map((pkg) => ({
        value: pkg.name,
        label: `${pkg.name} (${pkg.price})`,
        group: cat.title,
      }));
    });
  }, [categories, serviceCategories]);

  useEffect(() => {
    const fetchActivePackages = async () => {
      try {
        const supabase = createBrowserClient();
        const { data, error } = await supabase
          .from('packages')
          .select('*')
          .eq('status', 'active')
          .order('name', { ascending: true });

        if (error) {
          console.error('Error fetching active packages:', error);
          setDataStatus('fallback');
          setDataError(error.message);
          return;
        }

        if (data && data.length > 0) {
          const newCategories = createEmptyLandingCategories();

          data.forEach((pkg: PackageRow) => {
            const catKey = getLandingCategoryForPackage(pkg);
            const formattedPrice = new Intl.NumberFormat('vi-VN').format(pkg.price || pkg.full_price || 0) + 'đ';

            newCategories[catKey].packages.push({
              id: pkg.id,
              name: pkg.name,
              price: formattedPrice,
              duration: pkg.duration || '90 phút',
              description: pkg.description || `Liệu trình ${pkg.total_sessions} buổi chăm sóc chuyên sâu chuẩn y khoa của Bella Spa.`,
              benefits: Array.isArray(pkg.details) && pkg.details.length > 0 ? pkg.details : ['Liệu trình chuẩn y khoa', 'Kỹ thuật viên tay nghề cao', 'Nguyên liệu thảo dược hữu cơ'],
              tag: pkg.offer || undefined,
            });
          });

          const finalCategories = cloneLandingCategories(serviceCategories);
          (Object.entries(newCategories) as Array<[LandingCategoryKey, LandingCategory]>).forEach(([key, category]) => {
            if (category.packages.length > 0) {
              finalCategories[key].packages = category.packages;
            }
          });

          setCategories(finalCategories);
          setDataStatus('loaded');
          setDataError(null);
          return;
        }

        setDataStatus('fallback');
        setDataError('No active packages returned from database.');
      } catch (err) {
        console.error('Fetch active packages error:', err);
        setDataStatus('fallback');
        setDataError(err instanceof Error ? err.message : 'Unknown package fetch error.');
      }
    };

    fetchActivePackages();
  }, [serviceCategories]);

  return {
    categories,
    dataError,
    dataStatus,
    serviceCategories,
    serviceOptions,
  };
}

export function useLandingPromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [dataStatus, setDataStatus] = useState<LandingDataLoadStatus>('loaded');
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        const supabase = createBrowserClient();
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        const { data, error } = await supabase
          .from('promotions')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching active promotions:', error);
          setDataStatus('fallback');
          setDataError(error.message);
          return;
        }

        setPromotions(data ? filterActivePromotions(data as Promotion[], todayStr) : []);
        setDataStatus('loaded');
        setDataError(null);
      } catch (err) {
        console.error('Fetch promotions error:', err);
        setDataStatus('fallback');
        setDataError(err instanceof Error ? err.message : 'Unknown promotions fetch error.');
      }
    };

    fetchPromotions();
  }, []);

  return {
    dataError,
    dataStatus,
    promotions,
  };
}
