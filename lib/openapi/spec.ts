/**
 * OpenAPI 3.1 spec for critical routes.
 * Source of truth: lib/openapi/spec.json
 * Run: npm run openapi:generate
 */

import spec from './spec.json';

export const openApiSpec = spec as {
  openapi: string;
  info: { title: string; version: string; description?: string };
  paths: Record<string, unknown>;
  components?: Record<string, unknown>;
};
