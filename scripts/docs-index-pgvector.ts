#!/usr/bin/env npx tsx
/**
 * docs:index:pgvector — индексация в Postgres + pgvector.
 * Требует: DATABASE_URL, DOCS_ROOT_DIR
 */
import { indexDocs } from '../lib/agent/indexer';

async function main() {
  const result = await indexDocs();
  console.log('Indexed:', result.indexed, 'documents,', result.chunks, 'chunks');
  if (result.errors.length) {
    console.warn('Errors:', result.errors.length);
    result.errors.slice(0, 10).forEach((e) => console.warn('  ', e));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
