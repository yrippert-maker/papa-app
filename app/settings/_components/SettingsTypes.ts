export type Role = 'Owner' | 'Admin' | 'Operator' | 'Reviewer' | 'Viewer';

export type User = {
  id: string;
  email: string;
  role: Role;
  active: boolean;
  lastLoginAt?: string | null;
};

export type EmailSourceType = 'domain' | 'email';
export type EmailSource = {
  id: string;
  type: EmailSourceType;
  value: string;
  label: string;
  enabled: boolean;
  requireDmarcPass: boolean;
  autoCollect: boolean;
  autoAnalyze: boolean;
  requireApproval: boolean;
};

export type Authority = 'ICAO' | 'EASA' | 'FAA' | 'ARMAK';
export type RegulatorySource = {
  id: string;
  authority: Authority;
  docId?: string;
  url: string;
  enabled: boolean;
  downloadMode: 'fulltext' | 'metadata';
  monitoring: 'monthly' | 'weekly' | 'manual';
};

export type UpdatePolicies = {
  email: { mode: 'scheduled' | 'manual'; intervalMin?: number; requireDmarcPass: boolean };
  regulatory: {
    mode: 'scheduled' | 'manual';
    schedule?: { type: 'monthly' | 'weekly'; day?: number; hour: number };
  };
  processing: {
    autoCollect: boolean;
    autoAnalyze: boolean;
    requireApproval: boolean;
    autoApplyAfterApproval: boolean;
  };
  audit: { enabled: boolean; retainRawDays: number };
};
