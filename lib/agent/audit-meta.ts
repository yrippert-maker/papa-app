/**
 * Audit meta для confirm/export — DD ("какая версия логики сделала финал").
 * workflow_schema_version, agent_version (git), template_version, embeddings.
 */
import { getEmbeddingProvider, EMBEDDING_MODEL_OPENAI, EMBEDDING_MODEL_OLLAMA } from './embed';

export const WORKFLOW_SCHEMA_VERSION = '1.0';

export type AuditSource = { path: string; sha256: string; chunkIds: string[]; confidence?: number };

export type AuditMeta = {
  workflow_schema_version: string;
  agent_version: string;
  template_version?: string;
  embeddings?: { provider: string; model: string; dim: number };
  sources?: AuditSource[];
};

export function buildAuditMeta(templateVersion?: string, sources?: AuditSource[]): AuditMeta {
  const agentVersion =
    process.env.AGENT_VERSION ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_REF ??
    'dev';
  const provider = getEmbeddingProvider();
  const model = provider === 'openai' ? EMBEDDING_MODEL_OPENAI : provider === 'ollama' ? EMBEDDING_MODEL_OLLAMA : 'stub';
  return {
    workflow_schema_version: WORKFLOW_SCHEMA_VERSION,
    agent_version: String(agentVersion).slice(0, 40),
    ...(templateVersion && { template_version: templateVersion }),
    embeddings: { provider, model, dim: 1536 },
    ...(sources?.length && { sources }),
  };
}
