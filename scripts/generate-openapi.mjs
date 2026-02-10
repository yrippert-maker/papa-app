#!/usr/bin/env node
/**
 * Generate public/openapi.json from lib/openapi/spec.json
 * Run: node scripts/generate-openapi.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const specPath = join(root, 'lib/openapi/spec.json');
const outPath = join(root, 'public/openapi.json');

const spec = JSON.parse(readFileSync(specPath, 'utf-8'));
writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log('Wrote', outPath);
