export interface SubAgentResponse {
  agent: string;
  period: string;
  summary: string;
  data: unknown;
  /** Payload rút gọn gửi vào prompt Gemini — tránh vượt giới hạn token */
  aiSummaryData?: unknown;
  anomalies?: unknown[];
  draftProposals?: unknown[];
  reportType?: string;
}

export interface COOAnalysisResult {
  status: string;
  timestamp: string;
  sender: string;
  recipient: string;
  period: string;
  routedAgent: string;
  analysis: {
    executiveSummary: string;
    anomaliesFound: unknown[];
    fullData: unknown[];
  };
  draftActions: unknown[];
  strategicRecommendations: string[];
}
