/**
 * Env validation for production.
 * Used by instrumentation.ts to fail fast on missing required vars.
 */
export function validateEnv(): void {
  const required: string[] = ["DATABASE_URL", "NEXTAUTH_SECRET"];
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}
