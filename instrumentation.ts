/**
 * Next.js instrumentation: runs once when the server starts.
 * Validates env to prevent "тихие" runtime errors (missing NEXTAUTH_SECRET, invalid DATABASE_URL).
 * В development пропускаем строгую проверку — NEXTAUTH_SECRET может отсутствовать.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { validateEnv } = await import("./lib/env");
    validateEnv();
  }
}
