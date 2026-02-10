#!/usr/bin/env node
/**
 * A6: OpenAPI spec validation
 * Validates public/openapi.json structure.
 * Run: node scripts/validate-openapi.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const specPath = join(root, 'public/openapi.json');

function validate() {
  const raw = readFileSync(specPath, 'utf8');
  const spec = JSON.parse(raw);

  const errors = [];

  if (!spec.openapi || !spec.openapi.startsWith('3')) {
    errors.push('Missing or invalid openapi version');
  }
  if (!spec.info?.title) errors.push('Missing info.title');
  if (!spec.paths || typeof spec.paths !== 'object') {
    errors.push('Missing or invalid paths');
  }

  const pathCount = Object.keys(spec.paths || {}).length;
  if (pathCount < 3) {
    errors.push(`Too few paths: ${pathCount}`);
  }

  for (const [path, methods] of Object.entries(spec.paths || {})) {
    if (typeof methods !== 'object') {
      errors.push(`Invalid path ${path}`);
    }
  }

  if (errors.length > 0) {
    console.error('OpenAPI validation failed:');
    errors.forEach((e) => console.error('  -', e));
    process.exit(1);
  }

  console.log(`OK: OpenAPI ${spec.openapi}, ${pathCount} paths`);
}

validate();
