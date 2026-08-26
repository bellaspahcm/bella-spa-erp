import React, { createContext, useContext } from 'react';

export interface PatientContext {
  readonly id: string;
  readonly recordNumber: string;
  readonly fullName: string;
  readonly gender: 'male' | 'female';
  readonly dob: string;
  readonly bloodType: string;
  readonly allergies: string[];
  readonly bhytCode?: string;
  readonly benefitRate?: number;
}

export interface EncounterContext {
  readonly id: string;
  readonly queueNumber?: number;
  readonly status: 'planned' | 'arrived' | 'triaged' | 'in_progress' | 'finished' | 'cancelled' | 'no_show' | 'transferred' | 'referred' | 'admission';
  readonly chiefComplaint: string;
  readonly scheduledAt?: string;
  readonly startedAt?: string;
  readonly subjective?: string;
  readonly objective?: string;
  readonly assessment?: string;
  readonly plan?: string;
}

export interface WorkspaceManifest {
  readonly id: string;
  readonly layout: '3-column' | '2-column' | 'split-pane';
  readonly capabilities: string[];
  readonly regions: {
    readonly header: string[];
    readonly left: string[];
    readonly center: string[];
    readonly right: string[];
    readonly footer?: string[];
  };
  readonly workflow: string;
  readonly theme: string;
  readonly navigation?: string[];
  readonly shortcuts: Record<string, string>;
  readonly aiAgents: string[];
}

export interface ClinicalContextType {
  readonly patient: PatientContext;
  readonly encounter: EncounterContext;
  readonly doctor: { id: string; name: string };
  readonly facility: { id: string; name: string };
  readonly branch: { id: string; name: string };
  readonly permissions: string[];
  readonly manifest: WorkspaceManifest;
  readonly capabilities: string[];
  readonly refreshData: () => void;
}

const ClinicalContext = createContext<ClinicalContextType | undefined>(undefined);

export function ClinicalContextProvider({ 
  children, 
  value 
}: { 
  children: React.ReactNode; 
  value: ClinicalContextType 
}) {
  return (
    <ClinicalContext.Provider value={value}>
      {children}
    </ClinicalContext.Provider>
  );
}

export function useClinicalContext() {
  const context = useContext(ClinicalContext);
  if (!context) {
    throw new Error('useClinicalContext must be used within a ClinicalContextProvider');
  }
  return context;
}
