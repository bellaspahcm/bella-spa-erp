import React from 'react';
import PatientBanner from './PatientBanner';
import ClinicalAlerts from './ClinicalAlerts';
import SOAPEditor from './SOAPEditor';
import MedicalTimeline from './MedicalTimeline';
import ClinicalDecisionPanel from './ClinicalDecisionPanel';
import QuickActions from './QuickActions';
import VitalSigns from './VitalSigns';
import ClinicalContextPanel from './ClinicalContextPanel';

export const WorkspaceComponentRegistry: Record<string, React.ComponentType<Record<string, unknown>>> = {
  patient_banner: PatientBanner,
  clinical_alerts: ClinicalAlerts,
  soap_editor: SOAPEditor,
  medical_timeline: MedicalTimeline,
  clinical_decision_panel: ClinicalDecisionPanel,
  quick_actions: QuickActions,
  vital_signs: VitalSigns,
  clinical_context_panel: ClinicalContextPanel,
};
