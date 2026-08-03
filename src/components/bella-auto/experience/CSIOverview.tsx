'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingUp } from 'lucide-react';

export function CSIOverview() {
  // Mock data
  const csiData = {
    overall: 4.3,
    totalResponses: 142,
    dimensions: [
      { name: 'Tư vấn bán hàng', score: 4.5, trend: 0.2 },
      { name: 'Cơ sở vật chất', score: 4.2, trend: 0.1 },
      { name: 'Thời gian giao xe', score: 3.9, trend: -0.1 },
      { name: 'Chất lượng xe', score: 4.6, trend: 0.3 },
      { name: 'Dịch vụ hậu mãi', score: 4.1, trend: 0.0 },
    ],
  };

  const consultants = [
    { name: 'Nguyễn Văn A', avgCSI: 4.7, surveys: 28 },
    { name: 'Trần Thị B', avgCSI: 4.5, surveys: 35 },
    { name: 'Lê Văn C', avgCSI: 4.2, surveys: 22 },
    { name: 'Phạm Thị D', avgCSI: 4.4, surveys: 31 },
    { name: 'Hoàng Văn E', avgCSI: 3.9, surveys: 26 },
  ];

  const lowCSICases = [
    {
      id: '1',
      customer: 'Khách hàng X',
      overallCSI: 2.8,
      lowestDimension: 'Thời gian giao xe',
      lowestScore: 2.0,
      feedback: 'Giao xe chậm hơn hẹn 2 tuần',
      consultant: 'Nguyễn Văn A',
    },
    {
      id: '2',
      customer: 'Khách hàng Y',
      overallCSI: 2.5,
      lowestDimension: 'Tư vấn bán hàng',
      lowestScore: 1.5,
      feedback: 'Tư vấn không nhiệt tình, thiếu kiến thức sản phẩm',
      consultant: 'Hoàng Văn E',
    },
  ];

  const getRatingColor = (score: number) => {
    if (score >= 4.5) return 'text-green-600';
    if (score >= 4.0) return 'text-blue-600';
    if (score >= 3.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStars = (score: number) => {
    return Array.from({ length: 5 }, (_, i) => i + 1).map((star) => (
      <Star
        key={star}
        className={`h-4 w-4 ${
          star <= Math.round(score)
            ? 'fill-yellow-400 text-yellow-400'
            : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className="space-y-6">
      {/* Overall CSI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Customer Satisfaction Index (CSI)</CardTitle>
            <CardDescription>
              Chỉ số hài lòng tổng hợp theo 5 chiều đo lường
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className="text-6xl font-bold text-blue-600">
                  {csiData.overall}
                </div>
                <div className="flex items-center justify-center gap-1 mt-2">
                  {getStars(csiData.overall)}
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  Trên thang điểm 5
                </div>
              </div>

              <div className="flex-1 space-y-4">
                {csiData.dimensions.map((dim) => (
                  <div key={dim.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{dim.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${getRatingColor(dim.score)}`}>
                          {dim.score}/5
                        </span>
                        {dim.trend !== 0 && (
                          <span
                            className={`text-xs ${
                              dim.trend > 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {dim.trend > 0 ? '+' : ''}{dim.trend}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          dim.score >= 4.5
                            ? 'bg-green-500'
                            : dim.score >= 4.0
                            ? 'bg-blue-500'
                            : dim.score >= 3.5
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${(dim.score / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t text-sm text-muted-foreground">
              Tổng số khảo sát: {csiData.totalResponses} phản hồi
            </div>
          </CardContent>
        </Card>

        {/* CSI Interpretation */}
        <Card>
          <CardHeader>
            <CardTitle>Đánh giá</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Badge variant="default" className="bg-blue-600">
                  Khá tốt
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  CSI 4.3/5 = 86% satisfaction
                </p>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Thang đánh giá:
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-8 bg-green-500 rounded" />
                    4.5-5.0: Xuất sắc
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-8 bg-blue-500 rounded" />
                    4.0-4.4: Tốt
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-8 bg-yellow-500 rounded" />
                    3.5-3.9: Trung bình
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-8 bg-red-500 rounded" />
                    {'<'} 3.5: Kém
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="text-xs text-muted-foreground">
                  Mục tiêu công ty: {'≥'} 4.5/5
                </div>
                <div className="text-xs text-red-600 font-medium mt-1">
                  Cần cải thiện thêm 0.2 điểm
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Consultant Performance */}
      <Card>
        <CardHeader>
          <CardTitle>CSI theo Tư vấn viên (Top 5)</CardTitle>
          <CardDescription>
            Xếp hạng dựa trên điểm CSI trung bình
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {consultants.map((consultant, index) => (
              <div
                key={consultant.name}
                className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{consultant.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {consultant.surveys} khảo sát
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${getRatingColor(consultant.avgCSI)}`}>
                    {consultant.avgCSI}
                  </div>
                  <div className="flex items-center gap-1 justify-end">
                    {getStars(consultant.avgCSI)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Low CSI Alert */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-orange-900">
            Trường hợp CSI thấp cần xử lý
          </CardTitle>
          <CardDescription>
            {lowCSICases.length} khách hàng đánh giá dưới 3.0/5
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {lowCSICases.map((caseItem) => (
              <div
                key={caseItem.id}
                className="p-4 bg-white border border-orange-200 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{caseItem.customer}</span>
                      <Badge variant="destructive">
                        CSI: {caseItem.overallCSI}/5
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="text-red-600">
                        ⚠ Chiều yếu nhất: {caseItem.lowestDimension} ({caseItem.lowestScore}/5)
                      </div>
                      <div className="text-muted-foreground">
                        Phản hồi: "{caseItem.feedback}"
                      </div>
                      <div className="text-muted-foreground">
                        Tư vấn viên: {caseItem.consultant}
                      </div>
                    </div>
                  </div>
                  <button className="px-4 py-2 text-sm bg-orange-600 text-white rounded hover:bg-orange-700">
                    Liên hệ khắc phục
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Improvement Opportunities */}
      <Card>
        <CardHeader>
          <CardTitle>Cơ hội cải thiện</CardTitle>
          <CardDescription>
            Chiều đo có điểm thấp nhất cần ưu tiên
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50">
              <div className="font-semibold text-yellow-900">
                Thời gian giao xe (3.9/5)
              </div>
              <div className="text-sm text-yellow-800 mt-1">
                Đề xuất: Cải thiện quy trình quản lý inventory và logistics để giảm thời gian giao xe
              </div>
            </div>
            <div className="p-4 border-l-4 border-blue-500 bg-blue-50">
              <div className="font-semibold text-blue-900">
                Dịch vụ hậu mãi (4.1/5)
              </div>
              <div className="text-sm text-blue-800 mt-1">
                Đề xuất: Tăng cường training cho đội ngũ service và cải thiện thời gian phản hồi
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
