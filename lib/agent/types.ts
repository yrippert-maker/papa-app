/**
 * AI Agent: контракты API.
 */
export type SearchFilters = {
  ext?: Array<'pdf' | 'txt' | 'md' | 'docx'>;
  pathPrefix?: string;
};

export type SearchRequest = {
  query: string;
  filters?: SearchFilters;
  topK?: number;
};

export type SearchResult = {
  docId: string;
  path: string;
  filename: string;
  ext: string;
  score: number;
  snippet: string;
  highlights?: string[];
};

export type SearchResponse = { results: SearchResult[] };

export type DraftIntent = 'letter' | 'act' | 'report' | 'memo';

export type DraftRequest = {
  sessionId?: string;
  intent: DraftIntent;
  instructions: string;
  selectedDocIds: string[];
};

export type EvidenceItem = {
  docId: string;
  path: string;
  sha256: string;
  chunkIds: string[];
};

export type DraftResponse = {
  sessionId: string;
  draftId: string;
  templateKey: DraftIntent;
  draftFields: Record<string, unknown>;
  missingFields: Array<{ key: string; question: string }>;
  evidence: EvidenceItem[];
  warnings: string[];
};
