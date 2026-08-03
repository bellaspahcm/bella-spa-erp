'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

export function NPSOverview() {
  // Mock data - replace with real API calls
  const npsData = {
    currentNPS: 42,
    previousNPS: 37,
    totalResponses: 156,
    promoters: 78,
    passives: 62,
    detractors: 16,
    promoterPercentage: 50.0,
    passivePercentage: 39.7,
    detractorPercentage: 10.3,
  };

  const trend = npsData.currentNPS - npsData.previousNPS;
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-600';

  const detractors = [
    {
      id: '1',
      customer: 'Nguyễn Văn A',
      score: 4,
      feedback: 'Giá hơi cao so với đối thủ',
      date: '2026-08-01',
      followedUp: false,
    },
    {
      id: '2',
      customer: 'Trần Thị B',
      score: 6,
      feedback: 'Thời gian giao xe lâu quá',
      date: '2026-07-30',
      followedUp: false,
    },
    {
      id: '3',
      customer: 'Lê Văn C',
      score: 5,
      feedback: 'Tư vấn viên chưa nhiệt tình',
      date: '2026-07-28',
      followedUp: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* NPS Score Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Net Promoter Score</CardTitle>
            <CardDescription>
              Đo lường khả năng khách hàng giới thiệu dịch vụ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-8">
              <div>
                <div className="text-6xl font-bold text-green-600">
                  {npsData.currentNPS > 0 ? '+' : ''}{npsData.currentNPS}
                </div>
                <div className={`flex items-center gap-2 mt-2 ${trendColor}`}>
                  <TrendIcon className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    {trend > 0 ? '+' : ''}{trend} điểm so với tháng trước
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-4">
                {/* Promoters */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-green-700 font-medium">
                      Promoters (9-10)
                    </span>
                    <span className="font-semibold">
                      {npsData.promoters} ({npsData.promoterPercentage}%)
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${npsData.promoterPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Passives */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-yellow-700 font-medium">
                      Passives (7-8)
                    </span>
                    <span className="font-semibold">
                      {npsData.passives} ({npsData.passivePercentage}%)
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500"
                      style={{ width: `${npsData.passivePercentage}%` }}
                    />
                  </div>
                </div>

                {/* Detractors */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-red-700 font-medium">
                      Detractors (0-6)
                    </span>
                    <span className="font-semibold">
                      {npsData.detractors} ({npsData.detractorPercentage}%)
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${npsData.detractorPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                Công thức: NPS = % Promoters - % Detractors
              </div>
              <div className="text-sm text-muted-foreground">
                Tổng số phản hồi: {npsData.totalResponses} khách hàng
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NPS Interpretation */}
        <Card>
          <CardHeader>
            <CardTitle>Đánh giá</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Badge variant="default" className="bg-green-600">
                  Tốt
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  NPS từ 30-70 được coi là tốt trong ngành automotive
                </p>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Thang đánh giá:
                </div>
                <div className="space-y-1 text-xs">
                  <div>{'>'} 70: Xuất sắc</div>
                  <div>30-70: Tốt</div>
                  <div>0-30: Cần cải thiện</div>
                  <div>{'<'} 0: Kém</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detractors Alert */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-red-900">
              Detractors cần follow-up ngay
            </CardTitle>
          </div>
          <CardDescription>
            {detractors.filter(d => !d.followedUp).length} khách hàng chưa được liên hệ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {detractors.map((detractor) => (
              <div
                key={detractor.id}
                className="flex items-start justify-between p-4 bg-white rounded-lg border"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{detractor.customer}</span>
                    <Badge variant="destructive">NPS: {detractor.score}/10</Badge>
                    {detractor.followedUp && (
                      <Badge variant="outline" className="text-green-600">
                        ✓ Đã liên hệ
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    "{detractor.feedback}"
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(detractor.date).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                {!detractor.followedUp && (
                  <button className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">
                    Gọi ngay
                  </button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* NPS by Source */}
      <Card>
        <CardHeader>
          <CardTitle>NPS theo nguồn khảo sát</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Sau giao xe</div>
              <div className="text-3xl font-bold text-green-600 mt-2">+45</div>
              <div className="text-xs text-muted-foreground mt-1">
                98 phản hồi
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Sau bảo dưỡng</div>
              <div className="text-3xl font-bold text-blue-600 mt-2">+38</div>
              <div className="text-xs text-muted-foreground mt-1">
                58 phản hồi
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
