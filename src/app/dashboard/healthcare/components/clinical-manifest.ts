export interface BaseManifest {
  readonly id: string;
  readonly capabilities: string[];
}

export interface WorkspaceManifest extends BaseManifest {
  readonly layout: '3-column' | '2-column' | 'split-pane';
  readonly regions: {
    readonly header: string[];
    readonly left: string[];
    readonly center: string[];
    readonly right: string[];
    readonly footer?: string[];
  };
  readonly workflow: string;
  readonly theme: string;
  readonly shortcuts: Record<string, string>;
  readonly aiAgents: string[];
}

export interface DashboardManifest extends BaseManifest {
  readonly widgets: string[];
  readonly layouts: Record<string, unknown>;
}

export interface ProductManifest {
  readonly id: string;
  readonly workspace: WorkspaceManifest;
  readonly dashboard: DashboardManifest;
}

// 1. Medical Clinic Manifest Configuration
export const MedicalClinicManifest: ProductManifest = {
  id: 'medical_clinic',
  workspace: {
    id: 'medical_workspace',
    capabilities: ['clinical', 'laboratory', 'imaging', 'pharmacy', 'billing'],
    layout: '3-column',
    regions: {
      header: ['patient_banner'],
      left: ['quick_actions', 'medical_timeline'],
      center: ['soap_editor', 'vital_signs', 'clinical_context_panel'],
      right: ['clinical_alerts', 'clinical_decision_panel'],
    },
    workflow: 'medical_encounter_flow',
    theme: 'emerald',
    shortcuts: {
      'ctrl+s': 'save_soap',
      'ctrl+p': 'print_prescription',
    },
    aiAgents: ['clinical_copilot'],
  },
  dashboard: {
    id: 'medical_dashboard',
    capabilities: ['operational_dashboard', 'workflow_queue'],
    widgets: [
      'clinic_summary_stats',
      'queue_realtime_monitor',
      'facility_status_map',
      'ai_coo_command_center',
      'clinical_pipeline_summary',
      'it_auditing_tools'
    ],
    layouts: {
      grid: 'grid-cols-1 lg:grid-cols-3 gap-6',
    },
  },
};

// 2. Dental Clinic Manifest Configuration
export const DentalClinicManifest: ProductManifest = {
  id: 'dental_clinic',
  workspace: {
    id: 'dental_workspace',
    capabilities: ['clinical', 'chair', 'odontogram', 'pharmacy', 'billing'],
    layout: '3-column',
    regions: {
      header: ['patient_banner'],
      left: ['quick_actions', 'medical_timeline'],
      center: ['soap_editor', 'vital_signs', 'clinical_context_panel'],
      right: ['clinical_alerts', 'clinical_decision_panel'],
    },
    workflow: 'dental_encounter_flow',
    theme: 'indigo',
    shortcuts: {
      'ctrl+s': 'save_soap',
    },
    aiAgents: ['dental_copilot'],
  },
  dashboard: {
    id: 'dental_dashboard',
    capabilities: ['operational_dashboard', 'workflow_queue', 'chair_management'],
    widgets: [
      'clinic_summary_stats',
      'chair_management_grid',
      'queue_realtime_monitor',
      'ai_coo_command_center',
      'clinical_pipeline_summary',
      'it_auditing_tools'
    ],
    layouts: {
      grid: 'grid-cols-1 lg:grid-cols-3 gap-6',
    },
  },
};
