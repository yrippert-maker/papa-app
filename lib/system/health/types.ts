export type HealthCheck = {
  name: string;
  ok: boolean;
  severity: "info" | "warn" | "fail";
  message: string;
  meta?: Record<string, unknown>;
};

export type SystemHealth = {
  version: 1;
  generated_at: string;
  status: "ok" | "degraded" | "fail";
  checks: HealthCheck[];
};
