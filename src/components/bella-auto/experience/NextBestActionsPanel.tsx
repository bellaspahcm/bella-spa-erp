'use client';

import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Target } from 'lucide-react';

interface Props {
  limit?: number;
  priorityFilter?: 'critical' | 'high' | 'medium' | 'low';
}

export function NextBestActionsPanel({ limit = 10, priorityFilter }: Props) {
  const actions = [
    {
      id: '1',
      customer: 'Nguyễn Văn A',
      title: 'Gọi điện chăm sóc báo giá',
      description: 'Khách nhận báo giá 5 ngày trước chưa phản hồi',
      priority: 'high' as const,
      confidenceScore: 0.85,
    },
    {
      id: '2',
      customer: 'Trần Thị B',
      title: 'Khách không hài lòng - Liên hệ ngay',
      description: 'NPS 4/10. Lý do: "Giá hơi cao"',
      priority: 'critical' as const,
      confidenceScore: 1.0,
    },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-3">
      {actions.map((action) => (
        <div key={action.id} className="p-4 border rounded-lg hover:bg-gray-50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={getPriorityColor(action.priority)}>
                  {action.priority.toUpperCase()}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  AI Confidence: {Math.round(action.confidenceScore * 100)}%
                </span>
              </div>
              <div className="font-semibold">{action.customer}</div>
              <div className="text-sm font-medium mt-1">{action.title}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {action.description}
              </div>
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 whitespace-nowrap">
              Thực hiện
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
