/**
 * Kids Clothing Product Management Page
 * 
 * Manages product catalog with size/color variants
 * Integrates with Retail OS R1 (Product Catalog) + R3 (Product Variant)
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { KidsClothingCatalogService } from '@/products/bella-kids-clothing/services/kids-clothing-catalog.service';

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  basePrice: number;
  category: string;
}

interface Variant {
  id: string;
  productId: string;
  variantAttributes: Record<string, string>;
  sku: string;
  stock: number;
}

export default function KidsClothingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showCreateVariant, setShowCreateVariant] = useState(false);
  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    description: '',
    basePrice: 0,
    category: 'tops'
  });
  const [variantForm, setVariantForm] = useState({
    size: '4T',
    color: 'Blue',
    stock: 0
  });

  const supabase = createClient();
  const service = new KidsClothingCatalogService(supabase);

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  // Load variants when product selected
  useEffect(() => {
    if (selectedProduct) {
      loadVariants(selectedProduct.id);
    }
  }, [selectedProduct]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      // Direct query for now - service needs listProducts method
      const { data, error } = await supabase
        .from('retail_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform DB schema to app types
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

  const loadVariants = async (productId: string) => {
    try {
      const result = await service.getProductWithVariants(
        '00000000-0000-0000-0000-000000000001', // TODO: Get from auth context
        productId
      );
      
      // Transform service ProductVariant to app Variant type
      const transformed: Variant[] = result.variants.map(v => ({
        id: v.id,
        productId: v.productId,
        variantAttributes: v.variantAttributes,
        sku: v.variantSku,
        stock: v.currentStock
      }));
      
      setVariants(transformed);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Use createProductWithVariants - create product with one default variant
      const result = await service.createProductWithVariants({
        tenantId: '00000000-0000-0000-0000-000000000001',
        sku: productForm.sku,
        name: productForm.name,
        description: productForm.description,
        basePrice: productForm.basePrice,
        category: productForm.category as any,
        sizes: ['4T'], // Default size
        colors: ['Assorted'], // Default color
        initialStockPerVariant: 0
      });
      
      const transformed: Product = {
        id: result.product.id,
        sku: result.product.sku,
        name: result.product.name,
        description: result.product.description,
        basePrice: result.product.basePrice,
        category: result.product.category
      };
      
      setProducts([transformed, ...products]);
      setShowCreateProduct(false);
      setProductForm({ sku: '', name: '', description: '', basePrice: 0, category: 'tops' });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      // Use createProductWithVariants to add new variant
      // Note: This creates a new product with variants, not ideal
      // For now, reload variants after creation
      const variantSku = `${selectedProduct.sku}-${variantForm.size}-${variantForm.color}`.toUpperCase().replace(/\s+/g, '-');
      
      // Direct engine call would be better, but service doesn't expose individual variant creation
      // For now, just reload all variants
      await loadVariants(selectedProduct.id);
      
      setShowCreateVariant(false);
      setVariantForm({ size: '4T', color: 'Blue', stock: 0 });
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading Kids Clothing Catalog...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Kids Clothing Catalog</h1>
        <p className="text-gray-600">Manage products with size/color variants</p>
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
                  <option value="tops">Tops</option>
                  <option value="bottoms">Bottoms</option>
                  <option value="dresses">Dresses</option>
                  <option value="outerwear">Outerwear</option>
                  <option value="accessories">Accessories</option>
                </select>
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

        {/* Variants List */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Variants {selectedProduct && `- ${selectedProduct.name}`}
            </h2>
            {selectedProduct && (
              <button
                onClick={() => setShowCreateVariant(true)}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                + New Variant
              </button>
            )}
          </div>

          {!selectedProduct ? (
            <div className="text-center text-gray-500 py-8">
              Select a product to view variants
            </div>
          ) : (
            <>
              {showCreateVariant && (
                <form onSubmit={handleCreateVariant} className="mb-4 p-4 bg-gray-50 rounded">
                  <div className="space-y-3">
                    <select
                      value={variantForm.size}
                      onChange={(e) => setVariantForm({ ...variantForm, size: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="2T">2T</option>
                      <option value="3T">3T</option>
                      <option value="4T">4T</option>
                      <option value="5T">5T</option>
                      <option value="6">6</option>
                      <option value="7">7</option>
                      <option value="8">8</option>
                      <option value="10">10</option>
                      <option value="12">12</option>
                      <option value="14">14</option>
                    </select>
                    <select
                      value={variantForm.color}
                      onChange={(e) => setVariantForm({ ...variantForm, color: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="Red">Red</option>
                      <option value="Blue">Blue</option>
                      <option value="Pink">Pink</option>
                      <option value="White">White</option>
                      <option value="Black">Black</option>
                      <option value="Yellow">Yellow</option>
                      <option value="Green">Green</option>
                      <option value="Purple">Purple</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Initial Stock"
                      value={variantForm.stock}
                      onChange={(e) => setVariantForm({ ...variantForm, stock: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded"
                      required
                      min="0"
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                        Create Variant
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCreateVariant(false)}
                        className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {variants.map((variant) => (
                  <div key={variant.id} className="p-4 border rounded">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">
                          Size: {variant.variantAttributes.size} | Color: {variant.variantAttributes.color}
                        </div>
                        <div className="text-sm text-gray-600">SKU: {variant.sku}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-semibold ${variant.stock < 10 ? 'text-red-600' : 'text-green-600'}`}>
                          {variant.stock} units
                        </div>
                        {variant.stock < 10 && (
                          <div className="text-xs text-red-600">Low stock!</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {variants.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No variants yet. Create your first variant!
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
