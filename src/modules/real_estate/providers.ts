import { 
  OrganizationTreeProvider, 
  OrganizationMetricProvider, 
  OrganizationUnit, 
  MetricDefinition, 
  MetricValue,
  ProviderContext,
  ProviderMetadata
} from '../../platform/registry/vertical-registry';

// Simulates underlying database repository/service layer
class RealEstateOrganizationService {
  private static mockData: Record<string, OrganizationUnit & { childrenIds: string[] }> = {
    'root-company': {
      id: 'root-company',
      name: 'Bella Land HQ',
      kind: 'company',
      managerName: 'Nguyễn Văn CEO',
      metricValues: [
        { metricId: 'leads', value: 1540 },
        { metricId: 'bookings', value: 230 },
        { metricId: 'sales', value: 88 },
        { metricId: 'revenue', value: 152000000000 },
        { metricId: 'conversion', value: 28 }
      ],
      hasChildren: true,
      childrenIds: ['branch-hanoi', 'branch-hcm']
    },
    'branch-hanoi': {
      id: 'branch-hanoi',
      name: 'Sàn Hà Nội',
      kind: 'branch',
      managerName: 'Nguyễn Văn A',
      metricValues: [
        { metricId: 'leads', value: 820 },
        { metricId: 'bookings', value: 130 },
        { metricId: 'sales', value: 48 },
        { metricId: 'revenue', value: 86000000000 },
        { metricId: 'conversion', value: 26 }
      ],
      hasChildren: true,
      childrenIds: ['team-lead1']
    },
    'team-lead1': {
      id: 'team-lead1',
      name: 'Nhóm Kinh Doanh 1',
      kind: 'team',
      managerName: 'Trần Thị B',
      metricValues: [
        { metricId: 'leads', value: 420 },
        { metricId: 'bookings', value: 75 },
        { metricId: 'sales', value: 28 },
        { metricId: 'revenue', value: 52000000000 },
        { metricId: 'conversion', value: 30 }
      ],
      hasChildren: true,
      childrenIds: ['sale-1', 'sale-2']
    },
    'sale-1': {
      id: 'sale-1',
      name: 'Lê Văn C',
      kind: 'member',
      metricValues: [
        { metricId: 'leads', value: 150 },
        { metricId: 'bookings', value: 30 },
        { metricId: 'sales', value: 12 },
        { metricId: 'revenue', value: 24000000000 },
        { metricId: 'conversion', value: 32 }
      ],
      hasChildren: false,
      childrenIds: []
    },
    'sale-2': {
      id: 'sale-2',
      name: 'Phạm Văn D',
      kind: 'member',
      metricValues: [
        { metricId: 'leads', value: 130 },
        { metricId: 'bookings', value: 25 },
        { metricId: 'sales', value: 10 },
        { metricId: 'revenue', value: 18000000000 },
        { metricId: 'conversion', value: 29 }
      ],
      hasChildren: false,
      childrenIds: []
    },
    'branch-hcm': {
      id: 'branch-hcm',
      name: 'Sàn TP.HCM',
      kind: 'branch',
      managerName: 'Trần Văn Nam',
      metricValues: [
        { metricId: 'leads', value: 720 },
        { metricId: 'bookings', value: 100 },
        { metricId: 'sales', value: 40 },
        { metricId: 'revenue', value: 66000000000 },
        { metricId: 'conversion', value: 24 }
      ],
      hasChildren: false,
      childrenIds: []
    }
  };

  static async fetchNode(id: string): Promise<OrganizationUnit | null> {
    const data = this.mockData[id];
    if (!data) return null;
    const { childrenIds: _childrenIds, ...node } = data;
    return node;
  }

  static async fetchChildren(parentId: string): Promise<OrganizationUnit[]> {
    const parent = this.mockData[parentId];
    if (!parent) return [];
    const children: OrganizationUnit[] = [];
    for (const childId of parent.childrenIds) {
      const child = await this.fetchNode(childId);
      if (child) children.push(child);
    }
    return children;
  }
}

export class RealEstateOrganizationTreeProvider implements OrganizationTreeProvider {
  readonly metadata: ProviderMetadata = {
    version: '1.0.0',
    author: 'Bella Land Architect Team',
    capability: 'organization_center'
  };

  constructor(private readonly context: ProviderContext) {}

  getTerminology() {
    return {
      root: 'Ban Giám Đốc',
      level1: 'Sàn giao dịch',
      level2: 'Nhóm kinh doanh',
      member: 'Chuyên viên tư vấn',
    };
  }

  private getRepository() {
    // Falls back to local service mock if no repository service is injected in context
    return this.context.services?.organizationRepository || RealEstateOrganizationService;
  }

  async getRoot(): Promise<OrganizationUnit> {
    const node = await this.getRepository().fetchNode('root-company');
    if (!node) throw new Error('Root company node not found');
    return node;
  }

  async getChildren(nodeId: string): Promise<OrganizationUnit[]> {
    return this.getRepository().fetchChildren(nodeId);
  }

  async getNode(nodeId: string): Promise<OrganizationUnit | null> {
    return this.getRepository().fetchNode(nodeId);
  }

  async getSummary(nodeId: string): Promise<MetricValue[]> {
    const node = await this.getRepository().fetchNode(nodeId);
    return node ? node.metricValues : [];
  }
}

export class RealEstateOrganizationMetricProvider implements OrganizationMetricProvider {
  readonly metadata: ProviderMetadata = {
    version: '1.0.0',
    author: 'Bella Land Architect Team',
    capability: 'organization_center'
  };

  constructor(private readonly context: ProviderContext) {}

  getMetrics(): MetricDefinition[] {
    return [
      { id: 'leads', label: 'Lead được giao', format: 'number', icon: 'FolderKanban', color: 'blue', description: 'Tổng số lead kinh doanh được cấp phát', aggregation: 'sum', drilldown: true, visible: true },
      { id: 'bookings', label: 'Số ca đặt cọc', format: 'number', icon: 'ClipboardList', color: 'amber', description: 'Số lượng đặt cọc giữ chỗ căn hộ', aggregation: 'sum', drilldown: true, visible: true },
      { id: 'sales', label: 'Sản phẩm bán được', format: 'number', icon: 'Building2', color: 'emerald', description: 'Số lượng căn hộ đã ký HĐMB thành công', aggregation: 'sum', drilldown: true, visible: true },
      { id: 'revenue', label: 'Doanh số bán hàng', format: 'currency', icon: 'Banknote', color: 'indigo', description: 'Tổng giá trị giao dịch ký hợp đồng', aggregation: 'sum', drilldown: true, visible: true },
      { id: 'conversion', label: 'Tỷ lệ chốt', format: 'percent', icon: 'LineChart', color: 'rose', description: 'Tỷ lệ chốt hợp đồng từ số lead nhận', aggregation: 'avg', drilldown: false, visible: true },
    ];
  }
}
