'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, Search, RefreshCw, TrendingUp, Package, Star } from 'lucide-react';
import { 
  useServiceRecommendations,
  usePackageRecommendations,
  useUpsellRecommendations
} from '@/hooks/intelligence/use-recommendation';

export default function RecommendationsPage() {
  const [customerId, setCustomerId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [algorithm, setAlgorithm] = useState<'hybrid' | 'collaborative_filtering' | 'content_based' | 'rfm_based'>('hybrid');
  const [limit, setLimit] = useState(5);
  const [budget, setBudget] = useState(5000000);

  const tenantId = 'bella-spa';

  // Fetch recommendations
  const serviceRecommendations = useServiceRecommendations({
    tenantId,
    customerId: searchTerm,
    algorithm,
    limit,
    enabled: !!searchTerm
  });

  const packageRecommendations = usePackageRecommendations({
    tenantId,
    customerId: searchTerm,
    limit,
    budget,
    enabled: !!searchTerm
  });

  const upsellRecommendations = useUpsellRecommendations({
    tenantId,
    customerId: searchTerm,
    limit,
    enabled: !!searchTerm
  });

  const handleSearch = () => {
    if (customerId.trim()) {
      setSearchTerm(customerId.trim());
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="w-8 h-8 text-primary" />
            Recommendation Engine
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered service, package, and upsell recommendations
          </p>
        </div>
      </div>

      {/* Search Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Search</CardTitle>
          <CardDescription>Enter customer ID to get personalized recommendations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Customer ID</label>
              <Input
                placeholder="Enter customer ID..."
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="w-48">
              <label className="text-sm font-medium mb-2 block">Algorithm</label>
              <Select value={algorithm} onValueChange={(v) => v && setAlgorithm(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="collaborative_filtering">Collaborative Filtering</SelectItem>
                  <SelectItem value="content_based">Content-Based</SelectItem>
                  <SelectItem value="rfm_based">RFM-Based</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <label className="text-sm font-medium mb-2 block">Limit</label>
              <Select value={limit.toString()} onValueChange={(v) => v && setLimit(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="pt-7">
              <Button onClick={handleSearch} disabled={!customerId.trim()}>
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Tabs */}
      {searchTerm && (
        <Tabs defaultValue="service" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="service" className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              Service Recommendations
            </TabsTrigger>
            <TabsTrigger value="package" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Package Recommendations
            </TabsTrigger>
            <TabsTrigger value="upsell" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Upsell Recommendations
            </TabsTrigger>
          </TabsList>

          {/* Service Recommendations Tab */}
          <TabsContent value="service" className="space-y-6">
            {/* Summary Cards */}
            {serviceRecommendations.data?.data && serviceRecommendations.data.data.length > 0 && (
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {serviceRecommendations.data.data.length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Gợi ý dịch vụ
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Algorithm
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-bold">
                      {serviceRecommendations.data.metadata.algorithm || algorithm}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Thuật toán sử dụng
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Cache Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-bold">
                      {serviceRecommendations.data.metadata.cached ? 'Cached' : 'Fresh'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {serviceRecommendations.data.metadata.execution_time_ms}ms
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Service Recommendations List */}
            <Card>
              <CardHeader>
                <CardTitle>Recommended Services</CardTitle>
                <CardDescription>
                  Top {limit} services for this customer
                </CardDescription>
              </CardHeader>
              <CardContent>
                {serviceRecommendations.isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Analyzing...
                  </div>
                ) : serviceRecommendations.data?.data && serviceRecommendations.data.data.length > 0 ? (
                  <div className="space-y-3">
                    {serviceRecommendations.data.data.map((rec) => (
                      <div 
                        key={rec.recommended_item_id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                            #{rec.rank_position}
                          </div>
                          <div>
                            <div className="font-semibold">{rec.item_name || rec.recommended_item_id}</div>
                            <div className="text-sm text-muted-foreground">
                              Algorithm: {rec.algorithm_used}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">
                            {(rec.relevance_score * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">Relevance</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>
                      No recommendations found for this customer.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Package Recommendations Tab */}
          <TabsContent value="package" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recommended Packages</CardTitle>
                <CardDescription>
                  Best package options for this customer (Budget: {budget.toLocaleString()} VND)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {packageRecommendations.isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Analyzing...
                  </div>
                ) : packageRecommendations.data?.data && packageRecommendations.data.data.length > 0 ? (
                  <div className="space-y-3">
                    {packageRecommendations.data.data.map((rec) => (
                      <div 
                        key={rec.recommended_item_id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                            #{rec.rank_position}
                          </div>
                          <div>
                            <div className="font-semibold">{rec.item_name || rec.recommended_item_id}</div>
                            <div className="text-sm text-muted-foreground">
                              Algorithm: {rec.algorithm_used}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">
                            {(rec.relevance_score * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">Relevance</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>
                      No package recommendations found for this customer.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upsell Recommendations Tab */}
          <TabsContent value="upsell" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upsell Recommendations</CardTitle>
                <CardDescription>
                  Cross-sell and upsell opportunities based on purchase history
                </CardDescription>
              </CardHeader>
              <CardContent>
                {upsellRecommendations.isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Analyzing...
                  </div>
                ) : upsellRecommendations.data?.data && upsellRecommendations.data.data.length > 0 ? (
                  <div className="space-y-3">
                    {upsellRecommendations.data.data.map((rec) => (
                      <div 
                        key={rec.recommended_item_id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                            #{rec.rank_position}
                          </div>
                          <div>
                            <div className="font-semibold">{rec.item_name || rec.recommended_item_id}</div>
                            <div className="text-sm text-muted-foreground">
                              Algorithm: {rec.algorithm_used}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">
                            {(rec.relevance_score * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">Relevance</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>
                      No upsell recommendations found for this customer.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {!searchTerm && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Enter a customer ID to get started</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
