'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function LostAnalyticsPanel() {
  const lostStats = {
    totalLost: 24,
    byStage: {
      quotation: 8,
      negotiation: 6,
      test_drive: 4,
      commitment: 3,
      other: 3,
    },
    topReasons: [
      { reason: 'price_too_high', count: 9, percentage: 37.5 },
      { reason: 'competitor_better_offer', count: 7, percentage: 29.2 },
      { reason: 'not_ready', count: 5, percentage: 20.8 },
    ],
    topCompetitors: [
      { brand: 'Toyota', count: 5 },
      { brand: 'Honda', count: 3 },
      { brand: 'Mazda', count: 2 },
    ],
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Mất khách theo giai đoạn</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(lostStats.byStage).map(([stage, count]) => (
              <div key={stage} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground capitalize">{stage}</span>
                <Badge variant="outline">{count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nguyên nhân chính</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {lostStats.topReasons.map((reason) => (
              <div key={reason.reason}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{reason.reason}</span>
                  <span className="font-semibold">{reason.count} ({reason.percentage}%)</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${reason.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-orange-900">Đối thủ cạnh tranh</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {lostStats.topCompetitors.map((competitor) => (
              <div key={competitor.brand} className="flex items-center justify-between p-2 bg-white rounded">
                <span className="font-semibold">{competitor.brand}</span>
                <Badge variant="destructive">{competitor.count} khách</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
