#!/usr/bin/env node
/**
 * Подготовка E2E: очистка временной директории .tmp/e2e-workspace
 * для исключения side effects между прогонами.
 */
import { rmSync, mkdirSync } from 'fs';
import { join } from 'path';

const dir = join(process.cwd(), '.tmp', 'e2e-workspace');
try {
  rmSync(dir, { recursive: true, force: true });
} catch (_) {}
mkdirSync(dir, { recursive: true });
