import { Suspense } from 'react';
import { Metadata } from 'next';
import { ProductSalesListPage } from '@/components/product-sales/ProductSalesListPage';

export const metadata: Metadata = {
  title: 'Bán hàng sản phẩm | Bella ERP',
  description: 'Quản lý bán hàng sản phẩm và hoa hồng',
};

export default async function ProductSalesPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-96">
            <div className="animate-pulse text-gray-500">Đang tải...</div>
          </div>
        }
      >
        <ProductSalesListPage />
      </Suspense>
    </div>
  );
}
