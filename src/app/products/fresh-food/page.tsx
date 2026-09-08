/**
 * Fresh Food Product Management Page
 * 
 * Manages perishable products with batch/expiry tracking
 * Integrates with Retail OS R1 (Product Catalog) + R4 (Batch/Lot Tracking)
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { FreshFoodCatalogService } from '@/products/bella-fresh-food/services/fresh-food-catalog.service';

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  basePrice: number;
  category: string;
}

interface Batch {
  id: string;
  productId: string;
  batchNumber: string;
  lotNumber?: string;
  manufacturedDate?: string;
  expiryDate: string;
  initialStock: number;
  currentStock: number;
}

export default function FreshFoodPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    description: '',
    basePrice: 0,
    category: 'dairy',
    shelfLifeDays: 7,
    unit: 'units'
  });
  const [batchForm, setBatchForm] = useState({
    batchNumber: '',
    lotNumber: '',
    manufacturedDate: '',
    expiryDate: '',
    quantity: 0,
    supplierId: '',
    notes: ''
  });

  const supabase = createClient();
  const service = new FreshFoodCatalogService(supabase);

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  // Load batches when product selected
  useEffect(() => {
    if (selectedProduct) {
      loadBatches(selectedProduct.id);
    }
  }, [selectedProduct]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      // Direct query for now
      const { data, error } = await supabase
        .from('retail_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform DB schema (snake_case) to app types (camelCase)
      const transformed: Product[] = (data || []).map(row => ({
        id: row.id,
        sku: row.sku,
        name: row.name,
        description: row.description || undefined,
        basePrice: row.base_price,
        category: row.category
      }));
      
      setProducts(transformed);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadBatches = async (productId: string) => {
    try {
      const result = await service.getProductWithBatches(
        '00000000-0000-0000-0000-000000000001', // TODO: Get from auth context
        productId
      );
      
      // Transform service BatchLot to app Batch type
      const transformed: Batch[] = result.batches.map(batch => ({
        id: batch.id,
        productId: batch.productId,
        batchNumber: batch.batchNumber,
        lotNumber: batch.lotNumber || undefined,
        manufacturedDate: batch.manufacturedDate || undefined,
        expiryDate: batch.expiryDate,
        initialStock: batch.initialStock,
        currentStock: batch.currentStock
      }));
      
      setBatches(transformed);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const product = await service.createProduct({
        tenantId: '00000000-0000-0000-0000-000000000001',
        sku: productForm.sku,
        name: productForm.name,
        description: productForm.description,
        basePrice: productForm.basePrice,
        category: productForm.category as any,
        shelfLifeDays: productForm.shelfLifeDays,
        unit: productForm.unit
      });
      
      setProducts([product, ...products]);
      setShowCreateProduct(false);
      setProductForm({ sku: '', name: '', description: '', basePrice: 0, category: 'dairy', shelfLifeDays: 7, unit: 'units' });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      const batch = await service.receiveBatch({
        tenantId: '00000000-0000-0000-0000-000000000001',
        productId: selectedProduct.id,
        batchNumber: batchForm.batchNumber,
        lotNumber: batchForm.lotNumber || undefined,
        manufacturedDate: batchForm.manufacturedDate || undefined,
        expiryDate: batchForm.expiryDate,
        quantity: batchForm.quantity,
        supplierId: batchForm.supplierId || undefined,
        notes: batchForm.notes || undefined
      });

      // Transform service BatchLot to app Batch type
      const transformed: Batch = {
        id: batch.id,
        productId: batch.productId,
        batchNumber: batch.batchNumber,
        lotNumber: batch.lotNumber || undefined,
        manufacturedDate: batch.manufacturedDate || undefined,
        expiryDate: batch.expiryDate,
        initialStock: batch.initialStock,
        currentStock: batch.currentStock
      };

      setBatches([transformed, ...batches]);
      setShowCreateBatch(false);
      setBatchForm({ batchNumber: '', lotNumber: '', manufacturedDate: '', expiryDate: '', quantity: 0, supplierId: '', notes: '' });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getDaysUntilExpiry = (expiryDate: string): number => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const getExpiryColor = (days: number): string => {
    if (days < 0) return 'text-red-700 bg-red-50';
    if (days <= 3) return 'text-red-600 bg-red-50';
    if (days <= 7) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading Fresh Food Catalog...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Fresh Food & Grocery Catalog</h1>
        <p className="text-gray-600">Manage perishable products with batch/expiry tracking (FEFO)</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Products List */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Products</h2>
            <button
              onClick={() => setShowCreateProduct(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              + New Product
            </button>
          </div>

          {showCreateProduct && (
            <form onSubmit={handleCreateProduct} className="mb-4 p-4 bg-gray-50 rounded">
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="SKU"
                  value={productForm.sku}
                  onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
                <input
                  type="text"
                  placeholder="Product Name"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
                <input
                  type="number"
                  placeholder="Base Price"
                  value={productForm.basePrice}
                  onChange={(e) => setProductForm({ ...productForm, basePrice: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded"
                  required
                  step="0.01"
                />
                <select
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="dairy">Dairy</option>
                  <option value="produce">Produce</option>
                  <option value="meat">Meat</option>
                  <option value="bakery">Bakery</option>
                  <option value="seafood">Seafood</option>
                  <option value="deli">Deli</option>
                  <option value="frozen">Frozen</option>
                </select>
                <input
                  type="number"
                  placeholder="Shelf Life (days)"
                  value={productForm.shelfLifeDays}
                  onChange={(e) => setProductForm({ ...productForm, shelfLifeDays: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded"
                  required
                  min="1"
                />
                <div className="flex gap-2">
                  <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateProduct(false)}
                    className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {products.map((product) => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className={`p-4 border rounded cursor-pointer hover:bg-gray-50 ${
                  selectedProduct?.id === product.id ? 'border-blue-500 bg-blue-50' : ''
                }`}
              >
                <div className="font-semibold">{product.name}</div>
                <div className="text-sm text-gray-600">SKU: {product.sku}</div>
                <div className="text-sm text-gray-600">Price: ${product.basePrice.toFixed(2)}</div>
                <div className="text-xs text-gray-500 mt-1">{product.category}</div>
              </div>
            ))}
            {products.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No products yet. Create your first product!
              </div>
            )}
          </div>
        </div>

        {/* Batches List */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Batches (FEFO) {selectedProduct && `- ${selectedProduct.name}`}
            </h2>
            {selectedProduct && (
              <button
                onClick={() => setShowCreateBatch(true)}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                + Receive Batch
              </button>
            )}
          </div>

          {!selectedProduct ? (
            <div className="text-center text-gray-500 py-8">
              Select a product to view batches
            </div>
          ) : (
            <>
              {showCreateBatch && (
                <form onSubmit={handleCreateBatch} className="mb-4 p-4 bg-gray-50 rounded">
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Batch Number (e.g., MILK-20260906-001)"
                      value={batchForm.batchNumber}
                      onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Lot Number (optional)"
                      value={batchForm.lotNumber}
                      onChange={(e) => setBatchForm({ ...batchForm, lotNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    />
                    <input
                      type="date"
                      placeholder="Manufactured Date (optional)"
                      value={batchForm.manufacturedDate}
                      onChange={(e) => setBatchForm({ ...batchForm, manufacturedDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    />
                    <input
                      type="date"
                      placeholder="Expiry Date"
                      value={batchForm.expiryDate}
                      onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Quantity"
                      value={batchForm.quantity}
                      onChange={(e) => setBatchForm({ ...batchForm, quantity: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded"
                      required
                      min="1"
                    />
                    <input
                      type="text"
                      placeholder="Supplier ID (optional)"
                      value={batchForm.supplierId}
                      onChange={(e) => setBatchForm({ ...batchForm, supplierId: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    />
                    <textarea
                      placeholder="Notes (optional)"
                      value={batchForm.notes}
                      onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                        Receive Batch
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCreateBatch(false)}
                        className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {batches.map((batch) => {
                  const daysUntilExpiry = getDaysUntilExpiry(batch.expiryDate);
                  const expiryColor = getExpiryColor(daysUntilExpiry);
                  
                  return (
                    <div key={batch.id} className={`p-4 border rounded ${expiryColor}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold">{batch.batchNumber}</div>
                          {batch.lotNumber && (
                            <div className="text-sm text-gray-600">Lot: {batch.lotNumber}</div>
                          )}
                          <div className="text-sm mt-1">
                            Expiry: {new Date(batch.expiryDate).toLocaleDateString()}
                          </div>
                          <div className="text-xs font-semibold mt-1">
                            {daysUntilExpiry < 0 ? (
                              <span className="text-red-700">EXPIRED ({Math.abs(daysUntilExpiry)} days ago)</span>
                            ) : daysUntilExpiry === 0 ? (
                              <span className="text-red-700">EXPIRES TODAY</span>
                            ) : (
                              <span>{daysUntilExpiry} days until expiry</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold">
                            {batch.currentStock} / {batch.initialStock}
                          </div>
                          <div className="text-xs text-gray-600">units</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {batches.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No batches yet. Receive your first batch!
                  </div>
                )}
              </div>

              {batches.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded">
                  <div className="text-sm font-semibold text-blue-900 mb-1">FEFO Logic Active</div>
                  <div className="text-xs text-blue-700">
                    Batches sorted by expiry date. Always sell from earliest expiring batch first.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
