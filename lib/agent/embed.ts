/**
 * AI Agent: эмбеддинги.
 * AGENT_EMBEDDINGS_PROVIDER=openai|ollama|stub
 * openai — text-embedding-3-small (1536 dim), требует OPENAI_API_KEY
 * ollama — nomic-embed-text (оффлайн), требует OLLAMA_BASE_URL (default localhost:11434)
 * stub — sha256-заглушка (fallback при ошибке провайдера)
 */
import { createHash } from 'crypto';

export const EMBEDDING_DIM = 1536;
export const EMBEDDING_MODEL_OPENAI = 'text-embedding-3-small';
export const EMBEDDING_MODEL_OLLAMA = 'nomic-embed-text';

export type EmbeddingProvider = 'openai' | 'ollama' | 'stub';

export function getEmbeddingProvider(): EmbeddingProvider {
  const p = process.env.AGENT_EMBEDDINGS_PROVIDER?.toLowerCase();
  if (p === 'ollama') return 'ollama';
  if (p === 'stub') return 'stub';
  if (p === 'openai' || process.env.OPENAI_API_KEY) return 'openai';
  return 'stub';
}

async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const input = texts.map((t) => t.replace(/\s+/g, ' ').trim().slice(0, 8000));
  const { data } = await client.embeddings.create({
    model: EMBEDDING_MODEL_OPENAI,
    input,
  });
  const sorted = [...data].sort((a, b) => a.index - b.index);
  return sorted.map((e) => e.embedding);
}

async function embedOllama(texts: string[]): Promise<number[][]> {
  const base = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const results: number[][] = [];
  for (const text of texts) {
    const input = text.replace(/\s+/g, ' ').trim().slice(0, 8000);
    const res = await fetch(`${base}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL_OLLAMA, prompt: input }),
    });
    if (!res.ok) throw new Error(`Ollama: ${res.status}`);
    const json = (await res.json()) as { embedding: number[] };
    let vec = json.embedding ?? [];
    if (vec.length !== EMBEDDING_DIM) {
      vec = [...vec, ...Array(Math.max(0, EMBEDDING_DIM - vec.length)).fill(0)].slice(0, EMBEDDING_DIM);
    }
    results.push(vec);
  }
  return results;
}

function embedStub(texts: string[]): number[][] {
  const dim = EMBEDDING_DIM;
  return texts.map((t) => {
    const h = createHash('sha256').update(t).digest();
    return Array.from({ length: dim }, (_, i) => (h[i % h.length]! / 255) * 2 - 1);
  });
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const provider = getEmbeddingProvider();
  try {
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      return await embedOpenAI(texts);
    }
    if (provider === 'ollama') {
      return await embedOllama(texts);
    }
  } catch (e) {
    console.warn('[agent/embed] Provider failed, fallback to stub:', e);
  }
  return embedStub(texts);
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embed([text]);
  return v!;
}

export function getEmbeddingDim(): number {
  return EMBEDDING_DIM;
}
