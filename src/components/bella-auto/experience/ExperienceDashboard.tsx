'use client';

/**
 * Experience Dashboard Component
 * Main dashboard for customer experience metrics
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NPSOverview } from './NPSOverview';
import { CSIOverview } from './CSIOverview';
import { CustomerHealthScores } from './CustomerHealthScores';
import { NextBestActionsPanel } from './NextBestActionsPanel';
import { LostAnalyticsPanel } from './LostAnalyticsPanel';
import { TrendChart } from './TrendChart';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ExperienceDashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const handleRefresh = async () => {
    setIsLoading(true);
    // Trigger data refresh
    setTimeout(() => {
      setIsLoading(false);
      setLastRefresh(new Date());
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Cập nhật lần cuối: {lastRefresh.toLocaleTimeString('vi-VN')}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="nps">NPS</TabsTrigger>
          <TabsTrigger value="csi">CSI</TabsTrigger>
          <TabsTrigger value="health">Sức khỏe KH</TabsTrigger>
          <TabsTrigger value="actions">Hành động</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  NPS Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">+42</div>
                <p className="text-xs text-muted-foreground mt-1">
                  +5 so với tháng trước
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  CSI Average
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">4.3/5</div>
                <p className="text-xs text-muted-foreground mt-1">
                  86% hài lòng
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  At Risk Customers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">12</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cần chăm sóc ngay
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pending Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">28</div>
                <p className="text-xs text-muted-foreground mt-1">
                  8 ưu tiên cao
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>NPS Trend (6 tháng)</CardTitle>
                <CardDescription>
                  Xu hướng Net Promoter Score
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={[
                    { month: 'T1', value: 35 },
                    { month: 'T2', value: 38 },
                    { month: 'T3', value: 37 },
                    { month: 'T4', value: 40 },
                    { month: 'T5', value: 37 },
                    { month: 'T6', value: 42 },
                  ]}
                  color="green"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>CSI by Dimension</CardTitle>
                <CardDescription>
                  Điểm hài lòng theo từng chiều
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: 'Tư vấn bán hàng', score: 4.5 },
                    { label: 'Cơ sở vật chất', score: 4.2 },
                    { label: 'Thời gian giao xe', score: 3.9 },
                    { label: 'Chất lượng xe', score: 4.6 },
                    { label: 'Dịch vụ hậu mãi', score: 4.1 },
                  ].map((dim) => (
                    <div key={dim.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{dim.label}</span>
                        <span className="font-semibold">{dim.score}/5</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${(dim.score / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Next Best Actions Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Hành động ưu tiên cao (Top 5)</CardTitle>
              <CardDescription>
                AI recommendations cần xử lý ngay
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NextBestActionsPanel limit={5} priorityFilter="high" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* NPS Tab */}
        <TabsContent value="nps" className="space-y-6">
          <NPSOverview />
        </TabsContent>

        {/* CSI Tab */}
        <TabsContent value="csi" className="space-y-6">
          <CSIOverview />
        </TabsContent>

        {/* Health Scores Tab */}
        <TabsContent value="health" className="space-y-6">
          <CustomerHealthScores />
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Next Best Actions</h3>
              <NextBestActionsPanel />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Lost Analysis</h3>
              <LostAnalyticsPanel />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
